/**
 * IA local de la app (dueño: Jhoel). Las pantallas (de Andrés) solo importan desde aquí.
 * Todo corre dentro del teléfono y sin internet: ML Kit para leer texto y TFLite para los modelos propios.
 * Si cambias lo que exporta este archivo, avísale a Andrés en docs/equipo/jhoel.md.
 *
 * 01/11 (Andrés, para probar en iPhone): en Expo Go no están ML Kit ni TFLite, y cargarlos al abrir la app la tumba.
 * Por eso lo nativo (leer-texto, reconocer y diagnostico) se carga recién al usarlo y, en Expo Go, la IA queda
 * apagada: leer avisa, reconocer devuelve [] (como en la vista web) y el diagnóstico avisa y se cierra. En la app
 * instalada (Android o una build propia de iOS) todo sigue igual que antes. Lo que no es nativo se exporta directo.
 */
import { isRunningInExpoGo } from 'expo';
import { createElement, useEffect } from 'react';
import { Alert } from 'react-native';
import type { Reconocido } from './parecido';

export { leerPrecio, enBolivianos } from './precio';
export { combinarConTexto, productosPorFoto, type Reconocido } from './parecido';

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

function SinIA({ alCerrar }: { alCerrar: () => void }) {
  useEffect(() => {
    Alert.alert('IA del teléfono', 'En Expo Go no están ML Kit ni TFLite. Pruébala con la app instalada.');
    alCerrar();
  }, [alCerrar]);
  return null;
}

export function Diagnostico(props: { alCerrar: () => void }) {
  if (!iaDisponible) return createElement(SinIA, props);
  const { Diagnostico: Real } = require('./diagnostico') as typeof import('./diagnostico');
  return createElement(Real, props);
}
