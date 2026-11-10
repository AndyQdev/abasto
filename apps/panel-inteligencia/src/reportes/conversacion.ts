import { encabezado, formatearCelda } from '../sesion';

/**
 * Reportes como conversación: a la izquierda el chat con el Analista; a la derecha la mesa de trabajo, donde cada
 * respuesta se arma como un reporte en su pestaña. Aquí está la lógica sin pantalla: qué plantilla usa cada
 * reporte, los números que se destacan y cómo se guarda la conversación mientras dura la sesión.
 */

/** Las plantillas de un bloque de la mesa (las elige el Analista; el Asistente comprueba que los datos encajen). */
export type PlantillaDeBloque = 'kpis' | 'linea' | 'barras' | 'dona' | 'tabla';

export interface BloqueDelReporte {
  titulo: string;
  sql: string;
  plantilla: PlantillaDeBloque;
  pedida: PlantillaDeBloque;
  /** Si los datos no encajaban en la que pidió el Analista: por qué se cambió */
  aviso?: string;
  /** Con cuáles más se puede ver («Ver como») */
  alternativas: PlantillaDeBloque[];
  columnas: string[];
  filas: Record<string, unknown>[];
  truncado: boolean;
}

export interface Lectura {
  hallazgos: string[];
  recomendaciones: string[];
}

/** Lo que responde el Asistente a una pregunta (contracts/openapi/asistente.yaml). */
export interface RespuestaDelAsistente {
  pregunta: string;
  sql: string;
  explicacion: string;
  grafico: string;
  columnas: string[];
  filas: Record<string, unknown>[];
  truncado: boolean;
  modelo: string;
  /** La vista completa (desde el 10/11). Las respuestas de antes no la traen */
  bloques?: BloqueDelReporte[];
  lectura?: Lectura | null;
}

export interface Reporte extends RespuestaDelAsistente {
  id: string;
  /** ISO: cuándo se respondió */
  hora: string;
  /** Si viene de lo guardado en el equipo (sin señal): de cuándo es */
  deGuardado?: string;
}

export type Mensaje =
  | { id: string; de: 'tu'; texto: string; hora: string; porVoz?: boolean; estado: 'enviada' | 'respondida' | 'espera-senal' }
  | { id: string; de: 'analista'; tipo: 'reporte'; texto: string; hora: string; reporteId: string }
  | { id: string; de: 'analista'; tipo: 'aclaracion'; texto: string; hora: string; opciones: string[] }
  | { id: string; de: 'analista'; tipo: 'falla' | 'aviso'; texto: string; hora: string };

export interface Conversacion {
  mensajes: Mensaje[];
  reportes: Reporte[];
  activa: string | null;
}

/** Cómo se muestra un reporte en la mesa (el ícono de su pestaña). */
export type Plantilla = 'numeros' | 'barras' | 'linea' | 'dona' | 'tabla' | 'vista' | 'aviso' | 'vacio';

const esNumero = (v: unknown) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)));

const DE_BLOQUE: Record<PlantillaDeBloque, Plantilla> = { kpis: 'numeros', linea: 'linea', barras: 'barras', dona: 'dona', tabla: 'tabla' };

export function plantillaDe(r: Pick<RespuestaDelAsistente, 'columnas' | 'filas' | 'grafico' | 'bloques'>): Plantilla {
  if (r.bloques && r.bloques.length > 1) return 'vista';
  if (r.bloques?.length === 1 && r.filas.length && !(r.columnas.length === 1 && r.columnas[0] === 'aviso')) return DE_BLOQUE[r.bloques[0].plantilla];
  if (!r.filas.length) return 'vacio';
  // «SELECT 'Sin datos para esa pregunta' AS aviso»: el Analista no tenía con qué responder
  if (r.columnas.length === 1 && r.columnas[0] === 'aviso') return 'aviso';
  // Una sola fila con números («¿cuánto vendí este mes?»): se leen mejor en grande que en una tabla de una fila
  if (r.filas.length === 1 && r.columnas.length <= 4 && r.columnas.some((c) => esNumero(r.filas[0][c]))) return 'numeros';
  if (r.grafico === 'barras' || r.grafico === 'linea') return r.grafico;
  return 'tabla';
}

export interface Destacado {
  etiqueta: string;
  valor: string;
  /** Texto chico debajo del número */
  detalle?: string;
}

/** Los números de un reporte de una sola fila, en grande. Los textos de esa fila van como detalle. */
export function numerosDe(r: Pick<RespuestaDelAsistente, 'columnas' | 'filas'>): Destacado[] {
  const fila = r.filas[0] ?? {};
  const textos = r.columnas.filter((c) => !esNumero(fila[c])).map((c) => formatearCelda(c, fila[c]));
  return r.columnas
    .filter((c) => esNumero(fila[c]))
    .map((c) => ({ etiqueta: encabezado(c), valor: formatearCelda(c, fila[c]), detalle: textos.join(' · ') || undefined }));
}

