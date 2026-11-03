import { CuentaPorCobrar } from '../dominio/cuenta-por-cobrar.js';
import { Dinero } from '../dominio/dinero.js';
import { CuentaNoExiste, MontoInvalido, PagoMayorQueElSaldo, SinPermiso } from '../dominio/errores.js';
import { LineaDeCredito } from '../dominio/linea-de-credito.js';
import { CuentasEnMemoria } from './cuenta-por-cobrar.en-memoria.js';
import { AbrirCuentaDePedido, ConsultarCuentas, RegistrarPago, type PedidoConfirmado } from './cuentas-por-cobrar.js';
import { LineaDeCreditoEnMemoria } from './linea-de-credito.en-memoria.js';

const CONFIRMADO = new Date('2026-11-01T14:00:00Z'); // 10:00 en Bolivia
const LOS_POZOS = { usuarioId: 'u-lp', orgId: 'lp' };

const pedido = (cambios: Partial<PedidoConfirmado> = {}): PedidoConfirmado => ({
  pedidoId: 'p1',
  codigo: 'A-1042',
  tiendaId: 'dr',
  mayoristaId: 'lp',
  metodoPago: 'credito',
  totalCentavos: 120_000,
  confirmadoEn: CONFIRMADO,
  ...cambios,
});

function preparar(ahora = new Date('2026-11-03T15:00:00Z')) {
  // Doña Rosa tiene crédito con Los Pozos a 15 días, y el pedido p1 ya le tomó Bs 1.200 del cupo (la saga)
  const lineas = new LineaDeCreditoEnMemoria([
    new LineaDeCredito({
      id: 'l1',
      tiendaId: 'dr',
      mayoristaId: 'lp',
      limite: Dinero.deBolivianos(4000),
      plazoDias: 15,
      reservas: new Map([['p1', Dinero.deCentavos(120_000)]]),
    }),
  ]);
  const cuentas = new CuentasEnMemoria(lineas);
  let n = 0;
  return {
    lineas,
    cuentas,
    abrir: new AbrirCuentaDePedido(cuentas, lineas, () => `c${++n}`),
    consultar: new ConsultarCuentas(cuentas),
    pagar: new RegistrarPago(cuentas, lineas, { ahora: () => ahora }),
  };
}

describe('CU-09 · la cuenta nace con el pedido confirmado', () => {
  it('un pedido a crédito vence con el plazo de la línea de la tienda', async () => {
    const { abrir } = preparar();
    const cuenta = await abrir.ejecutar(pedido());
    expect(cuenta?.origen).toBe('CREDITO');
    expect(cuenta?.venceEn?.toISOString()).toBe('2026-11-16T14:00:00.000Z');
    expect(cuenta?.saldo.texto()).toBe('Bs 1.200,00');
    expect(cuenta?.estado).toBe('PENDIENTE');
  });

  it('contra entrega se cobra al entregar (sin fecha de vencimiento); por QR ya está pagado y no abre cuenta', async () => {
    const { abrir } = preparar();
    expect((await abrir.ejecutar(pedido({ pedidoId: 'p2', metodoPago: 'contra_entrega' })))?.venceEn).toBeNull();
    expect(await abrir.ejecutar(pedido({ pedidoId: 'p3', metodoPago: 'qr' }))).toBeNull();
  });

  it('el mismo evento dos veces no abre dos cuentas', async () => {
    const { abrir, cuentas } = preparar();
    await abrir.ejecutar(pedido());
    expect(await abrir.ejecutar(pedido())).toBeNull();
    expect(cuentas.cuentas.size).toBe(1);
  });
});

