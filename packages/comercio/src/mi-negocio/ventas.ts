/**
 * Vender (tienda y productor): la caja rápida, el precio sugerido con el margen y el aviso de «queda poco».
 * Fase 4 de docs/plan-mi-negocio.md. Una venta guarda el costo de ese momento: la ganancia del mes no cambia si
 * después sube el precio de compra.
 */
import type { NegocioElegido } from '../negocios';
import type { Articulo, ClienteDeFiado, FormaDeCobro, LineaDeVenta, Movimiento, MovimientoDeFiado, Venta } from './modelo';
import { ErrorDeInventario, existencias, type Existencia, type Libro } from './motor';

/** El margen sugerido por tipo: la tienda revende (20 %); el productor suma su trabajo (50 %). El hogar no vende */
export const MARGEN_POR_DEFECTO = { hogar: 0, tienda: 0.2, productor: 0.5 } as const;

export const margenDe = (negocio: NegocioElegido) => MARGEN_POR_DEFECTO[negocio.tipo];

/** Si este artículo se vende: la tienda vende lo que compra; el productor, lo que hace (sus insumos no) */
export const seVende = (negocio: NegocioElegido, a: Pick<Articulo, 'clase'>) => negocio.tipo === 'tienda' || (negocio.tipo === 'productor' && a.clase === 'HECHO');

/** Costo × (1 + margen), redondeado hacia arriba a 50 centavos (lo que se puede cobrar en la mano) */
export function precioSugerido(costoCentavos: number, margen: number) {
  return Math.ceil((costoCentavos * (1 + margen)) / 50) * 50;
}

export interface PrecioDeVenta {
  centavos: number;
  /** true si sale del margen y no lo puso la persona */
  sugerido: boolean;
  /** Lo que gana por envase, si se sabe el costo */
  gananciaCentavos: number | null;
}

/** El precio de un artículo: el que puso la persona o el sugerido. Null si no hay ni precio ni costo */
export function precioDeVenta(x: Pick<Existencia, 'articulo' | 'costoPromedioCentavos'>, negocio: NegocioElegido): PrecioDeVenta | null {
  const costo = x.costoPromedioCentavos;
  if (x.articulo.precioVentaCentavos !== null) {
    const centavos = x.articulo.precioVentaCentavos;
    return { centavos, sugerido: false, gananciaCentavos: costo !== null ? centavos - costo : null };
  }
  if (costo === null) return null;
  const centavos = precioSugerido(costo, margenDe(negocio));
  return { centavos, sugerido: true, gananciaCentavos: centavos - costo };
}

/** El artículo con su precio de venta nuevo (o null para volver al sugerido) */
export function conPrecio(a: Articulo, centavos: number | null, ahora: string): Articulo {
  if (centavos !== null && (!Number.isFinite(centavos) || centavos < 0)) throw new ErrorDeInventario('Revisa el precio');
  return { ...a, precioVentaCentavos: centavos === null ? null : Math.round(centavos), actualizadoEn: ahora };
}

/** El artículo con el aviso de «queda poco» en esa cantidad (o null para que se estime) */
export function conMinimo(a: Articulo, minimo: number | null, ahora: string): Articulo {
  if (minimo !== null && (!Number.isFinite(minimo) || minimo < 0)) throw new ErrorDeInventario('Revisa la cantidad');
  return { ...a, stockMinimo: minimo, actualizadoEn: ahora };
}

export type AvisoDeStock = 'agotado' | 'poco' | null;

/**
 * «Queda poco»: si la persona puso un mínimo, ese; si no, cuando queda la cuarta parte o menos de la última compra.
 * Nunca inventa urgencias: sin compras no avisa nada.
 */
export function avisoDeStock(x: Existencia, libro: Libro): AvisoDeStock {
  if (x.agotado) return 'agotado';
  if (x.articulo.stockMinimo !== null) return x.cantidad <= x.articulo.stockMinimo ? 'poco' : null;
  const entradas = libro.movimientos.filter((m) => m.articuloId === x.articulo.id && (m.tipo === 'ENTRADA' || m.tipo === 'PRODUCCION') && m.cantidad > 0);
  if (!entradas.length) return null;
  const ultima = [...entradas].sort((a, b) => a.fecha.localeCompare(b.fecha))[entradas.length - 1];
  return x.cantidad <= ultima.cantidad * 0.25 ? 'poco' : null;
}

