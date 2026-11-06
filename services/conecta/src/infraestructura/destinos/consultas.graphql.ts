import { Injectable } from '@nestjs/common';
import type { ConsultasDeCompra } from '../../dominio/puertos.js';

const PRODUCTOS = `query Productos($busqueda: String, $mayoristaId: ID) {
  productos(busqueda: $busqueda, mayoristaId: $mayoristaId) {
    id nombre rubro descripcion marca foto stock estado abastecimiento entregaHoras precioVisible precioPorConfirmar
    mayorista { id nombre dePrueba }
    escalas { presentacion cantidad precioUnitario { centavos texto } }
  }
}`;

const MAYORISTAS = `query Mayoristas($busqueda: String) {
  mayoristas(busqueda: $busqueda) { id nombre ciudad relacion deLaCasa dePrueba }
}`;

const CAMPOS_DE_PEDIDO = `id codigo estado metodoPago motivoRechazo creadoEn
  total { centavos texto }
  mayorista { id nombre }
  lineas { presentacion cantidad unidades subtotal { centavos texto } producto { id nombre } }
  cobro { estado codigo venceEn monto { texto } }`;

const PEDIDO = `query Pedido($id: ID!) { pedido(id: $id) { ${CAMPOS_DE_PEDIDO} } }`;
const MIS_COMPRAS = `query MisCompras { misCompras { ${CAMPOS_DE_PEDIDO} } }`;

/** Adaptador de salida: lo que el e-commerce o el agente pueden leer, por el Router y con su propio token. */
@Injectable()
export class ConsultasGraphQL implements ConsultasDeCompra {
  private readonly url = process.env.ROUTER_URL ?? 'http://localhost:4000/';

  private async consultar<T>(query: string, variables: Record<string, unknown>, token: string): Promise<T> {
    const r = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, variables }),
    });
    const cuerpo = (await r.json()) as { data?: T; errors?: { message: string }[] };
    if (!r.ok || cuerpo.errors?.length) throw new Error(cuerpo.errors?.map((e) => e.message).join('; ') ?? `El Router respondió ${r.status}`);
    return cuerpo.data as T;
  }

  /** Los mayoristas de prueba no salen afuera, igual que en la app. */
  async mayoristas(token: string, busqueda?: string) {
    const { mayoristas } = await this.consultar<{ mayoristas: { dePrueba?: boolean }[] }>(MAYORISTAS, { busqueda: busqueda ?? null }, token);
    return mayoristas.filter((m) => !m.dePrueba).map(({ dePrueba: _p, ...m }) => m);
  }

  async productos(token: string, filtro: { busqueda?: string; mayoristaId?: string }) {
    const { productos } = await this.consultar<{ productos: { mayorista: { id: string; nombre: string; dePrueba?: boolean } }[] }>(
      PRODUCTOS,
      { busqueda: filtro.busqueda ?? null, mayoristaId: filtro.mayoristaId ?? null },
      token,
    );
    return productos
      // Si pidió ese mayorista a propósito se le responde; en una búsqueda general no aparecen los de prueba
      .filter((p) => filtro.mayoristaId || !p.mayorista.dePrueba)
      .map((p) => ({ ...p, mayorista: { id: p.mayorista.id, nombre: p.mayorista.nombre } }));
  }

  async pedido(token: string, id: string) {
    return (await this.consultar<{ pedido: unknown }>(PEDIDO, { id }, token)).pedido ?? null;
  }

  async misCompras(token: string) {
    return (await this.consultar<{ misCompras: unknown[] }>(MIS_COMPRAS, {}, token)).misCompras;
  }
}
