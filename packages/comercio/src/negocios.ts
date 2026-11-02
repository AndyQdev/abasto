/**
 * El Inicio según el tipo de cliente. Desde el 01/11 (pedido de Andrés, plan en `docs/plan-mi-negocio.md`) son tres:
 * - **hogar**: la familia que compra al por mayor para su casa,
 * - **tienda**: abarrotes que compra para revender,
 * - **productor**: compra insumos y vende algo hecho, en una de 6 áreas (02/11): salteñería, panadería, horneados,
 *   pensión, pollería o puesto de comida.
 * Se elige al registrarse (obligatorio) y se cambia en Cuenta. La promesa es «no vuelvas a ir al mercado».
 *
 * Qué ve cada uno lo decide `Producto.usos` (02/11): Abasto marca en el Panel a quién se le muestra cada producto
 * (hogar, tienda o un área del productor). Un panadero no ve yogurt. Buscar sí encuentra todo. Solo entra lo que vende
 * Abasto. El productor ve primero «Para tu receta de…» (los insumos de sus recetas) y «Lo que más se pide en tu rubro»
 * (lo que llevan las plantillas de su área).
 */
import { bs, type ItemDeCarrito } from './carrito';
import { escalaPorDefecto, escalasConPrecio, itemDeCarrito, preciosDeLaCasa, rubros, type Producto } from './catalogo';
import type { Pedido } from './pedidos';
import { PLANTILLAS } from './mi-negocio/plantillas';
import type { DatosDeNegocio } from './mi-negocio/modelo';
import { vitrinas, type ClaveDeVitrina, type TarjetaDeVitrina, type Vitrina } from './vitrinas';

export type TipoDeNegocio = 'hogar' | 'tienda' | 'productor';
/** Las 6 áreas del productor (02/11). Salteñería, panadería y pensión vienen de antes y conservan su clave */
export type SubtipoProductor = 'salteneria' | 'panaderia' | 'horneados' | 'pension' | 'polleria' | 'puesto';

/** Lo que eligió el cliente: el tipo y, si es productor, qué hace */
export interface NegocioElegido {
  tipo: TipoDeNegocio;
  subtipo?: SubtipoProductor;
}

/** Cómo se presenta cada tipo en el registro y en Cuenta */
export interface TipoDeCliente {
  tipo: TipoDeNegocio;
  nombre: string;
  /** Para el chip de Cuenta */
  corto: string;
  ejemplo: string;
  /** La frase de lo que gana, en el registro */
  gana: string;
  /** El nombre de su pestaña («Mi casa»…), que llega en la Fase 2 */
  pestana: string;
}

export const TIPOS: Record<TipoDeNegocio, TipoDeCliente> = {
  hogar: {
    tipo: 'hogar',
    nombre: 'Mi hogar',
    corto: 'Hogar',
    ejemplo: 'Compro al por mayor para mi familia',
    gana: 'Ahorra en la compra del mes y lleva la cuenta de tu casa',
    pestana: 'Mi casa',
  },
  tienda: {
    tipo: 'tienda',
    nombre: 'Tienda de abarrotes',
    corto: 'Tienda',
    ejemplo: 'Tienda de barrio, minimarket',
    gana: 'Repón sin ir al mercado y mira cuánto ganas',
    pestana: 'Mi tienda',
  },
  productor: {
    tipo: 'productor',
    nombre: 'Productor',
    corto: 'Productor',
    ejemplo: 'Salteñería, panadería, pensión…',
    gana: 'Compra tus insumos y sabe cuánto te cuesta cada unidad',
    pestana: 'Mi producción',
  },
};

export const TIPOS_DE_NEGOCIO: TipoDeNegocio[] = ['hogar', 'tienda', 'productor'];

