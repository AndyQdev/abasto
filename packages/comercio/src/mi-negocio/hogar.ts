/**
 * «Mi casa» (fase 6): las cuentas del mes, la despensa con «se te acaba en ~N días», la lista fija de la semana y
 * cuánto se ahorró frente al súper. Lo comprado en Abasto se anota solo como gasto (anotación ABASTO por pedido).
 */
import type { Producto } from '../catalogo';
import type { PedidoComprado } from './compras';
import type { Anotacion, DatosDeNegocio, ItemDeLista, Movimiento } from './modelo';
import { ErrorDeInventario, type Existencia } from './motor';
import { mesDe } from './reporte';

export const CATEGORIAS_DE_GASTO = ['Comida', 'Servicios', 'Transporte', 'Educación', 'Salud', 'Alquiler', 'Otros'] as const;
export const CATEGORIAS_DE_INGRESO = ['Sueldo', 'Venta', 'Ayuda', 'Otros'] as const;
export const COMPRAS_EN_ABASTO = 'Compras en Abasto';

export function anotacion(tipo: 'INGRESO' | 'GASTO', montoCentavos: number, categoria: string, nota: string | null, ahora: string, id: string): Anotacion {
  if (!Number.isFinite(montoCentavos) || montoCentavos <= 0) throw new ErrorDeInventario('Escribe el monto');
  if (!categoria.trim()) throw new ErrorDeInventario('Elige para qué fue');
  return { id, tipo, montoCentavos: Math.round(montoCentavos), categoria: categoria.trim(), nota: nota?.trim() || null, origen: 'MANUAL', claveUnica: `anotacion:${id}`, fecha: ahora };
}

/** El gasto de un pedido entregado: entra solo, una vez por pedido */
export function gastoDeCompra(p: PedidoComprado, ahora: string): Anotacion | null {
  if (p.estado !== 'ENTREGADO' || !p.total || p.total.centavos <= 0) return null;
  return { id: `pedido:${p.id}`, tipo: 'GASTO', montoCentavos: p.total.centavos, categoria: COMPRAS_EN_ABASTO, nota: `Pedido ${p.codigo}`, origen: 'ABASTO', claveUnica: `pedido:${p.id}`, fecha: ahora };
}

export interface CuentasDelMes {
  mes: string;
  ingresosCentavos: number;
  gastosCentavos: number;
  /** Ingresos − gastos: «te quedan Bs X» (negativo si se gastó más) */
  quedanCentavos: number;
  porCategoria: { categoria: string; centavos: number }[];
  anotaciones: Anotacion[];
}

export function cuentasDelMes(anotaciones: Anotacion[], mes: string): CuentasDelMes {
  const delMes = anotaciones.filter((a) => mesDe(a.fecha) === mes).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const ingresos = delMes.filter((a) => a.tipo === 'INGRESO').reduce((s, a) => s + a.montoCentavos, 0);
  const gastos = delMes.filter((a) => a.tipo === 'GASTO').reduce((s, a) => s + a.montoCentavos, 0);
  const porCategoria = new Map<string, number>();
  for (const a of delMes.filter((x) => x.tipo === 'GASTO')) porCategoria.set(a.categoria, (porCategoria.get(a.categoria) ?? 0) + a.montoCentavos);
  return {
    mes,
    ingresosCentavos: ingresos,
    gastosCentavos: gastos,
    quedanCentavos: ingresos - gastos,
    porCategoria: [...porCategoria.entries()].map(([categoria, centavos]) => ({ categoria, centavos })).sort((a, b) => b.centavos - a.centavos),
    anotaciones: delMes,
  };
}

const DIA = 24 * 60 * 60 * 1000;

/**
 * «Se te acaba en ~N días» (estimado): cuánto se usa por día según lo contado (ajustes hacia abajo, ventas y consumos)
 * desde la primera compra; si todavía no hay nada contado, cada cuánto se vuelve a comprar. Sin datos suficientes,
 * null: nunca se inventa.
 */
export function seTeAcaba(x: Existencia, movimientos: Movimiento[], ahora: string): number | null {
  if (x.agotado) return 0;
  const suyos = movimientos.filter((m) => m.articuloId === x.articulo.id).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const entradas = suyos.filter((m) => m.tipo === 'ENTRADA' && m.cantidad > 0);
  if (!entradas.length) return null;
  const desde = new Date(entradas[0].fecha).getTime();
  const dias = (new Date(ahora).getTime() - desde) / DIA;
  const usado = -suyos.filter((m) => m.cantidad < 0).reduce((s, m) => s + m.cantidad, 0);
  if (usado > 0 && dias >= 1) return Math.max(0, Math.round(x.cantidad / (usado / dias)));
  if (entradas.length >= 2) {
    const ultima = new Date(entradas[entradas.length - 1].fecha).getTime();
    const cadaCuanto = (ultima - desde) / (entradas.length - 1) / DIA;
    if (cadaCuanto < 1) return null;
    return Math.max(0, Math.round(cadaCuanto - (new Date(ahora).getTime() - ultima) / DIA));
  }
  return null;
}

/** Un producto de la lista fija (o el mismo con otra cantidad) */
export function itemDeLista(productoId: string, presentacion: string, cantidad: number, ahora: string, id: string): ItemDeLista {
  if (!Number.isFinite(cantidad) || cantidad <= 0) throw new ErrorDeInventario('¿Cuántos?');
  return { id, productoId, presentacion, cantidad: Math.round(cantidad), actualizadoEn: ahora, eliminado: false };
}

export const listaVigente = (lista: ItemDeLista[]) => lista.filter((i) => !i.eliminado);

/**
 * Cuánto se ahorró frente al súper en lo comprado y entregado: por cada línea con precio del súper conocido,
 * (precio del súper × unidades) − lo que se pagó. Solo suma ahorros reales (si alguna línea salió más cara, resta).
 */
export function ahorroFrenteAlSuper(pedidos: PedidoComprado[], productos: Producto[], mes?: string) {
  let ahorro = 0;
  let comparadas = 0;
  for (const p of pedidos) {
    if (p.estado !== 'ENTREGADO') continue;
    if (mes && p.creadoEn && mesDe(p.creadoEn) !== mes) continue;
    for (const l of p.lineas) {
      const super_ = productos.find((x) => x.id === l.producto.id)?.precioEnSuper?.precio.centavos;
      const pagado = l.subtotal.centavos;
      if (!super_ || pagado === undefined) continue;
      ahorro += super_ * l.unidades - pagado;
      comparadas += 1;
    }
  }
  return { ahorroCentavos: ahorro, lineasComparadas: comparadas };
}

/** Lo que el hogar tiene registrado este mes, para el resumen de arriba */
export function resumenDeLaCasa(datos: Pick<DatosDeNegocio, 'anotaciones'>, mes: string) {
  const c = cuentasDelMes(datos.anotaciones, mes);
  return { quedanCentavos: c.quedanCentavos, gastosCentavos: c.gastosCentavos, ingresosCentavos: c.ingresosCentavos };
}
