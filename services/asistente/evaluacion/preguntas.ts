/**
 * Evaluación del Analista: 20 preguntas de negocio de un mayorista, cada una con la consulta correcta escrita a mano.
 * El evaluador corre las dos (la que genera el modelo y la correcta) como mcp_lector sobre los datos de demo
 * y compara los resultados. La meta de la tarjeta 19 es acertar al menos 18.
 */
export interface PreguntaDeEvaluacion {
  pregunta: string;
  /** La respuesta correcta, sobre las tablas de reportes (la seguridad por fila pone la empresa). */
  correcta: string;
}

export const META_DE_ACIERTOS = 18;

export const PREGUNTAS: PreguntaDeEvaluacion[] = [
  {
    pregunta: '¿Qué tiendas me tienen que pagar mañana?',
    correcta: "SELECT tienda_nombre FROM cuentas_por_cobrar WHERE vence = current_date + 1 AND estado <> 'pagada'",
  },
  {
    pregunta: '¿Cuánto me debe en total cada tienda?',
    correcta: `SELECT tienda_nombre, sum(saldo_centavos) AS saldo_centavos FROM cuentas_por_cobrar
                WHERE estado <> 'pagada' GROUP BY tienda_nombre`,
  },
  {
    pregunta: '¿Cuánto me deben en total entre todas las tiendas?',
    correcta: "SELECT sum(saldo_centavos) AS total_centavos FROM cuentas_por_cobrar WHERE estado <> 'pagada'",
  },
  {
    pregunta: '¿Qué cuentas por cobrar están vencidas?',
    correcta: "SELECT pedido_id, tienda_nombre, saldo_centavos FROM cuentas_por_cobrar WHERE estado = 'vencida'",
  },
  {
    pregunta: '¿Qué tienda es la que más me debe?',
    correcta: `SELECT tienda_nombre FROM cuentas_por_cobrar WHERE estado <> 'pagada'
                GROUP BY tienda_nombre ORDER BY sum(saldo_centavos) DESC LIMIT 1`,
  },
  {
    pregunta: '¿Cuántas cuentas por cobrar tengo pendientes?',
    correcta: "SELECT count(*) AS cuentas FROM cuentas_por_cobrar WHERE estado = 'pendiente'",
  },
  {
    pregunta: '¿Qué productos están sin stock?',
    correcta: 'SELECT nombre FROM stock_productos WHERE stock = 0',
  },
  {
    pregunta: '¿Cuál es el producto con más unidades en stock?',
    correcta: 'SELECT nombre FROM stock_productos ORDER BY stock DESC LIMIT 1',
  },
  {
    pregunta: '¿Cuántas unidades de Shampoo 400 ml tengo?',
    correcta: "SELECT stock FROM stock_productos WHERE nombre = 'Shampoo 400 ml'",
  },
  {
    pregunta: '¿Qué productos se me acaban en menos de 10 días al ritmo que vendo?',
    correcta: 'SELECT nombre FROM stock_productos WHERE vendidas_por_dia > 0 AND stock / vendidas_por_dia < 10',
  },
  {
    pregunta: '¿Cuánto vendí este mes?',
    correcta: "SELECT sum(total_centavos) AS total_centavos FROM ventas_diarias WHERE fecha >= date_trunc('month', current_date)",
  },
  {
    pregunta: '¿Cuántos pedidos confirmados tuve este mes?',
    correcta: "SELECT sum(pedidos) AS pedidos FROM ventas_diarias WHERE fecha >= date_trunc('month', current_date)",
  },
  {
    pregunta: '¿Qué día de este mes vendí más?',
    correcta: `SELECT fecha FROM ventas_diarias WHERE fecha >= date_trunc('month', current_date)
                ORDER BY total_centavos DESC LIMIT 1`,
  },
  {
    pregunta: '¿Cuánto vendí ayer?',
    correcta: 'SELECT total_centavos FROM ventas_diarias WHERE fecha = current_date - 1',
  },
  {
    pregunta: 'Muéstrame las ventas de cada día de los últimos 7 días',
    correcta: 'SELECT fecha, total_centavos FROM ventas_diarias WHERE fecha > current_date - 7 AND fecha <= current_date',
  },
  {
    pregunta: '¿Qué tiendas me deben más de 1.000 bolivianos?',
    correcta: `SELECT tienda_nombre FROM cuentas_por_cobrar WHERE estado <> 'pagada'
                GROUP BY tienda_nombre HAVING sum(saldo_centavos) > 100000`,
  },
  {
    pregunta: '¿Qué cuentas vencen en los próximos 7 días?',
    correcta: `SELECT pedido_id FROM cuentas_por_cobrar
                WHERE vence BETWEEN current_date AND current_date + 7 AND estado <> 'pagada'`,
  },
  {
    pregunta: '¿Cuántos productos tengo registrados?',
    correcta: 'SELECT count(*) AS productos FROM stock_productos',
  },
  {
    pregunta: '¿Cuál fue el ticket promedio por pedido este mes?',
    correcta: `SELECT round(sum(total_centavos)::numeric / nullif(sum(pedidos), 0)) AS ticket_promedio_centavos
                 FROM ventas_diarias WHERE fecha >= date_trunc('month', current_date)`,
  },
  {
    pregunta: '¿Cuántos días de stock le quedan al papel higiénico?',
    correcta: "SELECT round(stock / nullif(vendidas_por_dia, 0)) AS dias FROM stock_productos WHERE nombre ILIKE 'papel higi%'",
  },
];

type Fila = Record<string, unknown>;

/** Un número y otro son iguales si difieren en menos de medio por ciento (redondeos de promedio). */
function mismoValor(a: unknown, b: unknown): boolean {
  if (a === null || b === null || a === undefined || b === undefined) return a == b;
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && typeof a !== 'boolean') {
    return Math.abs(na - nb) <= Math.max(1, Math.abs(nb) * 0.005);
  }
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

/**
 * La respuesta acierta si trae las mismas filas que la correcta: cada fila correcta tiene una fila distinta
 * en la respuesta con todos sus valores (la respuesta puede traer columnas de más, como el nombre junto al monto).
 */
export function respuestaCorrecta(respuesta: Fila[], correcta: Fila[]): boolean {
  if (respuesta.length !== correcta.length) return false;
  const libres = [...respuesta];
  for (const filaCorrecta of correcta) {
    const valores = Object.values(filaCorrecta);
    const i = libres.findIndex((fila) => valores.every((v) => Object.values(fila).some((r) => mismoValor(r, v))));
    if (i === -1) return false;
    libres.splice(i, 1);
  }
  return true;
}
