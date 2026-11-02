import { articulo } from '../dominio/ejemplos.js';
import type { Movimiento } from '../dominio/modelo.js';
import { ConsultarMiNegocio, MARGEN_DE_LA_MARCA_MS, RegistrarCompraEntregada, SincronizarMiNegocio } from './casos-de-uso.js';
import { NegocioEnMemoria } from './negocio.en-memoria.js';

const F = '2026-11-01T12:00:00.000Z';
const mov = (id: string, clave = id): Movimiento => ({ id, articuloId: 'abasto:AB-101', tipo: 'ENTRADA', cantidad: 1, costoUnitarioCentavos: 28500, origen: 'OTRO_PROVEEDOR', claveUnica: clave, fecha: F, nota: null });

function preparar() {
  let ahora = Date.parse('2026-11-01T12:00:00.000Z');
  const repo = new NegocioEnMemoria(() => ahora);
  const reloj = { ahora: () => new Date(ahora) };
  const pasar = (ms: number) => (ahora += ms);
  return { repo, pasar, subir: new SincronizarMiNegocio(repo, reloj), bajar: new ConsultarMiNegocio(repo, reloj), reloj };
}

describe('sincronizar Mi negocio', () => {
  it('subir dos veces lo mismo no duplica nada', async () => {
    const { subir, bajar } = preparar();
    const cambios = { articulos: [articulo('abasto:AB-101')], movimientos: [mov('m1'), mov('m2')] };
    await subir.ejecutar('rosa', cambios);
    await subir.ejecutar('rosa', cambios);
    const todo = await bajar.ejecutar('rosa', null);
    expect(todo.articulos).toHaveLength(1);
    expect(todo.movimientos.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('un movimiento con la misma clave única no entra dos veces aunque traiga otro id', async () => {
    const { subir, bajar } = preparar();
    await subir.ejecutar('rosa', { movimientos: [mov('m1', 'pedido:p1:AB-101:UNIDAD')] });
    await subir.ejecutar('rosa', { movimientos: [mov('otro-id', 'pedido:p1:AB-101:UNIDAD')] });
    expect((await bajar.ejecutar('rosa', null)).movimientos).toHaveLength(1);
  });

  it('lo editable gana si es igual o más nuevo; uno más viejo no pisa', async () => {
    const { subir, bajar } = preparar();
    await subir.ejecutar('rosa', { articulos: [articulo('a1', { precioVentaCentavos: 2100, actualizadoEn: '2026-11-01T12:00:00.000Z' })] });
    await subir.ejecutar('rosa', { articulos: [articulo('a1', { precioVentaCentavos: 2500, actualizadoEn: '2026-11-01T13:00:00.000Z' })] });
    await subir.ejecutar('rosa', { articulos: [articulo('a1', { precioVentaCentavos: 1000, actualizadoEn: '2026-11-01T11:00:00.000Z' })] });
    expect((await bajar.ejecutar('rosa', null)).articulos[0].precioVentaCentavos).toBe(2500);
  });

  it('un cliente nunca ve lo de otro', async () => {
    const { subir, bajar } = preparar();
    await subir.ejecutar('rosa', { articulos: [articulo('a1')] });
    expect((await bajar.ejecutar('pedro', null)).articulos).toEqual([]);
  });

  it('un celular nuevo baja todo; después, solo lo nuevo desde la marca', async () => {
    const { subir, bajar, pasar } = preparar();
    await subir.ejecutar('rosa', { articulos: [articulo('a1')] });
    pasar(60_000);
    const primera = await bajar.ejecutar('rosa', null);
    expect(primera.articulos).toHaveLength(1);
    // La marca queda unos segundos antes de «ahora»: lo que se guardaba en ese momento vuelve a bajar
    expect(Date.parse(primera.hasta)).toBe(Date.parse('2026-11-01T12:01:00.000Z') - MARGEN_DE_LA_MARCA_MS);
    pasar(60_000);
    await subir.ejecutar('rosa', { movimientos: [mov('m9')] });
    const segunda = await bajar.ejecutar('rosa', primera.hasta);
    expect(segunda.articulos).toEqual([]);
    expect(segunda.movimientos.map((m) => m.id)).toEqual(['m9']);
  });

  it('todo o nada: si un cambio no sirve, no se guarda ninguno', async () => {
    const { subir, bajar } = preparar();
    await expect(subir.ejecutar('rosa', { articulos: [articulo('a1'), articulo('a2', { nombre: '' })] })).rejects.toThrow(/no tiene nombre/);
    expect((await bajar.ejecutar('rosa', null)).articulos).toEqual([]);
  });

  it('una cuenta sin negocio no puede sincronizar', async () => {
    const { subir } = preparar();
    await expect(subir.ejecutar('', {})).rejects.toThrow(/no tiene un negocio/);
  });
});

describe('el pedido entregado entra solo, desde el servidor', () => {
  const pedido = { pedidoId: 'p-1', codigo: 'A-0001', tiendaId: 'rosa', totalCentavos: 57000, lineas: [{ productoId: 'AB-101', presentacion: 'UNIDAD', unidades: 2, subtotalCentavos: 57000 }] };
  const directorio = { datos: async () => new Map([['AB-101', { nombre: 'Harina de trigo · quintal 46 kg', rubro: 'Harinas y panificación' }]]) };

  it('repetir el evento no duplica, y no pisa lo que el cliente ya cambió', async () => {
    const { repo, reloj, subir, bajar } = preparar();
    const registrar = new RegistrarCompraEntregada(repo, directorio, reloj);
    // El cliente ya tenía la harina con su precio de venta, de antes
    await subir.ejecutar('rosa', { articulos: [articulo('abasto:AB-101', { precioVentaCentavos: 33000 })] });
    expect(await registrar.ejecutar(pedido)).toBe(2); // la entrada y el gasto
    expect(await registrar.ejecutar(pedido)).toBe(0);
    const todo = await bajar.ejecutar('rosa', null);
    expect(todo.movimientos.map((m) => m.claveUnica)).toEqual(['pedido:p-1:AB-101:UNIDAD']);
    expect(todo.anotaciones.map((a) => a.claveUnica)).toEqual(['pedido:p-1']);
    expect(todo.articulos[0].precioVentaCentavos).toBe(33000);
  });

  it('si el teléfono ya la registró sin señal, el evento no la duplica', async () => {
    const { repo, reloj, subir, bajar } = preparar();
    await subir.ejecutar('rosa', { movimientos: [{ ...mov('pedido:p-1:AB-101:UNIDAD'), origen: 'ABASTO' }] });
    await new RegistrarCompraEntregada(repo, directorio, reloj).ejecutar(pedido);
    expect((await bajar.ejecutar('rosa', null)).movimientos).toHaveLength(1);
  });

  it('un evento sin líneas (de antes del 01/11) no registra nada', async () => {
    const { repo, reloj } = preparar();
    expect(await new RegistrarCompraEntregada(repo, directorio, reloj).ejecutar({ ...pedido, lineas: [] })).toBe(0);
  });
});
