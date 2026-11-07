import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Propuesta } from '../../agentes/dominio/agente.js';
import { EjecutorN8n } from './ejecutor.n8n.js';

const propuesta: Propuesta = {
  id: 'p-1',
  orgId: 'lp',
  agenteId: 'catalogo',
  titulo: 'Pausar Atún',
  detalle: '',
  accion: { tipo: 'pausar_producto', datos: { productoId: 'AT-0100' } },
  estado: 'aprobada',
  creadaEn: '2026-11-03T12:00:00Z',
};

const conWebhook = () => {
  vi.stubEnv('N8N_WEBHOOK_ACCIONES', 'http://n8n/webhook/acciones-agentes');
  return new EjecutorN8n();
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Ejecutor de acciones por n8n', () => {
  it('manda la propuesta con la sesión de quien aprobó y su id como clave de idempotencia', async () => {
    const pedir = vi.fn(async () => new Response(JSON.stringify({ enviado: true, detalle: 'Atún quedó pausado' })));
    vi.stubGlobal('fetch', pedir);

    const r = await conWebhook().ejecutar(propuesta, 'token-del-mayorista');

    expect(r).toEqual({ enviado: true, detalle: 'Atún quedó pausado' });
    const [url, init] = pedir.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://n8n/webhook/acciones-agentes');
    expect(init.headers).toMatchObject({ authorization: 'Bearer token-del-mayorista', 'idempotency-key': 'p-1' });
    expect(JSON.parse(init.body as string).accion.tipo).toBe('pausar_producto');
  });

  it('devuelve el enlace que deja n8n (el WhatsApp listo para mandar)', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ enviado: true, detalle: 'listo', enlace: 'https://wa.me/?text=Hola' })));
    expect((await conWebhook().ejecutar(propuesta)).enlace).toBe('https://wa.me/?text=Hola');
  });

  it('con n8n apagado no revienta: la propuesta queda aprobada y lo dice', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('fetch failed');
    });
    const r = await conWebhook().ejecutar(propuesta);
    expect(r.enviado).toBe(false);
    expect(r.detalle).toContain('n8n no respondió');
  });

  it('sin webhook configurado no llama a nadie', async () => {
    vi.stubEnv('N8N_WEBHOOK_ACCIONES', '');
    const pedir = vi.fn();
    vi.stubGlobal('fetch', pedir);
    expect((await new EjecutorN8n().ejecutar(propuesta)).enviado).toBe(false);
    expect(pedir).not.toHaveBeenCalled();
  });
});
