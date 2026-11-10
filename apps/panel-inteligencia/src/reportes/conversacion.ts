import { encabezado, formatearCelda } from '../sesion';

/**
 * Reportes como conversación: a la izquierda el chat con el Analista; a la derecha la mesa de trabajo, donde cada
 * respuesta se arma como un reporte en su pestaña. Aquí está la lógica sin pantalla: qué plantilla usa cada
 * reporte, los números que se destacan y cómo se guarda la conversación mientras dura la sesión.
 */

/** Lo que responde el Asistente a una pregunta (contracts/openapi/asistente.yaml). */
export interface RespuestaDelAsistente {
  pregunta: string;
  sql: string;
  explicacion: string;
  grafico: string;
  columnas: string[];
  filas: Record<string, unknown>[];
  truncado: boolean;
  modelo: string;
}

export interface Reporte extends RespuestaDelAsistente {
  id: string;
  /** ISO: cuándo se respondió */
  hora: string;
  /** Si viene de lo guardado en el equipo (sin señal): de cuándo es */
  deGuardado?: string;
}

export type Mensaje =
  | { id: string; de: 'tu'; texto: string; hora: string; porVoz?: boolean; estado: 'enviada' | 'respondida' | 'espera-senal' }
  | { id: string; de: 'analista'; tipo: 'reporte'; texto: string; hora: string; reporteId: string }
  | { id: string; de: 'analista'; tipo: 'aclaracion'; texto: string; hora: string; opciones: string[] }
  | { id: string; de: 'analista'; tipo: 'falla' | 'aviso'; texto: string; hora: string };

export interface Conversacion {
  mensajes: Mensaje[];
  reportes: Reporte[];
  activa: string | null;
}

/** Cómo se muestra un reporte en la mesa. */
export type Plantilla = 'numeros' | 'barras' | 'linea' | 'tabla' | 'aviso' | 'vacio';

const esNumero = (v: unknown) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)));

export function plantillaDe(r: Pick<RespuestaDelAsistente, 'columnas' | 'filas' | 'grafico'>): Plantilla {
  if (!r.filas.length) return 'vacio';
  // «SELECT 'Sin datos para esa pregunta' AS aviso»: el Analista no tenía con qué responder
  if (r.columnas.length === 1 && r.columnas[0] === 'aviso') return 'aviso';
  // Una sola fila con números («¿cuánto vendí este mes?»): se leen mejor en grande que en una tabla de una fila
  if (r.filas.length === 1 && r.columnas.length <= 4 && r.columnas.some((c) => esNumero(r.filas[0][c]))) return 'numeros';
  if (r.grafico === 'barras' || r.grafico === 'linea') return r.grafico;
  return 'tabla';
}

export interface Destacado {
  etiqueta: string;
  valor: string;
  /** Texto chico debajo del número */
  detalle?: string;
}

/** Los números de un reporte de una sola fila, en grande. Los textos de esa fila van como detalle. */
export function numerosDe(r: Pick<RespuestaDelAsistente, 'columnas' | 'filas'>): Destacado[] {
  const fila = r.filas[0] ?? {};
  const textos = r.columnas.filter((c) => !esNumero(fila[c])).map((c) => formatearCelda(c, fila[c]));
  return r.columnas
    .filter((c) => esNumero(fila[c]))
    .map((c) => ({ etiqueta: encabezado(c), valor: formatearCelda(c, fila[c]), detalle: textos.join(' · ') || undefined }));
}

/**
 * Lo que resume un gráfico: el mayor y, si son montos, el total. Sumar otra cosa (un promedio, un riesgo) daría un
 * número que no significa nada, así que solo se suman bolivianos.
 */
