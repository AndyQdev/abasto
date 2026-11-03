import { CuentaPorCobrar, type FormaDePago } from '../dominio/cuenta-por-cobrar.js';
import type { CuentaPorCobrarRepositorio } from '../dominio/cuenta-por-cobrar.repositorio.js';
import { Dinero } from '../dominio/dinero.js';
import { CuentaNoExiste, SinPermiso } from '../dominio/errores.js';
import type { LineaDeCreditoRepositorio } from '../dominio/linea-de-credito.repositorio.js';

/** Lo que trae pedido.confirmado (DatosPedido de contracts/asyncapi.yaml). */
export interface PedidoConfirmado {
  pedidoId: string;
  codigo: string;
  tiendaId: string;
  mayoristaId: string;
  metodoPago: string;
  totalCentavos: number;
  confirmadoEn: Date;
}

/** Si la tienda no tiene línea (por ejemplo, un dato viejo), el crédito vence a los 15 días, como el plazo corto. */
const PLAZO_POR_DEFECTO = 15;

/**
 * CU-09, paso 0: cuando el mayorista confirma un pedido a crédito o contra entrega, nace la cuenta por cobrar.
 * Los pedidos por QR ya están pagados. Repetir el evento no abre otra cuenta.
 */
export class AbrirCuentaDePedido {
  constructor(
    private readonly cuentas: CuentaPorCobrarRepositorio,
    private readonly lineas: LineaDeCreditoRepositorio,
    private readonly generarId: () => string,
  ) {}

  async ejecutar(pedido: PedidoConfirmado): Promise<CuentaPorCobrar | null> {
    const origen = pedido.metodoPago === 'credito' ? 'CREDITO' : pedido.metodoPago === 'contra_entrega' ? 'CONTRA_ENTREGA' : null;
    if (!origen || pedido.totalCentavos <= 0) return null;
    if (await this.cuentas.porPedido(pedido.pedidoId)) return null;

    const linea = origen === 'CREDITO' ? await this.lineas.buscar(pedido.tiendaId, pedido.mayoristaId) : null;
    const cuenta = CuentaPorCobrar.abrir({
      id: this.generarId(),
      pedidoId: pedido.pedidoId,
      codigo: pedido.codigo,
      tiendaId: pedido.tiendaId,
      mayoristaId: pedido.mayoristaId,
      origen,
      monto: Dinero.deCentavos(pedido.totalCentavos),
      abiertaEn: pedido.confirmadoEn,
      plazoDias: origen === 'CREDITO' ? (linea?.plazoDias ?? PLAZO_POR_DEFECTO) : null,
    });
    await this.cuentas.guardar(cuenta);
    return cuenta;
  }
}

export interface ResumenDeCuentas {
  cuentas: CuentaPorCobrar[];
  porCobrar: Dinero;
  vencido: Dinero;
  /** Cuántas tiendas deben algo. */
  tiendas: number;
}

/** CU-09: lo que le deben al mayorista que pregunta. Primero lo más atrasado; las contra entrega, al final de las pendientes. */
export class ConsultarCuentas {
  constructor(private readonly cuentas: CuentaPorCobrarRepositorio) {}

  async delMayorista(mayoristaId: string, conPagadas: boolean, hoy: Date): Promise<ResumenDeCuentas> {
    const todas = await this.cuentas.delMayorista(mayoristaId, conPagadas);
    const abiertas = todas.filter((c) => c.estado !== 'PAGADA');
    const orden = (c: CuentaPorCobrar) => [
      c.estado === 'PAGADA' ? 1 : 0,
      -c.diasDeAtraso(hoy),
      c.venceEn?.getTime() ?? Number.MAX_SAFE_INTEGER,
      c.abiertaEn.getTime(),
    ];
    const cuentas = [...todas].sort((a, b) => {
      const [x, y] = [orden(a), orden(b)];
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
      return 0;
    });
    return {
      cuentas,
      porCobrar: abiertas.reduce((t, c) => t.sumar(c.saldo), Dinero.cero()),
      vencido: abiertas.filter((c) => c.diasDeAtraso(hoy) > 0).reduce((t, c) => t.sumar(c.saldo), Dinero.cero()),
      tiendas: new Set(abiertas.map((c) => c.tiendaId)).size,
    };
  }
}

export interface RegistrarPagoEntrada {
  pagoId: string;
  pedidoId: string;
  centavos: number;
  forma: FormaDePago;
  nota?: string | null;
}

/**
 * CU-09: el mayorista anota lo que la tienda le pagó (efectivo, transferencia o QR), todo o una parte.
 * Si la cuenta a crédito queda saldada, la tienda recupera ese cupo. Solo lo puede hacer el mayorista dueño de la cuenta.
 */
export class RegistrarPago {
  constructor(
    private readonly cuentas: CuentaPorCobrarRepositorio,
    private readonly lineas: LineaDeCreditoRepositorio,
    private readonly reloj: { ahora(): Date },
  ) {}

  async ejecutar(entrada: RegistrarPagoEntrada, quien: { usuarioId: string; orgId: string }): Promise<CuentaPorCobrar> {
    const cuenta = await this.cuentas.porPedido(entrada.pedidoId);
    if (!cuenta) throw new CuentaNoExiste(entrada.pedidoId);
    if (cuenta.mayoristaId !== quien.orgId) throw new SinPermiso('Solo el mayorista que vendió puede registrar pagos de esta cuenta');

    const estabaSaldada = cuenta.estado === 'PAGADA';
    cuenta.registrarPago({
      id: entrada.pagoId,
      monto: Dinero.deCentavos(entrada.centavos),
      forma: entrada.forma,
      registradoEn: this.reloj.ahora(),
      registradoPor: quien.usuarioId,
      nota: entrada.nota?.trim() || undefined,
    });

    let lineaSaldada;
    const quedoSaldada = !cuenta.saldo.esPositivo();
    if (!estabaSaldada && quedoSaldada && cuenta.origen === 'CREDITO') {
      const linea = await this.lineas.buscar(cuenta.tiendaId, cuenta.mayoristaId);
      if (linea?.reservaDe(cuenta.pedidoId)) {
        linea.saldar(cuenta.pedidoId);
        lineaSaldada = linea;
      }
    }
    await this.cuentas.guardar(cuenta, lineaSaldada);
    return cuenta;
  }
}