export const SUBTIPOS: Record<SubtipoProductor, { nombre: string; corto: string; ejemplo: string }> = {
  salteneria: { nombre: 'Salteñería y empanadas', corto: 'Salteñería', ejemplo: 'Salteñas, empanadas de queso' },
  panaderia: { nombre: 'Panadería y pastelería', corto: 'Panadería', ejemplo: 'Pan batido, queques' },
  horneados: { nombre: 'Horneados cruceños', corto: 'Horneados', ejemplo: 'Cuñapé, sonso, masaco' },
  pension: { nombre: 'Pensión y restaurante', corto: 'Pensión', ejemplo: 'Majadito, sopa de maní, locro' },
  polleria: { nombre: 'Pollería y comida rápida', corto: 'Pollería', ejemplo: 'Pollo frito, hamburguesas' },
  puesto: { nombre: 'Puesto de comida', corto: 'Puesto', ejemplo: 'Anticucho, asadito, pacumuto' },
};

export const SUBTIPOS_DE_PRODUCTOR: SubtipoProductor[] = ['salteneria', 'panaderia', 'horneados', 'pension', 'polleria', 'puesto'];

export interface Seccion {
  clave: ClaveDeVitrina;
  titulo: string;
  subtitulo: string;
  /** Palabras del nombre del producto, en el orden en que se muestran */
  palabras: string[];
}

/** Lo que cambia el Inicio: sale del tipo y, para el productor, del subtipo */
interface Perfil {
  /** Los rubros en el orden en que los busca. Los demás no se le muestran */
  rubros: string[];
  secciones: Seccion[];
  /** Las vitrinas de siempre que le sirven, en ese orden */
  vitrinas: ClaveDeVitrina[];
  /** El subtítulo de «También te puede servir»: lo demás de sus rubros que no salió en sus secciones */
  sugeridos: string;
  /** La familia compra el kilo o la arroba antes que el quintal; el negocio, al revés */
  primeroLoChico?: boolean;
  /** Solo el productor: el subtítulo de «Lo que más se pide en tu rubro» */
  rubro?: string;
}

type ClaveDePerfil = 'hogar' | 'tienda' | SubtipoProductor;

/** El orden en que busca el que cocina; los rubros que no tienen productos para su área no se muestran */
const COCINA = [
  'Harinas y panificación',
  'Aceites y grasas',
  'Huevos y lácteos',
  'Carnes',
  'Verduras y tubérculos',
  'Granos y cereales',
  'Condimentos',
  'Conservas y desayuno',
  'Descartables',
  'Limpieza del hogar',
  'Varios',
];

const PARA_LLEVAR: Seccion = {
  clave: 'descartables',
  titulo: 'Para llevar',
  subtitulo: 'Envases, bolsas y servilletas por paquete',
  palabras: ['envase', 'bolsa', 'servilleta', 'vaso', 'caja', 'cuchara'],
};

const productor = (sugeridos: string, rubro: string, secciones: Seccion[] = []): Perfil => ({ rubros: COCINA, secciones, vitrinas: ['volumen'], sugeridos, rubro });

const PERFILES: Record<ClaveDePerfil, Perfil> = {
  hogar: {
    rubros: ['Granos y cereales', 'Aceites y grasas', 'Huevos y lácteos', 'Harinas y panificación', 'Verduras y tubérculos', 'Carnes', 'Conservas y desayuno', 'Limpieza del hogar', 'Higiene y cuidado personal', 'Bebidas', 'Galletas y dulces', 'Condimentos', 'Varios'],
    secciones: [
      {
        clave: 'despensa',
        titulo: 'La despensa del mes',
        subtitulo: 'Lo básico de la casa, al por mayor',
        palabras: ['arroz', 'aceite', 'azucar', 'fideo', 'leche', 'huevo', 'papa', 'cebolla', 'harina', 'sal'],
      },
      {
        clave: 'casa',
        titulo: 'Limpieza de la casa',
        subtitulo: 'Para todo el mes, sin cargar bolsas',
        palabras: ['detergente', 'lavandina', 'limpia', 'papel', 'jabon', 'pasta', 'shampoo'],
      },
    ],
    // A la familia sí le sirve compararse con el súper: ahí compra hoy
    vitrinas: ['super', 'volumen', 'probar'],
    sugeridos: 'Más para la casa',
    primeroLoChico: true,
  },
  tienda: {
    rubros: ['Granos y cereales', 'Aceites y grasas', 'Harinas y panificación', 'Bebidas', 'Huevos y lácteos', 'Galletas y dulces', 'Conservas y desayuno', 'Limpieza del hogar', 'Higiene y cuidado personal', 'Condimentos', 'Descartables', 'Varios'],
    secciones: [
      {
        clave: 'repone',
        titulo: 'Lo que más se repone en tu tienda',
        subtitulo: 'Lo que sale todos los días, listo para pedir',
        palabras: ['arroz', 'azucar', 'aceite', 'fideo', 'leche', 'huevo', 'coca-cola', 'papel', 'harina', 'sal', 'agua'],
      },
    ],
    vitrinas: ['reventa', 'volumen', 'deAqui'],
    sugeridos: 'Más para los estantes de tu tienda',
  },
  salteneria: productor('Más cosas que se usan en una salteñería', 'Masa y jigote: lo que lleva una salteñería'),
  panaderia: productor('Más cosas que se usan en una panadería', 'Harina por arroba y quintal, y lo que va en la masa'),
  horneados: productor('Más cosas que se usan en los horneados', 'Almidón, queso y lo que va al horno'),
  pension: productor('Más para la cocina de tu negocio', 'El almuerzo de toda la semana, por arroba y por kilo', [PARA_LLEVAR]),
  polleria: productor('Más para la cocina de tu negocio', 'Pollo, aceite y papa para toda la semana', [PARA_LLEVAR]),
  puesto: productor('Más para la cocina de tu negocio', 'Lo de cada noche, por arroba y por kilo', [PARA_LLEVAR]),
};

