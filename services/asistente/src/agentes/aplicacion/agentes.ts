import { randomUUID } from 'node:crypto';
import type { ConsultarReportes } from '../../reportes/aplicacion/consultar-reportes.js';
import {
  cantidadAPedir,
  demandaDeLaSemana,
  enRiesgo,
  type PrediccionDeDemanda,
  type StockDeProducto,
} from '../../reportes/dominio/demanda.js';
import type { Solicitante } from '../../reportes/puertos.js';
import { decidir, type IdDeAgente, type Propuesta } from '../dominio/agente.js';
import type { EjecutorDeAcciones, RepositorioDePropuestas } from '../puertos.js';

const bs = (centavos: number) =>
  `Bs ${new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2 }).format(centavos / 100)}`;

/** Lo que una misión encuentra. `clave` identifica el asunto: no se propone dos veces lo mismo mientras espera. */
export type Hallazgo = Pick<Propuesta, 'titulo' | 'detalle' | 'accion'> & { clave: string };

/**
 * La misión de un agente: mira los reportes con sus habilidades de lectura y devuelve lo que propone.
 * No recibe un ejecutor: proponer es lo único que puede hacer sola.
 */
export interface Mision {
  readonly agenteId: IdDeAgente;
  buscar(solicitante: Solicitante): Promise<Hallazgo[]>;
}

/** Cobranza: lo que vence mañana → un recordatorio por cuenta. Mandar el WhatsApp requiere aprobación. */
export class MisionCobranza implements Mision {
  readonly agenteId = 'cobranza';

  constructor(private readonly reportes: ConsultarReportes) {}

  async buscar(solicitante: Solicitante): Promise<Hallazgo[]> {
    const { filas } = await this.reportes.ejecutar(
      `SELECT pedido_id, tienda_id, tienda_nombre, saldo_centavos, vence
         FROM cuentas_por_cobrar
        WHERE vence = current_date + 1 AND estado = 'pendiente'
        ORDER BY saldo_centavos DESC`,
      solicitante,
      'agente',
    );
    return filas.map((f) => ({
      clave: `cobranza:${String(f.pedido_id)}`,
      titulo: `Recordar a ${String(f.tienda_nombre)} que vence ${String(f.pedido_id)}`,
      detalle: `Saldo ${bs(Number(f.saldo_centavos))}, vence mañana.`,
      accion: {
        tipo: 'enviar_recordatorio_whatsapp',
        datos: {
          tiendaId: f.tienda_id,
          pedidoId: f.pedido_id,
          mensaje: `Hola, ${String(f.tienda_nombre)}. Te recordamos que mañana vence el pedido ${String(f.pedido_id)} por ${bs(Number(f.saldo_centavos))}.`,
        },
      },
    }));
  }
}

/** Reposición: con la demanda que predijo el ML, lo que no alcanza para 7 días → pedido al proveedor para 2 semanas. */
export class MisionReposicion implements Mision {
  readonly agenteId = 'reposicion';

  constructor(private readonly reportes: ConsultarReportes) {}

  async buscar(solicitante: Solicitante): Promise<Hallazgo[]> {
    const [stock, predicciones] = await Promise.all([
      this.reportes.ejecutar('SELECT producto_id, nombre, stock, vendidas_por_dia FROM stock_productos', solicitante, 'agente'),
      this.reportes.ejecutar(
        'SELECT producto_id, semana, unidades FROM prediccion_demanda WHERE semana >= current_date - 6 ORDER BY semana',
        solicitante,
        'agente',
      ),
    ]);
    return demandaDeLaSemana(
      stock.filas as unknown as StockDeProducto[],
      predicciones.filas as unknown as PrediccionDeDemanda[],
    )
      .filter((d) => enRiesgo(d) && cantidadAPedir(d) > 0)
      .map((d) => ({
        clave: `reposicion:${d.producto_id}`,
        titulo: `Pedir ${cantidadAPedir(d)} u. de ${d.nombre}`,
        detalle:
          d.stock === 0
            ? `Ya no tienes stock y se espera vender ${d.unidades_semana} u. esta semana.`
            : `Te quedan ${d.stock} u., alcanzan para ${d.dias_de_stock} días. Se espera vender ${d.unidades_semana} u. esta semana.`,
        accion: {
          tipo: 'crear_pedido_a_proveedor',
          datos: { productoId: d.producto_id, nombre: d.nombre, cantidad: cantidadAPedir(d) },
        },
      }));
  }
}

