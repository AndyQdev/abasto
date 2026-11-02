import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Las pestañas de abajo: Inicio, Buscar, Carrito, «Mi negocio» (se llama Mi casa, Mi tienda o Producción según el tipo
 * de cliente; Fase 2 de docs/plan-mi-negocio.md), Pedidos y Cuenta.
 */
export type Pestanas = {
  Inicio: undefined;
  Buscar: { rubro?: string | null; modo?: 'productos' | 'vendedores' } | undefined;
  Carrito: undefined;
  MiNegocio: undefined;
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
  /** IA local (src/ia, Jhoel): asistente de compra y elegir el modelo del teléfono */
  Asistente: undefined;
  IaLocal: undefined;
  NuevaDireccion: undefined;
};

export type PantallaDePila<N extends keyof Pila> = NativeStackScreenProps<Pila, N>;
export type PantallaDePestana<N extends keyof Pestanas> = CompositeScreenProps<BottomTabScreenProps<Pestanas, N>, NativeStackScreenProps<Pila>>;