/**
 * Lo que resume un gráfico: el mayor y, si son montos, el total. Sumar otra cosa (un promedio, un riesgo) daría un
 * número que no significa nada, así que solo se suman bolivianos.
 */
export function resumenDe(r: Pick<RespuestaDelAsistente, 'columnas' | 'filas'>, columnaEtiqueta: string, columnaValor: string): Destacado[] {
  if (!r.filas.length) return [];
  const mayor = r.filas.reduce((a, b) => (Number(b[columnaValor] ?? 0) > Number(a[columnaValor] ?? 0) ? b : a));
  const destacados: Destacado[] = [
    {
      etiqueta: 'El mayor',
      valor: formatearCelda(columnaValor, mayor[columnaValor]),
      detalle: formatearCelda(columnaEtiqueta, mayor[columnaEtiqueta]),
    },
  ];
  if (columnaValor.endsWith('_centavos')) {
    const total = r.filas.reduce((s, f) => s + Number(f[columnaValor] ?? 0), 0);
    destacados.unshift({ etiqueta: 'Total', valor: formatearCelda(columnaValor, total), detalle: `${r.filas.length} filas` });
  }
  return destacados;
}

/**
 * Los bloques de un reporte. Uno de antes (o guardado sin señal antes del 10/11) no trae bloques: es uno solo, con la
 * plantilla que sale de su forma.
 */
export function bloquesDe(r: RespuestaDelAsistente): BloqueDelReporte[] {
  if (r.bloques?.length) return r.bloques;
  const p = plantillaDe({ ...r, bloques: undefined });
  const plantilla: PlantillaDeBloque = p === 'numeros' ? 'kpis' : p === 'barras' || p === 'linea' ? p : 'tabla';
  return [
    {
      titulo: r.explicacion,
      sql: r.sql,
      plantilla,
      pedida: plantilla,
      alternativas: plantilla === 'tabla' ? ['tabla'] : [plantilla, 'tabla'],
      columnas: r.columnas,
      filas: r.filas,
      truncado: r.truncado,
    },
  ];
}

export const SUFIJO_ANTERIOR = '_anterior';

export interface Kpi extends Destacado {
  /** Contra el período anterior, si la consulta lo trajo («+12,5 %») */
  variacion?: { texto: string; sentido: 'sube' | 'baja' | 'igual'; antes: string };
}

const formatoPorciento = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

/** Las tarjetas de un bloque de KPIs: cada número es una; su «_anterior» no es tarjeta, es la comparación. */
export function kpisDe(b: Pick<BloqueDelReporte, 'columnas' | 'filas'>): Kpi[] {
  const fila = b.filas[0] ?? {};
  const numericas = b.columnas.filter((c) => esNumero(fila[c]));
  const textos = b.columnas.filter((c) => !esNumero(fila[c]) && fila[c] !== null).map((c) => formatearCelda(c, fila[c]));
  return numericas
    .filter((c) => !c.endsWith(SUFIJO_ANTERIOR))
    .map((c) => {
      const kpi: Kpi = { etiqueta: encabezado(c), valor: formatearCelda(c, fila[c]), detalle: textos.join(' · ') || undefined };
      const anterior = fila[`${c}${SUFIJO_ANTERIOR}`];
      if (esNumero(anterior)) {
        const ahora = Number(fila[c]);
        const antes = Number(anterior);
        const textoAntes = `antes ${formatearCelda(c, anterior)}`;
        if (antes === 0) kpi.variacion = { texto: ahora === 0 ? 'igual' : 'nuevo', sentido: ahora === 0 ? 'igual' : 'sube', antes: textoAntes };
        else {
          const cambio = ((ahora - antes) / Math.abs(antes)) * 100;
          const sentido = Math.abs(cambio) < 0.05 ? 'igual' : cambio > 0 ? 'sube' : 'baja';
          kpi.variacion = { texto: `${cambio > 0 ? '+' : ''}${formatoPorciento.format(cambio)} %`, sentido, antes: textoAntes };
        }
      }
      return kpi;
    });
}

/** Una dona con más de 6 colores ya no se distingue: las partes chicas van juntas en «Otros». */
export const MAXIMO_DE_PORCIONES = 6;

export interface Porcion {
  etiqueta: string;
  valor: number;
  texto: string;
  porciento: number;
  otros?: boolean;
}

export function porcionesDe(b: Pick<BloqueDelReporte, 'columnas' | 'filas'>, columnaEtiqueta: string, columnaValor: string): Porcion[] {
  const partes = b.filas
    .map((f) => ({ etiqueta: formatearCelda(columnaEtiqueta, f[columnaEtiqueta]), valor: Math.max(0, Number(f[columnaValor] ?? 0)) }))
    .sort((a, b2) => b2.valor - a.valor);
  const visibles = partes.length > MAXIMO_DE_PORCIONES ? partes.slice(0, MAXIMO_DE_PORCIONES - 1) : partes;
  const resto = partes.slice(visibles.length);
  const todas = resto.length ? [...visibles, { etiqueta: 'Otros', valor: resto.reduce((s, p) => s + p.valor, 0), otros: true }] : visibles;
  const total = todas.reduce((s, p) => s + p.valor, 0) || 1;
  return todas.map((p) => ({ ...p, texto: formatearCelda(columnaValor, p.valor), porciento: (p.valor / total) * 100 }));
}

