import { URLS } from './config';
import { tokenActual } from './sesion';

/** Una consulta al Apollo Router con la sesión. Todo dato de la app pasa por aquí (GraphQL federado). */
export async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = await tokenActual();
  const r = await fetch(URLS.router, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
  });
  const cuerpo = (await r.json()) as { data?: T; errors?: { message: string }[] };
  if (!cuerpo.data) throw new Error(cuerpo.errors?.[0]?.message ?? `El servidor respondió ${r.status}`);
  return cuerpo.data;
}
