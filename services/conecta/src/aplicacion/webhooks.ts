import { tiendaDelEvento, type SobreDeEvento } from '../dominio/aviso-de-pedido.js';
import { ErrorDeIntegracion } from '../dominio/llave-de-api.js';
import type { EntregadorDeWebhooks, RegistroDeWebhooks } from '../dominio/puertos.js';
import {
  entregaDe,
  firmar,
  MAXIMO_DE_WEBHOOKS,
  nuevoId,
  nuevoSecreto,
  paraReenviar,
  trasIntentar,
  type Entrega,
  type Webhook,
  type WebhookVisible,
} from '../dominio/webhook.js';

const visible = ({ secreto: _secreto, ...resto }: Webhook): WebhookVisible => resto;
/** Lo que recibe la pantalla: el cuerpo no hace falta y puede ser largo. */
export const entregaVisible = ({ cuerpo: _cuerpo, ...resto }: Entrega) => resto;

/**
 * CU-10: la tienda registra a dónde le avisamos, y Conecta reparte los pedido.* y cobro.* de esa tienda.
 * Cada aviso queda anotado antes de intentarlo: si Conecta se apaga o el otro lado está caído, se reintenta después.
 */
export class Webhooks {
  constructor(
    private readonly registro: RegistroDeWebhooks,
    private readonly entregador: EntregadorDeWebhooks,
    private readonly reloj: () => Date = () => new Date(),
  ) {}

  async registrar(orgId: string, url: unknown): Promise<{ secreto: string; datos: WebhookVisible }> {
    if (typeof url !== 'string' || !url.trim()) throw new ErrorDeIntegracion('URL_INVALIDA', 'Escribe la dirección de tu tienda');
    const motivo = await this.entregador.motivoParaRechazar(url.trim());
    if (motivo) throw new ErrorDeIntegracion('URL_INVALIDA', motivo);
    const suyos = await this.registro.deOrganizacion(orgId);
    if (suyos.length >= MAXIMO_DE_WEBHOOKS) {
      throw new ErrorDeIntegracion('DEMASIADOS_WEBHOOKS', `Puedes tener ${MAXIMO_DE_WEBHOOKS} direcciones. Borra una que ya no uses.`);
    }
    const webhook: Webhook = { id: nuevoId(), orgId, url: url.trim(), secreto: nuevoSecreto(), creadoEn: this.reloj().toISOString() };
    await this.registro.guardar(webhook);
    return { secreto: webhook.secreto, datos: visible(webhook) };
  }

  async delaOrganizacion(orgId: string): Promise<WebhookVisible[]> {
    return (await this.registro.deOrganizacion(orgId)).map(visible);
  }

  async todos(): Promise<WebhookVisible[]> {
    return (await this.registro.todos()).map(visible);
  }

  async borrar(orgId: string, id: string): Promise<void> {
    const webhook = await this.registro.porId(id);
    if (!webhook || webhook.orgId !== orgId) throw new ErrorDeIntegracion('WEBHOOK_NO_EXISTE', 'Esa dirección no existe');
    await this.registro.borrar(id);
  }

  /** Anota una entrega por cada webhook de la tienda del evento. Repetir el evento no crea otras. */
  async anotar(sobre: SobreDeEvento): Promise<Entrega[]> {
    const tienda = tiendaDelEvento(sobre);
    if (!tienda) return [];
    const webhooks = await this.registro.deOrganizacion(tienda);
    const nuevas: Entrega[] = [];
    for (const webhook of webhooks) {
      const entrega = entregaDe(webhook, sobre, this.reloj());
      if (await this.registro.crearEntrega(entrega)) nuevas.push(entrega);
    }
    return nuevas;
  }

  /** Lo intenta una vez y guarda cómo quedó. */
  async intentar(entrega: Entrega): Promise<Entrega> {
    const webhook = await this.registro.porId(entrega.webhookId);
    const ahora = this.reloj();
    // Borraron la dirección: no hay a quién avisarle
    if (!webhook) {
      const sinDestino: Entrega = { ...entrega, estado: 'fallida', proximoEn: null, ultimoError: 'La dirección ya no existe' };
      await this.registro.guardarEntrega(sinDestino);
      return sinDestino;
    }
    const fecha = Math.floor(ahora.getTime() / 1000);
    const resultado = await this.entregador.enviar(webhook.url, entrega.cuerpo, {
      'content-type': 'application/json',
      'user-agent': 'Abasto-Webhooks/1.0',
      'x-abasto-evento': entrega.tipo,
      'x-abasto-entrega': entrega.id,
      'x-abasto-fecha': String(fecha),
      'x-abasto-firma': firmar(webhook.secreto, fecha, entrega.cuerpo),
    });
    const quedo = trasIntentar(entrega, resultado, this.reloj());
    await this.registro.guardarEntrega(quedo);
    return quedo;
  }

  /** Los reintentos que ya tocan. Lo llama un revisor cada tanto. */
  async revisarPendientes(): Promise<number> {
    const toca = await this.registro.entregasPorReintentar(this.reloj().toISOString());
    await Promise.all(toca.map((e) => this.intentar(e).catch(() => undefined)));
    return toca.length;
  }

  /** «Probar» en la app: manda un aviso de prueba y dice al momento si llegó. */
  async probar(orgId: string, id: string): Promise<Entrega> {
    const webhook = await this.registro.porId(id);
    if (!webhook || webhook.orgId !== orgId) throw new ErrorDeIntegracion('WEBHOOK_NO_EXISTE', 'Esa dirección no existe');
    const ahora = this.reloj();
    const prueba = entregaDe(webhook, { id: `prueba-${nuevoId()}`, tipo: 'webhook.prueba', ocurridoEn: ahora.toISOString(), datos: { mensaje: 'Tu tienda quedó conectada con Abasto' } }, ahora);
    await this.registro.crearEntrega(prueba);
    return this.intentar(prueba);
  }

  entregasDe(orgId: string, limite = 30): Promise<Entrega[]> {
    return this.registro.entregasDe(orgId, limite);
  }

  ultimasEntregas(limite = 100): Promise<Entrega[]> {
    return this.registro.ultimasEntregas(limite);
  }

  /** Reenviar desde la app (solo lo suyo) o desde el Superadmin (orgId null). */
  async reenviar(id: string, orgId: string | null): Promise<Entrega> {
    const entrega = await this.registro.entregaPorId(id);
    if (!entrega || (orgId !== null && entrega.orgId !== orgId)) throw new ErrorDeIntegracion('ENTREGA_NO_EXISTE', 'Ese aviso no existe');
    if (entrega.estado === 'entregada') throw new ErrorDeIntegracion('ENTREGA_YA_LLEGO', 'Ese aviso ya llegó');
    return this.intentar(paraReenviar(entrega, this.reloj()));
  }
}
