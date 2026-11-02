/**
 * Del inventario al carrito: «pedir de nuevo» (tienda), «pedir lo que falta» (planificador) y «pedir mi lista»
 * (hogar). Cuenta en envases del artículo y elige la presentación del catálogo: la que viene de a uno si existe;
 * si no, la más chica, redondeando hacia arriba (nunca se pide menos de lo que falta).
 */
import type { ItemDeCarrito } from '../carrito';
import { escalasConPrecio, itemDeCarrito, type Producto } from '../catalogo';

export interface Faltante {
  productoId: string;
  /** En envases del artículo (1 envase = 1 unidad del producto del catálogo) */
  envases: number;
}

export interface ParaPedir {
  items: ItemDeCarrito[];
  /** Lo que ya no se vende en Abasto */
  noSeVenden: string[];
}

export function itemsParaPedir(faltantes: Faltante[], productos: Producto[], nombreDe: (productoId: string) => string = (id) => id): ParaPedir {
  const items: ItemDeCarrito[] = [];
  const noSeVenden: string[] = [];
  for (const f of faltantes) {
    if (f.envases <= 0) continue;
    const p = productos.find((x) => x.id === f.productoId && (x.estado === 'ACTIVO' || x.estado === 'SIN_STOCK'));
    const escalas = p ? escalasConPrecio(p) : [];
    const escala = escalas.find((e) => e.cantidad === 1) ?? escalas[0];
    if (!p || !escala) {
      noSeVenden.push(nombreDe(f.productoId));
      continue;
    }
    items.push(itemDeCarrito(p, escala, Math.max(1, Math.ceil(f.envases / escala.cantidad - 1e-9))));
  }
  return { items, noSeVenden };
}
