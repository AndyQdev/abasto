import { Component, OnInit, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { ESTILOS_BASE, inicial } from '../estilos';
import { GraphQL } from '../graphql';
import { Icono } from '../icono';

export interface LineaDeCompra {
  unidades: number;
  venta: { centavos: number };
  pedidos: string[];
  producto: {
    id: string;
    nombre?: string | null;
    proveedor?: string | null;
    foto?: string | null;
    costoUnitario?: { centavos: number } | null;
  };
}

export interface GrupoDeCompra {
  proveedor: string;
  lineas: (LineaDeCompra & { costoCentavos: number | null; margenCentavos: number | null })[];
  costoCentavos: number;
  ventaCentavos: number;
}

// Pedidos (Spring) suma las unidades; Catálogo (Laravel) pone el nombre, el proveedor, la foto y el costo. El Router los junta.
const LISTA_DE_COMPRAS = `
  query ListaDeCompras {
    listaDeCompras {
      unidades venta { centavos } pedidos
      producto { id nombre proveedor foto costoUnitario { centavos } }
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

/** «Mercado Los Pozos» → «Los Pozos» con «Mercado» abajo; «Distribuidora (pedido por WhatsApp)» → «Distribuidora» y «Pedido por WhatsApp». */
export function partesDelProveedor(proveedor: string): { titulo: string; detalle: string } {
  if (proveedor === SIN_PROVEEDOR) return { titulo: proveedor, detalle: 'Cárgalo en Productos' };
  const mercado = /^Mercado\s+(.+)$/i.exec(proveedor);
  if (mercado) return { titulo: mercado[1], detalle: 'Mercado' };
  const entreParentesis = /^(.+?)\s*\((.+)\)$/.exec(proveedor);
  if (entreParentesis) {
    const detalle = entreParentesis[2];
    return { titulo: entreParentesis[1], detalle: detalle.charAt(0).toUpperCase() + detalle.slice(1) };
  }
  return { titulo: proveedor, detalle: 'Proveedor' };
}

/** Lo que ya se compró hoy se recuerda en este navegador (es la lista de quien sale al mercado). */
const claveDeHoy = () => `abasto-compras-${new Date().toLocaleDateString('en-CA')}`;
function leerComprados(): string[] {
  try {
    return JSON.parse(localStorage.getItem(claveDeHoy()) ?? '[]') as string[];
  } catch {
    return [];
  }
}

const TONOS = ['menta', 'ambar', 'lima'];

/**
 * Lista de compras (modelo de lanzamiento: Abasto vende bajo pedido).
 * Lo que hay que salir a comprar para los pedidos confirmados que todavía no se prepararon: una tarjeta por puesto,
 * con casillas para ir marcando lo comprado, lo que va a costar y lo que se gana. Después se prepara el pedido en Pedidos.
 */
@Component({
  selector: 'abasto-vista-compras',
  encapsulation: ViewEncapsulation.ShadowDom,
  imports: [Icono],
  styles: [
    ESTILOS_BASE,
    `
      .fecha { gap: 0.7rem; }
      .ganancia strong { color: hsl(var(--exito-suave-texto)); }
      .perdida strong { color: hsl(var(--error-suave-texto)); }

      .puestos { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(360px, 100%), 1fr)); gap: 1.25rem; align-items: start; }
      .puesto { background: hsl(var(--superficie)); border-radius: 32px; box-shadow: var(--sombra-carta); padding: 0.7rem 0.7rem 1rem; display: grid; gap: 0.6rem; }
      .puesto-cabeza { display: flex; align-items: center; gap: 0.9rem; padding: 0.8rem 1.1rem; border-radius: 26px; }
      .puesto-cabeza.menta { background: hsl(var(--menta)); }
      .puesto-cabeza.ambar { background: hsl(var(--ambar) / 0.75); }
      .puesto-cabeza.lima { background: hsl(var(--primary) / 0.8); }
      .puesto-cabeza h2 { margin: 0; font-size: 1.3rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; }
      .puesto-cabeza p { margin: 0.1rem 0 0; font-size: 1rem; }
      .avance { padding: 0.2rem 0.5rem 0; display: grid; gap: 0.45rem; }
      .avance strong { font-size: 1.05rem; }
      .barra-avance { height: 14px; border-radius: 999px; background: hsl(var(--tenue)); overflow: hidden; }
      .barra-avance span { display: block; height: 100%; border-radius: 999px; background: hsl(var(--primary)); transition: width 0.3s ease; }

      .item { display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto; align-items: center; gap: 0.8rem; padding: 0.75rem 0.5rem; }
      .item + .item { border-top: 1px solid hsl(var(--borde)); }
      .casilla { width: 32px; height: 32px; border-radius: 10px; border: 2.5px solid hsl(var(--ambar)); background: hsl(var(--superficie)); display: grid; place-items: center; color: hsl(var(--tinta)); padding: 0; }
      .casilla[aria-checked="true"] { background: hsl(var(--primary)); border-color: hsl(var(--primary)); }
      .item.comprado .nombre, .item.comprado .importe { opacity: 0.55; }
      .item.comprado .nombre strong { text-decoration: line-through; text-decoration-thickness: 2px; }
      .foto { width: 62px; height: 62px; border-radius: 18px; background: hsl(var(--tenue)); display: grid; place-items: center; overflow: hidden; font-weight: 800; color: hsl(var(--texto-3)); font-size: 1.3rem; }
      .foto img { width: 100%; height: 100%; object-fit: contain; }
      .nombre { min-width: 0; display: grid; gap: 0.3rem; }
      .nombre strong { font-size: 1rem; font-weight: 700; line-height: 1.25; }
      .detalles-linea { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; color: hsl(var(--texto-2)); font-size: 0.9rem; }
      .codigo { padding: 0.15rem 0.6rem; border-radius: 999px; background: hsl(var(--primary-suave)); font-weight: 700; font-size: 0.8125rem; color: hsl(var(--tinta)); }
      .importe { display: grid; justify-items: end; gap: 0.3rem; text-align: right; }
      .importe strong { font-size: 1.1rem; font-weight: 800; white-space: nowrap; }
      .sin-costo { color: hsl(var(--texto-3)); font-weight: 600; }
      .margen-negativo { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.6rem; border-radius: 999px; background: hsl(var(--error-suave)); color: hsl(var(--error-suave-texto)); font-size: 0.75rem; font-weight: 700; white-space: nowrap; }
      .mas-detalle { grid-column: 3 / -1; display: grid; gap: 0.2rem; padding: 0.6rem 0.8rem; border-radius: 14px; background: hsl(var(--tenue)); font-size: 0.875rem; }
      .mas-detalle .fila { display: flex; justify-content: space-between; gap: 1rem; }

      .puesto-pie { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.6rem 0.5rem 0; border-top: 1px solid hsl(var(--borde)); margin: 0 0.3rem; }
      .subtotal { font-size: 1.1rem; }
      .subtotal strong { font-weight: 800; }

      @media print {
        .barra, .cifras, .puesto-pie button, .cabecera .capsula-contador { display: none !important; }
        .puestos { grid-template-columns: 1fr 1fr; }
        .puesto { box-shadow: none; border: 1px solid #ccc; break-inside: avoid; }
      }
      @media (max-width: 520px) { .puestos { grid-template-columns: minmax(0, 1fr); } .item { grid-template-columns: auto minmax(0, 1fr) auto; } .foto { display: none; } }
    `,
  ],
  template: `
    <div class="cabecera">
      <div>
        <h1 class="titulo-pantalla">Compras de hoy</h1>
        <p class="subtitulo">Organiza lo que comprarás para tus pedidos</p>
      </div>
      <span class="capsula-contador fecha"><abasto-icono nombre="calendario" [tamano]="24" /> {{ hoy }}</span>
    </div>

    <div class="cifras">
      <div class="cifra-carta">
        <span class="disco ambar"><abasto-icono nombre="canasta" [tamano]="30" /></span><span class="linea-v"></span>
        <div><strong>{{ bs(totalCosto()) }}</strong><span>Vas a gastar</span></div>
      </div>
      <div class="cifra-carta">
        <span class="disco lima"><abasto-icono nombre="billete" [tamano]="30" /></span><span class="linea-v"></span>
        <div><strong>{{ bs(totalVenta()) }}</strong><span>Vas a cobrar</span></div>
      </div>
      <div class="cifra-carta" [class.ganancia]="ganancia() >= 0" [class.perdida]="ganancia() < 0">
        <span class="disco" [class.menta]="ganancia() >= 0" [class.rojo]="ganancia() < 0"><abasto-icono [nombre]="ganancia() >= 0 ? 'sube' : 'baja'" [tamano]="30" /></span><span class="linea-v"></span>
        <div><strong>{{ bs(ganancia()) }}</strong><span>{{ ganancia() >= 0 ? 'Ganancia estimada' : 'Pérdida estimada' }} · {{ porcentaje(ganancia(), totalVenta()) }}</span></div>
      </div>
    </div>

    <div class="barra">
      <div class="segmentos" role="group" aria-label="Filtrar por mercado">
        <button class="segmento" [class.elegido]="donde() === ''" [attr.aria-pressed]="donde() === ''" (click)="donde.set('')">Todos</button>
        @for (g of grupos(); track g.proveedor) {
          <button class="segmento" [class.elegido]="donde() === g.proveedor" [attr.aria-pressed]="donde() === g.proveedor" (click)="donde.set(g.proveedor)">{{ partes(g.proveedor).titulo }}</button>
        }
      </div>
      <button class="boton-oscuro" (click)="imprimir()" [disabled]="!grupos().length"><abasto-icono nombre="imprimir" /> Imprimir lista</button>
    </div>

    @if (error()) {
      <p class="falla">{{ error() }}</p>
    } @else if (cargando()) {
      <div class="carta vacio">Armando la lista…</div>
    } @else if (!grupos().length) {
      <div class="carta vacio">No hay nada que comprar: todos los pedidos confirmados ya se prepararon.</div>
    } @else {
      <div class="puestos">
        @for (g of visibles(); track g.proveedor; let i = $index) {
          <section class="puesto" [attr.aria-label]="g.proveedor">
            <div class="puesto-cabeza" [class]="'puesto-cabeza ' + tono(g.proveedor)">
              <span class="disco chico" style="background: hsl(var(--superficie) / 0.6)"><abasto-icono [nombre]="g.proveedor.startsWith('Mercado') ? 'tienda' : 'caja'" /></span>
              <div>
                <h2>{{ partes(g.proveedor).titulo }}</h2>
                <p>{{ partes(g.proveedor).detalle }}</p>
              </div>
            </div>
            <div class="avance">
              <strong>{{ compradosDe(g) }} de {{ g.lineas.length }} comprados</strong>
              <div class="barra-avance" role="progressbar" [attr.aria-valuenow]="compradosDe(g)" aria-valuemin="0" [attr.aria-valuemax]="g.lineas.length">
                <span [style.width.%]="(compradosDe(g) / g.lineas.length) * 100"></span>
              </div>
            </div>
            <div>
              @for (l of g.lineas; track l.producto.id) {
                <div class="item" [class.comprado]="comprado(l.producto.id)">
                  <button class="casilla" role="checkbox" [attr.aria-checked]="comprado(l.producto.id)"
                    [attr.aria-label]="'Comprado: ' + (l.producto.nombre ?? l.producto.id)" (click)="marcar(l.producto.id)">
                    @if (comprado(l.producto.id)) { <abasto-icono nombre="check" [tamano]="20" [grosor]="3" /> }
                  </button>
                  <span class="foto">
                    @if (l.producto.foto) { <img [src]="l.producto.foto" alt="" loading="lazy" /> } @else { {{ letra(l.producto.nombre) }} }
                  </span>
                  <div class="nombre">
                    <strong>{{ l.producto.nombre ?? l.producto.id }}</strong>
                    <div class="detalles-linea">
                      <span>{{ l.unidades }} u.</span>
                      @for (c of l.pedidos.slice(0, 2); track c) { <span class="codigo">{{ c }}</span> }
                      @if (l.pedidos.length > 2) { <span class="codigo">+{{ l.pedidos.length - 2 }}</span> }
                    </div>
                  </div>
                  <div class="importe">
                    @if (l.costoCentavos === null) { <span class="sin-costo">Sin costo</span> } @else { <strong>{{ bs(l.costoCentavos) }}</strong> }
                    @if ((l.margenCentavos ?? 0) < 0) {
                      <span class="margen-negativo"><abasto-icono nombre="alerta" [tamano]="14" /> Margen negativo</span>
                    }
                  </div>
                  @if (abiertos()[g.proveedor]) {
                    <div class="mas-detalle">
                      <div class="fila"><span>Lo vendes en</span><strong>{{ bs(l.venta.centavos) }}</strong></div>
                      <div class="fila"><span>Ganas</span><strong>{{ l.margenCentavos === null ? '—' : bs(l.margenCentavos) }}</strong></div>
                      <div class="fila"><span>Pedidos</span><span>{{ l.pedidos.join(', ') }}</span></div>
                    </div>
                  }
                </div>
              }
            </div>
            <div class="puesto-pie">
              <button class="boton-suave boton-chico" (click)="alternarDetalle(g.proveedor)" [attr.aria-expanded]="!!abiertos()[g.proveedor]">
                {{ abiertos()[g.proveedor] ? 'Ocultar detalles' : 'Ver detalles' }}
              </button>
              <span class="subtotal">Subtotal <strong>{{ bs(g.costoCentavos) }}</strong></span>
            </div>
          </section>
        }
      </div>
    }
  `,
})
export class VistaCompras implements OnInit {
  private readonly graphql = inject(GraphQL);
  readonly grupos = signal<GrupoDeCompra[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly donde = signal('');
  readonly comprados = signal<string[]>(leerComprados());
  readonly abiertos = signal<Record<string, boolean>>({});
  readonly bs = bs;
  readonly porcentaje = porcentaje;
  readonly partes = partesDelProveedor;
  readonly letra = inicial;
  readonly hoy = new Date().toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });

  readonly visibles = computed(() => (this.donde() ? this.grupos().filter((g) => g.proveedor === this.donde()) : this.grupos()));
  readonly totalCosto = computed(() => this.visibles().reduce((s, g) => s + g.costoCentavos, 0));
  readonly totalVenta = computed(() => this.visibles().reduce((s, g) => s + g.ventaCentavos, 0));
  readonly ganancia = computed(() => this.totalVenta() - this.totalCosto());

  ngOnInit() {
    void this.cargar();
  }

  tono = (proveedor: string) => TONOS[Math.max(0, this.grupos().findIndex((g) => g.proveedor === proveedor)) % TONOS.length];
  comprado = (id: string) => this.comprados().includes(id);
  compradosDe = (g: GrupoDeCompra) => g.lineas.filter((l) => this.comprado(l.producto.id)).length;
  alternarDetalle = (proveedor: string) => this.abiertos.update((a) => ({ ...a, [proveedor]: !a[proveedor] }));
  imprimir = () => window.print();

  marcar(id: string) {
    this.comprados.update((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
    try {
      localStorage.setItem(claveDeHoy(), JSON.stringify(this.comprados()));
    } catch {
      // Sin almacenamiento igual se marca; solo no se recuerda al volver
    }
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
