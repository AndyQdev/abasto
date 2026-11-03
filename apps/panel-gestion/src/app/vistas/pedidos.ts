import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, Input, OnDestroy, OnInit, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { ESTADOS_DE_PEDIDO, ESTILOS_BASE, busquedaDeLaUrl, cantidadConUnidad, haceCuanto, inicial } from '../estilos';
import { GraphQL } from '../graphql';
import { Icono } from '../icono';
import { avisar, pedirNavegar } from '../sesion';

export interface PedidoFila {
  id: string;
  codigo: string;
  estado: string;
  metodoPago: string;
  creadoEn: string;
  total: { texto: string; centavos: number };
  tienda: { id: string; nombre?: string | null };
  /** Solo los pedidos con QR tienen cobro */
  cobro?: { estado: string } | null;
  /** A dónde llevarlo (lo elige la tienda en el mapa de la app). Null en los pedidos sin dirección */
  entrega: { texto: string; zona: string; referencia: string; latitud: number | null; longitud: number | null } | null;
  lineas: {
    cantidad: number;
    unidades: number;
    presentacion: string;
    subtotal: { texto: string };
    producto: { id: string; nombre?: string | null; foto?: string | null };
  }[];
}

/** El botón según dónde está el pedido. Abasto compra bajo pedido: confirmar → comprar y preparar → despachar → entregar. */
export const SIGUIENTE_PASO: Record<string, string> = {
  CONFIRMADO: 'Preparar',
  EN_PREPARACION: 'Despachar',
  DESPACHADO: 'Marcar entregado',
};

export type Columna = 'confirmar' | 'preparar' | 'reparto' | 'cerrado';

/** El tablero tiene tres columnas: lo que hay que confirmar, lo que se compra y prepara, y lo que va en camino. */
export function columnaDe(estado: string): Columna {
  if (estado === 'POR_CONFIRMAR' || estado === 'PENDIENTE') return 'confirmar';
  if (estado === 'CONFIRMADO' || estado === 'EN_PREPARACION') return 'preparar';
  if (estado === 'DESPACHADO') return 'reparto';
  return 'cerrado';
}

/** «QR pagado», «QR por pagar», «Contra entrega», «A crédito» */
export function textoDePago(p: Pick<PedidoFila, 'metodoPago' | 'cobro'>): { texto: string; clase: string } {
  if (p.metodoPago === 'QR') return p.cobro?.estado === 'PAGADO' ? { texto: 'QR pagado', clase: 'lima' } : { texto: 'QR por pagar', clase: 'advertencia' };
  if (p.metodoPago === 'CREDITO') return { texto: 'A crédito', clase: 'neutro' };
  if (p.metodoPago === 'CONTRA_ENTREGA') return { texto: 'Contra entrega', clase: 'neutro' };
  return { texto: p.metodoPago, clase: 'neutro' };
}

/** Un pedido por confirmar vence a las 2 h: con más de 1 h esperando es urgente. */
export const esUrgente = (p: Pick<PedidoFila, 'estado' | 'creadoEn'>, ahora = Date.now()) =>
  columnaDe(p.estado) === 'confirmar' && ahora - new Date(p.creadoEn).getTime() > 60 * 60_000;

export const esDeHoy = (p: Pick<PedidoFila, 'creadoEn'>, ahora = Date.now()) =>
  new Date(p.creadoEn).toDateString() === new Date(ahora).toDateString();

export type Filtro = 'todos' | 'hoy' | 'urgentes' | 'cerrados';
export type Orden = 'recientes' | 'antiguos' | 'monto';

