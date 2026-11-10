import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeJwt, decodeProtectedHeader } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import type { Notificacion } from '../../dominio/notificacion.js';
import { crearEnviador, EnviadorFirebase, type CuentaDeServicio } from './enviador.firebase.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const cuenta: CuentaDeServicio = {
  project_id: 'abasto-prueba',
  client_email: 'firebase-adminsdk@abasto-prueba.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
};

const enCamino: Notificacion = {
  titulo: 'Tu pedido va en camino',
  cuerpo: 'Tu pedido A-1053 ya salió. Te avisamos cuando llegue.',
  canal: 'pedidos',
  etiqueta: 'pedido-p-1',
  fija: true,
  datos: { tipo: 'pedido', pedidoId: 'p-1', estado: 'DESPACHADO' },
};

const confirmado: Notificacion = {
  titulo: 'Confirmaron tu pedido',
  cuerpo: 'Tu pedido A-1053 ya está en manos del vendedor.',
  canal: 'pedidos',
  etiqueta: 'pedido-p-1',
  datos: { tipo: 'pedido', pedidoId: 'p-1', estado: 'CONFIRMADO' },
};

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

/** Google y Firebase de mentira: el primer pedido da el permiso; los demás responden lo que diga `firebase`. */
function servidores(...firebase: Response[]) {
  let i = 0;
  return vi.fn(async (url: string, _pedido?: RequestInit) => {
    if (url.includes('oauth2')) return json({ access_token: 'permiso-1', expires_in: 3600 });
    return firebase[Math.min(i++, firebase.length - 1)];
  });
}

