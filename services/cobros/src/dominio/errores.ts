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

export class QrNoSePuedePagar extends ErrorDeDominio {
  constructor(mensaje: string) {
    super('QR_NO_SE_PUEDE_PAGAR', mensaje);
  }
}

export class CobroNoExiste extends ErrorDeDominio {
  constructor(pedidoId: string) {
    super('COBRO_NO_EXISTE', `El pedido ${pedidoId} no tiene un cobro por QR`);
  }
}

export class PagoMayorQueElSaldo extends ErrorDeDominio {
  constructor(codigo: string, saldo: string, pago: string) {
    super('PAGO_MAYOR_QUE_EL_SALDO', `El pedido ${codigo} debe ${saldo}: no se puede registrar un pago de ${pago}`);
  }
}

export class CuentaNoExiste extends ErrorDeDominio {
  constructor(pedidoId: string) {
    super('CUENTA_NO_EXISTE', `El pedido ${pedidoId} no tiene una cuenta por cobrar`);
  }
}

export class LimiteMenorQueLoUsado extends ErrorDeDominio {
  constructor(usado: string) {
    super('LIMITE_MENOR_QUE_LO_USADO', `La tienda ya usó ${usado} de su crédito: el límite no puede ser menor`);
  }
}

export class PlazoInvalido extends ErrorDeDominio {
  constructor() {
    super('PLAZO_INVALIDO', 'El plazo del crédito es de 15 o 30 días');
  }
}

export class SinPermiso extends ErrorDeDominio {
  constructor(mensaje: string) {
    super('SIN_PERMISO', mensaje);
  }
}
