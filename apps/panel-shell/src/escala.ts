/**
 * El Panel se diseñó sobre la maqueta v7 (pantalla ancha). En una laptop con menos ancho útil se veía todo
 * agrandado y había que bajar el zoom del navegador al 75 %. Ahora el Panel se achica solo: en escritorio
 * siempre se ve como en una pantalla de 2000 px (Andrés lo validó: 1520 px útiles + zoom 75 %), y en el teléfono
 * (860 px o menos) no se toca. Abajo de 0,7 no baja para que el texto se siga leyendo.
 */
export const ANCHO_DE_DISENO = 2000;
export const ESCALA_MINIMA = 0.7;
export const ANCHO_DE_TELEFONO = 860;

/** Cuánto achicar según el ancho de la ventana: 1 en pantallas grandes y en el teléfono. */
export function escalaPara(ancho: number): number {
  if (ancho <= ANCHO_DE_TELEFONO) return 1;
  return Math.min(1, Math.max(ESCALA_MINIMA, Math.round((ancho / ANCHO_DE_DISENO) * 100) / 100));
}

/** Aplica la escala con zoom en la raíz (el mismo efecto que el zoom del navegador) y la sigue al cambiar la ventana. */
export function seguirLaEscala() {
  const aplicar = () => {
    document.documentElement.style.setProperty('zoom', String(escalaPara(window.innerWidth)));
  };
  aplicar();
  window.addEventListener('resize', aplicar);
}
