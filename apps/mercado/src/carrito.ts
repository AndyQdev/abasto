/**
 * El carrito vive en el teléfono y se puede cambiar sin señal.
 * Un pedido es por mayorista: si el carrito tiene productos de dos mayoristas, salen dos pedidos.
 */
export type Presentacion = 'UNIDAD' | 'CUARTA' | 'DOCENA' | 'CAJA' | 'FARDO';

export interface ItemDeCarrito {
  productoId: string;
  nombre: string;
  mayoristaId: string;
  mayoristaNombre: string;
  presentacion: Presentacion;
  cantidad: number;
  /** Unidades por presentación (una caja de shampoo trae 48) */
  unidadesPorPresentacion: number;
  /** Precio por unidad que la tienda vio; el definitivo lo fija Catálogo al reservar */
  precioUnitarioCentavos: number | null;
}

export interface PedidoDelCarrito {
  mayoristaId: string;
  mayoristaNombre: string;
  items: ItemDeCarrito[];
  totalEstimadoCentavos: number;
}

export function agregar(carrito: ItemDeCarrito[], item: ItemDeCarrito): ItemDeCarrito[] {
  const igual = (i: ItemDeCarrito) => i.productoId === item.productoId && i.presentacion === item.presentacion;
  const existente = carrito.find(igual);
  if (!existente) return [...carrito, item];
  return carrito.map((i) => (igual(i) ? { ...i, cantidad: i.cantidad + item.cantidad } : i));
}

export function quitar(carrito: ItemDeCarrito[], productoId: string, presentacion: Presentacion) {
  return carrito.filter((i) => !(i.productoId === productoId && i.presentacion === presentacion));
}

/** Suma o resta de a uno. Nunca baja de 1: para sacar el producto está «quitar». */
export function cambiarCantidad(carrito: ItemDeCarrito[], productoId: string, presentacion: Presentacion, delta: number) {
  return carrito.map((i) =>
    i.productoId === productoId && i.presentacion === presentacion ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i,
  );
}

export const unidadesDe = (i: Pick<ItemDeCarrito, 'cantidad' | 'unidadesPorPresentacion'>) => i.cantidad * i.unidadesPorPresentacion;

export const totalDe = (i: ItemDeCarrito) => (i.precioUnitarioCentavos ?? 0) * unidadesDe(i);

export function porMayorista(carrito: ItemDeCarrito[]): PedidoDelCarrito[] {
  const grupos = new Map<string, PedidoDelCarrito>();
  for (const item of carrito) {
    const g = grupos.get(item.mayoristaId) ?? {
      mayoristaId: item.mayoristaId,
      mayoristaNombre: item.mayoristaNombre,
      items: [],
      totalEstimadoCentavos: 0,
    };
    g.items.push(item);
    g.totalEstimadoCentavos += (item.precioUnitarioCentavos ?? 0) * item.unidadesPorPresentacion * item.cantidad;
    grupos.set(item.mayoristaId, g);
  }
  return [...grupos.values()];
}

const formato = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const bs = (centavos: number) => `Bs ${formato.format(centavos / 100)}`;

const NOMBRES: Record<Presentacion, [string, string]> = {
  UNIDAD: ['unidad', 'unidades'],
  CUARTA: ['cuarta', 'cuartas'],
  DOCENA: ['docena', 'docenas'],
  CAJA: ['caja', 'cajas'],
  FARDO: ['fardo', 'fardos'],
};

/** «docena» o «docenas» */
export function nombreDe(presentacion: Presentacion, cantidad = 1) {
  const [uno, varios] = NOMBRES[presentacion];
  return cantidad === 1 ? uno : varios;
}

/** «1 docena», «3 cajas» */
export const cantidadDe = (presentacion: Presentacion, cantidad: number) => `${cantidad} ${nombreDe(presentacion, cantidad)}`;

/** «2 cajas · 96 u.» */
export function cantidadConUnidad(item: Pick<ItemDeCarrito, 'cantidad' | 'presentacion' | 'unidadesPorPresentacion'>) {
  return `${cantidadDe(item.presentacion, item.cantidad)} · ${item.cantidad * item.unidadesPorPresentacion} u.`;
}
