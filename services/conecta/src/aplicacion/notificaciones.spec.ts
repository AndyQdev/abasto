import { describe, expect, it } from 'vitest';
import { notificacionDePedido } from '../dominio/notificacion.js';
import { Notificaciones } from './notificaciones.js';
import { AvisosEnMemoria, DispositivosEnMemoria, EnviadorDePrueba, PromocionesEnMemoria } from './notificaciones.en-memoria.js';

const TOKEN_ROSA = 'fcm-token-de-dona-rosa-0123456789';
const TOKEN_ROSA_2 = 'fcm-token-de-dona-rosa-tablet-9876';
const TOKEN_CRUCE = 'fcm-token-de-el-cruce-555555555555';

function montar() {
  const dispositivos = new DispositivosEnMemoria();
  const enviador = new EnviadorDePrueba();
  const promociones = new PromocionesEnMemoria();
  const notificaciones = new Notificaciones(dispositivos, enviador, promociones, new AvisosEnMemoria(), () => new Date('2026-11-10T14:00:00Z'));
  return { dispositivos, enviador, promociones, notificaciones };
}

const evento = (tipo: string, extra: Record<string, unknown> = {}) => ({
  id: `ev-${tipo}`,
  tipo,
  orgId: 'abasto',
  datos: { pedidoId: 'p-1', codigo: 'A-1053', tiendaId: 'dr', mayoristaId: 'abasto', ...extra },
});

describe('Qué se le dice a la tienda', () => {
  it('cada paso del pedido tiene su mensaje y todos van con la misma etiqueta (uno reemplaza al otro)', () => {
    const pasos = ['pedido.confirmado', 'pedido.en_preparacion', 'pedido.despachado', 'pedido.entregado'].map((t) => notificacionDePedido(evento(t)));
    expect(pasos.map((p) => p?.notificacion.titulo)).toEqual([
      'Confirmaron tu pedido',
      'Están preparando tu pedido',
      'Tu pedido va en camino',
      '¡Llegó tu pedido!',
    ]);
    expect(new Set(pasos.map((p) => p?.notificacion.etiqueta))).toEqual(new Set(['pedido-p-1']));
    expect(pasos.map((p) => p?.tiendaId)).toEqual(['dr', 'dr', 'dr', 'dr']);
  });

  it('solo «en camino» queda fija', () => {
    expect(notificacionDePedido(evento('pedido.despachado'))?.notificacion).toMatchObject({
      fija: true,
      cuerpo: 'Tu pedido A-1053 ya salió. Te avisamos cuando llegue.',
      datos: { tipo: 'pedido', pedidoId: 'p-1', codigo: 'A-1053', estado: 'DESPACHADO', evento: 'pedido.despachado' },
    });
    expect(notificacionDePedido(evento('pedido.entregado'))?.notificacion.fija).toBe(false);
  });

  it('lo que no le cambia nada a la tienda no avisa', () => {
    for (const tipo of ['pedido.creado', 'stock.reservado', 'cobro.qr_generado', 'cobro.credito_autorizado']) {
      expect(notificacionDePedido(evento(tipo))).toBeNull();
    }
    expect(notificacionDePedido({ tipo: 'pedido.confirmado', datos: { pedidoId: 'p-1' } })).toBeNull();
  });

  it('el pago con QR avisa aunque Cobros no mande el código', () => {
    const n = notificacionDePedido({ id: 'x', tipo: 'cobro.qr_pagado', correlationId: 'p-9', datos: { tiendaId: 'dr' } });
    expect(n?.notificacion).toMatchObject({ titulo: 'Recibimos tu pago', cuerpo: 'Tu pedido: el pago con QR quedó confirmado.', etiqueta: 'pedido-p-9' });
  });
});

