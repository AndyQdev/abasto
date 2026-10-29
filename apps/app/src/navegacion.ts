import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/** Las pestañas de abajo, como en la maqueta: Inicio, Buscar, Carrito, Pedidos y Cuenta. */
export type Pestanas = {
  Inicio: undefined;
  Buscar: { rubro?: string | null; modo?: 'productos' | 'vendedores' } | undefined;
  Carrito: undefined;
  Pedidos: undefined;
  Cuenta: undefined;
};

/** Lo que se abre encima de las pestañas. */
export type Pila = {
  Pestanas: NavigatorScreenParams<Pestanas>;
  Producto: { id: string };
  Vendedor: { id: string };
  Finalizar: undefined;
  Seguimiento: { id: string };
  BuscarPorFoto: undefined;
};

export type PantallaDePila<N extends keyof Pila> = NativeStackScreenProps<Pila, N>;
export type PantallaDePestana<N extends keyof Pestanas> = CompositeScreenProps<BottomTabScreenProps<Pestanas, N>, NativeStackScreenProps<Pila>>;
