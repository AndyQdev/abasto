/**
 * De la plantilla a una receta de verdad (02/11). La receta ya no exige que el insumo esté en el inventario: cada
 * insumo de Abasto crea su artículo con existencia 0 (enlazado al producto del catálogo) y la receta lo usa. Así el
 * productor ve cuánto le cuesta cada unidad con los precios de referencia y pide lo que falta de un toque.
 *
 * El agua no se compra: se muestra en la plantilla, pero no entra a la receta (no tiene artículo ni costo).
 */
import { disponible, escalasConPrecio, separarContenido, type Producto } from '../catalogo';
import { idDeArticuloDeAbasto } from './compras';
import { medidaDeContenido, type UnidadDeBase } from './medidas';
import type { Articulo, CambiosDeNegocio, InsumoDeReceta, Receta } from './modelo';
import { ErrorDeInventario, type Libro } from './motor';
import { articuloHecho, costoDeReceta, faltantesDelPlan, planificar, receta as armarReceta } from './produccion';
import type { InsumoDePlantilla, PlantillaDeReceta, UnidadDePlantilla } from './plantillas';
import { insumosDePlantilla } from './plantillas';

/** El artículo de un producto de Abasto, todavía sin existencia (la compra la suma después) */
export function articuloDeAbasto(p: { id: string; nombre?: string | null; rubro?: string | null }, ahora: string): Articulo {
  const { nombre, contenido } = separarContenido(p.nombre ?? p.id);
  return {
    id: idDeArticuloDeAbasto(p.id),
    nombre,
    detalle: contenido,
    rubro: p.rubro ?? null,
    medida: medidaDeContenido(contenido),
    clase: 'COMPRADO',
    origen: 'ABASTO',
    productoId: p.id,
    proveedor: null,
    precioVentaCentavos: null,
    stockMinimo: null,
    creadoEn: ahora,
    actualizadoEn: ahora,
    eliminado: false,
  };
}

const FACTOR: Record<string, { familia: string; base: number }> = {
  kg: { familia: 'peso', base: 1000 },
  g: { familia: 'peso', base: 1 },
  L: { familia: 'volumen', base: 1000 },
  ml: { familia: 'volumen', base: 1 },
  'u.': { familia: 'unidades', base: 1 },
  rollos: { familia: 'rollos', base: 1 },
};

/** 400 g en kg → 0,4 · 2 L en ml → 2000. Null si no se puede (kilos a unidades) */
export function convertir(cantidad: number, de: UnidadDePlantilla | UnidadDeBase, a: UnidadDeBase): number | null {
  const x = FACTOR[de];
  const y = FACTOR[a];
  if (!x || !y || x.familia !== y.familia) return null;
  return (cantidad * x.base) / y.base;
}

/** Una línea de «Arma tu primera receta», ya editable: cantidad, unidad y el producto de Abasto que se usa */
export interface InsumoElegido {
  clave: string;
  nombre: string;
  /** Para agrupar como en la plantilla («Para la masa») */
  grupo: string;
  cantidad: number;
  unidad: UnidadDePlantilla;
  /** El producto de Abasto que se pide; null si no se compra (el agua) o si Abasto ya no lo vende */
  productoId: string | null;
  /** Los otros productos que sirven (la arroba o el quintal), para cambiar */
  opciones: string[];
  origen: InsumoDePlantilla['origen'];
}

/** Lo que trae un envase del producto, en la unidad del insumo de la receta; null si no se sabe */
function contenidoEn(p: Producto, unidad: UnidadDePlantilla) {
  const m = medidaDeContenido(separarContenido(p.nombre).contenido);
  return m.porEnvase === null ? null : convertir(m.porEnvase, m.unidad, unidad);
}

/**
 * El producto que se ofrece primero: la presentación más chica que alcanza para una tanda (2 kg de harina → la
 * arroba; 11,5 kg → la arroba; 46 kg → el quintal). Si ninguna alcanza, la más grande.
 */
export function productoParaInsumo(i: Pick<InsumoDePlantilla, 'codigos' | 'cantidad' | 'unidad'>, productos: Producto[]): Producto | null {
  const vendibles = i.codigos.map((c) => productos.find((p) => p.id === c && disponible(p))).filter((p): p is Producto => !!p);
  if (!vendibles.length) return null;
  return vendibles.find((p) => (contenidoEn(p, i.unidad) ?? Infinity) >= i.cantidad - 1e-9) ?? vendibles[vendibles.length - 1];
}

/** La plantilla lista para editar, con el producto de Abasto de cada insumo ya elegido */
export function insumosIniciales(p: PlantillaDeReceta, productos: Producto[]): InsumoElegido[] {
  return p.grupos.flatMap((g) =>
    g.insumos.map((i) => ({
      clave: i.clave,
      nombre: i.nombre,
      grupo: g.titulo,
      cantidad: i.cantidad,
      unidad: i.unidad,
      productoId: productoParaInsumo(i, productos)?.id ?? null,
      opciones: i.codigos.filter((c) => productos.some((x) => x.id === c && disponible(x))),
      origen: i.origen,
    })),
  );
}

