/**
 * «El mes» de la tienda y del productor, en palabras simples: vendí, me costó, gané (bruta), gastos y me quedó
 * (neta). Lo vendido se cuenta al costo de ese momento (el que guardó la venta). Los gastos del negocio son las
 * anotaciones GASTO hechas a mano (alquiler, luz, gas); lo comprado en Abasto no es gasto aquí: es mercadería o
 * insumo, y se cuenta como costo cuando se vende.
 */
import type { DatosDeNegocio } from './modelo';

export const mesDe = (iso: string) => iso.slice(0, 7);

export interface LoMasVendido {
  articuloId: string;
  cantidad: number;
  ventasCentavos: number;
  gananciaCentavos: number;
}

export interface ReporteDelMes {
  mes: string;
  ventas: number;
  ventasCentavos: number;
  costoCentavos: number;
  gananciaBrutaCentavos: number;
  gastosCentavos: number;
  gananciaNetaCentavos: number;
  /** De lo vendido en el mes, lo que se fió */
  fiadoCentavos: number;
  masVendidos: LoMasVendido[];
}

export function reporteDelMes(datos: Pick<DatosDeNegocio, 'ventas' | 'anotaciones'>, mes: string): ReporteDelMes {
  const ventas = datos.ventas.filter((v) => !v.anulada && mesDe(v.fecha) === mes);
  const ventasCentavos = ventas.reduce((s, v) => s + v.totalCentavos, 0);
  const costoCentavos = ventas.reduce((s, v) => s + v.costoCentavos, 0);
  const gastosCentavos = datos.anotaciones.filter((a) => a.tipo === 'GASTO' && a.origen === 'MANUAL' && mesDe(a.fecha) === mes).reduce((s, a) => s + a.montoCentavos, 0);
  const porArticulo = new Map<string, LoMasVendido>();
  for (const v of ventas) {
    for (const l of v.lineas) {
      const antes = porArticulo.get(l.articuloId) ?? { articuloId: l.articuloId, cantidad: 0, ventasCentavos: 0, gananciaCentavos: 0 };
      const total = l.cantidad * l.precioUnitarioCentavos;
      porArticulo.set(l.articuloId, {
        ...antes,
        cantidad: antes.cantidad + l.cantidad,
        ventasCentavos: antes.ventasCentavos + total,
        gananciaCentavos: antes.gananciaCentavos + total - l.cantidad * (l.costoUnitarioCentavos ?? 0),
      });
    }
  }
  return {
    mes,
    ventas: ventas.length,
    ventasCentavos,
    costoCentavos,
    gananciaBrutaCentavos: ventasCentavos - costoCentavos,
    gastosCentavos,
    gananciaNetaCentavos: ventasCentavos - costoCentavos - gastosCentavos,
    fiadoCentavos: ventas.filter((v) => v.forma === 'FIADO').reduce((s, v) => s + v.totalCentavos, 0),
    masVendidos: [...porArticulo.values()].sort((a, b) => b.gananciaCentavos - a.gananciaCentavos).slice(0, 5),
  };
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** «noviembre 2026» */
export const nombreDelMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;

/** El mes anterior o el siguiente: «2026-11» → «2026-10» */
export function otroMes(mes: string, salto: number) {
  const d = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 + salto, 1));
  return d.toISOString().slice(0, 7);
}
