import { randomUUID } from 'node:crypto';
import type { ConsultarReportes } from '../../reportes/aplicacion/consultar-reportes.js';
import type { Solicitante } from '../../reportes/puertos.js';
import { decidir, type Propuesta } from '../dominio/agente.js';
import type { EjecutorDeAcciones, RepositorioDePropuestas } from '../puertos.js';

const bs = (centavos: number) =>
  `Bs ${new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2 }).format(centavos / 100)}`;

/**
 * Misión del agente de Cobranza: encontrar lo que vence mañana y proponer un recordatorio por cada cuenta.
 * Sus habilidades son consultar reportes (lectura) y proponer. Mandar el WhatsApp requiere aprobación.
 */
export class EjecutarCobranza {
  constructor(
    private readonly reportes: ConsultarReportes,
    private readonly propuestas: RepositorioDePropuestas,
    private readonly reloj: () => Date = () => new Date(),
  ) {}

  async ejecutar(solicitante: Solicitante): Promise<Propuesta[]> {
    const { filas } = await this.reportes.ejecutar(
      `SELECT pedido_id, tienda_id, tienda_nombre, saldo_centavos, vence
         FROM cuentas_por_cobrar
        WHERE vence = current_date + 1 AND estado = 'pendiente'
        ORDER BY saldo_centavos DESC`,
      solicitante,
      'agente',
    );

    const nuevas: Propuesta[] = filas.map((f) => ({
      id: randomUUID(),
      orgId: solicitante.orgId,
      agenteId: 'cobranza',
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
      estado: 'pendiente',
      creadaEn: this.reloj().toISOString(),
    }));

    for (const propuesta of nuevas) await this.propuestas.guardar(propuesta);
    return nuevas;
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
