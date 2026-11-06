/**
 * Superadmin › Integraciones (CU-10): las tiendas conectadas con su e-commerce y los avisos que no llegaron.
 * Los datos son de Conecta; los secretos nunca salen de ahí.
 */
export interface LlaveDeTienda {
  id: string;
  orgId: string;
  nombre: string;
  termina: string;
  creadaEn: string;
  ultimoUsoEn: string | null;
}

export interface WebhookDeTienda {
  id: string;
  orgId: string;
  url: string;
  creadoEn: string;
}

export interface EntregaDeAviso {
  id: string;
  orgId: string;
  url: string;
  tipo: string;
  estado: 'pendiente' | 'entregada' | 'fallida';
  intentos: number;
  proximoEn: string | null;
  ultimoError: string | null;
  creadaEn: string;
}

export interface Integraciones {
  llaves: LlaveDeTienda[];
  webhooks: WebhookDeTienda[];
  entregas: EntregaDeAviso[];
}

/** Lo que necesita atención: lo que no llegó, con lo que ya se dio por perdido primero. */
export function conProblemas(entregas: EntregaDeAviso[]): EntregaDeAviso[] {
  const problema = entregas.filter((e) => e.estado === 'fallida' || (e.estado === 'pendiente' && e.intentos > 0));
  return problema.sort((a, b) => Number(b.estado === 'fallida') - Number(a.estado === 'fallida') || b.creadaEn.localeCompare(a.creadaEn));
}

export function textoDeEntrega(e: EntregaDeAviso): { texto: string; clase: string } {
  if (e.estado === 'entregada') return { texto: 'Llegó', clase: 'exito' };
  if (e.estado === 'fallida') return { texto: 'No llegó', clase: 'error' };
  return { texto: 'Reintentando', clase: 'advertencia' };
}

/** Cuánto de lo enviado llegó, para ver de un vistazo si algo anda mal. Null si todavía no se envió nada. */
export function tasaDeEntrega(entregas: EntregaDeAviso[]): string | null {
  if (!entregas.length) return null;
  return `${Math.round((entregas.filter((e) => e.estado === 'entregada').length / entregas.length) * 100)} %`;
}
