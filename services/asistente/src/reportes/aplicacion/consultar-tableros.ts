import { demandaDeLaSemana, type DemandaDeLaSemana, type PrediccionDeDemanda, type StockDeProducto } from '../dominio/demanda.js';
import type { Solicitante } from '../puertos.js';
import type { ConsultarReportes } from './consultar-reportes.js';

/** Lo que ve el mayorista en Inteligencia › Tableros. Contrato con `apps/panel-inteligencia/src/tableros/tableros.ts`. */
export interface Tableros {
  demanda: DemandaDeLaSemana[];
  segmentos: { segmento: string; tiendas: number; compras_mes: number; ticket_promedio_centavos: number }[];
  ventas: { fecha: string; total_centavos: number }[];
  cobranza: { pendiente_centavos: number; vencida_centavos: number; cuentas_vencidas: number; vencen_esta_semana: number };
  /** Lo que más sale: unidades por mes según el promedio de los últimos 30 días */
  masVendidos: { producto_id: string; nombre: string; unidades_mes: number }[];
  /** Quién te debe, lo más urgente primero (vencido, después lo que vence antes) */
  teDeben: { tienda_id: string; tienda_nombre: string; saldo_centavos: number; vence: string; vencida: boolean }[];
  /** Tiendas que compraron por primera vez en 30 días y las que compraban y no vuelven hace 30 días */
  tiendas: {
    nuevas: { tienda_id: string; tienda_nombre: string; desde: string }[];
    dejaron: { tienda_id: string; tienda_nombre: string; ultima: string }[];
  };
  /** Cómo te pagan los pedidos de los últimos 30 días */
  formasDePago: { metodo_pago: string; pedidos: number; total_centavos: number }[];
  /** Riesgo de pago tarde por tienda (ML supervisado), el más alto primero */
  mora: { tienda_id: string; tienda_nombre: string; riesgo: number; saldo_centavos: number; cuentas_vencidas: number }[];
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
  masVendidos: `SELECT producto_id, nombre, round(vendidas_por_dia * 30) AS unidades_mes
                  FROM stock_productos WHERE vendidas_por_dia > 0
                 ORDER BY vendidas_por_dia DESC, nombre LIMIT 8`,
  teDeben: `SELECT tienda_id, max(tienda_nombre) AS tienda_nombre, sum(saldo_centavos) AS saldo_centavos, min(vence) AS vence,
                   max(CASE WHEN estado = 'vencida' OR vence < current_date THEN 1 ELSE 0 END) AS vencida
              FROM cuentas_por_cobrar WHERE estado <> 'pagada'
             GROUP BY tienda_id ORDER BY vencida DESC, vence, saldo_centavos DESC LIMIT 8`,
  // Un pedido rechazado no cuenta como compra
  tiendas: `SELECT tienda_id, max(tienda_nombre) AS tienda_nombre, min(creado_en)::date AS primera, max(creado_en)::date AS ultima
              FROM pedidos WHERE estado <> 'RECHAZADO' GROUP BY tienda_id`,
  formasDePago: `SELECT metodo_pago, count(*) AS pedidos, coalesce(sum(total_centavos), 0) AS total_centavos
                   FROM pedidos WHERE estado <> 'RECHAZADO' AND creado_en > current_date - 30
                  GROUP BY metodo_pago ORDER BY total_centavos DESC`,
  mora: `SELECT tienda_id, tienda_nombre, riesgo, saldo_centavos, cuentas_vencidas
           FROM riesgo_mora ORDER BY riesgo DESC, saldo_centavos DESC LIMIT 8`,
} as const;

/** Días sin comprar para decir que una tienda «dejó de comprar», y ventana de «nueva» */
export const DIAS_SIN_COMPRAR = 30;

const fecha = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

/** Separa las tiendas nuevas (primera compra en la ventana) de las que dejaron de comprar (última antes de la ventana). */
export function nuevasYPerdidas(
  filas: { tienda_id: string; tienda_nombre: string; primera: unknown; ultima: unknown }[],
  hoy: Date,
): Tableros['tiendas'] {
  const corte = new Date(hoy.getTime() - DIAS_SIN_COMPRAR * 86_400_000).toISOString().slice(0, 10);
  const nuevas = filas
    .filter((f) => fecha(f.primera) > corte)
    .map((f) => ({ tienda_id: f.tienda_id, tienda_nombre: f.tienda_nombre, desde: fecha(f.primera) }))
    .sort((a, b) => b.desde.localeCompare(a.desde));
  const dejaron = filas
    .filter((f) => fecha(f.ultima) <= corte)
    .map((f) => ({ tienda_id: f.tienda_id, tienda_nombre: f.tienda_nombre, ultima: fecha(f.ultima) }))
    .sort((a, b) => a.ultima.localeCompare(b.ultima));
  return { nuevas, dejaron };
}

/** Pasa por la misma puerta que el Analista: guardia de SQL, solo lectura, filas de la empresa y auditoría. */
export class ConsultarTableros {
  constructor(
    private readonly reportes: ConsultarReportes,
    private readonly reloj: () => Date = () => new Date(),
  ) {}

  async ejecutar(solicitante: Solicitante): Promise<Tableros> {
    const leer = async <T>(sql: string) =>
      (await this.reportes.ejecutar(sql, solicitante, 'tablero')).filas as unknown as T[];
    const [stock, predicciones, segmentos, ventas, [cobranza], masVendidos, teDeben, tiendas, formasDePago, mora] =
      await Promise.all([
        leer<StockDeProducto>(CONSULTAS.stock),
        leer<PrediccionDeDemanda>(CONSULTAS.predicciones),
        leer<Tableros['segmentos'][number]>(CONSULTAS.segmentos),
        leer<Tableros['ventas'][number]>(CONSULTAS.ventas),
        leer<Tableros['cobranza']>(CONSULTAS.cobranza),
        leer<Tableros['masVendidos'][number]>(CONSULTAS.masVendidos),
        leer<Record<string, unknown>>(CONSULTAS.teDeben),
        leer<{ tienda_id: string; tienda_nombre: string; primera: unknown; ultima: unknown }>(CONSULTAS.tiendas),
        leer<Tableros['formasDePago'][number]>(CONSULTAS.formasDePago),
        leer<Tableros['mora'][number]>(CONSULTAS.mora),
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
      masVendidos: masVendidos.map((p) => ({ producto_id: p.producto_id, nombre: p.nombre, unidades_mes: Number(p.unidades_mes) })),
      teDeben: teDeben.map((t) => ({
        tienda_id: String(t.tienda_id),
        tienda_nombre: String(t.tienda_nombre),
        saldo_centavos: Number(t.saldo_centavos),
        vence: fecha(t.vence),
        vencida: Number(t.vencida) === 1,
      })),
      tiendas: nuevasYPerdidas(tiendas, this.reloj()),
      formasDePago: formasDePago.map((f) => ({
        metodo_pago: f.metodo_pago,
        pedidos: Number(f.pedidos),
        total_centavos: Number(f.total_centavos),
      })),
      mora: mora.map((m) => ({
        tienda_id: m.tienda_id,
        tienda_nombre: m.tienda_nombre,
        riesgo: Number(m.riesgo),
        saldo_centavos: Number(m.saldo_centavos),
        cuentas_vencidas: Number(m.cuentas_vencidas),
      })),
    };
  }
}
