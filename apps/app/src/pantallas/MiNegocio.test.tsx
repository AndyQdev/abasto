import {
  AlmacenEnMemoria,
  comprasQueEntran,
  existencias,
  inventarioDelNegocio,
  MEDIDAS_A_MANO,
  type DatosDeNegocio,
  type NegocioElegido,
  type PedidoComprado,
} from '@abasto/comercio';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProveedorDeInventario, useInventario } from '../inventario';
import { HojaDeArticulo, HojaParaAgregar, VistaDeInventario, type PropsDeVista } from './MiNegocio';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../api', () => ({ graphql: jest.fn() }));
// Los íconos cargan fuentes nativas: en la prueba basta con su nombre
jest.mock('@expo/vector-icons', () => ({ Ionicons: ({ name }: { name: string }) => jest.requireActual('react').createElement('Text', null, `[${name}]`) }));
jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useIsFocused: () => true }));
jest.mock('../almacen-negocio', () => ({ almacenDeNegocio: () => new (jest.requireActual('@abasto/comercio').AlmacenEnMemoria)() }));

const AHORA = '2026-11-01T12:00:00.000Z';
const METRICAS = { frame: { x: 0, y: 0, width: 412, height: 915 }, insets: { top: 24, left: 0, right: 0, bottom: 0 } };
const enPantalla = async (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={METRICAS}>{ui}</SafeAreaProvider>);

const entregado: PedidoComprado = {
  id: 'p-1',
  codigo: 'A-0001',
  estado: 'ENTREGADO',
  lineas: [
    { presentacion: 'UNIDAD', cantidad: 2, unidades: 2, producto: { id: 'AB-101', nombre: 'Harina de trigo · quintal 46 kg', rubro: 'Harinas y panificación' }, subtotal: { texto: 'Bs 570,00', centavos: 57000 } },
    { presentacion: 'UNIDAD', cantidad: 2, unidades: 2, producto: { id: 'AB-114', nombre: 'Huevo · maple de 30', rubro: 'Huevos y lácteos' }, subtotal: { texto: 'Bs 61,00', centavos: 6100 } },
  ],
};
const conCompras = (): DatosDeNegocio => comprasQueEntran([entregado], { articulos: [], movimientos: [] }, AHORA);

async function vista(negocio: NegocioElegido, datos: DatosDeNegocio, extra: Partial<PropsDeVista> = {}) {
  const props: PropsDeVista = {
    negocio,
    grupos: inventarioDelNegocio(negocio, datos),
    cargando: false,
    enLinea: true,
    actualizando: false,
    imagenDe: () => 1,
    alActualizar: jest.fn(),
    alAbrir: jest.fn(),
    alAgregar: jest.fn(),
    alComprar: jest.fn(),
    ...extra,
  };
  await enPantalla(<VistaDeInventario {...props} />);
  return props;
}

