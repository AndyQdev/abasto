/**
 * Plantillas de la mesa de trabajo (como las de Fifi en glow): el modelo de lenguaje elige cada bloque y escribe su
 * consulta; aquí se decide si los datos que volvieron encajan en esa plantilla. Si no encajan, el bloque se dibuja
 * con la siguiente que sí (una dona de 20 partes pasa a barras) y lleva un aviso. Es puro: lo usan el Asistente y
 * las pruebas.
 */
export const PLANTILLAS = ['kpis', 'linea', 'barras', 'dona', 'tabla'] as const;
export type Plantilla = (typeof PLANTILLAS)[number];

export interface DatosDeBloque {
  columnas: string[];
  filas: Record<string, unknown>[];
}

/** Más números que esto en una fila ya no son KPIs: es una tabla. */
export const MAXIMO_DE_KPIS = 6;
/** Una dona con más partes no se lee. */
export const MAXIMO_DE_PARTES = 8;
export const SUFIJO_ANTERIOR = '_anterior';

const esNumero = (v: unknown) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)));

/** Columnas con números en todas las filas (Postgres manda bigint y numeric como texto: «133000» cuenta). */
export const columnasNumericas = (d: DatosDeBloque) =>
  d.columnas.filter((c) => d.filas.some((f) => f[c] !== null && f[c] !== undefined) && d.filas.every((f) => f[c] === null || f[c] === undefined || esNumero(f[c])));

/** La columna que nombra cada fila: el nombre antes que el id («Minimarket El Cruce», no «ec»). */
export function columnaDeEtiqueta(d: DatosDeBloque): string | undefined {
  const numericas = new Set(columnasNumericas(d));
  const textos = d.columnas.filter((c) => !numericas.has(c));
  return textos.find((c) => /nombre$/.test(c)) ?? textos.find((c) => !/(^|_)id$/.test(c)) ?? textos[0];
}

/** Lo que se mide: los montos primero, y nunca la columna «_anterior» (esa es para comparar). */
export function columnaDeValor(d: DatosDeBloque): string | undefined {
  const numericas = columnasNumericas(d).filter((c) => !c.endsWith(SUFIJO_ANTERIOR));
  return numericas.find((c) => c.endsWith('_centavos')) ?? numericas[0];
}

/** Fechas («2026-11-01», el ISO de date_trunc) o una columna que por su nombre es un período. */
const esDelTiempo = (d: DatosDeBloque, columna: string) =>
  /(^|_)(fecha|dia|semana|mes|anio|periodo|hora)(_|$)/.test(columna) ||
  d.filas.every((f) => f[columna] instanceof Date || (typeof f[columna] === 'string' && /^\d{4}-\d{2}-\d{2}/.test(f[columna] as string)));

/** Por qué estos datos no se pueden dibujar con esa plantilla; null si encajan. Sin filas no es desencaje. */
export function porQueNoEncaja(plantilla: Plantilla, d: DatosDeBloque): string | null {
  if (!d.filas.length || plantilla === 'tabla') return null;
  const numericas = columnasNumericas(d);
  if (plantilla === 'kpis') {
    if (d.filas.length !== 1) return 'Los números grandes son para una sola fila';
    const propias = numericas.filter((c) => !c.endsWith(SUFIJO_ANTERIOR));
    if (!propias.length) return 'No hay números para mostrar';
    if (propias.length > MAXIMO_DE_KPIS) return `Más de ${MAXIMO_DE_KPIS} números se leen mejor en una tabla`;
    return null;
  }
  if (!columnaDeValor(d)) return 'No hay una columna con números para dibujar';
  if (!columnaDeEtiqueta(d)) return 'No hay una columna que nombre cada fila';
  if (plantilla === 'linea') {
    if (d.filas.length < 3) return 'Una línea necesita al menos 3 puntos';
    if (!esDelTiempo(d, columnaDeEtiqueta(d)!)) return 'Una línea es para ver cómo cambia algo en el tiempo';
  }
  if (plantilla === 'dona') {
    if (d.filas.length < 2) return 'Una dona necesita al menos 2 partes';
    if (d.filas.length > MAXIMO_DE_PARTES) return `Una dona de más de ${MAXIMO_DE_PARTES} partes no se lee`;
    const valor = columnaDeValor(d)!;
    const valores = d.filas.map((f) => Number(f[valor] ?? 0));
    if (valores.some((v) => v < 0)) return 'Una dona no puede tener partes negativas';
    if (valores.reduce((a, b) => a + b, 0) <= 0) return 'Las partes no suman nada';
    if (/(promedio|riesgo|por_ciento|porcentaje|tasa)/.test(valor)) return 'Un promedio o un porcentaje no se reparte en una dona';
  }
  return null;
}

/** A dónde cae cada plantilla si no encaja, en orden. La tabla dibuja cualquier cosa. */
const SIGUIENTES: Record<Plantilla, Plantilla[]> = {
  kpis: ['tabla'],
  linea: ['barras', 'tabla'],
  barras: ['tabla'],
  dona: ['barras', 'tabla'],
  tabla: [],
};

export interface Eleccion {
  plantilla: Plantilla;
  /** Si no se pudo usar la que pidió el modelo: por qué */
  aviso?: string;
}

export function elegirPlantilla(pedida: Plantilla, d: DatosDeBloque): Eleccion {
  const motivo = porQueNoEncaja(pedida, d);
  if (!motivo) return { plantilla: pedida };
  const otra = SIGUIENTES[pedida].find((p) => !porQueNoEncaja(p, d)) ?? 'tabla';
  return { plantilla: otra, aviso: motivo };
}

/** Con qué otras plantillas se puede ver el mismo bloque («Ver como»). */
export const alternativasDe = (d: DatosDeBloque): Plantilla[] =>
  d.filas.length ? PLANTILLAS.filter((p) => !porQueNoEncaja(p, d)) : ['tabla'];

/** El tipo de gráfico de antes (`grafico` en la respuesta), para lo que todavía lo lee. */
export const graficoDe = (p: Plantilla): 'tabla' | 'barras' | 'linea' => (p === 'linea' ? 'linea' : p === 'barras' || p === 'dona' ? 'barras' : 'tabla');

/** De `grafico` (lo que daba el modelo antes) a plantilla. */
export const plantillaDeGrafico = (g: string): Plantilla => (g === 'linea' || g === 'barras' ? g : 'tabla');
