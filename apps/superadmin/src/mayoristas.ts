/**
 * CU-01 en el Superadmin: Abasto revisa a los mayoristas que se registraron desde el Panel.
 * Verificar hace que sus productos salgan en la app; rechazar le muestra el motivo en su Panel.
 * Los datos y las reglas son de Catálogo; aquí solo cómo se muestran.
 */
export type EstadoVerificacion = 'PENDIENTE' | 'VERIFICADO' | 'RECHAZADO';

export interface Solicitud {
  id: string;
  nombre: string;
  nit: string | null;
  ciudad: string;
  representante: string | null;
  telefono: string | null;
  correo: string | null;
  estadoVerificacion: EstadoVerificacion;
  motivoRechazo: string | null;
  registradaEn: string | null;
}

const CAMPOS = 'id nombre nit ciudad representante telefono correo estadoVerificacion motivoRechazo registradaEn';

export const POR_VERIFICAR = `query Mayoristas($estado: String) { mayoristasPorVerificar(estado: $estado) { ${CAMPOS} } }`;
export const VERIFICAR = `mutation Verificar($id: ID!) { verificarMayorista(id: $id) { ${CAMPOS} } }`;
export const RECHAZAR = `mutation Rechazar($id: ID!, $motivo: String!) { rechazarMayorista(id: $id, motivo: $motivo) { ${CAMPOS} } }`;

export const PESTANAS: { estado: EstadoVerificacion; titulo: string }[] = [
  { estado: 'PENDIENTE', titulo: 'Por verificar' },
  { estado: 'VERIFICADO', titulo: 'Verificados' },
  { estado: 'RECHAZADO', titulo: 'Rechazados' },
];

/** Motivos frecuentes para no escribirlos cada vez; siempre se puede escribir otro. */
export const MOTIVOS = [
  'El NIT no corresponde a la empresa',
  'No pudimos comunicarnos con el representante',
  'La empresa no vende al por mayor',
  'Faltan datos de la empresa',
];

export function insignia(estado: EstadoVerificacion): { texto: string; clase: string } {
  if (estado === 'VERIFICADO') return { texto: 'Verificado', clase: 'exito' };
  if (estado === 'RECHAZADO') return { texto: 'Rechazado', clase: 'error' };
  return { texto: 'Por verificar', clase: 'advertencia' };
}

/** «31/10/2026» o «hace 3 h» si fue hoy. Null en los de la semilla. */
export function cuando(iso: string | null, ahora = new Date()): string {
  if (!iso) return 'De la semilla';
  const fecha = new Date(iso);
  const horas = Math.floor((ahora.getTime() - fecha.getTime()) / 3_600_000);
  if (horas < 1) return 'Hace un momento';
  if (horas < 24) return `Hace ${horas} h`;
  const d = String(fecha.getDate()).padStart(2, '0');
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${fecha.getFullYear()}`;
}

/** El motivo que se manda: el escrito, sin espacios de más. Null si no alcanza (Catálogo exige algo que leer). */
export function motivoValido(texto: string): string | null {
  const limpio = texto.trim().replace(/\s+/g, ' ');
  return limpio.length >= 5 ? limpio : null;
}

/** Enlace de WhatsApp para llamar o escribirle al representante antes de decidir. */
export function whatsapp(telefono: string | null): string | null {
  const solo = (telefono ?? '').replace(/\D/g, '');
  if (solo.length < 7) return null;
  return `https://wa.me/${solo.length === 8 ? `591${solo}` : solo}`;
}
