/**
 * La silueta del header «Halo» (maqueta v7, image3.png): una banda verde con los dos extremos redondeados
 * (el del logo y el del perfil), un «cuello» que sube entre cada extremo y el menú, y una panza que baja
 * a abrazar el menú flotante. No sale con border-radius: se dibuja con un path según el ancho real.
 */
export const ALTO_EXTREMOS = 124; // donde terminan el lado del logo y el del perfil (dos «bulbos» redondos)
export const ALTO_CUELLO = 96; // la curva que sube entre cada extremo y el menú
export const ALTO_PANZA = 132; // lo que baja el verde detrás del menú
const RADIO = 60; // esquinas de arriba
const BULBO = 64; // esquinas de abajo: más redondas, como la maqueta

const r = (n: number) => Math.round(n * 10) / 10;

/** El path SVG de la silueta para un header de `ancho` px con un menú de `menu` px centrado. */
export function formaDelHalo(ancho: number, menu: number): string {
  const c = ancho / 2;
  const izq = c - menu / 2;
  const der = c + menu / 2;
  // Lo que queda entre la esquina y el menú: si es poco, las curvas se acortan para no cruzarse
  const lado = Math.max(40, Math.min(240, izq - BULBO - 20));
  const k = lado / 240;
  const [a, b, d] = [r(240 * k), r(170 * k), r(110 * k)];
  const p = [
    `M${RADIO} 0`,
    `H${r(ancho - RADIO)}`,
    `C${r(ancho - RADIO * 0.45)} 0 ${ancho} ${r(RADIO * 0.45)} ${ancho} ${RADIO}`,
    `V${ALTO_EXTREMOS - BULBO}`,
    `C${ancho} ${r(ALTO_EXTREMOS - BULBO * 0.45)} ${r(ancho - BULBO * 0.45)} ${ALTO_EXTREMOS} ${r(ancho - BULBO)} ${ALTO_EXTREMOS}`,
    // Lado del perfil → cuello → panza
    `H${r(der + a)}`,
    `C${r(der + b)} ${ALTO_EXTREMOS} ${r(der + d + 30)} ${ALTO_CUELLO} ${r(der + d)} ${ALTO_CUELLO}`,
    `C${r(der + 36)} ${ALTO_CUELLO} ${r(der + 26)} ${ALTO_PANZA} ${r(der - 34)} ${ALTO_PANZA}`,
    `H${r(izq + 34)}`,
    // Panza → cuello → lado del logo
    `C${r(izq - 26)} ${ALTO_PANZA} ${r(izq - 36)} ${ALTO_CUELLO} ${r(izq - d)} ${ALTO_CUELLO}`,
    `C${r(izq - d - 30)} ${ALTO_CUELLO} ${r(izq - b)} ${ALTO_EXTREMOS} ${r(izq - a)} ${ALTO_EXTREMOS}`,
    `H${BULBO}`,
    `C${r(BULBO * 0.45)} ${ALTO_EXTREMOS} 0 ${r(ALTO_EXTREMOS - BULBO * 0.45)} 0 ${ALTO_EXTREMOS - BULBO}`,
    `V${RADIO}`,
    `C0 ${r(RADIO * 0.45)} ${r(RADIO * 0.45)} 0 ${RADIO} 0`,
    'Z',
  ];
  return p.join(' ');
}
