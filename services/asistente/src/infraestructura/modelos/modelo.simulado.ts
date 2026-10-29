import type { ConsultaGenerada, ModeloDeLenguaje } from '../../reportes/puertos.js';

/**
 * Modelo de lenguaje simulado: reconoce las preguntas de la demo por palabras clave.
 * Se usa en las pruebas y cuando no hay ANTHROPIC_API_KEY, así nadie necesita pagar para trabajar.
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
    claves: /(stock|reponer|acaba|quedo sin)/,
    consulta: {
      sql: `SELECT nombre, stock, vendidas_por_dia, round(stock / nullif(vendidas_por_dia, 0)) AS dias_de_stock
              FROM stock_productos
             ORDER BY dias_de_stock ASC NULLS LAST`,
      explicacion: 'Productos ordenados por cuántos días de stock les quedan.',
      grafico: 'tabla',
    },
  },
];

const VENTAS: ConsultaGenerada = {
  sql: `SELECT fecha, pedidos, total_centavos
          FROM ventas_diarias
         WHERE fecha >= date_trunc('month', current_date)
         ORDER BY fecha`,
  explicacion: 'Ventas confirmadas de cada día de este mes.',
  grafico: 'linea',
};

export class ModeloSimulado implements ModeloDeLenguaje {
  readonly nombre = 'simulado';

  async generarConsulta(pregunta: string): Promise<ConsultaGenerada> {
    // Sin tildes ni mayúsculas: la voz transcrita no siempre las trae
    const texto = pregunta.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return REGLAS.find((r) => r.claves.test(texto))?.consulta ?? VENTAS;
  }
}
