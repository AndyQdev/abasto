/**
 * De lo que la persona pidió con palabras a productos reales del catálogo, con su presentación y cuántas.
 * Todo es cálculo verificable: el modelo de lenguaje nunca elige el producto ni el precio, solo dice «aceite, 3 cajas».
 */
import {
  comprables,
  escalaPorDefecto,
  escalasConPrecio,
  medidaDeContenido,
  separarContenido,
  type Escala,
  type Medida,
  type Presentacion,
  type Producto,
} from '@abasto/comercio';
import type { ItemPedido, Unidad } from './intencion';

export type Certeza =
  /** El producto y la presentación salen tal cual de lo pedido */
  | 'exacta'
  /** Hubo que convertir o elegir la presentación: se explica en la nota */
  | 'aproximada'
  /** No hay nada parecido en el catálogo */
  | 'sin_producto';

export interface LineaPropuesta {
  pedido: ItemPedido;
  producto: Producto | null;
  escala: Escala | null;
  /** Cuántas de la presentación elegida (cajas, fardos, unidades…) */
  cantidad: number;
  certeza: Certeza;
  /** Por qué se eligió así, en palabras: «Pediste 25 kg y el quintal trae 46 kg: con 1 alcanza» */
  nota: string;
  /** Otros productos que también podrían ser, para que la persona elija */
  alternativas: Producto[];
}

const PRESENTACION_DE_ENVASE: Record<string, Presentacion> = {
  caja: 'CAJA',
  fardo: 'FARDO',
  docena: 'DOCENA',
  unidad: 'UNIDAD',
  cuarta: 'CUARTA',
};

const NO_CUENTAN = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'para', 'con', 'sin', 'un', 'una', 'y']);

export const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** «huevos» y «huevo», «panes» y «pan» cuentan igual */
const raiz = (palabra: string) => palabra.replace(/(es|s)$/, '');

function palabras(texto: string) {
  return normalizar(texto)
    .split(' ')
    .filter((p) => p.length > 1 && !NO_CUENTAN.has(p))
    .map(raiz);
}

/** Qué tanto se parece el nombre pedido a un producto: palabras en común, el nombre pesa más que el rubro. */
export function parecidoDeNombre(pedido: string, p: Pick<Producto, 'nombre' | 'rubro'>): number {
  const buscadas = palabras(pedido);
  if (!buscadas.length) return 0;
  const enNombre = new Set(palabras(p.nombre));
  const enRubro = new Set(palabras(p.rubro));
  let puntos = 0;
  for (const b of buscadas) {
    if (enNombre.has(b)) puntos += 2;
    else if ([...enNombre].some((n) => n.startsWith(b) || b.startsWith(n))) puntos += 1.5;
    else if (enRubro.has(b)) puntos += 0.5;
  }
  return puntos / (2 * buscadas.length);
}

/** Los productos que se pueden comprar, del más parecido al menos. Mínimo la mitad de lo pedido tiene que coincidir. */
export function candidatos(pedido: string, productos: Producto[], minimo = 0.5): Producto[] {
  return comprables(productos)
    .map((p) => ({ p, puntos: parecidoDeNombre(pedido, p) }))
    .filter((x) => x.puntos >= minimo)
    .sort((a, b) => b.puntos - a.puntos || a.p.nombre.length - b.p.nombre.length)
    .map((x) => x.p);
}

const BASE: Record<Unidad, { unidad: 'kg' | 'L' | 'u.'; factor: number }> = {
  kg: { unidad: 'kg', factor: 1 },
  g: { unidad: 'kg', factor: 0.001 },
  L: { unidad: 'L', factor: 1 },
  ml: { unidad: 'L', factor: 0.001 },
  'u.': { unidad: 'u.', factor: 1 },
};

