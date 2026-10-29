import { AlmacenEnMemoria, Bandeja } from '@abasto/outbox-offline';
import { describe, expect, it } from 'vitest';
import { CODIGO_EN_COLA, claveDeConsulta, duenoDelToken, esMutacion, respuestaEnCola } from './graphql';
import { enviarAlRouter } from './sincronizar';

const tokenDe = (carga: Record<string, string>) => `Bearer x.${btoa(JSON.stringify(carga))}.y`;
const LOS_POZOS = tokenDe({ org_id: 'lp', sub: 'u1' });
const LA_RAMADA = tokenDe({ org_id: 'lr', sub: 'u2' });

describe('Panel sin señal: consultas y mutaciones', () => {
  it('distingue una mutación de una consulta, aunque tenga comentarios', () => {
    expect(esMutacion({ query: 'mutation Confirmar { confirmarPedido(id: "1") { id } }' })).toBe(true);
    expect(esMutacion({ query: '  # mutation vieja\n query MisProductos { misProductos { id } }' })).toBe(false);
    expect(esMutacion({ query: '{ misProductos { id } }' })).toBe(false);
  });

  it('lo guardado de una empresa nunca se le muestra a otra', async () => {
    const consulta = { query: 'query { misProductos { id } }' };
    expect(duenoDelToken(LOS_POZOS)).toBe('lp:u1');
    expect(await claveDeConsulta(consulta, LOS_POZOS)).not.toBe(await claveDeConsulta(consulta, LA_RAMADA));
    expect(await claveDeConsulta(consulta, LOS_POZOS)).toBe(await claveDeConsulta({ ...consulta }, LOS_POZOS));
  });

  it('cambiar las variables cambia la clave guardada', async () => {
    const a = await claveDeConsulta({ query: 'query($b: String) { misProductos(busqueda: $b) { id } }', variables: { b: 'arroz' } }, LOS_POZOS);
    const b = await claveDeConsulta({ query: 'query($b: String) { misProductos(busqueda: $b) { id } }', variables: { b: 'azúcar' } }, LOS_POZOS);
    expect(a).not.toBe(b);
  });

  it('una mutación encolada le contesta a la pantalla con un mensaje claro', async () => {
    const cuerpo = await respuestaEnCola().json();
    expect(cuerpo.errors[0].extensions.code).toBe(CODIGO_EN_COLA);
    expect(cuerpo.errors[0].message).toContain('se enviará solo cuando vuelva la señal');
  });
});

describe('Panel sin señal: sincronizar la bandeja', () => {
  const mutacion = { query: 'mutation { confirmarPedido(id: "A-1042") { id } }' };

  it('al volver la señal manda cada cambio con su Idempotency-Key y el token de ahora', async () => {
    const pedidos: { url: string; init: RequestInit }[] = [];
    const pedir = (async (url: string, init: RequestInit) => {
      pedidos.push({ url, init });
      return new Response(JSON.stringify({ data: { confirmarPedido: { id: 'A-1042' } } }));
    }) as typeof fetch;
    const bandeja = new Bandeja(new AlmacenEnMemoria(), enviarAlRouter('http://router/', async () => 'nuevo', pedir), {
      generarClave: () => 'clave-1',
    });

    await bandeja.agregar('graphql.mutacion', mutacion);
    await bandeja.sincronizar();

    const cabeceras = pedidos[0].init.headers as Record<string, string>;
    expect(cabeceras['idempotency-key']).toBe('clave-1');
    expect(cabeceras.authorization).toBe('Bearer nuevo');
    expect(JSON.parse(String(pedidos[0].init.body))).toEqual(mutacion);
    expect(await bandeja.pendientes()).toEqual([]);
  });

  it('si la red se corta en medio, lo que salió queda aplicado y el resto sigue pendiente con la misma clave', async () => {
    let llamadas = 0;
    const pedir = (async () => {
      llamadas += 1;
      if (llamadas === 2) throw new TypeError('Failed to fetch');
      return new Response(JSON.stringify({ data: {} }));
    }) as typeof fetch;
    let n = 0;
    const bandeja = new Bandeja(new AlmacenEnMemoria(), enviarAlRouter('http://router/', async () => 't', pedir), {
      generarClave: () => `clave-${++n}`,
      ahora: () => new Date(2026, 9, 29, 10, n),
    });

    await bandeja.agregar('graphql.mutacion', mutacion);
    await bandeja.agregar('graphql.mutacion', mutacion);
    await bandeja.sincronizar();

    expect((await bandeja.pendientes()).map((o) => o.clave)).toEqual(['clave-2']);
  });

  it('un cambio que el servidor rechaza no se reintenta y guarda el motivo', async () => {
    const pedir = (async () => new Response(JSON.stringify({ errors: [{ message: 'El pedido ya fue confirmado' }] }))) as typeof fetch;
    const almacen = new AlmacenEnMemoria();
    const bandeja = new Bandeja(almacen, enviarAlRouter('http://router/', async () => 't', pedir));

    await bandeja.agregar('graphql.mutacion', mutacion);
    await bandeja.sincronizar();

    const [op] = await almacen.todas();
    expect(op.estado).toBe('rechazada');
    expect(op.error).toBe('El pedido ya fue confirmado');
  });
});
