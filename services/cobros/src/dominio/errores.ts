/** Errores del dominio de Cobros. La capa de interfaz los traduce a errores de GraphQL. */
export class ErrorDeDominio extends Error {
  constructor(
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = new.target.name;
  }
}

export class MontoInvalido extends ErrorDeDominio {
  constructor(mensaje: string) {
    super('MONTO_INVALIDO', mensaje);
  }
}

export class LimiteDeCreditoExcedido extends ErrorDeDominio {
  constructor(disponible: string, pedido: string) {
    super(
      'LIMITE_DE_CREDITO_EXCEDIDO',
      `El pedido de ${pedido} supera el crédito disponible de ${disponible}`,
    );
  }
}

export class LineaDeCreditoNoExiste extends ErrorDeDominio {
  constructor(tiendaId: string, mayoristaId: string) {
    super(
      'LINEA_DE_CREDITO_NO_EXISTE',
      `La tienda ${tiendaId} no tiene crédito con el mayorista ${mayoristaId}`,
    );
  }
}
