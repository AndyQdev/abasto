/**
 * Las tablas de la base `reportes` que el Analista y el MCP pueden leer.
 * Es la lista blanca de la guardia de SQL y lo que se le explica al modelo de lenguaje.
 * La columna org_id existe en todas, pero nadie la filtra a mano: la seguridad por fila de PostgreSQL
 * deja ver solo las filas de la empresa del token.
 */
export const ESQUEMA_REPORTES = {
  ventas_diarias: {
    descripcion: 'Ventas confirmadas por día de cada mayorista',
    columnas: {
      fecha: 'date',
      pedidos: 'integer: cantidad de pedidos confirmados ese día',
      total_centavos: 'bigint: total vendido en centavos de boliviano',
    },
  },
  cuentas_por_cobrar: {
    descripcion: 'Pedidos vendidos a crédito que la tienda todavía debe',
    columnas: {
      pedido_id: 'text, por ejemplo A-1042',
      tienda_id: 'text',
      tienda_nombre: 'text, por ejemplo Tienda Doña Rosa',
      saldo_centavos: 'bigint: lo que falta pagar, en centavos',
      vence: 'date: día en que vence el crédito',
      estado: "text: 'pendiente', 'vencida' o 'pagada'",
    },
  },
  pedidos: {
    descripcion: 'Cada pedido que recibió el mayorista y en qué quedó',
    columnas: {
      pedido_id: 'text',
      codigo: 'text, por ejemplo A-1042',
      tienda_id: 'text',
      tienda_nombre: 'text, por ejemplo Despensa Lupita',
      metodo_pago: "text: 'qr', 'credito' o 'contra_entrega'",
      total_centavos: 'bigint: total del pedido en centavos',
      estado:
        "text: 'PENDIENTE', 'POR_CONFIRMAR', 'CONFIRMADO', 'RECHAZADO', 'EN_PREPARACION', 'DESPACHADO' o 'ENTREGADO'",
      motivo_rechazo: 'text: por qué se rechazó (null si no se rechazó)',
      creado_en: 'timestamptz: cuándo lo hizo la tienda',
      actualizado_en: 'timestamptz: último cambio de estado',
    },
  },
  stock_productos: {
    descripcion: 'Stock actual de cada producto del mayorista',
    columnas: {
      producto_id: 'text',
      nombre: 'text, por ejemplo Shampoo 400 ml',
      stock: 'integer: unidades disponibles',
      vendidas_por_dia: 'numeric: promedio de unidades vendidas por día en los últimos 30 días',
    },
  },
  prediccion_demanda: {
    descripcion: 'Demanda esperada por producto y semana (modelo supervisado de ML)',
    columnas: {
      producto_id: 'text',
      semana: 'date: lunes de la semana',
      unidades: 'numeric: unidades que se espera vender',
    },
  },
  segmento_tiendas: {
    descripcion: 'Segmento de cada tienda cliente según cómo compra (K-means)',
    columnas: {
      tienda_id: 'text',
      tienda_nombre: 'text',
      segmento: "text: por ejemplo 'Compra seguido y poco' o 'Compra por caja'",
      compras_mes: 'numeric: compras promedio por mes',
      ticket_promedio_centavos: 'bigint',
    },
  },
} as const;

export type TablaDeReportes = keyof typeof ESQUEMA_REPORTES;
export const TABLAS_PERMITIDAS = new Set<string>(Object.keys(ESQUEMA_REPORTES));

/** Texto del esquema para el modelo de lenguaje. */
export function describirEsquema(): string {
  return Object.entries(ESQUEMA_REPORTES)
    .map(
      ([tabla, t]) =>
        `${tabla}: ${t.descripcion}\n` +
        Object.entries(t.columnas)
          .map(([c, d]) => `  - ${c}: ${d}`)
          .join('\n'),
    )
    .join('\n\n');
}
