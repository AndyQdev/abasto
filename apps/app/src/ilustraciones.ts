/**
 * Las ilustraciones «Gibby» de la app (3D tipo película animada, con la paleta de Abasto).
 * Se generan una sola vez con `scripts/ilustraciones` (ver apps/app/ilustraciones.json); la app nunca llama a Gemini.
 */
/** Un recurso empaquetado con require(): para React Native es un número. */
type Recurso = number;

export const ILUSTRACION = {
  bienvenida: require('../assets/ilustraciones/bienvenida.webp'),
  codigo: require('../assets/ilustraciones/codigo.webp'),
  ubicacion: require('../assets/ilustraciones/ubicacion.webp'),
  bannerAbarrotes: require('../assets/ilustraciones/banner-abarrotes.webp'),
  bannerBebidas: require('../assets/ilustraciones/banner-bebidas.webp'),
  bannerEntrega: require('../assets/ilustraciones/banner-entrega.webp'),
  bannerLimpieza: require('../assets/ilustraciones/banner-limpieza.webp'),
  vacioCarrito: require('../assets/ilustraciones/vacio-carrito.webp'),
  vacioPedidos: require('../assets/ilustraciones/vacio-pedidos.webp'),
  pedidoEnCamino: require('../assets/ilustraciones/pedido-en-camino.webp'),
  pedidoEntregado: require('../assets/ilustraciones/pedido-entregado.webp'),
  sinSenal: require('../assets/ilustraciones/sin-senal.webp'),
} satisfies Record<string, Recurso>;

const RUBROS: Record<string, Recurso> = {
  Abarrotes: require('../assets/ilustraciones/rubro-abarrotes.webp'),
  Bebidas: require('../assets/ilustraciones/rubro-bebidas.webp'),
  'Cosméticos': require('../assets/ilustraciones/rubro-cosmeticos.webp'),
  'Galletas y dulces': require('../assets/ilustraciones/rubro-galletas-y-dulces.webp'),
  'Higiene y cuidado personal': require('../assets/ilustraciones/rubro-higiene.webp'),
  'Limpieza del hogar': require('../assets/ilustraciones/rubro-limpieza.webp'),
  'Lácteos': require('../assets/ilustraciones/rubro-lacteos.webp'),
  Varios: require('../assets/ilustraciones/rubro-varios.webp'),
};

/** La imagen del rubro; si es un rubro nuevo, la de Varios. */
export function imagenDeRubro(rubro: string): Recurso {
  return RUBROS[rubro] ?? RUBROS.Varios;
}

/** Nombre corto del rubro para las tarjetas («Higiene y cuidado personal» → «Higiene»). */
export function rubroCorto(rubro: string): string {
  return { 'Higiene y cuidado personal': 'Higiene', 'Limpieza del hogar': 'Limpieza', 'Galletas y dulces': 'Dulces' }[rubro] ?? rubro;
}
