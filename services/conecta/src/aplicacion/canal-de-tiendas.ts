import { avisoDe, tiendaDelEvento, type AvisoDePedido, type SobreDeEvento } from '../dominio/aviso-de-pedido.js';

export type Enviar = (aviso: AvisoDePedido) => void;

/**
 * Las tiendas conectadas en tiempo real y a quién le toca cada evento. Una tienda puede tener varios teléfonos
 * conectados: todos reciben el aviso. Nunca se le manda a una tienda un evento de otra.
 */
export class CanalDeTiendas {
  private readonly porTienda = new Map<string, Set<Enviar>>();

  /** Devuelve la función para dejar de escuchar (al cerrar la conexión) */
  suscribir(tiendaId: string, enviar: Enviar): () => void {
    const suyos = this.porTienda.get(tiendaId) ?? new Set<Enviar>();
    suyos.add(enviar);
    this.porTienda.set(tiendaId, suyos);
    return () => {
      suyos.delete(enviar);
      if (!suyos.size) this.porTienda.delete(tiendaId);
    };
  }

  /** Reparte un evento. Devuelve a cuántas conexiones llegó */
  publicar(sobre: SobreDeEvento): number {
    const tienda = tiendaDelEvento(sobre);
    const aviso = avisoDe(sobre);
    if (!tienda || !aviso) return 0;
    const suyos = this.porTienda.get(tienda);
    if (!suyos) return 0;
    for (const enviar of suyos) {
      try {
        enviar(aviso);
      } catch {
        // Una conexión rota no frena a las demás; se limpia sola al cerrarse
      }
    }
    return suyos.size;
  }

  conexiones() {
    let n = 0;
    for (const s of this.porTienda.values()) n += s.size;
    return n;
  }
}
