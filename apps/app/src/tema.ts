/**
 * La identidad de ABASTO (30/10/2026): turquesa menta como color de marca, botones en verde lima #C9F45A
 * con texto verde oscuro, y el verde oscuro para los contrastes fuertes (barras, contadores, textos).
 * Los nombres viejos (verde, tinta…) se mantienen para que todas las pantallas tomen la paleta nueva.
 */
export const COLOR = {
  // Acciones y confianza: verde oscuro
  verde: '#103F32',
  verdeFuerte: '#0A2C23',
  verdeSuave: '#E4F8F2',
  verdeTexto: '#103F32',
  tinta: '#103F32',
  // Marca: turquesa menta
  menta: '#64DDC5',
  mentaMedia: '#A6EDDE',
  mentaClara: '#E4F8F2',
  // Botones principales, lo elegido y las promociones: verde lima, siempre con texto verde oscuro encima
  lima: '#C9F45A',
  limaFuerte: '#B2E03C',
  limaSuave: '#EEFBC8',
  limaTexto: '#3A4D00',
  // Fondos y superficies
  fondo: '#F0FAF8',
  superficie: '#FFFFFF',
  borde: '#DCEFE9',
  tenue: '#F0FAF8',
  // Textos: azul petróleo casi negro
  texto: '#1A2940',
  texto2: '#44536A',
  texto3: '#6E7C90',
  // Avisos
  ambar: '#E8A21B',
  ambarTexto: '#8A5A00',
  ambarSuave: '#FFF4DC',
  rojo: '#D64545',
  rojoSuave: '#FDECEC',
  rojoTexto: '#A62B2B',
  azulSuave: '#E3F4FA',
  rosaSuave: '#FCEFF1',
} as const;

/** Manrope en sus pesos. En Android, con una fuente propia hay que elegir el archivo del peso (fontWeight no basta). */
export const FUENTE = {
  normal: 'Manrope_500Medium',
  semi: 'Manrope_600SemiBold',
  fuerte: 'Manrope_700Bold',
  negra: 'Manrope_800ExtraBold',
} as const;

/** La fuente que corresponde a un peso de CSS ('600', 'bold'…). */
export function fuenteDe(peso: string | number | undefined): string {
  const n = peso === 'bold' ? 700 : Number(peso ?? 500) || 500;
  return n >= 800 ? FUENTE.negra : n >= 700 ? FUENTE.fuerte : n >= 600 ? FUENTE.semi : FUENTE.normal;
}

export const RADIO = { chico: 12, medio: 16, grande: 20, tarjeta: 22 } as const;

/** Fondo de la foto del producto según el rubro: tonos menta, cielo, lima y rosa muy suaves */
export const TINTES = {
  'tinte-verde': '#E4F8F2',
  'tinte-azul': '#E3F4FA',
  'tinte-ambar': '#F3FAD9',
  'tinte-rosa': '#FCEFF1',
} as const;

export const SOMBRA = {
  shadowColor: '#0E3B4A',
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
} as const;
