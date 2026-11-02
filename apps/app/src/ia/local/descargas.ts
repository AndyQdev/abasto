import {
  createDownloadResumable,
  deleteAsync,
  documentDirectory,
  getFreeDiskStorageAsync,
  getInfoAsync,
  makeDirectoryAsync,
  type DownloadResumable,
} from 'expo-file-system/legacy';
import { bytesDe, megas, MARGEN_DE_ESPACIO_MB, nombreDeArchivo, urlDe, type ArchivoDeModelo, type ModeloLocal } from './modelos';

/**
 * Los modelos se bajan una vez y quedan en el teléfono: después la IA anda sin internet.
 * Se guardan en la carpeta privada de la app (se borran si se desinstala).
 */
const CARPETA = `${documentDirectory}modelos-ia/`;
/** Espejo propio opcional con la misma estructura que Hugging Face (ver modelos.json) */
const BASE = process.env.EXPO_PUBLIC_IA_MODELOS_URL;

export const carpetaDe = (modelo: ModeloLocal) => `${CARPETA}${modelo.id}/`;
export const rutaDe = (modelo: ModeloLocal, archivo: ArchivoDeModelo) => `${carpetaDe(modelo)}${nombreDeArchivo(archivo)}`;
/** llama.rn recibe la ruta sin el «file://» */
export const rutaParaElMotor = (uri: string) => uri.replace(/^file:\/\//, '');

const archivosDe = (m: ModeloLocal) => [m.archivos.modelo, ...(m.archivos.proyector ? [m.archivos.proyector] : [])];

async function completo(uri: string, bytes: number) {
  const info = await getInfoAsync(uri);
  return info.exists && !info.isDirectory && info.size === bytes;
}

/** Está bajado entero: cada archivo existe y pesa exactamente lo que dice el manifiesto. */
export async function estaInstalado(modelo: ModeloLocal): Promise<boolean> {
  for (const a of archivosDe(modelo)) if (!(await completo(rutaDe(modelo, a), a.bytes))) return false;
  return true;
}

export interface Progreso {
  bajados: number;
  total: number;
  /** 0 a 1 */
  fraccion: number;
}

let enCurso: DownloadResumable | null = null;

/**
 * Baja los archivos que falten (lo ya completo no se vuelve a bajar). Antes revisa que haya espacio.
 * Si se corta, lo bajado a medias se borra y se puede intentar de nuevo.
 */
export async function descargarModelo(modelo: ModeloLocal, alAvanzar: (p: Progreso) => void = () => {}): Promise<void> {
  const libre = await getFreeDiskStorageAsync().catch(() => null);
  const necesarioMb = megas(bytesDe(modelo)) + MARGEN_DE_ESPACIO_MB;
  if (libre !== null && libre / 1_000_000 < necesarioMb) {
    throw new Error(`Faltan ${necesarioMb - Math.floor(libre / 1_000_000)} MB libres para bajar ${modelo.nombre}`);
  }
  await makeDirectoryAsync(carpetaDe(modelo), { intermediates: true }).catch(() => undefined);

  const total = bytesDe(modelo);
  let antes = 0;
  for (const archivo of archivosDe(modelo)) {
    const destino = rutaDe(modelo, archivo);
    if (!(await completo(destino, archivo.bytes))) {
      enCurso = createDownloadResumable(urlDe(archivo, BASE), destino, {}, ({ totalBytesWritten }) => {
        const bajados = antes + totalBytesWritten;
        alAvanzar({ bajados, total, fraccion: bajados / total });
      });
      try {
        const r = await enCurso.downloadAsync();
        if (!r || r.status >= 400) throw new Error(`El servidor respondió ${r?.status ?? 'sin respuesta'}`);
        if (!(await completo(destino, archivo.bytes))) throw new Error(`${nombreDeArchivo(archivo)} llegó incompleto`);
      } catch (e) {
        await deleteAsync(destino, { idempotent: true });
        throw e;
      } finally {
        enCurso = null;
      }
    }
    antes += archivo.bytes;
    alAvanzar({ bajados: antes, total, fraccion: antes / total });
  }
}

/** Corta la descarga en curso (lo bajado a medias se borra en `descargarModelo`). */
export async function cancelarDescarga() {
  await enCurso?.pauseAsync().catch(() => undefined);
}

export async function borrarModelo(modelo: ModeloLocal) {
  await deleteAsync(carpetaDe(modelo), { idempotent: true });
}
