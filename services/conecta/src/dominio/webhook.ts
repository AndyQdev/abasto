import { createHash, createHmac, randomBytes } from 'node:crypto';
import type { SobreDeEvento } from './aviso-de-pedido.js';

/**
 * CU-10: Conecta le avisa al e-commerce de la tienda cuando su pedido cambia. Se entrega al menos una vez:
 * quien recibe descarta repetidos con X-Abasto-Entrega y comprueba X-Abasto-Firma.
 */
export interface Webhook {
  id: string;
  orgId: string;
  url: string;
  /** Con él se firma cada envío. Se muestra una sola vez. */
  secreto: string;
  creadoEn: string;
}

export type WebhookVisible = Omit<Webhook, 'secreto'>;

export type EstadoDeEntrega = 'pendiente' | 'entregada' | 'fallida';

export interface Entrega {
  id: string;
  webhookId: string;
  orgId: string;
  url: string;
  eventoId: string;
  tipo: string;
  cuerpo: string;
  estado: EstadoDeEntrega;
  intentos: number;
  proximoEn: string | null;
  ultimoError: string | null;
  creadaEn: string;
  entregadaEn: string | null;
}

export const MAXIMO_DE_WEBHOOKS = 3;

/** Minutos de espera antes de cada reintento. Al terminarlos, la entrega queda fallida y se reenvía a mano. */
export const ESPERAS_EN_MINUTOS = [1, 5, 30, 120, 720];

export const nuevoId = () => randomBytes(8).toString('hex');
export const nuevoSecreto = () => `whs_${randomBytes(24).toString('base64url')}`;

/**
 * El id ordena por fecha y no cambia si RabbitMQ repite el evento: así no se crean dos entregas.
 * 9 caracteres en base 36 alcanzan hasta el año 5000 con milisegundos.
 */
export function idDeEntrega(ocurridoEn: Date, eventoId: string, webhookId: string): string {
  const fecha = ocurridoEn.getTime().toString(36).padStart(9, '0');
  return `${fecha}-${createHash('sha256').update(`${eventoId}|${webhookId}`).digest('hex').slice(0, 20)}`;
}

/** Firma de un envío: HMAC-SHA256 de «fecha.cuerpo». Con la fecha, un envío viejo no sirve para repetirlo. */
export const firmar = (secreto: string, fechaEnSegundos: number, cuerpo: string) =>
  `sha256=${createHmac('sha256', secreto).update(`${fechaEnSegundos}.${cuerpo}`).digest('hex')}`;

export function entregaDe(webhook: Webhook, sobre: SobreDeEvento, ahora: Date): Entrega {
  const fecha = sobre.ocurridoEn ? new Date(sobre.ocurridoEn) : ahora;
  const ocurridoEn = Number.isNaN(fecha.getTime()) ? ahora : fecha;
  const eventoId = sobre.id ?? createHash('sha256').update(JSON.stringify(sobre)).digest('hex').slice(0, 32);
  return {
    id: idDeEntrega(ocurridoEn, eventoId, webhook.id),
    webhookId: webhook.id,
    orgId: webhook.orgId,
    url: webhook.url,
    eventoId,
    tipo: sobre.tipo,
    cuerpo: JSON.stringify({ id: eventoId, tipo: sobre.tipo, ocurridoEn: ocurridoEn.toISOString(), datos: sobre.datos ?? {} }),
    estado: 'pendiente',
    intentos: 0,
    proximoEn: ahora.toISOString(),
    ultimoError: null,
    creadaEn: ahora.toISOString(),
    entregadaEn: null,
  };
}

/** Lo que queda de una entrega después de intentarla. */
export function trasIntentar(entrega: Entrega, resultado: { ok: boolean; error?: string }, ahora: Date): Entrega {
  const intentos = entrega.intentos + 1;
  if (resultado.ok) {
    return { ...entrega, estado: 'entregada', intentos, proximoEn: null, ultimoError: null, entregadaEn: ahora.toISOString() };
  }
  const espera = ESPERAS_EN_MINUTOS[intentos - 1];
  const ultimoError = resultado.error ?? 'No se pudo entregar';
  if (espera === undefined) return { ...entrega, estado: 'fallida', intentos, proximoEn: null, ultimoError };
  return { ...entrega, estado: 'pendiente', intentos, ultimoError, proximoEn: new Date(ahora.getTime() + espera * 60_000).toISOString() };
}

/** Reenviar a mano: vuelve a empezar la cuenta de reintentos. */
export const paraReenviar = (entrega: Entrega, ahora: Date): Entrega => ({
  ...entrega,
  estado: 'pendiente',
  intentos: 0,
  proximoEn: ahora.toISOString(),
  ultimoError: null,
  entregadaEn: null,
});
