import { existsSync, readFileSync } from 'node:fs';
import { Logger } from '@nestjs/common';
import { importPKCS8, SignJWT } from 'jose';
import type { Notificacion, ResultadoDeEnvio } from '../../dominio/notificacion.js';
import type { EnviadorDeNotificaciones } from '../../dominio/puertos.js';

/** La cuenta de servicio de Firebase (Configuración del proyecto › Cuentas de servicio › Generar clave privada). */
export interface CuentaDeServicio {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

type Pedir = typeof fetch;

const ALCANCE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
/** El permiso de Google dura una hora; se renueva 5 minutos antes. */
const MARGEN_MS = 5 * 60_000;

/**
 * Manda notificaciones con Firebase Cloud Messaging (API HTTP v1), sin el SDK de Firebase: firma un JWT con la
 * cuenta de servicio, lo cambia por un permiso de una hora y llama a `messages:send` por cada teléfono.
 *
 * En Android:
 * - `tag` hace que el estado nuevo de un pedido reemplace al anterior (una notificación por pedido, como las apps
 *   de delivery);
 * - `sticky` deja el «va en camino» a la vista aunque se toque;
 * - el canal lo crea la app («Pedidos» suena y vibra; «Promociones» se puede silenciar aparte).
 */
export class EnviadorFirebase implements EnviadorDeNotificaciones {
  readonly modo = 'firebase' as const;
  private readonly log = new Logger(EnviadorFirebase.name);
  private permiso: { valor: string; venceEn: number } | null = null;

  constructor(
    private readonly cuenta: CuentaDeServicio,
    private readonly pedir: Pedir = fetch,
    private readonly ahora: () => number = Date.now,
  ) {}

  async enviar(token: string, n: Notificacion): Promise<ResultadoDeEnvio> {
    const cuerpo = JSON.stringify({ message: mensajeDeFirebase(token, n) });
    for (let intento = 1; intento <= 2; intento++) {
      const r = await this.pedir(`https://fcm.googleapis.com/v1/projects/${this.cuenta.project_id}/messages:send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${await this.permisoVigente()}` },
        body: cuerpo,
      });
      if (r.ok) return 'enviada';
      const error = ((await r.json().catch(() => ({}))) as { error?: { status?: string; message?: string } }).error;
      if (r.status === 404 || (r.status === 400 && /registration token/i.test(error?.message ?? ''))) return 'token-invalido';
      if (r.status === 401) this.permiso = null; // el permiso venció antes de tiempo: se pide otro
      if ((r.status === 401 || r.status === 429 || r.status >= 500) && intento === 1) {
        await new Promise((listo) => setTimeout(listo, 400));
        continue;
      }
      this.log.warn(`Firebase respondió ${r.status} ${error?.status ?? ''}: ${error?.message ?? 'sin detalle'}`);
      return 'fallida';
    }
    return 'fallida';
  }

  /** Un permiso de Google (OAuth) firmado con la cuenta de servicio; se guarda hasta 5 minutos antes de vencer. */
  private async permisoVigente(): Promise<string> {
    if (this.permiso && this.permiso.venceEn - MARGEN_MS > this.ahora()) return this.permiso.valor;
    const uri = this.cuenta.token_uri ?? TOKEN_URI;
    const llave = await importPKCS8(this.cuenta.private_key, 'RS256');
    const segundos = Math.floor(this.ahora() / 1000);
    const afirmacion = await new SignJWT({ scope: ALCANCE })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(this.cuenta.client_email)
      .setAudience(uri)
      .setIssuedAt(segundos)
      .setExpirationTime(segundos + 3600)
      .sign(llave);
    const r = await this.pedir(uri, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: afirmacion }).toString(),
    });
    if (!r.ok) throw new Error(`Google no dio permiso para Firebase (${r.status}): revisa la cuenta de servicio`);
    const { access_token, expires_in } = (await r.json()) as { access_token: string; expires_in: number };
    this.permiso = { valor: access_token, venceEn: this.ahora() + expires_in * 1000 };
    return access_token;
  }
}

/** El mensaje tal como lo pide la API v1 de Firebase. */
export function mensajeDeFirebase(token: string, n: Notificacion) {
  return {
    token,
    notification: { title: n.titulo, body: n.cuerpo },
    data: n.datos,
    android: {
      priority: 'HIGH',
      notification: {
        channel_id: n.canal,
        ...(n.etiqueta ? { tag: n.etiqueta } : {}),
        sticky: Boolean(n.fija),
        notification_priority: n.canal === 'pedidos' ? 'PRIORITY_HIGH' : 'PRIORITY_DEFAULT',
        default_sound: true,
        default_vibrate_timings: true,
        visibility: 'PUBLIC',
      },
    },
    apns: { payload: { aps: { sound: 'default', ...(n.etiqueta ? { 'thread-id': n.etiqueta } : {}) } } },
  };
}

/** Sin la cuenta de Firebase: se anota en el registro y no sale a ningún teléfono. Así se puede probar todo lo demás. */
export class EnviadorSinFirebase implements EnviadorDeNotificaciones {
  readonly modo = 'prueba' as const;
  private readonly log = new Logger('Notificaciones');

  async enviar(token: string, n: Notificacion): Promise<ResultadoDeEnvio> {
    this.log.log(`[sin Firebase] ${n.titulo} → …${token.slice(-6)}`);
    return 'enviada';
  }
}

/**
 * Lee la cuenta de servicio de `FIREBASE_CREDENCIALES` (en Docker, `.firebase/firebase.json` montado en /secretos).
 * Si no está o no se puede leer, Conecta sigue funcionando en modo prueba y lo dice al arrancar.
 */
export function crearEnviador(env: NodeJS.ProcessEnv = process.env): EnviadorDeNotificaciones {
  const ruta = env.FIREBASE_CREDENCIALES;
  const log = new Logger('Notificaciones');
  if (ruta && existsSync(ruta)) {
    try {
      const cuenta = JSON.parse(readFileSync(ruta, 'utf8')) as CuentaDeServicio;
      if (cuenta.project_id && cuenta.client_email && cuenta.private_key) {
        log.log(`Notificaciones push con Firebase (proyecto ${cuenta.project_id})`);
        return new EnviadorFirebase(cuenta);
      }
    } catch {
      // cae al modo prueba
    }
    log.warn(`${ruta} no es una cuenta de servicio de Firebase: las notificaciones quedan en modo prueba`);
  } else {
    log.warn(
      ruta
        ? `No está ${ruta} (la cuenta de servicio de Firebase): las notificaciones push quedan en modo prueba (se anotan, no salen)`
        : 'Sin FIREBASE_CREDENCIALES: las notificaciones push quedan en modo prueba (se anotan, no salen)',
    );
  }
  return new EnviadorSinFirebase();
}
