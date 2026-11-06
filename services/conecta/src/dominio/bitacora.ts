import type { EstadoDeOperacion, Operacion, ResultadoDeOperacion } from './operacion.js';

/**
 * Bitácora de Conecta (03/11): lo que entró de afuera para cada mayorista y qué pasó con cada cosa.
 * La ve el mayorista en Panel › Conecta. Muestra la idempotencia en acción: un reintento sale como «repetido».
 */
export type OrigenDeOperacion = 'whatsapp' | 'tienda-en-linea' | 'app-sin-senal' | 'api' | 'mcp';

export const ORIGENES: readonly OrigenDeOperacion[] = ['whatsapp', 'tienda-en-linea', 'app-sin-senal', 'api', 'mcp'];

export interface EntradaDeBitacora {
  mayoristaId: string;
  clave: string;
  tipo: string;
  origen: OrigenDeOperacion;
  estado: EstadoDeOperacion;
  ocurridoEn: string;
  /** Quien lo mandó (la organización del token). */
  tiendaId: string | null;
  tiendaNombre: string | null;
  codigo: string | null;
  total: string | null;
  error: string | null;
}

export interface ContextoDeEntrada {
  origen: OrigenDeOperacion;
  tiendaId: string | null;
}

/** El origen que declara quien llama (cabecera X-Abasto-Origen). La bandeja de la app siempre es «sin señal». */
export function origenDe(cabecera: string | undefined, porLote: boolean): OrigenDeOperacion {
  if (porLote) return 'app-sin-senal';
  const valor = (cabecera ?? '').trim().toLowerCase();
  return (ORIGENES as readonly string[]).includes(valor) ? (valor as OrigenDeOperacion) : 'api';
}

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);

/**
 * La entrada de bitácora de una operación, o null si no es de ningún mayorista (por ejemplo, cargar un producto).
 * De la respuesta de Pedidos se toman el código, el total y el nombre de la tienda.
 */
export function entradaDe(operacion: Operacion, resultado: ResultadoDeOperacion, contexto: ContextoDeEntrada, ahora: Date): EntradaDeBitacora | null {
  const mayoristaId = texto(operacion.datos?.mayoristaId);
  if (!mayoristaId) return null;
  const r = (resultado.respuesta ?? {}) as { codigo?: unknown; total?: { texto?: unknown }; tienda?: { nombre?: unknown } };
  return {
    mayoristaId,
    clave: operacion.clave,
    tipo: operacion.tipo,
    origen: contexto.origen,
    estado: resultado.estado,
    ocurridoEn: ahora.toISOString(),
    tiendaId: contexto.tiendaId,
    tiendaNombre: texto(r.tienda?.nombre),
    codigo: texto(r.codigo),
    total: texto(r.total?.texto),
    error: resultado.error ?? null,
  };
}

export interface ResumenDeBitacora {
  aplicadas: number;
  repetidas: number;
  conProblemas: number;
}

export function resumir(entradas: EntradaDeBitacora[]): ResumenDeBitacora {
  return {
    aplicadas: entradas.filter((e) => e.estado === 'aplicada').length,
    repetidas: entradas.filter((e) => e.estado === 'repetida').length,
    conProblemas: entradas.filter((e) => e.estado === 'rechazada' || e.estado === 'conflicto').length,
  };
}
