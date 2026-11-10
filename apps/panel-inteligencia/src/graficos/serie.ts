/**
 * Arma la serie que se dibuja a partir del resultado de una pregunta: una columna de etiquetas (texto o fecha)
 * y una de valores (número). Si el resultado no tiene esa forma, no hay gráfico y se ve solo la tabla.
 */
export interface PuntoDeSerie {
  etiqueta: unknown;
  valor: number;
}

export interface Serie {
  columnaEtiqueta: string;
  columnaValor: string;
  puntos: PuntoDeSerie[];
}

/** Más barras que esto no se leen; se muestran las mayores. */
export const MAXIMO_DE_BARRAS = 12;

const esNumero = (v: unknown) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)));

export function armarSerie(columnas: string[], filas: Record<string, unknown>[], tipo: string): Serie | null {
  if (tipo !== 'barras' && tipo !== 'linea' && tipo !== 'dona') return null;
  if (!filas.length) return null;

  const numericas = columnas.filter((c) => filas.every((f) => f[c] === null || esNumero(f[c])));
  // Montos primero: si la pregunta trae cantidad y total, lo que se quiere ver es el total
  // El «_anterior» de los KPIs es para comparar, no para dibujar
  const propias = numericas.filter((c) => !c.endsWith('_anterior'));
  const columnaValor = propias.find((c) => c.endsWith('_centavos')) ?? propias[0];
  // El nombre se lee mejor que el código: con tienda_id y tienda_nombre, las barras dicen «Minimarket El Cruce», no «ec»
  const textos = columnas.filter((c) => !numericas.includes(c));
  const columnaEtiqueta = textos.find((c) => /nombre$/.test(c)) ?? textos.find((c) => !/(^|_)id$/.test(c)) ?? textos[0];
  if (!columnaValor || !columnaEtiqueta) return null;

  let puntos = filas.map((f) => ({ etiqueta: f[columnaEtiqueta], valor: Number(f[columnaValor] ?? 0) }));
  if (tipo === 'barras' && puntos.length > MAXIMO_DE_BARRAS) {
    puntos = [...puntos].sort((a, b) => b.valor - a.valor).slice(0, MAXIMO_DE_BARRAS);
  }
  return { columnaEtiqueta, columnaValor, puntos };
}
