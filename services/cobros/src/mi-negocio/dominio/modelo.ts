/**
 * «Mi negocio» del cliente (docs/plan-mi-negocio.md). Es el mismo contrato que packages/comercio/src/mi-negocio/
 * modelo.ts (el teléfono): los nombres de los campos son idénticos para que la sincronización sea un copiar y pegar.
 * El servidor es la fuente de la verdad; el teléfono guarda una copia para andar sin señal.
 *
 * Dos clases de registros:
 * - Se agregan y nunca se editan (movimientos, ventas, fiados, tandas y anotaciones): llevan un id o una clave única.
 *   Recibirlos dos veces no los duplica.
 * - Se editan (artículos, clientes, recetas y lista): llevan `actualizadoEn` y gana el más nuevo. Borrar es marcar
 *   `eliminado`.
 */
export interface Medida {
  envase: string;
  porEnvase: number | null;
  unidad: string;
}

export interface Articulo {
  id: string;
  nombre: string;
  detalle: string | null;
  rubro: string | null;
  medida: Medida;
  clase: 'COMPRADO' | 'HECHO';
  origen: 'ABASTO' | 'OTRO_PROVEEDOR';
  productoId: string | null;
  proveedor: string | null;
  precioVentaCentavos: number | null;
  stockMinimo: number | null;
  creadoEn: string;
  actualizadoEn: string;
  eliminado: boolean;
}

export const TIPOS_DE_MOVIMIENTO = ['ENTRADA', 'SALIDA', 'AJUSTE', 'CONSUMO', 'PRODUCCION', 'VENTA', 'MERMA'] as const;
export const ORIGENES_DE_MOVIMIENTO = ['ABASTO', 'OTRO_PROVEEDOR', 'MANUAL', 'VENTA', 'TANDA'] as const;

export interface Movimiento {
  id: string;
  articuloId: string;
  tipo: (typeof TIPOS_DE_MOVIMIENTO)[number];
  cantidad: number;
  costoUnitarioCentavos: number | null;
  origen: (typeof ORIGENES_DE_MOVIMIENTO)[number];
  claveUnica: string;
  fecha: string;
  nota: string | null;
  ventaId?: string | null;
  tandaId?: string | null;
}

export interface LineaDeVenta {
  articuloId: string;
  cantidad: number;
  precioUnitarioCentavos: number;
  costoUnitarioCentavos: number | null;
}

export interface Venta {
  id: string;
  fecha: string;
  lineas: LineaDeVenta[];
  totalCentavos: number;
  costoCentavos: number;
  forma: 'CONTADO' | 'FIADO';
  clienteId: string | null;
  anulada: boolean;
}

export interface ClienteDeFiado {
  id: string;
  nombre: string;
  telefono: string | null;
  creadoEn: string;
  actualizadoEn: string;
  eliminado: boolean;
}

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
  cantidad: number;
}

export interface Receta {
  id: string;
  articuloId: string;
  nombre: string;
  rinde: number;
  /** Lo que lleva y no se compra, como el agua. Un teléfono con la app vieja no lo manda */
  notas?: string | null;
  insumos: InsumoDeReceta[];
  actualizadoEn: string;
  eliminado: boolean;
}

export interface Tanda {
  id: string;
  recetaId: string;
  articuloId: string;
  planificado: number;
  obtenido: number;
  costoTotalCentavos: number;
  fecha: string;
}

export interface Anotacion {
  id: string;
  tipo: 'INGRESO' | 'GASTO';
  montoCentavos: number;
  categoria: string;
  nota: string | null;
  origen: 'MANUAL' | 'ABASTO';
  claveUnica: string;
  fecha: string;
}

export interface ItemDeLista {
  id: string;
  productoId: string;
  presentacion: string;
  cantidad: number;
  actualizadoEn: string;
  eliminado: boolean;
}

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

export type DatosDeNegocio = Required<CambiosDeNegocio>;

export const COLECCIONES = ['articulos', 'movimientos', 'ventas', 'clientes', 'fiados', 'recetas', 'tandas', 'anotaciones', 'lista'] as const;
export type Coleccion = (typeof COLECCIONES)[number];

/** Las que se editan (gana `actualizadoEn`); las demás solo se agregan */
export const EDITABLES: ReadonlySet<Coleccion> = new Set(['articulos', 'clientes', 'recetas', 'lista']);

export const datosVacios = (): DatosDeNegocio => ({ articulos: [], movimientos: [], ventas: [], clientes: [], fiados: [], recetas: [], tandas: [], anotaciones: [], lista: [] });

export const cuantos = (c: CambiosDeNegocio) => COLECCIONES.reduce((s, k) => s + (c[k]?.length ?? 0), 0);
