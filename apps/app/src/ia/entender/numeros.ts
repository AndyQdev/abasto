/** Cantidades dichas como se hablan en Bolivia: «tres», «veinticinco», «dos y medio», «1/2», «2,5». */

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const PALABRAS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50,
  sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200,
  trescientos: 300, trescientas: 300, cuatrocientos: 400, quinientos: 500, quinientas: 500, mil: 1000,
  medio: 0.5, media: 0.5,
};

/** Una sola palabra o número: «tres» → 3, «2,5» → 2,5; «docena» no es número (es envase). */
export function numeroEnTexto(palabra: string): number | null {
  const p = sinTildes(palabra.trim());
  if (/^\d+([.,]\d+)?$/.test(p)) return Number(p.replace(',', '.'));
  return PALABRAS[p] ?? null;
}

const DECENAS = new Set([30, 40, 50, 60, 70, 80, 90]);

/**
 * La cantidad al principio del texto y lo que queda después: «3 cajas de aceite» → 3 y «cajas de aceite».
 * Entiende «treinta y dos», «dos y medio», «1/2» y «3/4». Sin cantidad al principio → null.
 */
export function leerCantidad(texto: string): { cantidad: number; resto: string } | null {
  const palabras = texto.trim().split(/\s+/);
  if (!palabras[0]) return null;

  const fraccion = palabras[0].match(/^(\d+)\/(\d+)$/);
  if (fraccion && Number(fraccion[2]) > 0) {
    return { cantidad: Number(fraccion[1]) / Number(fraccion[2]), resto: palabras.slice(1).join(' ') };
  }

  let cantidad = numeroEnTexto(palabras[0]);
  if (cantidad === null) return null;
  let usadas = 1;

  // «treinta y dos»
  if (DECENAS.has(cantidad) && sinTildes(palabras[1] ?? '') === 'y') {
    const unidad = numeroEnTexto(palabras[2] ?? '');
    if (unidad !== null && unidad >= 1 && unidad <= 9 && Number.isInteger(unidad)) {
      cantidad += unidad;
      usadas = 3;
    }
  }
  // «cien(to) cincuenta», «doscientos veinte», «mil quinientos»
  while (usadas < palabras.length && cantidad >= 100 && Number.isInteger(cantidad)) {
    const siguiente = numeroEnTexto(palabras[usadas]);
    if (siguiente === null || siguiente >= cantidad || !Number.isInteger(siguiente)) break;
    cantidad = cantidad === 1000 ? cantidad + siguiente : cantidad + siguiente;
    usadas += 1;
  }
  // «dos y medio»
  if (sinTildes(palabras[usadas] ?? '') === 'y' && ['medio', 'media'].includes(sinTildes(palabras[usadas + 1] ?? ''))) {
    cantidad += 0.5;
    usadas += 2;
  }
  return { cantidad, resto: palabras.slice(usadas).join(' ') };
}
