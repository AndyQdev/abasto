/**
 * Catálogo tal como lo ve la tienda de la sesión. La red privada la decide Catálogo:
 * si el mayorista no la aprobó, `precioUnitario` llega en null y aquí solo se muestra «Pide ser cliente».
 * Nunca se comparan mayoristas ni se ordena por el más barato.
 */
import { bs, nombreDe, type ItemDeCarrito, type Presentacion } from './carrito';

export type EstadoRelacion = 'NINGUNA' | 'SOLICITADA' | 'APROBADA' | 'RECHAZADA';
export type EstadoProducto = 'ACTIVO' | 'PAUSADO' | 'SIN_STOCK' | 'PENDIENTE_DE_REVISION';

export interface Mayorista {
  id: string;
  nombre: string;
  ciudad: string;
  verificado: boolean;
  relacion: EstadoRelacion;
  /** Abasto mismo vendiendo: sus precios los ve cualquier tienda registrada */
  deLaCasa: boolean;
}

export interface Escala {
  presentacion: Presentacion;
  cantidad: number;
  precioUnitario: { centavos: number; texto: string } | null;
}

export interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  rubro: string;
  descripcion: string;
  stock: number;
  estado: EstadoProducto;
  precioVisible: boolean;
  /** BAJO_PEDIDO: se compra cuando entra el pedido; el stock no importa */
  abastecimiento: 'STOCK' | 'BAJO_PEDIDO';
  entregaHoras: number | null;
  mayorista: Mayorista;
  escalas: Escala[];
  /** URL pública de la foto real del producto (la sirve Catálogo). Null mientras no tenga */
  foto?: string | null;
  /** PIL, Fino… */
  marca?: string | null;
  /** La marca es boliviana (verificado en Catálogo) */
  marcaBoliviana?: boolean;
  /** Lo que cuesta una unidad al público en un supermercado, con dónde y cuándo (aaaa-mm-dd) */
  precioEnSuper?: { precio: { centavos: number; texto: string }; donde: string; fecha: string } | null;
}

const CAMPOS_MAYORISTA = 'id nombre ciudad verificado relacion deLaCasa';

export const CONSULTA_CATALOGO = `
  query Catalogo {
    productos {
      id codigo nombre rubro descripcion stock estado precioVisible abastecimiento entregaHoras foto
      marca marcaBoliviana precioEnSuper { precio { centavos texto } donde fecha }
      mayorista { ${CAMPOS_MAYORISTA} }
      escalas { presentacion cantidad precioUnitario { centavos texto } }
    }
    mayoristas { ${CAMPOS_MAYORISTA} }
  }`;

export const PEDIR_SER_CLIENTE = `
  mutation PedirSerCliente($id: ID!) {
    pedirSerCliente(mayoristaId: $id) { estado }
  }`;

export function titulo(presentacion: Presentacion) {
  const nombre = nombreDe(presentacion);
  return nombre[0].toUpperCase() + nombre.slice(1);
}

const TIPOS_DE_NEGOCIO = /^(distribuidora|importadora|comercial|mayorista|tienda)\s+/i;

/** «Distribuidora Los Pozos» → «Los Pozos»; «Mayorista Central» → «Central» */
export function nombreCorto(nombre: string) {
  const corto = nombre.replace(TIPOS_DE_NEGOCIO, '').trim();
  return corto || nombre;
}

