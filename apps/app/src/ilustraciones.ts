/**
 * Las ilustraciones «Gibby» de la app (3D tipo película animada, con la paleta de Abasto).
 * Se generan una sola vez con `scripts/ilustraciones` (ver apps/app/ilustraciones.json); la app nunca llama a Gemini.
 */
/** Un recurso empaquetado con require(): para React Native es un número. */
type Recurso = number;

/** Lo que se le pasa a <Image>: una ilustración empaquetada o la foto real que sirve Catálogo. */
export type Imagen = Recurso | { uri: string };

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
  // El repartidor del banner de entrega sirve también para «en camino»
  pedidoEnCamino: require('../assets/ilustraciones/banner-entrega.webp'),
  pedidoEntregado: require('../assets/ilustraciones/pedido-entregado.webp'),
  sinSenal: require('../assets/ilustraciones/sin-senal.webp'),
  comprarOtraVez: require('../assets/ilustraciones/comprar-otra-vez.webp'),
  cabeceraMercado: require('../assets/ilustraciones/cabecera-mercado.webp'),
  bannerMercado: require('../assets/ilustraciones/banner-mercado.webp'),
} satisfies Record<string, Recurso>;

const PRESENTACIONES: Record<string, Recurso> = {
  DOCENA: require('../assets/ilustraciones/presentacion-docena.webp'),
  CAJA: require('../assets/ilustraciones/presentacion-caja.webp'),
  FARDO: require('../assets/ilustraciones/presentacion-fardo.webp'),
};

/** La imagen de una presentación (docena, caja, fardo); la unidad y la cuarta muestran el producto. */
export function imagenDePresentacion(presentacion: string, rubro: string): Recurso {
  return PRESENTACIONES[presentacion] ?? imagenDeRubro(rubro);
}

const RUBROS: Record<string, Recurso> = {
  Abarrotes: require('../assets/ilustraciones/rubro-abarrotes.webp'),
  Bebidas: require('../assets/ilustraciones/rubro-bebidas.webp'),
  'Cosméticos': require('../assets/ilustraciones/rubro-cosmeticos.webp'),
  'Galletas y dulces': require('../assets/ilustraciones/rubro-galletas-y-dulces.webp'),
  'Higiene y cuidado personal': require('../assets/ilustraciones/rubro-higiene.webp'),
  'Limpieza del hogar': require('../assets/ilustraciones/rubro-limpieza.webp'),
  'Lácteos': require('../assets/ilustraciones/rubro-lacteos.webp'),
  Varios: require('../assets/ilustraciones/rubro-varios.webp'),
  // Rubros del que cocina (01/11)
  'Harinas y panificación': require('../assets/ilustraciones/rubro-harinas.webp'),
  'Aceites y grasas': require('../assets/ilustraciones/rubro-aceites.webp'),
  'Granos y cereales': require('../assets/ilustraciones/rubro-abarrotes.webp'),
  Condimentos: require('../assets/ilustraciones/rubro-condimentos.webp'),
  'Huevos y lácteos': require('../assets/ilustraciones/rubro-lacteos.webp'),
  'Verduras secas': require('../assets/ilustraciones/rubro-verduras.webp'),
  Descartables: require('../assets/ilustraciones/rubro-descartables.webp'),
};

/** La imagen del rubro; si es un rubro nuevo, la de Varios. */
export function imagenDeRubro(rubro: string): Recurso {
  return RUBROS[rubro] ?? RUBROS.Varios;
}

/** La foto real del producto; si todavía no tiene, la ilustración de su rubro. */
export function fotoDe(producto: { rubro: string; foto?: string | null }): Imagen {
  return producto.foto ? { uri: producto.foto } : imagenDeRubro(producto.rubro);
}

/** Nombre corto del rubro para las tarjetas («Higiene y cuidado personal» → «Higiene»). */
export function rubroCorto(rubro: string): string {
  return (
    {
      'Higiene y cuidado personal': 'Higiene',
      'Limpieza del hogar': 'Limpieza',
      'Galletas y dulces': 'Dulces',
      'Harinas y panificación': 'Harinas',
      'Aceites y grasas': 'Aceites',
      'Granos y cereales': 'Granos',
      'Huevos y lácteos': 'Huevos y leche',
      'Verduras secas': 'Verduras',
    }[rubro] ?? rubro
  );
}
