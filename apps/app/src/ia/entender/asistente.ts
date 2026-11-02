/**
 * El asistente de compra: de lo que la persona escribe, pega o fotografía, a una propuesta de carrito.
 *
 * 1. Entender: el modelo local (si el teléfono tiene uno) o las reglas (siempre). Nunca se queda sin respuesta.
 * 2. Completar: una receta sin ingredientes sale de las recetas de referencia, escalada con aritmética.
 * 3. Catalogar: cada cosa pedida pasa a un producto real, su presentación y cuántas (código, no modelo).
 * Todo corre en el teléfono: anda sin internet sobre el catálogo guardado.
 */
import type { Producto } from '@abasto/comercio';
import type { Reconocido } from '../parecido';
import type { EntradaDelAsistente, Interprete } from '../local/motor';
import { candidatos, catalogar, type LineaPropuesta } from './catalogar';
import type { Contexto } from './con-modelo';
import { intencionVacia, type Intencion } from './intencion';
import { buscarReceta, escalarReceta, type RecetaDeReferencia } from './recetas';
import { entenderConReglas } from './reglas';

export interface Propuesta {
  intencion: Intencion;
  lineas: LineaPropuesta[];
  /** Todo lo que se supuso, para que la persona lo vea antes de agregar al carrito */
  supuestos: string[];
  /** Quién entendió: el modelo de lenguaje local o las reglas */
  origen: 'modelo' | 'reglas' | 'foto';
  receta: RecetaDeReferencia | null;
  /** Si había modelo y no respondió: por qué (para probar y mejorar) */
  falloDelModelo: string | null;
  /** Cuánto tardó el modelo en responder */
  respuestaMs: number | null;
}

export interface OpcionesDelAsistente {
  interprete?: Interprete | null;
  contexto?: Contexto;
  /** MobileNetV3 + vectores del catálogo: reconoce un producto en la foto aunque no haya modelo de lenguaje */
  reconocer?: (fotoUri: string) => Promise<Reconocido[]>;
}

const CONFIANZA_DE_FOTO = 0.5;

async function entender(entrada: EntradaDelAsistente, productos: Producto[], o: OpcionesDelAsistente): Promise<{ intencion: Intencion; origen: Propuesta['origen'] }> {
  if (o.interprete) {
    const intencion = await o.interprete.interpretar(entrada, o.contexto).catch(() => null);
    if (intencion) return { intencion, origen: 'modelo' };
  }
  if (entrada.texto.trim()) return { intencion: entenderConReglas(entrada.texto), origen: 'reglas' };

  // Solo una foto y sin modelo que vea: el reconocedor de productos (TensorFlow Lite) dice qué es
  if (entrada.fotoUri && o.reconocer) {
    const [mejor] = await o.reconocer(entrada.fotoUri).catch(() => []);
    const producto = mejor && mejor.confianza >= CONFIANZA_DE_FOTO ? productos.find((p) => p.codigo === mejor.codigo) : undefined;
    if (producto) {
      return { intencion: { ...intencionVacia('busqueda'), items: [{ nombre: producto.nombre, cantidad: null, unidad: null, envase: null }] }, origen: 'foto' };
    }
  }
  return { intencion: intencionVacia(), origen: 'reglas' };
}

export async function proponerCompra(entrada: EntradaDelAsistente, productos: Producto[], opciones: OpcionesDelAsistente = {}): Promise<Propuesta> {
  const { intencion, origen } = await entender(entrada, productos, opciones);
  const supuestos = [...intencion.supuestos];
  let items = intencion.items;
  let receta: RecetaDeReferencia | null = null;

  // «100 empanadas de queso» como si fuera un producto: no se vende, pero es una receta conocida → sus insumos.
  // Los modelos chicos lo confunden seguido; corregirlo con código es más fiable que con más instrucciones.
  const sinCatalogo = items.filter((i) => !candidatos(i.nombre, productos).length);
  const comoReceta = sinCatalogo.map((i) => ({ item: i, receta: buscarReceta(i.nombre) })).find((x) => x.receta);
  if (comoReceta && !receta) {
    receta = comoReceta.receta!;
    const escalada = escalarReceta(receta, comoReceta.item.cantidad ?? intencion.rinde);
    items = [...items.filter((i) => i !== comoReceta.item), ...escalada.items];
    supuestos.push(...escalada.supuestos);
  }

  if (intencion.tipo === 'receta' && !items.length) {
    receta = buscarReceta(intencion.preparacion) ?? buscarReceta(entrada.texto);
    if (receta) {
      const escalada = escalarReceta(receta, intencion.rinde);
      items = escalada.items;
      supuestos.push(...escalada.supuestos);
    } else {
      supuestos.push(
        `Todavía no tenemos una receta de referencia para «${intencion.preparacion ?? 'eso'}»: pega tu receta o escribe los ingredientes y te armamos la compra`,
      );
    }
  }

  const lineas = catalogar(items, productos);
  if (!items.length && origen !== 'modelo' && !entrada.texto.trim() && entrada.fotoUri) {
    supuestos.push('No reconocimos la foto: prueba más cerca, con buena luz, o escribe qué buscas');
  }
  const diag = opciones.interprete?.diagnostico() ?? null;
  return {
    intencion: { ...intencion, items },
    lineas,
    supuestos,
    origen,
    receta,
    falloDelModelo: opciones.interprete && origen !== 'modelo' ? (diag?.error ?? 'El modelo no respondió') : null,
    respuestaMs: diag?.respuestaMs ?? null,
  };
}
