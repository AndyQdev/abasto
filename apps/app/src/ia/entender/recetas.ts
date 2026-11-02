/**
 * Recetas de referencia y su escalado. Una foto o un nombre no dicen la receta exacta: por eso se parte de una
 * receta conocida, se escala con aritmética (nunca la estima el modelo) y se avisa qué se supuso.
 */
import type { ItemPedido, Unidad } from './intencion';
import { normalizar } from './catalogar';
import DATOS from './recetas.json';

export interface Ingrediente {
  nombre: string;
  cantidad: number;
  unidad: Unidad;
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

export const RECETAS = DATOS.recetas as RecetaDeReferencia[];

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
export function escalarReceta(receta: RecetaDeReferencia, rinde: number | null): { items: ItemPedido[]; supuestos: string[] } {
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
    })),
    supuestos,
  };
}

/** Las recetas de un plato reconocido en la foto: un plato se prepara de varias formas. */
export function recetasDelPlato(plato: string, recetas = RECETAS): RecetaDeReferencia[] {
  return recetas.filter((r) => r.plato === plato);
}
