/** Lado de la imagen que espera el modelo (224×224, RGB). */
export const LADO = 224;

/** Recorte cuadrado centrado: el producto suele estar al medio de la foto y así no se deforma. */
export function recorteCentrado(ancho: number, alto: number): { originX: number; originY: number; width: number; height: number } {
  const lado = Math.min(ancho, alto);
  return { originX: Math.floor((ancho - lado) / 2), originY: Math.floor((alto - lado) / 2), width: lado, height: lado };
}

/**
 * Pasa los píxeles RGBA (como los da jpeg-js) a la entrada del modelo: RGB en float32 de 0 a 255.
 * MobileNetV3 normaliza por dentro, así que aquí no se divide entre 255.
 */
export function aEntradaDelModelo(rgba: Uint8Array, ancho: number, alto: number): Float32Array {
  if (ancho !== LADO || alto !== LADO) throw new Error(`La imagen tiene que ser de ${LADO}×${LADO} y es de ${ancho}×${alto}`);
  if (rgba.length !== ancho * alto * 4) throw new Error(`Se esperaban ${ancho * alto * 4} bytes RGBA y llegaron ${rgba.length}`);
  const rgb = new Float32Array(ancho * alto * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }
  return rgb;
}
