/**
 * El motor de «Mi negocio» (Fase 2 de `docs/plan-mi-negocio.md`): un solo inventario para los tres tipos de cliente.
 * Lo que cambia por tipo es cómo se agrupa y se nombra («Tu despensa», «Para vender», «Insumos» y «Lo que haces»).
 *
 * Como el kardex de Solvexco, la existencia nunca se guarda: es la suma de los movimientos. Cada movimiento tiene una
 * `claveUnica`, así una compra que se sincroniza dos veces entra una sola vez.
 */
import { bs } from '../carrito';
import type { NegocioElegido } from '../negocios';
import { textoDeCantidad, type Medida } from './medidas';

/** COMPRADO: lo que se compra (insumo, mercadería o despensa). HECHO: lo que hace el productor (Fase 4) */
export type ClaseDeArticulo = 'COMPRADO' | 'HECHO';
export type OrigenDeArticulo = 'ABASTO' | 'OTRO_PROVEEDOR';

export interface Articulo {
  id: string;
  nombre: string;
  /** El contenido del nombre del producto («quintal 46 kg»), si lo tiene */
  detalle: string | null;
  rubro: string | null;
  medida: Medida;
  clase: ClaseDeArticulo;
  origen: OrigenDeArticulo;
  /** El producto del catálogo de Abasto, para volver a pedirlo */
  productoId: string | null;
  /** El proveedor, si se agregó a mano */
  proveedor: string | null;
  creadoEn: string;
}

/**
 * ENTRADA suma (compra), SALIDA resta y AJUSTE corrige lo contado (con signo). CONSUMO, PRODUCCION, VENTA y MERMA llegan
 * con las fases 3 y 4 y ya cuentan en las existencias.
 */
export type TipoDeMovimiento = 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'CONSUMO' | 'PRODUCCION' | 'VENTA' | 'MERMA';
export type OrigenDeMovimiento = 'ABASTO' | 'OTRO_PROVEEDOR' | 'MANUAL';

export interface Movimiento {
  id: string;
  articuloId: string;
  tipo: TipoDeMovimiento;
  /** En envases del artículo y con signo: + entra, − sale */
  cantidad: number;
  /** Lo que costó cada envase, si se sabe */
  costoUnitarioCentavos: number | null;
  origen: OrigenDeMovimiento;
  /** «pedido:<id>:<producto>:<presentación>» para las compras de Abasto; un id para lo manual */
  claveUnica: string;
  fecha: string;
  nota: string | null;
}

export interface DatosDeNegocio {
  articulos: Articulo[];
  movimientos: Movimiento[];
}

export interface Existencia {
  articulo: Articulo;
  cantidad: number;
  /** «2 maples · 60 u.» */
  texto: string;
  /** El costo promedio ponderado de lo que entró con costo */
  costoPromedioCentavos: number | null;
  /** Cuánto vale lo que hay, al costo promedio */
  valorCentavos: number | null;
  ultimaEntrada: string | null;
  agotado: boolean;
}

/** Las existencias de todos los artículos, sumando sus movimientos */
export function existencias({ articulos, movimientos }: DatosDeNegocio): Existencia[] {
  const porArticulo = new Map<string, Movimiento[]>();
  for (const m of movimientos) porArticulo.set(m.articuloId, [...(porArticulo.get(m.articuloId) ?? []), m]);
  return articulos.map((a) => {
    const suyos = porArticulo.get(a.id) ?? [];
    const cantidad = redondear(suyos.reduce((s, m) => s + m.cantidad, 0));
    const conCosto = suyos.filter((m) => m.tipo === 'ENTRADA' && m.costoUnitarioCentavos !== null && m.cantidad > 0);
    const unidades = conCosto.reduce((s, m) => s + m.cantidad, 0);
    const costoPromedioCentavos = unidades > 0 ? Math.round(conCosto.reduce((s, m) => s + m.cantidad * m.costoUnitarioCentavos!, 0) / unidades) : null;
    const entradas = suyos.filter((m) => m.tipo === 'ENTRADA').map((m) => m.fecha);
    return {
      articulo: a,
      cantidad,
      texto: textoDeCantidad(cantidad, a.medida),
      costoPromedioCentavos,
      valorCentavos: costoPromedioCentavos !== null ? Math.round(Math.max(cantidad, 0) * costoPromedioCentavos) : null,
      ultimaEntrada: entradas.length ? entradas.sort()[entradas.length - 1] : null,
      agotado: cantidad <= 0,
    };
  });
}

const redondear = (n: number) => Math.round(n * 1000) / 1000;

export class ErrorDeInventario extends Error {}

/** Un artículo de otro proveedor, agregado a mano */
export function articuloAMano(
  entrada: { nombre: string; medida: Medida; proveedor?: string | null; clase?: ClaseDeArticulo; rubro?: string | null },
  ahora: string,
  id: string,
): Articulo {
  const nombre = entrada.nombre.trim().replace(/\s+/g, ' ');
  if (nombre.length < 2) throw new ErrorDeInventario('Escribe el nombre del producto');
  return {
    id,
    nombre,
    detalle: null,
    rubro: entrada.rubro ?? null,
    medida: entrada.medida,
    clase: entrada.clase ?? 'COMPRADO',
    origen: 'OTRO_PROVEEDOR',
    productoId: null,
    proveedor: entrada.proveedor?.trim() || null,
    creadoEn: ahora,
  };
}

