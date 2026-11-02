/**
 * Lo que se le pide al modelo de lenguaje local y cómo se revisa lo que devuelve. Puro, se prueba sin el modelo.
 *
 * El modelo responde **solo** con un JSON que sigue `ESQUEMA_DE_INTENCION` (llama.rn lo convierte en una gramática:
 * no puede salirse del formato). Aun así se valida todo: lo que no cuadra se descarta, no se adivina.
 */
import type { Intencion, ItemPedido, TipoDeIntencion, Unidad } from './intencion';

const UNIDADES: Unidad[] = ['kg', 'g', 'L', 'ml', 'u.'];
const TIPOS: TipoDeIntencion[] = ['pedido', 'receta', 'busqueda'];
const ENVASES = ['caja', 'fardo', 'docena', 'unidad', 'quintal', 'arroba', 'maple', 'bolsa', 'paquete', 'botella', 'lata', 'balde', 'bidón', 'sobre'];

/** «Esto o null» escrito como lo entiende el conversor de llama.cpp (anyOf), no como lista con null adentro */
const oNulo = (esquema: object) => ({ anyOf: [esquema, { type: 'null' }] });

export const ESQUEMA_DE_INTENCION = {
  type: 'object',
  additionalProperties: false,
  required: ['tipo', 'items', 'preparacion', 'rinde', 'supuestos'],
  properties: {
    tipo: { type: 'string', enum: TIPOS },
    items: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nombre', 'cantidad', 'unidad', 'envase'],
        properties: {
          nombre: { type: 'string', maxLength: 60 },
          cantidad: oNulo({ type: 'number' }),
          unidad: oNulo({ type: 'string', enum: UNIDADES }),
          envase: oNulo({ type: 'string', enum: ENVASES }),
        },
      },
    },
    preparacion: oNulo({ type: 'string', maxLength: 80 }),
    rinde: oNulo({ type: 'number' }),
    supuestos: { type: 'array', maxItems: 4, items: { type: 'string', maxLength: 140 } },
  },
} as const;

export interface Contexto {
  /** Para qué compra: hogar, tienda o productor (y qué produce) */
  negocio?: string | null;
  /**
   * Ya no va en el prompt: con la lista del catálogo, el modelo de 450M la copiaba en vez de mirar la foto, y
   * alargaba el prompt (un minuto en un teléfono de 4 GB). El catálogo lo cruza el código, no el modelo.
   */
  nombresDelCatalogo?: string[];
}

/** Corto a propósito: en un teléfono cada palabra del prompt cuesta tiempo antes de la primera respuesta. */
export function instrucciones({ negocio }: Contexto = {}): string {
  return [
    'Entiendes lo que una persona en Bolivia quiere comprar, abastecer o preparar, y respondes solo con JSON.',
    'tipo: «pedido» si nombra productos; «receta» si quiere preparar algo, pega una receta o manda la foto de una comida; «busqueda» si busca algo sin decir cuánto.',
    'items: cada producto o ingrediente que la persona dijo o que se lee en la foto, en minúsculas y singular, con su cantidad y unidad (kg, g, L, ml, u.) o envase (caja, fardo, docena, quintal, arroba, maple). Sin cantidad: null.',
    'Si es una comida sin receta, deja items vacío, escribe en preparacion qué es (por ejemplo «salchipapa») y en rinde para cuántos.',
    'No inventes cantidades, precios ni marcas. Lo que supongas va en supuestos.',
    negocio ? `Compra para: ${negocio}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const numeroPositivo = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 100_000 ? v : null);

function item(v: unknown): ItemPedido | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const nombre = texto(o.nombre, 60)?.toLowerCase();
  if (!nombre) return null;
  const unidad = UNIDADES.includes(o.unidad as Unidad) ? (o.unidad as Unidad) : null;
  const envase = typeof o.envase === 'string' && ENVASES.includes(o.envase) ? o.envase : null;
  return { nombre, cantidad: numeroPositivo(o.cantidad), unidad, envase };
}

/**
 * Lo que respondió el modelo, revisado. Si no es un JSON válido o no trae nada útil, devuelve null y quien llama
 * usa las reglas: nunca se muestra una respuesta inventada.
 */
export function leerRespuesta(crudo: string): Intencion | null {
  // Algunos modelos rodean el JSON con marcas de la plantilla («<|im_start|>assistant») o un bloque ```json
  const desde = crudo.indexOf('{');
  const hasta = crudo.lastIndexOf('}');
  if (desde < 0 || hasta <= desde) return null;
  let datos: unknown;
  try {
    datos = JSON.parse(crudo.slice(desde, hasta + 1));
  } catch {
    return null;
  }
  if (typeof datos !== 'object' || datos === null) return null;
  const o = datos as Record<string, unknown>;
  const tipo = TIPOS.includes(o.tipo as TipoDeIntencion) ? (o.tipo as TipoDeIntencion) : null;
  if (!tipo) return null;
  const items = Array.isArray(o.items) ? o.items.map(item).filter((i): i is ItemPedido => i !== null) : [];
  const preparacion = texto(o.preparacion, 80);
  if (!items.length && !preparacion) return null;
  return {
    tipo,
    items,
    preparacion,
    rinde: numeroPositivo(o.rinde),
    supuestos: Array.isArray(o.supuestos) ? o.supuestos.map((s) => texto(s, 140)).filter((s): s is string => s !== null).slice(0, 6) : [],
  };
}
