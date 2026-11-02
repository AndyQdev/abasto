/**
 * Lo que se compra en Abasto entra solo al inventario: cuando un pedido llega a ENTREGADO, cada línea es una ENTRADA.
 * La clave «pedido:<id>:<producto>:<presentación>» hace que sincronizar dos veces (o leer `misCompras` en cada
 * pantalla) no duplique nada. El costo sale de lo que se pagó.
 */
import { separarContenido } from '../catalogo';
import type { Pedido } from '../pedidos';
import { medidaDeContenido } from './medidas';
import type { Articulo, DatosDeNegocio, Movimiento } from './motor';

export type PedidoComprado = Pick<Pedido, 'id' | 'codigo' | 'estado' | 'lineas'>;

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
export function comprasQueEntran(pedidos: PedidoComprado[], ya: DatosDeNegocio, ahora: string): DatosDeNegocio {
  const claves = new Set(ya.movimientos.map((m) => m.claveUnica));
  const articulos = new Map(ya.articulos.map((a) => [a.id, a]));
  const nuevos: Articulo[] = [];
  const movimientos: Movimiento[] = [];

  for (const pedido of pedidos) {
    if (pedido.estado !== 'ENTREGADO') continue;
    for (const l of pedido.lineas) {
      const clave = claveDeCompra(pedido.id, l.producto.id, l.presentacion);
      if (claves.has(clave) || l.unidades <= 0) continue;
      claves.add(clave);

      const id = idDeArticuloDeAbasto(l.producto.id);
      if (!articulos.has(id)) {
        const { nombre, contenido } = separarContenido(l.producto.nombre ?? l.producto.id);
        const articulo: Articulo = {
          id,
          nombre,
          detalle: contenido,
          rubro: l.producto.rubro ?? null,
          medida: medidaDeContenido(contenido),
          clase: 'COMPRADO',
          origen: 'ABASTO',
          productoId: l.producto.id,
          proveedor: null,
          creadoEn: ahora,
        };
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
  return { articulos: nuevos, movimientos };
}