/** Catálogo: un producto sin stock que sigue publicado → pausarlo para que las tiendas no lo pidan. */
export class MisionCatalogo implements Mision {
  readonly agenteId = 'catalogo';

  constructor(private readonly reportes: ConsultarReportes) {}

  async buscar(solicitante: Solicitante): Promise<Hallazgo[]> {
    const { filas } = await this.reportes.ejecutar(
      'SELECT producto_id, nombre, vendidas_por_dia FROM stock_productos WHERE stock = 0 ORDER BY vendidas_por_dia DESC, nombre',
      solicitante,
      'agente',
    );
    return filas.map((f) => ({
      clave: `catalogo:pausar:${String(f.producto_id)}`,
      titulo: `Pausar ${String(f.nombre)}`,
      detalle:
        Number(f.vendidas_por_dia) > 0
          ? `Está sin stock y las tiendas lo piden (${Number(f.vendidas_por_dia)} u. por día). Pausado, nadie hace un pedido que no puedes cumplir.`
          : 'Está sin stock. Pausado, nadie hace un pedido que no puedes cumplir.',
      accion: { tipo: 'pausar_producto', datos: { productoId: f.producto_id, nombre: f.nombre } },
    }));
  }
}

/** Corre una misión y guarda como pendiente lo nuevo. Lo que ya espera una decisión no se repite. */
export class EjecutarMision {
  constructor(
    private readonly propuestas: RepositorioDePropuestas,
    private readonly reloj: () => Date = () => new Date(),
  ) {}

  async ejecutar(mision: Mision, solicitante: Solicitante): Promise<Propuesta[]> {
    const [hallazgos, pendientes] = await Promise.all([
      mision.buscar(solicitante),
      this.propuestas.pendientes(solicitante.orgId),
    ]);
    const yaEsperan = new Set(pendientes.map((p) => p.clave));

    const nuevas: Propuesta[] = [];
    for (const h of hallazgos) {
      if (yaEsperan.has(h.clave)) continue;
      yaEsperan.add(h.clave);
      nuevas.push({
        id: randomUUID(),
        orgId: solicitante.orgId,
        agenteId: mision.agenteId,
        ...h,
        estado: 'pendiente',
        creadaEn: this.reloj().toISOString(),
      });
    }
    for (const propuesta of nuevas) await this.propuestas.guardar(propuesta);
    return nuevas;
  }
}

/**
 * «Monitorear mi negocio»: corre todas las misiones y resume cuántas propuestas nuevas dejó cada agente.
 * Si una misión falla, las demás siguen y el resumen dice cuál falló.
 */
export class MonitorearNegocio {
  constructor(
    private readonly misiones: Mision[],
    private readonly ejecutar: EjecutarMision,
  ) {}

  async monitorear(solicitante: Solicitante) {
    const resultados = await Promise.all(
      this.misiones.map(async (m) => {
        try {
          const nuevas = await this.ejecutar.ejecutar(m, solicitante);
          return { agenteId: m.agenteId, nuevas: nuevas.length };
        } catch (e) {
          return { agenteId: m.agenteId, nuevas: 0, error: (e as Error).message };
        }
      }),
    );
    return { total: resultados.reduce((suma, r) => suma + r.nuevas, 0), agentes: resultados };
  }
}

/** Aprobar o rechazar una propuesta. Solo una aprobada llega al ejecutor. */
export class DecidirPropuesta {
  constructor(
    private readonly propuestas: RepositorioDePropuestas,
    private readonly ejecutor: EjecutorDeAcciones,
    private readonly reloj: () => Date = () => new Date(),
  ) {}

  async ejecutar(orgId: string, id: string, aprobar: boolean, usuarioId: string) {
    const propuesta = await this.propuestas.buscar(orgId, id);
    if (!propuesta) throw new Error(`No existe la propuesta ${id}`);
    const decidida = decidir(propuesta, aprobar, usuarioId, this.reloj());
    await this.propuestas.guardar(decidida);
    const ejecucion = aprobar ? await this.ejecutor.ejecutar(decidida) : undefined;
    return { propuesta: decidida, ejecucion };
  }
}
