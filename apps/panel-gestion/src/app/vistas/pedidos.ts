import { SlicePipe } from '@angular/common';
import { Component, ElementRef, Input, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { ESTADOS_DE_PEDIDO, ESTILOS_BASE, cantidadConUnidad } from '../estilos';
import { GraphQL } from '../graphql';
import { avisar } from '../sesion';

interface PedidoFila {
  id: string;
  codigo: string;
  estado: string;
  metodoPago: string;
  creadoEn: string;
  total: { texto: string };
  tienda: { id: string; nombre?: string | null };
  /** A dónde llevarlo (lo elige la tienda en el mapa de la app). Null en los pedidos sin dirección */
  entrega: { texto: string; referencia: string; latitud: number | null; longitud: number | null } | null;
  lineas: { cantidad: number; unidades: number; presentacion: string; producto: { id: string; nombre?: string | null } }[];
}

/** El botón según dónde está el pedido. Abasto compra bajo pedido: confirmar → comprar y preparar → despachar → entregar. */
export const SIGUIENTE_PASO: Record<string, string> = {
  CONFIRMADO: 'Preparar',
  EN_PREPARACION: 'Despachar',
  DESPACHADO: 'Marcar entregado',
};

// Una sola consulta trae el pedido (Pedidos · Spring) y el nombre de la tienda y del producto (Catálogo · Laravel)
const MIS_VENTAS = `
  query MisVentas($estado: EstadoPedido) {
    misVentas(estado: $estado) {
      id codigo estado metodoPago creadoEn
      total { texto }
      tienda { id nombre }
      entrega { texto referencia latitud longitud }
      lineas { cantidad unidades presentacion producto { id nombre } }
    }
  }`;

/**
 * Pedidos del mayorista. En Inicio muestra solo los que esperan confirmación (modo "por-confirmar").
 * Confirmar es el paso 4 de la saga; rechazar dispara las compensaciones.
 */
@Component({
  selector: 'abasto-vista-pedidos',
  encapsulation: ViewEncapsulation.ShadowDom,
  styles: [ESTILOS_BASE, `.tienda strong, .tienda .gris { display: block; } .tienda .mapa { font-size: 12.5px; font-weight: 600; }`],
  template: `
    @if (soloPorConfirmar) {
      <h3>Pedidos por confirmar</h3>
    } @else {
      <div class="cabecera">
        <h1 class="titulo-pantalla">Pedidos</h1>
        <div class="contadores">
          <div><strong>{{ pedidos().length }}</strong>en total</div>
        </div>
      </div>
      <div class="filtros">
        <select class="entrada" (change)="filtrar($any($event.target).value)" aria-label="Estado">
          <option value="">Todos los estados</option>
          @for (e of estados; track e[0]) { <option [value]="e[0]">{{ e[1].texto }}</option> }
        </select>
        <span class="relleno"></span>
      </div>
    }

    <div class="carta">
      @if (error()) {
        <p class="falla">{{ error() }}</p>
      } @else if (cargando()) {
        <p class="vacio">Cargando pedidos…</p>
      } @else if (!pedidos().length) {
        <p class="vacio">No hay pedidos en esta pestaña.</p>
      } @else {
        <table>
          <thead>
            <tr><th>Pedido</th><th>Tienda</th><th>Productos</th><th>Pago</th><th class="num">Monto</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            @for (p of pedidos(); track p.id) {
              <tr>
                <td class="mono">{{ p.codigo }}<span class="gris">{{ p.creadoEn | slice: 0 : 10 }}</span></td>
                <td class="tienda">
                  <strong>{{ p.tienda.nombre ?? p.tienda.id }}</strong>
                  @if (p.entrega; as entrega) {
                    <span class="gris">{{ entrega.texto }}</span>
                    @if (entrega.referencia) { <span class="gris">{{ entrega.referencia }}</span> }
                    @if (enMapa(entrega); as url) {
                      <a class="mapa" [href]="url" target="_blank" rel="noopener">Ver en el mapa</a>
                    }
                  }
                </td>
                <td>
                  @for (l of p.lineas; track $index) {
                    <div>{{ l.producto.nombre ?? l.producto.id }}<span class="gris">{{ cantidad(l) }}</span></div>
                  }
                </td>
                <td>{{ pago(p.metodoPago) }}</td>
                <td class="num">{{ p.total.texto }}</td>
                <td><span class="insignia" [class]="estado(p.estado).clase">{{ estado(p.estado).texto }}</span></td>
                <td>
                  <div class="acciones">
                  @if (p.estado === 'POR_CONFIRMAR') {
                    <button class="boton-secundario" [disabled]="ocupado() === p.id" (click)="rechazar(p)">Rechazar</button>
                    <button class="boton-primario" [disabled]="ocupado() === p.id" (click)="confirmar(p)">Confirmar</button>
                  } @else if (siguientePaso(p.estado); as paso) {
                    <button class="boton-secundario" [disabled]="ocupado() === p.id" (click)="avanzar(p, paso)">{{ paso }}</button>
                  }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  imports: [SlicePipe],
})
export class VistaPedidos implements OnInit {
  @Input() soloPorConfirmar = false;

  private readonly graphql = inject(GraphQL);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly pedidos = signal<PedidoFila[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly ocupado = signal<string | null>(null);
  readonly estados = Object.entries(ESTADOS_DE_PEDIDO);
  private filtro: string | null = null;

  ngOnInit() {
    this.filtro = this.soloPorConfirmar ? 'POR_CONFIRMAR' : null;
    void this.cargar();
  }

  estado = (e: string) => ESTADOS_DE_PEDIDO[e] ?? { texto: e, clase: 'neutro' };
  /** Google Maps en el punto que marcó la tienda (el repartidor lo abre en el celular) */
  enMapa = (d: NonNullable<PedidoFila['entrega']>) =>
    d.latitud !== null && d.longitud !== null ? `https://www.google.com/maps/search/?api=1&query=${d.latitud},${d.longitud}` : null;
  pago = (m: string) => ({ QR: 'QR', CREDITO: 'Crédito', CONTRA_ENTREGA: 'Contra entrega' })[m] ?? m;
  /** Lo que el mayorista hace después de confirmar, de a un paso hasta entregar */
  siguientePaso = (e: string) => SIGUIENTE_PASO[e] ?? null;
  cantidad = (l: PedidoFila['lineas'][number]) => cantidadConUnidad(l.cantidad, l.presentacion, l.unidades);

  filtrar(estado: string) {
    this.filtro = estado || null;
    void this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const datos = await this.graphql.consultar<{ misVentas: PedidoFila[] }>(MIS_VENTAS, { estado: this.filtro });
      this.pedidos.set(datos.misVentas);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  async confirmar(p: PedidoFila) {
    await this.decidir(p, `mutation($id: ID!) { confirmarPedido(id: $id) { id estado } }`, { id: p.id },
      `Confirmaste el pedido ${p.codigo}`);
  }

  async rechazar(p: PedidoFila) {
    const motivo = prompt(`¿Por qué rechazas ${p.codigo}?`, 'Sin stock');
    if (!motivo) return;
    await this.decidir(p, `mutation($id: ID!, $motivo: String!) { rechazarPedido(id: $id, motivo: $motivo) { id estado } }`,
      { id: p.id, motivo }, `Rechazaste ${p.codigo}: se devuelve el cobro y se libera el stock`);
  }

  async avanzar(p: PedidoFila, paso: string) {
    await this.decidir(p, `mutation($id: ID!) { avanzarEntrega(id: $id) { id estado } }`, { id: p.id },
      `${p.codigo}: ${paso.toLowerCase()} listo`);
  }

  private async decidir(p: PedidoFila, mutacion: string, variables: Record<string, unknown>, texto: string) {
    this.ocupado.set(p.id);
    try {
      await this.graphql.consultar(mutacion, variables);
      avisar(this.host.nativeElement, texto);
      await this.cargar();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.ocupado.set(null);
    }
  }
}

