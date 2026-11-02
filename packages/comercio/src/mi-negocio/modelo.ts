/**
 * El modelo de «Mi negocio» (docs/plan-mi-negocio.md, «Modelo de datos»). Es el contrato entre el teléfono y el
 * servidor: el esquema `negocio` de Cobros guarda exactamente esto, con el `org_id` del cliente en cada fila.
 *
 * Dos clases de registros:
 * - **Se agregan y nunca se editan** (movimientos, ventas, fiado, tandas y anotaciones): llevan un id o una clave
 *   única que arma quien los crea. Subirlos dos veces no los duplica.
 * - **Se editan** (artículos, clientes de fiado, recetas y lista fija): llevan `actualizadoEn` y gana el más nuevo.
 *   Borrar es marcar `eliminado`, para que el borrado también viaje entre el teléfono y el servidor.
 */
import type { Medida } from './medidas';

/** COMPRADO: insumo, mercadería o despensa. HECHO: lo que hace el productor */
export type ClaseDeArticulo = 'COMPRADO' | 'HECHO';
export type OrigenDeArticulo = 'ABASTO' | 'OTRO_PROVEEDOR';

interface Editable {
  /** ISO 8601. Gana el más nuevo */
  actualizadoEn: string;
  eliminado: boolean;
}

export interface Articulo extends Editable {
  id: string;
  nombre: string;
  /** El contenido del nombre del producto («quintal 46 kg»), si lo tiene */
  detalle: string | null;
  rubro: string | null;
  medida: Medida;
  clase: ClaseDeArticulo;
  origen: OrigenDeArticulo;
  /** El producto del catálogo de Abasto, para volver a pedirlo */
  productoId: string | null;
  /** El proveedor, si se agregó a mano */
  proveedor: string | null;
  /** El precio al que lo vende (tienda o productor), por envase. Null: se sugiere con el margen */
  precioVentaCentavos: number | null;
  /** Con cuánto avisar «queda poco», en envases. Null: se estima */
  stockMinimo: number | null;
  creadoEn: string;
}

/**
 * ENTRADA suma (compra), AJUSTE corrige lo contado, VENTA resta lo vendido, CONSUMO resta los insumos de una tanda y
 * PRODUCCION suma lo hecho. SALIDA y MERMA quedan para casos a mano.
 */
export type TipoDeMovimiento = 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'CONSUMO' | 'PRODUCCION' | 'VENTA' | 'MERMA';
export type OrigenDeMovimiento = 'ABASTO' | 'OTRO_PROVEEDOR' | 'MANUAL' | 'VENTA' | 'TANDA';

export interface Movimiento {
  id: string;
  articuloId: string;
  tipo: TipoDeMovimiento;
  /** En envases del artículo y con signo: + entra, − sale */
  cantidad: number;
  /** Lo que costó cada envase, si se sabe */
  costoUnitarioCentavos: number | null;
  origen: OrigenDeMovimiento;
  /** «pedido:<id>:<producto>:<presentación>» para las compras de Abasto; si no, el id */
  claveUnica: string;
  fecha: string;
  nota: string | null;
  ventaId?: string | null;
  tandaId?: string | null;
}

export type FormaDeCobro = 'CONTADO' | 'FIADO';

export interface LineaDeVenta {
  articuloId: string;
  cantidad: number;
  precioUnitarioCentavos: number;
  /** El costo de ese momento: la ganancia del mes no cambia si después sube el precio */
  costoUnitarioCentavos: number | null;
}

export interface Venta {
  id: string;
  fecha: string;
  lineas: LineaDeVenta[];
  totalCentavos: number;
  costoCentavos: number;
  forma: FormaDeCobro;
  /** A quién se le fió */
  clienteId: string | null;
  anulada: boolean;
}

export interface ClienteDeFiado extends Editable {
  id: string;
  nombre: string;
  telefono: string | null;
  creadoEn: string;
}

/** El cuaderno de fiado: DEBE suma lo que debe, PAGA lo resta */
export interface MovimientoDeFiado {
  id: string;
  clienteId: string;
  tipo: 'DEBE' | 'PAGA';
  montoCentavos: number;
  ventaId: string | null;
  fecha: string;
  nota: string | null;
}

