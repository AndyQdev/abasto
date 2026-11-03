import { COLECCIONES, ORIGENES_DE_MOVIMIENTO, TIPOS_DE_MOVIMIENTO, type CambiosDeNegocio } from './modelo.js';

/** Un cambio que no se puede guardar. La interfaz lo devuelve como error de GraphQL con su código. */
export class CambioInvalido extends Error {
  readonly codigo = 'CAMBIO_INVALIDO';
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'CambioInvalido';
  }
}

export class SinNegocio extends Error {
  readonly codigo = 'SIN_NEGOCIO';
  constructor() {
    super('Tu cuenta no tiene un negocio: entra con tu celular desde la app');
    this.name = 'SinNegocio';
  }
}

/** Lo máximo que se acepta en una sola subida: el teléfono manda su cola por partes si es más */
export const MAXIMO_POR_SUBIDA = 2000;

const esFecha = (t: unknown) => typeof t === 'string' && !Number.isNaN(Date.parse(t));
const esMonto = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;
const esCantidad = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
const texto = (t: unknown) => typeof t === 'string' && t.trim().length > 0;

function exigir(condicion: boolean, mensaje: string) {
  if (!condicion) throw new CambioInvalido(mensaje);
}

/**
 * Revisa todo lo que sube el teléfono antes de guardar nada. Si algo no sirve, no se guarda ninguna parte: el
 * teléfono lo deja en su cola y avisa. Los mensajes dicen qué registro y qué campo.
 */
