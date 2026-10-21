import { AlmacenIndexedDB, Bandeja, enviarAConecta } from '@abasto/outbox-offline';
import { crearSesion } from '@abasto/sesion';

export const URLS = {
  router: import.meta.env.VITE_ROUTER_URL ?? 'http://localhost:4000/',
  conecta: import.meta.env.VITE_CONECTA_URL ?? 'http://localhost:8084',
};

export const sesion = crearSesion({ clientId: 'abasto-mercado' });

/** Todo pedido sale por la bandeja: con señal se manda enseguida, sin señal espera con su clave. */
export const bandeja = new Bandeja(new AlmacenIndexedDB(), enviarAConecta(URLS.conecta, () => sesion.token()));

export async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(URLS.router, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${await sesion.token()}` },
    body: JSON.stringify({ query, variables }),
  });
  const cuerpo = (await r.json()) as { data?: T; errors?: { message: string }[] };
  if (!cuerpo.data) throw new Error(cuerpo.errors?.[0]?.message ?? `El servidor respondió ${r.status}`);
  return cuerpo.data;
}

/** Lo último que se vio del catálogo, para mostrarlo sin señal («usas tus datos guardados»). */
export const guardado = {
  leer<T>(clave: string): T | null {
    try {
      const v = localStorage.getItem(`abasto:${clave}`);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  escribir(clave: string, valor: unknown) {
    try {
      localStorage.setItem(`abasto:${clave}`, JSON.stringify(valor));
    } catch {
      /* sin espacio o en modo privado: se sigue sin guardar */
    }
  },
};
