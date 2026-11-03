/**
 * La silueta del header «Halo», calcada de la maqueta v7 (image3.png, midiendo el borde columna por columna):
 * - los extremos del logo y del perfil son redondos y bajan hasta ALTO_EXTREMOS;
 * - entre cada extremo y el menú el verde sube apenas (ALTO_CUELLO) en una curva ancha y suave;
 * - junto al menú vuelve a bajar despacio (unos 100 px de curva) y se mete detrás de él (ALTO_PANZA).
 * No sale con border-radius: se dibuja con un path según el ancho real del header y del menú.
 */
export const ALTO_EXTREMOS = 116; // fondo de los extremos redondos
export const ALTO_CUELLO = 101; // lo más alto de la curva entre el extremo y el menú
export const ALTO_PANZA = 134; // donde el verde toca el costado del menú
const ESQUINA = 56; // esquinas de arriba
const BULBO = 92; // la curva del extremo, de costado hasta el fondo

// Distancias horizontales desde el borde del menú, medidas en la maqueta
const HASTA_EL_CUELLO = 116;
const HASTA_EL_EXTREMO = 275;

const r = (n: number) => Math.round(n * 10) / 10;

/** El path SVG de la silueta para un header de `ancho` px con un menú de `menu` px centrado. */
export function formaDelHalo(ancho: number, menu: number): string {
  const c = ancho / 2;
  const izq = c - menu / 2;
  const der = c + menu / 2;
  // Si queda poco lugar entre el extremo y el menú, las curvas se encogen en proporción para no cruzarse
  const k = Math.max(0.3, Math.min(1, (izq - BULBO - 10) / HASTA_EL_EXTREMO));
  const cuello = HASTA_EL_CUELLO * k;
  const extremo = HASTA_EL_EXTREMO * k;
  const medio = (cuello + extremo) / 2;
  const bajaBulbo = ALTO_EXTREMOS - ESQUINA; // tramo vertical que cubre la curva del extremo

  return [
    `M${ESQUINA} 0`,
    `H${r(ancho - ESQUINA)}`,
    // Esquina de arriba a la derecha
    `C${r(ancho - ESQUINA * 0.45)} 0 ${ancho} ${r(ESQUINA * 0.45)} ${ancho} ${ESQUINA}`,
    // El extremo del perfil: una curva ancha hasta su fondo
    `C${ancho} ${r(ESQUINA + bajaBulbo * 0.55)} ${r(ancho - BULBO * 0.45)} ${ALTO_EXTREMOS} ${r(ancho - BULBO)} ${ALTO_EXTREMOS}`,
    `H${r(der + extremo)}`,
    // Sube suave hasta el cuello…
    `C${r(der + medio)} ${ALTO_EXTREMOS} ${r(der + medio)} ${ALTO_CUELLO} ${r(der + cuello)} ${ALTO_CUELLO}`,
    // …y baja despacio hasta tocar el costado del menú
    `C${r(der + cuello * 0.45)} ${ALTO_CUELLO} ${r(der + 12 * k)} ${r(ALTO_PANZA - 13)} ${r(der - 6)} ${ALTO_PANZA}`,
    `H${r(izq + 6)}`,
    // El mismo camino del lado del logo
    `C${r(izq - 12 * k)} ${r(ALTO_PANZA - 13)} ${r(izq - cuello * 0.45)} ${ALTO_CUELLO} ${r(izq - cuello)} ${ALTO_CUELLO}`,
    `C${r(izq - medio)} ${ALTO_CUELLO} ${r(izq - medio)} ${ALTO_EXTREMOS} ${r(izq - extremo)} ${ALTO_EXTREMOS}`,
    `H${BULBO}`,
    `C${r(BULBO * 0.45)} ${ALTO_EXTREMOS} 0 ${r(ESQUINA + bajaBulbo * 0.55)} 0 ${ESQUINA}`,
    `C0 ${r(ESQUINA * 0.45)} ${r(ESQUINA * 0.45)} 0 ${ESQUINA} 0`,
    'Z',
  ].join(' ');
}