/** Lo que se ve según el filtro, la búsqueda (código o tienda) y el orden. */
export function filtrarPedidos(lista: PedidoFila[], filtro: Filtro, busqueda: string, orden: Orden, ahora = Date.now()): PedidoFila[] {
  const texto = busqueda.trim().toLowerCase();
  // «A-1342», «a1342» o «1342» buscan el código; lo demás, el código o la tienda
  const codigo = /^(a-?)?\d+$/.test(texto) ? texto.replace(/^a-?/, '') : null;
  const coincide = (p: PedidoFila) =>
    codigo !== null ? p.codigo.toLowerCase().includes(codigo) : p.codigo.toLowerCase().includes(texto) || (p.tienda.nombre ?? '').toLowerCase().includes(texto);
  const visibles = lista.filter((p) => {
    if (texto && !coincide(p)) return false;
    const cerrado = columnaDe(p.estado) === 'cerrado';
    if (filtro === 'cerrados') return cerrado;
    if (cerrado) return false;
    if (filtro === 'hoy') return esDeHoy(p, ahora);
    if (filtro === 'urgentes') return esUrgente(p, ahora);
    return true;
  });
  const porFecha = (a: PedidoFila, b: PedidoFila) => b.creadoEn.localeCompare(a.creadoEn);
  return visibles.sort(
    orden === 'monto' ? (a, b) => b.total.centavos - a.total.centavos : orden === 'antiguos' ? (a, b) => -porFecha(a, b) : porFecha,
  );
}

const MIS_VENTAS = `
  query MisVentas {
    misVentas {
      id codigo estado metodoPago creadoEn
      total { texto centavos }
      cobro { estado }
      tienda { id nombre }
      entrega { texto zona referencia latitud longitud }
      lineas { cantidad unidades presentacion subtotal { texto } producto { id nombre foto } }
    }
  }`;

const COLUMNAS: { clave: Columna; titulo: string; icono: string; tono: string }[] = [
  { clave: 'confirmar', titulo: 'Por confirmar', icono: 'pedidos', tono: 'ambar' },
  { clave: 'preparar', titulo: 'Preparando', icono: 'caja', tono: 'lima' },
  { clave: 'reparto', titulo: 'En reparto', icono: 'camion', tono: 'menta' },
];

const MOTIVOS = ['Sin stock', 'No llegamos a esa zona', 'Precio desactualizado'];
const POR_COLUMNA = 6;

/**
 * Pedidos del mayorista como tablero: por confirmar, preparando y en reparto. Cada pedido es una tarjeta compacta
 * con un solo botón (el paso que sigue); el detalle con todos los productos se abre al costado.
 * En Inicio muestra solo los que esperan confirmación (modo «soloPorConfirmar»).
 * Confirmar es el paso 4 de la saga; rechazar dispara las compensaciones.
 */
