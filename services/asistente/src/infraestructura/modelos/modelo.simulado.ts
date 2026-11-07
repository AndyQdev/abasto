import { PreguntaNoEntendida, type ConsultaGenerada, type ModeloDeLenguaje } from '../../reportes/puertos.js';

/**
 * Modelo de lenguaje simulado: reconoce las preguntas de la demo por palabras clave.
 * Se usa en las pruebas y cuando no hay ANTHROPIC_API_KEY, así nadie necesita pagar para trabajar.
 * Si no reconoce la pregunta lo dice (PreguntaNoEntendida) y da ejemplos: nunca responde otra cosa.
 * Las reglas van de la más específica a la más general: gana la primera que coincide.
 */
const REGLAS: Array<{ claves: RegExp; consulta: ConsultaGenerada }> = [
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
    consulta: {
      sql: `SELECT segmento, count(*) AS tiendas, round(avg(ticket_promedio_centavos)) AS ticket_promedio_centavos
              FROM segmento_tiendas GROUP BY segmento ORDER BY tiendas DESC`,
      explicacion: 'Cómo compran tus tiendas: segmentos de K-means (ML no supervisado).',
      grafico: 'barras',
    },
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
    consulta: {
      sql: `SELECT fecha, pedidos, total_centavos
              FROM ventas_diarias
             WHERE fecha >= date_trunc('month', current_date)
             ORDER BY fecha`,
      explicacion: 'Ventas confirmadas de cada día de este mes.',
      grafico: 'linea',
    },
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
