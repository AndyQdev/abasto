/**
 * Las medidas del inventario: en qué se cuenta cada artículo y cómo se dice su cantidad. La regla de Abasto es que una
 * cantidad nunca va sin unidad: «46 kg», «2 maples · 60 u.», «3 u. · 2,7 L».
 *
 * Un artículo se cuenta en **envases** (el quintal, el maple, la botella) y cada envase trae una cantidad de la unidad
 * de base. Lo que se compra en Abasto trae la medida en el nombre («Harina de trigo · quintal 46 kg»); lo que se agrega
 * a mano se elige de `MEDIDAS_A_MANO`.
 */

export type UnidadDeBase = 'kg' | 'g' | 'L' | 'ml' | 'u.' | 'rollos';

export interface Medida {
  /** El envase en singular: «unidad», «quintal», «maple», «kg» (cuando se cuenta suelto)… */
  envase: string;
  /** Cuánto trae un envase en la unidad de base; null si no se sabe (un «paquete» agregado a mano) */
  porEnvase: number | null;
  unidad: UnidadDeBase;
}

/** Se cuenta suelto, directo en la unidad de base: «5 kg», «12 u.» */
const SUELTAS = new Set(['kg', 'L', 'u.']);

export const UNIDAD: Medida = { envase: 'unidad', porEnvase: 1, unidad: 'u.' };

const ENVASES_CON_PESO = ['quintal', 'arroba', 'balde', 'bidón', 'bidon', 'bolsa', 'botella', 'lata', 'caja', 'paquete', 'sobre', 'frasco'];
const ENVASES_CON_UNIDADES = ['maple', 'paquete', 'caja', 'docena', 'bolsa', 'fardo'];

const numero = (t: string) => Number(t.replace(/\./g, '').replace(',', '.'));

function unidadDe(t: string): UnidadDeBase {
  const u = t.toLowerCase();
  if (u === 'kg' || u === 'g' || u === 'ml') return u;
  return u === 'cc' ? 'ml' : 'L';
}

/**
 * La medida a partir del contenido del nombre del producto (lo que va después de « · » o al final):
 * «quintal 46 kg» → 1 quintal = 46 kg · «maple de 30» → 1 maple = 30 u. · «900 ml» → 1 u. = 900 ml ·
 * «3 de 110 g» → 1 paquete = 3 u. · «24 rollos» → 1 paquete = 24 rollos. Sin contenido, se cuenta por unidad.
 */
export function medidaDeContenido(contenido: string | null | undefined): Medida {
  const t = (contenido ?? '').trim().toLowerCase();
  if (!t) return UNIDAD;

  const conUnidades = t.match(new RegExp(`^(${ENVASES_CON_UNIDADES.join('|')}) de (\\d+)`));
  if (conUnidades) return { envase: conUnidades[1], porEnvase: Number(conUnidades[2]), unidad: 'u.' };

  const varios = t.match(/^(\d+) de \d+(?:[.,]\d+)?\s?(?:kg|g|ml|l|cc)\b/);
  if (varios) return { envase: 'paquete', porEnvase: Number(varios[1]), unidad: 'u.' };

  const rollos = t.match(/^(\d+) rollos?\b/);
  if (rollos) return { envase: 'paquete', porEnvase: Number(rollos[1]), unidad: 'rollos' };

  const peso = t.match(new RegExp(`^(?:(${ENVASES_CON_PESO.join('|')})\\s+)?(\\d+(?:[.,]\\d+)?)\\s?(kg|g|ml|l|cc)\\b`));
  if (peso) {
    const unidad = unidadDe(peso[3]);
    const envase = peso[1] === 'bidon' ? 'bidón' : (peso[1] ?? 'unidad');
    return { envase, porEnvase: numero(peso[2]), unidad };
  }
  return UNIDAD;
}

/** Lo que se elige al agregar algo a mano. Maple, arroba y quintal ya saben cuánto traen */
export const MEDIDAS_A_MANO: { clave: string; texto: string; medida: Medida }[] = [
  { clave: 'unidad', texto: 'Unidades', medida: UNIDAD },
  { clave: 'kg', texto: 'Kilos', medida: { envase: 'kg', porEnvase: 1, unidad: 'kg' } },
  { clave: 'L', texto: 'Litros', medida: { envase: 'L', porEnvase: 1, unidad: 'L' } },
  { clave: 'paquete', texto: 'Paquetes', medida: { envase: 'paquete', porEnvase: null, unidad: 'u.' } },
  { clave: 'caja', texto: 'Cajas', medida: { envase: 'caja', porEnvase: null, unidad: 'u.' } },
  { clave: 'maple', texto: 'Maples', medida: { envase: 'maple', porEnvase: 30, unidad: 'u.' } },
  { clave: 'arroba', texto: 'Arrobas', medida: { envase: 'arroba', porEnvase: 11.5, unidad: 'kg' } },
  { clave: 'quintal', texto: 'Quintales', medida: { envase: 'quintal', porEnvase: 46, unidad: 'kg' } },
];

const PLURALES: Record<string, string> = {
  unidad: 'unidades',
  quintal: 'quintales',
  bidón: 'bidones',
  docena: 'docenas',
};

export function plural(envase: string, n: number) {
  if (Math.abs(n) === 1) return envase;
  return PLURALES[envase] ?? `${envase}s`;
}

const formato = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 });

/** «11,5», «1.380», «0,25» */
export function numeroBonito(n: number) {
  return formato.format(Math.round(n * 100) / 100);
}

/** 1.500 g → 1,5 kg · 2.700 ml → 2,7 L (más fácil de leer) */
function total(cantidad: number, unidad: UnidadDeBase) {
  if (unidad === 'g' && Math.abs(cantidad) >= 1000) return `${numeroBonito(cantidad / 1000)} kg`;
  if (unidad === 'ml' && Math.abs(cantidad) >= 1000) return `${numeroBonito(cantidad / 1000)} L`;
  return `${numeroBonito(cantidad)} ${unidad}`;
}

/**
 * La cantidad con su unidad, siempre: «46 kg» (suelto), «12 u.», «2 maples · 60 u.», «1 quintal · 46 kg»,
 * «3 u. · 2,7 L», «4 paquetes» (si no se sabe cuánto trae cada uno).
 */
export function textoDeCantidad(envases: number, m: Medida) {
  const n = numeroBonito(envases);
  if (SUELTAS.has(m.envase) && m.porEnvase === 1) return `${n} ${m.unidad}`;
  const cabeza = m.envase === 'unidad' ? `${n} u.` : `${n} ${plural(m.envase, envases)}`;
  if (m.porEnvase === null || (m.envase === 'unidad' && m.unidad === 'u.')) return cabeza;
  return `${cabeza} · ${total(envases * m.porEnvase, m.unidad)}`;
}

/** «1 quintal = 46 kg», «1 maple = 30 u.»: para explicar la medida en la ficha; null si no hace falta */
export function equivalencia(m: Medida) {
  if (m.porEnvase === null || SUELTAS.has(m.envase) || (m.envase === 'unidad' && m.unidad === 'u.')) return null;
  return `1 ${m.envase === 'unidad' ? 'u.' : m.envase} = ${total(m.porEnvase, m.unidad)}`;
}

/** Lo que escribe la persona en el campo de cantidad: «2», «1,5», «0.5». NaN si no es un número */
export function leerCantidad(texto: string) {
  const t = texto.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}