describe('Notificaciones de los pedidos', () => {
  it('un cambio de estado llega a todos los teléfonos de esa tienda y a ningún otro', async () => {
    const { notificaciones, enviador } = montar();
    await notificaciones.registrar({ id: 'u-rosa', orgId: 'dr' }, { token: TOKEN_ROSA, plataforma: 'android' });
    await notificaciones.registrar({ id: 'u-rosa', orgId: 'dr' }, { token: TOKEN_ROSA_2, plataforma: 'android' });
    await notificaciones.registrar({ id: 'u-cruce', orgId: 'ec' }, { token: TOKEN_CRUCE, plataforma: 'android' });

    expect(await notificaciones.avisarEvento(evento('pedido.despachado'))).toBe(2);
    expect(enviador.enviadas.map((e) => e.token).sort()).toEqual([TOKEN_ROSA, TOKEN_ROSA_2].sort());
  });

  it('si RabbitMQ entrega el mismo evento otra vez, no se avisa dos veces', async () => {
    const { notificaciones, enviador } = montar();
    await notificaciones.registrar({ id: 'u-rosa', orgId: 'dr' }, { token: TOKEN_ROSA, plataforma: 'android' });

    await notificaciones.avisarEvento(evento('pedido.confirmado'));
    await notificaciones.avisarEvento(evento('pedido.confirmado'));
    expect(enviador.enviadas).toHaveLength(1);
  });

  it('un token que Firebase ya no reconoce (desinstalaron la app) se borra', async () => {
    const { notificaciones, enviador, dispositivos } = montar();
    await notificaciones.registrar({ id: 'u-rosa', orgId: 'dr' }, { token: TOKEN_ROSA, plataforma: 'android' });
    enviador.respuestas.set(TOKEN_ROSA, 'token-invalido');

    expect(await notificaciones.avisarEvento(evento('pedido.entregado'))).toBe(0);
    expect(dispositivos.filas.has(TOKEN_ROSA)).toBe(false);
    expect((await notificaciones.resumen()).recientes[0]).toMatchObject({ orgId: 'dr', resultado: 'token-invalido' });
  });

  it('un teléfono que pasa a otra cuenta deja de recibir lo de la anterior', async () => {
    const { notificaciones, enviador } = montar();
    await notificaciones.registrar({ id: 'u-rosa', orgId: 'dr' }, { token: TOKEN_ROSA, plataforma: 'android' });
    await notificaciones.registrar({ id: 'u-cruce', orgId: 'ec' }, { token: TOKEN_ROSA, plataforma: 'android' });

    await notificaciones.avisarEvento(evento('pedido.confirmado'));
    expect(enviador.enviadas).toHaveLength(0);
  });

  it('al cerrar sesión se quita el teléfono, pero otra empresa no puede quitarlo', async () => {
    const { notificaciones, dispositivos } = montar();
    await notificaciones.registrar({ id: 'u-rosa', orgId: 'dr' }, { token: TOKEN_ROSA, plataforma: 'android' });

    await notificaciones.quitar({ id: 'otro', orgId: 'ec' }, TOKEN_ROSA);
    expect(dispositivos.filas.has(TOKEN_ROSA)).toBe(true);
    await notificaciones.quitar({ id: 'u-rosa', orgId: 'dr' }, TOKEN_ROSA);
    expect(dispositivos.filas.has(TOKEN_ROSA)).toBe(false);
  });

  it('rechaza tokens raros y sesiones sin empresa', async () => {
    const { notificaciones } = montar();
    await expect(notificaciones.registrar({ id: 'u', orgId: 'dr' }, { token: 'corto', plataforma: 'android' })).rejects.toThrow('token válido');
    await expect(notificaciones.registrar({ id: 'u', orgId: 'dr' }, { token: TOKEN_ROSA, plataforma: 'windows' })).rejects.toThrow('android o ios');
    await expect(notificaciones.registrar({ id: 'u', orgId: '' }, { token: TOKEN_ROSA, plataforma: 'android' })).rejects.toThrow('empresa');
  });
});

describe('Promociones', () => {
  it('una promoción llega a todos los teléfonos con la app y se anota cuántas salieron', async () => {
    const { notificaciones, enviador } = montar();
    await notificaciones.registrar({ id: 'u-rosa', orgId: 'dr' }, { token: TOKEN_ROSA, plataforma: 'android' });
    await notificaciones.registrar({ id: 'u-cruce', orgId: 'ec' }, { token: TOKEN_CRUCE, plataforma: 'android' });
    enviador.respuestas.set(TOKEN_CRUCE, 'fallida');

    const p = await notificaciones.crearPromocion({ id: 'admin', orgId: 'abasto' }, 'clave-1', {
      titulo: 'Aceite Fino a Bs 14',
      mensaje: 'Solo este fin de semana, la caja de 12.',
      productoId: 'AB-101',
    });

    expect(p).toMatchObject({ id: 'clave-1', destinatarios: 2, enviadas: 1, fallidas: 1, productoId: 'AB-101' });
    expect(enviador.enviadas[0].notificacion).toMatchObject({
      canal: 'promociones',
      datos: { tipo: 'promocion', promocionId: 'clave-1', productoId: 'AB-101' },
    });
    expect(await notificaciones.ultimasPromociones()).toEqual([p]);
  });

  it('con la misma clave (doble clic) no se manda otra vez', async () => {
    const { notificaciones, enviador } = montar();
    await notificaciones.registrar({ id: 'u-rosa', orgId: 'dr' }, { token: TOKEN_ROSA, plataforma: 'android' });
    const entrada = { titulo: 'Arroz en oferta', mensaje: 'El quintal a Bs 290.' };

    const primera = await notificaciones.crearPromocion({ id: 'admin', orgId: 'abasto' }, 'clave-2', entrada);
    const segunda = await notificaciones.crearPromocion({ id: 'admin', orgId: 'abasto' }, 'clave-2', entrada);
    expect(enviador.enviadas).toHaveLength(1);
    expect(segunda).toEqual(primera);
  });

  it.each([
    [{ titulo: 'ab', mensaje: 'Un mensaje' }, 'título'],
    [{ titulo: 'x'.repeat(61), mensaje: 'Un mensaje' }, '60 letras'],
    [{ titulo: 'Oferta', mensaje: '' }, 'mensaje'],
    [{ titulo: 'Oferta', mensaje: 'Un mensaje', productoId: 'aceite' }, 'AB-101'],
  ])('valida la promoción antes de mandarla (%o)', async (entrada, error) => {
    const { notificaciones, enviador } = montar();
    await expect(notificaciones.crearPromocion({ id: 'admin', orgId: 'abasto' }, 'c', entrada)).rejects.toThrow(error);
    expect(enviador.enviadas).toHaveLength(0);
  });
});
