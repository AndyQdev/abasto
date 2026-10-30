/**
 * Entrar a la app como en PedidosYa: celular → código de 6 dígitos → (la primera vez) nombre.
 * Lo resuelve Catálogo (pedirCodigo y entrarConCodigo, públicas en el Router). Nunca hay correo ni contraseña.
 */
import { URLS } from './config';
import type { Tokens } from './keycloak';

export interface EnvioDeCodigo {
  telefono: string;
  esNuevo: boolean;
  venceEnSegundos: number;
  /** Mientras no está WhatsApp, el código llega aquí y la app lo muestra */
  codigoDePrueba: string | null;
}

/** Un problema que se le muestra tal cual a quien usa la app; `codigo` dice cuál fue (NECESITA_NOMBRE, CODIGO_INCORRECTO…). */
export class ErrorDeAcceso extends Error {
  constructor(
    mensaje: string,
    public readonly codigo: string,
  ) {
    super(mensaje);
  }
}

type Enviar = typeof fetch;

async function llamar<T>(query: string, variables: Record<string, unknown>, enviar: Enviar): Promise<T> {
  let r: Response;
  try {
    r = await enviar(URLS.router, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  } catch {
    throw new ErrorDeAcceso('No hay conexión. Revisa tu señal y vuelve a intentar.', 'SIN_SENAL');
  }
  const cuerpo = (await r.json().catch(() => ({}))) as { data?: T; errors?: { message: string; extensions?: { code?: string } }[] };
  const error = cuerpo.errors?.[0];
  if (error || !cuerpo.data) {
    const codigo = error?.extensions?.code ?? 'ERROR';
    // Los errores de negocio vienen en español; uno interno, no
    const legible = codigo !== 'INTERNAL_SERVER_ERROR' && error?.message && error.message !== 'Internal server error';
    throw new ErrorDeAcceso(legible ? error.message : 'Algo falló de nuestro lado. Vuelve a intentar en un momento.', codigo);
  }
  return cuerpo.data;
}

/** Lo que el cliente escribe → los 8 dígitos (sin 591, espacios ni guiones). */
export function soloDigitos(telefono: string): string {
  const d = telefono.replace(/\D/g, '');
  return (d.length === 11 && d.startsWith('591') ? d.slice(3) : d).slice(0, 8);
}

export const esCelular = (telefono: string) => /^[67]\d{7}$/.test(soloDigitos(telefono));

/** «71234567» → «712 34 567», como se dicta un celular en Bolivia. */
export function formatoCelular(telefono: string): string {
  const d = soloDigitos(telefono);
  return [d.slice(0, 3), d.slice(3, 5), d.slice(5, 8)].filter(Boolean).join(' ');
}

export async function pedirCodigo(telefono: string, enviar: Enviar = fetch): Promise<EnvioDeCodigo> {
  const r = await llamar<{ pedirCodigo: EnvioDeCodigo }>(
    'mutation PedirCodigo($t: String!) { pedirCodigo(telefono: $t) { telefono esNuevo venceEnSegundos codigoDePrueba } }',
    { t: soloDigitos(telefono) },
    enviar,
  );
  return r.pedirCodigo;
}

export async function entrarConCodigo(
  telefono: string,
  codigo: string,
  nombre?: string,
  enviar: Enviar = fetch,
  ahora = Date.now(),
): Promise<{ tokens: Tokens; nombre: string; cuentaNueva: boolean }> {
  const r = await llamar<{ entrarConCodigo: { tokenDeAcceso: string; tokenDeRenovacion: string; venceEnSegundos: number; cuentaNueva: boolean; nombre: string } }>(
    'mutation Entrar($t: String!, $c: String!, $n: String) { entrarConCodigo(telefono: $t, codigo: $c, nombre: $n) { tokenDeAcceso tokenDeRenovacion venceEnSegundos cuentaNueva nombre } }',
    { t: soloDigitos(telefono), c: codigo, n: nombre?.trim() || null },
    enviar,
  );
  const s = r.entrarConCodigo;
  return {
    tokens: { acceso: s.tokenDeAcceso, refresco: s.tokenDeRenovacion, venceEn: ahora + s.venceEnSegundos * 1000 },
    nombre: s.nombre,
    cuentaNueva: s.cuentaNueva,
  };
}
