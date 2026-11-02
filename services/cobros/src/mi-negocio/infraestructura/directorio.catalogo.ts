import { Logger } from '@nestjs/common';
import type { DatosDeProducto } from '../dominio/compra-entregada.js';
import type { DirectorioDeProductos } from '../dominio/puertos.js';

const ENTIDADES = `query($r: [_Any!]!) { _entities(representations: $r) { ... on Producto { id nombre rubro } } }`;

/**
 * Nombre y rubro de los productos: se los pide al subgrafo de Catálogo con `_entities` (lo mismo que hace el Router),
 * con el token de la cuenta de servicio `cobros-servicio` (la crea infra/keycloak/al-dia.mjs). Catálogo pide sesión
 * para ver productos. Guarda en memoria lo que ya conoce y renueva el token antes de que venza. Si Catálogo no
 * responde, devuelve lo que tenga: el artículo queda con el código como nombre y el teléfono lo completa.
 */
export class DirectorioCatalogo implements DirectorioDeProductos {
  private readonly log = new Logger(DirectorioCatalogo.name);
  private readonly conocidos = new Map<string, DatosDeProducto>();
  private token: { valor: string; vence: number } | null = null;

  constructor(
    private readonly catalogo = process.env.CATALOGO_URL ?? 'http://localhost:8082/graphql',
    private readonly keycloak = process.env.KEYCLOAK_URL ?? 'http://localhost:8180',
    private readonly secreto = process.env.KEYCLOAK_COBROS_SECRETO ?? 'cobros-servicio-local',
    private readonly pedir: typeof fetch = fetch,
  ) {}

  async datos(ids: string[]): Promise<Map<string, DatosDeProducto>> {
    const faltan = [...new Set(ids)].filter((id) => !this.conocidos.has(id));
    if (faltan.length) await this.buscar(faltan);
    return new Map(ids.filter((id) => this.conocidos.has(id)).map((id) => [id, this.conocidos.get(id)!]));
  }

  private async sesion(): Promise<string> {
    if (this.token && this.token.vence > Date.now() + 30_000) return this.token.valor;
    const r = await this.pedir(`${this.keycloak}/realms/abasto/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: 'cobros-servicio', client_secret: this.secreto }),
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) throw new Error(`Keycloak no dio la sesión de servicio (${r.status})`);
    const t = (await r.json()) as { access_token: string; expires_in: number };
    this.token = { valor: t.access_token, vence: Date.now() + t.expires_in * 1000 };
    return t.access_token;
  }

  private async buscar(ids: string[]): Promise<void> {
    try {
      const respuesta = await this.pedir(this.catalogo, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${await this.sesion()}` },
        body: JSON.stringify({ query: ENTIDADES, variables: { r: ids.map((id) => ({ __typename: 'Producto', id })) } }),
        signal: AbortSignal.timeout(3000),
      });
      const cuerpo = (await respuesta.json()) as { data?: { _entities?: ({ id: string; nombre: string; rubro: string | null } | null)[] }; errors?: { message: string }[] };
      if (cuerpo.errors?.length) this.log.warn(`Catálogo respondió con errores: ${cuerpo.errors.map((e) => e.message).join('; ')}`);
      for (const p of cuerpo.data?._entities ?? []) if (p) this.conocidos.set(p.id, { nombre: p.nombre, rubro: p.rubro });
    } catch (e) {
      this.log.warn(`Catálogo no respondió los nombres de ${ids.join(', ')}: ${(e as Error).message}`);
    }
  }
}
