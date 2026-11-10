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

/** Nombre de cada tienda por id; lo arma el servicio antes de proyectar (ver DirectorioDeTiendas). */
export type NombresDeTiendas = Record<string, string>;

/**
 * Días que tiene la tienda para pagar un pedido a crédito. pedido.confirmado no trae la fecha de vencimiento
 * (la línea de crédito vive en Cobros), así que se usa el plazo de la demo hasta que el contrato la incluya.
 */
export const PLAZO_CREDITO_DIAS = 15;

const ESTADO_POR_EVENTO: Record<string, string> = {
  'pedido.creado': 'PENDIENTE',
  'pedido.por_confirmar': 'POR_CONFIRMAR',
  'pedido.confirmado': 'CONFIRMADO',
  'pedido.rechazado': 'RECHAZADO',
  'pedido.en_preparacion': 'EN_PREPARACION',
  'pedido.despachado': 'DESPACHADO',
  'pedido.entregado': 'ENTREGADO',
};

/** Ids de tienda cuyos nombres necesita la proyección de este evento. */
export function tiendasQueNecesita(evento: Evento): string[] {
  const tiendaId = evento.datos.tiendaId;
  return evento.tipo in ESTADO_POR_EVENTO && typeof tiendaId === 'string' ? [tiendaId] : [];
}

export function proyectar(evento: Evento, tiendas: NombresDeTiendas = {}): Sentencia[] {
  const d = evento.datos;
  switch (evento.tipo) {
    case 'pedido.creado':
    case 'pedido.por_confirmar':
    case 'pedido.rechazado':
    case 'pedido.en_preparacion':
    case 'pedido.despachado':
    case 'pedido.entregado':
      return [estadoDelPedido(evento, tiendas)];
    case 'pedido.confirmado': {
      const fecha = fechaDe(evento);
      const sentencias: Sentencia[] = [
        estadoDelPedido(evento, tiendas),
        {
          sql: `INSERT INTO ventas_diarias (org_id, fecha, pedidos, total_centavos) VALUES ($1, $2, 1, $3)
                ON CONFLICT (org_id, fecha) DO UPDATE
                SET pedidos = ventas_diarias.pedidos + 1,
                    total_centavos = ventas_diarias.total_centavos + EXCLUDED.total_centavos`,
          parametros: [evento.orgId, fecha, d.totalCentavos],
        },
      ];
      sentencias.push(...ventasPorProducto(evento, fecha));
      if (d.metodoPago === 'credito') {
        sentencias.push({
          sql: `INSERT INTO cuentas_por_cobrar (org_id, pedido_id, tienda_id, tienda_nombre, saldo_centavos, vence)
                VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (org_id, pedido_id) DO NOTHING`,
          parametros: [
            evento.orgId,
            d.codigo ?? d.pedidoId,
            d.tiendaId,
            nombreDeTienda(d.tiendaId, tiendas),
            d.totalCentavos,
            typeof d.vence === 'string' ? d.vence : sumarDias(fecha, PLAZO_CREDITO_DIAS),
          ],
        });
      }
      return sentencias;
    }
    case 'cobro.pago_registrado':
      return [
        {
          // La cuenta se guarda con el código (A-1042); el pago puede traer solo el id del pedido
          sql: `UPDATE cuentas_por_cobrar
                   SET saldo_centavos = greatest(saldo_centavos - $4, 0),
                       estado = CASE WHEN saldo_centavos - $4 <= 0 THEN 'pagada' ELSE estado END
                 WHERE org_id = $1 AND pedido_id IN ($2, $3)`,
          parametros: [evento.orgId, d.pedidoId, d.codigo ?? d.pedidoId, d.centavos],
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

/**
 * Una fila por pedido. pedido.creado solo inserta: si llega tarde, no pisa un estado posterior.
 * Los demás eventos actualizan el estado (y el motivo, si es un rechazo), salvo que lo guardado sea más nuevo:
 * los eventos pueden llegar en otro orden del que ocurrieron, y manda la hora en que ocurrieron.
 */
function estadoDelPedido(evento: Evento, tiendas: NombresDeTiendas): Sentencia {
  const d = evento.datos;
  const alCrear = evento.tipo === 'pedido.creado';
  return {
    sql: `INSERT INTO pedidos (org_id, pedido_id, codigo, tienda_id, tienda_nombre, metodo_pago, total_centavos,
                               estado, motivo_rechazo, creado_en, actualizado_en)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
          ON CONFLICT (org_id, pedido_id) DO ${
            alCrear
              ? 'NOTHING'
              : `UPDATE SET estado = EXCLUDED.estado, motivo_rechazo = EXCLUDED.motivo_rechazo,
                            total_centavos = EXCLUDED.total_centavos, actualizado_en = EXCLUDED.actualizado_en
                 WHERE pedidos.actualizado_en <= EXCLUDED.actualizado_en`
          }`,
    parametros: [
      evento.orgId,
      d.pedidoId,
      d.codigo ?? d.pedidoId,
      d.tiendaId,
      nombreDeTienda(d.tiendaId, tiendas),
      d.metodoPago,
      d.totalCentavos,
      ESTADO_POR_EVENTO[evento.tipo],
      evento.tipo === 'pedido.rechazado' ? (d.motivo ?? 'Sin motivo') : null,
      evento.ocurridoEn,
    ],
  };
}

interface LineaVendida {
  productoId: string;
  unidades: number;
  subtotalCentavos: number;
}

/**
 * Cada línea del pedido confirmado suma a las ventas del producto ese día (migración 005). Los eventos de antes del
 * 01/11 no traen líneas: esos pedidos solo cuentan en ventas_diarias. El nombre se copia de stock_productos.
 */
function ventasPorProducto(evento: Evento, fecha: string): Sentencia[] {
  const lineas = Array.isArray(evento.datos.lineas) ? (evento.datos.lineas as LineaVendida[]) : [];
  return lineas
    .filter((l) => typeof l.productoId === 'string')
    .map((l) => ({
      sql: `INSERT INTO ventas_por_producto (org_id, fecha, producto_id, producto_nombre, unidades, total_centavos)
            VALUES ($1, $2, $3,
                    COALESCE((SELECT nombre FROM stock_productos WHERE org_id = $1 AND producto_id = $3), $3), $4, $5)
            ON CONFLICT (org_id, fecha, producto_id) DO UPDATE
            SET unidades = ventas_por_producto.unidades + EXCLUDED.unidades,
                total_centavos = ventas_por_producto.total_centavos + EXCLUDED.total_centavos`,
      parametros: [evento.orgId, fecha, l.productoId, Number(l.unidades) || 0, Number(l.subtotalCentavos) || 0],
    }));
}

function nombreDeTienda(tiendaId: unknown, tiendas: NombresDeTiendas): string {
  const id = String(tiendaId);
  return tiendas[id] ?? id;
}

/** Día local del evento: '2026-10-20T08:50:00-04:00' → '2026-10-20'. */
function fechaDe(evento: Evento): string {
  return evento.ocurridoEn.slice(0, 10);
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
