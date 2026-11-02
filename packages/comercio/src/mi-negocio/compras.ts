/**
 * Lo que se compra en Abasto entra solo al inventario: cuando un pedido llega a ENTREGADO, cada línea es una ENTRADA.
 * La clave «pedido:<id>:<producto>:<presentación>» hace que sincronizar dos veces (o leer `misCompras` en cada
 * pantalla) no duplique nada. El costo sale de lo que se pagó.
 */
import type { Pedido } from '../pedidos';
import { gastoDeCompra } from './hogar';
import type { Anotacion, Articulo, Movimiento } from './modelo';
import type { Libro } from './motor';
import { articuloDeAbasto } from './primera-receta';

export type PedidoComprado = Pick<Pedido, 'id' | 'codigo' | 'estado' | 'lineas'> & { total?: { centavos: number }; creadoEn?: string };

export const claveDeCompra = (pedidoId: string, productoId: string, presentacion: string) => `pedido:${pedidoId}:${productoId}:${presentacion}`;
export const idDeArticuloDeAbasto = (productoId: string) => `abasto:${productoId}`;

/** «Bs 1.234,50» → 123450. Para los pedidos guardados antes de que la línea trajera los centavos */
export function centavosDeTexto(texto: string | null | undefined): number | null {
  const m = (texto ?? '').match(/(\d[\d.]*)(?:,(\d{1,2}))?/);
  if (!m) return null;
  return Number(m[1].replace(/\./g, '')) * 100 + Number((m[2] ?? '0').padEnd(2, '0'));
}

/**
 * Los artículos nuevos y las entradas que faltan registrar, a partir de los pedidos. Solo cuentan los ENTREGADOS
 * y solo lo que todavía no entró (por la clave única).
 */
/** Lo que entra por los pedidos entregados: artículos nuevos, sus entradas y el gasto de cada pedido */
export type ComprasNuevas = Libro & { anotaciones: Anotacion[] };

export function comprasQueEntran(pedidos: PedidoComprado[], ya: Libro & { anotaciones?: Anotacion[] }, ahora: string): ComprasNuevas {
  const claves = new Set(ya.movimientos.map((m) => m.claveUnica));
  const articulos = new Map(ya.articulos.map((a) => [a.id, a]));
  const nuevos: Articulo[] = [];
  const movimientos: Movimiento[] = [];
  const gastos = new Set((ya.anotaciones ?? []).map((a) => a.claveUnica));
  const anotaciones: Anotacion[] = [];

  for (const pedido of pedidos) {
    if (pedido.estado !== 'ENTREGADO') continue;
    const gasto = gastoDeCompra(pedido, ahora);
    if (gasto && !gastos.has(gasto.claveUnica)) {
      gastos.add(gasto.claveUnica);
      anotaciones.push(gasto);
    }
    for (const l of pedido.lineas) {
      const clave = claveDeCompra(pedido.id, l.producto.id, l.presentacion);
      if (claves.has(clave) || l.unidades <= 0) continue;
      claves.add(clave);

      const id = idDeArticuloDeAbasto(l.producto.id);
      if (!articulos.has(id)) {
        const articulo = articuloDeAbasto({ id: l.producto.id, nombre: l.producto.nombre, rubro: l.producto.rubro }, ahora);
        articulos.set(id, articulo);
        nuevos.push(articulo);
      }
      const pagado = l.subtotal.centavos ?? centavosDeTexto(l.subtotal.texto);
      movimientos.push({
        id: clave,
        articuloId: id,
        tipo: 'ENTRADA',
        cantidad: l.unidades,
        costoUnitarioCentavos: pagado !== null ? Math.round(pagado / l.unidades) : null,
        origen: 'ABASTO',
        claveUnica: clave,
        fecha: ahora,
        nota: `Pedido ${pedido.codigo}`,
      });
    }
  }
  return { articulos: nuevos, movimientos, anotaciones };
}