@Component({
  selector: 'abasto-vista-pedidos',
  encapsulation: ViewEncapsulation.ShadowDom,
  imports: [Icono, NgTemplateOutlet],
  styles: [
    ESTILOS_BASE,
    `
      .orden { font: inherit; font-size: 0.98rem; color: inherit; height: 42px; border-radius: 999px; border: 0; padding: 0 2.6rem 0 1.3rem; font-weight: 600; background: hsl(var(--superficie)); box-shadow: var(--sombra-menor); appearance: none; cursor: pointer;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%23182D25' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat; background-position: right 1rem center; }
      .buscando { display: inline-flex; align-items: center; gap: 0.4rem; height: 40px; padding: 0 0.5rem 0 1rem; border-radius: 999px; background: hsl(var(--tinta)); color: #fff; font-weight: 700; }
      .buscando button { border: 0; background: rgba(255,255,255,0.15); color: #fff; border-radius: 50%; width: 28px; height: 28px; display: grid; place-items: center; }

      .tablero { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr)); gap: 1.25rem; align-items: start; }
      .columna { min-width: 0; background: hsl(var(--superficie) / 0.55); border-radius: 32px; padding: 0.7rem; display: grid; gap: 0.85rem; box-shadow: inset 0 0 0 1px hsl(var(--borde) / 0.7); }
      .columna-cabeza { display: flex; align-items: center; gap: 0.7rem; height: 50px; padding: 0 1.3rem; border-radius: 999px; font-size: 1.28rem; font-weight: 800; letter-spacing: -0.02em; }
      .columna-cabeza.ambar { background: hsl(var(--ambar)); }
      .columna-cabeza.lima { background: hsl(var(--primary)); }
      .columna-cabeza.menta { background: hsl(var(--menta)); }
      .columna-vacia { padding: 1.5rem 1rem; text-align: center; color: hsl(var(--texto-3)); }
      .ver-mas { height: 44px; border: 0; border-radius: 999px; background: hsl(var(--superficie)); font-weight: 700; box-shadow: var(--sombra-menor); }

      .grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(330px, 100%), 1fr)); gap: 1rem; }

      .pedido { min-width: 0; background: hsl(var(--superficie)); border-radius: 26px; padding: 1.05rem 1.15rem; box-shadow: var(--sombra-carta); display: grid; gap: 0.85rem; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; outline: none; }
      .pedido:hover, .pedido:focus-visible { transform: translateY(-2px); box-shadow: 0 0 0 2px hsl(var(--primary)), var(--sombra-carta); }
      .pedido-arriba { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.75rem; }
      .quien { min-width: 0; display: grid; gap: 0.15rem; }
      .codigo-fila { display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
      .codigo { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; }
      .hace { font-size: 0.8125rem; color: hsl(var(--texto-3)); font-weight: 600; }
      .hace.urgente { color: hsl(28 90% 38%); }
      .tienda { font-size: 1.15rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .zona { display: flex; align-items: center; gap: 0.3rem; font-size: 1.05rem; color: hsl(var(--texto-2)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .cuanto { display: grid; justify-items: end; align-content: start; gap: 0.45rem; padding-left: 0.85rem; border-left: 2px solid hsl(var(--borde)); }
      .cuanto strong { font-size: 1.3rem; font-weight: 800; letter-spacing: -0.02em; white-space: nowrap; }
      .pedido-abajo { display: flex; align-items: center; flex-wrap: wrap; gap: 0.6rem; }
      .fotos { display: flex; }
      .fotos .mini + .mini { margin-left: -12px; }
      .mas-productos { padding: 0.4rem 0.8rem; border-radius: 999px; background: hsl(var(--tenue)); font-size: 0.9rem; font-weight: 700; white-space: nowrap; }
      .pedido-abajo .boton-primario { margin-left: auto; }
      .estado-chico { font-size: 0.75rem; padding: 0.15rem 0.55rem; }

      .seccion-inicio { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin: 0.5rem 0 1rem; }
      .seccion-inicio h2 { margin: 0; font-size: 1.6rem; font-weight: 800; letter-spacing: -0.03em; }

      /* Detalle */
      .bloque { background: hsl(var(--superficie)); border-radius: 24px; padding: 1.1rem 1.25rem; box-shadow: var(--sombra-menor); display: grid; gap: 0.35rem; }
      .bloque h3 { margin: 0 0 0.25rem; font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.06em; color: hsl(var(--texto-3)); }
      .bloque .grande { font-size: 1.2rem; font-weight: 800; }
      .bloque a { color: hsl(var(--tinta)); font-weight: 700; text-decoration-color: hsl(var(--primary)); text-decoration-thickness: 3px; }
      .linea { display: flex; align-items: center; gap: 0.85rem; padding: 0.55rem 0; }
      .linea + .linea { border-top: 1px solid hsl(var(--borde)); }
      .linea div { flex: 1; min-width: 0; }
      .linea strong { display: block; }
      .linea .precio { font-weight: 800; white-space: nowrap; }
      .total { display: flex; justify-content: space-between; align-items: baseline; padding-top: 0.6rem; border-top: 2px solid hsl(var(--borde)); font-size: 1.25rem; font-weight: 800; }
      .motivos { display: flex; flex-wrap: wrap; gap: 0.5rem; }
      .motivo { height: 40px; padding: 0 1rem; border-radius: 999px; border: 1.5px solid hsl(var(--borde-fuerte)); background: hsl(var(--superficie)); font-weight: 600; }
      .motivo.elegido { background: hsl(var(--tinta)); color: #fff; border-color: hsl(var(--tinta)); }
      .rechazo { display: grid; gap: 0.75rem; }

      @media (max-width: 520px) { .grilla { grid-template-columns: minmax(0, 1fr); } }
    `,
  ],
  template: `
    @if (!soloPorConfirmar) {
      <div class="cabecera">
        <div>
          <h1 class="titulo-pantalla">Pedidos</h1>
          <p class="subtitulo">Gestiona tus ventas en un solo lugar</p>
        </div>
        <span class="capsula-contador">{{ pedidos().length }} {{ pedidos().length === 1 ? 'pedido' : 'pedidos' }}</span>
      </div>
    }

    <div class="cifras">
      <div class="cifra-carta">
        <span class="disco ambar"><abasto-icono nombre="pedidos" [tamano]="28" /></span><span class="linea-v"></span>
        <div><strong>{{ dosCifras(cuantos().confirmar) }}</strong><span>por confirmar</span></div>
      </div>
      <div class="cifra-carta">
        <span class="disco lima"><abasto-icono nombre="caja" [tamano]="28" /></span><span class="linea-v"></span>
        <div><strong>{{ dosCifras(cuantos().preparar) }}</strong><span>en preparación</span></div>
      </div>
      <div class="cifra-carta">
        <span class="disco menta"><abasto-icono nombre="camion" [tamano]="28" /></span><span class="linea-v"></span>
        <div><strong>{{ dosCifras(cuantos().reparto) }}</strong><span>en camino</span></div>
      </div>
    </div>

    @if (error()) { <p class="falla">{{ error() }}</p> }

    @if (soloPorConfirmar) {
      <div class="seccion-inicio">
        <h2>Pedidos por confirmar</h2>
        <button class="boton-suave" (click)="irAPedidos()">Ver todos los pedidos</button>
      </div>
      @if (cargando()) {
        <div class="carta vacio">Cargando pedidos…</div>
      } @else if (!porColumna().confirmar.length) {
        <div class="carta vacio">No hay pedidos esperando: todo confirmado.</div>
      } @else {
        <div class="grilla">
          @for (p of porColumna().confirmar; track p.id) { <ng-container *ngTemplateOutlet="tarjeta; context: { $implicit: p }" /> }
        </div>
      }
    } @else {
      <div class="barra">
        <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap">
          <div class="segmentos" role="group" aria-label="Filtrar pedidos">
            @for (f of filtros; track f.clave) {
              <button class="segmento" [class.elegido]="filtro() === f.clave" [attr.aria-pressed]="filtro() === f.clave" (click)="filtro.set(f.clave)">
                {{ f.texto }}
                @if (f.clave === 'urgentes' && urgentes()) { <small>{{ urgentes() }}</small> }
              </button>
            }
          </div>
          @if (busqueda()) {
            <span class="buscando">Buscando «{{ busqueda() }}»
              <button (click)="busqueda.set('')" aria-label="Quitar la búsqueda"><abasto-icono nombre="cerrar" [tamano]="16" /></button>
            </span>
          }
        </div>
        <label class="oculto" for="orden">Ordenar</label>
        <select id="orden" class="orden" (change)="orden.set($any($event.target).value)">
          <option value="recientes">Más recientes</option>
          <option value="antiguos">Más antiguos</option>
          <option value="monto">Mayor monto</option>
        </select>
      </div>

      @if (cargando()) {
        <div class="carta vacio">Cargando pedidos…</div>
      } @else if (filtro() === 'cerrados') {
        @if (!visibles().length) {
          <div class="carta vacio">Todavía no hay pedidos entregados ni rechazados.</div>
        } @else {
          <div class="grilla">
            @for (p of visibles(); track p.id) { <ng-container *ngTemplateOutlet="tarjeta; context: { $implicit: p }" /> }
          </div>
        }
      } @else {
        <div class="tablero">
          @for (c of columnas; track c.clave) {
            <section class="columna" [attr.aria-label]="c.titulo">
              <h2 class="columna-cabeza" [class]="'columna-cabeza ' + c.tono">
                <abasto-icono [nombre]="c.icono" [tamano]="26" /> {{ c.titulo }} ({{ porColumna()[c.clave].length }})
              </h2>
              @for (p of recortar(c.clave); track p.id) {
                <ng-container *ngTemplateOutlet="tarjeta; context: { $implicit: p }" />
              } @empty {
                <p class="columna-vacia">Nada por aquí.</p>
              }
              @if (porColumna()[c.clave].length > recortar(c.clave).length) {
                <button class="ver-mas" (click)="verTodos(c.clave)">Ver {{ porColumna()[c.clave].length - recortar(c.clave).length }} más</button>
              }
            </section>
          }
        </div>
      }
    }

    <ng-template #tarjeta let-p>
      <article class="pedido" tabindex="0" [attr.aria-label]="'Pedido ' + p.codigo" (click)="abrir(p)" (keydown.enter)="abrir(p)">
        <div class="pedido-arriba">
          <div class="quien">
            <div class="codigo-fila">
              <span class="codigo">{{ p.codigo }}</span>
              <span class="hace" [class.urgente]="urgente(p)">{{ hace(p.creadoEn) }}</span>
              @if (p.estado === 'CONFIRMADO') { <span class="insignia estado-chico advertencia">Por comprar</span> }
              @else if (p.estado === 'EN_PREPARACION') { <span class="insignia estado-chico lima">En preparación</span> }
              @else if (columna(p.estado) === 'cerrado') { <span class="insignia estado-chico" [class]="'insignia estado-chico ' + estado(p.estado).clase">{{ estado(p.estado).texto }}</span> }
            </div>
            <span class="tienda">{{ p.tienda.nombre ?? 'Tienda' }}</span>
            <span class="zona"><abasto-icono nombre="pin" [tamano]="16" /> {{ p.entrega?.zona || p.entrega?.texto || 'Sin dirección' }}</span>
          </div>
          <div class="cuanto">
            <strong>{{ p.total.texto }}</strong>
            <span class="insignia" [class]="'insignia ' + pago(p).clase">
              @if (p.metodoPago === 'QR') { <abasto-icono nombre="qr" [tamano]="15" /> }
              {{ pago(p).texto }}
            </span>
          </div>
        </div>
        <div class="pedido-abajo">
          <div class="fotos">
            @for (l of p.lineas.slice(0, 3); track $index) {
              <span class="mini" [attr.title]="l.producto.nombre">
                @if (l.producto.foto) { <img [src]="l.producto.foto" alt="" loading="lazy" /> } @else { {{ letra(l.producto.nombre) }} }
              </span>
            }
          </div>
          <span class="mas-productos">{{ resumen(p) }}</span>
          @if (accion(p); as a) {
            <button class="boton-primario boton-chico" [disabled]="ocupado() === p.id" (click)="$event.stopPropagation(); hacer(p)">{{ a }}</button>
          }
        </div>
      </article>
    </ng-template>

    @if (abierto(); as p) {
      <div class="velo" (click)="cerrar()">
        <aside class="lateral" role="dialog" [attr.aria-label]="'Pedido ' + p.codigo" (click)="$event.stopPropagation()">
          <div class="lateral-cabeza">
            <div>
              <h2>{{ p.codigo }}</h2>
              <span class="insignia" [class]="'insignia ' + estado(p.estado).clase">{{ estado(p.estado).texto }}</span>
              <span class="hace"> · {{ hace(p.creadoEn) }}</span>
            </div>
            <button class="cerrar" (click)="cerrar()" aria-label="Cerrar"><abasto-icono nombre="cerrar" /></button>
          </div>
          <div class="lateral-cuerpo">
            <div class="bloque">
              <h3>Para</h3>
              <span class="grande">{{ p.tienda.nombre ?? 'Tienda' }}</span>
              @if (p.entrega; as e) {
                <span>{{ e.texto }}</span>
                @if (e.referencia) { <span class="gris">{{ e.referencia }}</span> }
                @if (enMapa(e); as url) { <a [href]="url" target="_blank" rel="noopener">Ver en el mapa</a> }
              } @else {
                <span class="gris">El pedido no trae dirección.</span>
              }
            </div>
            <div class="bloque">
              <h3>Pago</h3>
              <span class="grande">{{ pago(p).texto }}</span>
            </div>
            <div class="bloque">
              <h3>Lleva {{ p.lineas.length }} {{ p.lineas.length === 1 ? 'producto' : 'productos' }}</h3>
              @for (l of p.lineas; track $index) {
                <div class="linea">
                  <span class="mini">
                    @if (l.producto.foto) { <img [src]="l.producto.foto" alt="" loading="lazy" /> } @else { {{ letra(l.producto.nombre) }} }
                  </span>
                  <div><strong>{{ l.producto.nombre ?? l.producto.id }}</strong><span class="gris">{{ cantidad(l) }}</span></div>
                  <span class="precio">{{ l.subtotal.texto }}</span>
                </div>
              }
              <div class="total"><span>Total</span><span>{{ p.total.texto }}</span></div>
            </div>
            @if (rechazando()) {
              <div class="bloque rechazo">
                <h3>¿Por qué lo rechazas?</h3>
                <div class="motivos">
                  @for (m of motivos; track m) {
                    <button class="motivo" [class.elegido]="motivo() === m" (click)="motivo.set(m)">{{ m }}</button>
                  }
                </div>
                <label class="oculto" for="otro-motivo">Otro motivo</label>
                <input id="otro-motivo" class="entrada" placeholder="U otro motivo" [value]="motivos.includes(motivo()) ? '' : motivo()"
                  (input)="motivo.set($any($event.target).value)" />
                <span class="gris">Se le devuelve el cobro a la tienda y se libera el stock.</span>
              </div>
            }
          </div>
          <div class="lateral-pie">
            @if (p.estado === 'POR_CONFIRMAR') {
              @if (rechazando()) {
                <button class="boton-secundario" (click)="rechazando.set(false)">Volver</button>
                <button class="boton-peligro" [disabled]="!motivo().trim() || ocupado() === p.id" (click)="rechazar(p)">Rechazar pedido</button>
              } @else {
                <button class="boton-secundario" (click)="rechazando.set(true)">Rechazar</button>
                <button class="boton-primario" [disabled]="ocupado() === p.id" (click)="hacer(p)">Confirmar</button>
              }
            } @else if (accion(p); as a) {
              <button class="boton-primario" [disabled]="ocupado() === p.id" (click)="hacer(p)">{{ a }}</button>
            } @else {
              <button class="boton-secundario" (click)="cerrar()">Cerrar</button>
            }
          </div>
        </aside>
      </div>
    }
  `,
})
export class VistaPedidos implements OnInit, OnDestroy {
  @Input() soloPorConfirmar = false;