export interface ItemDeVenta {
  articuloId: string;
  cantidad: number;
  precioUnitarioCentavos: number;
}

export interface VentaRegistrada {
  venta: Venta;
  movimientos: Movimiento[];
  /** Lo que queda debiendo, si fue fiado */
  fiado: MovimientoDeFiado | null;
}

/**
 * La caja: cobra (o fía) y descuenta del inventario. No deja vender más de lo que hay: así el inventario no queda
 * en negativo y la persona sabe que tiene que contar o comprar.
 */
export function registrarVenta(
  libro: Libro,
  items: ItemDeVenta[],
  cobro: { forma: FormaDeCobro; cliente?: ClienteDeFiado | null },
  ahora: string,
  id: string,
): VentaRegistrada {
  const lineas = items.filter((i) => i.cantidad > 0);
  if (!lineas.length) throw new ErrorDeInventario('Agrega lo que vendiste');
  if (cobro.forma === 'FIADO' && !cobro.cliente) throw new ErrorDeInventario('Elige a quién le fías');
  const hay = new Map(existencias(libro).map((x) => [x.articulo.id, x]));
  const juntas = new Map<string, ItemDeVenta>();
  for (const i of lineas) {
    const antes = juntas.get(i.articuloId);
    juntas.set(i.articuloId, antes ? { ...antes, cantidad: antes.cantidad + i.cantidad } : i);
  }

  const lineasDeVenta: LineaDeVenta[] = [];
  for (const i of juntas.values()) {
    const x = hay.get(i.articuloId);
    if (!x) throw new ErrorDeInventario('Ese producto ya no está en tu inventario');
    if (!Number.isFinite(i.cantidad) || i.cantidad <= 0) throw new ErrorDeInventario('Revisa la cantidad');
    if (!Number.isFinite(i.precioUnitarioCentavos) || i.precioUnitarioCentavos < 0) throw new ErrorDeInventario('Revisa el precio');
    if (i.cantidad > x.cantidad + 1e-9) throw new ErrorDeInventario(`Solo tienes ${x.agotado ? 'nada' : x.texto} de ${x.articulo.nombre}`);
    lineasDeVenta.push({ articuloId: i.articuloId, cantidad: i.cantidad, precioUnitarioCentavos: Math.round(i.precioUnitarioCentavos), costoUnitarioCentavos: x.costoPromedioCentavos });
  }

  const totalCentavos = Math.round(lineasDeVenta.reduce((s, l) => s + l.cantidad * l.precioUnitarioCentavos, 0));
  const costoCentavos = Math.round(lineasDeVenta.reduce((s, l) => s + l.cantidad * (l.costoUnitarioCentavos ?? 0), 0));
  const venta: Venta = { id, fecha: ahora, lineas: lineasDeVenta, totalCentavos, costoCentavos, forma: cobro.forma, clienteId: cobro.cliente?.id ?? null, anulada: false };
  const movimientos: Movimiento[] = lineasDeVenta.map((l) => ({
    id: `venta:${id}:${l.articuloId}`,
    articuloId: l.articuloId,
    tipo: 'VENTA',
    cantidad: -l.cantidad,
    costoUnitarioCentavos: l.costoUnitarioCentavos,
    origen: 'VENTA',
    claveUnica: `venta:${id}:${l.articuloId}`,
    fecha: ahora,
    nota: null,
    ventaId: id,
  }));
  const fiado: MovimientoDeFiado | null =
    cobro.forma === 'FIADO' && cobro.cliente
      ? { id: `fiado:${id}`, clienteId: cobro.cliente.id, tipo: 'DEBE', montoCentavos: totalCentavos, ventaId: id, fecha: ahora, nota: null }
      : null;
  return { venta, movimientos, fiado };
}
