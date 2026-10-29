/**
 * Los colores y medidas de la maqueta de compra (docs/uix-mockup/Abasto v1 (1).html), los mismos tokens
 * que packages/ui. Marca verde bosque hsl(158 64% 28%) = #1A7554; precios en ámbar.
 */
export const COLOR = {
  verde: '#1A7554',
  verdeFuerte: '#145E43',
  verdeSuave: '#E2F0E8',
  verdeTexto: '#155E44',
  tinta: '#123027',
  fondo: '#EEF3F0',
  superficie: '#FFFFFF',
  borde: '#D9E3DE',
  tenue: '#F4F8F6',
  texto: '#123027',
  texto2: '#45574F',
  texto3: '#5F7068',
  ambar: '#DC8F09',
  ambarTexto: '#8F5B00',
  ambarSuave: '#FCF1DA',
  rojo: '#C2362B',
  rojoSuave: '#FBE8E6',
  rojoTexto: '#A52A20',
  azulSuave: '#E4EEFA',
  rosaSuave: '#FBE9EE',
} as const;

export const RADIO = { chico: 10, medio: 14, grande: 18, tarjeta: 20 } as const;

/** Fondo de la foto mientras los productos no tengan imagen, según el rubro */
export const TINTES = {
  'tinte-verde': '#DCEFE5',
  'tinte-azul': '#E1ECF8',
  'tinte-ambar': '#FBEBCB',
  'tinte-rosa': '#F7E3EA',
} as const;

export const SOMBRA = {
  shadowColor: '#123027',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 8 },
  elevation: 2,
} as const;
