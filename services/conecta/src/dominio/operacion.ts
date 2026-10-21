import { createHash } from 'node:crypto';

/**
 * Lo que la bandeja offline de Mercado o de Campo manda al volver la señal.
 * La clave la genera el teléfono una sola vez y no cambia entre reintentos.
 */
export interface Operacion {
  clave: string;
  tipo: TipoDeOperacion;
  datos: Record<string, unknown>;
  creadaEn: string;
}

export const TIPOS_DE_OPERACION = ['pedido.crear', 'producto.cargar'] as const;
export type TipoDeOperacion = (typeof TIPOS_DE_OPERACION)[number];

export type EstadoDeOperacion = 'aplicada' | 'repetida' | 'conflicto' | 'rechazada';

export interface ResultadoDeOperacion {
  clave: string;
  estado: EstadoDeOperacion;
  /** Lo que respondió el servicio la primera vez. En un reintento se devuelve lo mismo. */
  respuesta?: unknown;
  error?: string;
}

/** Huella del contenido: la misma clave con otro contenido es un error del cliente, no un reintento. */
export function huellaDe(operacion: Pick<Operacion, 'tipo' | 'datos'>): string {
  return createHash('sha256')
    .update(JSON.stringify({ tipo: operacion.tipo, datos: ordenar(operacion.datos) }))
    .digest('hex');
}

function ordenar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenar);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.keys(valor as object)
        .sort()
        .map((k) => [k, ordenar((valor as Record<string, unknown>)[k])]),
    );
  }
  return valor;
}
