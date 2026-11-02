import type { Pedido } from '@abasto/comercio';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { LineaDeTiempo, PagoExitoso, ProgresoChico } from './linea-de-tiempo';

jest.mock('@expo/vector-icons', () => ({ Ionicons: ({ name }: { name: string }) => jest.requireActual('react').createElement('Text', null, `[${name}]`) }));
jest.mock('react-native-qrcode-svg', () => ({ __esModule: true, default: ({ value }: { value: string }) => jest.requireActual('react').createElement('Text', null, `QR:${value}`) }));

const base: Pedido = {
  id: 'p1',
  codigo: 'A-1300',
  estado: 'PENDIENTE',
  metodoPago: 'QR',
  creadoEn: '2026-11-02T10:00:00Z',
  motivoRechazo: null,
  total: { centavos: 23280, texto: 'Bs 232,80' },
  mayorista: { id: 'abasto', nombre: 'Abasto' },
  lineas: [],
  cobro: null,
};
const conQr = (estado: 'PENDIENTE' | 'PAGADO'): Pedido => ({
  ...base,
  estado: estado === 'PAGADO' ? 'POR_CONFIRMAR' : 'PENDIENTE',
  cobro: { estado, codigo: 'ABASTO-QR|p1', venceEn: new Date(Date.now() + 15 * 60000).toISOString(), monto: { texto: 'Bs 232,80' } },
});

describe('la línea de tiempo del seguimiento (02/11)', () => {
  it('si falta pagar, el QR sale dentro del paso del pago y se paga ahí mismo', async () => {
    const alPagar = jest.fn();
    await render(<LineaDeTiempo pedido={conQr('PENDIENTE')} pagando={false} alPagar={alPagar} />);
    expect(screen.getByText('QR:ABASTO-QR|p1')).toBeTruthy();
    expect(screen.getByLabelText('Pago por QR, en curso')).toBeTruthy();
    expect(screen.getByText(/Vence en 1[45]:/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Simular pago (demo)' }));
    expect(alPagar).toHaveBeenCalled();
  });

  it('pagado: el QR desaparece y lo que late es la confirmación del vendedor', async () => {
    await render(<LineaDeTiempo pedido={conQr('PAGADO')} pagando={false} alPagar={jest.fn()} />);
    expect(screen.queryByText(/^QR:/)).toBeNull();
    expect(screen.getByLabelText('Pago por QR, hecho')).toBeTruthy();
    expect(screen.getByLabelText('Confirmación del mayorista, en curso')).toBeTruthy();
  });

  it('recién creado, sin QR todavía: late la reserva del stock', async () => {
    await render(<LineaDeTiempo pedido={{ ...base, total: { centavos: 0, texto: 'Bs 0,00' } }} pagando={false} alPagar={jest.fn()} />);
    expect(screen.getByLabelText('Reservando el stock, en curso')).toBeTruthy();
  });

  it('la barrita de Compras dice en qué paso va', async () => {
    await render(<ProgresoChico pedido={{ ...base, estado: 'DESPACHADO', cobro: conQr('PAGADO').cobro }} />);
    expect(screen.getByLabelText('Paso 7 de 7')).toBeTruthy();
  });

  it('el festejo del pago cubre la pantalla y se cierra solo', async () => {
    jest.useFakeTimers();
    const alCerrar = jest.fn();
    await render(<PagoExitoso visible total="Bs 232,80" alCerrar={alCerrar} />);
    expect(screen.getByText('¡Pago recibido!')).toBeTruthy();
    expect(screen.getByText(/Pagaste Bs 232,80/)).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(alCerrar).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
