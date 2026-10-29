import { Component, Input, ViewEncapsulation, inject } from '@angular/core';
import { ESTILOS_BASE } from './estilos';
import { GraphQL } from './graphql';
import type { SesionDelShell } from './sesion';
import { VistaClientes } from './vistas/clientes';
import { VistaEnConstruccion } from './vistas/en-construccion';
import { VistaPedidos } from './vistas/pedidos';
import { VistaProductos } from './vistas/productos';

/**
 * Raíz del microfrontend de Gestión. El Shell la usa como <abasto-gestion ruta="pedidos">.
 * No tiene router propio: la ruta la decide el Shell y llega como atributo.
 */
@Component({
  selector: 'abasto-gestion-raiz',
  encapsulation: ViewEncapsulation.ShadowDom,
  imports: [VistaPedidos, VistaProductos, VistaClientes, VistaEnConstruccion],
  styles: [ESTILOS_BASE, `.saludo { margin: 0.5rem 0 1.5rem; } .saludo p { color: hsl(var(--texto-2)); margin: 0.25rem 0 0; }`],
  template: `
    @switch (ruta) {
      @case ('inicio') {
        <div class="cabecera saludo">
          <div>
            <h1 class="titulo-pantalla">Hola, {{ sesion?.usuario?.orgNombre }}</h1>
            <p>Aquí tienes un resumen de tu negocio.</p>
          </div>
        </div>
        <abasto-vista-pedidos [soloPorConfirmar]="true" />
      }
      @case ('pedidos') { <abasto-vista-pedidos /> }
      @case ('productos') { <abasto-vista-productos /> }
      @case ('clientes') { <abasto-vista-clientes /> }
      @case ('cuentas') {
        <abasto-vista-en-construccion titulo="Cuentas por cobrar" fase="F2"
          detalle="Saldos, vencimientos y registrar pagos en efectivo o transferencia. Los datos son de Cobros (NestJS)." />
      }
      @case ('conecta') {
        <abasto-vista-en-construccion titulo="Conecta" fase="F3"
          detalle="Tiendas conectadas por API o WooCommerce, eventos recientes y webhooks que fallaron." />
      }
      @default { <abasto-vista-pedidos [soloPorConfirmar]="true" /> }
    }
  `,
})
export class GestionRaiz {
  private readonly graphql = inject(GraphQL);
  private _sesion: SesionDelShell | null = null;

  @Input() ruta = 'inicio';

  @Input()
  set sesion(valor: SesionDelShell | null) {
    this._sesion = valor;
    this.graphql.fijarSesion(valor);
  }
  get sesion() {
    return this._sesion;
  }
}
