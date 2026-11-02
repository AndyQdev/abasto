/**
 * El Inicio según el tipo de cliente. Desde el 01/11 (pedido de Andrés, plan en `docs/plan-mi-negocio.md`) son tres:
 * - **hogar**: la familia que compra al por mayor para su casa,
 * - **tienda**: abarrotes que compra para revender,
 * - **productor**: compra insumos y vende algo hecho, con subtipo salteñería, panadería o pensión.
 * Se elige al registrarse (obligatorio) y se cambia en Cuenta. La promesa es «no vuelvas a ir al mercado».
 *
 * Las secciones se arman por palabra del nombre («harina», «manteca»…), no por código: cuando Abasto suma un
 * producto nuevo al catálogo, aparece solo en la sección que le toca. Solo entra lo que vende Abasto.
 */
import { bs, type ItemDeCarrito } from './carrito';
import { escalaPorDefecto, escalasConPrecio, itemDeCarrito, preciosDeLaCasa, rubros, type Producto } from './catalogo';
import type { Pedido } from './pedidos';
import { vitrinas, type ClaveDeVitrina, type TarjetaDeVitrina, type Vitrina } from './vitrinas';

export type TipoDeNegocio = 'hogar' | 'tienda' | 'productor';
export type SubtipoProductor = 'salteneria' | 'panaderia' | 'pension';

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
    ejemplo: 'Salteñería, panadería, pensión',
    gana: 'Compra tus insumos y sabe cuánto te cuesta cada unidad',
    pestana: 'Mi producción',
  },
};

export const TIPOS_DE_NEGOCIO: TipoDeNegocio[] = ['hogar', 'tienda', 'productor'];

export const SUBTIPOS: Record<SubtipoProductor, { nombre: string; ejemplo: string }> = {
  salteneria: { nombre: 'Salteñería', ejemplo: 'Salteñas, empanadas' },
  panaderia: { nombre: 'Panadería', ejemplo: 'Pan, repostería' },
  pension: { nombre: 'Pensión', ejemplo: 'Pensión, pollería, restaurante, puesto' },
};

export const SUBTIPOS_DE_PRODUCTOR: SubtipoProductor[] = ['salteneria', 'panaderia', 'pension'];

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
}

type ClaveDePerfil = 'hogar' | 'tienda' | SubtipoProductor;

const COCINA = ['Harinas y panificación', 'Aceites y grasas', 'Granos y cereales', 'Condimentos', 'Huevos y lácteos', 'Verduras secas', 'Descartables'];

const PERFILES: Record<ClaveDePerfil, Perfil> = {
  hogar: {
    rubros: ['Granos y cereales', 'Aceites y grasas', 'Huevos y lácteos', 'Harinas y panificación', 'Verduras secas', 'Limpieza del hogar', 'Higiene y cuidado personal', 'Bebidas', 'Galletas y dulces', 'Condimentos'],
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
    sugeridos: 'Más para los estantes de tu tienda',
  },
  salteneria: {
    rubros: COCINA,
    secciones: [
      {
        clave: 'salteneria',
        titulo: 'Para tu salteñería',
        subtitulo: 'Masa y jigote: lo de cada semana',
        palabras: ['harina', 'manteca', 'aji', 'papa', 'huevo', 'azucar', 'aceite', 'cebolla', 'comino', 'pimienta', 'oregano'],
      },
    ],
    vitrinas: ['volumen'],
    sugeridos: 'Más cosas que se usan en una salteñería',
  },
  panaderia: {
    rubros: COCINA,
    secciones: [
      {
        clave: 'panaderia',
        titulo: 'Para tu panadería',
        subtitulo: 'Harina por quintal y lo que va en la masa',
        palabras: ['harina', 'levadura', 'azucar', 'manteca', 'sal', 'polvo', 'huevo', 'mantequilla'],
      },
    ],
    vitrinas: ['volumen'],
    sugeridos: 'Más cosas que se usan en una panadería',
  },
  pension: {
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
    sugeridos: 'Más para la cocina de tu negocio',
  },
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
  return n.tipo === 'productor' && n.subtipo ? SUBTIPOS[n.subtipo].nombre : TIPOS[n.tipo].corto;
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

/** Los rubros que se le muestran a este cliente, en su orden, y solo los que tienen productos */
export function rubrosDelNegocio(n: NegocioElegido, productos: Producto[]) {
  const hay = new Set(rubros(productos));
  return perfil(n).rubros.filter((r) => hay.has(r));
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

/**
 * Las secciones del Inicio de este cliente: primero las suyas («Para tu salteñería», «La despensa del mes»), después
 * «También te puede servir» (lo demás de sus rubros, en el orden en que los busca) y al final las vitrinas de
 * siempre que le sirven, calculadas solo con sus rubros (a una pensión no se le ofrece shampoo).
 */
export function seccionesDelNegocio(n: NegocioElegido, productos: Producto[], maximo = 10): Vitrina[] {
  const p = perfil(n);
  const casa = preciosDeLaCasa(productos);
  const propias = p.secciones.map((s) => {
    const elegidos: Producto[] = [];
    for (const palabra of s.palabras) {
      // Dentro de cada palabra, primero la presentación más grande (el quintal antes que el kilo); en la casa, al revés
      const conPalabra = casa
        .filter((x) => !elegidos.includes(x) && tienePalabra(x.nombre, palabra))
        .sort((a, b) => (p.primeroLoChico ? -1 : 1) * (precioDeLaChica(b) - precioDeLaChica(a)));
      elegidos.push(...conPalabra);
    }
    const tarjetas = elegidos.map(tarjeta).filter((t): t is TarjetaDeVitrina => t !== null);
    return { clave: s.clave, titulo: s.titulo, subtitulo: s.subtitulo, tarjetas: tarjetas.slice(0, maximo) };
  });
  const yaSalieron = new Set(propias.flatMap((v) => v.tarjetas.map((t) => t.producto.id)));
  const otros = casa
    .filter((x) => p.rubros.includes(x.rubro) && !yaSalieron.has(x.id))
    .sort((a, b) => p.rubros.indexOf(a.rubro) - p.rubros.indexOf(b.rubro));
  const sugeridos: Vitrina = {
    clave: 'sugeridos',
    titulo: 'También te puede servir',
    subtitulo: p.sugeridos,
    tarjetas: otros
      .map(tarjeta)
      .filter((t): t is TarjetaDeVitrina => t !== null)
      .slice(0, maximo),
  };
  const suyos = productos.filter((x) => p.rubros.includes(x.rubro));
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
