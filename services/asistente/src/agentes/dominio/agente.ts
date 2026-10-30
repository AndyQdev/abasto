/**
 * Un agente es configuración, no código: una misión, las habilidades (skills) que puede usar,
 * cuándo corre y qué acciones necesitan que una persona las apruebe.
 */
export interface DefinicionDeAgente {
  id: IdDeAgente;
  nombre: string;
  mision: string;
  habilidades: string[];
  /** Expresión cron, hora de Bolivia */
  horario: string;
  /** Acciones que el agente solo puede proponer; una persona decide. */
  requiereAprobacion: string[];
}

export type IdDeAgente = 'cobranza' | 'reposicion' | 'catalogo' | 'analista';

export const AGENTES: Record<IdDeAgente, DefinicionDeAgente> = {
  cobranza: {
    id: 'cobranza',
    nombre: 'Cobranza',
    mision: 'Que te paguen a tiempo',
    habilidades: ['buscar_cuentas_por_vencer', 'redactar_recordatorio', 'proponer_recordatorio'],
    horario: '0 8 * * *',
    requiereAprobacion: ['enviar_recordatorio_whatsapp'],
  },
  reposicion: {
    id: 'reposicion',
    nombre: 'Reposición',
    mision: 'Que nunca te quedes sin stock',
    habilidades: ['revisar_stock', 'estimar_demanda', 'proponer_pedido_a_proveedor'],
    horario: '0 7 * * *',
    requiereAprobacion: ['crear_pedido_a_proveedor'],
  },
  catalogo: {
    id: 'catalogo',
    nombre: 'Catálogo',
    mision: 'Que las tiendas no pidan lo que no tienes',
    habilidades: ['buscar_productos_sin_stock', 'proponer_pausa'],
    horario: '0 9 * * 1',
    requiereAprobacion: ['pausar_producto'],
  },
  analista: {
    id: 'analista',
    nombre: 'Analista',
    mision: 'Responder lo que preguntes de tu negocio',
    habilidades: ['consultar_reportes', 'exportar_excel'],
    horario: 'a pedido',
    requiereAprobacion: [],
  },
};

export type EstadoDePropuesta = 'pendiente' | 'aprobada' | 'rechazada';

/** Lo que un agente propone hacer. Nada se ejecuta hasta que una persona lo aprueba. */
export interface Propuesta {
  id: string;
  orgId: string;
  agenteId: IdDeAgente;
  titulo: string;
  detalle: string;
  accion: { tipo: string; datos: Record<string, unknown> };
  /** El asunto (por ejemplo «reposicion:AR-0100»): mientras espera una decisión no se vuelve a proponer */
  clave?: string;
  estado: EstadoDePropuesta;
  creadaEn: string;
  decididaPor?: string;
  decididaEn?: string;
}

export class PropuestaYaDecidida extends Error {
  constructor(id: string, estado: EstadoDePropuesta) {
    super(`La propuesta ${id} ya está ${estado}`);
  }
}

export function decidir(propuesta: Propuesta, aprobar: boolean, usuarioId: string, ahora: Date): Propuesta {
  if (propuesta.estado !== 'pendiente') throw new PropuestaYaDecidida(propuesta.id, propuesta.estado);
  return {
    ...propuesta,
    estado: aprobar ? 'aprobada' : 'rechazada',
    decididaPor: usuarioId,
    decididaEn: ahora.toISOString(),
  };
}
