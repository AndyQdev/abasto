import { compraEntregada, type PedidoEntregado } from '../dominio/compra-entregada.js';
import { cuantos, type CambiosDeNegocio, type DatosDeNegocio } from '../dominio/modelo.js';
import type { DirectorioDeProductos, Reloj, RepositorioDeNegocio } from '../dominio/puertos.js';
import { SinNegocio, validarCambios } from '../dominio/reglas.js';

/**
 * La marca de la bajada se da unos segundos antes de «ahora»: lo que se estaba guardando en ese momento vuelve a
 * bajar la próxima vez en lugar de perderse. Bajar algo dos veces no hace daño (el teléfono aplica la misma regla).
 */
export const MARGEN_DE_LA_MARCA_MS = 5_000;

const exigirNegocio = (orgId: string) => {
  if (!orgId) throw new SinNegocio();
};

/** El teléfono sube su cola. Todo o nada: si un cambio no sirve, no se guarda ninguno */
export class SincronizarMiNegocio {
  constructor(
    private readonly repo: RepositorioDeNegocio,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(orgId: string, cambios: CambiosDeNegocio): Promise<{ recibidos: number; hasta: string }> {
    exigirNegocio(orgId);
    validarCambios(cambios);
    if (cuantos(cambios)) await this.repo.guardar(orgId, cambios);
    return { recibidos: cuantos(cambios), hasta: new Date(this.reloj.ahora().getTime() - MARGEN_DE_LA_MARCA_MS).toISOString() };
  }
}

/** El teléfono baja lo suyo: todo (celular nuevo) o lo recibido desde su última bajada */
export class ConsultarMiNegocio {
  constructor(
    private readonly repo: RepositorioDeNegocio,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(orgId: string, desde: string | null): Promise<DatosDeNegocio & { hasta: string }> {
    exigirNegocio(orgId);
    const marca = desde && !Number.isNaN(Date.parse(desde)) ? new Date(desde) : null;
    const hasta = new Date(this.reloj.ahora().getTime() - MARGEN_DE_LA_MARCA_MS).toISOString();
    return { ...(await this.repo.desde(orgId, marca)), hasta };
  }
}

/**
 * pedido.entregado: lo comprado entra solo al inventario del cliente, aunque no abra la app. Repetir el evento no
 * duplica (las claves son las mismas que usa el teléfono) y lo que el cliente ya editó no se pisa.
 */
export class RegistrarCompraEntregada {
  constructor(
    private readonly repo: RepositorioDeNegocio,
    private readonly productos: DirectorioDeProductos,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(pedido: PedidoEntregado): Promise<number> {
    if (!pedido.tiendaId || !pedido.lineas?.length) return 0;
    const datos = await this.productos.datos([...new Set(pedido.lineas.map((l) => l.productoId))]);
    const cambios = compraEntregada(pedido, datos, this.reloj.ahora().toISOString());
    return this.repo.guardar(pedido.tiendaId, cambios, { soloSiNoExisten: true });
  }
}