export interface InsumoDeReceta {
  articuloId: string;
  /** En la unidad de base del insumo (kg, u., L…); si el insumo no la tiene, en envases */
  cantidad: number;
}

export interface Receta extends Editable {
  id: string;
  /** Lo que se hace (un artículo HECHO) */
  articuloId: string;
  nombre: string;
  /** Cuántas unidades salen con estas cantidades: «100 salteñas» */
  rinde: number;
  insumos: InsumoDeReceta[];
}

/** Lo que se hizo: consumió insumos y dio producto */
export interface Tanda {
  id: string;
  recetaId: string;
  articuloId: string;
  planificado: number;
  obtenido: number;
  costoTotalCentavos: number;
  fecha: string;
}

export type CategoriaDeAnotacion = string;

/** Las cuentas de la casa (ingresos y gastos) y los gastos del negocio */
export interface Anotacion {
  id: string;
  tipo: 'INGRESO' | 'GASTO';
  montoCentavos: number;
  categoria: CategoriaDeAnotacion;
  nota: string | null;
  origen: 'MANUAL' | 'ABASTO';
  /** «pedido:<id>» para lo que se gastó en Abasto; si no, el id */
  claveUnica: string;
  fecha: string;
}

/** La compra de cada semana del hogar */
export interface ItemDeLista extends Editable {
  id: string;
  productoId: string;
  presentacion: string;
  cantidad: number;
}

/** Lo que viaja entre el teléfono y el servidor: cualquier subconjunto */
export interface CambiosDeNegocio {
  articulos?: Articulo[];
  movimientos?: Movimiento[];
  ventas?: Venta[];
  clientes?: ClienteDeFiado[];
  fiados?: MovimientoDeFiado[];
  recetas?: Receta[];
  tandas?: Tanda[];
  anotaciones?: Anotacion[];
  lista?: ItemDeLista[];
}

/** Todo lo del cliente */
export type DatosDeNegocio = Required<CambiosDeNegocio>;

export const COLECCIONES = ['articulos', 'movimientos', 'ventas', 'clientes', 'fiados', 'recetas', 'tandas', 'anotaciones', 'lista'] as const;
export type Coleccion = (typeof COLECCIONES)[number];

/** Las que se editan (gana `actualizadoEn`); las demás solo se agregan */
export const EDITABLES: ReadonlySet<Coleccion> = new Set(['articulos', 'clientes', 'recetas', 'lista']);

export const datosVacios = (): DatosDeNegocio => ({ articulos: [], movimientos: [], ventas: [], clientes: [], fiados: [], recetas: [], tandas: [], anotaciones: [], lista: [] });

/** La clave con la que un registro no se repite: la clave única de movimientos y anotaciones; el id en lo demás */
export function claveDe(coleccion: Coleccion, r: { id: string; claveUnica?: string }) {
  return (coleccion === 'movimientos' || coleccion === 'anotaciones') && r.claveUnica ? r.claveUnica : r.id;
}

/**
 * Junta lo que había con lo que llega: lo que solo se agrega entra si su clave no estaba; lo editable reemplaza si es
 * igual o más nuevo. Es la misma regla del teléfono y del servidor.
 */
export function fusionar(datos: DatosDeNegocio, cambios: CambiosDeNegocio): DatosDeNegocio {
  const salida = { ...datos };
  for (const c of COLECCIONES) {
    const llegan = cambios[c] as { id: string; claveUnica?: string; actualizadoEn?: string }[] | undefined;
    if (!llegan?.length) continue;
    const actuales = new Map((datos[c] as { id: string; claveUnica?: string; actualizadoEn?: string }[]).map((r) => [claveDe(c, r), r]));
    for (const r of llegan) {
      const clave = claveDe(c, r);
      const antes = actuales.get(clave);
      if (!antes) actuales.set(clave, r);
      else if (EDITABLES.has(c) && (r.actualizadoEn ?? '') >= (antes.actualizadoEn ?? '')) actuales.set(clave, r);
    }
    (salida as Record<Coleccion, unknown[]>)[c] = [...actuales.values()];
  }
  return salida;
}

/** Cuántos registros trae un cambio (para avisar «se subieron 5 cambios») */
export function cuantosCambios(c: CambiosDeNegocio) {
  return COLECCIONES.reduce((s, k) => s + (c[k]?.length ?? 0), 0);
}
