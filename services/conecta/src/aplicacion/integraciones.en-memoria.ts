import type { LlaveDeApi } from '../dominio/llave-de-api.js';
import type { CuentasDeIntegracion, RegistroDeLlaves, RegistroDeWebhooks } from '../dominio/puertos.js';
import type { Entrega, Webhook } from '../dominio/webhook.js';

/** Para las pruebas de los casos de uso de CU-10. */
export class LlavesEnMemoria implements RegistroDeLlaves {
  readonly llaves = new Map<string, LlaveDeApi>();

  async guardar(llave: LlaveDeApi) {
    this.llaves.set(llave.id, llave);
  }
  async porId(id: string) {
    return this.llaves.get(id) ?? null;
  }
  async deOrganizacion(orgId: string) {
    return [...this.llaves.values()].filter((l) => l.orgId === orgId);
  }
  async todas() {
    return [...this.llaves.values()];
  }
  async borrar(id: string) {
    this.llaves.delete(id);
  }
  async anotarUso(id: string, cuando: string) {
    const l = this.llaves.get(id);
    if (l) this.llaves.set(id, { ...l, ultimoUsoEn: cuando });
  }
}

export class CuentasEnMemoria implements CuentasDeIntegracion {
  readonly secretos = new Map<string, { secreto: string; orgId: string }>();
  pedidosDeToken = 0;

  async crear(id: string, secreto: string, orgId: string) {
    this.secretos.set(id, { secreto, orgId });
  }
  async borrar(id: string) {
    this.secretos.delete(id);
  }
  async token(id: string, secreto: string) {
    this.pedidosDeToken++;
    const c = this.secretos.get(id);
    if (!c || c.secreto !== secreto) throw new Error('Keycloak rechazó la cuenta');
    return { token: `token-de-${c.orgId}-${this.pedidosDeToken}`, venceEnSegundos: 300 };
  }
}

export class WebhooksEnMemoria implements RegistroDeWebhooks {
  readonly webhooks = new Map<string, Webhook>();
  readonly entregas = new Map<string, Entrega>();

  async guardar(webhook: Webhook) {
    this.webhooks.set(webhook.id, webhook);
  }
  async porId(id: string) {
    return this.webhooks.get(id) ?? null;
  }
  async deOrganizacion(orgId: string) {
    return [...this.webhooks.values()].filter((w) => w.orgId === orgId);
  }
  async todos() {
    return [...this.webhooks.values()];
  }
  async borrar(id: string) {
    this.webhooks.delete(id);
  }
  async crearEntrega(entrega: Entrega) {
    if (this.entregas.has(entrega.id)) return false;
    this.entregas.set(entrega.id, entrega);
    return true;
  }
  async guardarEntrega(entrega: Entrega) {
    this.entregas.set(entrega.id, entrega);
  }
  async entregaPorId(id: string) {
    return this.entregas.get(id) ?? null;
  }
  async entregasPorReintentar(hasta: string) {
    return [...this.entregas.values()].filter((e) => e.estado === 'pendiente' && e.proximoEn !== null && e.proximoEn <= hasta);
  }
  async entregasDe(orgId: string, limite: number) {
    return [...this.entregas.values()].filter((e) => e.orgId === orgId).slice(-limite).reverse();
  }
  async ultimasEntregas(limite: number) {
    return [...this.entregas.values()].slice(-limite).reverse();
  }
}
