/**
 * Entender un pedido en español sin modelo de lenguaje: anda en cualquier teléfono y sin internet.
 * «necesito tres cajas de aceite, dos fardos de arroz y cinco docenas de huevo» → tres ItemPedido.
 * No busca en el catálogo ni calcula: eso lo hace `catalogar.ts`.
 */
import type { Intencion, ItemPedido, TipoDeIntencion, Unidad } from './intencion';
import { leerCantidad } from './numeros';

export const ENVASES: Record<string, string> = {
  caja: 'caja', cajas: 'caja', fardo: 'fardo', fardos: 'fardo', docena: 'docena', docenas: 'docena',
  quintal: 'quintal', quintales: 'quintal', arroba: 'arroba', arrobas: 'arroba', maple: 'maple', maples: 'maple',
  bolsa: 'bolsa', bolsas: 'bolsa', paquete: 'paquete', paquetes: 'paquete', botella: 'botella', botellas: 'botella',
  lata: 'lata', latas: 'lata', balde: 'balde', baldes: 'balde', bidón: 'bidón', bidon: 'bidón', bidones: 'bidón',
  sobre: 'sobre', sobres: 'sobre', unidad: 'unidad', unidades: 'unidad',
};

const UNIDADES: Record<string, Unidad> = {
  kilo: 'kg', kilos: 'kg', kg: 'kg', kgs: 'kg', kilogramo: 'kg', kilogramos: 'kg',
  gramo: 'g', gramos: 'g', gr: 'g', grs: 'g', g: 'g',
  litro: 'L', litros: 'L', lt: 'L', lts: 'L', l: 'L',
  mililitro: 'ml', mililitros: 'ml', ml: 'ml', cc: 'ml',
  u: 'u.', 'u.': 'u.', pieza: 'u.', piezas: 'u.',
};

const AL_PRINCIPIO = /^(necesito|quiero|quisiera|me mandas|mandame|mándame|dame|traeme|tráeme|por favor|para mañana|para hoy)\b[,:]?\s*/i;
const AL_FINAL = /\s*(,?\s*por favor)\s*$/i;
const RECETA = /\b(receta|ingredientes|preparaci[oó]n|para hacer|quiero hacer|quiero preparar|voy a hacer|voy a preparar)\b/i;

const minuscula = (t: string) => t.toLowerCase();

/** Separa la lista: renglones, comas, punto y coma, viñetas y « y » entre productos (pero no «dos y medio»). */
export function partirEnItems(texto: string): string[] {
  return texto
    .split(/\r?\n|[,;]/)
    .flatMap((renglon) => renglon.split(/\s+y\s+(?!medi[oa]\b)/i))
    .map((f) => f.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim())
    .filter(Boolean);
}

/** «kilo y medio», «medio kilo», «un cuarto (de litro)» */
function cantidadEspecial(texto: string): { cantidad: number; unidad: Unidad; resto: string } | null {
  const t = minuscula(texto);
  let m = t.match(/^(kilo|litro)\s+y\s+medio\b\s*(.*)$/);
  if (m) return { cantidad: 1.5, unidad: m[1] === 'kilo' ? 'kg' : 'L', resto: m[2] };
  m = t.match(/^medi[oa]\s+(kilo|litro)\b\s*(.*)$/);
  if (m) return { cantidad: 0.5, unidad: m[1] === 'kilo' ? 'kg' : 'L', resto: m[2] };
  m = t.match(/^un\s+cuarto(?:\s+de\s+(kilo|litro))?\b\s*(.*)$/);
  if (m) return { cantidad: 0.25, unidad: m[1] === 'kilo' ? 'kg' : 'L', resto: m[2] };
  return null;
}

const sinDe = (t: string) => t.replace(/^(de la|del|de)\s+/i, '').trim();

/** Un renglón de la lista → lo pedido. Lo que no tiene nombre se descarta. */
export function leerItem(fragmento: string): ItemPedido | null {
  let texto = fragmento.trim().replace(AL_FINAL, '');
  while (AL_PRINCIPIO.test(texto)) texto = texto.replace(AL_PRINCIPIO, '');

  let cantidad: number | null = null;
  let unidad: Unidad | null = null;
  let envase: string | null = null;

  const especial = cantidadEspecial(texto);
  if (especial) {
    ({ cantidad, unidad } = especial);
    texto = especial.resto;
  } else {
    const leida = leerCantidad(texto);
    if (leida) {
      cantidad = leida.cantidad;
      texto = leida.resto;
      const [primera = '', ...resto] = texto.split(/\s+/);
      const p = minuscula(primera);
      if (UNIDADES[p]) {
        unidad = UNIDADES[p];
        texto = resto.join(' ');
      } else if (ENVASES[p]) {
        envase = ENVASES[p];
        texto = resto.join(' ');
      }
    }
  }

  // «una docena de huevos»: si la cantidad vino con «docena», ya quedó como envase
  const nombre = minuscula(sinDe(texto))
    .replace(/[.!?¡¿]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return nombre ? { nombre, cantidad, unidad, envase } : null;
}

/** «para 20 personas», «100 empanadas», «rinde 50» */
export function rindeDe(texto: string): { rinde: number; preparacion: string | null } | null {
  const t = minuscula(texto);
  let m = t.match(/para\s+(\d+)\s+(personas|porciones|platos)/);
  if (m) return { rinde: Number(m[1]), preparacion: null };
  m = t.match(/rinde\s+(\d+)/);
  if (m) return { rinde: Number(m[1]), preparacion: null };
  m = t.match(/(\d+)\s+([a-záéíóúñ]+(?:\s+de\s+[a-záéíóúñ]+)?)/);
  if (m && !['personas', 'porciones'].includes(m[2])) return { rinde: Number(m[1]), preparacion: m[2] };
  return null;
}

export function entenderConReglas(texto: string): Intencion {
  const items = partirEnItems(texto)
    .map(leerItem)
    .filter((i): i is ItemPedido => i !== null);
  const esReceta = RECETA.test(texto);
  const tipo: TipoDeIntencion = esReceta ? 'receta' : items.some((i) => i.cantidad !== null) ? 'pedido' : 'busqueda';

  if (tipo === 'receta') {
    const r = rindeDe(texto);
    // «quiero hacer 100 empanadas» no es un ingrediente: es lo que se quiere preparar. «3 huevos» sí, contado en unidades
    const listaDeIngredientes = items
      .filter((i) => i.unidad || i.envase || (i.cantidad !== null && i.cantidad !== r?.rinde))
      .map((i) => (i.unidad || i.envase ? i : { ...i, unidad: 'u.' as const }));
    return { tipo, items: listaDeIngredientes, preparacion: r?.preparacion ?? null, rinde: r?.rinde ?? null, supuestos: [] };
  }

  const supuestos: string[] = [];
  const conCantidad = items.map((i) => {
    if (tipo === 'pedido' && i.cantidad === null) {
      supuestos.push(`No dijiste cuánto ${i.nombre}: se toma 1`);
      return { ...i, cantidad: 1 };
    }
    return i;
  });
  return { tipo, items: conCantidad, preparacion: null, rinde: null, supuestos };
}