/** Para el Excel: una hoja por bloque con datos (el nombre de la hoja es el título del bloque). */
export const hojasDe = (r: RespuestaDelAsistente) =>
  bloquesDe(r)
    .filter((b) => b.filas.length)
    .map((b) => ({ titulo: b.titulo.slice(0, 60), columnas: b.columnas, filas: b.filas }));

/** Título de la pestaña: la pregunta, corta y sin signos sueltos. */
export function tituloCorto(pregunta: string, maximo = 30): string {
  const limpia = pregunta.replace(/^[¿¡\s]+|[?!.\s]+$/g, '').trim();
  const titulo = limpia.charAt(0).toUpperCase() + limpia.slice(1);
  return titulo.length > maximo ? `${titulo.slice(0, maximo - 1).trimEnd()}…` : titulo;
}

/** «14:05» */
export function horaCorta(iso: string): string {
  const f = new Date(iso);
  return `${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}`;
}

let contador = 0;
export const nuevoId = () => `${Date.now().toString(36)}-${(contador++).toString(36)}`;

/** Preguntas para empezar. Todas salen bien con los datos de demostración. */
export const SUGERENCIAS = [
  { pregunta: '¿Cómo va mi negocio y cómo puedo vender más?', plantilla: 'vista' as const, titulo: 'Diagnóstico de tu negocio' },
  { pregunta: '¿Cómo me pagan mis tiendas?', plantilla: 'dona' as const, titulo: 'Cómo te pagan' },
  { pregunta: '¿Qué tiendas me deben más plata?', plantilla: 'barras' as const, titulo: 'Quién te debe' },
  { pregunta: '¿Cuánto vendí cada semana en los últimos 3 meses?', plantilla: 'linea' as const, titulo: 'Ventas por semana' },
  { pregunta: '¿Cuánto vendí este mes?', plantilla: 'numeros' as const, titulo: 'Lo vendido este mes' },
  { pregunta: '¿Qué productos se me pueden acabar esta semana?', plantilla: 'tabla' as const, titulo: 'Lo que se puede acabar' },
];

// --- La conversación dura lo que la sesión del navegador: se puede ir a Pedidos y volver sin perderla ---

/** Más que esto no se guarda: la conversación es para seguir trabajando, lo viejo queda en «Guardados». */
const MAXIMO_DE_MENSAJES = 60;
const MAXIMO_DE_REPORTES = 8;
const MAXIMO_DE_FILAS = 200;

const clave = (orgId: string) => `abasto:inteligencia:conversacion:${orgId}`;

export const conversacionVacia = (): Conversacion => ({ mensajes: [], reportes: [], activa: null });

export function cargarConversacion(orgId: string): Conversacion {
  try {
    const crudo = globalThis.sessionStorage?.getItem(clave(orgId));
    const c = crudo ? (JSON.parse(crudo) as Conversacion) : null;
    return c && Array.isArray(c.mensajes) && Array.isArray(c.reportes) ? c : conversacionVacia();
  } catch {
    return conversacionVacia();
  }
}

export function guardarConversacion(orgId: string, c: Conversacion): void {
  const recortar = <T extends { filas: Record<string, unknown>[]; truncado: boolean }>(x: T): T => ({
    ...x,
    filas: x.filas.slice(0, MAXIMO_DE_FILAS),
    truncado: x.truncado || x.filas.length > MAXIMO_DE_FILAS,
  });
  const reportes = c.reportes
    .slice(-MAXIMO_DE_REPORTES)
    .map((r) => ({ ...recortar(r), ...(r.bloques ? { bloques: r.bloques.map(recortar) } : {}) }));
  const activa = reportes.some((r) => r.id === c.activa) ? c.activa : (reportes.at(-1)?.id ?? null);
  try {
    globalThis.sessionStorage?.setItem(clave(orgId), JSON.stringify({ mensajes: c.mensajes.slice(-MAXIMO_DE_MENSAJES), reportes, activa }));
  } catch {
    // Sin espacio o sin permiso: la conversación sigue, solo que no sobrevive a un cambio de pantalla
  }
}

export function borrarConversacion(orgId: string): void {
  try {
    globalThis.sessionStorage?.removeItem(clave(orgId));
  } catch {
    // nada que borrar
  }
}

/** Para la mesa: quita los reportes que sobran, empezando por los más viejos. */
export const recortarReportes = (reportes: Reporte[]) => reportes.slice(-MAXIMO_DE_REPORTES);
