/**
 * Inicio de sesión nativo: la app manda el correo y la contraseña directo a Keycloak (password grant)
 * y recibe los tokens. No se abre ningún navegador. Es la misma cuenta que se usa en el Panel y el Superadmin.
 */
import { CLIENTE_KEYCLOAK, URLS } from './config';

export interface Tokens {
  acceso: string;
  refresco: string | null;
  venceEn: number;
}

/** Un error que se le puede mostrar tal cual a quien usa la app. */
export class ErrorDeSesion extends Error {}

type Enviar = typeof fetch;

const PUNTO_TOKEN = () => `${URLS.keycloak}/protocol/openid-connect/token`;

async function pedirTokens(datos: Record<string, string>, enviar: Enviar, ahora: number): Promise<Tokens> {
  let r: Response;
  try {
    r = await enviar(PUNTO_TOKEN(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENTE_KEYCLOAK, ...datos }).toString(),
    });
  } catch {
    throw new ErrorDeSesion('No hay conexión con Abasto. Revisa tu señal y vuelve a intentar.');
  }
  const cuerpo = (await r.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!r.ok || !cuerpo.access_token) {
    if (cuerpo.error === 'invalid_grant' && /disabled/i.test(cuerpo.error_description ?? '')) {
      throw new ErrorDeSesion('Tu cuenta está deshabilitada. Escríbenos para revisarla.');
    }
    if (cuerpo.error === 'invalid_grant') throw new ErrorDeSesion('El correo o la contraseña no son correctos.');
    throw new ErrorDeSesion('No se pudo entrar. Vuelve a intentar en un momento.');
  }
  return {
    acceso: cuerpo.access_token,
    refresco: cuerpo.refresh_token ?? null,
    venceEn: ahora + (cuerpo.expires_in ?? 300) * 1000,
  };
}

export function entrarConClave(correo: string, clave: string, enviar: Enviar = fetch, ahora = Date.now()): Promise<Tokens> {
  const usuario = correo.trim().toLowerCase();
  if (!usuario || !clave) return Promise.reject(new ErrorDeSesion('Escribe tu correo y tu contraseña.'));
  return pedirTokens({ grant_type: 'password', username: usuario, password: clave, scope: 'openid profile email' }, enviar, ahora);
}

export function renovar(refresco: string, enviar: Enviar = fetch, ahora = Date.now()): Promise<Tokens> {
  return pedirTokens({ grant_type: 'refresh_token', refresh_token: refresco }, enviar, ahora);
}

/** Cierra la sesión también en Keycloak. Si no hay señal no importa: los tokens se borran igual del teléfono. */
export async function cerrarEnKeycloak(refresco: string, enviar: Enviar = fetch): Promise<void> {
  await enviar(`${URLS.keycloak}/protocol/openid-connect/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENTE_KEYCLOAK, refresh_token: refresco }).toString(),
  }).catch(() => undefined);
}
