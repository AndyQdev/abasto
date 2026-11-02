import {
  comprasQueEntran,
  cuantosCambios,
  datosVacios,
  existencias,
  fusionar,
  MEDIDAS_A_MANO,
  type CambiosDeNegocio,
  type DatosDeNegocio,
  type NegocioElegido,
  type PedidoComprado,
} from '@abasto/comercio';
import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRef, type ReactElement, type ReactNode } from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlmacenLocalEnMemoria } from '../almacen-local';
import { ProveedorDeInventario, useInventario } from '../inventario';
import { Caja, CarritoDeVenta, useVenta } from './Caja';
import { Cuentas } from './Cuentas';
import { Fiado } from './Fiado';
import { HojaDeArticulo, HojaParaAgregar, VistaDeInventario } from './Inventario';
import { Produccion } from './Produccion';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../api', () => ({ graphql: jest.fn() }));
// Los íconos cargan fuentes nativas: en la prueba basta con su nombre
jest.mock('@expo/vector-icons', () => ({ Ionicons: ({ name }: { name: string }) => jest.requireActual('react').createElement('Text', null, `[${name}]`) }));
jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useIsFocused: () => true }));
jest.mock('../almacen-negocio', () => ({ almacenDeNegocio: () => new (jest.requireActual('../almacen-local').AlmacenLocalEnMemoria)() }));

// Con la máquina cargada (emulador, Docker) las esperas de 1 s se quedan cortas
configure({ asyncUtilTimeout: 5000 });
jest.setTimeout(30000);

const HOY = '2026-11-01T12:00:00.000Z';
const METRICAS = { frame: { x: 0, y: 0, width: 412, height: 915 }, insets: { top: 24, left: 0, right: 0, bottom: 0 } };
const TIENDA: NegocioElegido = { tipo: 'tienda' };
const SALTENERIA: NegocioElegido = { tipo: 'productor', subtipo: 'salteneria' };

const linea = (id: string, nombre: string, rubro: string, unidades: number, centavos: number) => ({
  presentacion: 'UNIDAD',
  cantidad: unidades,
  unidades,
  producto: { id, nombre, rubro },
  subtotal: { texto: '', centavos },
});
const entregado: PedidoComprado = {
  id: 'p-1',
  codigo: 'A-0001',
  estado: 'ENTREGADO',
  total: { centavos: 57000 + 12600 },
  lineas: [linea('AB-101', 'Harina de trigo · quintal 46 kg', 'Harinas y panificación', 2, 57000), linea('AB-030', 'Coca-Cola 2 L', 'Bebidas', 12, 12600)],
};
const conCompras = (): DatosDeNegocio => fusionar(datosVacios(), comprasQueEntran([entregado], datosVacios(), HOY));

/** Un servidor de mentira con la misma regla del de verdad: guarda con `fusionar` y baja todo con una marca */
function servidorFalso() {
  let base = datosVacios();
  let reloj = 0;
  const llamadas: string[] = [];
  const servidor = jest.fn(async (query: string, variables?: Record<string, unknown>) => {
    if (query.includes('sincronizarMiNegocio')) {
      llamadas.push('subir');
      const cambios = variables!.cambios as CambiosDeNegocio;
      base = fusionar(base, cambios);
      return { sincronizarMiNegocio: { recibidos: cuantosCambios(cambios), hasta: String(++reloj) } };
    }
    llamadas.push('bajar');
    return { miNegocio: { ...base, hasta: String(++reloj) } };
  }) as unknown as <T>(q: string, v?: Record<string, unknown>) => Promise<T>;
  return { servidor, base: () => base, llamadas };
}

function Con({ almacen, servidor, enLinea = true, children }: { almacen: AlmacenLocalEnMemoria; servidor?: ReturnType<typeof servidorFalso>['servidor']; enLinea?: boolean; children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ProveedorDeInventario dueno="rosa" almacen={almacen} enLinea={enLinea} servidor={servidor ?? (servidorFalso().servidor)}>
        {children}
      </ProveedorDeInventario>
    </SafeAreaProvider>
  );
}

