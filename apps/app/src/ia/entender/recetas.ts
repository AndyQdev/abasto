/**
 * Recetas de referencia y su escalado. Una foto o un nombre no dicen la receta exacta: por eso se parte de una
 * receta conocida, se escala con aritmética (nunca la estima el modelo) y se avisa qué se supuso.
 */
import { PLANTILLAS, insumosDePlantilla, type PlantillaDeReceta } from '@abasto/comercio';
import type { ItemPedido, Unidad } from './intencion';
import { normalizar } from './catalogar';
import DATOS from './recetas.json';

export interface Ingrediente {
  nombre: string;
  cantidad: number;
  unidad: Unidad;
  /** Productos del catálogo que lo venden, de la presentación más chica a la más grande */
  codigos?: string[];
}

export interface RecetaDeReferencia {
  id: string;
  /** El plato que reconoce la foto (platos.json); un plato puede tener varias recetas */
  plato?: string;
  nombre: string;
  alias: string[];
  rinde: number;
  unidadDeRinde: string;
  ingredientes: Ingrediente[];
}

/** Las plantillas de Andrés (packages/comercio) que son un plato que reconoce la foto */
const PLATO_DE_PLANTILLA: Record<string, string> = {
  'saltena-carne': 'saltena',
  'saltena-pollo': 'saltena',
  'pique-macho': 'pique-macho',
  salchipapa: 'salchipapa',
  majadito: 'majadito',
};

/**
 * Una plantilla de «Mi negocio» como receta del asistente: así hay una sola lista de recetas y cada insumo ya trae
 * los códigos del catálogo que lo venden. Lo que no se compra (el agua) no entra.
 */
export function desdePlantilla(p: PlantillaDeReceta): RecetaDeReferencia {
  const nombre = p.nombre.toLowerCase();
  const [primera, ...resto] = nombre.split(' ');
  const plural = primera === p.unidad.una.toLowerCase() ? [p.unidad.varias.toLowerCase(), ...resto].join(' ') : nombre;
  // «Salteña de carne» también responde a «salteñas»; «Pan batido» no responde a «pan» (es demasiado general)
  const corto = resto[0] === 'de' ? [p.unidad.una.toLowerCase(), p.unidad.varias.toLowerCase()] : [];
  const ingredientes: Ingrediente[] = [];
  for (const i of insumosDePlantilla(p)) {
    if (!i.codigos.length) continue;
    const igual = ingredientes.find((x) => x.nombre === i.nombre.toLowerCase() && x.unidad === i.unidad);
    if (igual) igual.cantidad = Math.round((igual.cantidad + i.cantidad) * 1000) / 1000;
    else ingredientes.push({ nombre: i.nombre.toLowerCase(), cantidad: i.cantidad, unidad: i.unidad, codigos: i.codigos });
  }
  return {
    id: p.clave,
    plato: PLATO_DE_PLANTILLA[p.clave],
    nombre: p.nombre,
    alias: [...new Set([nombre, plural, ...corto])],
    rinde: p.rinde,
    unidadDeRinde: p.unidad.varias,
    ingredientes,
  };
}

/** Las plantillas de Andrés primero (con códigos del catálogo) y después las nuestras que no están ahí */
export const RECETAS: RecetaDeReferencia[] = [
  ...PLANTILLAS.map(desdePlantilla),
  ...(DATOS.recetas as RecetaDeReferencia[]),
];

/** La receta cuyo alias aparece en lo que se pidió; gana el alias más largo («empanadas de queso» antes que «empanadas»). */
export function buscarReceta(texto: string | null, recetas = RECETAS): RecetaDeReferencia | null {
  if (!texto) return null;
  const buscado = ` ${normalizar(texto)} `;
  let mejor: { receta: RecetaDeReferencia; largo: number } | null = null;
  for (const receta of recetas) {
    for (const alias of receta.alias) {
      const a = normalizar(alias);
      if (buscado.includes(` ${a} `) && (!mejor || a.length > mejor.largo)) mejor = { receta, largo: a.length };
    }
  }
  return mejor?.receta ?? null;
}

const redondear = (n: number) => Math.round(n * 1000) / 1000;

/** Los insumos para hacer `rinde` (100 salteñas, 20 porciones…), escalados desde la receta de referencia. */
export function escalarReceta(receta: RecetaDeReferencia, rinde: number | null): { items: ItemPedido[]; supuestos: string[]; rinde: number } {
  const supuestos = [`Usamos la receta de referencia «${receta.nombre}» (${receta.rinde} ${receta.unidadDeRinde}): ajústala a la tuya`];
  const objetivo = rinde && rinde > 0 ? rinde : receta.rinde;
  if (!rinde) supuestos.push(`No dijiste cuántas: calculamos para ${receta.rinde} ${receta.unidadDeRinde}`);
  const factor = objetivo / receta.rinde;
  return {
    items: receta.ingredientes.map((i) => ({
      nombre: i.nombre,
      cantidad: i.unidad === 'u.' ? Math.ceil(i.cantidad * factor) : redondear(i.cantidad * factor),
      unidad: i.unidad,
      envase: null,
      ...(i.codigos ? { codigos: i.codigos } : {}),
    })),
    supuestos,
    rinde: objetivo,
  };
}

/** Las recetas de un plato reconocido en la foto: un plato se prepara de varias formas. */
export function recetasDelPlato(plato: string, recetas = RECETAS): RecetaDeReferencia[] {
  return recetas.filter((r) => r.plato === plato);
}
