import { Component, ElementRef, Input, ViewEncapsulation, inject } from '@angular/core';
import { ESTILOS_BASE } from './estilos';
import { GraphQL } from './graphql';
import { Icono } from './icono';
import { pedirNavegar, type SesionDelShell } from './sesion';
import { VistaClientes } from './vistas/clientes';
import { VistaCompras } from './vistas/compras';
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
  imports: [VistaPedidos, VistaProductos, VistaClientes, VistaCompras, VistaEnConstruccion, Icono],
  styles: [
    ESTILOS_BASE,
    `
      .atajos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.1rem; margin-top: 1.75rem; }
      .atajo { display: flex; align-items: center; gap: 1rem; padding: 1.1rem 1.3rem; border: 0; border-radius: 28px; background: hsl(var(--superficie)); box-shadow: var(--sombra-carta); text-align: left; transition: transform 0.15s; }
      .atajo:hover { transform: translateY(-2px); box-shadow: 0 0 0 2px hsl(var(--primary)), var(--sombra-carta); }
      .atajo strong { display: block; font-size: 1.1rem; font-weight: 800; }
      .atajo span.texto { color: hsl(var(--texto-2)); }
      @media (max-width: 860px) { .atajos { grid-template-columns: 1fr; } }
    `,
  ],
  template: `
    @switch (ruta) {
      @case ('inicio') {
        <div class="cabecera">
          <div>
            <h1 class="titulo-pantalla">Hola, {{ sesion?.usuario?.orgNombre }}</h1>
            <p class="subtitulo">Aquí tienes un resumen de tu negocio</p>
          </div>
        </div>
        <abasto-vista-pedidos [soloPorConfirmar]="true" />
        <div class="atajos">
          <button class="atajo" (click)="ir('compras')">
            <span class="disco ambar"><abasto-icono nombre="canasta" [tamano]="28" /></span>
            <span><strong>Compras de hoy</strong><span class="texto">Lo que sales a comprar, por mercado</span></span>
          </button>
          <button class="atajo" (click)="ir('productos')">
            <span class="disco lima"><abasto-icono nombre="caja" [tamano]="28" /></span>
            <span><strong>Tus productos</strong><span class="texto">Precios, fotos y a quién se muestran</span></span>
          </button>
          <button class="atajo" (click)="ir('clientes')">
            <span class="disco menta"><abasto-icono nombre="clientes" [tamano]="28" /></span>
            <span><strong>Tus clientes</strong><span class="texto">Quién te compra y quién quiere comprarte</span></span>
          </button>
        </div>
      }
      @case ('pedidos') { <abasto-vista-pedidos /> }
      @case ('compras') { <abasto-vista-compras /> }
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
  private readonly host = inject(ElementRef<HTMLElement>);
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

  ir(ruta: string) {
    pedirNavegar(this.host.nativeElement, ruta);
  }
}
