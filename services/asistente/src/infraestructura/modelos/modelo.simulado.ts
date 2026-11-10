import { graficoDe } from '../../reportes/dominio/plantillas.js';
import { PreguntaNoEntendida, type BloqueGenerado, type ConsultaGenerada, type ModeloDeLenguaje } from '../../reportes/puertos.js';

/**
 * Modelo de lenguaje simulado: reconoce las preguntas de la demo por palabras clave.
 * Se usa en las pruebas y cuando no está configurado Vertex AI (Gemini), así nadie necesita pagar para trabajar.
 * Si no reconoce la pregunta lo dice (PreguntaNoEntendida) y da ejemplos: nunca responde otra cosa.
 * Las reglas van de la más específica a la más general: gana la primera que coincide.
 */
/** Las consultas de las vistas de varios bloques. El mismo diagnóstico que se le pide a Gemini en las instrucciones. */
const SQL = {
  kpis30: `SELECT sum(CASE WHEN fecha > current_date - 30 THEN total_centavos ELSE 0 END) AS ventas_centavos,
                  sum(CASE WHEN fecha <= current_date - 30 THEN total_centavos ELSE 0 END) AS ventas_centavos_anterior,
                  sum(CASE WHEN fecha > current_date - 30 THEN pedidos ELSE 0 END) AS pedidos,
                  sum(CASE WHEN fecha <= current_date - 30 THEN pedidos ELSE 0 END) AS pedidos_anterior,
                  round(sum(CASE WHEN fecha > current_date - 30 THEN total_centavos ELSE 0 END)
                        / nullif(sum(CASE WHEN fecha > current_date - 30 THEN pedidos ELSE 0 END), 0)) AS ticket_promedio_centavos,
                  round(sum(CASE WHEN fecha <= current_date - 30 THEN total_centavos ELSE 0 END)
                        / nullif(sum(CASE WHEN fecha <= current_date - 30 THEN pedidos ELSE 0 END), 0)) AS ticket_promedio_centavos_anterior
             FROM ventas_diarias WHERE fecha > current_date - 60`,
  semanas: `SELECT date_trunc('week', fecha)::date AS semana, sum(total_centavos) AS ventas_centavos
              FROM ventas_diarias WHERE fecha > current_date - 84
             GROUP BY date_trunc('week', fecha)::date ORDER BY semana`,
  productos: `SELECT producto_nombre, sum(total_centavos) AS ventas_centavos
                FROM ventas_por_producto WHERE fecha > current_date - 30
               GROUP BY producto_nombre ORDER BY ventas_centavos DESC LIMIT 10`,
  pagos: `SELECT metodo_pago, sum(total_centavos) AS total_centavos
            FROM pedidos WHERE creado_en > current_date - 30 AND estado <> 'RECHAZADO'
           GROUP BY metodo_pago ORDER BY total_centavos DESC`,
  dejaron: `SELECT tienda_nombre, max(creado_en)::date AS ultima_compra, sum(total_centavos) AS compro_centavos
              FROM pedidos WHERE creado_en > current_date - 90 AND estado <> 'RECHAZADO'
             GROUP BY tienda_nombre HAVING max(creado_en) <= current_date - 30
             ORDER BY compro_centavos DESC LIMIT 10`,
};

/** Una vista de varios bloques: arriba van el SQL y el gráfico del primero, como antes. */
const vista = (explicacion: string, bloques: BloqueGenerado[]): ConsultaGenerada => ({
  sql: bloques[0].sql,
  explicacion,
  grafico: graficoDe(bloques[0].plantilla),
  bloques,
});

