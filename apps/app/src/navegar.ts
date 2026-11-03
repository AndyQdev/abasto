import { createNavigationContainerRef } from '@react-navigation/native';
import type { Pila } from './navegacion';

/** Para navegar desde lo que vive fuera de las pantallas (la hoja del carrito) */
export const navegacion = createNavigationContainerRef<Pila>();

export function irAlCarrito() {
  if (navegacion.isReady()) navegacion.navigate('Pestanas', { screen: 'Carrito' });
}