  private readonly graphql = inject(GraphQL);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly pedidos = signal<PedidoFila[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly ocupado = signal<string | null>(null);
  readonly filtro = signal<Filtro>('todos');
  readonly orden = signal<Orden>('recientes');
  readonly busqueda = signal(busquedaDeLaUrl());
  readonly abiertoId = signal<string | null>(null);
  readonly rechazando = signal(false);
  readonly motivo = signal(MOTIVOS[0]);
  readonly todos = signal<Record<string, boolean>>({});
  readonly columnas = COLUMNAS;
  readonly motivos = MOTIVOS;
  readonly filtros: { clave: Filtro; texto: string }[] = [
    { clave: 'todos', texto: 'Todos' },
    { clave: 'hoy', texto: 'Hoy' },
    { clave: 'urgentes', texto: 'Urgentes' },
    { clave: 'cerrados', texto: 'Entregados' },
  ];

  readonly visibles = computed(() => filtrarPedidos(this.pedidos(), this.filtro(), this.busqueda(), this.orden()));
  readonly porColumna = computed(() => {
    const grupos: Record<Columna, PedidoFila[]> = { confirmar: [], preparar: [], reparto: [], cerrado: [] };
    const lista = this.soloPorConfirmar ? filtrarPedidos(this.pedidos(), 'todos', '', 'antiguos') : this.visibles();
    for (const p of lista) grupos[columnaDe(p.estado)].push(p);
    return grupos;
  });
  readonly cuantos = computed(() => {
    const c = { confirmar: 0, preparar: 0, reparto: 0 };
    for (const p of this.pedidos()) {
      const col = columnaDe(p.estado);
      if (col !== 'cerrado') c[col]++;
    }
    return c;
  });
  readonly urgentes = computed(() => this.pedidos().filter((p) => esUrgente(p)).length);
  readonly abierto = computed(() => this.pedidos().find((p) => p.id === this.abiertoId()) ?? null);

  private readonly alBuscar = (e: Event) => {
    this.busqueda.set((e as CustomEvent<{ texto: string }>).detail.texto);
    this.filtro.set('todos');
  };

  ngOnInit() {
    document.addEventListener('abasto:buscar', this.alBuscar);
    void this.cargar();
  }

  ngOnDestroy() {
    document.removeEventListener('abasto:buscar', this.alBuscar);
  }

  estado = (e: string) => ESTADOS_DE_PEDIDO[e] ?? { texto: e, clase: 'neutro' };
  columna = columnaDe;
  pago = textoDePago;
  hace = (fecha: string) => haceCuanto(fecha);
  urgente = (p: PedidoFila) => esUrgente(p);
  letra = inicial;
  dosCifras = (n: number) => String(n).padStart(2, '0');
  /** Google Maps en el punto que marcó la tienda (el repartidor lo abre en el celular) */
  enMapa = (d: NonNullable<PedidoFila['entrega']>) =>
    d.latitud !== null && d.longitud !== null ? `https://www.google.com/maps/search/?api=1&query=${d.latitud},${d.longitud}` : null;
  cantidad = (l: PedidoFila['lineas'][number]) => cantidadConUnidad(l.cantidad, l.presentacion, l.unidades);
  /** El único botón de la tarjeta: el paso que sigue */
  accion = (p: PedidoFila) => (p.estado === 'POR_CONFIRMAR' ? 'Confirmar' : (SIGUIENTE_PASO[p.estado] ?? null));
  resumen = (p: PedidoFila) => {
    const n = p.lineas.length;
    if (n > 3) return `+${n - 3} ${n - 3 === 1 ? 'producto' : 'productos'}`;
    return `${n} ${n === 1 ? 'producto' : 'productos'}`;
  };
  recortar = (c: Columna) => (this.todos()[c] ? this.porColumna()[c] : this.porColumna()[c].slice(0, POR_COLUMNA));
  verTodos = (c: Columna) => this.todos.update((t) => ({ ...t, [c]: true }));
  irAPedidos = () => pedirNavegar(this.host.nativeElement, 'pedidos');

  abrir(p: PedidoFila) {
    this.abiertoId.set(p.id);
    this.rechazando.set(false);
    this.motivo.set(MOTIVOS[0]);
  }

  cerrar() {
    this.abiertoId.set(null);
  }

  async cargar() {
    this.cargando.set(this.pedidos().length === 0);
    try {
      const datos = await this.graphql.consultar<{ misVentas: PedidoFila[] }>(MIS_VENTAS);
      this.pedidos.set(datos.misVentas);
      this.error.set(null);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  /** Confirmar o avanzar al paso que sigue */
  async hacer(p: PedidoFila) {
    if (p.estado === 'POR_CONFIRMAR') {
      await this.decidir(p, `mutation($id: ID!) { confirmarPedido(id: $id) { id estado } }`, { id: p.id }, `Confirmaste el pedido ${p.codigo}`);
      return;
    }
    const paso = SIGUIENTE_PASO[p.estado];
    if (!paso) return;
    await this.decidir(p, `mutation($id: ID!) { avanzarEntrega(id: $id) { id estado } }`, { id: p.id }, `${p.codigo}: ${paso.toLowerCase()} listo`);
  }

  async rechazar(p: PedidoFila) {
    const motivo = this.motivo().trim();
    if (!motivo) return;
    await this.decidir(p, `mutation($id: ID!, $motivo: String!) { rechazarPedido(id: $id, motivo: $motivo) { id estado } }`,
      { id: p.id, motivo }, `Rechazaste ${p.codigo}: se devuelve el cobro y se libera el stock`);
    this.cerrar();
  }

  private async decidir(p: PedidoFila, mutacion: string, variables: Record<string, unknown>, texto: string) {
    this.ocupado.set(p.id);
    try {
      const r = await this.graphql.consultar<Record<string, { estado: string }>>(mutacion, variables);
      const nuevo = Object.values(r ?? {})[0]?.estado;
      // Se mueve de columna al toque; la recarga trae el resto
      if (nuevo) this.pedidos.update((l) => l.map((x) => (x.id === p.id ? { ...x, estado: nuevo } : x)));
      avisar(this.host.nativeElement, texto);
      await this.cargar();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.ocupado.set(null);
    }
  }
}
