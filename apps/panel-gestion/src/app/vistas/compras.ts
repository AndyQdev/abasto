import { Component, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { ESTILOS_BASE } from '../estilos';
import { GraphQL } from '../graphql';

export interface LineaDeCompra {
  unidades: number;
  venta: { centavos: number };
  pedidos: string[];
  producto: { id: string; nombre?: string | null; proveedor?: string | null; costoUnitario?: { centavos: number } | null };
}

export interface GrupoDeCompra {
  proveedor: string;
  lineas: (LineaDeCompra & { costoCentavos: number | null; margenCentavos: number | null })[];
  costoCentavos: number;
  ventaCentavos: number;
}

// Pedidos (Spring) suma las unidades; Catálogo (Laravel) pone el nombre, el proveedor y el costo. El Router los junta.
const LISTA_DE_COMPRAS = `
  query ListaDeCompras {
    listaDeCompras {
      unidades venta { centavos } pedidos
      producto { id nombre proveedor costoUnitario { centavos } }
    }
  }`;

const SIN_PROVEEDOR = 'Sin proveedor cargado';
const formato = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const bs = (centavos: number) => `Bs ${formato.format(centavos / 100)}`;

/** Agrupa por dónde se compra, para salir al mercado con una lista por puesto. Lo sin costo cargado va al final. */
export function agruparPorProveedor(lineas: LineaDeCompra[]): GrupoDeCompra[] {
  const grupos = new Map<string, GrupoDeCompra>();
  for (const l of lineas) {
    const proveedor = l.producto.proveedor ?? SIN_PROVEEDOR;
    const grupo = grupos.get(proveedor) ?? { proveedor, lineas: [], costoCentavos: 0, ventaCentavos: 0 };
    const costo = l.producto.costoUnitario ? l.producto.costoUnitario.centavos * l.unidades : null;
    grupo.lineas.push({ ...l, costoCentavos: costo, margenCentavos: costo === null ? null : l.venta.centavos - costo });
    grupo.costoCentavos += costo ?? 0;
    grupo.ventaCentavos += l.venta.centavos;
    grupos.set(proveedor, grupo);
  }
  return [...grupos.values()].sort((a, b) =>
    a.proveedor === SIN_PROVEEDOR ? 1 : b.proveedor === SIN_PROVEEDOR ? -1 : a.proveedor.localeCompare(b.proveedor, 'es'),
  );
}

/** «12 %» del margen sobre la venta */
export const porcentaje = (margen: number, venta: number) => (venta > 0 ? `${Math.round((margen / venta) * 100)} %` : '—');

/**
 * Lista de compras (modelo de lanzamiento: Abasto vende bajo pedido).
 * Lo que hay que salir a comprar para los pedidos confirmados que todavía no se prepararon, por puesto,
 * con lo que va a costar y lo que se gana. Cuando se compra, se avanza el pedido a «En preparación».
 */
@Component({
  selector: 'abasto-vista-compras',
  encapsulation: ViewEncapsulation.ShadowDom,
  styles: [
    ESTILOS_BASE,
    `
      .grupo { margin-bottom: 1rem; }
      .grupo h3 { margin: 0 0 0.75rem; font-family: var(--fuente-titulo); font-size: 1.05rem; }
      .grupo h3 small { font-family: var(--fuente-sans); font-size: 0.75rem; color: hsl(var(--texto-3)); font-weight: 500; margin-left: 0.5rem; }
      tfoot td { font-weight: 700; border-top: 2px solid hsl(var(--borde)); }
      .ganancia { color: hsl(var(--exito-suave-texto)); }
      .perdida { color: hsl(var(--error-suave-texto)); }
      .resumen { display: flex; gap: 2rem; }
      .resumen div { color: hsl(var(--texto-2)); }
      .resumen strong { display: block; font-family: var(--fuente-titulo); font-size: 1.5rem; color: hsl(var(--texto)); }
      .nota { color: hsl(var(--texto-2)); margin: -0.5rem 0 1rem; }
    `,
  ],
  template: `
    <div class="cabecera">
      <h1 class="titulo-pantalla">Compras</h1>
      <div class="resumen">
        <div><strong>{{ bs(totalCosto()) }}</strong>vas a gastar</div>
        <div><strong>{{ bs(totalVenta()) }}</strong>vas a cobrar</div>
        <div><strong class="ganancia">{{ bs(totalVenta() - totalCosto()) }}</strong>de margen · {{ porcentaje(totalVenta() - totalCosto(), totalVenta()) }}</div>
      </div>
    </div>
    <p class="nota">Lo que hay que comprar para los pedidos confirmados que todavía no preparaste, agrupado por dónde lo compras.</p>

    @if (error()) {
      <p class="falla">{{ error() }}</p>
    } @else if (cargando()) {
      <div class="carta"><p class="vacio">Armando la lista…</p></div>
    } @else if (!grupos().length) {
      <div class="carta"><p class="vacio">No hay nada que comprar: todos los pedidos confirmados ya se prepararon.</p></div>
    } @else {
      @for (g of grupos(); track g.proveedor) {
        <div class="carta grupo">
          <h3>{{ g.proveedor }}<small>{{ g.lineas.length }} {{ g.lineas.length === 1 ? 'producto' : 'productos' }}</small></h3>
          <table>
            <thead>
              <tr><th>Producto</th><th class="num">Comprar</th><th>Pedidos</th><th class="num">Costo</th><th class="num">Venta</th><th class="num">Margen</th></tr>
            </thead>
            <tbody>
              @for (l of g.lineas; track l.producto.id) {
                <tr>
                  <td><strong>{{ l.producto.nombre ?? l.producto.id }}</strong><span class="gris mono">{{ l.producto.id }}</span></td>
                  <td class="num">{{ l.unidades }} u.</td>
                  <td class="mono">{{ l.pedidos.join(', ') }}</td>
                  <td class="num">{{ l.costoCentavos === null ? 'Sin costo' : bs(l.costoCentavos) }}</td>
                  <td class="num">{{ bs(l.venta.centavos) }}</td>
                  <td class="num" [class.ganancia]="(l.margenCentavos ?? 0) > 0" [class.perdida]="(l.margenCentavos ?? 0) < 0">
                    {{ l.margenCentavos === null ? '—' : bs(l.margenCentavos) }}
                  </td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">Total {{ g.proveedor }}</td>
                <td class="num">{{ bs(g.costoCentavos) }}</td>
                <td class="num">{{ bs(g.ventaCentavos) }}</td>
                <td class="num ganancia">{{ bs(g.ventaCentavos - g.costoCentavos) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      }
    }
  `,
})
export class VistaCompras implements OnInit {
  private readonly graphql = inject(GraphQL);
  readonly grupos = signal<GrupoDeCompra[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly bs = bs;
  readonly porcentaje = porcentaje;

  readonly totalCosto = () => this.grupos().reduce((s, g) => s + g.costoCentavos, 0);
  readonly totalVenta = () => this.grupos().reduce((s, g) => s + g.ventaCentavos, 0);

  ngOnInit() {
    void this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    try {
      const datos = await this.graphql.consultar<{ listaDeCompras: LineaDeCompra[] }>(LISTA_DE_COMPRAS);
      this.grupos.set(agruparPorProveedor(datos.listaDeCompras));
      this.error.set(null);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }
}