describe('CU-09 · registrar un pago', () => {
  it('un pago parcial deja saldo y avisa a los reportes con cobro.pago_registrado', async () => {
    const { abrir, pagar, cuentas } = preparar();
    await abrir.ejecutar(pedido());
    const cuenta = await pagar.ejecutar({ pagoId: 'pg1', pedidoId: 'p1', centavos: 50_000, forma: 'EFECTIVO' }, LOS_POZOS);
    expect(cuenta.estado).toBe('PARCIAL');
    expect(cuenta.saldo.texto()).toBe('Bs 700,00');
    expect(cuentas.outbox).toEqual([
      {
        tipo: 'cobro.pago_registrado',
        pedidoId: 'p1',
        codigo: 'A-1042',
        tiendaId: 'dr',
        mayoristaId: 'lp',
        centavos: 50_000,
        forma: 'EFECTIVO',
        saldoCentavos: 70_000,
      },
    ]);
  });

  it('el mismo pago dos veces (doble toque o reenvío sin señal) se cuenta una vez', async () => {
    const { abrir, pagar, cuentas } = preparar();
    await abrir.ejecutar(pedido());
    const entrada = { pagoId: 'pg1', pedidoId: 'p1', centavos: 50_000, forma: 'EFECTIVO' as const };
    await pagar.ejecutar(entrada, LOS_POZOS);
    const cuenta = await pagar.ejecutar(entrada, LOS_POZOS);
    expect(cuenta.saldo.texto()).toBe('Bs 700,00');
    expect(cuentas.outbox).toHaveLength(1);
  });

  it('no se puede cobrar más de lo que debe', async () => {
    const { abrir, pagar } = preparar();
    await abrir.ejecutar(pedido());
    await expect(pagar.ejecutar({ pagoId: 'pg1', pedidoId: 'p1', centavos: 120_001, forma: 'QR' }, LOS_POZOS)).rejects.toThrow(
      PagoMayorQueElSaldo,
    );
    await expect(pagar.ejecutar({ pagoId: 'pg2', pedidoId: 'p1', centavos: 0, forma: 'QR' }, LOS_POZOS)).rejects.toThrow(MontoInvalido);
  });

  it('al saldar un crédito, la tienda recupera el cupo (sin publicar la compensación de la saga)', async () => {
    const { abrir, pagar, lineas } = preparar();
    await abrir.ejecutar(pedido());
    await pagar.ejecutar({ pagoId: 'pg1', pedidoId: 'p1', centavos: 20_000, forma: 'EFECTIVO' }, LOS_POZOS);
    expect((await lineas.buscar('dr', 'lp'))?.disponible.texto()).toBe('Bs 2.800,00');
    const cuenta = await pagar.ejecutar({ pagoId: 'pg2', pedidoId: 'p1', centavos: 100_000, forma: 'TRANSFERENCIA' }, LOS_POZOS);
    expect(cuenta.estado).toBe('PAGADA');
    const linea = await lineas.buscar('dr', 'lp');
    expect(linea?.disponible.texto()).toBe('Bs 4.000,00');
    expect(lineas.outbox.map((e) => e.tipo)).not.toContain('cobro.credito_liberado');
  });

  it('solo el mayorista que vendió registra pagos; una cuenta que no existe se dice', async () => {
    const { abrir, pagar } = preparar();
    await abrir.ejecutar(pedido());
    await expect(
      pagar.ejecutar({ pagoId: 'pg1', pedidoId: 'p1', centavos: 100, forma: 'EFECTIVO' }, { usuarioId: 'u-lr', orgId: 'lr' }),
    ).rejects.toThrow(SinPermiso);
    await expect(pagar.ejecutar({ pagoId: 'pg1', pedidoId: 'nada', centavos: 100, forma: 'EFECTIVO' }, LOS_POZOS)).rejects.toThrow(
      CuentaNoExiste,
    );
  });
});

describe('CU-09 · lo que le deben al mayorista', () => {
  it('suma lo por cobrar y lo vencido, y pone primero lo más atrasado', async () => {
    const hoy = new Date('2026-11-20T15:00:00Z');
    const { abrir, consultar, pagar } = preparar(hoy);
    await abrir.ejecutar(pedido()); // vence 16/11: 4 días de atraso
    await abrir.ejecutar(pedido({ pedidoId: 'p2', codigo: 'A-1050', tiendaId: 'mo', totalCentavos: 30_000, confirmadoEn: new Date('2026-11-18T14:00:00Z') }));
    await abrir.ejecutar(pedido({ pedidoId: 'p3', codigo: 'A-1051', metodoPago: 'contra_entrega', totalCentavos: 10_000 }));
    await abrir.ejecutar(pedido({ pedidoId: 'p4', codigo: 'A-1052', mayoristaId: 'lr' })); // de otro mayorista
    await pagar.ejecutar({ pagoId: 'pg1', pedidoId: 'p1', centavos: 20_000, forma: 'EFECTIVO' }, LOS_POZOS);

    const r = await consultar.delMayorista('lp', false, hoy);
    expect(r.cuentas.map((c) => c.codigo)).toEqual(['A-1042', 'A-1050', 'A-1051']);
    expect(r.cuentas[0].diasDeAtraso(hoy)).toBe(4);
    expect(r.porCobrar.texto()).toBe('Bs 1.400,00');
    expect(r.vencido.texto()).toBe('Bs 1.000,00');
    expect(r.tiendas).toBe(2);
  });

  it('una cuenta pagada no tiene atraso aunque haya pasado la fecha', () => {
    const cuenta = CuentaPorCobrar.abrir({
      id: 'c',
      pedidoId: 'p',
      codigo: 'A-1',
      tiendaId: 'dr',
      mayoristaId: 'lp',
      origen: 'CREDITO',
      monto: Dinero.deCentavos(100),
      abiertaEn: CONFIRMADO,
      plazoDias: 15,
    });
    const tarde = new Date('2026-12-30T12:00:00Z');
    expect(cuenta.diasDeAtraso(tarde)).toBeGreaterThan(0);
    cuenta.registrarPago({ id: 'x', monto: Dinero.deCentavos(100), forma: 'EFECTIVO', registradoEn: tarde, registradoPor: 'u' });
    expect(cuenta.diasDeAtraso(tarde)).toBe(0);
  });
});