describe('la pestaña de «Mi negocio»', () => {
  it('sin compras todavía: el estado vacío invita a comprar o a agregar a mano', async () => {
    const p = await vista({ tipo: 'hogar' }, { articulos: [], movimientos: [] });
    expect(screen.getByText('Mi casa')).toBeTruthy();
    expect(screen.getByText('Todavía no hay nada')).toBeTruthy();
    expect(screen.getByText(/aparece aquí solo/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ir a comprar' }));
    expect(p.alComprar).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Agregar a mano' }));
    expect(p.alAgregar).toHaveBeenCalled();
  });

  it('la tienda ve su mercadería con la cantidad y la unidad', async () => {
    await vista({ tipo: 'tienda' }, conCompras());
    expect(screen.getByText('Mi tienda')).toBeTruthy();
    expect(screen.getByText('Para vender')).toBeTruthy();
    expect(screen.getByText('2 quintales · 92 kg')).toBeTruthy();
    expect(screen.getByText('2 maples · 60 u.')).toBeTruthy();
    expect(screen.getByText('2 productos · Bs 631,00 en mercadería')).toBeTruthy();
  });

  it('el productor ve insumos y lo que hace por separado, aunque lo hecho esté vacío', async () => {
    await vista({ tipo: 'productor', subtipo: 'salteneria' }, conCompras());
    expect(screen.getByText('Mi producción')).toBeTruthy();
    expect(screen.getByText('Insumos')).toBeTruthy();
    expect(screen.getByText('Lo que haces')).toBeTruthy();
    expect(screen.getByText(/tus salteñas, listas para vender/)).toBeTruthy();
  });

  it('sin señal avisa que se ve lo guardado', async () => {
    await vista({ tipo: 'tienda' }, conCompras(), { enLinea: false });
    expect(screen.getByText('Sin conexión')).toBeTruthy();
    expect(screen.getByText('2 quintales · 92 kg')).toBeTruthy();
  });

  it('tocar un artículo lo abre', async () => {
    const p = await vista({ tipo: 'tienda' }, conCompras());
    await fireEvent.press(screen.getByRole('button', { name: 'Harina de trigo: 2 quintales · 92 kg' }));
    expect(p.alAbrir).toHaveBeenCalledWith(expect.objectContaining({ cantidad: 2 }));
  });
});

describe('agregar a mano', () => {
  it('no deja agregar sin nombre ni cantidad', async () => {
    const alAgregar = jest.fn();
    await enPantalla(<HojaParaAgregar visible alCerrar={jest.fn()} alAgregar={alAgregar} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Agregar' }));
    expect(await screen.findByText('Escribe el nombre del producto')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('¿Qué es?'), 'Queso menonita');
    await fireEvent.press(screen.getByRole('button', { name: 'Agregar' }));
    expect(await screen.findByText('Escribe cuánto compraste')).toBeTruthy();
    expect(alAgregar).not.toHaveBeenCalled();
  });

  it('agrega en kilos, con precio y proveedor', async () => {
    const alAgregar = jest.fn().mockResolvedValue(undefined);
    const alCerrar = jest.fn();
    await enPantalla(<HojaParaAgregar visible alCerrar={alCerrar} alAgregar={alAgregar} />);
    await fireEvent.changeText(screen.getByLabelText('¿Qué es?'), 'Queso menonita');
    await fireEvent.press(screen.getByRole('radio', { name: 'Kilos' }));
    await fireEvent.changeText(screen.getByLabelText('¿Cuánto compraste?'), '5');
    await fireEvent.changeText(screen.getByLabelText('Bs por kg (opcional)'), '35,50');
    await fireEvent.changeText(screen.getByLabelText('¿A quién? (opcional)'), 'Feria Barrio Lindo');
    await fireEvent.press(screen.getByRole('button', { name: 'Agregar' }));
    await waitFor(() => expect(alCerrar).toHaveBeenCalled());
    expect(alAgregar).toHaveBeenCalledWith({ nombre: 'Queso menonita', medida: MEDIDAS_A_MANO.find((m) => m.clave === 'kg')!.medida, proveedor: 'Feria Barrio Lindo' }, 5, 3550);
  });
});

describe('la ficha de un artículo', () => {
  const harina = () => existencias(conCompras()).find((x) => x.articulo.id === 'abasto:AB-101')!;

  it('muestra lo que hay, lo que costó y guarda lo contado', async () => {
    const alAjustar = jest.fn().mockResolvedValue(true);
    await enPantalla(<HojaDeArticulo existencia={harina()} imagen={1} alCerrar={jest.fn()} alAjustar={alAjustar} alSumar={jest.fn()} alPedir={jest.fn()} />);
    expect(screen.getByText('2 quintales · 92 kg')).toBeTruthy();
    expect(screen.getByText('1 quintal = 46 kg')).toBeTruthy();
    expect(screen.getByText(/Te costó Bs 285,00 por quintal/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Uno menos' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar lo que tengo' }));
    await waitFor(() => expect(alAjustar).toHaveBeenCalledWith(expect.objectContaining({ cantidad: 2 }), 1));
    expect(await screen.findByText('Guardamos lo que tienes')).toBeTruthy();
  });

  it('lo de Abasto se vuelve a pedir y no se suma a mano', async () => {
    const alPedir = jest.fn();
    await enPantalla(<HojaDeArticulo existencia={harina()} imagen={1} alCerrar={jest.fn()} alAjustar={jest.fn()} alSumar={jest.fn()} alPedir={alPedir} />);
    expect(screen.queryByText('Sumar una compra')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Volver a pedir' }));
    expect(alPedir).toHaveBeenCalledWith('AB-101');
  });
});

describe('el inventario de la app', () => {
  function Sondeo({ pedidos }: { pedidos: PedidoComprado[] }) {
    const { datos, cargando, sincronizar } = useInventario();
    return (
      <>
        <Text>{cargando ? 'cargando' : `${datos.articulos.length} artículos · ${datos.movimientos.length} movimientos`}</Text>
        <Text onPress={() => void sincronizar(pedidos)}>sincronizar</Text>
      </>
    );
  }

  it('sincronizar dos veces (Inicio y pestaña a la vez) no duplica y avisa una sola vez', async () => {
    const alEntrar = jest.fn();
    await render(
      <ProveedorDeInventario dueno="rosa" almacen={new AlmacenEnMemoria()} alEntrar={alEntrar}>
        <Sondeo pedidos={[entregado]} />
      </ProveedorDeInventario>,
    );
    await screen.findByText('0 artículos · 0 movimientos');
    await Promise.all([fireEvent.press(screen.getByText('sincronizar')), fireEvent.press(screen.getByText('sincronizar'))]);
    expect(await screen.findByText('2 artículos · 2 movimientos')).toBeTruthy();
    expect(alEntrar).toHaveBeenCalledTimes(1);
    expect(alEntrar).toHaveBeenCalledWith(2);
  });
});
