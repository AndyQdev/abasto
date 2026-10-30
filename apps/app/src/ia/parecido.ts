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