describe('Enviador de Firebase', () => {
  it('pide permiso con un JWT firmado por la cuenta de servicio y manda el mensaje a la API v1', async () => {
    const pedir = servidores(json({ name: 'projects/abasto-prueba/messages/1' }));
    const enviador = new EnviadorFirebase(cuenta, pedir as unknown as typeof fetch);

    expect(await enviador.enviar('token-del-telefono', confirmado)).toBe('enviada');

    const [urlPermiso, pedidoPermiso] = pedir.mock.calls[0] as unknown as [string, RequestInit];
    expect(urlPermiso).toBe('https://oauth2.googleapis.com/token');
    const afirmacion = new URLSearchParams(pedidoPermiso.body as string).get('assertion')!;
    expect(decodeProtectedHeader(afirmacion)).toMatchObject({ alg: 'RS256' });
    expect(decodeJwt(afirmacion)).toMatchObject({
      iss: cuenta.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    });

    const [url, pedido] = pedir.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe('https://fcm.googleapis.com/v1/projects/abasto-prueba/messages:send');
    expect((pedido.headers as Record<string, string>).authorization).toBe('Bearer permiso-1');
    expect(JSON.parse(pedido.body as string).message).toMatchObject({
      token: 'token-del-telefono',
      notification: { title: 'Confirmaron tu pedido', body: 'Tu pedido A-1053 ya está en manos del vendedor.' },
      // `tag` también en data: con la app abierta, expo-notifications la usa como identificador y reemplaza a la anterior
      data: { tipo: 'pedido', pedidoId: 'p-1', estado: 'CONFIRMADO', tag: 'pedido-p-1' },
      android: { priority: 'HIGH', notification: { channel_id: 'pedidos', tag: 'pedido-p-1', sticky: false, notification_priority: 'PRIORITY_HIGH' } },
    });
  });

  it('«va en camino» sale como mensaje de solo datos: la app la arma fija aunque esté cerrada', async () => {
    const pedir = servidores(json({}));
    await new EnviadorFirebase(cuenta, pedir as unknown as typeof fetch).enviar('t', enCamino);
    const mensaje = JSON.parse((pedir.mock.calls[1] as unknown as [string, RequestInit])[1].body as string).message;

    // Con `notification`, Android la muestra solo y no se puede fijar. Sin ella, expo-notifications la arma con lo de
    // data: sticky → setOngoing, tag → el mismo lugar que los otros pasos, channelId → suena por «Tus pedidos».
    expect(mensaje.notification).toBeUndefined();
    expect(mensaje.android).toEqual({ priority: 'HIGH' });
    expect(mensaje.data).toEqual({
      tipo: 'pedido',
      pedidoId: 'p-1',
      estado: 'DESPACHADO',
      tag: 'pedido-p-1',
      title: 'Tu pedido va en camino',
      message: 'Tu pedido A-1053 ya salió. Te avisamos cuando llegue.',
      sticky: 'true',
      autoDismiss: 'false',
      channelId: 'pedidos',
    });
    // En iPhone (cuando haya cuenta de Apple) se ve igual como alerta
    expect(mensaje.apns.payload.aps).toMatchObject({ alert: { title: 'Tu pedido va en camino' }, 'thread-id': 'pedido-p-1' });
  });

  it('usa el mismo permiso hasta 5 minutos antes de que venza', async () => {
    let ahora = 0;
    const pedir = servidores(json({}));
    const enviador = new EnviadorFirebase(cuenta, pedir as unknown as typeof fetch, () => ahora);

    await enviador.enviar('t1', enCamino);
    ahora = 50 * 60_000;
    await enviador.enviar('t2', enCamino);
    expect(pedir.mock.calls.filter(([u]) => u.includes('oauth2'))).toHaveLength(1);

    ahora = 56 * 60_000;
    await enviador.enviar('t3', enCamino);
    expect(pedir.mock.calls.filter(([u]) => u.includes('oauth2'))).toHaveLength(2);
  });

  it('un token que ya no existe (desinstalaron la app) vuelve como token-invalido', async () => {
    const no = new EnviadorFirebase(cuenta, servidores(json({ error: { status: 'NOT_FOUND', message: 'Requested entity was not found.' } }, 404)) as unknown as typeof fetch);
    expect(await no.enviar('viejo', enCamino)).toBe('token-invalido');

    const raro = new EnviadorFirebase(
      cuenta,
      servidores(json({ error: { status: 'INVALID_ARGUMENT', message: 'The registration token is not a valid FCM registration token' } }, 400)) as unknown as typeof fetch,
    );
    expect(await raro.enviar('basura', enCamino)).toBe('token-invalido');
  });

  it('si Firebase falla un momento reintenta una vez; si sigue, queda fallida', async () => {
    const recupera = servidores(json({}, 503), json({}));
    expect(await new EnviadorFirebase(cuenta, recupera as unknown as typeof fetch).enviar('t', enCamino)).toBe('enviada');

    const sigue = servidores(json({}, 503));
    expect(await new EnviadorFirebase(cuenta, sigue as unknown as typeof fetch).enviar('t', enCamino)).toBe('fallida');
  });

  it('una promoción va por el canal de promociones, sin etiqueta ni fija', async () => {
    const pedir = servidores(json({}));
    await new EnviadorFirebase(cuenta, pedir as unknown as typeof fetch).enviar('t', {
      titulo: 'Aceite a Bs 14',
      cuerpo: 'Solo hoy',
      canal: 'promociones',
      datos: { tipo: 'promocion', promocionId: 'x', productoId: '' },
    });
    const mensaje = JSON.parse((pedir.mock.calls[1] as unknown as [string, RequestInit])[1].body as string).message;
    expect(mensaje.android.notification).toMatchObject({ channel_id: 'promociones', sticky: false, notification_priority: 'PRIORITY_DEFAULT' });
    expect(mensaje.android.notification.tag).toBeUndefined();
    expect(mensaje.data.tag).toBeUndefined();
  });
});

describe('Elegir el enviador', () => {
  it('con la cuenta de servicio usa Firebase; sin ella, modo prueba', () => {
    const carpeta = mkdtempSync(join(tmpdir(), 'firebase-'));
    const ruta = join(carpeta, 'firebase.json');
    writeFileSync(ruta, JSON.stringify(cuenta));
    expect(crearEnviador({ FIREBASE_CREDENCIALES: ruta }).modo).toBe('firebase');

    writeFileSync(ruta, '{"no":"es una cuenta"}');
    expect(crearEnviador({ FIREBASE_CREDENCIALES: ruta }).modo).toBe('prueba');
    expect(crearEnviador({ FIREBASE_CREDENCIALES: join(carpeta, 'no-existe.json') }).modo).toBe('prueba');
    expect(crearEnviador({}).modo).toBe('prueba');
  });
});
