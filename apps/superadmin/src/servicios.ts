import { crearSesion } from '@abasto/sesion';

export const sesion = crearSesion({ clientId: 'abasto-superadmin' });

export const URLS = {
  router: import.meta.env.VITE_ROUTER_URL ?? 'http://localhost:4000/',
  asistente: import.meta.env.VITE_ASISTENTE_URL ?? 'http://localhost:8085',
  conecta: import.meta.env.VITE_CONECTA_URL ?? 'http://localhost:8084',
};

/** Los servicios que vigila la pantalla Sistema. Cada uno responde GET /salud sin sesión. */
// En producción cada servicio vive en su nube: VITE_SALUD_<SERVICIO> trae su dirección pública
const env = import.meta.env;
export const SERVICIOS = [
  { id: 'pedidos', nombre: 'Pedidos', tecnologia: 'Spring Boot', url: `${env.VITE_SALUD_PEDIDOS ?? 'http://localhost:8081'}/salud` },
  { id: 'catalogo', nombre: 'Catálogo', tecnologia: 'Laravel', url: `${env.VITE_SALUD_CATALOGO ?? 'http://localhost:8082'}/salud` },
  { id: 'cobros', nombre: 'Cobros', tecnologia: 'NestJS', url: `${env.VITE_SALUD_COBROS ?? 'http://localhost:8083'}/salud` },
  { id: 'conecta', nombre: 'Conecta', tecnologia: 'NestJS', url: `${env.VITE_SALUD_CONECTA ?? 'http://localhost:8084'}/salud` },
  { id: 'asistente', nombre: 'Asistente', tecnologia: 'NestJS', url: `${env.VITE_SALUD_ASISTENTE ?? 'http://localhost:8085'}/salud` },
] as const;

/** Una consulta al Apollo Router con la sesión. Falla si GraphQL devuelve errores sin datos. */
export async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(URLS.router, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${await sesion.token()}` },
    body: JSON.stringify({ query, variables }),
  });
  const cuerpo = (await r.json()) as { data?: T; errors?: { message: string }[] };
  if (!cuerpo.data) throw new Error(cuerpo.errors?.[0]?.message ?? `El Router respondió ${r.status}`);
  return cuerpo.data;
}

/** Un POST con la sesión. Si el servicio responde un motivo, ese es el error que se muestra. */
export async function enviarConToken<T>(url: string): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${await sesion.token()}` } });
  const cuerpo = (await r.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!r.ok) throw new Error(cuerpo?.message ?? `${url} respondió ${r.status}`);
  return cuerpo as T;
}

export async function conToken<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { authorization: `Bearer ${await sesion.token()}` } });
  if (!r.ok) throw new Error(`${url} respondió ${r.status}`);
  return r.json() as Promise<T>;
}
