/**
 * Proyector CQRS: traduce cada evento de los servicios a cambios en la base `reportes`.
 * Es una función pura (evento → sentencias), así se prueba sin base de datos.
 * El formato de los eventos está en contracts/asyncapi.yaml.
 */
export interface Evento {
  id: string;
  tipo: string;
  version: number;
  ocurridoEn: string;
  correlationId?: string;
  orgId: string;
  datos: Record<string, unknown>;
}

export interface Sentencia {
  sql: string;
  parametros: unknown[];
}

export function proyectar(evento: Evento): Sentencia[] {
  const d = evento.datos;
  switch (evento.tipo) {
    case 'pedido.confirmado': {
      const fecha = evento.ocurridoEn.slice(0, 10);
      const sentencias: Sentencia[] = [
        {
          sql: `INSERT INTO ventas_diarias (org_id, fecha, pedidos, total_centavos) VALUES ($1, $2, 1, $3)
                ON CONFLICT (org_id, fecha) DO UPDATE
                SET pedidos = ventas_diarias.pedidos + 1,
                    total_centavos = ventas_diarias.total_centavos + EXCLUDED.total_centavos`,
          parametros: [evento.orgId, fecha, d.totalCentavos],
        },
      ];
      if (d.metodoPago === 'credito') {
        sentencias.push({
          sql: `INSERT INTO cuentas_por_cobrar (org_id, pedido_id, tienda_id, tienda_nombre, saldo_centavos, vence)
                VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (org_id, pedido_id) DO NOTHING`,
          parametros: [evento.orgId, d.pedidoId, d.tiendaId, d.tiendaNombre, d.totalCentavos, d.vence],
        });
      }
      return sentencias;
    }
    case 'cobro.pago_registrado':
      return [
        {
          sql: `UPDATE cuentas_por_cobrar
                   SET saldo_centavos = greatest(saldo_centavos - $3, 0),
                       estado = CASE WHEN saldo_centavos - $3 <= 0 THEN 'pagada' ELSE estado END
                 WHERE org_id = $1 AND pedido_id = $2`,
          parametros: [evento.orgId, d.pedidoId, d.centavos],
        },
      ];
    case 'producto.stock_cambiado':
      return [
        {
          sql: `INSERT INTO stock_productos (org_id, producto_id, nombre, stock) VALUES ($1, $2, $3, $4)
                ON CONFLICT (org_id, producto_id) DO UPDATE SET stock = EXCLUDED.stock, nombre = EXCLUDED.nombre`,
          parametros: [evento.orgId, d.productoId, d.nombre, d.stock],
        },
      ];
    default:
      return []; // eventos que no cambian ningún reporte
  }
}