export function validarCambios(c: CambiosDeNegocio) {
  const total = COLECCIONES.reduce((s, k) => s + (c[k]?.length ?? 0), 0);
  exigir(total <= MAXIMO_POR_SUBIDA, `Llegaron ${total} cambios de una vez; el máximo es ${MAXIMO_POR_SUBIDA}`);

  for (const a of c.articulos ?? []) {
    exigir(texto(a.id), 'Un artículo llegó sin id');
    exigir(texto(a.nombre), `El artículo ${a.id} no tiene nombre`);
    exigir(['COMPRADO', 'HECHO'].includes(a.clase), `El artículo ${a.id} tiene una clase que no existe: ${a.clase}`);
    exigir(['ABASTO', 'OTRO_PROVEEDOR'].includes(a.origen), `El artículo ${a.id} tiene un origen que no existe: ${a.origen}`);
    exigir(texto(a.medida?.envase) && texto(a.medida?.unidad), `El artículo ${a.id} no dice en qué se cuenta`);
    exigir(a.medida.porEnvase === null || (esCantidad(a.medida.porEnvase) && a.medida.porEnvase > 0), `El artículo ${a.id} tiene una medida que no sirve`);
    exigir(a.precioVentaCentavos === null || esMonto(a.precioVentaCentavos), `El precio de venta de ${a.nombre} tiene que ser cero o más`);
    exigir(a.stockMinimo === null || (esCantidad(a.stockMinimo) && a.stockMinimo >= 0), `El mínimo de ${a.nombre} tiene que ser cero o más`);
    exigir(esFecha(a.creadoEn) && esFecha(a.actualizadoEn), `El artículo ${a.id} tiene una fecha que no sirve`);
  }
  for (const m of c.movimientos ?? []) {
    exigir(texto(m.id) && texto(m.claveUnica) && texto(m.articuloId), 'Un movimiento llegó sin id, clave o artículo');
    exigir((TIPOS_DE_MOVIMIENTO as readonly string[]).includes(m.tipo), `El movimiento ${m.id} tiene un tipo que no existe: ${m.tipo}`);
    exigir((ORIGENES_DE_MOVIMIENTO as readonly string[]).includes(m.origen), `El movimiento ${m.id} tiene un origen que no existe: ${m.origen}`);
    exigir(esCantidad(m.cantidad), `El movimiento ${m.id} no tiene cantidad`);
    exigir(m.costoUnitarioCentavos === null || esMonto(m.costoUnitarioCentavos), `El costo del movimiento ${m.id} tiene que ser cero o más`);
    exigir(esFecha(m.fecha), `El movimiento ${m.id} tiene una fecha que no sirve`);
  }
  for (const v of c.ventas ?? []) {
    exigir(texto(v.id) && esFecha(v.fecha), 'Una venta llegó sin id o con una fecha que no sirve');
    exigir(['CONTADO', 'FIADO'].includes(v.forma), `La venta ${v.id} tiene una forma de cobro que no existe: ${v.forma}`);
    exigir(v.forma !== 'FIADO' || texto(v.clienteId), `La venta ${v.id} es fiada pero no dice a quién`);
    exigir(esMonto(v.totalCentavos) && esMonto(v.costoCentavos), `Los montos de la venta ${v.id} tienen que ser cero o más`);
    exigir(Array.isArray(v.lineas) && v.lineas.length > 0, `La venta ${v.id} no tiene productos`);
    for (const l of v.lineas) {
      exigir(texto(l.articuloId) && esCantidad(l.cantidad) && l.cantidad > 0, `Una línea de la venta ${v.id} no tiene producto o cantidad`);
      exigir(esMonto(l.precioUnitarioCentavos) && (l.costoUnitarioCentavos === null || esMonto(l.costoUnitarioCentavos)), `Los precios de la venta ${v.id} tienen que ser cero o más`);
    }
  }
  for (const k of c.clientes ?? []) {
    exigir(texto(k.id) && texto(k.nombre), 'Un cliente de fiado llegó sin id o sin nombre');
    exigir(esFecha(k.creadoEn) && esFecha(k.actualizadoEn), `El cliente ${k.nombre} tiene una fecha que no sirve`);
  }
  for (const f of c.fiados ?? []) {
    exigir(texto(f.id) && texto(f.clienteId), 'Un movimiento de fiado llegó sin id o sin cliente');
    exigir(['DEBE', 'PAGA'].includes(f.tipo), `El fiado ${f.id} tiene un tipo que no existe: ${f.tipo}`);
    exigir(esMonto(f.montoCentavos) && f.montoCentavos > 0, `El monto del fiado ${f.id} tiene que ser mayor a cero`);
    exigir(esFecha(f.fecha), `El fiado ${f.id} tiene una fecha que no sirve`);
  }
  for (const r of c.recetas ?? []) {
    exigir(texto(r.id) && texto(r.nombre) && texto(r.articuloId), 'Una receta llegó sin id, nombre o producto');
    exigir(esCantidad(r.rinde) && r.rinde > 0, `La receta ${r.nombre} tiene que rendir más de cero`);
    exigir(Array.isArray(r.insumos), `La receta ${r.nombre} no trae sus insumos`);
    for (const i of r.insumos) exigir(texto(i.articuloId) && esCantidad(i.cantidad) && i.cantidad > 0, `Un insumo de la receta ${r.nombre} no tiene cantidad`);
    exigir(esFecha(r.actualizadoEn), `La receta ${r.nombre} tiene una fecha que no sirve`);
  }
  for (const t of c.tandas ?? []) {
    exigir(texto(t.id) && texto(t.recetaId) && texto(t.articuloId), 'Una tanda llegó sin id, receta o producto');
    exigir(esCantidad(t.planificado) && t.planificado > 0 && esCantidad(t.obtenido) && t.obtenido >= 0, `Las cantidades de la tanda ${t.id} no sirven`);
    exigir(esMonto(t.costoTotalCentavos) && esFecha(t.fecha), `El costo o la fecha de la tanda ${t.id} no sirven`);
  }
  for (const a of c.anotaciones ?? []) {
    exigir(texto(a.id) && texto(a.claveUnica) && texto(a.categoria), 'Una anotación llegó sin id, clave o categoría');
    exigir(['INGRESO', 'GASTO'].includes(a.tipo), `La anotación ${a.id} tiene un tipo que no existe: ${a.tipo}`);
    exigir(['MANUAL', 'ABASTO'].includes(a.origen), `La anotación ${a.id} tiene un origen que no existe: ${a.origen}`);
    exigir(esMonto(a.montoCentavos) && a.montoCentavos > 0, `El monto de la anotación ${a.id} tiene que ser mayor a cero`);
    exigir(esFecha(a.fecha), `La anotación ${a.id} tiene una fecha que no sirve`);
  }
  for (const i of c.lista ?? []) {
    exigir(texto(i.id) && texto(i.productoId) && texto(i.presentacion), 'Un producto de la lista llegó sin id, producto o presentación');
    exigir(esCantidad(i.cantidad) && i.cantidad > 0, `La cantidad de la lista ${i.id} tiene que ser mayor a cero`);
    exigir(esFecha(i.actualizadoEn), `La lista ${i.id} tiene una fecha que no sirve`);
  }
}
