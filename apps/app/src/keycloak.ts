/**
 * La sesión de la app vive en Keycloak, pero el cliente nunca ve una pantalla de Keycloak:
 * entra con su celular y un código (src/acceso.ts) y aquí solo se renueva y se cierra esa sesión.
 */
import { CLIENTE_KEYCLOAK, URLS } from './config';

export interface Tokens {
  acceso: string;
  refresco: string | null;
  venceEn: number;
}

/** La sesión ya no sirve (se cerró o pasó mucho tiempo sin usar la app): hay que volver a entrar. */
export class SesionVencida extends Error {}

type Enviar = typeof fetch;

export async function renovar(refresco: string, enviar: Enviar = fetch, ahora = Date.now()): Promise<Tokens> {
  const r = await enviar(`${URLS.keycloak}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENTE_KEYCLOAK, grant_type: 'refresh_token', refresh_token: refresco }).toString(),
  });
  const cuerpo = (await r.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (cuerpo.error === 'invalid_grant') throw new SesionVencida('La sesión venció. Vuelve a entrar con tu celular.');
  if (!r.ok || !cuerpo.access_token) throw new Error('No se pudo renovar la sesión');
  return { acceso: cuerpo.access_token, refresco: cuerpo.refresh_token ?? null, venceEn: ahora + (cuerpo.expires_in ?? 300) * 1000 };
}

/** Cierra la sesión también en Keycloak. Si no hay señal no importa: los tokens se borran igual del teléfono. */
export async function cerrarEnKeycloak(refresco: string, enviar: Enviar = fetch): Promise<void> {
  await enviar(`${URLS.keycloak}/protocol/openid-connect/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENTE_KEYCLOAK, refresh_token: refresco }).toString(),
  }).catch(() => undefined);
}
