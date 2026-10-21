/**
 * Eventos que publica Cobros. El nombre y la forma de cada uno están en contracts/asyncapi.yaml:
 * cambiarlos es cambiar un contrato.
 */
export type EventoDeCobros =
  | {
      tipo: 'cobro.credito_autorizado';
      pedidoId: string;
      tiendaId: string;
      mayoristaId: string;
      centavos: number;
    }
  | {
      tipo: 'cobro.credito_liberado';
      pedidoId: string;
      tiendaId: string;
      mayoristaId: string;
      centavos: number;
    };
