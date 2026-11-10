/**
 * Superadmin › Promociones (10/11): Abasto escribe una promoción y le llega como notificación push a todos los que
 * tienen la app. La manda Conecta por Firebase; aquí se arma, se revisa cómo se verá y se ve a cuántos llegó.
 * Abajo, las últimas notificaciones que salieron (también las de los pedidos), para ver que todo anda.
 */
import { sesion, URLS } from './servicios';

export const LARGO_DEL_TITULO = 60;
export const LARGO_DEL_MENSAJE = 180;

export interface Promocion {
  id: string;
  titulo: string;
  mensaje: string;
  productoId: string | null;
  creadaPor: string;
  creadaEn: string;
  destinatarios: number;
  enviadas: number;
  fallidas: number;
}

export interface EnvioReciente {
  cuando: string;
  orgId: string;
  titulo: string;
  cuerpo: string;
  canal: 'pedidos' | 'promociones';
  datos: Record<string, string>;
  resultado: 'enviada' | 'token-invalido' | 'fallida';
}

export interface ResumenDeNotificaciones {
  /** «firebase»: salen a los teléfonos. «prueba»: Conecta no tiene la cuenta de Firebase; se anotan y no salen */
  modo: 'firebase' | 'prueba';
  telefonos: number;
  empresas: number;
  recientes: EnvioReciente[];
}

export interface Borrador {
  titulo: string;
  mensaje: string;
  productoId: string;
}

export const BORRADOR_VACIO: Borrador = { titulo: '', mensaje: '', productoId: '' };

/** Lo que falta para poder mandarla, o null si está lista. Las mismas reglas que valida Conecta. */
export function faltaParaEnviar(b: Borrador, telefonos: number): string | null {
  if (b.titulo.trim().length < 3) return 'Escribe un título';
  if (b.titulo.trim().length > LARGO_DEL_TITULO) return `El título va hasta ${LARGO_DEL_TITULO} letras`;
  if (b.mensaje.trim().length < 3) return 'Escribe el mensaje';
  if (b.mensaje.trim().length > LARGO_DEL_MENSAJE) return `El mensaje va hasta ${LARGO_DEL_MENSAJE} letras`;
  if (telefonos === 0) return 'Todavía nadie tiene la app con las notificaciones activadas';
  return null;
}

/** «Llegó a 41 de 42 teléfonos» */
export function textoDeResultado(p: Pick<Promocion, 'destinatarios' | 'enviadas'>): string {
  if (p.destinatarios === 0) return 'No había teléfonos con la app';
  if (p.enviadas === p.destinatarios) return p.enviadas === 1 ? 'Llegó al único teléfono' : `Llegó a los ${p.enviadas} teléfonos`;
  return `Llegó a ${p.enviadas} de ${p.destinatarios} teléfonos`;
}

export function textoDeEnvio(e: EnvioReciente): string {
  if (e.resultado === 'enviada') return 'Enviada';
  if (e.resultado === 'token-invalido') return 'Ya no tiene la app';
  return 'No salió';
}

export const etiquetaDeCanal = (canal: EnvioReciente['canal']) => (canal === 'pedidos' ? 'Pedido' : 'Promoción');

export async function cargarResumen(): Promise<ResumenDeNotificaciones> {
  return pedirAConecta<ResumenDeNotificaciones>('/v1/admin/notificaciones');
}

export async function cargarPromociones(): Promise<Promocion[]> {
  return pedirAConecta<Promocion[]>('/v1/admin/promociones');
}

/**
 * Manda la promoción. `clave` es un UUID por borrador: si se repite (doble clic, se cortó la red y se reintenta),
 * Conecta responde la misma promoción y no vuelve a sonar en los teléfonos.
 */
export async function enviarPromocion(b: Borrador, clave: string): Promise<Promocion> {
  return pedirAConecta<Promocion>('/v1/admin/promociones', {
    method: 'POST',
    headers: { 'idempotency-key': clave, 'content-type': 'application/json' },
    body: JSON.stringify({ titulo: b.titulo.trim(), mensaje: b.mensaje.trim(), productoId: b.productoId || null }),
  });
}

async function pedirAConecta<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const r = await fetch(`${URLS.conecta}${ruta}`, {
    ...opciones,
    headers: { ...(opciones.headers as Record<string, string>), authorization: `Bearer ${await sesion.token()}` },
  });
  const cuerpo = (await r.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!r.ok) throw new Error(cuerpo?.message ?? `Conecta respondió ${r.status}`);
  return cuerpo as T;
}

/** Los productos de Abasto para elegir de qué es la promoción (tocarla abre su ficha en la app). */
export const PRODUCTOS_DE_ABASTO = `query { misProductos { id nombre foto } }`;
