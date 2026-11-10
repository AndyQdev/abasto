/**
 * El asistente de compra: de lo que la persona escribe, pega o fotografía, a una propuesta de carrito.
 *
 * 1. Entender: el modelo local (si el teléfono tiene uno) o las reglas (siempre). Nunca se queda sin respuesta.
 * 2. Completar: una receta sin ingredientes sale de las recetas de referencia, escalada con aritmética.
 * 3. Catalogar: cada cosa pedida pasa a un producto real, su presentación y cuántas (código, no modelo).
 * Todo corre en el teléfono: anda sin internet sobre el catálogo guardado.
 */
import type { Producto } from '@abasto/comercio';
import type { FotoReconocida } from '../reconocer';
import type { EntradaDelAsistente, Interprete } from '../local/motor';
import { candidatos, catalogar, normalizar, type LineaPropuesta } from './catalogar';
import type { Contexto } from './con-modelo';
import { intencionVacia, type Intencion, type ItemPedido } from './intencion';
import { leerFoto, NOMBRES_DE_PLATOS, type LecturaDeFoto } from './foto';
import { buscarReceta, escalarReceta, recetasDelPlato, type RecetaDeReferencia } from './recetas';
import { entenderConReglas, rindeDe } from './reglas';

export interface Propuesta {
  intencion: Intencion;
  lineas: LineaPropuesta[];
  /** Todo lo que se supuso, para que la persona lo vea antes de agregar al carrito */
  supuestos: string[];
  /** Quién entendió: el modelo de lenguaje local o las reglas */
  origen: 'modelo' | 'reglas' | 'foto';
  receta: RecetaDeReferencia | null;
  /** Si había modelo y no respondió: por qué (para probar y mejorar) */
  falloDelModelo: string | null;
  /** Cuánto tardó el modelo en responder */
  respuestaMs: number | null;
  /** Qué vio el reconocedor propio en la foto (producto, plato o nada) */
  lectura: LecturaDeFoto | null;
  /** Lo que se le dice a la persona: «Parece una salchipapa (87 %)…» */
  mensaje: string | null;
  /** Las formas de preparar el plato reconocido, para elegir otra */
  variantes: RecetaDeReferencia[];
}

export interface OpcionesDelAsistente {
  interprete?: Interprete | null;
  contexto?: Contexto;
  /** MobileNetV3 (TensorFlow Lite) + vectores: productos y platos parecidos a la foto */
  reconocerFoto?: (fotoUri: string) => Promise<FotoReconocida>;
  /** La persona eligió el plato en «¿Es esto?» o otra forma de prepararlo */
  platoElegido?: string | null;
  recetaElegida?: string | null;
}

/** «hacer», «preparar», «cocinar»: la persona quiere preparar algo, no comprar un producto */
const PREPARAR = /\b(hacer|preparar|cocinar|elaborar)\b/i;

const pct = (n: number) => `${Math.round(n * 100)} %`;

async function entender(entrada: EntradaDelAsistente, productos: Producto[], o: OpcionesDelAsistente): Promise<{ intencion: Intencion; origen: Propuesta['origen'] }> {
  if (o.interprete) {
    const intencion = await o.interprete.interpretar(entrada, o.contexto).catch(() => null);
    if (intencion) return { intencion, origen: 'modelo' };
  }
  if (entrada.texto.trim()) return { intencion: entenderConReglas(entrada.texto), origen: 'reglas' };

  return { intencion: intencionVacia(), origen: 'reglas' };
}