export interface PrimeraReceta {
  receta: Receta;
  /** Lo que hay que guardar: el artículo hecho, los insumos nuevos (en cero) y la receta */
  cambios: Required<Pick<CambiosDeNegocio, 'articulos' | 'recetas'>>;
}

/**
 * Guarda la receta: crea lo que se hace (artículo HECHO), los insumos de Abasto que todavía no están (existencia 0)
 * y la receta, con cada cantidad en la unidad del artículo (400 g de azúcar → 0,4 kg si la arroba se cuenta en kg).
 * Un mismo insumo en dos grupos (yuca para el asadito y para servir) se suma.
 */
export function primeraReceta(
  entrada: { nombre: string; rinde: number; insumos: InsumoElegido[] },
  productos: Producto[],
  libro: Libro,
  ahora: string,
  nuevoId: () => string,
): PrimeraReceta {
  const existentes = new Map(libro.articulos.filter((a) => !a.eliminado).map((a) => [a.id, a]));
  const nuevos: Articulo[] = [];
  const cantidades = new Map<string, number>();
  for (const i of entrada.insumos) {
    if (!i.productoId || !(i.cantidad > 0)) continue;
    const producto = productos.find((p) => p.id === i.productoId);
    const id = idDeArticuloDeAbasto(i.productoId);
    let articulo = existentes.get(id);
    if (!articulo) {
      if (!producto) throw new ErrorDeInventario(`${i.nombre} ya no se vende en Abasto: elige otro o quítalo`);
      articulo = articuloDeAbasto(producto, ahora);
      existentes.set(id, articulo);
      nuevos.push(articulo);
    }
    const enSuUnidad = articulo.medida.porEnvase === null ? i.cantidad : convertir(i.cantidad, i.unidad, articulo.medida.unidad);
    if (enSuUnidad === null) throw new ErrorDeInventario(`Revisa la unidad de ${i.nombre}: ${articulo.nombre} se cuenta en ${articulo.medida.unidad}`);
    cantidades.set(id, (cantidades.get(id) ?? 0) + enSuUnidad);
  }
  const insumos: InsumoDeReceta[] = [...cantidades].map(([articuloId, cantidad]) => ({ articuloId, cantidad: Math.round(cantidad * 1e6) / 1e6 }));
  const hecho = articuloHecho(entrada.nombre, ahora, nuevoId());
  const r = armarReceta({ id: nuevoId(), articuloId: hecho.id, nombre: entrada.nombre, rinde: entrada.rinde, insumos }, ahora);
  return { receta: r, cambios: { articulos: [...nuevos, hecho], recetas: [r] } };
}

/**
 * El precio de referencia de un artículo de Abasto, por envase: el de la presentación más chica del catálogo. Sirve
 * para el costo de una receta antes de comprar (después manda lo que se pagó).
 */
export function preciosDeReferencia(productos: Producto[]) {
  const porId = new Map(productos.map((p) => [p.id, p]));
  return (a: Articulo): number | null => {
    const p = a.productoId ? porId.get(a.productoId) : undefined;
    const chica = p ? escalasConPrecio(p)[0] : undefined;
    return chica?.precioUnitario?.centavos ?? null;
  };
}

/** Todos los insumos que se compran en la plantilla (sin el agua) */
export const insumosQueSeCompran = (p: PlantillaDeReceta) => insumosDePlantilla(p).filter((i) => i.codigos.length > 0);

export interface ResumenDeRecetas {
  /** «Cada salteña te cuesta Bs 3,20», por receta */
  costos: { receta: Receta; porUnidadCentavos: number; totalCentavos: number }[];
  /** Lo que falta para hacer una tanda de cada receta, sumado y descontando lo que ya tiene */
  faltantes: { productoId: string; envases: number }[];
}

/** Después de guardar las primeras recetas: cuánto cuesta cada unidad (precios de referencia) y qué falta pedir */
export function resumenDeRecetas(recetas: Receta[], libro: Libro, productos: Producto[]): ResumenDeRecetas {
  const referencia = preciosDeReferencia(productos);
  const costos = recetas.map((r) => {
    const c = costoDeReceta(r, libro, referencia);
    return { receta: r, porUnidadCentavos: c.porUnidadCentavos, totalCentavos: c.totalCentavos };
  });
  // Una sola «receta» con todo: así lo que ya tiene se descuenta una vez, no una por receta
  const todo = new Map<string, number>();
  for (const r of recetas) for (const i of r.insumos) todo.set(i.articuloId, (todo.get(i.articuloId) ?? 0) + i.cantidad);
  if (!todo.size) return { costos, faltantes: [] };
  const junta: Receta = { ...recetas[0], id: 'todas', rinde: 1, insumos: [...todo].map(([articuloId, cantidad]) => ({ articuloId, cantidad })) };
  return { costos, faltantes: faltantesDelPlan(planificar(junta, 1, libro, referencia)) };
}
