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

export const ESQUEMA_DE_INTENCION = {
  type: 'object',
  additionalProperties: false,
  required: ['tipo', 'items', 'preparacion', 'rinde', 'supuestos'],
  properties: {
    tipo: { type: 'string', enum: TIPOS },
    items: {
      type: 'array',
      maxItems: 25,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nombre', 'cantidad', 'unidad', 'envase'],
        properties: {
          nombre: { type: 'string', maxLength: 60 },
          cantidad: { type: ['number', 'null'] },
          unidad: { type: ['string', 'null'], enum: [...UNIDADES, null] },
          envase: { type: ['string', 'null'], enum: [...ENVASES, null] },
        },
      },
    },
    preparacion: { type: ['string', 'null'], maxLength: 80 },
    rinde: { type: ['number', 'null'] },
    supuestos: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 140 } },
  },
} as const;

export interface Contexto {
  /** Para qué compra: hogar, tienda o productor (y qué produce) */
  negocio?: string | null;
  /** Nombres del catálogo, para que use las mismas palabras (no para elegir: elige el código) */
  nombresDelCatalogo?: string[];
}

export function instrucciones({ negocio, nombresDelCatalogo = [] }: Contexto = {}): string {
  return [
    'Eres el asistente de compras de Abasto, una app boliviana de compras al por mayor.',
    'Tu único trabajo es entender qué quiere comprar, abastecer o producir la persona y devolverlo como JSON.',
    'Reglas:',
    '- tipo «pedido» si nombra productos para comprar; «receta» si quiere preparar algo (o pega una receta o manda la foto de una comida); «busqueda» si busca algo sin decir cuánto.',
    '- En items va cada producto o ingrediente con el nombre en minúsculas y en singular, la cantidad y su unidad (kg, g, L, ml, u.) o su envase (caja, fardo, docena, quintal, arroba, maple…). Si no dijo cuánto, cantidad null.',
    '- Si pegó una receta, copia sus ingredientes y cantidades tal cual. Si no hay receta, deja items vacío y pon en preparacion qué quiere hacer y en rinde cuántas porciones o unidades.',
    '- Nunca inventes precios, marcas ni cantidades que la persona no dio. Lo que supongas va en supuestos, en una frase corta.',
    '- Si mandó una foto, describe en preparacion lo que ves (ej. «torta de chocolate de dos pisos») o, si es un producto, ponlo como item.',
    negocio ? `La persona compra para: ${negocio}.` : '',
    nombresDelCatalogo.length ? `Productos que vende Abasto (usa estas palabras si corresponden): ${nombresDelCatalogo.slice(0, 80).join('; ')}.` : '',
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
  let datos: unknown;
  try {
    // Algunos modelos envuelven el JSON en ```json … ```
    datos = JSON.parse(crudo.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, ''));
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
