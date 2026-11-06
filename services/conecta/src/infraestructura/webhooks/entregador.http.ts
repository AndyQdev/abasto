import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { Injectable } from '@nestjs/common';
import type { EntregadorDeWebhooks } from '../../dominio/puertos.js';

const ESPERA_MS = 5000;

/** Direcciones internas: un webhook nunca puede apuntar a ellas (la red de Docker, la metadata de la nube, etc.). */
const INTERNAS = new BlockList();
for (const [red, largo] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4]] as const) {
  INTERNAS.addSubnet(red, largo, 'ipv4');
}
for (const [red, largo] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const) {
  INTERNAS.addSubnet(red, largo, 'ipv6');
}

function esInterna(direccion: string): boolean {
  // Una IPv4 escrita como IPv6 («::ffff:10.0.0.1») sigue siendo interna
  const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(direccion)?.[1];
  if (v4) return INTERNAS.check(v4, 'ipv4');
  return INTERNAS.check(direccion, isIP(direccion) === 6 ? 'ipv6' : 'ipv4');
}

export type Resolver = (host: string) => Promise<{ address: string }[]>;

/**
 * El motivo para no aceptar una dirección, o null si sirve. Solo https y nunca una dirección interna, también si el
 * nombre apunta a una. Con WEBHOOKS_PERMITIR_LOCAL=si acepta lo local, para desarrollo y las pruebas.
 */
export async function motivoParaRechazar(url: string, permitirLocal: boolean, resolver: Resolver = (h) => lookup(h, { all: true })): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return 'Esa dirección no se entiende. Tiene que empezar con https://';
  }
  if (u.username || u.password) return 'La dirección no puede llevar usuario ni contraseña';
  if (permitirLocal) return u.protocol === 'https:' || u.protocol === 'http:' ? null : 'Tiene que empezar con https://';
  if (u.protocol !== 'https:') return 'Tiene que empezar con https://';
  const host = u.hostname.replace(/^\[|\]$/g, '');
  let direcciones: string[];
  try {
    direcciones = isIP(host) ? [host] : (await resolver(host)).map((d) => d.address);
  } catch {
    return `No encontramos ${host}. Revisa que esté bien escrita`;
  }
  if (!direcciones.length || direcciones.some(esInterna)) return 'Esa dirección no se puede usar: tiene que ser pública';
  return null;
}

/** Hace el envío de verdad. No sigue redirecciones: un destino público no puede mandarnos a uno interno. */
@Injectable()
export class EntregadorHttp implements EntregadorDeWebhooks {
  private readonly permitirLocal = process.env.WEBHOOKS_PERMITIR_LOCAL === 'si';

  motivoParaRechazar(url: string) {
    return motivoParaRechazar(url, this.permitirLocal);
  }

  async enviar(url: string, cuerpo: string, cabeceras: Record<string, string>) {
    // Se revisa también aquí: el nombre pudo cambiar de dirección después de registrarlo
    const motivo = await this.motivoParaRechazar(url);
    if (motivo) return { ok: false, error: motivo };
    try {
      const r = await fetch(url, { method: 'POST', headers: cabeceras, body: cuerpo, redirect: 'manual', signal: AbortSignal.timeout(ESPERA_MS) });
      await r.body?.cancel().catch(() => undefined);
      return r.ok ? { ok: true } : { ok: false, error: `Respondió ${r.status}` };
    } catch (e) {
      return { ok: false, error: (e as Error).name === 'TimeoutError' ? 'No respondió en 5 segundos' : 'No se pudo conectar' };
    }
  }
}
