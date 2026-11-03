import { Dinero } from './dinero.js';
import { MontoInvalido, PagoMayorQueElSaldo } from './errores.js';
import type { EventoDeCobros } from './eventos.js';

/** De dónde sale la deuda: un pedido a crédito (vence según el plazo de la línea) o uno contra entrega (se cobra al entregar). */
export type OrigenDeCuenta = 'CREDITO' | 'CONTRA_ENTREGA';
export type FormaDePago = 'EFECTIVO' | 'TRANSFERENCIA' | 'QR';
export type EstadoDeCuenta = 'PENDIENTE' | 'PARCIAL' | 'PAGADA';

export interface Pago {
  /** Lo genera quien registra (el Panel): repetir el mismo pago no lo cobra dos veces, también si se reenvía sin señal. */
  id: string;
  monto: Dinero;
  forma: FormaDePago;
  registradoEn: Date;
  /** Quién lo anotó (id de usuario de Keycloak). */
  registradoPor: string;
  nota?: string;
}

export interface DatosCuentaPorCobrar {
  id: string;
  pedidoId: string;
  /** El código que ve la gente (A-1042). */
  codigo: string;
  tiendaId: string;
  mayoristaId: string;
  origen: OrigenDeCuenta;
  monto: Dinero;
  abiertaEn: Date;
  /** Null en contra entrega: vence cuando se entrega. */
  venceEn: Date | null;
  pagos: Pago[];
}

const DIA_MS = 86_400_000;

/**
 * Agregado: lo que una tienda le debe a un mayorista por un pedido (CU-09).
 * Regla principal: lo pagado nunca pasa el monto, y un pago repetido (mismo id) no se cuenta dos veces.
 */
export class CuentaPorCobrar {
  private readonly pagos: Pago[];
  private eventos: EventoDeCobros[] = [];

  constructor(private readonly datos: DatosCuentaPorCobrar) {
    this.pagos = [...datos.pagos];
  }

  /** Abre la cuenta de un pedido. El vencimiento de un crédito es el día de la confirmación más el plazo de la línea. */
  static abrir(datos: Omit<DatosCuentaPorCobrar, 'pagos' | 'venceEn'> & { plazoDias: number | null }): CuentaPorCobrar {
    if (!datos.monto.esPositivo()) throw new MontoInvalido('La cuenta tiene que ser por un monto mayor a cero');
    const { plazoDias, ...resto } = datos;
    const venceEn = datos.origen === 'CREDITO' && plazoDias ? new Date(datos.abiertaEn.getTime() + plazoDias * DIA_MS) : null;
    return new CuentaPorCobrar({ ...resto, venceEn, pagos: [] });
  }

  get id() {
    return this.datos.id;
  }
  get pedidoId() {
    return this.datos.pedidoId;
  }
  get codigo() {
    return this.datos.codigo;
  }
  get tiendaId() {
    return this.datos.tiendaId;
  }
  get mayoristaId() {
    return this.datos.mayoristaId;
  }
  get origen() {
    return this.datos.origen;
  }
  get monto() {
    return this.datos.monto;
  }
  get abiertaEn() {
    return this.datos.abiertaEn;
  }
  get venceEn() {
    return this.datos.venceEn;
  }

  listaDePagos(): Pago[] {
    return [...this.pagos].sort((a, b) => a.registradoEn.getTime() - b.registradoEn.getTime());
  }

  get pagado(): Dinero {
    return this.pagos.reduce((total, p) => total.sumar(p.monto), Dinero.cero());
  }

  get saldo(): Dinero {
    return this.monto.restar(this.pagado);
  }

  get estado(): EstadoDeCuenta {
    if (!this.saldo.esPositivo()) return 'PAGADA';
    return this.pagos.length ? 'PARCIAL' : 'PENDIENTE';
  }

  /** Días que lleva vencida (0 si no venció, si ya está pagada o si es contra entrega). Se cuentan días enteros. */
  diasDeAtraso(hoy: Date): number {
    if (!this.venceEn || this.estado === 'PAGADA') return 0;
    return Math.max(0, Math.floor((inicioDelDia(hoy) - inicioDelDia(this.venceEn)) / DIA_MS));
  }

  registrarPago(pago: Pago): void {
    const repetido = this.pagos.find((p) => p.id === pago.id);
    if (repetido) {
      if (repetido.monto.igualA(pago.monto)) return; // el mismo pago otra vez (doble toque o reenvío sin señal)
      throw new MontoInvalido(`El pago ${pago.id} ya se registró por ${repetido.monto.texto()}`);
    }
    if (!pago.monto.esPositivo()) throw new MontoInvalido('El pago tiene que ser mayor a cero');
    if (pago.monto.esMayorQue(this.saldo)) throw new PagoMayorQueElSaldo(this.codigo, this.saldo.texto(), pago.monto.texto());

    this.pagos.push(pago);
    this.eventos.push({
      tipo: 'cobro.pago_registrado',
      pedidoId: this.pedidoId,
      codigo: this.codigo,
      tiendaId: this.tiendaId,
      mayoristaId: this.mayoristaId,
      centavos: pago.monto.centavos,
      forma: pago.forma,
      saldoCentavos: this.saldo.centavos,
    });
  }

  /** Entrega los eventos nuevos una sola vez, para guardarlos en el outbox. */
  sacarEventos(): EventoDeCobros[] {
    const pendientes = this.eventos;
    this.eventos = [];
    return pendientes;
  }
}

/** Bolivia no tiene horario de verano: el día empieza a las 00:00 de UTC−4. */
function inicioDelDia(fecha: Date): number {
  const boliviana = fecha.getTime() - 4 * 3_600_000;
  return boliviana - (((boliviana % DIA_MS) + DIA_MS) % DIA_MS);
}
