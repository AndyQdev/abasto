import { datosVacios, type CambiosDeNegocio, type ItemDeCarrito, type Producto } from '@abasto/comercio';
import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PrimerEstante, PrimeraReceta } from './PrimerPaso';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../api', () => ({ graphql: jest.fn() }));
jest.mock('../almacen-negocio', () => ({ almacenDeNegocio: () => new (jest.requireActual('../almacen-local').AlmacenLocalEnMemoria)() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: ({ name }: { name: string }) => jest.requireActual('react').createElement('Text', null, `[${name}]`) }));

configure({ asyncUtilTimeout: 5000 });
jest.setTimeout(30000);

const METRICAS = { frame: { x: 0, y: 0, width: 412, height: 915 }, insets: { top: 24, left: 0, right: 0, bottom: 0 } };
const enPantalla = (ui: ReactElement) => render(<SafeAreaProvider initialMetrics={METRICAS}>{ui}</SafeAreaProvider>);

const ABASTO = { id: 'abasto', nombre: 'Abasto', ciudad: 'Santa Cruz', verificado: true, relacion: 'NINGUNA' as const, deLaCasa: true };
function producto(id: string, nombre: string, centavos: number, docena = false): Producto {
  const precio = (c: number) => ({ centavos: c, texto: `Bs ${(c / 100).toFixed(2).replace('.', ',')}` });
  return {
    id,
    codigo: id,
    nombre,
    rubro: 'Varios',
    descripcion: '',
    stock: 0,
    estado: 'ACTIVO',
    precioVisible: true,
    abastecimiento: 'BAJO_PEDIDO',
    entregaHoras: 24,
    mayorista: ABASTO,
    escalas: docena ? [{ presentacion: 'DOCENA', cantidad: 12, precioUnitario: precio(centavos) }] : [{ presentacion: 'UNIDAD', cantidad: 1, precioUnitario: precio(centavos) }],
  };
}

// Lo que pide el cuñapé, con los nombres y medidas del catálogo real
const CATALOGO = [
  producto('AB-125', 'Almidón de yuca 1 kg', 1500),
  producto('AB-144', 'Queso criollo · 1 kg', 4500),
  producto('AB-115', 'Huevo · maple de 30', 3200),
  producto('AB-040', 'Mantequilla PIL con sal 200 g', 2390),
  producto('AB-007', 'Sal fina Lobos 1 kg', 640, true),
  producto('AB-017', 'Leche PIL fresca 900 ml', 980, true),
  producto('AB-001', 'Arroz Caisy Grano de Oro 1 kg', 1540, true),
  producto('AB-002', 'Azúcar Guabirá 1 kg', 700, true),
];

