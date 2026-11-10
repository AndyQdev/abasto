/**
 * La marca de Abasto (10/11): una «A» lima cuyo travesaño es un paquete ámbar. Abasto lleva la mercadería a la
 * tienda; la «A» es el techo del puesto y el paquete, lo que llega.
 *
 * Fuente única: de aquí salen el símbolo de las webs (Panel y Superadmin), el logo de la app (`apps/app/src/Marca.tsx`)
 * y todos los íconos (app, Android, notificación, PWA y favicons) con `pnpm marca` (`scripts/marca.ts`).
 * Guía de uso: `docs/marca/README.md`.
 */
export const COLOR = {
  lima: '#C9F45A',
  bosque: '#182D25',
  ambar: '#FFB454',
  fondo: '#F2F7EB',
  blanco: '#FFFFFF',
} as const;

/** El dibujo, en una caja de 100 × 100. Las patas son un trazo redondeado; el paquete se monta encima con un hueco. */
export const SIMBOLO = {
  patas: 'M19 82 L50 17 L81 82',
  grosor: 15.5,
  /** Lo que se recorta de las patas alrededor del paquete (así se separan sobre cualquier fondo) */
  hueco: { x: 29.5, y: 51, ancho: 41, alto: 26, radio: 6.5 },
  paquete: { x: 33, y: 54.5, ancho: 34, alto: 19, radio: 4 },
  /** La cinta del paquete: una muesca arriba, al centro */
  cinta: { x: 47.6, y: 54.5, ancho: 4.8, alto: 7 },
} as const;

export interface Tinta {
  patas: string;
  paquete: string;
  /** null: sin cinta (en una sola tinta no se distingue) */
  cinta: string | null;
}

export const TINTAS = {
  /** Sobre verde bosque (íconos, cabecera de la app, Superadmin) */
  sobreOscuro: { patas: COLOR.lima, paquete: COLOR.ambar, cinta: COLOR.bosque },
  /** Sobre blanco o el fondo claro */
  sobreClaro: { patas: COLOR.bosque, paquete: COLOR.ambar, cinta: COLOR.bosque },
  /** Una sola tinta: notificaciones de Android y el ícono monocromo */
  blanco: { patas: COLOR.blanco, paquete: COLOR.blanco, cinta: null },
} as const satisfies Record<string, Tinta>;

/** Un rectángulo redondeado como path (para el recorte) */
export function rectanguloRedondeado({ x, y, ancho, alto, radio }: { x: number; y: number; ancho: number; alto: number; radio: number }): string {
  const r = radio;
  return (
    `M${x + r} ${y}H${x + ancho - r}A${r} ${r} 0 0 1 ${x + ancho} ${y + r}V${y + alto - r}` +
    `A${r} ${r} 0 0 1 ${x + ancho - r} ${y + alto}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + alto - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
  );
}

/** El recorte de las patas: todo menos el hueco del paquete (con `clip-rule: evenodd`) */
export const RECORTE = `M-20 -20H120V120H-20Z ${rectanguloRedondeado(SIMBOLO.hueco)}`;

export interface OpcionesDeSvg {
  tinta?: Tinta;
  /** Fondo detrás del símbolo; sin fondo queda transparente */
  fondo?: { color: string; /** 0 = cuadrado; 0.27 = el cuadrado redondeado del ícono */ radio: number };
  /** Cuánto ocupa el símbolo de la caja (1 = entero). Los íconos de Android piden margen. */
  escala?: number;
  /** id del recorte: tiene que ser único si hay varios símbolos en la misma página */
  id?: string;
  tamano?: number;
}

/** El símbolo como SVG (para archivos, favicons y donde no hay React) */
export function simboloSvg({ tinta = TINTAS.sobreOscuro, fondo, escala = 1, id = 'abasto-recorte', tamano }: OpcionesDeSvg = {}): string {
  const s = SIMBOLO;
  const margen = (100 - 100 * escala) / 2;
  const medida = tamano ? ` width="${tamano}" height="${tamano}"` : '';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${medida}>`,
    `<defs><clipPath id="${id}"><path clip-rule="evenodd" d="${RECORTE}"/></clipPath></defs>`,
    fondo ? `<rect width="100" height="100" rx="${100 * fondo.radio}" fill="${fondo.color}"/>` : '',
    `<g transform="translate(${margen} ${margen}) scale(${escala})">`,
    `<path d="${s.patas}" fill="none" stroke="${tinta.patas}" stroke-width="${s.grosor}" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#${id})"/>`,
    `<rect x="${s.paquete.x}" y="${s.paquete.y}" width="${s.paquete.ancho}" height="${s.paquete.alto}" rx="${s.paquete.radio}" fill="${tinta.paquete}"/>`,
    tinta.cinta ? `<rect x="${s.cinta.x}" y="${s.cinta.y}" width="${s.cinta.ancho}" height="${s.cinta.alto}" fill="${tinta.cinta}"/>` : '',
    `</g></svg>`,
  ].join('');
}

/** El ícono: el símbolo lima y ámbar sobre el cuadrado redondeado verde bosque */
export const iconoSvg = (opciones: Omit<OpcionesDeSvg, 'fondo' | 'tinta'> = {}) =>
  simboloSvg({ escala: 0.72, ...opciones, tinta: TINTAS.sobreOscuro, fondo: { color: COLOR.bosque, radio: 0.27 } });

/** La palabra: Plus Jakarta Sans ExtraBold, en minúsculas y apretada */
export const PALABRA = { texto: 'abasto', peso: 800, espaciado: '-0.035em' } as const;