function perfil(n: NegocioElegido): Perfil {
  return PERFILES[n.tipo === 'productor' ? (n.subtipo ?? 'salteneria') : n.tipo];
}

export function esTipoDeNegocio(valor: unknown): valor is TipoDeNegocio {
  return typeof valor === 'string' && (TIPOS_DE_NEGOCIO as string[]).includes(valor);
}

export function esSubtipoProductor(valor: unknown): valor is SubtipoProductor {
  return typeof valor === 'string' && (SUBTIPOS_DE_PRODUCTOR as string[]).includes(valor);
}

/** Si el cliente ya terminó de elegir: el productor tiene que decir qué hace */
export function negocioCompleto(n: Partial<NegocioElegido> | null): n is NegocioElegido {
  if (!n || !esTipoDeNegocio(n.tipo)) return false;
  return n.tipo !== 'productor' || esSubtipoProductor(n.subtipo);
}

/**
 * Lo guardado en el teléfono. Traduce lo de antes del 01/11 (un texto: «tienda», «masas» o «cocina») y descarta lo
 * que no sirve, para que el registro vuelva a preguntar.
 */
export function leerNegocio(guardado: unknown): NegocioElegido | null {
  if (guardado === 'tienda' || guardado === 'hogar') return { tipo: guardado };
  if (guardado === 'masas') return { tipo: 'productor', subtipo: 'salteneria' };
  if (guardado === 'cocina') return { tipo: 'productor', subtipo: 'pension' };
  if (guardado && typeof guardado === 'object') {
    const { tipo, subtipo } = guardado as Partial<NegocioElegido>;
    const n = tipo === 'productor' ? { tipo, subtipo } : { tipo };
    if (negocioCompleto(n)) return n;
  }
  return null;
}

/** El nombre corto para mostrar: «Hogar», «Tienda» o el subtipo del productor («Salteñería») */
export function nombreDelNegocio(n: NegocioElegido) {
  return n.tipo === 'productor' && n.subtipo ? SUBTIPOS[n.subtipo].corto : TIPOS[n.tipo].corto;
}

const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** La palabra entera, también en plural: «bolsa» encuentra «Bolsas», pero «sal» no encuentra «Salsa» */
function tienePalabra(nombre: string, palabra: string) {
  return normalizar(nombre)
    .split(/[\s·,()]+/)
    .some((w) => w === palabra || w === `${palabra}s` || w === `${palabra}es`);
}

/** A qué uso de `Producto.usos` corresponde: «hogar», «tienda» o el área del productor */
export function usoDelNegocio(n: NegocioElegido): string {
  return n.tipo === 'productor' ? (n.subtipo ?? 'salteneria') : n.tipo;
}

