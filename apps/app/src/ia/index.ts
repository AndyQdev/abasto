/**
 * IA local de la app (dueño: Jhoel). Las pantallas (de Andrés) solo importan desde aquí.
 * Todo corre dentro del teléfono y sin internet: ML Kit para leer texto, TFLite para reconocer productos y platos,
 * y modelos de lenguaje locales (llama.rn) según el teléfono.
 * Si cambias lo que exporta este archivo, avísale a Andrés en docs/equipo/jhoel.md.
 *
 * 01/11 (Andrés, para probar en iPhone): en Expo Go no están ML Kit, TFLite ni llama.rn, y cargarlos al abrir la app
 * la tumba. Por eso lo nativo se carga recién al usarlo (`perezoso.ts`) y, en Expo Go, la IA queda apagada.
 */
import { createElement, useEffect } from 'react';
import { Alert } from 'react-native';
import { iaDisponible } from './perezoso';

export { iaDisponible, leerTexto, reconocerProducto, reconocerFoto } from './perezoso';
export { leerPrecio, enBolivianos } from './precio';
export { combinarConTexto, productosPorFoto, type Reconocido } from './parecido';
// Asistente de compra con modelos de lenguaje locales (llama.rn) según el teléfono
export { ProveedorDeIaLocal, useIaLocal } from './local/estado';
export { PantallaAsistente, PantallaIaLocal } from './vistas/Pantallas';
export { AsistenteDeCompra } from './vistas/AsistenteDeCompra';
export { proponerCompra, type Propuesta } from './entender/asistente';

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