/** Le pasa los datos del proveedor a la sección (como la pantalla) */
function ConDatos({ children }: { children: (d: DatosDeNegocio) => ReactElement }) {
  return children(useInventario().datos);
}

/** Muestra el estado del proveedor para que la prueba lo lea */
function Sondeo() {
  const { datos, nube, porSubir, aplicar, sincronizarAhora } = useInventario();
  return (
    <>
      <Text>{`${datos.articulos.length} artículos · ${datos.movimientos.length} movimientos · ${datos.ventas.length} ventas`}</Text>
      <Text>{`nube: ${nube} · por subir: ${porSubir}`}</Text>
      <Text onPress={() => void aplicar({ anotaciones: [{ id: 'g-1', tipo: 'GASTO', montoCentavos: 1500, categoria: 'Servicios', nota: 'Luz', origen: 'MANUAL', claveUnica: 'anotacion:g-1', fecha: HOY }] })}>anotar</Text>
      <Text onPress={() => void sincronizarAhora()}>sincronizar</Text>
    </>
  );
}

async function almacenCon(datos: DatosDeNegocio) {
  const a = new AlmacenLocalEnMemoria();
  await a.aplicarDelServidor(datos);
  return a;
}

describe('inventario', () => {
  it('sin compras todavía: el estado vacío invita a comprar o a agregar a mano', async () => {
    const alComprar = jest.fn();
    await render(
      <Con almacen={new AlmacenLocalEnMemoria()}>
        <VistaDeInventario negocio={{ tipo: 'hogar' }} datos={datosVacios()} cargando={false} imagenDe={() => 1} alAbrir={jest.fn()} alAgregar={jest.fn()} alComprar={alComprar} alPedir={jest.fn()} />
      </Con>,
    );
    expect(screen.getByText('Todavía no hay nada')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ir a comprar' }));
    expect(alComprar).toHaveBeenCalled();
  });

  it('lo que acaba de llegar con una compra sale arriba y marcado «Recién llegó» (02/11)', async () => {
    await render(
      <Con almacen={new AlmacenLocalEnMemoria()}>
        <VistaDeInventario negocio={TIENDA} datos={conCompras()} cargando={false} imagenDe={() => 1} alAbrir={jest.fn()} alAgregar={jest.fn()} alComprar={jest.fn()} alPedir={jest.fn()} recien={['AB-030']} />
      </Con>,
    );
    expect(screen.getAllByText('Recién llegó')).toHaveLength(1);
    const filas = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string | undefined).filter((x) => x && /: /.test(x));
    expect(filas[0]).toMatch(/^Coca-Cola/);
  });

  it('la tienda ve su mercadería con la unidad, el precio sugerido y lo que gana', async () => {
    await render(
      <Con almacen={new AlmacenLocalEnMemoria()}>
        <VistaDeInventario negocio={TIENDA} datos={conCompras()} cargando={false} imagenDe={() => 1} alAbrir={jest.fn()} alAgregar={jest.fn()} alComprar={jest.fn()} alPedir={jest.fn()} />
      </Con>,
    );
    expect(screen.getByText('2 quintales · 92 kg')).toBeTruthy();
    expect(screen.getByText('12 u. · 24 L')).toBeTruthy();
    // Coca-Cola: costo Bs 10,50 + 20 % → Bs 13,00, gana Bs 2,50
    expect(screen.getByText('Bs 13,00')).toBeTruthy();
    expect(screen.getByText('gana Bs 2,50')).toBeTruthy();
  });

  it('el productor ve insumos y lo que hace por separado', async () => {
    await render(
      <Con almacen={new AlmacenLocalEnMemoria()}>
        <VistaDeInventario negocio={SALTENERIA} datos={conCompras()} cargando={false} imagenDe={() => 1} alAbrir={jest.fn()} alAgregar={jest.fn()} alComprar={jest.fn()} alPedir={jest.fn()} />
      </Con>,
    );
    expect(screen.getByText('Insumos')).toBeTruthy();
    expect(screen.getByText(/tus salteñas, listas para vender/)).toBeTruthy();
  });

  it('agregar a mano valida y agrega en kilos con precio y proveedor', async () => {
    const alAgregar = jest.fn().mockResolvedValue(undefined);
    await render(
      <Con almacen={new AlmacenLocalEnMemoria()}>
        <HojaParaAgregar visible alCerrar={jest.fn()} alAgregar={alAgregar} />
      </Con>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Agregar' }));
    expect(await screen.findByText('Escribe el nombre del producto')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('¿Qué es?'), 'Queso menonita');
    await fireEvent.press(screen.getByRole('radio', { name: 'Kilos' }));
    await fireEvent.changeText(screen.getByLabelText('¿Cuánto compraste?'), '5');
    await fireEvent.changeText(screen.getByLabelText('Bs por kg (opcional)'), '35,50');
    await fireEvent.press(screen.getByRole('button', { name: 'Agregar' }));
    await waitFor(() => expect(alAgregar).toHaveBeenCalledWith({ nombre: 'Queso menonita', medida: MEDIDAS_A_MANO.find((m) => m.clave === 'kg')!.medida, proveedor: '' }, 5, 3550));
  });

  it('la ficha guarda lo contado y el precio de venta en la cuenta', async () => {
    const almacen = await almacenCon(conCompras());
    const harina = existencias(conCompras()).find((x) => x.articulo.productoId === 'AB-101')!;
    await render(
      <Con almacen={almacen}>
        <HojaDeArticulo negocio={TIENDA} existencia={harina} imagen={1} alCerrar={jest.fn()} alPedir={jest.fn()} />
      </Con>,
    );
    expect(screen.getByText(/Sugerido: Bs 342,00/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Uno menos' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar lo que tengo' }));
    expect(await screen.findByText('Guardamos lo que tienes')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Bs por quintal'), '350');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar precio' }));
    expect(await screen.findByText('Guardamos el precio')).toBeTruthy();
    const datos = await almacen.leer();
    expect(existencias(datos).find((x) => x.articulo.id === harina.articulo.id)).toMatchObject({ cantidad: 1, articulo: expect.objectContaining({ precioVentaCentavos: 35000 }) });
    // Las dos cosas quedan en la cola para subir a la cuenta
    expect(cuantosCambios(await almacen.pendientes())).toBe(2);
  });
});

