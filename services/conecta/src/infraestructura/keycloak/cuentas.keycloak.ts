import { Injectable } from '@nestjs/common';
import type { CuentasDeIntegracion } from '../../dominio/puertos.js';

const base = () => process.env.KEYCLOAK_URL ?? 'http://localhost:8180';
const REALM = 'abasto';
const clienteDe = (id: string) => `llave-${id}`;

async function json<T>(r: Response): Promise<T> {
  const texto = await r.text();
  if (!r.ok) throw new Error(`Keycloak respondió ${r.status}: ${texto.slice(0, 200)}`);
  return (texto ? JSON.parse(texto) : null) as T;
}

/**
 * Cada llave de API es un cliente confidencial de Keycloak con su cuenta de servicio: org_id de la tienda (fijo en el
 * token), audiencia abasto-api y el rol tienda. Así Pedidos, Catálogo y Cobros no cambian: ven a la misma tienda de
 * siempre. Lo administra la cuenta `conecta-integraciones` (la crea infra/keycloak/al-dia.mjs).
 */
@Injectable()
export class CuentasKeycloak implements CuentasDeIntegracion {
  private admin: { token: string; venceEn: number } | null = null;

  async crear(id: string, secreto: string, orgId: string): Promise<void> {
    const creado = await this.pedir('/clients', {
      method: 'POST',
      body: JSON.stringify({
        clientId: clienteDe(id),
        name: `Llave de API de ${orgId}`,
        publicClient: false,
        secret: secreto,
        serviceAccountsEnabled: true,
        standardFlowEnabled: false,
        directAccessGrantsEnabled: false,
        protocolMappers: [
          {
            name: 'audiencia-api',
            protocol: 'openid-connect',
            protocolMapper: 'oidc-audience-mapper',
            config: { 'included.custom.audience': 'abasto-api', 'access.token.claim': 'true', 'id.token.claim': 'false', 'introspection.token.claim': 'true' },
          },
          {
            name: 'org_id',
            protocol: 'openid-connect',
            protocolMapper: 'oidc-hardcoded-claim-mapper',
            config: { 'claim.name': 'org_id', 'claim.value': orgId, 'jsonType.label': 'String', 'access.token.claim': 'true', 'id.token.claim': 'false', 'introspection.token.claim': 'true' },
          },
        ],
      }),
    });
    await json(creado);

    try {
      const uuid = await this.uuidDe(id);
      if (!uuid) throw new Error('Keycloak no devolvió el cliente nuevo');
      const cuenta = await json<{ id: string }>(await this.pedir(`/clients/${uuid}/service-account-user`));
      const rol = await json<{ id: string; name: string }>(await this.pedir('/roles/tienda'));
      await json(await this.pedir(`/users/${cuenta.id}/role-mappings/realm`, { method: 'POST', body: JSON.stringify([{ id: rol.id, name: rol.name }]) }));
    } catch (e) {
      await this.borrar(id).catch(() => undefined);
      throw e;
    }
  }

  async borrar(id: string): Promise<void> {
    const uuid = await this.uuidDe(id);
    if (uuid) await json(await this.pedir(`/clients/${uuid}`, { method: 'DELETE' }));
  }

  async token(id: string, secreto: string): Promise<{ token: string; venceEnSegundos: number }> {
    const r = await json<{ access_token: string; expires_in: number }>(
      await fetch(`${base()}/realms/${REALM}/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clienteDe(id), client_secret: secreto }),
      }),
    );
    return { token: r.access_token, venceEnSegundos: r.expires_in };
  }

  private async uuidDe(id: string): Promise<string | null> {
    const lista = await json<{ id: string }[]>(await this.pedir(`/clients?clientId=${encodeURIComponent(clienteDe(id))}`));
    return lista[0]?.id ?? null;
  }

  private async pedir(ruta: string, opciones: RequestInit = {}): Promise<Response> {
    const token = await this.tokenDeAdmin();
    return fetch(`${base()}/admin/realms/${REALM}${ruta}`, {
      ...opciones,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    });
  }

  private async tokenDeAdmin(): Promise<string> {
    if (this.admin && this.admin.venceEn > Date.now() + 10_000) return this.admin.token;
    const r = await json<{ access_token: string; expires_in: number }>(
      await fetch(`${base()}/realms/${REALM}/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: 'conecta-integraciones',
          client_secret: process.env.KEYCLOAK_CONECTA_SECRETO ?? 'conecta-integraciones-local',
        }),
      }),
    );
    this.admin = { token: r.access_token, venceEn: Date.now() + r.expires_in * 1000 };
    return r.access_token;
  }
}
