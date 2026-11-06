import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ESPERAS_EN_MINUTOS, type Entrega } from '../dominio/webhook.js';
import { leerLlave } from '../dominio/llave-de-api.js';
import { CuentasEnMemoria, LlavesEnMemoria, WebhooksEnMemoria } from './integraciones.en-memoria.js';
import { LlavesDeApi } from './llaves-de-api.js';
import { Webhooks } from './webhooks.js';

function armarLlaves() {
  let ahora = new Date('2026-11-06T12:00:00Z');
  const registro = new LlavesEnMemoria();
  const cuentas = new CuentasEnMemoria();
  return { registro, cuentas, llaves: new LlavesDeApi(registro, cuentas, () => ahora), avanzar: (ms: number) => (ahora = new Date(ahora.getTime() + ms)) };
}

describe('CU-10 · Llaves de API', () => {
  it('muestra el secreto una sola vez y guarda solo su huella', async () => {
    const { llaves, registro } = armarLlaves();
    const { llave, datos } = await llaves.crear('dr', 'Mi WooCommerce');
    const leida = leerLlave(llave);
    if (!leida) throw new Error('La llave no se puede leer');
    expect(JSON.stringify([...registro.llaves.values()])).not.toContain(leida.secreto);
    expect(JSON.stringify(datos)).not.toContain(leida.secreto);
    expect(datos).not.toHaveProperty('huella');
    expect(datos).toMatchObject({ nombre: 'Mi WooCommerce', orgId: 'dr', termina: leida.secreto.slice(-4) });
  });

  it('con la llave correcta da el token de la tienda', async () => {
    const { llaves } = armarLlaves();
    const { llave } = await llaves.crear('dr', 'Mi tienda');
    expect(await llaves.autenticar(llave)).toContain('token-de-dr');
  });

  it('rechaza una llave inventada, con otro secreto o de otro formato', async () => {
    const { llaves } = armarLlaves();
    const { llave } = await llaves.crear('dr', 'Mi tienda');
    expect(await llaves.autenticar(`${llave.slice(0, -2)}xy`)).toBeNull();
    expect(await llaves.autenticar('abk_000000000000_aaaaaaaaaaaaaaaaaaaaaaaaaa')).toBeNull();
    expect(await llaves.autenticar('cualquier-cosa')).toBeNull();
  });

  it('reutiliza el token hasta que está por vencer', async () => {
    const { llaves, cuentas, avanzar } = armarLlaves();
    const { llave } = await llaves.crear('dr', 'Mi tienda');
    await llaves.autenticar(llave);
    await llaves.autenticar(llave);
    expect(cuentas.pedidosDeToken).toBe(1);
    avanzar(280_000);
    await llaves.autenticar(llave);
    expect(cuentas.pedidosDeToken).toBe(2);
  });

  it('una llave revocada deja de servir al momento, aunque tuviera un token guardado', async () => {
    const { llaves, cuentas } = armarLlaves();
    const { llave, datos } = await llaves.crear('dr', 'Mi tienda');
    await llaves.autenticar(llave);
    await llaves.revocar('dr', datos.id);
    expect(await llaves.autenticar(llave)).toBeNull();
    expect(cuentas.secretos.size).toBe(0);
  });

  it('una tienda no puede revocar ni ver la llave de otra', async () => {
    const { llaves } = armarLlaves();
    const { datos } = await llaves.crear('dr', 'Mi tienda');
    await expect(llaves.revocar('otra', datos.id)).rejects.toMatchObject({ codigo: 'LLAVE_NO_EXISTE' });
    expect(await llaves.delaOrganizacion('otra')).toEqual([]);
  });

  it('pide un nombre y limita la cantidad de llaves', async () => {
    const { llaves } = armarLlaves();
    await expect(llaves.crear('dr', ' ')).rejects.toMatchObject({ codigo: 'NOMBRE_INVALIDO' });
    for (let i = 0; i < 5; i++) await llaves.crear('dr', `Llave ${i}`);
    await expect(llaves.crear('dr', 'Una más')).rejects.toMatchObject({ codigo: 'DEMASIADAS_LLAVES' });
  });

  it('si no se puede guardar, no deja una cuenta suelta en Keycloak', async () => {
    const { registro, cuentas, llaves } = armarLlaves();
    registro.guardar = async () => {
      throw new Error('DynamoDB no responde');
    };
    await expect(llaves.crear('dr', 'Mi tienda')).rejects.toThrow('DynamoDB');
    expect(cuentas.secretos.size).toBe(0);
  });
});

