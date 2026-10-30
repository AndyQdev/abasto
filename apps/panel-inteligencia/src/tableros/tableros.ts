import { MAXIMO_DE_BARRAS, type Serie } from '../graficos/serie';

/** Respuesta de `GET /v1/tableros` del Asistente: montos en centavos y fechas aaaa-mm-dd. */
export interface Tableros {
  /** Productos de la próxima semana según el modelo de demanda, los más urgentes primero (menos días de stock). */
  demanda: { producto_id: string; nombre: string; stock: number; unidades_semana: number; dias_de_stock: number | null }[];
  /** Segmentos K-means de las tiendas cliente. */
  segmentos: { segmento: string; tiendas: number; compras_mes: number; ticket_promedio_centavos: number }[];
  /** Ventas confirmadas por día, últimos 30 días, de la más vieja a la más nueva. */
  ventas: { fecha: string; total_centavos: number }[];
  /** Cuentas por cobrar. */
  cobranza: { pendiente_centavos: number; vencida_centavos: number; cuentas_vencidas: number; vencen_esta_semana: number };
}

/** Debajo de estos días de stock el producto se considera en riesgo. */
export const DIAS_CRITICOS = 7;

export function productosEnRiesgo(demanda: Tableros['demanda'], dias = DIAS_CRITICOS): Tableros['demanda'] {
  return demanda
    .filter((p) => p.dias_de_stock !== null && p.dias_de_stock < dias)
    .sort((a, b) => (a.dias_de_stock as number) - (b.dias_de_stock as number) || a.nombre.localeCompare(b.nombre, 'es'));
}

export function serieDeVentas(ventas: Tableros['ventas']): Serie {
  return {
    columnaEtiqueta: 'fecha',
    columnaValor: 'total_centavos',
    puntos: ventas.map((v) => ({ etiqueta: v.fecha, valor: v.total_centavos })),
  };
}

export function serieDeSegmentos(segmentos: Tableros['segmentos']): Serie {
  return {
    columnaEtiqueta: 'segmento',
    columnaValor: 'tiendas',
    puntos: [...segmentos].sort((a, b) => b.tiendas - a.tiendas).map((s) => ({ etiqueta: s.segmento, valor: s.tiendas })),
  };
}

export function serieDeDemanda(demanda: Tableros['demanda']): Serie {
  return {
    columnaEtiqueta: 'nombre',
    columnaValor: 'unidades_semana',
    puntos: [...demanda]
      .sort((a, b) => b.unidades_semana - a.unidades_semana)
      .slice(0, MAXIMO_DE_BARRAS)
      .map((p) => ({ etiqueta: p.nombre, valor: p.unidades_semana })),
  };
}

export function totalDeVentas(ventas: Tableros['ventas']): number {
  return ventas.reduce((total, v) => total + v.total_centavos, 0);
}

export function textoDeDias(dias: number | null): string {
  if (dias === null) return 'Sin demanda prevista';
  if (dias === 0) return 'Sin stock';
  if (dias < 1) return 'Menos de 1 día';
  if (dias === 1) return '1 día';
  return `${Math.floor(dias)} días`;
}
