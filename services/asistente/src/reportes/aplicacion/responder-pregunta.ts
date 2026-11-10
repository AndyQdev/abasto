import { describirEsquema } from '../dominio/esquema.js';
import { alternativasDe, elegirPlantilla, graficoDe, plantillaDeGrafico, type Plantilla } from '../dominio/plantillas.js';
import type {
  BloqueGenerado,
  BloqueParaLeer,
  ConsultaGenerada,
  Lectura,
  ModeloDeLenguaje,
  ResultadoDeConsulta,
  Solicitante,
  TipoDeGrafico,
} from '../puertos.js';
import { ConsultaRechazada, type ConsultarReportes } from './consultar-reportes.js';

/** Un bloque de la vista, ya con sus datos y la plantilla en la que encajan. */
export interface BloqueDeRespuesta extends ResultadoDeConsulta {
  titulo: string;
  sql: string;
  /** Con la que se dibuja */
  plantilla: Plantilla;
  /** La que eligió el modelo (puede no encajar con los datos) */
  pedida: Plantilla;
  /** Si se cambió la pedida: por qué */
  aviso?: string;
  /** Con cuáles más se puede ver («Ver como») */
  alternativas: Plantilla[];
}

/**
 * La respuesta lleva arriba el primer bloque (sql, columnas, filas, grafico) como antes, así lo de siempre (evaluar,
 * Excel, lo guardado sin señal) sigue andando; la vista completa va en `bloques`.
 */
export interface Respuesta extends ResultadoDeConsulta {
  pregunta: string;
  sql: string;
  explicacion: string;
  grafico: TipoDeGrafico;
  modelo: string;
  bloques: BloqueDeRespuesta[];
  lectura: Lectura | null;
}

/** Más bloques que esto no se corren: la mesa es para leer, no para un tablero entero. */
export const MAXIMO_DE_BLOQUES = 5;
/** Filas de cada bloque que lee el modelo para escribir los hallazgos. */
const FILAS_PARA_LEER = 15;

/**
 * Reporte generativo: pregunta en lenguaje natural (escrita o transcrita de la voz) → vista de 1 a 5 bloques, cada uno
 * una plantilla (KPIs, línea, barras, dona, tabla) llena con su consulta → lectura de los resultados.
 */
export class ResponderPregunta {
  constructor(
    private readonly modelo: ModeloDeLenguaje,
    private readonly reportes: ConsultarReportes,
  ) {}

  async ejecutar(pregunta: string, solicitante: Solicitante): Promise<Respuesta> {
    let generada = await this.modelo.generarConsulta(pregunta, describirEsquema());
    let pedidos = bloquesPedidos(generada);
    let resultados = await this.correr(pedidos, solicitante);

    // Si la consulta que responde la pregunta falla en la base (un operador mal tipado, una columna que no existe),
    // se le devuelve el error al modelo UNA vez para que la corrija. Lo que la guardia rechazó no se repara: se dice.
    if (resultados[0].status === 'rejected' && !(resultados[0].reason instanceof ConsultaRechazada)) {
      const error = (resultados[0].reason as Error).message;
      generada = await this.modelo.generarConsulta(conCorreccion(pregunta, pedidos[0].sql, error), describirEsquema());
      pedidos = bloquesPedidos(generada);
      resultados = await this.correr(pedidos, solicitante);
    }
    if (resultados[0].status === 'rejected') {
      const motivo = resultados[0].reason;
      throw motivo instanceof ConsultaRechazada ? motivo : new ConsultaRechazada('la consulta falló en la base de reportes; prueba a preguntarlo de otra forma');
    }
    const bloques = pedidos.flatMap((pedido, i) => {
      const r = resultados[i];
      return r.status === 'fulfilled' ? [armarBloque(pedido, r.value)] : [];
    });

    const [principal] = bloques;
    return {
      pregunta,
      sql: principal.sql,
      explicacion: generada.explicacion,
      grafico: generada.bloques?.length ? graficoDe(principal.plantilla) : generada.grafico,
      columnas: principal.columnas,
      filas: principal.filas,
      truncado: principal.truncado,
      modelo: this.modelo.nombre,
      bloques,
      lectura: await this.leer(pregunta, bloques),
    };
  }

  /** Todos los bloques a la vez; el que falla queda como rechazado y se decide arriba. */
  private correr(pedidos: BloqueGenerado[], solicitante: Solicitante) {
    return Promise.allSettled(pedidos.map((b) => this.reportes.ejecutar(b.sql, solicitante, 'analista')));
  }

  /** La lectura es un extra: si el modelo no la da o falla, el reporte sale igual. */
  private async leer(pregunta: string, bloques: BloqueDeRespuesta[]): Promise<Lectura | null> {
    if (!this.modelo.leerResultados || !bloques.some((b) => b.filas.length)) return null;
    try {
      const lectura = await this.modelo.leerResultados(pregunta, bloques.map(paraLeer));
      return lectura && (lectura.hallazgos.length || lectura.recomendaciones.length) ? lectura : null;
    } catch (e) {
      console.warn(`[Analista] No se pudo leer el resultado: ${(e as Error).message}`);
      return null;
    }
  }
}

const bloquesPedidos = (g: ConsultaGenerada): BloqueGenerado[] =>
  g.bloques?.length ? g.bloques.slice(0, MAXIMO_DE_BLOQUES) : [{ titulo: g.explicacion, plantilla: plantillaDeGrafico(g.grafico), sql: g.sql }];

/** La misma pregunta, con la consulta que falló y el error de PostgreSQL, para que el modelo la arregle. */
export const conCorreccion = (pregunta: string, sql: string, error: string) =>
  `${pregunta}

(Tu consulta anterior para el primer bloque falló en PostgreSQL con «${error.slice(0, 300)}». Era:
${sql}
Arma la vista otra vez corrigiendo ese error.)`;

function armarBloque(pedido: BloqueGenerado, r: ResultadoDeConsulta): BloqueDeRespuesta {
  const eleccion = elegirPlantilla(pedido.plantilla, r);
  return {
    titulo: pedido.titulo,
    sql: pedido.sql,
    ...r,
    plantilla: eleccion.plantilla,
    pedida: pedido.plantilla,
    ...(eleccion.aviso ? { aviso: eleccion.aviso } : {}),
    alternativas: alternativasDe(r),
  };
}

/**
 * Para el modelo, los montos van en bolivianos (`total_bs`): así no tiene que dividir centavos y no se equivoca de
 * cifra al escribir. Solo las primeras filas: alcanza para leer y no se manda la base entera.
 */
export function paraLeer(b: Pick<BloqueDeRespuesta, 'titulo' | 'columnas' | 'filas'>): BloqueParaLeer {
  const nombre = (c: string) => c.replace(/_centavos/, '_bs');
  return {
    titulo: b.titulo,
    columnas: b.columnas.map(nombre),
    filas: b.filas.slice(0, FILAS_PARA_LEER).map((f) =>
      Object.fromEntries(
        b.columnas.map((c) => [nombre(c), c.includes('_centavos') && f[c] !== null && f[c] !== undefined ? Math.round(Number(f[c])) / 100 : f[c]]),
      ),
    ),
  };
}
