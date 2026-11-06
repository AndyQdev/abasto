/**
 * «Mi producción» (fase 5): recetas, costo por unidad, el planificador y las tandas. Tomado de Solvexco (fórmula con
 * rinde → orden de producción → consumo y resultado) al nivel de una salteñería.
 *
 * Los insumos de una receta van en la unidad de base del insumo («5 kg» de harina, aunque se compre por quintal;
 * «30 u.» de huevo, aunque venga por maple). El inventario cuenta en envases: `aEnvases` convierte.
 */
import { textoDeCantidad, numeroBonito, plural } from './medidas';
import type { Articulo, InsumoDeReceta, Movimiento, Receta, Tanda } from './modelo';
import { ErrorDeInventario, existencias, type Existencia, type Libro } from './motor';

/** En qué se escribe la cantidad de un insumo en la receta: «kg», «u.», «ml»… o el envase si no se sabe cuánto trae */
export function unidadDeReceta(a: Articulo) {
  const m = a.medida;
  if (m.porEnvase === null) return plural(m.envase, 2);
  return m.unidad;
}

/** Cantidad en la unidad de la receta → envases del inventario (5 kg de harina por quintal de 46 kg → 0,109) */
export function aEnvases(a: Articulo, cantidad: number) {
  const por = a.medida.porEnvase;
  return por === null || por === 0 ? cantidad : cantidad / por;
}

/** «5 kg», «30 u.», «2 paquetes» */
export const textoDeReceta = (a: Articulo, cantidad: number) => `${numeroBonito(cantidad)} ${unidadDeReceta(a)}`;

/** Un producto que hace el productor (salteña de pollo, marraqueta…): se cuenta por unidad */
export function articuloHecho(nombre: string, ahora: string, id: string): Articulo {
  const limpio = nombre.trim().replace(/\s+/g, ' ');
  if (limpio.length < 2) throw new ErrorDeInventario('Escribe qué haces, por ejemplo «Salteña de pollo»');
  return {
    id,
    nombre: limpio,
    detalle: null,
    rubro: null,
    medida: { envase: 'unidad', porEnvase: 1, unidad: 'u.' },
    clase: 'HECHO',
    origen: 'OTRO_PROVEEDOR',
    productoId: null,
    proveedor: null,
    precioVentaCentavos: null,
    stockMinimo: null,
    creadoEn: ahora,
    actualizadoEn: ahora,
    eliminado: false,
  };
}

/** Una receta nueva o cambiada. Valida que tenga rinde y al menos un insumo, y que no se use a sí misma */
export function receta(entrada: { id: string; articuloId: string; nombre: string; rinde: number; notas?: string | null; insumos: InsumoDeReceta[] }, ahora: string): Receta {
  const nombre = entrada.nombre.trim().replace(/\s+/g, ' ');
  if (nombre.length < 2) throw new ErrorDeInventario('Ponle nombre a la receta');
  if (!Number.isFinite(entrada.rinde) || entrada.rinde <= 0) throw new ErrorDeInventario('¿Cuántas salen con esta receta?');
  const insumos = entrada.insumos.filter((i) => i.cantidad > 0);
  if (!insumos.length) throw new ErrorDeInventario('Agrega al menos un insumo');
  if (insumos.some((i) => !Number.isFinite(i.cantidad))) throw new ErrorDeInventario('Revisa las cantidades');
  if (insumos.some((i) => i.articuloId === entrada.articuloId)) throw new ErrorDeInventario('Un producto no puede ser insumo de su propia receta');
  return { id: entrada.id, articuloId: entrada.articuloId, nombre, rinde: entrada.rinde, notas: entrada.notas ?? null, insumos, actualizadoEn: ahora, eliminado: false };
}

export interface CostoDeReceta {
  totalCentavos: number;
  porUnidadCentavos: number;
  /** Insumos sin costo conocido (agregados a mano sin precio): el costo sale más bajo de lo real */
  sinCosto: string[];
}

/**
 * Lo que cuesta un envase del insumo: lo que se pagó (costo promedio) o, si todavía no se compró, el precio de
 * referencia del catálogo (02/11: la receta se arma antes de comprar).
 */
export type PrecioDeReferencia = (a: Articulo) => number | null;

export function costoDeReceta(r: Receta, libro: Libro, referencia?: PrecioDeReferencia): CostoDeReceta {
  const hay = new Map(existencias(libro).map((x) => [x.articulo.id, x]));
  const articulos = new Map(libro.articulos.map((a) => [a.id, a]));
  let total = 0;
  const sinCosto: string[] = [];
  for (const i of r.insumos) {
    const x = hay.get(i.articuloId);
    const articulo = x?.articulo ?? articulos.get(i.articuloId);
    const costo = x?.costoPromedioCentavos ?? (articulo && referencia ? referencia(articulo) : null);
    if (!articulo || costo === null) {
      sinCosto.push(articulo?.nombre ?? 'un insumo que ya no está');
      continue;
    }
    total += aEnvases(articulo, i.cantidad) * costo;
  }
  return { totalCentavos: Math.round(total), porUnidadCentavos: Math.round(total / r.rinde), sinCosto };
}