const SOBRE = {
  id: 'evento-1',
  tipo: 'pedido.confirmado',
  ocurridoEn: '2026-11-06T12:00:00.000Z',
  datos: { tiendaId: 'dr', pedidoId: 'p1', codigo: 'A-1' },
};

function armarWebhooks(responde: { ok: boolean; error?: string } = { ok: true }) {
  let ahora = new Date('2026-11-06T12:00:00Z');
  const registro = new WebhooksEnMemoria();
  const enviados: { url: string; cuerpo: string; cabeceras: Record<string, string> }[] = [];
  const entregador = {
    resultado: responde,
    motivo: null as string | null,
    async motivoParaRechazar() {
      return this.motivo;
    },
    async enviar(url: string, cuerpo: string, cabeceras: Record<string, string>) {
      enviados.push({ url, cuerpo, cabeceras });
      return this.resultado;
    },
  };
  return { registro, enviados, entregador, webhooks: new Webhooks(registro, entregador, () => ahora), avanzar: (min: number) => (ahora = new Date(ahora.getTime() + min * 60_000)) };
}

describe('CU-10 · Webhooks', () => {
  it('avisa a la tienda del evento, firmado con su secreto', async () => {
    const { webhooks, enviados } = armarWebhooks();
    const { secreto } = await webhooks.registrar('dr', 'https://mitienda.bo/abasto');
    const [entrega] = await webhooks.anotar(SOBRE);
    await webhooks.intentar(entrega as Entrega);

    const envio = enviados[0];
    if (!envio) throw new Error('No se envió');
    expect(envio.url).toBe('https://mitienda.bo/abasto');
    expect(JSON.parse(envio.cuerpo)).toMatchObject({ id: 'evento-1', tipo: 'pedido.confirmado', datos: { codigo: 'A-1' } });
    const fecha = envio.cabeceras['x-abasto-fecha'];
    expect(envio.cabeceras['x-abasto-firma']).toBe(`sha256=${createHmac('sha256', secreto).update(`${fecha}.${envio.cuerpo}`).digest('hex')}`);
  });

  it('no le avisa a otra tienda ni avisa eventos sin tienda', async () => {
    const { webhooks } = armarWebhooks();
    await webhooks.registrar('otra', 'https://otra.bo/abasto');
    expect(await webhooks.anotar(SOBRE)).toEqual([]);
    expect(await webhooks.anotar({ ...SOBRE, datos: {} })).toEqual([]);
    expect(await webhooks.anotar({ ...SOBRE, tipo: 'stock.reservado' })).toEqual([]);
  });

  it('si RabbitMQ repite el evento no crea otra entrega', async () => {
    const { webhooks } = armarWebhooks();
    await webhooks.registrar('dr', 'https://mitienda.bo/abasto');
    expect(await webhooks.anotar(SOBRE)).toHaveLength(1);
    expect(await webhooks.anotar(SOBRE)).toEqual([]);
  });

  it('si falla reintenta con esperas cada vez mayores y al final queda fallida', async () => {
    const { webhooks, registro, avanzar, enviados } = armarWebhooks({ ok: false, error: 'Respondió 500' });
    await webhooks.registrar('dr', 'https://mitienda.bo/abasto');
    const [nueva] = await webhooks.anotar(SOBRE);
    const id = (nueva as Entrega).id;
    await webhooks.intentar(nueva as Entrega);
    expect(registro.entregas.get(id)).toMatchObject({ estado: 'pendiente', intentos: 1, ultimoError: 'Respondió 500' });

    // Antes de la primera espera no toca
    expect(await webhooks.revisarPendientes()).toBe(0);
    for (const espera of ESPERAS_EN_MINUTOS) {
      avanzar(espera);
      expect(await webhooks.revisarPendientes()).toBe(1);
    }
    expect(registro.entregas.get(id)).toMatchObject({ estado: 'fallida', proximoEn: null });
    expect(enviados).toHaveLength(ESPERAS_EN_MINUTOS.length + 1);
    avanzar(100_000);
    expect(await webhooks.revisarPendientes()).toBe(0);
  });

  it('una entrega fallida se reenvía a mano y, si llega, queda entregada', async () => {
    const { webhooks, registro, entregador } = armarWebhooks({ ok: false, error: 'caído' });
    await webhooks.registrar('dr', 'https://mitienda.bo/abasto');
    const [nueva] = await webhooks.anotar(SOBRE);
    const id = (nueva as Entrega).id;
    await registro.guardarEntrega({ ...(nueva as Entrega), estado: 'fallida', proximoEn: null });
    entregador.resultado = { ok: true };

    await expect(webhooks.reenviar(id, 'otra')).rejects.toMatchObject({ codigo: 'ENTREGA_NO_EXISTE' });
    expect(await webhooks.reenviar(id, null)).toMatchObject({ estado: 'entregada' });
    await expect(webhooks.reenviar(id, 'dr')).rejects.toMatchObject({ codigo: 'ENTREGA_YA_LLEGO' });
  });

  it('rechaza la dirección que el entregador no permite y limita la cantidad', async () => {
    const { webhooks, entregador } = armarWebhooks();
    entregador.motivo = 'Tiene que empezar con https://';
    await expect(webhooks.registrar('dr', 'http://169.254.169.254')).rejects.toMatchObject({ codigo: 'URL_INVALIDA', message: 'Tiene que empezar con https://' });
    entregador.motivo = null;
    for (let i = 0; i < 3; i++) await webhooks.registrar('dr', `https://mitienda.bo/${i}`);
    await expect(webhooks.registrar('dr', 'https://mitienda.bo/4')).rejects.toMatchObject({ codigo: 'DEMASIADOS_WEBHOOKS' });
  });

  it('el secreto no sale en las listas', async () => {
    const { webhooks } = armarWebhooks();
    const { secreto, datos } = await webhooks.registrar('dr', 'https://mitienda.bo/abasto');
    expect(JSON.stringify(datos)).not.toContain(secreto);
    expect(JSON.stringify(await webhooks.delaOrganizacion('dr'))).not.toContain(secreto);
    expect(JSON.stringify(await webhooks.todos())).not.toContain(secreto);
  });

  it('«Probar» dice al momento si llegó; una tienda no prueba la dirección de otra', async () => {
    const { webhooks, enviados } = armarWebhooks();
    const { datos } = await webhooks.registrar('dr', 'https://mitienda.bo/abasto');
    expect(await webhooks.probar('dr', datos.id)).toMatchObject({ estado: 'entregada', tipo: 'webhook.prueba' });
    expect(enviados).toHaveLength(1);
    await expect(webhooks.probar('otra', datos.id)).rejects.toMatchObject({ codigo: 'WEBHOOK_NO_EXISTE' });
  });

  it('si borraron la dirección, lo que estaba por reintentarse queda fallido sin enviar', async () => {
    const { webhooks, enviados } = armarWebhooks();
    const { datos } = await webhooks.registrar('dr', 'https://mitienda.bo/abasto');
    const [nueva] = await webhooks.anotar(SOBRE);
    await webhooks.borrar('dr', datos.id);
    expect(await webhooks.intentar(nueva as Entrega)).toMatchObject({ estado: 'fallida', ultimoError: 'La dirección ya no existe' });
    expect(enviados).toEqual([]);
  });
});