describe('Arma tu primera receta (registro del productor)', () => {
  it('elige qué prepara, edita la lista ya llena, ve cuánto le cuesta y pide lo que falta', async () => {
    const guardados: CambiosDeNegocio[] = [];
    const pedidos: ItemDeCarrito[][] = [];
    const alTerminar = jest.fn();
    await enPantalla(
      <PrimeraReceta
        area="horneados"
        productos={CATALOGO}
        libro={datosVacios()}
        aplicar={async (c) => {
          guardados.push(c);
        }}
        alPedir={(items) => pedidos.push(items)}
        alTerminar={alTerminar}
      />,
    );

    expect(screen.getByText('¿Qué preparas más?')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Cuñapé'));
    await fireEvent.press(screen.getByLabelText('Seguir'));

    // La lista ya viene llena, agrupada, con cuánto rinde
    expect(screen.getByText('Para la masa')).toBeTruthy();
    expect(screen.getByLabelText('Cuántas salen').props.value).toBe('50');
    expect(screen.getByLabelText('Cantidad de Queso criollo').props.value).toBe('1,1');
    await fireEvent.changeText(screen.getByLabelText('Cantidad de Queso criollo'), '1,5');
    await fireEvent.press(screen.getByLabelText('Quitar Sal'));
    await fireEvent.press(screen.getByLabelText('Guardar receta'));

    await waitFor(() => expect(screen.getByText('Cada cuñapé te cuesta')).toBeTruthy());
    const receta = guardados[0].recetas![0];
    expect(receta).toMatchObject({ nombre: 'Cuñapé', rinde: 50 });
    expect(receta.insumos).toContainEqual({ articuloId: 'abasto:AB-144', cantidad: 1.5 });
    expect(receta.insumos.some((i) => i.articuloId === 'abasto:AB-007')).toBe(false);
    // Los insumos quedan en el inventario en cero, enlazados al catálogo
    expect(guardados[0].articulos!.filter((a) => a.clase === 'COMPRADO').map((a) => a.productoId)).toEqual(['AB-125', 'AB-144', 'AB-115', 'AB-040', 'AB-017']);

    await fireEvent.press(screen.getByLabelText(/Pedir lo que falta/));
    expect(pedidos[0].map((i) => i.productoId)).toEqual(expect.arrayContaining(['AB-125', 'AB-144', 'AB-115', 'AB-040', 'AB-017']));
    expect(alTerminar).toHaveBeenCalled();
  });

  it('se puede saltar: queda para después en «Mi negocio»', async () => {
    const alTerminar = jest.fn();
    await enPantalla(<PrimeraReceta area="salteneria" productos={CATALOGO} libro={datosVacios()} aplicar={async () => {}} alPedir={() => {}} alTerminar={alTerminar} />);
    await fireEvent.press(screen.getByLabelText('Lo hago después'));
    expect(alTerminar).toHaveBeenCalled();
  });

  it('la pensión marca varios platos y arma una receta por cada uno', async () => {
    const guardados: CambiosDeNegocio[] = [];
    await enPantalla(
      <PrimeraReceta
        area="pension"
        productos={CATALOGO}
        libro={datosVacios()}
        aplicar={async (c) => {
          guardados.push(c);
        }}
        alPedir={() => {}}
        alTerminar={() => {}}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Majadito'));
    await fireEvent.press(screen.getByLabelText('Locro de gallina'));
    await fireEvent.press(screen.getByLabelText('Seguir'));
    expect(screen.getByText('Receta 1 de 2')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Guardar receta'));
    await waitFor(() => expect(screen.getByText('Receta 2 de 2')).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('Guardar receta'));
    await waitFor(() => expect(screen.getByText('¡Tus recetas están listas!')).toBeTruthy());
    expect(guardados.map((c) => c.recetas![0].nombre)).toEqual(['Majadito', 'Locro de gallina']);
  });
});

describe('Arma tu primer estante (registro de la tienda)', () => {
  it('quita lo que no vende, pide más de lo otro y lo deja en el inventario con precio de venta', async () => {
    const guardados: CambiosDeNegocio[] = [];
    const pedidos: ItemDeCarrito[][] = [];
    await enPantalla(
      <PrimerEstante
        productos={CATALOGO}
        libro={datosVacios()}
        aplicar={async (c) => {
          guardados.push(c);
        }}
        alPedir={(items) => pedidos.push(items)}
        alTerminar={() => {}}
      />,
    );

    expect(screen.getByText('Si lo vendes al precio sugerido, ganas')).toBeTruthy();
    // Sale ya marcado: arroz, azúcar, sal, huevo y leche (lo del estante que hay en este catálogo)
    await fireEvent.press(screen.getByLabelText('Azúcar Guabirá 1 kg'));
    await fireEvent.press(screen.getByLabelText('Sal fina Lobos 1 kg'));
    await fireEvent.press(screen.getByLabelText('Huevo · maple de 30'));
    await fireEvent.press(screen.getByLabelText('Leche PIL fresca 900 ml'));
    await fireEvent.press(screen.getByLabelText('Más Arroz Caisy Grano de Oro 1 kg'));
    expect(screen.getByText('Inviertes Bs 369,60 y vendes Bs 444,00')).toBeTruthy(); // 2 docenas a Bs 15,40 y Bs 18,50
    await fireEvent.press(screen.getByLabelText(/Pedir este estante/));

    await waitFor(() => expect(pedidos).toHaveLength(1));
    expect(pedidos[0]).toEqual([expect.objectContaining({ productoId: 'AB-001', presentacion: 'DOCENA', cantidad: 2 })]);
    expect(guardados[0].articulos).toEqual([expect.objectContaining({ id: 'abasto:AB-001', precioVentaCentavos: 1850 })]);
  });
});
