import { Logger } from '@nestjs/common';
import type { DirectorioDeTiendas } from '../../proyector/puertos.js';

const ENTIDADES = `query($r: [_Any!]!) { _entities(representations: $r) { ... on Tienda { id nombre } } }`;

/**
 * Adaptador: pide los nombres al subgrafo de Catálogo con `_entities` (lo mismo que hace el Router).
 * Guarda en memoria los nombres que ya conoce. Si Catálogo no responde, usa el id: un reporte con el id
 * es mejor que un evento perdido en la cola de errores. Se crea con una fábrica en app.module (sin inyección).
 */
export class DirectorioCatalogo implements DirectorioDeTiendas {
  private readonly log = new Logger(DirectorioCatalogo.name);
  private readonly conocidos = new Map<string, string>();

  constructor(
    private readonly url = process.env.CATALOGO_URL ?? 'http://localhost:8082/graphql',
    private readonly pedir: typeof fetch = fetch,
  ) {}

  async nombres(tiendaIds: string[]): Promise<Record<string, string>> {
    const faltan = [...new Set(tiendaIds)].filter((id) => !this.conocidos.has(id));
    if (faltan.length) await this.buscar(faltan);
    return Object.fromEntries(tiendaIds.map((id) => [id, this.conocidos.get(id) ?? id]));
  }

  private async buscar(ids: string[]): Promise<void> {
    try {
      const respuesta = await this.pedir(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: ENTIDADES, variables: { r: ids.map((id) => ({ __typename: 'Tienda', id })) } }),
        signal: AbortSignal.timeout(3000),
      });
      const cuerpo = (await respuesta.json()) as { data?: { _entities?: ({ id: string; nombre: string } | null)[] } };
      for (const tienda of cuerpo.data?._entities ?? []) {
        // Catálogo devuelve el id como nombre cuando no conoce la tienda: ese no se guarda, se vuelve a preguntar
        if (tienda && tienda.nombre !== tienda.id) this.conocidos.set(tienda.id, tienda.nombre);
      }
    } catch (e) {
      this.log.warn(`Catálogo no respondió los nombres de ${ids.join(', ')}: ${(e as Error).message}`);
    }
  }
}
