import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';
import { LADO, aEntradaDelModelo, recorteCentrado } from './imagen';
import { leerVectores, masParecidos, type Reconocido, type VectoresDelCatalogo } from './parecido';

// Los dos salen juntos de ml/src/abasto_ml/vision/entrenar.py: si se reentrena, se cambian los dos
const ARCHIVO_DEL_MODELO = require('../../assets/modelos/productos.tflite');
const ARCHIVO_DE_VECTORES: unknown = require('../../assets/modelos/vectores.json');

let modelo: Promise<TensorflowModel> | null = null;
let catalogo: VectoresDelCatalogo | null = null;

/** Se carga una sola vez y queda en memoria: la segunda foto ya no paga la carga (~200 ms). */
function cargar(): { modelo: Promise<TensorflowModel>; catalogo: VectoresDelCatalogo } {
  catalogo ??= leerVectores(ARCHIVO_DE_VECTORES);
  modelo ??= loadTensorflowModel(ARCHIVO_DEL_MODELO, []).catch((e: unknown) => {
    modelo = null; // si falla, la próxima foto vuelve a intentar
    throw e;
  });
  return { modelo, catalogo };
}

async function pixeles(uri: string): Promise<Float32Array> {
  const original = await manipulateAsync(uri, []);
  const cuadrada = await manipulateAsync(
    uri,
    [{ crop: recorteCentrado(original.width, original.height) }, { resize: { width: LADO, height: LADO } }],
    { format: SaveFormat.JPEG, compress: 0.95, base64: true },
  );
  const jpeg = Uint8Array.from(atob(cuadrada.base64 ?? ''), (c) => c.charCodeAt(0));
  const { data, width, height } = decode(jpeg, { useTArray: true, formatAsRGBA: true });
  return aEntradaDelModelo(data, width, height);
}

/** El vector de la foto: es la salida que tiene tantos números como los vectores del catálogo. */
function vectorDe(salidas: ArrayBuffer[], dimension: number): Float32Array {
  const vector = salidas.map((s) => new Float32Array(s)).find((s) => s.length === dimension);
  if (!vector) throw new Error(`El modelo no tiene una salida de ${dimension} números: revisa que productos.tflite y vectores.json sean del mismo entrenamiento`);
  return vector;
}

/**
 * Reconoce el producto de una foto, dentro del teléfono y sin internet.
 * Devuelve los más parecidos del catálogo, de mayor a menor confianza (0 a 1).
 * Para sumar lo que leyó ML Kit en la etiqueta, usa `combinarConTexto`.
 */
export async function reconocerProducto(fotoUri: string, maximo = 5): Promise<Reconocido[]> {
  const { modelo: cargando, catalogo: vectores } = cargar();
  if (!vectores.productos.length) return [];
  const [m, entrada] = await Promise.all([cargando, pixeles(fotoUri)]);
  const salidas = await m.run([entrada.buffer as ArrayBuffer]);
  return masParecidos(vectorDe(salidas, vectores.dimension), vectores.productos, maximo);
}
