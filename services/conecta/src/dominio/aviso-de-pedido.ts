/**
 * Lo que la app de la tienda necesita saber en tiempo real: «tu pedido cambió, vuelve a mirarlo».
 * Sale de los eventos de abasto.eventos (sobre de contracts/asyncapi.yaml). Solo cuentan pedido.* y cobro.*, y solo
 * los que traen la tienda (`datos.tiendaId`): Pedidos y Cobros la ponen en todos. El aviso no lleva montos ni líneas;
 * la app vuelve a pedir el pedido por GraphQL con su sesión, así nada sensible viaja por el canal.
 */
export interface SobreDeEvento {
  id?: string;
  tipo: string;
  ocurridoEn?: string;
  correlationId?: string;
  orgId?: string;
  datos?: Record<string, unknown>;
}

export interface AvisoDePedido {
  tipo: string;
  pedidoId: string;
  codigo: string | null;
  ocurridoEn: string | null;
}

const AVISAN = /^(pedido|cobro)\.[a-z_]+$/;

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);

/** La tienda a la que le toca el aviso, o null si el evento no es para ninguna tienda */
export function tiendaDelEvento(sobre: SobreDeEvento): string | null {
  if (!AVISAN.test(sobre.tipo)) return null;
  return texto(sobre.datos?.tiendaId);
}

export function avisoDe(sobre: SobreDeEvento): AvisoDePedido | null {
  if (!tiendaDelEvento(sobre)) return null;
  const pedidoId = texto(sobre.datos?.pedidoId) ?? texto(sobre.correlationId);
  if (!pedidoId) return null;
  return { tipo: sobre.tipo, pedidoId, codigo: texto(sobre.datos?.codigo), ocurridoEn: texto(sobre.ocurridoEn) };
}