export interface InsumoPlanificado {
  articulo: Articulo;
  /** En envases */
  necesita: number;
  tiene: number;
  falta: number;
  /** «15 kg» (en la unidad de la receta) */
  textoNecesita: string;
  /** «1 quintal · 46 kg» lo que hay */
  textoTiene: string;
  /** «0,33 quintales · 15 kg»; null si alcanza */
  textoFalta: string | null;
}

export interface Plan {
  receta: Receta;
  cantidad: number;
  insumos: InsumoPlanificado[];
  alcanza: boolean;
  costoCentavos: number;
}

/** «Quiero hacer 300»: cuánto de cada insumo, cuánto hay y cuánto falta */
export function planificar(r: Receta, cantidad: number, libro: Libro, referencia?: PrecioDeReferencia): Plan {
  if (!Number.isFinite(cantidad) || cantidad <= 0) throw new ErrorDeInventario('¿Cuántas quieres hacer?');
  const factor = cantidad / r.rinde;
  const hay = new Map<string, Existencia>(existencias(libro).map((x) => [x.articulo.id, x]));
  const articulos = new Map(libro.articulos.map((a) => [a.id, a]));
  let costo = 0;
  const insumos = r.insumos.map((i): InsumoPlanificado => {
    const x = hay.get(i.articuloId);
    const articulo = x?.articulo ?? articulos.get(i.articuloId);
    if (!articulo) throw new ErrorDeInventario('La receta usa un insumo que ya no está en tu inventario');
    const necesita = aEnvases(articulo, i.cantidad * factor);
    const tiene = Math.max(x?.cantidad ?? 0, 0);
    const falta = Math.max(necesita - tiene, 0);
    costo += necesita * (x?.costoPromedioCentavos ?? referencia?.(articulo) ?? 0);
    return {
      articulo,
      necesita,
      tiene,
      falta,
      textoNecesita: textoDeReceta(articulo, i.cantidad * factor),
      textoTiene: textoDeCantidad(tiene, articulo.medida),
      textoFalta: falta > 1e-9 ? textoDeCantidad(redondearArriba(falta), articulo.medida) : null,
    };
  });
  return { receta: r, cantidad, insumos, alcanza: insumos.every((i) => i.falta <= 1e-9), costoCentavos: Math.round(costo) };
}

const redondearArriba = (n: number) => Math.ceil(n * 100) / 100;

export interface TandaRegistrada {
  tanda: Tanda;
  movimientos: Movimiento[];
}

/**
 * Registrar lo que se hizo: descuenta los insumos de lo planificado (CONSUMO) y suma lo que salió (PRODUCCION) con su
 * costo por unidad. Si salió menos, la merma se ve en la tanda. No deja registrar si falta algún insumo.
 */
export function registrarTanda(r: Receta, libro: Libro, planificado: number, obtenido: number, ahora: string, id: string): TandaRegistrada {
  if (!Number.isFinite(obtenido) || obtenido <= 0) throw new ErrorDeInventario('¿Cuántas salieron?');
  const plan = planificar(r, planificado, libro);
  const faltan = plan.insumos.filter((i) => i.textoFalta);
  if (faltan.length) throw new ErrorDeInventario(`Te falta ${faltan.map((i) => `${i.textoFalta} de ${i.articulo.nombre}`).join(', ')}`);
  const consumos: Movimiento[] = plan.insumos.map((i) => ({
    id: `tanda:${id}:${i.articulo.id}`,
    articuloId: i.articulo.id,
    tipo: 'CONSUMO',
    cantidad: -Math.round(i.necesita * 1e6) / 1e6,
    costoUnitarioCentavos: null,
    origen: 'TANDA',
    claveUnica: `tanda:${id}:${i.articulo.id}`,
    fecha: ahora,
    nota: r.nombre,
    tandaId: id,
  }));
  const produccion: Movimiento = {
    id: `tanda:${id}:${r.articuloId}`,
    articuloId: r.articuloId,
    tipo: 'PRODUCCION',
    cantidad: obtenido,
    costoUnitarioCentavos: Math.round(plan.costoCentavos / obtenido),
    origen: 'TANDA',
    claveUnica: `tanda:${id}:${r.articuloId}`,
    fecha: ahora,
    nota: r.nombre,
    tandaId: id,
  };
  const tanda: Tanda = { id, recetaId: r.id, articuloId: r.articuloId, planificado, obtenido, costoTotalCentavos: plan.costoCentavos, fecha: ahora };
  return { tanda, movimientos: [...consumos, produccion] };
}

/** «Pedir lo que falta»: lo que falta del plan que se compra en Abasto, en envases de cada producto */
export function faltantesDelPlan(plan: Plan) {
  return plan.insumos.filter((i) => i.falta > 1e-9 && i.articulo.productoId).map((i) => ({ productoId: i.articulo.productoId!, envases: i.falta }));
}