export async function proponerCompra(entrada: EntradaDelAsistente, productos: Producto[], opciones: OpcionesDelAsistente = {}): Promise<Propuesta> {
  // La foto pasa por el reconocedor propio mientras el modelo de lenguaje (o las reglas) lee el texto
  const deLaFoto = entrada.fotoUri && opciones.reconocerFoto ? opciones.reconocerFoto(entrada.fotoUri).catch(() => null) : Promise.resolve(null);
  const [{ intencion, origen: origenDelTexto }, foto] = await Promise.all([entender(entrada, productos, opciones), deLaFoto]);
  const lectura: LecturaDeFoto | null = opciones.platoElegido
    ? { tipo: 'plato', plato: opciones.platoElegido, confianza: 1, seguro: true, opciones: [] }
    : foto
      ? leerFoto(foto.productos, foto.platos)
      : null;
  const supuestos = [...intencion.supuestos];
  let items = intencion.items;
  let receta: RecetaDeReferencia | null = null;
  let mensaje: string | null = null;
  let variantes: RecetaDeReferencia[] = [];
  let origen = origenDelTexto;

  if (lectura?.tipo === 'plato' && lectura.seguro) {
    // La foto reconoció el plato: manda sobre lo que adivinó el texto, y salen sus recetas
    variantes = recetasDelPlato(lectura.plato);
    receta = variantes.find((r) => r.id === opciones.recetaElegida) ?? variantes[0] ?? null;
    const nombre = NOMBRES_DE_PLATOS[lectura.plato] ?? lectura.plato;
    mensaje = opciones.platoElegido ? `Elegiste ${nombre}.` : `Parece ${nombre} (${pct(lectura.confianza)}).`;
    if (receta) {
      // «para 8 personas» junto a la foto: el texto dice para cuántos
      const escalada = escalarReceta(receta, intencion.rinde ?? rindeDe(entrada.texto)?.rinde ?? null);
      // Lo que el texto pidió y sí se vende se queda; el plato mismo («salchipapa») no es un producto
      items = [...items.filter((i) => candidatos(i.nombre, productos).length > 0), ...escalada.items];
      supuestos.push(...escalada.supuestos);
      if (variantes.length > 1) mensaje += ` Hay ${variantes.length} formas de prepararlo: elige la tuya abajo.`;
    } else {
      mensaje += ' Todavía no tenemos su receta: escribe los ingredientes y te armamos la compra.';
    }
    if (!entrada.texto.trim() || origen !== 'modelo') origen = 'foto';
  } else if (lectura?.tipo === 'plato') {
    mensaje = `¿Es ${lectura.opciones.map((o) => NOMBRES_DE_PLATOS[o.codigo] ?? o.codigo).join(' o ')}? Elige y te armamos la compra.`;
  } else if (lectura?.tipo === 'producto') {
    const producto = productos.find((p) => p.codigo === lectura.codigo);
    if (producto) {
      mensaje = `Es ${producto.nombre} (${pct(lectura.confianza)}).`;
      if (!items.some((i) => candidatos(i.nombre, productos)[0]?.codigo === producto.codigo)) items = [{ nombre: producto.nombre, cantidad: null, unidad: null, envase: null }, ...items];
      if (!entrada.texto.trim()) origen = 'foto';
    }
  }

  // «100 empanadas de queso» como si fuera un producto: no se vende, pero es una receta conocida → sus insumos.
  // Los modelos chicos lo confunden seguido; corregirlo con código es más fiable que con más instrucciones.
  const sinCatalogo = items.filter((i) => !candidatos(i.nombre, productos).length);
  const comoReceta = sinCatalogo.map((i) => ({ item: i, receta: buscarReceta(i.nombre) })).find((x) => x.receta);
  if (comoReceta && !receta) {
    receta = comoReceta.receta!;
    const escalada = escalarReceta(receta, comoReceta.item.cantidad ?? intencion.rinde);
    items = [...items.filter((i) => i !== comoReceta.item), ...escalada.items];
    supuestos.push(...escalada.supuestos);
  }

  // «Quiero hacer 100 empanadas de queso»: el texto pide preparar algo que tenemos como receta, pero un modelo chico
  // trae solo un ingrediente suelto (pasó con LFM2.5 en el Honor, 10/11: solo «queso»). Manda la receta completa,
  // escalada con aritmética; lo que la persona nombró y la receta no tiene se queda.
  const conReceta = !receta && PREPARAR.test(entrada.texto) ? buscarReceta(entrada.texto) : null;
  if (conReceta && items.length < conReceta.ingredientes.length) {
    receta = conReceta;
    const escalada = escalarReceta(receta, intencion.rinde ?? rindeDe(entrada.texto)?.rinde ?? null);
    const yaEsta = (i: ItemPedido) => escalada.items.some((e) => normalizar(e.nombre).includes(normalizar(i.nombre)) || normalizar(i.nombre).includes(normalizar(e.nombre)));
    items = [...escalada.items, ...items.filter((i) => !yaEsta(i))];
    supuestos.push(...escalada.supuestos);
  }

  if (intencion.tipo === 'receta' && !items.length) {
    receta = buscarReceta(intencion.preparacion) ?? buscarReceta(entrada.texto);
    if (receta) {
      const escalada = escalarReceta(receta, intencion.rinde);
      items = escalada.items;
      supuestos.push(...escalada.supuestos);
    } else {
      supuestos.push(
        `Todavía no tenemos una receta de referencia para «${intencion.preparacion ?? 'eso'}»: pega tu receta o escribe los ingredientes y te armamos la compra`,
      );
    }
  }

  const lineas = catalogar(items, productos);
  if (!items.length && !mensaje && entrada.fotoUri) mensaje = 'No reconocimos la foto: prueba más cerca, con buena luz, o escribe qué buscas.';
  const diag = opciones.interprete?.diagnostico() ?? null;
  return {
    intencion: { ...intencion, items },
    lineas,
    supuestos,
    origen,
    receta,
    // Si la foto ganó, el modelo igual pudo responder bien: solo es falla si el modelo no entendió nada
    falloDelModelo: opciones.interprete && origenDelTexto !== 'modelo' ? (diag?.error ?? 'El modelo no respondió') : null,
    respuestaMs: diag?.respuestaMs ?? null,
    lectura,
    mensaje,
    variantes,
  };
}
