import { demandaDeLaSemana, type DemandaDeLaSemana, type PrediccionDeDemanda, type StockDeProducto } from '../dominio/demanda.js';
import type { Solicitante } from '../puertos.js';
import type { ConsultarReportes } from './consultar-reportes.js';

/** Lo que ve el mayorista en Inteligencia › Tableros. Contrato con `apps/panel-inteligencia/src/tableros/tableros.ts`. */
export interface Tableros {
  demanda: DemandaDeLaSemana[];
  segmentos: { segmento: string; tiendas: number; compras_mes: number; ticket_promedio_centavos: number }[];
  ventas: { fecha: string; total_centavos: number }[];
  cobranza: { pendiente_centavos: number; vencida_centavos: number; cuentas_vencidas: number; vencen_esta_semana: number };
}

const CONSULTAS = {
  stock: 'SELECT producto_id, nombre, stock, vendidas_por_dia FROM stock_productos',
  predicciones: 'SELECT producto_id, semana, unidades FROM prediccion_demanda WHERE semana >= current_date - 6 ORDER BY semana',
  segmentos: `SELECT segmento, count(*) AS tiendas, round(avg(compras_mes), 1) AS compras_mes,
                     round(avg(ticket_promedio_centavos)) AS ticket_promedio_centavos
                FROM segmento_tiendas GROUP BY segmento ORDER BY tiendas DESC, segmento`,
  ventas: 'SELECT fecha, total_centavos FROM ventas_diarias WHERE fecha > current_date - 30 ORDER BY fecha',
  // «vencida» también es una pendiente cuya fecha ya pasó, aunque el proyector todavía no la marcó
  cobranza: `SELECT
      coalesce(sum(CASE WHEN estado = 'pendiente' AND vence >= current_date THEN saldo_centavos ELSE 0 END), 0) AS pendiente_centavos,
      coalesce(sum(CASE WHEN estado = 'vencida' OR (estado = 'pendiente' AND vence < current_date) THEN saldo_centavos ELSE 0 END), 0) AS vencida_centavos,
      count(CASE WHEN estado = 'vencida' OR (estado = 'pendiente' AND vence < current_date) THEN 1 END) AS cuentas_vencidas,
      count(CASE WHEN estado = 'pendiente' AND vence >= current_date AND vence < current_date + 7 THEN 1 END) AS vencen_esta_semana
    FROM cuentas_por_cobrar`,
} as const;

/** Pasa por la misma puerta que el Analista: guardia de SQL, solo lectura, filas de la empresa y auditoría. */
export class ConsultarTableros {
  constructor(private readonly reportes: ConsultarReportes) {}

  async ejecutar(solicitante: Solicitante): Promise<Tableros> {
    const leer = async <T>(sql: string) =>
      (await this.reportes.ejecutar(sql, solicitante, 'tablero')).filas as unknown as T[];
    const [stock, predicciones, segmentos, ventas, [cobranza]] = await Promise.all([
      leer<StockDeProducto>(CONSULTAS.stock),
      leer<PrediccionDeDemanda>(CONSULTAS.predicciones),
      leer<Tableros['segmentos'][number]>(CONSULTAS.segmentos),
      leer<Tableros['ventas'][number]>(CONSULTAS.ventas),
      leer<Tableros['cobranza']>(CONSULTAS.cobranza),
    ]);
    return {
      demanda: demandaDeLaSemana(stock, predicciones),
      segmentos: segmentos.map((s) => ({
        segmento: s.segmento,
        tiendas: Number(s.tiendas),
        compras_mes: Number(s.compras_mes),
        ticket_promedio_centavos: Number(s.ticket_promedio_centavos),
      })),
      ventas: ventas.map((v) => ({ fecha: v.fecha, total_centavos: Number(v.total_centavos) })),
      cobranza: {
        pendiente_centavos: Number(cobranza?.pendiente_centavos ?? 0),
        vencida_centavos: Number(cobranza?.vencida_centavos ?? 0),
        cuentas_vencidas: Number(cobranza?.cuentas_vencidas ?? 0),
        vencen_esta_semana: Number(cobranza?.vencen_esta_semana ?? 0),
      },
    };
  }
}
