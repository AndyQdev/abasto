import { Injectable } from '@nestjs/common';
import type { Operacion, TipoDeOperacion } from '../../dominio/operacion.js';
import type { DestinoDeOperaciones } from '../../dominio/puertos.js';

/** Cada tipo de operación es una mutación del supergrafo. La clave viaja para que el servicio también la registre. */
const MUTACIONES: Record<TipoDeOperacion, string> = {
  'pedido.crear': `mutation CrearPedido($entrada: CrearPedidoEntrada!) {
    crearPedido(entrada: $entrada) { id codigo estado total { texto } tienda { nombre } }
  }`,
  'producto.cargar': `mutation CargarProducto($entrada: CargarProductoEntrada!) {
    cargarProducto(entrada: $entrada) { id nombre estado }
  }`,
};

/** Adaptador de salida: aplica la operación en el servicio dueño, pasando por el Apollo Router con el token del usuario. */
@Injectable()
export class DestinoGraphQL implements DestinoDeOperaciones {
  private readonly url = process.env.ROUTER_URL ?? 'http://localhost:4000/';

  async aplicar(operacion: Operacion, token: string): Promise<unknown> {
    const respuesta = await fetch(this.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'idempotency-key': operacion.clave,
      },
      body: JSON.stringify({
        query: MUTACIONES[operacion.tipo],
        variables: { entrada: { ...operacion.datos, clave: operacion.clave } },
      }),
    });
    const cuerpo = (await respuesta.json()) as { data?: Record<string, unknown>; errors?: { message: string }[] };
    if (!respuesta.ok || cuerpo.errors?.length) {
      throw new Error(cuerpo.errors?.map((e) => e.message).join('; ') ?? `El Router respondió ${respuesta.status}`);
    }
    return Object.values(cuerpo.data ?? {})[0];
  }
}
