import { crearSesion } from '@abasto/sesion';

export const sesion = crearSesion({ clientId: 'abasto-superadmin' });

export const URLS = {
  router: import.meta.env.VITE_ROUTER_URL ?? 'http://localhost:4000/',
  asistente: import.meta.env.VITE_ASISTENTE_URL ?? 'http://localhost:8085',
};

/** Los servicios que vigila la pantalla Sistema. Cada uno responde GET /salud sin sesión. */
export const SERVICIOS = [
  { id: 'pedidos', nombre: 'Pedidos', tecnologia: 'Spring Boot', url: 'http://localhost:8081/salud' },
  { id: 'catalogo', nombre: 'Catálogo', tecnologia: 'Laravel', url: 'http://localhost:8082/salud' },
  { id: 'cobros', nombre: 'Cobros', tecnologia: 'NestJS', url: 'http://localhost:8083/salud' },
  { id: 'conecta', nombre: 'Conecta', tecnologia: 'NestJS', url: 'http://localhost:8084/salud' },
  { id: 'asistente', nombre: 'Asistente', tecnologia: 'NestJS', url: 'http://localhost:8085/salud' },
] as const;

export async function conToken<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { authorization: `Bearer ${await sesion.token()}` } });
  if (!r.ok) throw new Error(`${url} respondió ${r.status}`);
  return r.json() as Promise<T>;
}