const REGLAS: Array<{ claves: RegExp; consulta: ConsultaGenerada }> = [
  {
    claves: /(mi negocio|resumen|vender? mas|vendo mas|recomiend|mejorar|como (me )?va |como voy|diagnostico)/,
    consulta: vista('Cómo va tu negocio en los últimos 30 días comparado con los 30 anteriores.', [
      { titulo: 'Últimos 30 días', plantilla: 'kpis', sql: SQL.kpis30 },
      { titulo: 'Ventas por semana', plantilla: 'linea', sql: SQL.semanas },
      { titulo: 'Lo que más vendiste', plantilla: 'barras', sql: SQL.productos },
      { titulo: 'Cómo te pagan', plantilla: 'dona', sql: SQL.pagos },
      { titulo: 'Tiendas que dejaron de comprar', plantilla: 'tabla', sql: SQL.dejaron },
    ]),
  },
  {
    claves: /(como me pagan|metodos? de pago|forma de pago|como pagan)/,
    consulta: vista('Cómo te pagaron los pedidos de los últimos 30 días.', [{ titulo: 'Cómo te pagan', plantilla: 'dona', sql: SQL.pagos }]),
  },
  {
    claves: /(pagar|cobrar|vence|deben).*(manana)|manana.*(pagar|cobrar|vence)/,
    consulta: {
      sql: `SELECT tienda_nombre, pedido_id, saldo_centavos, vence
              FROM cuentas_por_cobrar
             WHERE vence = current_date + 1 AND estado <> 'pagada'
             ORDER BY saldo_centavos DESC`,
      explicacion: 'Cuentas a crédito que vencen mañana y todavía no se pagaron.',
      grafico: 'tabla',
    },
  },
  {
    claves: /(riesgo|mora|pag\w* tarde|no me pag|confiable)/,
    consulta: {
      sql: `SELECT tienda_nombre, round(riesgo * 100) AS riesgo_por_ciento, saldo_centavos, cuentas_vencidas
              FROM riesgo_mora
             ORDER BY riesgo DESC`,
      explicacion: 'Probabilidad de que cada tienda pague tarde, según el modelo de mora (ML).',
      grafico: 'barras',
    },
  },
  {
    claves: /(debe|deuda|por cobrar|vencid)/,
    consulta: {
      sql: `SELECT tienda_nombre, sum(saldo_centavos) AS saldo_centavos, min(vence) AS vence_primero
              FROM cuentas_por_cobrar
             WHERE estado <> 'pagada'
             GROUP BY tienda_nombre
             ORDER BY saldo_centavos DESC`,
      explicacion: 'Lo que debe cada tienda y su primer vencimiento.',
      grafico: 'barras',
    },
  },
  {
    claves: /(sin stock|agotad|no tengo stock)/,
    consulta: {
      sql: `SELECT nombre, vendidas_por_dia FROM stock_productos WHERE stock = 0 ORDER BY vendidas_por_dia DESC, nombre`,
      explicacion: 'Productos que ya no tienen stock.',
      grafico: 'tabla',
    },
  },
  {
    claves: /(stock|reponer|acaba|quedo sin|inventario)/,
    consulta: {
      sql: `SELECT nombre, stock, vendidas_por_dia, round(stock / nullif(vendidas_por_dia, 0)) AS dias_de_stock
              FROM stock_productos
             ORDER BY dias_de_stock ASC NULLS LAST`,
      explicacion: 'Productos ordenados por cuántos días de stock les quedan.',
      grafico: 'tabla',
    },
  },
  {
    claves: /(prevista|prediccion|demanda|proxima semana|voy a vender)/,
    consulta: {
      sql: `SELECT s.nombre, p.unidades
              FROM prediccion_demanda p JOIN stock_productos s ON s.producto_id = p.producto_id
             WHERE p.semana >= current_date - 6
             ORDER BY p.unidades DESC`,
      explicacion: 'Unidades que se espera vender por producto, según el modelo de demanda (ML).',
      grafico: 'barras',
    },
  },
  {
    claves: /(mas (se )?vend|mas (se )?sale|mas (se )?pide|top|mejores productos)/,
    consulta: {
      sql: `SELECT nombre, round(vendidas_por_dia * 30) AS unidades_mes
              FROM stock_productos WHERE vendidas_por_dia > 0
             ORDER BY vendidas_por_dia DESC LIMIT 10`,
      explicacion: 'Los productos que más salen: unidades por mes con el promedio de 30 días.',
      grafico: 'barras',
    },
  },
  {
    claves: /(rechaz)/,
    consulta: {
      sql: `SELECT codigo, tienda_nombre, total_centavos, motivo_rechazo, creado_en::date AS fecha
              FROM pedidos WHERE estado = 'RECHAZADO'
             ORDER BY creado_en DESC`,
      explicacion: 'Pedidos rechazados y por qué.',
      grafico: 'tabla',
    },
  },
  {
    claves: /(segment|tipos? de tienda|como compran)/,
    consulta: vista('Cómo compran tus tiendas: segmentos de K-means (ML no supervisado).', [
      { titulo: 'Tiendas por segmento', plantilla: 'dona', sql: `SELECT segmento, count(*) AS tiendas FROM segmento_tiendas GROUP BY segmento ORDER BY tiendas DESC` },
      {
        titulo: 'Ticket promedio por segmento',
        plantilla: 'barras',
        sql: `SELECT segmento, round(avg(ticket_promedio_centavos)) AS ticket_promedio_centavos
                FROM segmento_tiendas GROUP BY segmento ORDER BY ticket_promedio_centavos DESC`,
      },
    ]),
  },
  {
    claves: /(pedido)/,
    consulta: {
      sql: `SELECT codigo, tienda_nombre, metodo_pago, total_centavos, estado, creado_en::date AS fecha
              FROM pedidos
             ORDER BY creado_en DESC LIMIT 50`,
      explicacion: 'Tus últimos pedidos y en qué quedaron.',
      grafico: 'tabla',
    },
  },
  {
    claves: /(vend|venta|factur|ingres)/,
    consulta: vista('Lo vendido este mes, comparado con los mismos días del mes pasado, y las ventas de cada día.', [
      {
        titulo: 'Este mes',
        plantilla: 'kpis',
        sql: `SELECT sum(CASE WHEN fecha >= date_trunc('month', current_date) THEN total_centavos ELSE 0 END) AS ventas_centavos,
                       sum(CASE WHEN fecha < date_trunc('month', current_date) THEN total_centavos ELSE 0 END) AS ventas_centavos_anterior,
                       sum(CASE WHEN fecha >= date_trunc('month', current_date) THEN pedidos ELSE 0 END) AS pedidos,
                       sum(CASE WHEN fecha < date_trunc('month', current_date) THEN pedidos ELSE 0 END) AS pedidos_anterior
                  FROM ventas_diarias
                 WHERE fecha >= date_trunc('month', current_date)
                    OR (fecha >= date_trunc('month', current_date) - interval '1 month' AND fecha <= current_date - interval '1 month')`,
      },
      {
        titulo: 'Ventas de cada día',
        plantilla: 'linea',
        sql: `SELECT fecha, total_centavos FROM ventas_diarias WHERE fecha >= date_trunc('month', current_date) ORDER BY fecha`,
      },
    ]),
  },
];

/** Lo que se le sugiere a quien pregunta algo que el simulado no reconoce. */
export const EJEMPLOS = [
  '¿Qué tiendas me tienen que pagar mañana?',
  '¿Cuánto me debe cada tienda?',
  '¿Qué productos se me acaban?',
  '¿Cuánto vendí este mes?',
  '¿Qué tiendas tienen más riesgo de pagar tarde?',
];

export class ModeloSimulado implements ModeloDeLenguaje {
  readonly nombre = 'simulado';

  async generarConsulta(pregunta: string): Promise<ConsultaGenerada> {
    // Sin tildes ni mayúsculas: la voz transcrita no siempre las trae
    const texto = pregunta.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const regla = REGLAS.find((r) => r.claves.test(texto));
    if (!regla) throw new PreguntaNoEntendida(EJEMPLOS);
    return regla.consulta;
  }
}
