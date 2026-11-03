import { Component, ElementRef, Input, ViewEncapsulation, inject, signal } from '@angular/core';
import { ESTILOS_BASE } from './estilos';
import { GraphQL } from './graphql';
import { Icono } from './icono';
import { pedirNavegar, type SesionDelShell } from './sesion';
import { VistaClientes } from './vistas/clientes';
import { VistaCompras } from './vistas/compras';
import { bs } from './vistas/compras';
import { VistaConecta } from './vistas/conecta';
import { VistaCuentas } from './vistas/cuentas';
import { VistaPedidos } from './vistas/pedidos';
import { VistaProductos } from './vistas/productos';

/**
 * Raíz del microfrontend de Gestión. El Shell la usa como <abasto-gestion ruta="pedidos">.
 * No tiene router propio: la ruta la decide el Shell y llega como atributo.
 */
@Component({
  selector: 'abasto-gestion-raiz',
  encapsulation: ViewEncapsulation.ShadowDom,
  imports: [VistaPedidos, VistaProductos, VistaClientes, VistaCompras, VistaCuentas, VistaConecta, Icono],
  styles: [
    ESTILOS_BASE,
    `
      .atajos { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1.1rem; margin-top: 1.75rem; }
      .atajo { display: flex; align-items: center; gap: 1rem; padding: 1.1rem 1.3rem; border: 0; border-radius: 28px; background: hsl(var(--superficie)); box-shadow: var(--sombra-carta); text-align: left; transition: transform 0.15s; }
      .atajo:hover { transform: translateY(-2px); box-shadow: 0 0 0 2px hsl(var(--primary)), var(--sombra-carta); }
      .atajo strong { display: block; font-size: 1.1rem; font-weight: 800; }
      .atajo span.texto { color: hsl(var(--texto-2)); }
      @media (max-width: 860px) { .atajos { grid-template-columns: 1fr; } }
      .atajo span.texto.vencido { color: hsl(var(--error-suave-texto)); font-weight: 700; }
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
          <button class="atajo" (click)="ir('cuentas')">
            <span class="disco" [class.rojo]="vencido() > 0" [class.lima]="!vencido()"><abasto-icono nombre="billete" [tamano]="28" /></span>
            <span>
              <strong>Te deben {{ bs(teDeben()) }}</strong>
              @if (vencido() > 0) { <span class="texto vencido">{{ bs(vencido()) }} ya vencido</span> }
              @else { <span class="texto">Cuentas por cobrar y pagos</span> }
            </span>
          </button>
        </div>
      }
      @case ('pedidos') { <abasto-vista-pedidos /> }
      @case ('compras') { <abasto-vista-compras /> }
      @case ('productos') { <abasto-vista-productos /> }
      @case ('clientes') { <abasto-vista-clientes /> }
      @case ('cuentas') { <abasto-vista-cuentas /> }
      @case ('conecta') { <abasto-vista-conecta /> }
      @default { <abasto-vista-pedidos [soloPorConfirmar]="true" /> }
    }
  `,
})
export class GestionRaiz {
  private readonly graphql = inject(GraphQL);
  private readonly host = inject(ElementRef<HTMLElement>);
  private _sesion: SesionDelShell | null = null;

  @Input() ruta = 'inicio';

  /** Lo que le deben al mayorista (CU-09), para el atajo del Inicio. */
  readonly teDeben = signal(0);
  readonly vencido = signal(0);
  readonly bs = bs;

  @Input()
  set sesion(valor: SesionDelShell | null) {
    this._sesion = valor;
    this.graphql.fijarSesion(valor);
    if (valor) void this.cargarLoQueTeDeben();
  }

  private async cargarLoQueTeDeben() {
    try {
      const r = await this.graphql.consultar<{ cuentasPorCobrar: { porCobrar: { centavos: number }; vencido: { centavos: number } } }>(
        'query { cuentasPorCobrar { porCobrar { centavos } vencido { centavos } } }',
      );
      this.teDeben.set(r.cuentasPorCobrar.porCobrar.centavos);
      this.vencido.set(r.cuentasPorCobrar.vencido.centavos);
    } catch {
      // Sin Cobros el Inicio sigue: el atajo muestra Bs 0,00
    }
  }
  get sesion() {
    return this._sesion;
  }

  ir(ruta: string) {
    pedirNavegar(this.host.nativeElement, ruta);
  }
}