/** Lo que trae una unidad del producto, en kg, L o u.; null si no se sabe */
export function contenidoDe(p: Producto): { cantidad: number; unidad: 'kg' | 'L' | 'u.'; medida: Medida } | null {
  const medida = medidaDeContenido(separarContenido(p.nombre).contenido);
  if (medida.porEnvase === null) return null;
  const unidad = medida.unidad === 'g' || medida.unidad === 'kg' ? 'kg' : medida.unidad === 'ml' || medida.unidad === 'L' ? 'L' : 'u.';
  const factor = medida.unidad === 'g' || medida.unidad === 'ml' ? 0.001 : 1;
  return { cantidad: medida.porEnvase * factor, unidad, medida };
}

const numero = (n: number) => new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 }).format(n);

/** La escala más chica con precio (la que deja comprar lo justo) */
const escalaMasChica = (p: Producto) => escalasConPrecio(p)[0] ?? null;

/** Una línea del pedido contra el catálogo. */
export function catalogarItem(pedido: ItemPedido, productos: Producto[]): LineaPropuesta {
  const [producto, ...resto] = candidatos(pedido.nombre, productos);
  const alternativas = resto.slice(0, 3);
  const cantidad = pedido.cantidad ?? 1;
  if (!producto) {
    return { pedido, producto: null, escala: null, cantidad: 0, certeza: 'sin_producto', nota: `No tenemos «${pedido.nombre}» en el catálogo`, alternativas: [] };
  }
  const base = { pedido, producto, alternativas };

  // «3 cajas», «2 fardos», «5 docenas»: presentación de venta tal cual
  const presentacion = pedido.envase ? PRESENTACION_DE_ENVASE[pedido.envase] : undefined;
  if (presentacion) {
    const escala = escalasConPrecio(producto).find((e) => e.presentacion === presentacion);
    if (escala) return { ...base, escala, cantidad, certeza: 'exacta', nota: '' };
  }

  // «2 quintales», «1 arroba», «3 maples»: el envase es el producto mismo (Harina · quintal 46 kg)
  const contenido = contenidoDe(producto);
  if (pedido.envase && contenido?.medida.envase === pedido.envase) {
    const escala = escalaMasChica(producto);
    if (escala) return { ...base, escala, cantidad: Math.ceil(cantidad / escala.cantidad), certeza: 'exacta', nota: '' };
  }

  // «25 kg de harina», «3 L de aceite»: se convierte a unidades del producto y se redondea hacia arriba
  if (pedido.unidad && contenido && BASE[pedido.unidad].unidad === contenido.unidad) {
    const escala = escalaMasChica(producto);
    if (escala) {
      const pedidoEnBase = cantidad * BASE[pedido.unidad].factor;
      const unidadesDelProducto = Math.ceil(pedidoEnBase / contenido.cantidad - 1e-9);
      const envases = Math.ceil(unidadesDelProducto / escala.cantidad);
      const trae = envases * escala.cantidad * contenido.cantidad;
      return {
        ...base,
        escala,
        cantidad: envases,
        certeza: 'aproximada',
        nota: `Pediste ${numero(cantidad)} ${pedido.unidad}: con esto llevas ${numero(trae)} ${contenido.unidad}`,
      };
    }
  }

  const escala = escalaPorDefecto(producto);
  if (!escala) return { ...base, escala: null, cantidad: 0, certeza: 'sin_producto', nota: `«${producto.nombre}» todavía no tiene precio para ti` };
  const dijo = pedido.envase ?? (pedido.unidad ? `${pedido.unidad}` : null);
  return {
    ...base,
    escala,
    cantidad,
    certeza: dijo || pedido.cantidad === null ? 'aproximada' : 'exacta',
    nota: dijo ? `No se vende por ${dijo}: va por ${escala.presentacion.toLowerCase()}` : pedido.cantidad === null ? 'No dijiste cuánto: va 1' : '',
  };
}

export function catalogar(items: ItemPedido[], productos: Producto[]): LineaPropuesta[] {
  return items.map((i) => catalogarItem(i, productos));
}
