import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Las pestañas de abajo: Inicio, Carrito, «Mi negocio» (se llama Mi casa, Mi tienda o Producción según el tipo de
 * cliente; docs/plan-mi-negocio.md), Compras (la ruta se sigue llamando «Pedidos») y Cuenta. Buscar se abre desde el buscador del Inicio (01/11, pedido del
 * usuario: la barra queda con lo que se usa todos los días).
 */
export type Pestanas = {
  Inicio: undefined;
  Carrito: undefined;
  MiNegocio: undefined;
  Pedidos: undefined;
  Cuenta: undefined;
};

/** Lo que se abre encima de las pestañas. */
export type Pila = {
  Pestanas: NavigatorScreenParams<Pestanas>;
  Buscar: { rubro?: string | null; modo?: 'productos' | 'vendedores' } | undefined;
  Producto: { id: string };
  Vendedor: { id: string };
  Finalizar: undefined;
  Seguimiento: { id: string };
  BuscarPorFoto: undefined;
  NuevaDireccion: undefined;
};

export type PantallaDePila<N extends keyof Pila> = NativeStackScreenProps<Pila, N>;
export type PantallaDePestana<N extends keyof Pestanas> = CompositeScreenProps<BottomTabScreenProps<Pestanas, N>, NativeStackScreenProps<Pila>>;
