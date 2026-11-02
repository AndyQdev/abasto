import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';
import { LADO, aEntradaDelModelo, recorteCentrado } from './imagen';
import { leerVectores, masParecidos, mezclarConClasificador, type Reconocido, type VectoresDelCatalogo } from './parecido';

// Los dos salen juntos de ml/src/abasto_ml/vision/entrenar.py: si se reentrena, se cambian los dos
const ARCHIVO_DEL_MODELO = require('../../assets/modelos/productos.tflite');
const ARCHIVO_DE_VECTORES: unknown = require('../../assets/modelos/vectores.json');
const ETIQUETAS: string[] = require('../../assets/modelos/etiquetas.json');
// Los platos usan el mismo vector: una sola pasada por la red compara la foto con productos y con platos
const ARCHIVO_DE_PLATOS: unknown = require('../../assets/modelos/platos.json');

let modelo: Promise<TensorflowModel> | null = null;
let catalogo: VectoresDelCatalogo | null = null;
let platos: VectoresDelCatalogo | null = null;

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

/** El vector es la salida con tantos números como los del catálogo; las probabilidades, la que tiene uno por etiqueta. */
function salidasDe(salidas: ArrayBuffer[], dimension: number) {
  const enNumeros = salidas.map((s) => new Float32Array(s));
  const vector = enNumeros.find((s) => s.length === dimension);
  if (!vector) {
    throw new Error(`El modelo no tiene una salida de ${dimension} números: revisa que productos.tflite y vectores.json sean del mismo entrenamiento`);
  }
  const probabilidades = ETIQUETAS.length !== dimension ? enNumeros.find((s) => s.length === ETIQUETAS.length) : undefined;
  return { vector, probabilidades };
}

/**
 * Reconoce el producto de una foto, dentro del teléfono y sin internet.
 * Devuelve los más parecidos del catálogo, de mayor a menor confianza (0 a 1).
 * Para sumar lo que leyó ML Kit en la etiqueta, usa `combinarConTexto`.
 */
/** Lo que la foto parece: productos del catálogo y platos de comida, cada uno con su confianza (0 a 1). */
export interface FotoReconocida {
  productos: Reconocido[];
  platos: Reconocido[];
}

/**
 * Reconoce una foto dentro del teléfono y sin internet: un solo paso por MobileNetV3 (TensorFlow Lite)
 * y el vector se compara con los productos y con los platos.
 */
export async function reconocerFoto(fotoUri: string, maximo = 5): Promise<FotoReconocida> {
  const { modelo: cargando, catalogo: vectores } = cargar();
  platos ??= leerVectores(ARCHIVO_DE_PLATOS);
  if (!vectores.productos.length && !platos.productos.length) return { productos: [], platos: [] };
  const [m, entrada] = await Promise.all([cargando, pixeles(fotoUri)]);
  const salidas = await m.run([entrada.buffer as ArrayBuffer]);
  const { vector, probabilidades } = salidasDe(salidas, vectores.dimension);
  // Con el clasificador entrenado se juntan las dos señales; sin él, solo el parecido
  const productos = probabilidades
    ? mezclarConClasificador(vector, vectores.productos, probabilidades, ETIQUETAS, maximo)
    : masParecidos(vector, vectores.productos, maximo);
  return { productos, platos: platos.productos.length ? masParecidos(vector, platos.productos, maximo) : [] };
}

/** Solo los productos (lo usa Buscar por foto). */
export async function reconocerProducto(fotoUri: string, maximo = 5): Promise<Reconocido[]> {
  return (await reconocerFoto(fotoUri, maximo)).productos;
}