/** Si el producto se le muestra a este cliente en el Inicio (Abasto lo decide en el Panel) */
export function esParaSuNegocio(n: NegocioElegido, p: Pick<Producto, 'usos'>) {
  return (p.usos ?? []).includes(usoDelNegocio(n));
}

/** Los rubros que se le muestran a este cliente, en su orden, y solo los que tienen productos para él */
export function rubrosDelNegocio(n: NegocioElegido, productos: Producto[]) {
  const orden = perfil(n).rubros;
  const hay = new Set(rubros(productos.filter((p) => esParaSuNegocio(n, p))));
  const posicion = (r: string) => (orden.includes(r) ? orden.indexOf(r) : orden.length);
  return [...hay].sort((a, b) => posicion(a) - posicion(b) || a.localeCompare(b, 'es'));
}

/** «Por confirmar» (el precio) manda: es de demostración y el cliente tiene que saberlo antes de pedir */
function tarjeta(p: Producto): TarjetaDeVitrina | null {
  const escala = escalaPorDefecto(p);
  if (!escala?.precioUnitario) return null;
  return {
    producto: p,
    precio: escala.precioUnitario.texto,
    detalle: escala.cantidad === 1 ? 'c/u' : `c/u llevando ${escala.cantidad}`,
    gancho: p.precioPorConfirmar ? 'Por confirmar' : (p.marca ?? p.rubro),
    tachado: null,
  };
}

/** Lo que lleva lo que hace el productor: los productos de Abasto de sus recetas, para «Para tu receta de…» */
export interface MisRecetas {
  /** «salteña de carne» (si es una sola) */
  nombres: string[];
  productoIds: string[];
}

export function misRecetas(datos: Pick<DatosDeNegocio, 'recetas' | 'articulos'>): MisRecetas {
  const recetas = datos.recetas.filter((r) => !r.eliminado);
  const articulos = new Map(datos.articulos.map((a) => [a.id, a]));
  const ids = recetas.flatMap((r) => r.insumos.map((i) => articulos.get(i.articuloId)?.productoId)).filter((id): id is string => !!id);
  return { nombres: recetas.map((r) => r.nombre), productoIds: [...new Set(ids)] };
}

/** Cuántas plantillas del área usan el producto: lo que «más se pide en el rubro» (salteña de carne, de pollo…) */
function pesoEnElArea(area: string) {
  const peso = new Map<string, number>();
  for (const p of PLANTILLAS.filter((x) => x.area === area)) {
    const usados = new Set(p.grupos.flatMap((g) => g.insumos.flatMap((i) => i.codigos)));
    for (const c of usados) peso.set(c, (peso.get(c) ?? 0) + 1);
  }
  return peso;
}

const enMinuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/**
 * Las secciones del Inicio de este cliente, solo con lo que es para él (`usos`):
 * - productor: «Para tu receta de…» (sus insumos, si ya tiene recetas), «Lo que más se pide en tu rubro», «Para
 *   llevar» (pensión, pollería, puesto);
 * - tienda y hogar: las suyas («Lo que más se repone…», «La despensa del mes», «Limpieza de la casa»);
 * después «También te puede servir» (lo demás que es para él) y al final las vitrinas de siempre que le sirven.
 */
