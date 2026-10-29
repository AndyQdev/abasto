/**
 * Reglas del Panel sin señal, sin depender del service worker para poder probarlas:
 * - una consulta (query) se guarda al responder y, sin red, se contesta con lo guardado;
 * - una mutación sin red no se pierde: queda en la bandeja y sale con su Idempotency-Key al volver la señal.
 */
export interface CuerpoGraphQL {
  query?: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

/** Sale a la red pero sin señal no tarda más que esto: después contesta lo guardado. */
export const ESPERA_DE_RED_MS = 5000;

export const CODIGO_EN_COLA = 'EN_COLA';

export function esMutacion(cuerpo: CuerpoGraphQL): boolean {
  // Saca comentarios para no confundir «# mutation ...» con una mutación
  const texto = (cuerpo.query ?? '').replace(/#[^\n]*/g, '').trimStart();
  return /^mutation\b/.test(texto);
}

/** Empresa y usuario del token: lo guardado de una empresa nunca se le muestra a otra. */
export function duenoDelToken(authorization: string | null): string {
  try {
    const carga = JSON.parse(atob((authorization ?? '').replace(/^Bearer\s+/i, '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return `${carga.org_id ?? ''}:${carga.sub ?? ''}`;
  } catch {
    return 'anonimo';
  }
}

/** La caché solo guarda GET: cada consulta se guarda como un GET a una dirección propia, única por dueño y consulta. */
export async function claveDeConsulta(cuerpo: CuerpoGraphQL, authorization: string | null): Promise<string> {
  const texto = JSON.stringify([duenoDelToken(authorization), cuerpo.query ?? '', cuerpo.variables ?? {}]);
  const resumen = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  const hex = [...new Uint8Array(resumen)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `https://abasto.local/graphql/${hex}`;
}

const json = (cuerpo: unknown, cabeceras: Record<string, string> = {}) =>
  new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'content-type': 'application/json', ...cabeceras } });

/** Lo que recibe la pantalla cuando su cambio quedó en la bandeja: un error con un mensaje para la persona. */
export const respuestaEnCola = () =>
  json({
    data: null,
    errors: [
      {
        message: 'Sin conexión: tu cambio quedó guardado y se enviará solo cuando vuelva la señal',
        extensions: { code: CODIGO_EN_COLA },
      },
    ],
  });

export const respuestaSinDatos = () =>
  json({
    data: null,
    errors: [{ message: 'Sin conexión y todavía no hay datos guardados de esta pantalla', extensions: { code: 'SIN_CONEXION' } }],
  });

/** Cómo se manda al Router una mutación que estaba en la bandeja: con su clave, que nunca cambia entre reintentos. */
export function pedidoDeMutacion(routerUrl: string, cuerpo: CuerpoGraphQL, clave: string, token: string): [string, RequestInit] {
  return [
    routerUrl,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'idempotency-key': clave },
      body: JSON.stringify(cuerpo),
    },
  ];
}