export function resumenDe(r: Pick<RespuestaDelAsistente, 'columnas' | 'filas'>, columnaEtiqueta: string, columnaValor: string): Destacado[] {
  if (!r.filas.length) return [];
  const mayor = r.filas.reduce((a, b) => (Number(b[columnaValor] ?? 0) > Number(a[columnaValor] ?? 0) ? b : a));
  const destacados: Destacado[] = [
    {
      etiqueta: 'El mayor',
      valor: formatearCelda(columnaValor, mayor[columnaValor]),
      detalle: formatearCelda(columnaEtiqueta, mayor[columnaEtiqueta]),
    },
  ];
  if (columnaValor.endsWith('_centavos')) {
    const total = r.filas.reduce((s, f) => s + Number(f[columnaValor] ?? 0), 0);
    destacados.unshift({ etiqueta: 'Total', valor: formatearCelda(columnaValor, total), detalle: `${r.filas.length} filas` });
  }
  return destacados;
}

/** Título de la pestaña: la pregunta, corta y sin signos sueltos. */
export function tituloCorto(pregunta: string, maximo = 30): string {
  const limpia = pregunta.replace(/^[¿¡\s]+|[?!.\s]+$/g, '').trim();
  const titulo = limpia.charAt(0).toUpperCase() + limpia.slice(1);
  return titulo.length > maximo ? `${titulo.slice(0, maximo - 1).trimEnd()}…` : titulo;
}

/** «14:05» */
export function horaCorta(iso: string): string {
  const f = new Date(iso);
  return `${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}`;
}

let contador = 0;
export const nuevoId = () => `${Date.now().toString(36)}-${(contador++).toString(36)}`;

/** Preguntas para empezar. Todas salen bien con los datos de demostración. */
export const SUGERENCIAS = [
  { pregunta: '¿Qué tiendas me deben más plata?', plantilla: 'barras' as const, titulo: 'Quién te debe' },
  { pregunta: '¿Cuánto vendí cada semana en los últimos 3 meses?', plantilla: 'linea' as const, titulo: 'Ventas por semana' },
  { pregunta: '¿Cuánto vendí este mes?', plantilla: 'numeros' as const, titulo: 'Lo vendido este mes' },
  { pregunta: '¿Qué productos se me pueden acabar esta semana?', plantilla: 'tabla' as const, titulo: 'Lo que se puede acabar' },
];

// --- La conversación dura lo que la sesión del navegador: se puede ir a Pedidos y volver sin perderla ---

/** Más que esto no se guarda: la conversación es para seguir trabajando, lo viejo queda en «Guardados». */
const MAXIMO_DE_MENSAJES = 60;
const MAXIMO_DE_REPORTES = 8;
const MAXIMO_DE_FILAS = 200;

const clave = (orgId: string) => `abasto:inteligencia:conversacion:${orgId}`;

export const conversacionVacia = (): Conversacion => ({ mensajes: [], reportes: [], activa: null });

export function cargarConversacion(orgId: string): Conversacion {
  try {
    const crudo = globalThis.sessionStorage?.getItem(clave(orgId));
    const c = crudo ? (JSON.parse(crudo) as Conversacion) : null;
    return c && Array.isArray(c.mensajes) && Array.isArray(c.reportes) ? c : conversacionVacia();
  } catch {
    return conversacionVacia();
  }
}

export function guardarConversacion(orgId: string, c: Conversacion): void {
  const reportes = c.reportes.slice(-MAXIMO_DE_REPORTES).map((r) => ({
    ...r,
    filas: r.filas.slice(0, MAXIMO_DE_FILAS),
    truncado: r.truncado || r.filas.length > MAXIMO_DE_FILAS,
  }));
  const activa = reportes.some((r) => r.id === c.activa) ? c.activa : (reportes.at(-1)?.id ?? null);
  try {
    globalThis.sessionStorage?.setItem(clave(orgId), JSON.stringify({ mensajes: c.mensajes.slice(-MAXIMO_DE_MENSAJES), reportes, activa }));
  } catch {
    // Sin espacio o sin permiso: la conversación sigue, solo que no sobrevive a un cambio de pantalla
  }
}

export function borrarConversacion(orgId: string): void {
  try {
    globalThis.sessionStorage?.removeItem(clave(orgId));
  } catch {
    // nada que borrar
  }
}

/** Para la mesa: quita los reportes que sobran, empezando por los más viejos. */
export const recortarReportes = (reportes: Reporte[]) => reportes.slice(-MAXIMO_DE_REPORTES);