export function seccionesDelNegocio(n: NegocioElegido, productos: Producto[], maximo = 10, recetas?: MisRecetas): Vitrina[] {
  const p = perfil(n);
  const casa = preciosDeLaCasa(productos);
  const suyos = casa.filter((x) => esParaSuNegocio(n, x));
  const aVitrina = (clave: ClaveDeVitrina, titulo: string, subtitulo: string, lista: Producto[]): Vitrina => ({
    clave,
    titulo,
    subtitulo,
    tarjetas: lista
      .map(tarjeta)
      .filter((t): t is TarjetaDeVitrina => t !== null)
      .slice(0, maximo),
  });

  const propias: Vitrina[] = [];
  if (n.tipo === 'productor') {
    if (recetas?.productoIds.length) {
      // Lo de sus recetas va aunque Abasto no lo haya marcado para su área: es lo que él usa
      const deSusRecetas = recetas.productoIds.map((id) => casa.find((x) => x.id === id)).filter((x): x is Producto => !!x);
      const titulo = recetas.nombres.length === 1 ? `Para tu receta de ${enMinuscula(recetas.nombres[0])}` : 'Para tus recetas';
      propias.push(aVitrina('receta', titulo, 'Lo que lleva, listo para pedir', deSusRecetas));
    }
    const peso = pesoEnElArea(usoDelNegocio(n));
    const masPedidos = suyos.filter((x) => peso.has(x.id)).sort((a, b) => peso.get(b.id)! - peso.get(a.id)! || precioDeLaChica(b) - precioDeLaChica(a));
    propias.push(aVitrina('rubro', 'Lo que más se pide en tu rubro', p.rubro ?? '', masPedidos));
  }
  for (const s of p.secciones) {
    const elegidos: Producto[] = [];
    for (const palabra of s.palabras) {
      // Dentro de cada palabra, primero la presentación más grande (el quintal antes que el kilo); en la casa, al revés
      const conPalabra = suyos
        .filter((x) => !elegidos.includes(x) && tienePalabra(x.nombre, palabra))
        .sort((a, b) => (p.primeroLoChico ? -1 : 1) * (precioDeLaChica(b) - precioDeLaChica(a)));
      elegidos.push(...conPalabra);
    }
    propias.push(aVitrina(s.clave, s.titulo, s.subtitulo, elegidos));
  }

  const yaSalieron = new Set(propias.flatMap((v) => v.tarjetas.map((t) => t.producto.id)));
  const posicion = (r: string) => (p.rubros.includes(r) ? p.rubros.indexOf(r) : p.rubros.length);
  const otros = suyos.filter((x) => !yaSalieron.has(x.id)).sort((a, b) => posicion(a.rubro) - posicion(b.rubro));
  const sugeridos = aVitrina('sugeridos', 'También te puede servir', p.sugeridos, otros);
  const deSiempre = vitrinas(suyos, maximo)
    .filter((v) => p.vitrinas.includes(v.clave))
    .sort((a, b) => p.vitrinas.indexOf(a.clave) - p.vitrinas.indexOf(b.clave));
  return [...propias, sugeridos].filter((v) => v.tarjetas.length > 0).concat(deSiempre);
}

function precioDeLaChica(p: Producto) {
  const chica = escalasConPrecio(p)[0];
  return chica?.precioUnitario ? chica.precioUnitario.centavos * chica.cantidad : 0;
}

export interface PedidoDeLaSemana {
  codigo: string;
  creadoEn: string;
  /** Lo que se puede volver a pedir hoy, con el precio de hoy */
  items: ItemDeCarrito[];
  /** Lo que ya no se vende (o cambió de presentación): no se agrega */
  faltan: string[];
  totalTexto: string;
}

const NO_CUENTAN = new Set(['RECHAZADO', 'CANCELADO']);

/**
 * «Tu pedido de la semana»: el último pedido que salió bien, listo para repetir de un toque. Se arma con el catálogo
 * de hoy (precio y presentación vigentes); lo que ya no está se avisa en vez de agregarse a ciegas.
 */
export function pedidoDeLaSemana(pedidos: Pick<Pedido, 'codigo' | 'estado' | 'creadoEn' | 'lineas'>[], productos: Producto[]): PedidoDeLaSemana | null {
  const ultimo = [...pedidos].filter((p) => !NO_CUENTAN.has(p.estado) && p.lineas.length).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))[0];
  if (!ultimo) return null;
  const items: ItemDeCarrito[] = [];
  const faltan: string[] = [];
  for (const l of ultimo.lineas) {
    const p = productos.find((x) => x.id === l.producto.id && (x.estado === 'ACTIVO' || x.estado === 'SIN_STOCK'));
    const escala = p && escalasConPrecio(p).find((e) => e.presentacion === l.presentacion);
    if (p && escala) items.push(itemDeCarrito(p, escala, l.cantidad));
    else faltan.push(l.producto.nombre ?? l.producto.id);
  }
  if (!items.length) return null;
  const total = items.reduce((s, i) => s + (i.precioUnitarioCentavos ?? 0) * i.unidadesPorPresentacion * i.cantidad, 0);
  return { codigo: ultimo.codigo, creadoEn: ultimo.creadoEn, items, faltan, totalTexto: bs(total) };
}
