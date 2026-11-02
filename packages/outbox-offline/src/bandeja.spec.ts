import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { AlmacenEnMemoria, Bandeja, type Enviar, type OperacionLocal } from './bandeja.js';
import { AlmacenIndexedDB } from './indexeddb.js';

let n = 0;
const claves = () => `clave-${++n}`;
let segundo = 0;
const reloj = () => new Date(Date.UTC(2026, 9, 20, 12, 0, segundo++));

const pedido = { mayoristaId: 'lp', lineas: [{ productoId: 'HP-0400', presentacion: 'CAJA', cantidad: 2 }] };

describe('Bandeja offline', () => {
  it('sin red, todo queda pendiente y la clave no cambia entre reintentos', async () => {
    const enviadas: string[][] = [];
    const sinRed: Enviar = async (ops) => {
      enviadas.push(ops.map((o) => o.clave));
      throw new TypeError('Failed to fetch');
    };
    const bandeja = new Bandeja(new AlmacenEnMemoria(), sinRed, { generarClave: claves, ahora: reloj });
    const op = await bandeja.agregar('pedido.crear', pedido);

    await bandeja.sincronizar();
    await bandeja.sincronizar();

    expect(enviadas).toEqual([[op.clave], [op.clave]]);
    const [pendiente] = await bandeja.pendientes();
    expect(pendiente).toMatchObject({ clave: op.clave, estado: 'pendiente', intentos: 2 });
  });

  it('al volver la red se manda en el orden en que se hizo', async () => {
    let recibidas: OperacionLocal[] = [];
    const conRed: Enviar = async (ops) => {
      recibidas = ops;
      return ops.map((o) => ({ clave: o.clave, estado: 'aplicada' as const, respuesta: { id: o.clave } }));
    };
    const bandeja = new Bandeja(new AlmacenEnMemoria(), conRed, { generarClave: claves, ahora: reloj });
    const a = await bandeja.agregar('pedido.crear', pedido);
    const b = await bandeja.agregar('pedido.crear', { ...pedido, mayoristaId: 'lr' });

    await bandeja.sincronizar();

    expect(recibidas.map((o) => o.clave)).toEqual([a.clave, b.clave]);
    expect(await bandeja.pendientes()).toEqual([]);
  });

  it('después de mandarla se lee lo que respondió Conecta (el pedido creado)', async () => {
    const conRed: Enviar = async (ops) => ops.map((o) => ({ clave: o.clave, estado: 'aplicada' as const, respuesta: { id: 'p-123' } }));
    const bandeja = new Bandeja(new AlmacenEnMemoria(), conRed, { generarClave: claves, ahora: reloj });
    const op = await bandeja.agregar('pedido.crear', pedido);
    expect((await bandeja.operacion(op.clave))?.estado).toBe('pendiente');
    await bandeja.sincronizar();
    expect(await bandeja.operacion(op.clave)).toMatchObject({ estado: 'aplicada', respuesta: { id: 'p-123' } });
    expect(await bandeja.operacion('otra')).toBeNull();
  });

  it('una operación que Conecta ya tenía cuenta como aplicada', async () => {
    const repetida: Enviar = async (ops) => ops.map((o) => ({ clave: o.clave, estado: 'repetida' as const }));
    const almacen = new AlmacenEnMemoria();
    const bandeja = new Bandeja(almacen, repetida, { generarClave: claves, ahora: reloj });
    await bandeja.agregar('pedido.crear', pedido);
    await bandeja.sincronizar();
    expect((await almacen.todas())[0].estado).toBe('aplicada');
  });

  it('dos sincronizaciones al mismo tiempo mandan el lote una sola vez', async () => {
    let llamadas = 0;
    const lenta: Enviar = async (ops) => {
      llamadas++;
      await new Promise((r) => setTimeout(r, 10));
      return ops.map((o) => ({ clave: o.clave, estado: 'aplicada' as const }));
    };
    const bandeja = new Bandeja(new AlmacenEnMemoria(), lenta, { generarClave: claves, ahora: reloj });
    await bandeja.agregar('pedido.crear', pedido);
    await Promise.all([bandeja.sincronizar(), bandeja.sincronizar()]);
    expect(llamadas).toBe(1);
  });

  it('guarda en IndexedDB y sobrevive a abrir la base de nuevo', async () => {
    const nombre = `prueba-${Date.now()}`;
    const bandeja = new Bandeja(new AlmacenIndexedDB(nombre), async () => [], { generarClave: claves, ahora: reloj });
    const op = await bandeja.agregar('pedido.crear', pedido);
    const otraVez = await new AlmacenIndexedDB(nombre).todas();
    expect(otraVez.map((o) => o.clave)).toEqual([op.clave]);
  });
});
