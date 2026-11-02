/**
 * Qué dice la foto según el reconocedor propio (MobileNetV3 + vectores): un producto, un plato o una duda.
 * Umbrales medidos el 02/11/2026 con fotos de prueba de Wikimedia (ml/ENTRENAMIENTO.md): los aciertos dieron
 * parecido ≥ 0,73 y los 3 errores 0,44 a 0,71; las comidas nunca pasan 0,55 contra los productos.
 */
import type { Reconocido } from '../parecido';

export const PLATO_SEGURO = 0.78;
export const PLATO_PROBABLE = 0.7;
/** Ventaja mínima sobre el segundo para afirmar sin preguntar */
export const VENTAJA = 0.04;
export const PRODUCTO_SEGURO = 0.75;

export const NOMBRES_DE_PLATOS: Record<string, string> = {
  salchipapa: 'salchipapa',
  'pique-macho': 'pique macho',
  silpancho: 'silpancho',
  majadito: 'majadito',
  saltena: 'salteña',
};

export type LecturaDeFoto =
  | { tipo: 'producto'; codigo: string; confianza: number }
  | { tipo: 'plato'; plato: string; confianza: number; seguro: boolean; opciones: Reconocido[] }
  | { tipo: 'nada' };

export function leerFoto(productos: Reconocido[], platos: Reconocido[]): LecturaDeFoto {
  const [producto] = productos;
  const [plato, segundo] = platos;
  if (producto && producto.confianza >= PRODUCTO_SEGURO && (!plato || producto.confianza >= plato.confianza)) {
    return { tipo: 'producto', codigo: producto.codigo, confianza: producto.confianza };
  }
  if (plato && plato.confianza >= PLATO_PROBABLE) {
    const seguro = plato.confianza >= PLATO_SEGURO && plato.confianza - (segundo?.confianza ?? 0) >= VENTAJA;
    return { tipo: 'plato', plato: plato.codigo, confianza: plato.confianza, seguro, opciones: seguro ? [] : platos.filter((p) => p.confianza >= PLATO_PROBABLE).slice(0, 3) };
  }
  return { tipo: 'nada' };
}
