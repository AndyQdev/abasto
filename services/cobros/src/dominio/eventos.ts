/**
 * Eventos que publica Cobros. El nombre y la forma de cada uno están en contracts/asyncapi.yaml:
 * cambiarlos es cambiar un contrato.
 */
type Referencia = {
  pedidoId: string;
  tiendaId: string;
  mayoristaId: string;
};

export type EventoDeCobros =
  | (Referencia & { tipo: 'cobro.credito_autorizado'; centavos: number })
  | (Referencia & { tipo: 'cobro.credito_liberado'; centavos: number })
  /** El QR ya existe y espera el pago: la app de la tienda lo muestra sin preguntar a cada rato (01/11) */
  | (Referencia & { tipo: 'cobro.qr_generado'; centavos: number; venceEn: string })
  | (Referencia & { tipo: 'cobro.qr_pagado'; centavos: number })
  | (Referencia & { tipo: 'cobro.qr_devuelto'; centavos: number })
  | (Referencia & { tipo: 'cobro.rechazado'; motivo: string });
