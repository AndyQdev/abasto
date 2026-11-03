import type { Pedido } from '@abasto/comercio';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { entregasNuevas } from './entregas';
import { Escena, escenaDelPedido } from './escenas';
import { CompraEntregada } from './festejos';
import { LineaDeTiempo } from './linea-de-tiempo';

jest.mock('@expo/vector-icons', () => ({ Ionicons: ({ name }: { name: string }) => jest.requireActual('react').createElement('Text', null, `[${name}]`) }));
jest.mock('react-native-qrcode-svg', () => ({ __esModule: true, default: () => null }));
jest.mock('./api', () => ({ graphql: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const conArea = (x: ReactElement) => <SafeAreaProvider initialMetrics={METRICAS}>{x}</SafeAreaProvider>;

const base: Pedido = {
  id: 'p1',
  codigo: 'A-1400',
  estado: 'PENDIENTE',
  metodoPago: 'QR',
  creadoEn: '2026-11-02T10:00:00Z',
  motivoRechazo: null,
  total: { centavos: 23280, texto: 'Bs 232,80' },
  mayorista: { id: 'abasto', nombre: 'Abasto' },
  lineas: [],
  cobro: null,
};
const pagado = { estado: 'PAGADO' as const, codigo: 'QR', venceEn: '2026-11-02T11:00:00Z', monto: { texto: 'Bs 232,80' } };

describe('las escenas de cada estado (02/11)', () => {
  it('cada estado tiene su escena; rechazado no tiene', () => {
    expect(escenaDelPedido({ ...base, cobro: { ...pagado, estado: 'PENDIENTE' } })).toBe('pagar');
    expect(escenaDelPedido({ ...base, estado: 'POR_CONFIRMAR', cobro: pagado })).toBe('revisa');
    expect(escenaDelPedido({ ...base, estado: 'EN_PREPARACION', cobro: pagado })).toBe('prepara');
    expect(escenaDelPedido({ ...base, estado: 'DESPACHADO', cobro: pagado })).toBe('camino');
    expect(escenaDelPedido({ ...base, estado: 'ENTREGADO', cobro: pagado })).toBe('entregado');
    expect(escenaDelPedido({ ...base, estado: 'RECHAZADO' })).toBeNull();
  });

  it('la escena dice qué muestra (para quien usa lector de pantalla)', async () => {
    await render(<Escena clave="camino" alto={120} />);
    expect(screen.getByLabelText('El repartidor va en su moto con tu pedido')).toBeTruthy();
  });
});

describe('la línea de tiempo compacta del seguimiento', () => {
  it('junta los pasos hechos en un renglón y se abre al tocarlo', async () => {
    await render(<LineaDeTiempo pedido={{ ...base, estado: 'EN_PREPARACION', cobro: pagado }} pagando={false} alPagar={jest.fn()} compacta />);
    const juntos = screen.getByRole('button', { name: /pasos listos/ });
    expect(screen.queryByLabelText('Pedido enviado, hecho')).toBeNull();
    expect(screen.getByLabelText('En preparación, en curso')).toBeTruthy();
    await fireEvent.press(juntos);
    expect(screen.getByLabelText('Pedido enviado, hecho')).toBeTruthy();
  });
});

describe('qué entregas se festejan', () => {
  const compras = [
    { id: 'a', estado: 'ENTREGADO' as const, creadoEn: '2026-11-01T10:00:00Z' },
    { id: 'b', estado: 'ENTREGADO' as const, creadoEn: '2026-11-02T10:00:00Z' },
    { id: 'c', estado: 'DESPACHADO' as const, creadoEn: '2026-11-02T11:00:00Z' },
  ];
  it('la primera vez en el teléfono no festeja lo de antes', () => {
    expect(entregasNuevas(compras, null)).toEqual({ festejar: [], vistas: ['a', 'b'] });
  });
  it('festeja solo lo nuevo, lo más reciente primero, y no lo repite', () => {
    const r = entregasNuevas([...compras, { id: 'd', estado: 'ENTREGADO', creadoEn: '2026-11-02T12:00:00Z' }], ['a']);
    expect(r.festejar).toEqual(['d', 'b']);
    expect(entregasNuevas(compras, r.vistas).festejar).toEqual([]);
  });
});

describe('el festejo de la entrega', () => {
  it('da las gracias, carga los productos al inventario uno por uno y lleva solo a «Mi negocio»', async () => {
    jest.useFakeTimers();
    const alIr = jest.fn();
    const productos = [
      { id: 'AB-1', nombre: 'Arroz', rubro: 'abarrotes' },
      { id: 'AB-2', nombre: 'Aceite', rubro: 'aceites' },
    ];
    await render(conArea(<CompraEntregada visible codigo="A-1400" productos={productos} tipo="tienda" alIr={alIr} alCerrar={jest.fn()} />));
    expect(screen.getByText('¡Llegó tu compra!')).toBeTruthy();
    expect(screen.getByText(/Muchas gracias por comprar en Abasto/)).toBeTruthy();
    expect(screen.getByText('Cargando a tu inventario…')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    expect(screen.getByText('+2 productos en tu inventario')).toBeTruthy();
    expect(alIr).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(alIr).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('en la casa, va a la despensa', async () => {
    await render(conArea(<CompraEntregada visible codigo="A-1" productos={[]} tipo="hogar" alIr={jest.fn()} alCerrar={jest.fn()} />));
    expect(screen.getByText('Cargando a tu despensa…')).toBeTruthy();
    expect(screen.getByText('Ver mi despensa')).toBeTruthy();
  });
});
