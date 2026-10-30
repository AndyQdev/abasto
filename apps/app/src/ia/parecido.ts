export type VectorDeProducto = { codigo: string; vector: number[] };
export type Reconocido = { codigo: string; confianza: number };
export type VectoresDelCatalogo = {
  modelo: string;
  dimension: number;
  productos: VectorDeProducto[];
};

const DECIMALES = 1000;

function recortar(valor: number): number {
  return Math.round(Math.min(1, Math.max(0, valor)) * DECIMALES) / DECIMALES;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export function similitudCoseno(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) {
    throw new Error(`Los vectores no tienen el mismo largo: ${a.length} y ${b.length}`);
  }

  let producto = 0;
  let normaA = 0;
  let normaB = 0;
  for (let i = 0; i < a.length; i++) {
    producto += a[i] * b[i];
    normaA += a[i] * a[i];
    normaB += b[i] * b[i];
  }

  if (normaA === 0 || normaB === 0) return 0;
  return producto / (Math.sqrt(normaA) * Math.sqrt(normaB));
}

export function masParecidos(
  consulta: ArrayLike<number>,
  catalogo: VectorDeProducto[],
  maximo = 5,
): Reconocido[] {
  const reconocidos: Reconocido[] = [];

  for (const producto of catalogo) {
    const confianza = recortar(similitudCoseno(consulta, producto.vector));
    if (confianza > 0) reconocidos.push({ codigo: producto.codigo, confianza });
  }

  reconocidos.sort(
    (a, b) => b.confianza - a.confianza || a.codigo.localeCompare(b.codigo, 'es'),
  );
  return reconocidos.slice(0, maximo);
}

export function combinarConTexto(
  porImagen: Reconocido[],
  porTexto: string[],
  peso = 0.25,
): Reconocido[] {
  if (porTexto.length === 0) return porImagen.map((reconocido) => ({ ...reconocido }));

  const confianzas = new Map<string, number>();
  for (const reconocido of porImagen) confianzas.set(reconocido.codigo, reconocido.confianza);

  porTexto.forEach((codigo, posicion) => {
    const bono = (peso * (porTexto.length - posicion)) / porTexto.length;
    confianzas.set(codigo, (confianzas.get(codigo) ?? 0) + bono);
  });

  const resultado: Reconocido[] = [];
  for (const [codigo, confianza] of confianzas) {
    resultado.push({ codigo, confianza: recortar(confianza) });
  }

  resultado.sort(
    (a, b) => b.confianza - a.confianza || a.codigo.localeCompare(b.codigo, 'es'),
  );
  return resultado;
}

export function leerVectores(datos: unknown): VectoresDelCatalogo {
  if (!esObjeto(datos)) throw new Error('vectores.json: debe ser un objeto');

  const modelo = datos.modelo;
  if (typeof modelo !== 'string' || modelo.trim().length === 0) {
    throw new Error('vectores.json: falta «modelo»');
  }

  const dimension = datos.dimension;
  if (typeof dimension !== 'number' || !Number.isInteger(dimension) || dimension <= 0) {
    throw new Error('vectores.json: «dimension» debe ser un entero mayor que 0');
  }

  const productos = datos.productos;
  if (!Array.isArray(productos)) throw new Error('vectores.json: falta «productos»');

  const lista = productos as unknown[];
  for (let indice = 0; indice < lista.length; indice++) {
    const producto = lista[indice];
    if (!esObjeto(producto)) {
      throw new Error(`vectores.json: el producto en la posición ${indice} no es un objeto`);
    }

    const codigo = producto.codigo;
    if (typeof codigo !== 'string' || codigo.length === 0) {
      throw new Error(`vectores.json: el producto en la posición ${indice} no tiene «codigo»`);
    }

    const vector = producto.vector;
    if (!Array.isArray(vector)) {
      throw new Error(`vectores.json: el producto ${codigo} no tiene «vector»`);
    }
    if (vector.length !== dimension) {
      throw new Error(
        `vectores.json: el producto ${codigo} tiene ${vector.length} números y se esperaban ${dimension}`,
      );
    }
    for (const numero of vector as unknown[]) {
      if (typeof numero !== 'number' || !Number.isFinite(numero)) {
        throw new Error(`vectores.json: el producto ${codigo} tiene un número que no es finito`);
      }
    }
  }

  return datos as VectoresDelCatalogo;
}

/**
 * Junta el parecido de los vectores con las probabilidades del clasificador entrenado con TensorFlow.
 * Es la misma mezcla que mide `mezclar` en ml/src/abasto_ml/vision/catalogo.py.
 * `etiquetas[i]` es el código de producto de `probabilidades[i]`.
 */
export function mezclarConClasificador(
  consulta: ArrayLike<number>,
  catalogo: VectorDeProducto[],
  probabilidades: ArrayLike<number>,
  etiquetas: string[],
  maximo = 5,
  pesoVector = 0.5,
): Reconocido[] {
  if (probabilidades.length !== etiquetas.length) {
    throw new Error(`El clasificador da ${probabilidades.length} probabilidades y hay ${etiquetas.length} etiquetas`);
  }
  const probabilidadDe = new Map(etiquetas.map((codigo, i) => [codigo, probabilidades[i]]));
  const reconocidos: Reconocido[] = [];
  for (const producto of catalogo) {
    const parecido = Math.min(1, Math.max(0, similitudCoseno(consulta, producto.vector)));
    const confianza = recortar(pesoVector * parecido + (1 - pesoVector) * (probabilidadDe.get(producto.codigo) ?? 0));
    if (confianza > 0) reconocidos.push({ codigo: producto.codigo, confianza });
  }
  reconocidos.sort((a, b) => b.confianza - a.confianza || a.codigo.localeCompare(b.codigo, 'es'));
  return reconocidos.slice(0, maximo);
}

/** Debajo de esto la foto no se parece de verdad a ningún producto: mejor no mostrarlo. */
export const CONFIANZA_MINIMA = 0.35;

/**
 * Lo que muestra Buscar por foto: junta lo que reconoció el modelo con lo que encontró el texto de la etiqueta
 * y devuelve los productos del catálogo en ese orden. Lo que leyó el texto siempre entra; lo que solo vio la
 * imagen entra si pasa `CONFIANZA_MINIMA`.
 */
export function productosPorFoto<P extends { codigo: string }>(
  productos: P[],
  porImagen: Reconocido[],
  porTexto: P[],
  maximo = 10,
): P[] {
  const delTexto = new Set(porTexto.map((p) => p.codigo));
  const porCodigo = new Map(productos.map((p) => [p.codigo, p] as const));
  return combinarConTexto(porImagen, porTexto.map((p) => p.codigo))
    .filter((r) => delTexto.has(r.codigo) || r.confianza >= CONFIANZA_MINIMA)
    .map((r) => porCodigo.get(r.codigo))
    .filter((p): p is P => p !== undefined)
    .slice(0, maximo);
}