/** Una compra a otro proveedor: suma al inventario. El costo es por envase y es opcional */
export function entradaAMano(articulo: Articulo, cantidad: number, costoUnitarioCentavos: number | null, ahora: string, id: string): Movimiento {
  if (!Number.isFinite(cantidad) || cantidad <= 0) throw new ErrorDeInventario('La cantidad tiene que ser mayor a cero');
  if (costoUnitarioCentavos !== null && (!Number.isFinite(costoUnitarioCentavos) || costoUnitarioCentavos < 0)) throw new ErrorDeInventario('Revisa el precio');
  return { id, articuloId: articulo.id, tipo: 'ENTRADA', cantidad, costoUnitarioCentavos, origen: 'OTRO_PROVEEDOR', claveUnica: `manual:${id}`, fecha: ahora, nota: articulo.proveedor };
}

/**
 * «Tengo 3»: lo que la persona contó. Guarda la diferencia como AJUSTE (con signo), así la historia no se pierde.
 * Devuelve null si no cambió nada.
 */
export function ajusteAMano(existencia: Pick<Existencia, 'articulo' | 'cantidad'>, contada: number, ahora: string, id: string): Movimiento | null {
  if (!Number.isFinite(contada) || contada < 0) throw new ErrorDeInventario('La cantidad no puede ser negativa');
  const diferencia = redondear(contada - existencia.cantidad);
  if (diferencia === 0) return null;
  return { id, articuloId: existencia.articulo.id, tipo: 'AJUSTE', cantidad: diferencia, costoUnitarioCentavos: null, origen: 'MANUAL', claveUnica: `ajuste:${id}`, fecha: ahora, nota: null };
}

export type ClaveDeGrupo = 'despensa' | 'para_vender' | 'insumos' | 'hechos';

export interface GrupoDeInventario {
  clave: ClaveDeGrupo;
  titulo: string;
  subtitulo: string;
  /** Lo que se dice cuando el grupo está vacío */
  vacio: string;
  lineas: Existencia[];
  valorCentavos: number;
}

const HECHOS: Record<string, string> = { salteneria: 'tus salteñas, listas para vender', panaderia: 'tu pan, listo para vender', pension: 'tus platos, listos para vender' };

/**
 * El inventario como lo ve cada tipo. Hogar: «Tu despensa». Tienda: «Para vender». Productor: «Insumos» y
 * «Lo que haces», separados desde ya (lo hecho se llena con los lotes de la Fase 4).
 * Dentro de cada grupo: lo que hay primero (por rubro y nombre) y lo agotado al final.
 */
export function inventarioDelNegocio(negocio: NegocioElegido, datos: DatosDeNegocio): GrupoDeInventario[] {
  const todas = existencias(datos);
  const comprados = ordenar(todas.filter((e) => e.articulo.clase === 'COMPRADO'));
  const hechos = ordenar(todas.filter((e) => e.articulo.clase === 'HECHO'));
  const grupo = (clave: ClaveDeGrupo, titulo: string, subtitulo: string, vacio: string, lineas: Existencia[]): GrupoDeInventario => ({
    clave,
    titulo,
    subtitulo,
    vacio,
    lineas,
    valorCentavos: lineas.reduce((s, l) => s + (l.valorCentavos ?? 0), 0),
  });
  if (negocio.tipo === 'hogar') {
    return [grupo('despensa', 'Tu despensa', 'Lo que compraste para la casa', 'Cuando te llegue tu primer pedido, lo que compraste aparece aquí solo.', comprados)];
  }
  if (negocio.tipo === 'tienda') {
    return [grupo('para_vender', 'Para vender', 'La mercadería de tu tienda', 'Cuando te llegue tu primer pedido, la mercadería entra aquí sola.', comprados)];
  }
  const loHecho = HECHOS[negocio.subtipo ?? ''] ?? 'lo que haces, listo para vender';
  return [
    grupo('insumos', 'Insumos', 'Lo que compras para cocinar', 'Cuando te llegue tu primer pedido, los insumos entran aquí solos.', comprados),
    grupo('hechos', 'Lo que haces', 'Tu producto terminado', `Aquí vas a ver ${loHecho}. Muy pronto podrás registrar cada tanda.`, hechos),
  ];
}

function ordenar(lineas: Existencia[]) {
  return [...lineas].sort(
    (a, b) =>
      Number(a.agotado) - Number(b.agotado) ||
      (a.articulo.rubro ?? 'zzz').localeCompare(b.articulo.rubro ?? 'zzz', 'es') ||
      a.articulo.nombre.localeCompare(b.articulo.nombre, 'es'),
  );
}

/** El resumen de arriba de la pestaña: «8 productos · Bs 1.240,00 en mercadería» */
export function resumenDelInventario(negocio: NegocioElegido, grupos: GrupoDeInventario[]) {
  const lineas = grupos.flatMap((g) => g.lineas).filter((l) => !l.agotado);
  const valor = grupos.reduce((s, g) => s + g.valorCentavos, 0);
  const cuantos = `${lineas.length} ${lineas.length === 1 ? 'producto' : 'productos'}`;
  if (!lineas.length) return null;
  const en = negocio.tipo === 'hogar' ? 'en tu despensa' : negocio.tipo === 'tienda' ? 'en mercadería' : 'en insumos';
  return valor > 0 ? `${cuantos} · ${bs(valor)} ${en}` : `${cuantos} ${en}`;
}
