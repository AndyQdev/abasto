/**
 * El Inicio según el negocio del cliente (01/11, nicho nuevo de Abasto): tiendas de barrio y negocios que cocinan
 * (salteñerías, panaderías, pensiones, pollerías). La promesa ya no es «más barato que el súper» sino «no vuelvas a
 * ir al mercado»: cada negocio ve primero sus rubros y unas secciones con lo que usa todas las semanas.
 *
 * Las secciones se arman por palabra del nombre («harina», «manteca»…), no por código: cuando Abasto suma un
 * producto nuevo al catálogo, aparece solo en la sección que le toca. Solo entra lo que vende Abasto.
 */
import { bs, type ItemDeCarrito } from './carrito';
import { escalaPorDefecto, escalasConPrecio, itemDeCarrito, preciosDeLaCasa, rubros, type Producto } from './catalogo';
import type { Pedido } from './pedidos';
import { vitrinas, type ClaveDeVitrina, type TarjetaDeVitrina, type Vitrina } from './vitrinas';

export type TipoDeNegocio = 'tienda' | 'masas' | 'cocina';

export interface Seccion {
  clave: ClaveDeVitrina;
  titulo: string;
  subtitulo: string;
  /** Palabras del nombre del producto, en el orden en que se muestran */
  palabras: string[];
}

export interface Negocio {
  tipo: TipoDeNegocio;
  nombre: string;
  /** Para el chip: «Tienda», «Salteñería», «Pensión» */
  corto: string;
  ejemplo: string;
  /** Los rubros en el orden en que los busca este negocio. Los demás no se le muestran */
  rubros: string[];
  secciones: Seccion[];
  /** Las vitrinas de siempre que le sirven (sin «súper»: dejó de ser la promesa) */
  vitrinas: ClaveDeVitrina[];
}

const COCINA = ['Harinas y panificación', 'Aceites y grasas', 'Granos y cereales', 'Condimentos', 'Huevos y lácteos', 'Verduras secas', 'Descartables'];

export const NEGOCIOS: Record<TipoDeNegocio, Negocio> = {
  tienda: {
    tipo: 'tienda',
    nombre: 'Tienda de abarrotes',
    corto: 'Tienda',
    ejemplo: 'Tienda de barrio, minimarket',
    rubros: ['Granos y cereales', 'Aceites y grasas', 'Harinas y panificación', 'Bebidas', 'Huevos y lácteos', 'Galletas y dulces', 'Limpieza del hogar', 'Higiene y cuidado personal', 'Condimentos', 'Descartables'],
    secciones: [
      {
        clave: 'repone',
        titulo: 'Lo que más se repone en tu tienda',
        subtitulo: 'Lo que sale todos los días, listo para pedir',
        palabras: ['arroz', 'azucar', 'aceite', 'fideo', 'leche', 'huevo', 'coca-cola', 'papel', 'harina', 'sal', 'agua'],
      },
    ],
    vitrinas: ['reventa', 'volumen', 'deAqui'],
  },
  masas: {
    tipo: 'masas',
    nombre: 'Salteñería – panadería',
    corto: 'Salteñería',
    ejemplo: 'Salteñas, empanadas, pan, repostería',
    rubros: COCINA,
    secciones: [
      {
        clave: 'salteneria',
        titulo: 'Para tu salteñería',
        subtitulo: 'Masa y jigote: lo de cada semana',
        palabras: ['harina', 'manteca', 'aji', 'papa', 'huevo', 'azucar', 'aceite', 'cebolla', 'comino', 'pimienta', 'oregano'],
      },
      {
        clave: 'panaderia',
        titulo: 'Para tu panadería',
        subtitulo: 'Harina por quintal y lo que va en la masa',
        palabras: ['harina', 'levadura', 'azucar', 'manteca', 'sal', 'polvo', 'huevo', 'mantequilla'],
      },
    ],
    vitrinas: ['volumen'],
  },
  cocina: {
    tipo: 'cocina',
    nombre: 'Comida – pensión – restaurante',
    corto: 'Pensión',
    ejemplo: 'Pensión, pollería, restaurante, puesto de comida',
    rubros: COCINA,
    secciones: [
      {
        clave: 'pension',
        titulo: 'Para tu pensión',
        subtitulo: 'El almuerzo de toda la semana, por arroba y quintal',
        palabras: ['arroz', 'aceite', 'fideo', 'papa', 'cebolla', 'ajo', 'huevo', 'comino', 'pimienta', 'oregano', 'sal'],
      },
      {
        clave: 'descartables',
        titulo: 'Para llevar',
        subtitulo: 'Envases, bolsas y servilletas por paquete',
        palabras: ['envase', 'bolsa', 'servilleta', 'vaso'],
      },
    ],
    vitrinas: ['volumen'],
  },
};

export const TIPOS_DE_NEGOCIO: TipoDeNegocio[] = ['tienda', 'masas', 'cocina'];

export function esTipoDeNegocio(valor: unknown): valor is TipoDeNegocio {
  return typeof valor === 'string' && (TIPOS_DE_NEGOCIO as string[]).includes(valor);
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

/** Los rubros que se le muestran a este negocio, en su orden, y solo los que tienen productos */
export function rubrosDelNegocio(tipo: TipoDeNegocio, productos: Producto[]) {
  const hay = new Set(rubros(productos));
  return NEGOCIOS[tipo].rubros.filter((r) => hay.has(r));
}

/** «Por confirmar» (el precio) manda: es de demostración y la tienda tiene que saberlo antes de pedir */
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

/**
 * Las secciones del Inicio de este negocio: primero las suyas («Para tu salteñería»), después las vitrinas de
 * siempre que le sirven, calculadas solo con sus rubros (a una pensión no se le ofrece shampoo).
 */
export function seccionesDelNegocio(tipo: TipoDeNegocio, productos: Producto[], maximo = 10): Vitrina[] {
  const negocio = NEGOCIOS[tipo];
  const casa = preciosDeLaCasa(productos);
  const propias = negocio.secciones.map((s) => {
    const elegidos: Producto[] = [];
    for (const palabra of s.palabras) {
      // Dentro de cada ingrediente, primero la presentación más grande (el quintal antes que el kilo)
      const conPalabra = casa
        .filter((p) => !elegidos.includes(p) && tienePalabra(p.nombre, palabra))
        .sort((a, b) => precioDeLaChica(b) - precioDeLaChica(a));
      elegidos.push(...conPalabra);
    }
    const tarjetas = elegidos.map(tarjeta).filter((t): t is TarjetaDeVitrina => t !== null);
    return { clave: s.clave, titulo: s.titulo, subtitulo: s.subtitulo, tarjetas: tarjetas.slice(0, maximo) };
  });
  const suyos = productos.filter((p) => negocio.rubros.includes(p.rubro));
  const deSiempre = vitrinas(suyos, maximo).filter((v) => negocio.vitrinas.includes(v.clave));
  return [...propias.filter((v) => v.tarjetas.length > 0), ...deSiempre];
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
