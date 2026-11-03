/**
 * Dónde se guarda «Mi negocio». En el teléfono, SQLite (`apps/app/src/almacen-negocio.ts`) con la cola de lo que falta
 * subir; en el servidor, el esquema `negocio` de Cobros. `AlmacenEnMemoria` sirve para las pruebas y aplica la misma
 * regla que los dos (`fusionar`): lo que solo se agrega entra una vez; lo editable gana si es igual o más nuevo.
 */
import { comprasQueEntran, type PedidoComprado } from './compras';
import { datosVacios, fusionar, type CambiosDeNegocio, type DatosDeNegocio } from './modelo';

export interface AlmacenDeNegocio {
  leer(): Promise<DatosDeNegocio>;
  guardar(cambios: CambiosDeNegocio): Promise<void>;
}

export class AlmacenEnMemoria implements AlmacenDeNegocio {
  private datos = datosVacios();

  async leer(): Promise<DatosDeNegocio> {
    return this.datos;
  }

  async guardar(cambios: CambiosDeNegocio) {
    this.datos = fusionar(this.datos, cambios);
  }
}

/** Registra lo que llegó desde la última vez. Devuelve cuántas líneas entraron (0 si ya estaba todo) */
export async function sincronizarCompras(almacen: AlmacenDeNegocio, pedidos: PedidoComprado[], ahora: string) {
  const nuevo = comprasQueEntran(pedidos, await almacen.leer(), ahora);
  if (nuevo.movimientos.length || nuevo.articulos.length || nuevo.anotaciones.length) await almacen.guardar(nuevo);
  return nuevo.movimientos.length;
}
