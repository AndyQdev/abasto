import type { ItemDeCarrito, Producto } from '@abasto/comercio';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BotonAgregar } from './BotonAgregar';
import { HojaDelCarrito } from './HojaDelCarrito';

jest.mock('@expo/vector-icons', () => ({ Ionicons: ({ name }: { name: string }) => jest.requireActual('react').createElement('Text', null, `[${name}]`) }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('./api', () => ({ graphql: jest.fn() }));
const mockIrAlCarrito = jest.fn();
jest.mock('./navegar', () => ({ irAlCarrito: () => mockIrAlCarrito() }));

const mockEstado = {
  carrito: [] as ItemDeCarrito[],
  cambiarCarrito: jest.fn(),
  catalogo: { productos: [] as Producto[] },
  hojaCarrito: { visible: true, resaltado: null as string | null },
  cerrarCarrito: jest.fn(),
};
jest.mock('./estado', () => ({ useEstado: () => mockEstado }));

const METRICAS = { frame: { x: 0, y: 0, width: 412, height: 915 }, insets: { top: 24, left: 0, right: 0, bottom: 0 } };
const item = (productoId: string, nombre: string, cantidad: number): ItemDeCarrito => ({
  productoId,
  nombre,
  mayoristaId: 'abasto',
  mayoristaNombre: 'Abasto',
  presentacion: 'UNIDAD',
  cantidad,
  unidadesPorPresentacion: 1,
  precioUnitarioCentavos: 1000,
});
const producto = {
  id: 'AB-1',
  nombre: 'Arroz 1 kg',
  rubro: 'Granos y cereales',
  estado: 'ACTIVO',
  precioVisible: true,
  stock: 10,
  abastecimiento: 'BAJO_PEDIDO',
  mayorista: { id: 'abasto', nombre: 'Abasto', deLaCasa: true },
  escalas: [{ presentacion: 'UNIDAD', cantidad: 1, precioUnitario: { centavos: 1000, texto: 'Bs 10,00' } }],
} as unknown as Producto;

beforeEach(() => {
  jest.clearAllMocks();
  mockEstado.carrito = [];
  mockEstado.hojaCarrito = { visible: true, resaltado: null };
});

describe('el «+» de las tarjetas', () => {
  it('agrega y muestra el check; con el producto en el carrito muestra cuántos lleva', async () => {
    const alAgregar = jest.fn();
    const { rerender } = await render(<BotonAgregar producto={producto} alAgregar={alAgregar} />);
    await fireEvent.press(screen.getByRole('button', { name: /Agregar una unidad de Arroz 1 kg/ }));
    expect(alAgregar).toHaveBeenCalledWith(producto);
    expect(screen.getByText('[checkmark]')).toBeTruthy();
    mockEstado.carrito = [item('AB-1', 'Arroz 1 kg', 3)];
    await rerender(<BotonAgregar producto={producto} alAgregar={alAgregar} />);
    expect(screen.getByRole('button', { name: /llevas 3/ })).toBeTruthy();
  });
});

describe('la hoja del carrito', () => {
  const enPantalla = () => render(<SafeAreaProvider initialMetrics={METRICAS}>{<HojaDelCarrito />}</SafeAreaProvider>);

  it('lo recién agregado va primero y resaltado, con el total', async () => {
    mockEstado.carrito = [item('AB-1', 'Arroz 1 kg', 2), item('AB-2', 'Aceite 900 ml', 1)];
    mockEstado.hojaCarrito = { visible: true, resaltado: 'AB-2-UNIDAD' };
    await enPantalla();
    expect(screen.getByText('¡Agregado a tu carrito!')).toBeTruthy();
    const nombres = screen.getAllByText(/Arroz 1 kg|Aceite 900 ml/).map((n) => n.props.children);
    expect(nombres).toEqual(['Aceite 900 ml', 'Arroz 1 kg']);
    expect(screen.getByText('Bs 30,00')).toBeTruthy();
  });

  it('se suma, se resta y se quita sin salir del producto', async () => {
    mockEstado.carrito = [item('AB-1', 'Arroz 1 kg', 2), item('AB-2', 'Aceite 900 ml', 1)];
    await enPantalla();
    await fireEvent.press(screen.getByRole('button', { name: 'Uno menos de Arroz 1 kg' }));
    expect(mockEstado.cambiarCarrito).toHaveBeenLastCalledWith([expect.objectContaining({ productoId: 'AB-1', cantidad: 1 }), expect.objectContaining({ productoId: 'AB-2' })]);
    await fireEvent.press(screen.getByRole('button', { name: 'Quitar Aceite 900 ml' }));
    expect(mockEstado.cambiarCarrito).toHaveBeenLastCalledWith([expect.objectContaining({ productoId: 'AB-1', cantidad: 2 })]);
    await fireEvent.press(screen.getByRole('button', { name: 'Uno más de Aceite 900 ml' }));
    expect(mockEstado.cambiarCarrito).toHaveBeenLastCalledWith([expect.objectContaining({ productoId: 'AB-1' }), expect.objectContaining({ productoId: 'AB-2', cantidad: 2 })]);
  });

  it('«Ver carrito» cierra la hoja y lleva al carrito', async () => {
    mockEstado.carrito = [item('AB-1', 'Arroz 1 kg', 1)];
    await enPantalla();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver carrito' }));
    expect(mockEstado.cerrarCarrito).toHaveBeenCalled();
    expect(mockIrAlCarrito).toHaveBeenCalled();
  });
});