/** «Distribuidora Los Pozos» → «LP»; «Comercial 7 Calles» → «7C»; «Mayorista Central» → «MC» */
export function iniciales(nombre: string) {
  const corto = nombreCorto(nombre).split(/\s+/);
  const palabras = corto.length >= 2 ? corto : nombre.split(/\s+/);
  return palabras
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Escalas que se pueden comprar, de la más chica a la más grande */
export function escalasConPrecio(p: Producto) {
  if (!p.precioVisible) return [];
  return p.escalas.filter((e) => e.precioUnitario).sort((a, b) => a.cantidad - b.cantidad);
}

/** La escala con la que se agrega desde una lista: docena si existe, si no la más chica */
export function escalaPorDefecto(p: Producto) {
  const escalas = escalasConPrecio(p);
  return escalas.find((e) => e.presentacion === 'DOCENA') ?? escalas[0] ?? null;
}

/** El precio unitario más bajo, que es el de la escala más grande («desde Bs 18,00 c/u por caja») */
export function precioDesde(p: Producto) {
  const escalas = escalasConPrecio(p);
  return escalas.length ? escalas[escalas.length - 1] : null;
}

/**
 * La primera vista de la app: lo que vende Abasto (vendedor de la casa) con precio, del precio por unidad
 * más bajo al más alto, para que lo barato salte a la vista. Los mayoristas afiliados no entran aquí:
 * en la red privada nunca se ordena por el más barato.
 */
export function preciosDeLaCasa(productos: Producto[]) {
  const unitario = (p: Producto) => precioDesde(p)?.precioUnitario?.centavos ?? Infinity;
  return comprables(productos)
    .filter((p) => p.mayorista.deLaCasa && disponible(p) && precioDesde(p))
    .sort((a, b) => unitario(a) - unitario(b) || a.nombre.localeCompare(b.nombre, 'es'));
}

const CONTENIDO = /\s(\d+(?:[.,]\d+)?\s?(?:kg|g|ml|l|cc|u\.?))$/i;

/** «Aceite Fino 900 ml» → «Aceite Fino» y «900 ml»; «Papel higiénico Elite · 4 rollos» → «Papel higiénico Elite» y «4 rollos» */
export function separarContenido(nombre: string): { nombre: string; contenido: string | null } {
  const [antes, ...despues] = nombre.split(' · ');
  if (despues.length) return { nombre: antes.trim(), contenido: despues.join(' · ').trim() };
  const m = nombre.match(CONTENIDO);
  return m ? { nombre: nombre.slice(0, m.index).trim(), contenido: m[1] } : { nombre, contenido: null };
}

export interface OpcionDeCompra {
  presentacion: Presentacion;
  nombre: string;
  unidades: number;
  precioUnitario: string;
  total: string;
  totalCentavos: number;
  /** «Precio base» o «Ahorras 9 %» respecto de la escala más chica */
  ahorro: string;
  ahorra: boolean;
}

export function opcionesDeCompra(p: Producto): OpcionDeCompra[] {
  const escalas = escalasConPrecio(p);
  const base = escalas[0]?.precioUnitario?.centavos ?? 0;
  return escalas.map((e) => {
    const unitario = e.precioUnitario!.centavos;
    const porcentaje = base ? Math.round(((base - unitario) / base) * 100) : 0;
    return {
      presentacion: e.presentacion,
      nombre: e.presentacion === 'CAJA' ? `Caja ${e.cantidad}` : titulo(e.presentacion),
      unidades: e.cantidad,
      precioUnitario: e.precioUnitario!.texto,
      total: bs(unitario * e.cantidad),
      totalCentavos: unitario * e.cantidad,
      ahorro: porcentaje > 0 ? `Ahorras ${porcentaje} %` : 'Precio base',
      ahorra: porcentaje > 0,
    };
  });
}

/** Se puede comprar ya: bajo pedido siempre (se compra cuando entra el pedido); con stock, si queda */
export function disponible(p: Pick<Producto, 'stock' | 'estado' | 'abastecimiento'>) {
  if (p.estado !== 'ACTIVO') return false;
  return p.abastecimiento === 'BAJO_PEDIDO' || p.stock > 0;
}

export function textoDeStock(p: Pick<Producto, 'stock' | 'estado' | 'abastecimiento' | 'entregaHoras'>) {
  if (p.abastecimiento === 'BAJO_PEDIDO' && p.estado === 'ACTIVO') return { texto: `Llega en ${p.entregaHoras ?? 24} h`, clase: 'ins-verde' };
  if (p.estado === 'SIN_STOCK' || p.stock <= 0) return { texto: 'Sin stock', clase: 'ins-rojo' };
  if (p.stock < 100) return { texto: `Quedan ${p.stock} u.`, clase: 'ins-ambar' };
  return { texto: 'Hay stock', clase: 'ins-verde' };
}

/** Solo lo que una tienda puede comprar: los pausados o en revisión no aparecen en Mercado */
export function comprables(productos: Producto[]) {
  return productos.filter((p) => p.estado === 'ACTIVO' || p.estado === 'SIN_STOCK');
}

const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export interface Filtro {
  texto?: string;
  rubro?: string | null;
  mayoristaId?: string | null;
}

/** Busca sobre el catálogo guardado, así funciona igual sin señal. Ignora tildes y mayúsculas. */
export function filtrar(productos: Producto[], { texto = '', rubro = null, mayoristaId = null }: Filtro) {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  return comprables(productos).filter((p) => {
    if (rubro && p.rubro !== rubro) return false;
    if (mayoristaId && p.mayorista.id !== mayoristaId) return false;
    const donde = normalizar(`${p.nombre} ${p.rubro} ${p.codigo} ${p.mayorista.nombre}`);
    return palabras.every((w) => donde.includes(w));
  });
}

export function filtrarMayoristas(mayoristas: Mayorista[], texto: string) {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  return mayoristas.filter((m) => palabras.every((w) => normalizar(`${m.nombre} ${m.ciudad}`).includes(w)));
}

/** Rubros presentes en el catálogo, en orden alfabético */
export function rubros(productos: Producto[]) {
  return [...new Set(comprables(productos).map((p) => p.rubro))].sort((a, b) => a.localeCompare(b, 'es'));
}

/** Primero los mayoristas que ya me venden, después el resto; dentro de cada grupo, por nombre */
export function ordenarMayoristas(mayoristas: Mayorista[]) {
  const peso: Record<EstadoRelacion, number> = { APROBADA: 0, SOLICITADA: 1, NINGUNA: 2, RECHAZADA: 3 };
  // Abasto (vendedor de la casa) siempre primero: es el que vende todo mientras no hay afiliados
  return [...mayoristas].sort(
    (a, b) => Number(b.deLaCasa) - Number(a.deLaCasa) || peso[a.relacion] - peso[b.relacion] || a.nombre.localeCompare(b.nombre, 'es'),
  );
}

export function conRelacion<T extends { mayorista: Mayorista }>(lista: T[], mayoristaId: string, relacion: EstadoRelacion): T[] {
  return lista.map((x) => (x.mayorista.id === mayoristaId ? { ...x, mayorista: { ...x.mayorista, relacion } } : x));
}

export function itemDeCarrito(p: Producto, escala: Escala, cantidad = 1): ItemDeCarrito {
  return {
    productoId: p.id,
    nombre: p.nombre,
    mayoristaId: p.mayorista.id,
    mayoristaNombre: p.mayorista.nombre,
    presentacion: escala.presentacion,
    cantidad,
    unidadesPorPresentacion: escala.cantidad,
    precioUnitarioCentavos: escala.precioUnitario?.centavos ?? null,
  };
}

/** Color de fondo de la foto mientras los productos no tengan imagen */
export function tinte(rubro: string) {
  const r = normalizar(rubro);
  if (r.includes('limpieza')) return 'tinte-azul';
  if (r.includes('cosmet')) return 'tinte-rosa';
  if (r.includes('bebida')) return 'tinte-ambar';
  if (r.includes('abarrote')) return 'tinte-ambar';
  return 'tinte-verde';
}

const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'sin', 'por', 'para', 'y', 'en', 'un', 'una', 'bs', 'ml', 'kg', 'gr']);

/** Palabras útiles de lo que se leyó en una etiqueta o un cartel: sin tildes, sin números sueltos ni palabras vacías */
export function palabrasClave(textoLeido: string): string[] {
  const palabras = normalizar(textoLeido)
    .split(/[^a-z0-9ñ]+/)
    .filter((p) => p.length >= 3 && !PALABRAS_VACIAS.has(p) && !/^\d+$/.test(p));
  return [...new Set(palabras)];
}

/**
 * Buscar con una foto: el teléfono lee el texto de la etiqueta (ML Kit, sin internet) y aquí se ordena
 * el catálogo por cuántas de esas palabras coinciden con cada producto. Lo que no coincide en nada no aparece.
 */
export function buscarPorTextoLeido(productos: Producto[], textoLeido: string, maximo = 10): Producto[] {
  const claves = palabrasClave(textoLeido);
  if (!claves.length) return [];
  return comprables(productos)
    .map((p) => {
      const donde = normalizar(`${p.nombre} ${p.rubro}`);
      return { p, puntos: claves.filter((c) => donde.includes(c)).length };
    })
    .filter((x) => x.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos || a.p.nombre.localeCompare(b.p.nombre, 'es'))
    .slice(0, maximo)
    .map((x) => x.p);
}
