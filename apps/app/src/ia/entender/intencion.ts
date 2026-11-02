/**
 * Lo que la IA entiende de lo que pide la persona. Es el contrato entre quien interpreta (el modelo de lenguaje
 * o las reglas) y el código que busca en el catálogo y calcula: el modelo nunca da precios ni productos, solo
 * lo que se pidió con palabras; los productos, presentaciones y cantidades los decide el código.
 */

/** Unidades que se pueden calcular. Los envases («caja», «fardo», «quintal») van aparte, en `envase`. */
export type Unidad = 'kg' | 'g' | 'L' | 'ml' | 'u.';

export interface ItemPedido {
  /** Lo que la persona nombró, limpio: «aceite», «arroz», «leche» */
  nombre: string;
  /** null si no dijo cuánto */
  cantidad: number | null;
  /** Unidad medible, si la dijo: «2 kg de harina» */
  unidad: Unidad | null;
  /** Envase o presentación, si la dijo: «caja», «fardo», «docena», «quintal», «arroba», «maple», «bolsa» */
  envase: string | null;
}

export type TipoDeIntencion =
  /** «Necesito 3 cajas de aceite y 2 fardos de arroz» */
  | 'pedido'
  /** Una receta pegada o pedida («quiero hacer 100 empanadas») */
  | 'receta'
  /** Busca algo sin decir cuánto: «algo para lavar ropa» */
  | 'busqueda';

export interface Intencion {
  tipo: TipoDeIntencion;
  items: ItemPedido[];
  /** Para recetas: qué se quiere preparar («salteñas», «torta de chocolate») */
  preparacion: string | null;
  /** Para recetas: cuántas porciones o unidades se quieren hacer */
  rinde: number | null;
  /** Lo que se supuso y no se dijo: se le muestra a la persona para que lo confirme */
  supuestos: string[];
}

export const intencionVacia = (tipo: TipoDeIntencion = 'busqueda'): Intencion => ({
  tipo,
  items: [],
  preparacion: null,
  rinde: null,
  supuestos: [],
});
