import { Component, ElementRef, OnDestroy, OnInit, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { ESTILOS_BASE, busquedaDeLaUrl, inicial } from '../estilos';
import { GraphQL } from '../graphql';
import { Icono } from '../icono';
import { avisar } from '../sesion';
import { bs } from './compras';

export type FormaDePago = 'EFECTIVO' | 'TRANSFERENCIA' | 'QR';

export interface CuentaFila {
  id: string;
  pedidoId: string;
  codigo: string;
  tienda: { id: string; nombre?: string | null; ciudad?: string | null };
  origen: 'CREDITO' | 'CONTRA_ENTREGA';
  monto: { centavos: number };
  pagado: { centavos: number };
  saldo: { centavos: number };
  estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADA';
  abiertaEn: string;
  venceEn: string | null;
  diasDeAtraso: number;
  pagos: { id: string; monto: { centavos: number }; forma: FormaDePago; nota?: string | null; registradoEn: string }[];
}

interface Resumen {
  porCobrar: { centavos: number };
  vencido: { centavos: number };
  tiendas: number;
  cuentas: CuentaFila[];
}

// Cobros (NestJS) da las cuentas y los pagos; Catálogo (Laravel) pone el nombre de la tienda. El Router los junta.
const CAMPOS_DE_CUENTA = `
  id pedidoId codigo origen estado abiertaEn venceEn diasDeAtraso
  tienda { id nombre ciudad }
  monto { centavos } pagado { centavos } saldo { centavos }
  pagos { id forma nota registradoEn monto { centavos } }`;

const CUENTAS = `
  query CuentasPorCobrar($conPagadas: Boolean) {
    cuentasPorCobrar(conPagadas: $conPagadas) {
      porCobrar { centavos } vencido { centavos } tiendas
      cuentas { ${CAMPOS_DE_CUENTA} }
    }
  }`;

const REGISTRAR_PAGO = `
  mutation RegistrarPago($entrada: RegistrarPagoEntrada!) {
    registrarPago(entrada: $entrada) { ${CAMPOS_DE_CUENTA} }
  }`;

export type Filtro = 'todas' | 'vencidas' | 'por-vencer' | 'contra-entrega' | 'pagadas';

export const FORMAS: { valor: FormaDePago; texto: string }[] = [
  { valor: 'EFECTIVO', texto: 'Efectivo' },
  { valor: 'TRANSFERENCIA', texto: 'Transferencia' },
  { valor: 'QR', texto: 'QR' },
];

const DIA = 86_400_000;
/** Días entre hoy y la fecha, contando días del calendario (no horas): mañana es 1 aunque falten 3 horas. */
export function diasHasta(fecha: string, hoy = new Date()): number {
  const d = new Date(fecha);
  const sinHora = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((sinHora(d) - sinHora(hoy)) / DIA);
}

const ddmm = (fecha: string) => {
  const d = new Date(fecha);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Cómo se dice el vencimiento de una cuenta, con el color de su urgencia. */
export function vencimientoDe(c: CuentaFila, hoy = new Date()): { texto: string; clase: string } {
  if (c.estado === 'PAGADA') return { texto: 'Pagada', clase: 'exito' };
  if (!c.venceEn) return { texto: 'Cobra al entregar', clase: 'neutro' };
  const dias = diasHasta(c.venceEn, hoy);
  if (dias < 0) return { texto: dias === -1 ? 'Venció ayer' : `Venció hace ${-dias} días`, clase: 'error' };
  if (dias === 0) return { texto: 'Vence hoy', clase: 'error' };
  if (dias === 1) return { texto: 'Vence mañana', clase: 'advertencia' };
  if (dias <= 7) return { texto: `Vence en ${dias} días`, clase: 'advertencia' };
  return { texto: `Vence el ${ddmm(c.venceEn)}`, clase: 'lima' };
}

/** Las cuentas de cada filtro, y después las que coinciden con lo buscado (tienda o código). */
export function filtrarCuentas(cuentas: CuentaFila[], filtro: Filtro, texto: string, hoy = new Date()): CuentaFila[] {
  const abiertas = (c: CuentaFila) => c.estado !== 'PAGADA';
  const porFiltro: Record<Filtro, (c: CuentaFila) => boolean> = {
    todas: abiertas,
    vencidas: (c) => abiertas(c) && !!c.venceEn && diasHasta(c.venceEn, hoy) < 0,
    'por-vencer': (c) => abiertas(c) && !!c.venceEn && diasHasta(c.venceEn, hoy) >= 0 && diasHasta(c.venceEn, hoy) <= 7,
    'contra-entrega': (c) => abiertas(c) && c.origen === 'CONTRA_ENTREGA',
    pagadas: (c) => c.estado === 'PAGADA',
  };
  const buscado = texto.trim().toLowerCase();
  return cuentas
    .filter(porFiltro[filtro])
    .filter((c) => !buscado || c.codigo.toLowerCase().includes(buscado) || (c.tienda.nombre ?? '').toLowerCase().includes(buscado));
}

/**
 * «150», «150,50», «1.200,50» o «1200.50» → centavos. Null si no es un monto.
 * Como en Bolivia: la coma es el decimal y el punto separa los miles.
 */
export function centavosDe(texto: string): number | null {
  let limpio = texto.trim().replace(/^bs\.?\s*/i, '').replace(/\s/g, '');
  if (!limpio) return null;
  if (limpio.includes(',')) limpio = limpio.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) limpio = limpio.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  return Math.round(Number(limpio) * 100);
}

/** «1200.5» centavos → «1.200,50» para el campo del monto. */
const montoEnTexto = (centavos: number) => (centavos / 100).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const nuevoId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/**
 * CU-09 · Cuentas por cobrar (versión 7 «Halo»).
 * Lo que te deben las tiendas por los pedidos a crédito y contra entrega: lo más atrasado primero. Un toque abre la cuenta
 * al costado para anotar un pago (todo o una parte) en efectivo, transferencia o QR.
 */
@Component({
  selector: 'abasto-vista-cuentas',
  encapsulation: ViewEncapsulation.ShadowDom,
  imports: [Icono],
  styles: [
    ESTILOS_BASE,
    `
      .cifra-carta.alerta strong { color: hsl(var(--error-suave-texto)); }
      .buscador { position: relative; display: flex; align-items: center; }
      .buscador abasto-icono { position: absolute; left: 1rem; color: hsl(var(--texto-3)); pointer-events: none; }
      .buscador .entrada { padding-left: 2.8rem; width: min(340px, 100%); border-radius: 999px; }

      .lista { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(560px, 100%), 1fr)); gap: 1rem; }
      .cuenta { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 1rem 1.1rem; padding: 1.1rem 1.3rem;
        border-radius: 30px; background: hsl(var(--superficie)); box-shadow: var(--sombra-carta); border: 0; text-align: left; color: inherit;
        cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; }
      .cuenta:hover { transform: translateY(-2px); }
      .cuenta.atrasada { box-shadow: inset 5px 0 0 hsl(var(--error-suave-texto)), var(--sombra-carta); }
      .avatar { width: 56px; height: 56px; border-radius: 20px; display: grid; place-items: center; font-size: 1.4rem; font-weight: 800; background: hsl(var(--primary-suave)); color: hsl(var(--tinta)); }
      .avatar.ambar { background: hsl(var(--ambar) / 0.6); }
      .quien { min-width: 0; display: grid; gap: 0.35rem; }
      .quien strong { font-size: 1.2rem; font-weight: 800; letter-spacing: -0.02em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .datos { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; color: hsl(var(--texto-2)); font-size: 0.95rem; }
      .codigo { padding: 0.15rem 0.6rem; border-radius: 999px; background: hsl(var(--tenue)); font-weight: 700; font-size: 0.85rem; color: hsl(var(--tinta)); }
      .saldo { display: grid; justify-items: end; gap: 0.45rem; text-align: right; }
      .saldo strong { font-size: 1.55rem; font-weight: 800; letter-spacing: -0.03em; white-space: nowrap; }
      .saldo small { color: hsl(var(--texto-2)); font-size: 0.9rem; }
      .progreso { grid-column: 2 / -1; display: flex; align-items: center; gap: 0.8rem; }
      .barra-pago { flex: 1; height: 10px; border-radius: 999px; background: hsl(var(--tenue)); overflow: hidden; }
      .barra-pago span { display: block; height: 100%; border-radius: 999px; background: hsl(var(--primary)); }
      .progreso .boton-primario { flex: none; }

      .bloque { display: grid; gap: 0.5rem; padding: 1.1rem 1.25rem; border-radius: 24px; background: hsl(var(--superficie)); }
      .bloque h3 { margin: 0; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: hsl(var(--texto-3)); }
      .grande { font-size: 1.3rem; font-weight: 800; letter-spacing: -0.02em; }
      .numeros { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; }
      .numeros div { display: grid; gap: 0.2rem; }
      .numeros span { color: hsl(var(--texto-2)); font-size: 0.9rem; }
      .numeros strong { font-size: 1.15rem; font-weight: 800; white-space: nowrap; }
      .numeros .debe strong { font-size: 1.35rem; }
      .campo { display: grid; gap: 0.45rem; }
      .campo label { font-weight: 700; }
      .monto { display: flex; align-items: center; gap: 0.5rem; }
      .monto .entrada { flex: 1; width: 100%; min-width: 0; height: 56px; font-size: 1.5rem; font-weight: 800; }
      .monto .moneda { font-size: 1.3rem; font-weight: 800; color: hsl(var(--texto-2)); }
      .atajos { display: flex; gap: 0.5rem; flex-wrap: wrap; }
      .aviso-campo { color: hsl(var(--error-suave-texto)); font-weight: 600; font-size: 0.9rem; }
      .pago { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.75rem; padding: 0.55rem 0; }
      .pago + .pago { border-top: 1px solid hsl(var(--borde)); }
      .pago .disco { width: 40px; height: 40px; border-radius: 14px; }

      @media (max-width: 600px) {
        .cuenta { grid-template-columns: auto minmax(0, 1fr); }
        .saldo { grid-column: 1 / -1; justify-items: start; text-align: left; }
        .progreso { grid-column: 1 / -1; }
        .numeros { grid-template-columns: 1fr 1fr; }
      }
    `,
  ],
  template: `
    <div class="cabecera">
      <div>
        <h1 class="titulo-pantalla">Cuentas por cobrar</h1>
        <p class="subtitulo">Lo que te deben tus clientes y cuándo vence</p>
      </div>
      <span class="capsula-contador"><abasto-icono nombre="clientes" [tamano]="24" />
        {{ resumen()?.tiendas ?? 0 }} {{ resumen()?.tiendas === 1 ? 'tienda te debe' : 'tiendas te deben' }}</span>
    </div>

    <div class="cifras">
      <button class="cifra-carta" [class.elegida]="filtro() === 'todas'" (click)="elegir('todas')">
        <span class="disco lima"><abasto-icono nombre="billete" [tamano]="30" /></span><span class="linea-v"></span>
        <div><strong>{{ bs(resumen()?.porCobrar?.centavos ?? 0) }}</strong><span>Por cobrar</span></div>
      </button>
      <button class="cifra-carta" [class.alerta]="(resumen()?.vencido?.centavos ?? 0) > 0" [class.elegida]="filtro() === 'vencidas'" (click)="elegir('vencidas')">
        <span class="disco rojo"><abasto-icono nombre="alerta" [tamano]="30" /></span><span class="linea-v"></span>
        <div><strong>{{ bs(resumen()?.vencido?.centavos ?? 0) }}</strong><span>Vencido</span></div>
      </button>
      <button class="cifra-carta" [class.elegida]="filtro() === 'por-vencer'" (click)="elegir('por-vencer')">
        <span class="disco ambar"><abasto-icono nombre="calendario" [tamano]="30" /></span><span class="linea-v"></span>
        <div><strong>{{ bs(venceEstaSemana()) }}</strong><span>Vence en 7 días</span></div>
      </button>
    </div>

    <div class="barra">
      <div class="segmentos" role="group" aria-label="Filtrar cuentas">
        @for (f of filtros; track f.valor) {
          <button class="segmento" [class.elegido]="filtro() === f.valor" [attr.aria-pressed]="filtro() === f.valor" (click)="elegir(f.valor)">
            {{ f.texto }} @if (cuantas(f.valor); as n) { <small>{{ n }}</small> }
          </button>
        }
      </div>
      <label class="buscador">
        <span class="oculto">Buscar una tienda o un pedido</span>
        <abasto-icono nombre="buscar" [tamano]="20" />
        <input class="entrada" type="search" placeholder="Busca una tienda o un pedido" [value]="busqueda()" (input)="busqueda.set($any($event.target).value)" />
      </label>
    </div>

    @if (error()) {
      <p class="falla">{{ error() }}</p>
    }
    @if (cargando() && !resumen()) {
      <div class="carta vacio">Sumando lo que te deben…</div>
    } @else if (!visibles().length) {
      <div class="carta vacio">{{ textoVacio() }}</div>
    } @else {
      <div class="lista">
        @for (c of visibles(); track c.id) {
          <article class="cuenta" [class.atrasada]="c.diasDeAtraso > 0" tabindex="0" role="button" [attr.aria-label]="'Cuenta ' + c.codigo"
            (click)="abrir(c)" (keydown.enter)="abrir(c)">
            <span class="avatar" [class.ambar]="c.origen === 'CONTRA_ENTREGA'">{{ letra(c.tienda.nombre) }}</span>
            <div class="quien">
              <strong>{{ c.tienda.nombre ?? 'Tienda' }}</strong>
              <div class="datos">
                <span class="codigo">{{ c.codigo }}</span>
                <span>{{ c.origen === 'CREDITO' ? 'A crédito' : 'Contra entrega' }}</span>
                <span class="insignia" [class]="'insignia ' + vence(c).clase">{{ vence(c).texto }}</span>
              </div>
            </div>
            <div class="saldo">
              <strong>{{ bs(c.estado === 'PAGADA' ? c.monto.centavos : c.saldo.centavos) }}</strong>
              <small>{{ c.estado === 'PAGADA' ? 'Cobrado' : c.pagado.centavos ? 'Debe de ' + bs(c.monto.centavos) : 'Debe' }}</small>
            </div>
            <div class="progreso">
              <div class="barra-pago" role="progressbar" [attr.aria-valuenow]="c.pagado.centavos" aria-valuemin="0" [attr.aria-valuemax]="c.monto.centavos"
                [attr.aria-label]="'Pagado ' + bs(c.pagado.centavos) + ' de ' + bs(c.monto.centavos)">
                <span [style.width.%]="(c.pagado.centavos / c.monto.centavos) * 100"></span>
              </div>
              @if (c.estado !== 'PAGADA') {
                <button class="boton-primario boton-chico" (click)="$event.stopPropagation(); abrir(c)">Registrar pago</button>
              }
            </div>
          </article>
        }
      </div>
    }

    @if (abierta(); as c) {
      <div class="velo" (click)="cerrar()">
        <aside class="lateral" role="dialog" [attr.aria-label]="'Cuenta ' + c.codigo" (click)="$event.stopPropagation()">
          <div class="lateral-cabeza">
            <div>
              <h2>{{ c.tienda.nombre ?? 'Tienda' }}</h2>
              <span class="insignia" [class]="'insignia ' + vence(c).clase">{{ vence(c).texto }}</span>
              <span class="gris" style="display:inline"> · Pedido {{ c.codigo }} · {{ c.origen === 'CREDITO' ? 'a crédito' : 'contra entrega' }}</span>
            </div>
            <button class="cerrar" (click)="cerrar()" aria-label="Cerrar"><abasto-icono nombre="cerrar" /></button>
          </div>
          <div class="lateral-cuerpo">
            <div class="bloque">
              <div class="numeros">
                <div><span>Pedido</span><strong>{{ bs(c.monto.centavos) }}</strong></div>
                <div><span>Pagó</span><strong>{{ bs(c.pagado.centavos) }}</strong></div>
                <div class="debe"><span>Debe</span><strong>{{ bs(c.saldo.centavos) }}</strong></div>
              </div>
            </div>

            @if (c.estado !== 'PAGADA') {
              <div class="bloque">
                <h3>Registrar un pago</h3>
                <div class="campo">
                  <label for="monto">¿Cuánto te pagó?</label>
                  <div class="monto">
                    <span class="moneda">Bs</span>
                    <input id="monto" class="entrada" inputmode="decimal" autocomplete="off" [value]="monto()"
                      (input)="monto.set($any($event.target).value)" (keydown.enter)="registrar(c)" />
                  </div>
                  <div class="atajos">
                    <button class="boton-suave boton-chico" (click)="monto.set(enTexto(c.saldo.centavos))">Todo · {{ bs(c.saldo.centavos) }}</button>
                    @if (c.saldo.centavos >= 200) {
                      <button class="boton-secundario boton-chico" (click)="monto.set(enTexto(mitad(c)))">La mitad</button>
                    }
                  </div>
                  @if (problemaDelMonto(c); as p) { <span class="aviso-campo">{{ p }}</span> }
                </div>
                <div class="campo">
                  <span style="font-weight:700">¿Cómo te pagó?</span>
                  <div class="segmentos" role="group" aria-label="Forma de pago">
                    @for (f of formas; track f.valor) {
                      <button class="segmento" [class.elegido]="forma() === f.valor" [attr.aria-pressed]="forma() === f.valor" (click)="forma.set(f.valor)">{{ f.texto }}</button>
                    }
                  </div>
                </div>
                <div class="campo">
                  <label for="nota">Nota (opcional)</label>
                  <input id="nota" class="entrada" placeholder="Ej.: lo trajo el repartidor" [value]="nota()" (input)="nota.set($any($event.target).value)" />
                </div>
              </div>
            }

            <div class="bloque">
              <h3>Pagos</h3>
              @for (p of c.pagos; track p.id) {
                <div class="pago">
                  <span class="disco lima"><abasto-icono [nombre]="p.forma === 'QR' ? 'qr' : 'billete'" [tamano]="20" /></span>
                  <div><strong>{{ formaEnTexto(p.forma) }}</strong><span class="gris">{{ fecha(p.registradoEn) }}{{ p.nota ? ' · ' + p.nota : '' }}</span></div>
                  <strong>{{ bs(p.monto.centavos) }}</strong>
                </div>
              } @empty {
                <span class="gris">Todavía no pagó nada.</span>
              }
            </div>
          </div>
          <div class="lateral-pie">
            @if (c.estado !== 'PAGADA') {
              <button class="boton-secundario" (click)="cerrar()">Cancelar</button>
              <button class="boton-primario" [disabled]="guardando() || !!problemaDelMonto(c) || !monto().trim()" (click)="registrar(c)">
                <abasto-icono nombre="check" [tamano]="20" /> Registrar {{ centavos() ? bs(centavos()!) : 'pago' }}
              </button>
            } @else {
              <button class="boton-secundario" (click)="cerrar()">Cerrar</button>
            }
          </div>
        </aside>
      </div>
    }
  `,
})
export class VistaCuentas implements OnInit, OnDestroy {
  private readonly graphql = inject(GraphQL);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly resumen = signal<Resumen | null>(null);
  readonly pagadas = signal<CuentaFila[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly filtro = signal<Filtro>('todas');
  readonly busqueda = signal(busquedaDeLaUrl());
  /** Se guarda el id, no la cuenta: el panel siempre muestra la versión más nueva de la lista. */
  private readonly abiertaId = signal<string | null>(null);
  readonly monto = signal('');
  readonly forma = signal<FormaDePago>('EFECTIVO');
  readonly nota = signal('');
  readonly guardando = signal(false);
  /** El id del pago que se está por registrar: si se toca dos veces o se reenvía sin señal, Cobros lo cuenta una vez. */
  private pagoId = nuevoId();

  readonly bs = bs;
  readonly letra = inicial;
  readonly vence = (c: CuentaFila) => vencimientoDe(c);
  readonly enTexto = montoEnTexto;
  readonly formas = FORMAS;
  readonly filtros: { valor: Filtro; texto: string }[] = [
    { valor: 'todas', texto: 'Todas' },
    { valor: 'vencidas', texto: 'Vencidas' },
    { valor: 'por-vencer', texto: 'Por vencer' },
    { valor: 'contra-entrega', texto: 'Contra entrega' },
    { valor: 'pagadas', texto: 'Pagadas' },
  ];

  private readonly todas = computed(() => [...(this.resumen()?.cuentas ?? []), ...this.pagadas()]);
  readonly abierta = computed(() => this.todas().find((c) => c.id === this.abiertaId()) ?? null);
  readonly visibles = computed(() => filtrarCuentas(this.todas(), this.filtro(), this.busqueda()));
  readonly venceEstaSemana = computed(() => filtrarCuentas(this.todas(), 'por-vencer', '').reduce((t, c) => t + c.saldo.centavos, 0));
  readonly centavos = computed(() => centavosDe(this.monto()));

  private readonly alBuscar = (e: Event) => this.busqueda.set((e as CustomEvent<{ texto: string }>).detail?.texto ?? '');

  ngOnInit() {
    document.addEventListener('abasto:buscar', this.alBuscar);
    void this.cargar();
  }

  ngOnDestroy() {
    document.removeEventListener('abasto:buscar', this.alBuscar);
  }

  cuantas(filtro: Filtro): number {
    return filtro === 'pagadas' ? 0 : filtrarCuentas(this.todas(), filtro, '').length;
  }

  textoVacio(): string {
    if (this.busqueda().trim()) return `Nada coincide con «${this.busqueda().trim()}».`;
    const textos: Record<Filtro, string> = {
      todas: 'Nadie te debe nada. Las ventas a crédito y contra entrega aparecen aquí cuando confirmas el pedido.',
      vencidas: 'No hay cuentas vencidas.',
      'por-vencer': 'Nada vence en los próximos 7 días.',
      'contra-entrega': 'No hay cobros contra entrega pendientes.',
      pagadas: 'Todavía no se terminó de pagar ninguna cuenta.',
    };
    return textos[this.filtro()];
  }

  elegir(f: Filtro) {
    this.filtro.set(f);
    if (f === 'pagadas' && !this.pagadas().length) void this.cargarPagadas();
  }

  abrir(c: CuentaFila) {
    this.abiertaId.set(c.id);
    this.monto.set(c.estado === 'PAGADA' ? '' : montoEnTexto(c.saldo.centavos));
    this.forma.set('EFECTIVO');
    this.nota.set('');
    this.pagoId = nuevoId();
  }

  cerrar() {
    this.abiertaId.set(null);
  }

  mitad = (c: CuentaFila) => Math.round(c.saldo.centavos / 2);
  formaEnTexto = (f: FormaDePago) => FORMAS.find((x) => x.valor === f)?.texto ?? f;
  fecha = (iso: string) => new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  problemaDelMonto(c: CuentaFila): string | null {
    if (!this.monto().trim()) return null;
    const centavos = this.centavos();
    if (centavos === null) return 'Escribe el monto así: 150 o 150,50';
    if (centavos <= 0) return 'El pago tiene que ser mayor a cero';
    if (centavos > c.saldo.centavos) return `Debe ${bs(c.saldo.centavos)}: no puedes cobrar más`;
    return null;
  }

  async registrar(c: CuentaFila) {
    const centavos = this.centavos();
    if (this.guardando() || centavos === null || this.problemaDelMonto(c)) return;
    this.guardando.set(true);
    try {
      const nota = this.nota().trim();
      const r = await this.graphql.consultar<{ registrarPago: CuentaFila }>(REGISTRAR_PAGO, {
        entrada: { pagoId: this.pagoId, pedidoId: c.pedidoId, centavos, forma: this.forma(), nota: nota || null },
      });
      const nueva = r.registrarPago;
      this.pagoId = nuevoId();
      // La lista cambia al toque con lo que devolvió Cobros; la recarga trae los totales
      this.resumen.update((x) => (x ? { ...x, cuentas: x.cuentas.map((y) => (y.id === nueva.id ? nueva : y)) } : x));
      avisar(
        this.host.nativeElement,
        nueva.estado === 'PAGADA'
          ? `${c.tienda.nombre ?? 'La tienda'} terminó de pagar ${c.codigo}`
          : `Registraste ${bs(centavos)} de ${c.tienda.nombre ?? 'la tienda'}: todavía debe ${bs(nueva.saldo.centavos)}`,
      );
      this.cerrar();
      await this.cargar();
      if (this.pagadas().length || nueva.estado === 'PAGADA') await this.cargarPagadas();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.guardando.set(false);
    }
  }

  async cargar() {
    this.cargando.set(true);
    try {
      const datos = await this.graphql.consultar<{ cuentasPorCobrar: Resumen }>(CUENTAS, { conPagadas: false });
      this.resumen.set(datos.cuentasPorCobrar);
      this.error.set(null);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  private async cargarPagadas() {
    try {
      const datos = await this.graphql.consultar<{ cuentasPorCobrar: Resumen }>(CUENTAS, { conPagadas: true });
      this.pagadas.set(datos.cuentasPorCobrar.cuentas.filter((c) => c.estado === 'PAGADA'));
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
}
