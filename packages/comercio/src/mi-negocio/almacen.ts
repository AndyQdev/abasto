/**
 * Dónde se guarda el inventario. La app lo guarda en el teléfono (SQLite, `apps/app/src/almacen-negocio.ts`); el
 * respaldo en la nube es la Fase 5. `AlmacenEnMemoria` sirve para las pruebas y hace lo mismo que el de SQLite:
 * un artículo se reemplaza por su id y un movimiento con una clave única que ya está no se vuelve a guardar.
 */
import { comprasQueEntran, type PedidoComprado } from './compras';
import type { Articulo, DatosDeNegocio, Movimiento } from './motor';

export interface AlmacenDeNegocio {
  leer(): Promise<DatosDeNegocio>;
  guardar(cambios: { articulos?: Articulo[]; movimientos?: Movimiento[] }): Promise<void>;
}

export class AlmacenEnMemoria implements AlmacenDeNegocio {
  private articulos = new Map<string, Articulo>();
  private movimientos = new Map<string, Movimiento>();

  async leer(): Promise<DatosDeNegocio> {
    return { articulos: [...this.articulos.values()], movimientos: [...this.movimientos.values()] };
  }

  async guardar({ articulos = [], movimientos = [] }: { articulos?: Articulo[]; movimientos?: Movimiento[] }) {
    for (const a of articulos) this.articulos.set(a.id, a);
    for (const m of movimientos) if (!this.movimientos.has(m.claveUnica)) this.movimientos.set(m.claveUnica, m);
  }
}

/** Registra lo que llegó desde la última vez. Devuelve cuántas líneas entraron (0 si ya estaba todo) */
export async function sincronizarCompras(almacen: AlmacenDeNegocio, pedidos: PedidoComprado[], ahora: string) {
  const nuevo = comprasQueEntran(pedidos, await almacen.leer(), ahora);
  if (nuevo.movimientos.length || nuevo.articulos.length) await almacen.guardar(nuevo);
  return nuevo.movimientos.length;
}
