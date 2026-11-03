import { Component, ElementRef, OnInit, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { ESTILOS_BASE, haceCuanto, inicial } from '../estilos';
import { GraphQL } from '../graphql';
import { Icono } from '../icono';
import { avisar, pedirNavegar } from '../sesion';

export type Origen = 'whatsapp' | 'tienda-en-linea' | 'app-sin-senal' | 'api';
export type EstadoDeEntrada = 'aplicada' | 'repetida' | 'conflicto' | 'rechazada';

export interface EntradaDeBitacora {
  clave: string;
  origen: Origen;
  estado: EstadoDeEntrada;
  ocurridoEn: string;
  tiendaId: string | null;
  tiendaNombre: string | null;
  codigo: string | null;
  total: string | null;
  error: string | null;
}

interface Bitacora {
  resumen: { aplicadas: number; repetidas: number; conProblemas: number };
  entradas: EntradaDeBitacora[];
}

export const ORIGEN: Record<Origen, { texto: string; icono: string }> = {
  whatsapp: { texto: 'WhatsApp', icono: 'mensaje' },
  'tienda-en-linea': { texto: 'Tienda en línea', icono: 'tienda' },
  'app-sin-senal': { texto: 'App sin señal', icono: 'celular' },
  api: { texto: 'API', icono: 'enchufe' },
};

/** Qué le pasó a lo que entró, dicho para el mayorista. */
export function estadoDe(e: EntradaDeBitacora): { texto: string; clase: string } {
  switch (e.estado) {
    case 'aplicada':
      return { texto: 'Pedido creado', clase: 'exito' };
    case 'repetida':
      return { texto: 'Repetido: no se duplicó', clase: 'lima' };
    case 'conflicto':
      return { texto: 'Misma clave, otro contenido', clase: 'error' };
    default:
      return { texto: 'No entró', clase: 'error' };
  }
}

const CAMPOS: Record<string, string> = { presentacion: 'la presentación', cantidad: 'la cantidad', productoId: 'el producto' };

/** El motivo técnico que devuelve el Router, dicho para el mayorista. Lo que ya está en español pasa tal cual. */
export function motivoLegible(error: string): string {
  const linea = /\$entrada\.lineas\[(\d+)\]\.(\w+)/.exec(error);
  if (/invalid input value|found JSON|expected type|cannot represent/i.test(error)) {
    return linea
      ? `Llegó con un dato que no se entiende: ${CAMPOS[linea[2]] ?? linea[2]} de la línea ${Number(linea[1]) + 1}`
      : 'Llegó con datos que Abasto no entiende';
  }
  if (/sesi[oó]n|token|unauthorized/i.test(error)) return 'La tienda no tenía una sesión válida';
  return error;
}

/** Recién creado, el pedido vale Bs 0,00 hasta que Catálogo pone los precios: ese total no se muestra. */
export const totalVisible = (e: EntradaDeBitacora) => (e.total && !/^Bs 0,00$/.test(e.total) ? e.total : null);

export type Filtro = 'todos' | Origen | 'problemas';

export function filtrarEntradas(entradas: EntradaDeBitacora[], filtro: Filtro): EntradaDeBitacora[] {
  if (filtro === 'todos') return entradas;
  if (filtro === 'problemas') return entradas.filter((e) => e.estado === 'rechazada' || e.estado === 'conflicto');
  return entradas.filter((e) => e.origen === filtro);
}

/** El pedido de ejemplo para una tienda en línea: el mismo cuerpo que manda n8n. */
export function ejemploDePedido(urlConecta: string, mayoristaId: string): string {
  return [
    `curl -X POST ${urlConecta}/v1/pedidos \\`,
    `  -H "Authorization: Bearer <token de la tienda>" \\`,
    `  -H "Idempotency-Key: <un UUID por pedido>" \\`,
    `  -H "X-Abasto-Origen: tienda-en-linea" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"mayoristaId":"${mayoristaId}","metodoPago":"CONTRA_ENTREGA","lineas":[{"productoId":"AB-101","presentacion":"UNIDAD","cantidad":2}]}'`,
  ].join('\n');
}

/**
 * Conecta (F3, versión 7 «Halo»): los pedidos que le llegan al mayorista desde afuera del Panel
 * (WhatsApp por n8n, una tienda en línea por la API o la app que estuvo sin señal) y qué pasó con cada uno.
 * Muestra la idempotencia en acción: un reintento sale como «Repetido: no se duplicó».
 */
@Component({
  selector: 'abasto-vista-conecta',
  encapsulation: ViewEncapsulation.ShadowDom,
  imports: [Icono],
  styles: [
    ESTILOS_BASE,
    `
      .columnas { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 440px); gap: 1.25rem; align-items: start; }
      .lista { display: grid; gap: 0.25rem; padding: 0.6rem 1rem; }
      .entrada-b { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.9rem; padding: 0.85rem 0.3rem; }
      .entrada-b + .entrada-b { border-top: 1px solid hsl(var(--borde)); }
      .quien { min-width: 0; display: grid; gap: 0.3rem; }
      .quien strong { font-size: 1.1rem; font-weight: 800; letter-spacing: -0.01em; }
      .datos { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; color: hsl(var(--texto-2)); font-size: 0.92rem; }
      .codigo { padding: 0.15rem 0.6rem; border-radius: 999px; background: hsl(var(--tenue)); font-weight: 700; font-size: 0.85rem; color: hsl(var(--tinta)); }
      .motivo { color: hsl(var(--error-suave-texto)); font-size: 0.9rem; }
      .derecha { display: grid; justify-items: end; gap: 0.35rem; text-align: right; }
      .derecha strong { font-size: 1.15rem; font-weight: 800; white-space: nowrap; }
      .lado { display: grid; gap: 1.25rem; }
      .lado h2 { margin: 0 0 0.3rem; font-size: 1.3rem; font-weight: 800; letter-spacing: -0.02em; }
      .lado p { margin: 0 0 0.8rem; color: hsl(var(--texto-2)); line-height: 1.45; }
      .via { display: flex; gap: 0.8rem; align-items: flex-start; }
      .via + .via { margin-top: 0.9rem; }
      .via strong { display: block; }
      .via span.gris { font-size: 0.9rem; }
      pre { margin: 0 0 0.8rem; padding: 0.9rem 1rem; border-radius: 18px; background: hsl(var(--tinta)); color: hsl(77 87% 80%); font-family: var(--fuente-mono); font-size: 0.78rem; line-height: 1.5; white-space: pre-wrap; word-break: break-all; }
      @media (max-width: 860px) { .columnas { grid-template-columns: minmax(0, 1fr); } }
      @media (max-width: 600px) { .entrada-b { grid-template-columns: auto minmax(0, 1fr); } .derecha { grid-column: 2; justify-items: start; text-align: left; } }
    `,
  ],
  template: `
    <div class="cabecera">
      <div>
        <h1 class="titulo-pantalla">Conecta</h1>
        <p class="subtitulo">Los pedidos que te llegan por WhatsApp, tu tienda en línea o la app sin señal</p>
      </div>
      <span class="capsula-contador"><abasto-icono nombre="calendario" [tamano]="24" /> Últimos 30 días</span>
    </div>

    <div class="cifras">
      <div class="cifra-carta">
        <span class="disco lima"><abasto-icono nombre="check" [tamano]="30" /></span><span class="linea-v"></span>
        <div><strong>{{ bitacora()?.resumen?.aplicadas ?? 0 }}</strong><span>Pedidos que entraron</span></div>
      </div>
      <div class="cifra-carta">
        <span class="disco menta"><abasto-icono nombre="repetir" [tamano]="30" /></span><span class="linea-v"></span>
        <div><strong>{{ bitacora()?.resumen?.repetidas ?? 0 }}</strong><span>Repetidos que no se duplicaron</span></div>
      </div>
      <button class="cifra-carta" [class.elegida]="filtro() === 'problemas'" (click)="filtro.set(filtro() === 'problemas' ? 'todos' : 'problemas')">
        <span class="disco rojo"><abasto-icono nombre="alerta" [tamano]="30" /></span><span class="linea-v"></span>
        <div><strong>{{ bitacora()?.resumen?.conProblemas ?? 0 }}</strong><span>Con problemas</span></div>
      </button>
    </div>

    <div class="barra">
      <div class="segmentos" role="group" aria-label="Filtrar por origen">
        @for (f of filtros; track f.valor) {
          <button class="segmento" [class.elegido]="filtro() === f.valor" [attr.aria-pressed]="filtro() === f.valor" (click)="filtro.set(f.valor)">{{ f.texto }}</button>
        }
      </div>
      <button class="boton-secundario" (click)="cargar()" [disabled]="cargando()"><abasto-icono nombre="repetir" [tamano]="18" /> Actualizar</button>
    </div>

    @if (error()) { <p class="falla">{{ error() }}</p> }

    <div class="columnas">
      <section class="carta" style="padding: 0" aria-label="Lo que entró">
        @if (cargando() && !bitacora()) {
          <div class="vacio">Buscando lo que entró…</div>
        } @else if (!visibles().length) {
          <div class="vacio">{{ filtro() === 'todos' ? 'Todavía no entró ningún pedido de afuera. Cuando te pidan por WhatsApp o desde una tienda en línea, aparece aquí.' : 'Nada por aquí.' }}</div>
        } @else {
          <div class="lista">
            @for (e of visibles(); track e.clave + e.ocurridoEn) {
              <article class="entrada-b" [attr.aria-label]="(e.codigo ?? 'Pedido') + ' por ' + origen(e).texto">
                <span class="disco chico" [class.lima]="e.estado === 'aplicada'" [class.menta]="e.estado === 'repetida'" [class.rojo]="e.estado === 'rechazada' || e.estado === 'conflicto'">
                  <abasto-icono [nombre]="origen(e).icono" [tamano]="20" />
                </span>
                <div class="quien">
                  <strong>{{ e.tiendaNombre ?? (e.tiendaId ? 'Cliente ' + e.tiendaId : 'Sin cliente') }}</strong>
                  <div class="datos">
                    @if (e.codigo) { <span class="codigo">{{ e.codigo }}</span> }
                    <span>{{ origen(e).texto }}</span>
                    <span>· {{ hace(e.ocurridoEn) }}</span>
                  </div>
                  @if (e.error) { <span class="motivo">{{ motivo(e.error) }}</span> }
                </div>
                <div class="derecha">
                  <span class="insignia" [class]="'insignia ' + estado(e).clase">{{ estado(e).texto }}</span>
                  @if (total(e); as t) { <strong>{{ t }}</strong> }
                  @if (e.codigo && e.estado !== 'rechazada') {
                    <button class="boton-suave boton-chico" (click)="verPedido(e.codigo)">Ver pedido</button>
                  }
                </div>
              </article>
            }
          </div>
        }
      </section>

      <aside class="lado">
        <div class="carta">
          <h2>Por dónde te llegan</h2>
          <div class="via">
            <span class="disco chico lima"><abasto-icono nombre="mensaje" [tamano]="20" /></span>
            <div><strong>WhatsApp</strong><span class="gris">Un mensaje como «2 cajas HP-0400» se vuelve pedido solo (n8n). Si WhatsApp reenvía el mensaje, no se duplica.</span></div>
          </div>
          <div class="via">
            <span class="disco chico ambar"><abasto-icono nombre="tienda" [tamano]="20" /></span>
            <div><strong>Tienda en línea</strong><span class="gris">Tu tienda web o WooCommerce manda el pedido a la API de Abasto.</span></div>
          </div>
          <div class="via">
            <span class="disco chico menta"><abasto-icono nombre="celular" [tamano]="20" /></span>
            <div><strong>App sin señal</strong><span class="gris">Lo que la tienda pidió sin internet llega cuando vuelve la señal, una sola vez.</span></div>
          </div>
        </div>
        <div class="carta">
          <h2>Conecta tu tienda en línea</h2>
          <p>Cada pedido lleva una <strong>Idempotency-Key</strong> nueva. Si tu tienda lo reintenta con la misma, Abasto devuelve la misma respuesta y no crea otro.</p>
          <pre>{{ ejemplo() }}</pre>
          <button class="boton-oscuro" (click)="copiar()"><abasto-icono nombre="copiar" [tamano]="18" /> Copiar ejemplo</button>
        </div>
      </aside>
    </div>
  `,
})
export class VistaConecta implements OnInit {
  private readonly graphql = inject(GraphQL);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly bitacora = signal<Bitacora | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly filtro = signal<Filtro>('todos');
  readonly filtros: { valor: Filtro; texto: string }[] = [
    { valor: 'todos', texto: 'Todos' },
    { valor: 'whatsapp', texto: 'WhatsApp' },
    { valor: 'tienda-en-linea', texto: 'Tienda en línea' },
    { valor: 'app-sin-senal', texto: 'App sin señal' },
    { valor: 'api', texto: 'API' },
  ];

  readonly visibles = computed(() => filtrarEntradas(this.bitacora()?.entradas ?? [], this.filtro()));
  readonly ejemplo = computed(() => {
    const s = this.graphql.sesion();
    return ejemploDePedido(s?.urls.conecta ?? 'http://localhost:8084', s?.usuario.orgId ?? 'tu-empresa');
  });

  readonly origen = (e: EntradaDeBitacora) => ORIGEN[e.origen] ?? ORIGEN.api;
  readonly estado = estadoDe;
  readonly motivo = motivoLegible;
  readonly total = totalVisible;
  readonly hace = (iso: string) => haceCuanto(iso);
  readonly letra = inicial;

  ngOnInit() {
    void this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    try {
      this.bitacora.set(await this.graphql.leerDeConecta<Bitacora>('/v1/bitacora'));
      this.error.set(null);
    } catch (e) {
      this.error.set(`No se pudo leer lo que entró: ${(e as Error).message}`);
    } finally {
      this.cargando.set(false);
    }
  }

  verPedido(codigo: string) {
    pedirNavegar(this.host.nativeElement, `pedidos?q=${encodeURIComponent(codigo)}`);
  }

  async copiar() {
    try {
      await navigator.clipboard.writeText(this.ejemplo());
      avisar(this.host.nativeElement, 'Copiaste el ejemplo: pásaselo a quien maneja tu tienda en línea');
    } catch {
      avisar(this.host.nativeElement, 'No se pudo copiar: selecciona el texto y cópialo a mano');
    }
  }
}
