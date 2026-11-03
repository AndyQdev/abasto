/**
 * Reportes sin señal. La voz ya se transcribe dentro del navegador (Whisper), pero responder necesita al
 * Asistente: sin red la pregunta queda en una cola y se responde sola al volver la señal. Mientras tanto se
 * pueden ver los últimos reportes guardados en este equipo.
 *
 * Se guarda en localStorage por empresa (solo resultados que el usuario ya vio, nada de la sesión). Si el
 * navegador no deja guardar (modo privado), la pantalla funciona igual, solo que sin memoria.
 */

/** Lo que se guarda de una respuesta del Asistente (la misma forma que muestra Reportes). */
export interface ReporteGuardado {
  pregunta: string;
  sql: string;
  explicacion: string;
  grafico: string;
  columnas: string[];
  filas: Record<string, unknown>[];
  truncado: boolean;
  modelo: string;
  /** ISO: cuándo se respondió con señal */
  guardadoEn: string;
}

export const MAXIMO_GUARDADOS = 10;
/** Más filas no se guardan: el reporte guardado es para mirar, no para exportar */
const MAXIMO_DE_FILAS = 200;

const clave = (orgId: string, que: 'reportes' | 'pendientes') => `abasto:inteligencia:${que}:${orgId}`;

function leer<T>(nombre: string): T[] {
  try {
    const crudo = globalThis.localStorage?.getItem(nombre);
    return crudo ? (JSON.parse(crudo) as T[]) : [];
  } catch {
    return [];
  }
}

function escribir(nombre: string, valor: unknown[]): void {
  try {
    globalThis.localStorage?.setItem(nombre, JSON.stringify(valor));
  } catch {
    // Sin espacio o sin permiso: se sigue sin guardar
  }
}

/** «¿Qué tiendas…?» y «que tiendas» son la misma pregunta. */
export function normalizarPregunta(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function reportesGuardados(orgId: string): ReporteGuardado[] {
  return leer<ReporteGuardado>(clave(orgId, 'reportes'));
}

/** Guarda la respuesta al principio; la misma pregunta reemplaza a la vieja. */
export function guardarReporte(orgId: string, reporte: Omit<ReporteGuardado, 'guardadoEn'>, ahora = new Date()): void {
  const nuevo: ReporteGuardado = {
    ...reporte,
    filas: reporte.filas.slice(0, MAXIMO_DE_FILAS),
    truncado: reporte.truncado || reporte.filas.length > MAXIMO_DE_FILAS,
    guardadoEn: ahora.toISOString(),
  };
  const igual = normalizarPregunta(reporte.pregunta);
  const resto = reportesGuardados(orgId).filter((r) => normalizarPregunta(r.pregunta) !== igual);
  escribir(clave(orgId, 'reportes'), [nuevo, ...resto].slice(0, MAXIMO_GUARDADOS));
}

/** El último reporte guardado de esa misma pregunta, si hay. */
export function buscarGuardado(orgId: string, pregunta: string): ReporteGuardado | null {
  const igual = normalizarPregunta(pregunta);
  return reportesGuardados(orgId).find((r) => normalizarPregunta(r.pregunta) === igual) ?? null;
}

export function preguntasPendientes(orgId: string): string[] {
  return leer<string>(clave(orgId, 'pendientes'));
}

/** Encola una pregunta hecha sin señal; si ya estaba, no se repite. */
export function encolarPregunta(orgId: string, pregunta: string): string[] {
  const igual = normalizarPregunta(pregunta);
  const cola = preguntasPendientes(orgId).filter((p) => normalizarPregunta(p) !== igual);
  const nueva = [...cola, pregunta.trim()];
  escribir(clave(orgId, 'pendientes'), nueva);
  return nueva;
}

export function quitarPendiente(orgId: string, pregunta: string): string[] {
  const igual = normalizarPregunta(pregunta);
  const cola = preguntasPendientes(orgId).filter((p) => normalizarPregunta(p) !== igual);
  escribir(clave(orgId, 'pendientes'), cola);
  return cola;
}

/** ¿Falló por falta de red (y no porque el Asistente dijo que no)? fetch lanza TypeError cuando no hay conexión. */
export function esFaltaDeRed(error: unknown): boolean {
  return error instanceof TypeError || (typeof navigator !== 'undefined' && navigator.onLine === false);
}

/** «03/11 18:40» para decir de cuándo es un reporte guardado. */
export function cuandoSeGuardo(iso: string): string {
  const f = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(f.getDate())}/${dos(f.getMonth() + 1)} ${dos(f.getHours())}:${dos(f.getMinutes())}`;
}
