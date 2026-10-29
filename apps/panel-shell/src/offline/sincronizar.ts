import type { Enviar, OperacionLocal, ResultadoRemoto } from '@abasto/outbox-offline';
import { pedidoDeMutacion, type CuerpoGraphQL } from './graphql';

/**
 * Manda al Router los cambios que el mayorista hizo sin señal, uno por uno y en orden, con el token de ahora.
 * Cada uno lleva su Idempotency-Key: si la red se corta en medio, el reintento no registra dos veces lo mismo.
 * Un error de red corta el envío: lo que ya salió queda aplicado y el resto sigue pendiente.
 * Un error GraphQL rechaza solo ese cambio.
 */
export function enviarAlRouter(routerUrl: string, token: () => Promise<string>, pedir: typeof fetch = fetch): Enviar {
  return async (operaciones: OperacionLocal[]) => {
    const resultados: ResultadoRemoto[] = [];
    for (const op of operaciones) {
      let respuesta: Response;
      try {
        respuesta = await pedir(...pedidoDeMutacion(routerUrl, op.datos as CuerpoGraphQL, op.clave, await token()));
      } catch {
        break;
      }
      const cuerpo = (await respuesta.json().catch(() => ({}))) as { data?: unknown; errors?: { message: string }[] };
      if (respuesta.ok && !cuerpo.errors?.length) {
        resultados.push({ clave: op.clave, estado: 'aplicada', respuesta: cuerpo.data });
      } else {
        resultados.push({ clave: op.clave, estado: 'rechazada', error: cuerpo.errors?.[0]?.message ?? `El Router respondió ${respuesta.status}` });
      }
    }
    return resultados;
  };
}