/** Como en «Mi negocio»: la venta arriba, la grilla en la lista y el carrito flotando aparte */
function Vender({ datos, alVendido }: { datos: DatosDeNegocio; alVendido: (t: string) => void }) {
  const venta = useVenta();
  const destino = useRef(null);
  return (
    <>
      <Caja negocio={TIENDA} datos={datos} imagenDe={() => 1} venta={venta} destino={destino} />
      <CarritoDeVenta negocio={TIENDA} datos={datos} imagenDe={() => 1} venta={venta} abajo={0} destino={destino} alVendido={alVendido} />
    </>
  );
}

describe('vender y fiar', () => {
  it('la caja suma con cada toque, cobra y descuenta del inventario', async () => {
    const almacen = await almacenCon(conCompras());
    const alVendido = jest.fn();
    await render(
      <Con almacen={almacen}>
        <ConDatos>{(d) => <Vender datos={d} alVendido={alVendido} />}</ConDatos>
      </Con>,
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Vender Coca-Cola' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Vender Coca-Cola' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Vender Coca-Cola' }));
    // El carrito flotante dice cuánto va; al tocarlo se abre la venta con la línea y el total
    await fireEvent.press(screen.getByRole('button', { name: 'Ver tu venta: 3 por Bs 39,00' }));
    expect(screen.getByText('Bs 13,00 c/u')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Uno menos de Coca-Cola' }));
    expect(screen.getByRole('button', { name: 'Ver tu venta: 2 por Bs 26,00' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Uno más de Coca-Cola' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cobrado' }));
    await waitFor(() => expect(alVendido).toHaveBeenCalledWith('Venta cobrada: Bs 39,00'));
    const datos = await almacen.leer();
    expect(datos.ventas).toEqual([expect.objectContaining({ totalCentavos: 3900, costoCentavos: 3150, forma: 'CONTADO' })]);
    expect(existencias(datos).find((x) => x.articulo.productoId === 'AB-030')!.texto).toBe('9 u. · 18 L');
  });

  it('una venta fiada a alguien nuevo queda en su cuaderno; después paga una parte', async () => {
    const almacen = await almacenCon(conCompras());
    await render(
      <Con almacen={almacen}>
        <ConDatos>
          {(d) => (
            <>
              <Vender datos={d} alVendido={jest.fn()} />
              <Fiado datos={d} />
            </>
          )}
        </ConDatos>
      </Con>,
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Vender Coca-Cola' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Ver tu venta: 1 por Bs 13,00' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Fiado' }));
    await fireEvent.changeText(screen.getByLabelText('Alguien nuevo'), 'Don Pedro');
    await fireEvent.press(screen.getByRole('button', { name: 'Fiar a alguien nuevo' }));
    expect(await screen.findByRole('button', { name: 'Don Pedro: debe Bs 13,00' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Don Pedro: debe Bs 13,00' }));
    await fireEvent.changeText(screen.getByLabelText('Monto (Bs)'), '5');
    await fireEvent.press(screen.getByRole('button', { name: 'Pagó' }));
    expect(await screen.findByText('Anotamos que pagó Bs 5,00')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Don Pedro: debe Bs 8,00' })).toBeTruthy();
  });
});

describe('producción (receta, tanda y venta, paso a paso)', () => {
  it('sin recetas invita a agregar la primera; el asistente la arma con el costo en vivo', async () => {
    const almacen = await almacenCon(conCompras());
    const alPedir = jest.fn();
    const alVender = jest.fn();
    await render(
      <Con almacen={almacen}>
        <ConDatos>{(d) => <Produccion negocio={SALTENERIA} datos={d} nuevo={0} alPedir={alPedir} alVender={alVender} />}</ConDatos>
      </Con>,
    );
    expect(screen.getByText('Agrega lo que haces')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Escribir mi receta' }));
    // 1 · ¿Qué haces?
    await fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText(/Escribe qué haces/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Salteña de pollo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
    // 2 · ¿Cuántas salen? (100 por defecto)
    expect(screen.getByLabelText('Cuántas salen con esto').props.value).toBe('100');
    await fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
    // 3 · ¿Qué lleva? 46 kg de harina = 1 quintal de Bs 285 → Bs 2,85 cada una
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Harina de trigo' }));
    await fireEvent.changeText(screen.getByLabelText('Cuánto lleva de Harina de trigo'), '46');
    expect(await screen.findByText('Bs 2,85')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar receta' }));

    // La tarjeta: lo que cuesta, a cuánto se vende (costo + 50 %) y lo que gana
    expect(await screen.findByText('Salteña de pollo')).toBeTruthy();
    expect(screen.getByText('Bs 4,50')).toBeTruthy();
    expect(screen.getByText('Bs 1,65')).toBeTruthy();

    // Hacer una tanda: 300 no alcanzan (falta 1 quintal) → pedir lo que falta
    await fireEvent.press(screen.getByRole('button', { name: 'Hacer una tanda' }));
    await fireEvent.changeText(screen.getByLabelText('Cuántas quieres hacer'), '300');
    expect(await screen.findByText(/Te falta 1 quintal · 46 kg/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Te faltan insumos' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Pedir lo que falta a Abasto (1)' }));
    expect(alPedir).toHaveBeenCalledWith([{ productoId: 'AB-101', envases: 1 }]);

    // Con 200 alcanza: ya las hice → salieron 190 (10 de merma) → listo
    await fireEvent.changeText(screen.getByLabelText('Cuántas quieres hacer'), '200');
    await fireEvent.press(await screen.findByRole('button', { name: 'Ya las hice' }));
    await fireEvent.changeText(screen.getByLabelText('Cuántas salieron'), '190');
    expect(await screen.findByText('Merma: 10 salteñas')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar tanda' }));
    expect(await screen.findByText('¡Listo!')).toBeTruthy();
    expect(screen.getByText(/Te costó Bs 570,00/)).toBeTruthy();
    const hecho = existencias(await almacen.leer()).find((x) => x.articulo.clase === 'HECHO')!;
    expect(hecho).toMatchObject({ cantidad: 190, costoPromedioCentavos: 300 });
    await fireEvent.press(screen.getByRole('button', { name: 'Vender ahora' }));
    expect(alVender).toHaveBeenCalled();
  });

  it('el botón flotante abre «Nueva receta»', async () => {
    const almacen = await almacenCon(conCompras());
    const { rerender } = await render(
      <Con almacen={almacen}>
        <ConDatos>{(d) => <Produccion negocio={SALTENERIA} datos={d} nuevo={0} alPedir={jest.fn()} alVender={jest.fn()} />}</ConDatos>
      </Con>,
    );
    expect(screen.queryAllByText('¿Qué haces?')).toHaveLength(0);
    await rerender(
      <Con almacen={almacen}>
        <ConDatos>{(d) => <Produccion negocio={SALTENERIA} datos={d} nuevo={1} alPedir={jest.fn()} alVender={jest.fn()} />}</ConDatos>
      </Con>,
    );
    expect((await screen.findAllByText('¿Qué haces?')).length).toBeGreaterThan(0);
  });
});

describe('cuentas de la casa', () => {
  it('lo comprado en Abasto ya está como gasto; se anota un ingreso y se ve cuánto queda', async () => {
    const almacen = await almacenCon(conCompras());
    await render(
      <Con almacen={almacen}>
        <ConDatos>{(d) => <Cuentas datos={d} pedidos={[]} productos={[]} />}</ConDatos>
      </Con>,
    );
    expect(screen.getByText('Compras en Abasto · Pedido A-0001')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '+ Ingreso' }));
    await fireEvent.changeText(screen.getByLabelText('Monto (Bs)'), '3000');
    await fireEvent.press(screen.getByRole('radio', { name: 'Sueldo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Anotar' }));
    expect(await screen.findByLabelText('Te quedan este mes: Bs 2.304,00')).toBeTruthy();
  });
});

describe('todo queda en la cuenta (base de datos del servidor)', () => {
  it('lo hecho en un celular sube solo y otro celular con el mismo número lo baja todo', async () => {
    const s = servidorFalso();
    const celularA = await almacenCon(conCompras());
    await celularA.guardar({ articulos: conCompras().articulos }); // como si se hubiera hecho en este celular
    await render(
      <Con almacen={celularA} servidor={s.servidor}>
        <Sondeo />
      </Con>,
    );
    expect(await screen.findByText('nube: al-dia · por subir: 0')).toBeTruthy();
    expect(s.base().articulos).toHaveLength(2);

    // Celular nuevo: vacío, baja todo al abrir (otro proveedor, el mismo servidor)
    const celularB = new AlmacenLocalEnMemoria();
    await render(
      <Con almacen={celularB} servidor={s.servidor}>
        <Sondeo />
      </Con>,
    );
    expect(await screen.findByText('2 artículos · 0 movimientos · 0 ventas')).toBeTruthy();
    expect((await celularB.leer()).articulos.map((a) => a.productoId).sort()).toEqual(['AB-030', 'AB-101']);
  });

  it('sin señal guarda en la cola y, al volver la señal, la sube sola', async () => {
    const s = servidorFalso();
    const almacen = new AlmacenLocalEnMemoria();
    const { rerender } = await render(
      <Con almacen={almacen} servidor={s.servidor} enLinea={false}>
        <Sondeo />
      </Con>,
    );
    await fireEvent.press(screen.getByText('anotar'));
    expect(await screen.findByText('nube: sin-senal · por subir: 1')).toBeTruthy();
    expect(s.llamadas).not.toContain('subir');
    await rerender(
      <Con almacen={almacen} servidor={s.servidor} enLinea>
        <Sondeo />
      </Con>,
    );
    expect(await screen.findByText('nube: al-dia · por subir: 0')).toBeTruthy();
    expect(s.base().anotaciones).toEqual([expect.objectContaining({ claveUnica: 'anotacion:g-1' })]);
  });

  it('si el servidor falla, nada se pierde: queda en la cola y se reintenta', async () => {
    const almacen = new AlmacenLocalEnMemoria();
    const falla = jest.fn().mockRejectedValue(new Error('caído')) as unknown as ReturnType<typeof servidorFalso>['servidor'];
    await render(
      <Con almacen={almacen} servidor={falla}>
        <Sondeo />
      </Con>,
    );
    await fireEvent.press(screen.getByText('anotar'));
    await fireEvent.press(screen.getByText('sincronizar'));
    expect(await screen.findByText('nube: error · por subir: 1')).toBeTruthy();
    expect(cuantosCambios(await almacen.pendientes())).toBe(1);
  });
});

describe('el tipo de negocio está en la cuenta (Catálogo)', () => {
  const { ProveedorDeNegocio, useNegocio } = jest.requireActual('../NegocioInicio') as typeof import('../NegocioInicio');
  function Mostrar() {
    const { negocio, leido, elegir } = useNegocio();
    return (
      <>
        <Text>{leido ? `negocio: ${negocio ? `${negocio.tipo}${negocio.subtipo ? `/${negocio.subtipo}` : ''}` : 'ninguno'}` : 'leyendo'}</Text>
        <Text onPress={() => elegir({ tipo: 'tienda' })}>elegir tienda</Text>
      </>
    );
  }

  it('en un celular nuevo se lee de la cuenta: no vuelve a preguntar', async () => {
    const servidor = jest.fn().mockResolvedValue({ miTipoDeNegocio: { tipo: 'productor', subtipo: 'panaderia', elegidoEn: HOY } });
    await render(
      <ProveedorDeNegocio dueno="u-nuevo" servidor={servidor as never}>
        <Mostrar />
      </ProveedorDeNegocio>,
    );
    expect(await screen.findByText('negocio: productor/panaderia')).toBeTruthy();
  });

  it('elegido sin señal queda marcado y se sube la próxima vez que abre', async () => {
    const sinSenal = jest.fn().mockRejectedValue(new Error('sin señal'));
    await render(
      <ProveedorDeNegocio dueno="u-calle" servidor={sinSenal as never}>
        <Mostrar />
      </ProveedorDeNegocio>,
    );
    expect(await screen.findByText('negocio: ninguno')).toBeTruthy();
    await fireEvent.press(screen.getByText('elegir tienda'));
    expect(await screen.findByText('negocio: tienda')).toBeTruthy();

    const conSenal = jest.fn().mockImplementation(async (q: string) => (q.includes('elegirTipoDeNegocio') ? { elegirTipoDeNegocio: { tipo: 'tienda', subtipo: null, elegidoEn: HOY } } : { miTipoDeNegocio: null }));
    await render(
      <ProveedorDeNegocio dueno="u-calle" servidor={conSenal as never}>
        <Mostrar />
      </ProveedorDeNegocio>,
    );
    await waitFor(() => expect(conSenal).toHaveBeenCalledWith(expect.stringContaining('elegirTipoDeNegocio'), { tipo: 'tienda', subtipo: null }));
  });
});
