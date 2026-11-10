/**
 * Lo nativo de la IA (ML Kit, TFLite y llama.rn) se carga recién al usarlo: en Expo Go no existe y cargarlo al
 * abrir la app la tumba (Andrés, 01/11). En Expo Go la IA queda apagada y la app usa las reglas.
 */
import { isRunningInExpoGo } from 'expo';
import type { Interprete } from './local/motor';
import type { ModeloLocal } from './local/modelos';
import type { Reconocido } from './parecido';
import type { FotoReconocida } from './reconocer';

/** false en Expo Go: ahí no se puede leer fotos ni correr los modelos */
export const iaDisponible = !isRunningInExpoGo();

export async function leerTexto(uri: string): Promise<string> {
  if (!iaDisponible) throw new Error('Leer una foto necesita la app instalada: en Expo Go no está ML Kit.');
  const { leerTexto: leer } = require('./leer-texto') as typeof import('./leer-texto');
  return leer(uri);
}

export async function reconocerProducto(fotoUri: string, maximo = 5): Promise<Reconocido[]> {
  if (!iaDisponible) return [];
  const { reconocerProducto: reconocer } = require('./reconocer') as typeof import('./reconocer');
  return reconocer(fotoUri, maximo);
}

export async function reconocerFoto(fotoUri: string, maximo = 5): Promise<FotoReconocida> {
  if (!iaDisponible) return { productos: [], platos: [] };
  const { reconocerFoto: reconocer } = require('./reconocer') as typeof import('./reconocer');
  return reconocer(fotoUri, maximo);
}

export async function cargarLlama(modelo: ModeloLocal, opciones: { vision?: boolean } = {}): Promise<Interprete> {
  if (!iaDisponible) throw new Error('El modelo local necesita la app instalada: en Expo Go no está llama.rn.');
  const { cargarLlama: cargar } = require('./local/motor-llama') as typeof import('./local/motor-llama');
  return cargar(modelo, opciones);
}
