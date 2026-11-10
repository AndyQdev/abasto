import { afterEach, describe, expect, it, vi } from 'vitest';
import { BORRADOR_VACIO, enviarPromocion, faltaParaEnviar, textoDeEnvio, textoDeResultado } from './promociones';

vi.mock('./servicios', () => ({ URLS: { conecta: 'http://conecta' }, sesion: { token: async () => 'token-admin' } }));

afterEach(() => vi.unstubAllGlobals());

describe('Superadmin › Promociones', () => {
  it('dice qué falta antes de dejar mandarla', () => {
    const lista = { titulo: 'Aceite Fino a Bs 14', mensaje: 'Solo este fin de semana.', productoId: '' };
    expect(faltaParaEnviar(BORRADOR_VACIO, 10)).toBe('Escribe un título');
    expect(faltaParaEnviar({ ...lista, mensaje: '' }, 10)).toBe('Escribe el mensaje');
    expect(faltaParaEnviar({ ...lista, titulo: 'x'.repeat(61) }, 10)).toBe('El título va hasta 60 letras');
    expect(faltaParaEnviar(lista, 0)).toBe('Todavía nadie tiene la app con las notificaciones activadas');
    expect(faltaParaEnviar(lista, 3)).toBeNull();
  });

  it('cuenta a cuántos teléfonos llegó', () => {
    expect(textoDeResultado({ destinatarios: 42, enviadas: 42 })).toBe('Llegó a los 42 teléfonos');
    expect(textoDeResultado({ destinatarios: 42, enviadas: 41 })).toBe('Llegó a 41 de 42 teléfonos');
    expect(textoDeResultado({ destinatarios: 1, enviadas: 1 })).toBe('Llegó al único teléfono');
    expect(textoDeResultado({ destinatarios: 0, enviadas: 0 })).toBe('No había teléfonos con la app');
  });

  it('cada envío se lee en palabras', () => {
    const envio = { cuando: '', orgId: 'dr', titulo: '', cuerpo: '', canal: 'pedidos' as const, datos: {} };
    expect(textoDeEnvio({ ...envio, resultado: 'enviada' })).toBe('Enviada');
    expect(textoDeEnvio({ ...envio, resultado: 'token-invalido' })).toBe('Ya no tiene la app');
    expect(textoDeEnvio({ ...envio, resultado: 'fallida' })).toBe('No salió');
  });

  it('manda la promoción a Conecta con la sesión y su Idempotency-Key (un doble clic no la repite)', async () => {
    const pedir = vi.fn(async () => new Response(JSON.stringify({ id: 'k', titulo: 'Arroz', destinatarios: 2, enviadas: 2 }), { status: 200 }));
    vi.stubGlobal('fetch', pedir);

    await enviarPromocion({ titulo: '  Arroz en oferta ', mensaje: 'El quintal a Bs 290.', productoId: 'AB-101' }, 'clave-uuid');

    const [url, pedido] = pedir.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://conecta/v1/admin/promociones');
    expect(pedido.headers).toMatchObject({ 'idempotency-key': 'clave-uuid', authorization: 'Bearer token-admin' });
    expect(JSON.parse(pedido.body as string)).toEqual({ titulo: 'Arroz en oferta', mensaje: 'El quintal a Bs 290.', productoId: 'AB-101' });
  });

  it('si Conecta la rechaza, el motivo llega tal cual', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'El título va hasta 60 letras: en el teléfono se corta' }), { status: 400 })));
    await expect(enviarPromocion({ titulo: 'x', mensaje: 'y', productoId: '' }, 'c')).rejects.toThrow('60 letras');
  });
});
