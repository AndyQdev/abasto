import { MontoInvalido } from './errores.js';

const formato = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Objeto de valor: un monto en bolivianos.
 * Se guarda en centavos enteros para que 0,1 + 0,2 nunca dé 0,30000000004.
 */
export class Dinero {
  readonly moneda = 'BOB' as const;

  private constructor(readonly centavos: number) {
    if (!Number.isSafeInteger(centavos)) {
      throw new MontoInvalido(`El monto debe ser un número entero de centavos: ${centavos}`);
    }
  }

  static deCentavos(centavos: number): Dinero {
    return new Dinero(centavos);
  }

  static deBolivianos(bolivianos: number): Dinero {
    return new Dinero(Math.round(bolivianos * 100));
  }

  static cero(): Dinero {
    return new Dinero(0);
  }

  sumar(otro: Dinero): Dinero {
    return new Dinero(this.centavos + otro.centavos);
  }

  restar(otro: Dinero): Dinero {
    return new Dinero(this.centavos - otro.centavos);
  }

  esMayorQue(otro: Dinero): boolean {
    return this.centavos > otro.centavos;
  }

  esPositivo(): boolean {
    return this.centavos > 0;
  }

  igualA(otro: Dinero): boolean {
    return this.centavos === otro.centavos;
  }

  /** «Bs 1.728,00», como se muestra en todas las pantallas de Abasto. */
  texto(): string {
    return `Bs ${formato.format(this.centavos / 100)}`;
  }
}
