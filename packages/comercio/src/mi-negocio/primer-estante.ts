/**
 * «Arma tu primer estante» (tienda, 02/11): lo que más se repone en una tienda de barrio, ya marcado. La tienda quita lo
 * que no vende, dice cuántas pide y ve cuánto ganaría vendiéndolo al precio sugerido (20 % por defecto, editable).
 *
 * Al pedir, cada producto queda en su inventario con existencia 0 y su precio de venta (el costo + la ganancia que
 * eligió): cuando el pedido llega, la compra entra en ese mismo artículo y ya tiene precio para vender.
 */
import { escalaPorDefecto, itemDeCarrito, disponible, type Escala, type Producto } from '../catalogo';
import type { ItemDeCarrito } from '../carrito';
import { idDeArticuloDeAbasto } from './compras';
import type { Articulo } from './modelo';
import type { Libro } from './motor';
import { ESTANTE_DE_TIENDA } from './plantillas';
import { articuloDeAbasto } from './primera-receta';
import { precioSugerido } from './ventas';

export interface LineaDeEstante {
  producto: Producto;
  escala: Escala;
  /** Cuántas presentaciones (2 docenas, 1 fardo) */
  cantidad: number;
  marcado: boolean;
}

/** El estante de siempre con lo que Abasto vende hoy, en su presentación por defecto (la docena si hay) */
export function estanteInicial(productos: Producto[]): LineaDeEstante[] {
  return ESTANTE_DE_TIENDA.flatMap((codigo) => {
    const producto = productos.find((p) => p.id === codigo && disponible(p));
    const escala = producto && escalaPorDefecto(producto);
    return producto && escala?.precioUnitario ? [{ producto, escala, cantidad: 1, marcado: true }] : [];
  });
}

/** Unidades sueltas que se piden de una línea (2 docenas → 24) */
const unidades = (l: LineaDeEstante) => l.cantidad * l.escala.cantidad;
const costoUnitario = (l: LineaDeEstante) => l.escala.precioUnitario?.centavos ?? 0;

export interface ResumenDeEstante {
  lineas: number;
  costoCentavos: number;
  /** Lo que entra si vende todo al precio sugerido */
  ventaCentavos: number;
  gananciaCentavos: number;
}

export function resumenDeEstante(estante: LineaDeEstante[], margen: number): ResumenDeEstante {
  const marcadas = estante.filter((l) => l.marcado && l.cantidad > 0);
  const costo = marcadas.reduce((s, l) => s + unidades(l) * costoUnitario(l), 0);
  const venta = marcadas.reduce((s, l) => s + unidades(l) * precioSugerido(costoUnitario(l), margen), 0);
  return { lineas: marcadas.length, costoCentavos: costo, ventaCentavos: venta, gananciaCentavos: venta - costo };
}

/** Lo que va al carrito */
export function itemsDelEstante(estante: LineaDeEstante[]): ItemDeCarrito[] {
  return estante.filter((l) => l.marcado && l.cantidad > 0).map((l) => itemDeCarrito(l.producto, l.escala, l.cantidad));
}

/**
 * Los artículos del inventario, en cero y con su precio de venta por unidad. Si ya tenía el artículo (lo compró antes),
 * solo le pone el precio si todavía no tenía uno.
 */
export function articulosDelEstante(estante: LineaDeEstante[], margen: number, libro: Libro, ahora: string): Articulo[] {
  const ya = new Map(libro.articulos.map((a) => [a.id, a]));
  return estante
    .filter((l) => l.marcado && l.cantidad > 0)
    .flatMap((l) => {
      const precio = precioSugerido(costoUnitario(l), margen);
      const antes = ya.get(idDeArticuloDeAbasto(l.producto.id));
      if (antes && !antes.eliminado) return antes.precioVentaCentavos === null ? [{ ...antes, precioVentaCentavos: precio, actualizadoEn: ahora }] : [];
      return [{ ...articuloDeAbasto(l.producto, ahora), precioVentaCentavos: precio }];
    });
}
