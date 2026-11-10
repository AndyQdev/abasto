/**
 * Qué modelo de lenguaje le toca a cada teléfono. Puro: sin React Native, se prueba con jest.
 *
 * Un modelo nuevo se suma agregando una entrada en `modelos.json` (GGUF + proyector de visión): el motor
 * (llama.rn) y el resto de la IA no cambian.
 */
import MANIFIESTO from './modelos.json';

export type Nivel = 'ninguno' | 'basico' | 'medio' | 'alto' | 'maximo';
export type Tarea = 'texto' | 'vision';

export interface ArchivoDeModelo {
  /** Ruta relativa a la base de descarga (Hugging Face o un espejo con la misma estructura) */
  ruta: string;
  bytes: number;
  sha256: string;
}

export interface ModeloLocal {
  id: string;
  nombre: string;
  familia: string;
  /** El nivel mínimo del teléfono para usarlo */
  nivel: Exclude<Nivel, 'ninguno'>;
  ramMinimaMb: number;
  contexto: number;
  tareas: Tarea[];
  licencia: string;
  archivos: { modelo: ArchivoDeModelo; proyector?: ArchivoDeModelo };
}

export interface Manifiesto {
  version: number;
  modelos: ModeloLocal[];
}

export interface Capacidades {
  memoriaMb: number | null;
  /** ABIs del procesador («arm64-v8a», «x86_64»…) */
  arquitecturas: string[];
  espacioLibreMb: number | null;
}

export const ORDEN: Nivel[] = ['ninguno', 'basico', 'medio', 'alto', 'maximo'];
/** llama.rn trae librerías nativas solo para estas arquitecturas */
const ARQUITECTURAS_CON_MOTOR = ['arm64-v8a', 'x86_64', 'arm64'];
/** Lo que se deja libre en el teléfono después de bajar un modelo */
export const MARGEN_DE_ESPACIO_MB = 800;
export const BASE_POR_DEFECTO = 'https://huggingface.co';

export const manifiesto = MANIFIESTO as Manifiesto;

/**
 * El nivel del teléfono por su memoria. Sin motor nativo (procesador de 32 bits) o sin dato de memoria,
 * queda en «ninguno»: la app sigue usando las reglas, ML Kit y MobileNetV3, que andan en cualquier teléfono.
 */
export function nivelDelDispositivo(c: Capacidades): Nivel {
  if (!c.arquitecturas.some((a) => ARQUITECTURAS_CON_MOTOR.includes(a))) return 'ninguno';
  if (c.memoriaMb === null) return 'ninguno';
  if (c.memoriaMb >= 11_000) return 'maximo';
  // Un teléfono «de 8 GB» reporta ~7,3 GB (Android se guarda una parte): Honor REA-NX9, 10/11
  if (c.memoriaMb >= 7_000) return 'alto';
  if (c.memoriaMb >= 3_500) return 'medio';
  if (c.memoriaMb >= 2_500) return 'basico';
  return 'ninguno';
}

export const bytesDe = (m: ModeloLocal) => m.archivos.modelo.bytes + (m.archivos.proyector?.bytes ?? 0);
export const megas = (bytes: number) => Math.round(bytes / 1_000_000);

/**
 * Los modelos que puede usar el teléfono, del más capaz al más liviano: que su nivel alcance, que entre en la
 * memoria y, si se sabe el espacio libre, que entren sus archivos dejando un margen.
 */
export function modelosPosibles(c: Capacidades, tarea: Tarea = 'texto', lista = manifiesto.modelos): ModeloLocal[] {
  const nivel = ORDEN.indexOf(nivelDelDispositivo(c));
  return lista
    .filter((m) => m.tareas.includes(tarea))
    .filter((m) => ORDEN.indexOf(m.nivel) <= nivel && (c.memoriaMb ?? 0) >= m.ramMinimaMb)
    .filter((m) => c.espacioLibreMb === null || megas(bytesDe(m)) + MARGEN_DE_ESPACIO_MB <= c.espacioLibreMb)
    .sort((a, b) => ORDEN.indexOf(b.nivel) - ORDEN.indexOf(a.nivel) || b.ramMinimaMb - a.ramMinimaMb);
}

/**
 * Todos los modelos que el procesador puede correr, sin mirar la memoria (10/11, pedido de Jhoel: poder probar
 * los grandes en cualquier teléfono). La memoria se avisa con `faltaMemoria`, no se impide.
 */
export function todosLosModelos(c: Capacidades, tarea: Tarea = 'texto', lista = manifiesto.modelos): ModeloLocal[] {
  if (c.arquitecturas.length && !c.arquitecturas.some((a) => ARQUITECTURAS_CON_MOTOR.includes(a))) return [];
  return lista.filter((m) => m.tareas.includes(tarea)).sort((a, b) => bytesDe(a) - bytesDe(b));
}

/** La memoria «de caja» del teléfono en GB (7,3 GB reportados → 8 GB) */
export const gbDelTelefono = (c: Capacidades) => (c.memoriaMb === null ? null : Math.ceil(c.memoriaMb / 1024));
/** Los GB de RAM que pide el modelo, redondeados como se venden los teléfonos */
export const gbQuePide = (m: ModeloLocal) => Math.ceil(m.ramMinimaMb / 1000);
/** Si el teléfono tiene menos memoria de la que pide el modelo: se avisa, puede ir lento o cerrarse */
export const faltaMemoria = (m: ModeloLocal, c: Capacidades) => {
  const gb = gbDelTelefono(c);
  return gb !== null && gb < gbQuePide(m);
};

/** El modelo que se recomienda bajar; null si el teléfono no puede con ninguno. */
export function modeloRecomendado(c: Capacidades, tarea: Tarea = 'texto', lista = manifiesto.modelos): ModeloLocal | null {
  return modelosPosibles(c, tarea, lista)[0] ?? null;
}

/** Dirección de descarga. `base` permite un espejo propio (EXPO_PUBLIC_IA_MODELOS_URL) con la misma estructura. */
export function urlDe(archivo: ArchivoDeModelo, base: string | undefined = undefined): string {
  return `${(base || BASE_POR_DEFECTO).replace(/\/+$/, '')}/${archivo.ruta}`;
}

/** Nombre del archivo en el teléfono: el último tramo de la ruta. */
export const nombreDeArchivo = (archivo: ArchivoDeModelo) => archivo.ruta.split('/').pop()!;
