/**
 * CU-10: la tienda conecta su e-commerce. Saca llaves y registra a dónde le avisamos. Lo resuelve Conecta;
 * se maneja siempre con la sesión de la persona, nunca con una llave.
 */
import { URLS } from './config';

export interface Llave {
  id: string;
  nombre: string;
  termina: string;
  creadaEn: string;
  ultimoUsoEn: string | null;
}

export interface Webhook {
  id: string;
  url: string;
  creadoEn: string;
}

export interface Entrega {
  id: string;
  webhookId: string;
  tipo: string;
  estado: 'pendiente' | 'entregada' | 'fallida';
  ultimoError: string | null;
  creadaEn: string;
}

type Enviar = typeof fetch;
type Token = () => Promise<string | null>;

/** Un problema que se le muestra tal cual a quien usa la app. */
export class ErrorDeConexion extends Error {}

async function llamar<T>(ruta: string, token: Token, opciones: { metodo?: string; cuerpo?: unknown } = {}, enviar: Enviar = fetch): Promise<T> {
  const sesion = await token();
  if (!sesion) throw new ErrorDeConexion('Tu sesión venció. Vuelve a entrar.');
  let r: Response;
  try {
    r = await enviar(`${URLS.conecta}${ruta}`, {
      method: opciones.metodo ?? 'GET',
      headers: { authorization: `Bearer ${sesion}`, 'content-type': 'application/json' },
      ...(opciones.cuerpo === undefined ? {} : { body: JSON.stringify(opciones.cuerpo) }),
    });
  } catch {
    throw new ErrorDeConexion('No hay conexión. Revisa tu señal y vuelve a intentar.');
  }
  if (r.status === 204) return undefined as T;
  const datos = (await r.json().catch(() => null)) as (T & { message?: unknown }) | null;
  if (!r.ok) {
    // Los errores de la integración vienen en español; otro código no se le muestra a la persona
    const legible = r.status < 500 && typeof datos?.message === 'string' ? datos.message : 'Algo falló de nuestro lado. Vuelve a intentar en un rato.';
    throw new ErrorDeConexion(legible);
  }
  return datos as T;
}

export const conectarTienda = (token: Token, enviar: Enviar = fetch) => ({
  llaves: () => llamar<Llave[]>('/v1/llaves', token, {}, enviar),
  crearLlave: (nombre: string) => llamar<{ llave: string; datos: Llave }>('/v1/llaves', token, { metodo: 'POST', cuerpo: { nombre } }, enviar),
  revocarLlave: (id: string) => llamar<void>(`/v1/llaves/${encodeURIComponent(id)}`, token, { metodo: 'DELETE' }, enviar),
  webhooks: () => llamar<Webhook[]>('/v1/webhooks', token, {}, enviar),
  crearWebhook: (url: string) => llamar<{ secreto: string; datos: Webhook }>('/v1/webhooks', token, { metodo: 'POST', cuerpo: { url } }, enviar),
  borrarWebhook: (id: string) => llamar<void>(`/v1/webhooks/${encodeURIComponent(id)}`, token, { metodo: 'DELETE' }, enviar),
  probarWebhook: (id: string) => llamar<Entrega>(`/v1/webhooks/${encodeURIComponent(id)}/probar`, token, { metodo: 'POST' }, enviar),
  entregas: () => llamar<Entrega[]>('/v1/entregas', token, {}, enviar),
  reenviar: (id: string) => llamar<Entrega>(`/v1/entregas/${encodeURIComponent(id)}/reenviar`, token, { metodo: 'POST' }, enviar),
});

export const direccionDeLaApi = () => URLS.conecta;
export const direccionDelMcp = () => `${URLS.conecta}/mcp`;

/** Lo que dice cada aviso, en palabras de la tienda. */
export function resultadoDeEntrega(e: Pick<Entrega, 'estado' | 'ultimoError'>): string {
  if (e.estado === 'entregada') return 'Llegó a tu tienda';
  if (e.estado === 'fallida') return e.ultimoError ? `No llegó: ${e.ultimoError}` : 'No llegó';
  return e.ultimoError ? `No llegó todavía (${e.ultimoError}). Lo volvemos a intentar solos` : 'Enviando…';
}

/** «hoy» o dd/mm/aaaa, para saber si la llave se está usando. */
export function ultimoUso(iso: string | null, ahora = new Date()): string {
  if (!iso) return 'Todavía no se usó';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return 'Todavía no se usó';
  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  const dia = `${dosDigitos(fecha.getDate())}/${dosDigitos(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;
  return fecha.toDateString() === ahora.toDateString() ? 'Se usó hoy' : `Se usó el ${dia}`;
}
