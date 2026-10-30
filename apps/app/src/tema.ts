/**
 * La identidad de ABASTO (30/10/2026, la eligió el usuario): un mercado mayorista fresco y con personalidad.
 * Lima #C9F45A (lo que se toca y lo que destaca), Bosque #182D25 (encabezados, textos y botones finales),
 * Ámbar #FFB454 (ofertas y descuentos) sobre un fondo crema verdoso #F2F7EB. Nada de menta ni azul.
 * Los nombres viejos (verde, menta…) apuntan a la paleta nueva para que todas las pantallas la tomen.
 */
export const COLOR = {
  // Bosque: encabezados, textos fuertes y botones de cierre («Continuar», «Agregar 1 fardo»)
  bosque: '#182D25',
  bosqueMedio: '#2C4A3D',
  verde: '#182D25',
  verdeFuerte: '#0F1F19',
  verdeSuave: '#EAF5D6',
  verdeTexto: '#182D25',
  tinta: '#182D25',
  // Lima: botones principales, lo elegido y la tarjeta protagonista (siempre con texto bosque encima)
  lima: '#C9F45A',
  limaFuerte: '#B4E03D',
  limaMedia: '#DDF59B',
  limaSuave: '#EEF8D5',
  limaTexto: '#3A4D00',
  // Compatibilidad: lo que antes era menta ahora es lima
  menta: '#C9F45A',
  mentaMedia: '#DDF59B',
  mentaClara: '#EEF8D5',
  // Ámbar: ofertas y descuentos
  ambar: '#FFB454',
  ambarTexto: '#7A4300',
  ambarSuave: '#FFF0D9',
  // Fondos y superficies
  fondo: '#F2F7EB',
  superficie: '#FFFFFF',
  borde: '#E2EBD5',
  tenue: '#F7FAF2',
  // Textos
  texto: '#182D25',
  texto2: '#43564B',
  texto3: '#717F76',
  // Avisos
  rojo: '#E0533D',
  rojoSuave: '#FDECE8',
  rojoTexto: '#A8331F',
  azulSuave: '#E7F1FA',
  rosaSuave: '#FCEFF1',
} as const;

/**
 * El bosque del encabezado del Inicio y de la pestaña activa (30/10, referencia `pedidosYa/image5.png`):
 * un verde bosque más vivo que el de los textos, en tres tonos para darle profundidad. Solo esas dos piezas lo usan.
 */
export const CABECERA = {
  oscuro: '#0B3027',
  medio: '#103F32',
  claro: '#1A5643',
} as const;

/** Plus Jakarta Sans en sus pesos. En Android, con una fuente propia hay que elegir el archivo del peso. */
export const FUENTE = {
  normal: 'PlusJakartaSans_500Medium',
  semi: 'PlusJakartaSans_600SemiBold',
  fuerte: 'PlusJakartaSans_700Bold',
  negra: 'PlusJakartaSans_800ExtraBold',
} as const;

/** La fuente que corresponde a un peso de CSS ('600', 'bold'…). */
export function fuenteDe(peso: string | number | undefined): string {
  const n = peso === 'bold' ? 700 : Number(peso ?? 500) || 500;
  return n >= 800 ? FUENTE.negra : n >= 700 ? FUENTE.fuerte : n >= 600 ? FUENTE.semi : FUENTE.normal;
}

export const RADIO = { chico: 12, medio: 16, grande: 20, tarjeta: 22 } as const;

/** Fondo de la foto del producto según el rubro: lima, ámbar, cielo y rosa muy suaves */
export const TINTES = {
  'tinte-verde': '#EEF8D5',
  'tinte-azul': '#E7F1FA',
  'tinte-ambar': '#FFF0D9',
  'tinte-rosa': '#FCEFF1',
} as const;

export const SOMBRA = {
  shadowColor: '#182D25',
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
} as const;
