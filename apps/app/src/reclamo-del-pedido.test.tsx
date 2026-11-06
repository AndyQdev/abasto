import type { Pedido, ReclamoDePedido } from '@abasto/comercio';
import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { graphql } from './api';
import { ReclamoDelPedido } from './ReclamoDelPedido';

jest.mock('./api', () => ({ graphql: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: ({ name }: { name: string }) => jest.requireActual('react').createElement('Text', null, `[${name}]`) }));

configure({ asyncUtilTimeout: 5000 });
jest.setTimeout(30000);

const METRICAS = { frame: { x: 0, y: 0, width: 412, height: 915 }, insets: { top: 24, left: 0, right: 0, bottom: 0 } };
const enPantalla = (ui: ReactElement) => render(<SafeAreaProvider initialMetrics={METRICAS}>{ui}</SafeAreaProvider>);
const pedir = graphql as jest.Mock;

const pedido = (parcial: Partial<Pedido> = {}): Pedido =>
  ({ id: 'p1', codigo: 'A-1', estado: 'ENTREGADO', metodoPago: 'CONTRA_ENTREGA', creadoEn: '', motivoRechazo: null, total: { centavos: 100, texto: 'Bs 1,00' }, reclamo: null, ...parcial }) as Pedido;
const reclamo = (parcial: Partial<ReclamoDePedido>): ReclamoDePedido => ({ id: 'r1', motivo: 'DANADO', detalle: null, estado: 'ABIERTO', respuesta: null, devuelto: null, forma: null, ...parcial });

beforeEach(() => pedir.mockReset());

describe('CU-16 · Tengo un problema con este pedido', () => {
  it('manda el motivo y el detalle, y avisa el reclamo nuevo', async () => {
    const nuevo = reclamo({ detalle: 'Faltó una caja', motivo: 'INCOMPLETO' });
    pedir.mockResolvedValue({ abrirReclamo: nuevo });
    const alCambiar = jest.fn();
    await enPantalla(<ReclamoDelPedido pedido={pedido()} alCambiar={alCambiar} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Tengo un problema con este pedido' }));
    // Sin elegir qué pasó no se puede enviar
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('radio', { name: 'Llegó incompleto' }));
    await fireEvent.changeText(screen.getByLabelText('Cuéntanos qué pasó'), '  Faltó una caja ');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(alCambiar).toHaveBeenCalledWith(nuevo));
    expect(pedir.mock.calls[0]?.[1]).toEqual({ entrada: { pedidoId: 'p1', motivo: 'INCOMPLETO', detalle: 'Faltó una caja' } });
  });

  it('«Otro» pide contar qué pasó', async () => {
    await enPantalla(<ReclamoDelPedido pedido={pedido()} alCambiar={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Tengo un problema con este pedido' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Otro problema' }));
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Cuéntanos qué pasó'), 'Vino otra marca');
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled();
  });

  it('sin señal lo dice y no cierra la hoja', async () => {
    pedir.mockRejectedValue(new Error('Network request failed'));
    const alCambiar = jest.fn();
    await enPantalla(<ReclamoDelPedido pedido={pedido()} alCambiar={alCambiar} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Tengo un problema con este pedido' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'No llegó' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText(/Necesitas señal/);
    expect(alCambiar).not.toHaveBeenCalled();
  });

  it('un pedido que se está procesando no ofrece reclamar', async () => {
    await enPantalla(<ReclamoDelPedido pedido={pedido({ estado: 'PENDIENTE' })} alCambiar={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Tengo un problema con este pedido' })).toBeNull();
  });

  it('muestra en qué va y lo que se devolvió, y ya no ofrece otro', async () => {
    const vista = await enPantalla(<ReclamoDelPedido pedido={pedido({ reclamo: reclamo({}) })} alCambiar={jest.fn()} />);
    expect(screen.getByText('Estamos revisando tu reclamo')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tengo un problema con este pedido' })).toBeNull();

    await vista.rerender(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <ReclamoDelPedido pedido={pedido({ reclamo: reclamo({ estado: 'APROBADO', respuesta: 'Disculpa las molestias', devuelto: { centavos: 5000, texto: 'Bs 50,00' }, forma: 'TRANSFERENCIA' }) })} alCambiar={jest.fn()} />
      </SafeAreaProvider>,
    );
    expect(screen.getByText('Te dimos la razón')).toBeTruthy();
    expect(screen.getByText('Te devolvimos Bs 50,00 por transferencia.')).toBeTruthy();
    expect(screen.getByText('Disculpa las molestias')).toBeTruthy();
  });
});
