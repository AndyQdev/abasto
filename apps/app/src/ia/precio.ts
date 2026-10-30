/**
 * Lee el precio que el OCR (ML Kit, en el teléfono) encontró en el cartel del puesto.
 * Acepta «Bs 18,50», «18.50», «Bs.18», «18 bs». Devuelve centavos o null si no hay un precio claro.
 */
export function leerPrecio(texto: string): number | null {
  const limpio = texto.replace(/\s+/g, ' ');
  const candidatos = [...limpio.matchAll(/(?:bs\.?\s*)?(\d{1,5})(?:[.,](\d{1,2}))?\s*(bs)?/gi)]
    .filter((m) => /bs/i.test(m[0]) || m[2] !== undefined)
    .map((m) => Number(m[1]) * 100 + (m[2] ? Number(m[2].padEnd(2, '0')) : 0))
    .filter((c) => c > 0);
  return candidatos.length ? candidatos[0] : null;
}

export function enBolivianos(centavos: number): string {
  return `Bs ${(centavos / 100).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
