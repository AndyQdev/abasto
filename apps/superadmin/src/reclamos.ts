/**
 * Superadmin › Reclamos (CU-16): la tienda reporta un problema con un pedido y Abasto lo resuelve a mano.
 * Resolver solo lo anota: el dinero se devuelve afuera del sistema, y no se toca el cobro, el crédito ni la cuenta.
 */
export type EstadoDeReclamo = 'ABIERTO' | 'APROBADO' | 'RECHAZADO';
export type FormaDeDevolucion = 'EFECTIVO' | 'TRANSFERENCIA' | 'QR' | 'OTRA';

export interface ReclamoFila {
  id: string;
  motivo: string;
  detalle: string | null;
  estado: EstadoDeReclamo;
  respuesta: string | null;
  devuelto: { centavos: number; texto: string } | null;
  forma: FormaDeDevolucion | null;
  creadoEn: string;
  resueltoEn: string | null;
  pedido: {
    id: string;
    codigo: string;
    estado: string;
    metodoPago: string;
    total: { centavos: number; texto: string };
    tienda: { id: string; nombre?: string | null };
    mayorista: { id: string; nombre?: string | null };
  };
}

const CAMPOS = `id motivo detalle estado respuesta devuelto { centavos texto } forma creadoEn resueltoEn
  pedido { id codigo estado metodoPago total { centavos texto } tienda { id nombre } mayorista { id nombre } }`;

export const RECLAMOS = `query Reclamos($estado: EstadoDeReclamo) { reclamos(estado: $estado) { ${CAMPOS} } }`;
export const RESOLVER = `mutation Resolver($entrada: ResolverReclamoEntrada!) { resolverReclamo(entrada: $entrada) { ${CAMPOS} } }`;
export const CELULARES = `query Celulares { tiendas { id telefono } }`;

export const PESTANAS: { estado: EstadoDeReclamo; titulo: string }[] = [
  { estado: 'ABIERTO', titulo: 'Por resolver' },
  { estado: 'APROBADO', titulo: 'Aprobados' },
  { estado: 'RECHAZADO', titulo: 'Rechazados' },
];

export const FORMAS: { valor: FormaDeDevolucion; texto: string }[] = [
  { valor: 'TRANSFERENCIA', texto: 'Transferencia' },
  { valor: 'EFECTIVO', texto: 'Efectivo' },
  { valor: 'QR', texto: 'QR' },
  { valor: 'OTRA', texto: 'Otra' },
];

const MOTIVOS: Record<string, string> = {
  INCOMPLETO: 'Llegó incompleto',
  DANADO: 'Llegó dañado',
  NO_LLEGO: 'No llegó',
  COBRO_EQUIVOCADO: 'Le cobraron mal',
  OTRO: 'Otro problema',
};

const ESTADOS_DE_PEDIDO: Record<string, string> = {
  POR_CONFIRMAR: 'Por confirmar',
  CONFIRMADO: 'Confirmado',
  EN_PREPARACION: 'En preparación',
  DESPACHADO: 'En camino',
  ENTREGADO: 'Entregado',
  RECHAZADO: 'Rechazado',
  CANCELADO: 'Cancelado',
};

const PAGOS: Record<string, string> = { QR: 'QR', CREDITO: 'A crédito', CONTRA_ENTREGA: 'Contra entrega' };

export const textoDeMotivo = (motivo: string) => MOTIVOS[motivo] ?? motivo;
export const textoDeEstadoDePedido = (estado: string) => ESTADOS_DE_PEDIDO[estado] ?? estado;
export const textoDePago = (metodo: string) => PAGOS[metodo] ?? metodo;

export function insigniaDeReclamo(estado: EstadoDeReclamo): { texto: string; clase: string } {
  if (estado === 'APROBADO') return { texto: 'Aprobado', clase: 'exito' };
  if (estado === 'RECHAZADO') return { texto: 'Rechazado', clase: 'error' };
  return { texto: 'Por resolver', clase: 'advertencia' };
}

/** «1.200,50», «1200.5» o «Bs 50» → centavos. Null si no se entiende; vacío es cero (aprobar sin devolver dinero). */
export function centavosDe(texto: string): number | null {
  let limpio = texto.trim().replace(/^bs\.?\s*/i, '').replace(/\s/g, '');
  if (!limpio) return 0;
  if (limpio.includes(',')) limpio = limpio.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) limpio = limpio.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  return Math.round(Number(limpio) * 100);
}

export interface Decision {
  monto: string;
  forma: FormaDeDevolucion | '';
  respuesta: string;
}

/** Lo que falta para poder anotar la decisión, en palabras; null si está lista. */
export function faltaParaResolver(aprobar: boolean, d: Decision, totalCentavos: number): string | null {
  if (d.respuesta.trim().length < 3) return 'Escribe qué le respondes a la tienda';
  if (!aprobar) return null;
  const centavos = centavosDe(d.monto);
  if (centavos === null) return 'El monto no se entiende. Escribe, por ejemplo, 50,00';
  if (centavos > totalCentavos) return 'No se puede devolver más que el total del pedido';
  if (centavos > 0 && !d.forma) return 'Elige cómo le devolviste el dinero';
  return null;
}

/** «Devolviste Bs 50,00 por transferencia» o «Sin devolver dinero». */
export function textoDeDevolucion(r: Pick<ReclamoFila, 'devuelto' | 'forma'>): string {
  if (!r.devuelto?.centavos) return 'Sin devolver dinero';
  const forma = FORMAS.find((f) => f.valor === r.forma)?.texto.toLowerCase();
  return forma && r.forma !== 'OTRA' ? `Devolviste ${r.devuelto.texto} por ${forma}` : `Devolviste ${r.devuelto.texto}`;
}
