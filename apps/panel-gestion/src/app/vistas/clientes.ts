import { Component, ElementRef, OnInit, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { ESTILOS_BASE, haceCuanto, inicial } from '../estilos';
import { GraphQL } from '../graphql';
import { Icono } from '../icono';
import { avisar, pedirNavegar } from '../sesion';
import { bs } from './compras';
import { centavosDe } from './cuentas';

interface SolicitudFila {
  tienda: { id: string; nombre: string; ciudad: string };
  estado: string;
}

interface VentaParaClientes {
  estado: string;
  creadoEn: string;
  total: { centavos: number };
  tienda: { id: string; nombre?: string | null };
  entrega: { zona: string } | null;
}

export interface Comprador {
  id: string;
  nombre: string;
  zona: string;
  pedidos: number;
  totalCentavos: number;
  ultimo: string;
}

interface Monto {
  centavos: number;
  texto: string;
}

export interface LineaDada {
  tienda: { id: string };
  limite: Monto;
  usado: Monto;
  disponible: Monto;
  plazoDias: number;
}

interface Aprobada {
  tienda: { id: string; nombre: string; ciudad: string };
}

/** Las tiendas aprobadas que todavía no compraron también están: a ellas también se les puede dar crédito. */
export function conAprobadas(lista: Comprador[], aprobadas: Aprobada[]): Comprador[] {
  const faltan = aprobadas
    .filter((a) => !lista.some((c) => c.id === a.tienda.id))
    .map((a) => ({ id: a.tienda.id, nombre: a.tienda.nombre, zona: a.tienda.ciudad, pedidos: 0, totalCentavos: 0, ultimo: '' }));
  return [...lista, ...faltan];
}

/** Quién te compra: se arma con tus ventas (sin los rechazados ni cancelados), del que más compra al que menos. */
export function compradores(ventas: VentaParaClientes[]): Comprador[] {
  const porTienda = new Map<string, Comprador>();
  for (const v of ventas) {
    if (v.estado === 'RECHAZADO' || v.estado === 'CANCELADO') continue;
    const c = porTienda.get(v.tienda.id) ?? {
      id: v.tienda.id,
      nombre: v.tienda.nombre ?? 'Tienda',
      zona: '',
      pedidos: 0,
      totalCentavos: 0,
      ultimo: v.creadoEn,
    };
    c.pedidos++;
    c.totalCentavos += v.total.centavos;
    if (v.creadoEn >= c.ultimo) {
      c.ultimo = v.creadoEn;
      c.zona = v.entrega?.zona || c.zona;
    } else if (!c.zona && v.entrega?.zona) {
      c.zona = v.entrega.zona;
    }
    porTienda.set(v.tienda.id, c);
  }
  return [...porTienda.values()].sort((a, b) => b.totalCentavos - a.totalCentavos);
}

const MIS_CLIENTES = `
  query MisClientes {
    misSolicitudes {
      tienda { id nombre ciudad }
      estado
    }
    misClientes {
      tienda { id nombre ciudad }
    }
    misVentas { estado creadoEn total { centavos } tienda { id nombre } entrega { zona } }
  }`;

const CAMPOS_DE_LINEA = `tienda { id } limite { centavos texto } usado { centavos texto } disponible { centavos texto } plazoDias`;

const MIS_CREDITOS = `query MisCreditos { misCreditosDados { ${CAMPOS_DE_LINEA} } }`;

const ASIGNAR_CREDITO = `
  mutation AsignarCredito($entrada: AsignarCreditoEntrada!) {
    asignarCredito(entrada: $entrada) { ${CAMPOS_DE_LINEA} }
  }`;

const APROBAR_CLIENTE = `
  mutation AprobarCliente($tiendaId: ID!, $lista: ListaDePrecios!) {
    aprobarCliente(tiendaId: $tiendaId, lista: $lista) {
      tienda { id }
      estado
    }
  }`;

const RECHAZAR_CLIENTE = `
  mutation RechazarCliente($tiendaId: ID!) {
    rechazarCliente(tiendaId: $tiendaId) {
      tienda { id }
      estado
    }
  }`;

const LISTAS: { valor: string; texto: string }[] = [
  { valor: 'NUEVOS', texto: 'Nuevos · 100 %' },
  { valor: 'FRECUENTES', texto: 'Frecuentes · 97 %' },
  { valor: 'VIP', texto: 'VIP · 95 %' },
];

const ESTADOS_RELACION: Record<string, { texto: string; clase: string }> = {
  SOLICITADA: { texto: 'Pendiente', clase: 'advertencia' },
  APROBADA: { texto: 'Aprobada', clase: 'exito' },
  RECHAZADA: { texto: 'Rechazada', clase: 'error' },
  NINGUNA: { texto: 'Sin relación', clase: 'neutro' },
};

/**
 * Clientes: las tiendas que piden comprarte (aprobar asigna la lista de precios de la red privada; rechazar cierra la solicitud)
 * y las que ya te compran, armadas con tus ventas. Las solicitudes son de Catálogo (Laravel) y las ventas de Pedidos (Spring).
 */
@Component({
  selector: 'abasto-vista-clientes',
  encapsulation: ViewEncapsulation.ShadowDom,
  imports: [Icono],
  styles: [
    ESTILOS_BASE,
    `
      h2 { margin: 1.75rem 0 1rem; font-size: 1.6rem; font-weight: 800; letter-spacing: -0.03em; display: flex; align-items: center; gap: 0.6rem; }
      h2 small { font-size: 1rem; color: hsl(var(--texto-3)); font-weight: 700; }
      .tarjetas { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr)); gap: 1.1rem; }
      .cliente { background: hsl(var(--superficie)); border-radius: 28px; box-shadow: var(--sombra-carta); padding: 1.15rem 1.25rem; display: grid; gap: 0.9rem; }
      .cliente-cabeza { display: flex; align-items: center; gap: 0.9rem; }
      .cliente-cabeza div { min-width: 0; flex: 1; }
      .cliente-cabeza strong { display: block; font-size: 1.15rem; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .cliente-cabeza .lugar { display: flex; align-items: center; gap: 0.3rem; color: hsl(var(--texto-2)); }
      .avatar { width: 52px; height: 52px; border-radius: 18px; display: grid; place-items: center; background: hsl(var(--primary)); font-size: 1.4rem; font-weight: 800; flex: none; }
      .avatar.ambar { background: hsl(var(--ambar)); }
      .numeros { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; padding: 0.75rem; border-radius: 18px; background: hsl(var(--tenue)); }
      .numeros strong { display: block; font-size: 1.1rem; font-weight: 800; white-space: nowrap; }
      .numeros span { font-size: 0.8125rem; color: hsl(var(--texto-2)); }
      .lista label { display: grid; gap: 0.35rem; font-weight: 700; }
      .lista select { width: 100%; }
      .decidir { display: grid; grid-template-columns: 1fr 1.4fr; gap: 0.6rem; }
      .credito { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; padding: 0.7rem 0.85rem; border-radius: 18px; border: 1.5px solid hsl(var(--tenue)); }
      .credito strong { font-weight: 800; }
      .credito small { display: block; color: hsl(var(--texto-2)); font-size: 0.8125rem; }
      .credito-form { display: grid; gap: 0.7rem; padding: 0.85rem; border-radius: 18px; background: hsl(var(--tenue)); }
      .credito-form label { display: grid; gap: 0.35rem; font-weight: 700; }
      .credito-form input, .opcional input { width: 100%; min-width: 0; }
      .credito-form .acciones { display: grid; grid-template-columns: 1fr 1.4fr; gap: 0.6rem; }
      .credito-form .aviso-falla { color: hsl(var(--error, 0 70% 45%)); font-weight: 700; margin: 0; }
      .opcional { display: grid; grid-template-columns: 1fr auto; gap: 0.6rem; align-items: end; }
      .opcional label { display: grid; gap: 0.35rem; font-weight: 700; }
    `,
  ],
  template: `
    <div class="cabecera">
      <div>
        <h1 class="titulo-pantalla">Clientes</h1>
        <p class="subtitulo">Quién te compra y quién quiere comprarte</p>
      </div>
      <span class="capsula-contador"><abasto-icono nombre="clientes" [tamano]="22" /> {{ clientes().length }} {{ clientes().length === 1 ? 'cliente' : 'clientes' }} · {{ pendientes().length }} {{ pendientes().length === 1 ? 'solicitud' : 'solicitudes' }}</span>
    </div>

    @if (error()) {
      <p class="falla">{{ error() }}</p>
    } @else if (cargando()) {
      <div class="carta vacio">Cargando clientes…</div>
    } @else {
      <h2>Quieren comprarte <small>{{ solicitudes().length }}</small></h2>
      @if (!solicitudes().length) {
        <div class="carta vacio">No tienes solicitudes pendientes.</div>
      } @else {
        <div class="tarjetas">
          @for (s of solicitudes(); track s.tienda.id) {
            <article class="cliente" [attr.aria-label]="s.tienda.nombre">
              <div class="cliente-cabeza">
                <span class="avatar ambar">{{ letra(s.tienda.nombre) }}</span>
                <div>
                  <strong>{{ s.tienda.nombre }}</strong>
                  <span class="lugar"><abasto-icono nombre="pin" [tamano]="16" /> {{ s.tienda.ciudad }}</span>
                </div>
                <span class="insignia" [class]="'insignia ' + estado(s.estado).clase">{{ estado(s.estado).texto }}</span>
              </div>
              <div class="lista">
                <label [attr.for]="'lista-' + s.tienda.id">Con qué lista de precios</label>
                <select class="entrada" [id]="'lista-' + s.tienda.id" [value]="lista(s.tienda.id)" [disabled]="ocupado() === s.tienda.id"
                  (change)="elegir(s.tienda.id, $any($event.target).value)">
                  @for (l of listas; track l.valor) { <option [value]="l.valor">{{ l.texto }}</option> }
                </select>
              </div>
              <div class="opcional">
                <label>
                  Crédito en Bs (opcional)
                  <input class="entrada" inputmode="decimal" placeholder="Sin crédito" [attr.aria-label]="'Crédito para ' + s.tienda.nombre" [disabled]="ocupado() === s.tienda.id"
                    [value]="creditoNuevo(s.tienda.id)" (input)="anotarCredito(s.tienda.id, $any($event.target).value)" />
                </label>
                <label>
                  Plazo
                  <select class="entrada" [attr.aria-label]="'Plazo para ' + s.tienda.nombre" [disabled]="ocupado() === s.tienda.id"
                    [value]="plazoNuevo(s.tienda.id)" (change)="anotarPlazo(s.tienda.id, $any($event.target).value)">
                    @for (p of plazos; track p) { <option [value]="p">{{ p }} días</option> }
                  </select>
                </label>
              </div>
              <div class="decidir">
                <button class="boton-secundario" [disabled]="ocupado() === s.tienda.id" (click)="rechazar(s)">Rechazar</button>
                <button class="boton-primario" [disabled]="ocupado() === s.tienda.id" (click)="aprobar(s)">Aprobar</button>
              </div>
            </article>
          }
        </div>
      }

      <h2>Te compran <small>{{ clientes().length }}</small></h2>
      @if (!clientes().length) {
        <div class="carta vacio">Todavía nadie te compró. Cuando entre el primer pedido, la tienda aparece aquí.</div>
      } @else {
        <div class="tarjetas">
          @for (c of clientes(); track c.id) {
            <article class="cliente" [attr.aria-label]="c.nombre">
              <div class="cliente-cabeza">
                <span class="avatar">{{ letra(c.nombre) }}</span>
                <div>
                  <strong>{{ c.nombre }}</strong>
                  <span class="lugar"><abasto-icono nombre="pin" [tamano]="16" /> {{ c.zona || 'Sin dirección' }}</span>
                </div>
              </div>
              <div class="numeros">
                <div><strong>{{ c.pedidos }}</strong><span>{{ c.pedidos === 1 ? 'pedido' : 'pedidos' }}</span></div>
                <div><strong>{{ bs(c.totalCentavos) }}</strong><span>te compró</span></div>
                <div><strong>{{ c.ultimo ? hace(c.ultimo) : 'Todavía no' }}</strong><span>último</span></div>
              </div>
              @if (editandoCredito() === c.id) {
                <form class="credito-form" (submit)="$event.preventDefault(); guardarCredito(c)">
                  <label>
                    Hasta cuánto le fías, en Bs
                    <input class="entrada" inputmode="decimal" [value]="limiteEnEdicion()" [attr.aria-label]="'Límite de crédito de ' + c.nombre" (input)="limiteEnEdicion.set($any($event.target).value)" />
                  </label>
                  <div class="segmentos" role="group" aria-label="Plazo para pagar">
                    @for (p of plazos; track p) {
                      <button type="button" class="segmento" [class.elegido]="plazoEnEdicion() === p" [attr.aria-pressed]="plazoEnEdicion() === p" (click)="plazoEnEdicion.set(p)">{{ p }} días</button>
                    }
                  </div>
                  @if (fallaDeCredito(); as f) { <p class="aviso-falla" role="alert">{{ f }}</p> }
                  <div class="acciones">
                    <button type="button" class="boton-secundario" [disabled]="ocupado() === c.id" (click)="editandoCredito.set(null)">Cancelar</button>
                    <button type="submit" class="boton-primario" [disabled]="ocupado() === c.id">Guardar crédito</button>
                  </div>
                </form>
              } @else {
                <div class="credito">
                  @if (lineaDe(c.id); as l) {
                    <div>
                      <strong>{{ l.disponible.texto }} disponibles</strong>
                      <small>Le das {{ l.limite.texto }} a {{ l.plazoDias }} días · usó {{ l.usado.texto }}</small>
                    </div>
                    <button class="boton-suave" (click)="abrirCredito(c.id)">Cambiar crédito</button>
                  } @else {
                    <div>
                      <strong>Sin crédito</strong>
                      <small>Compra con QR o contra entrega</small>
                    </div>
                    <button class="boton-suave" (click)="abrirCredito(c.id)">Dar crédito</button>
                  }
                </div>
              }
              <button class="boton-suave" (click)="verPedidos(c)">Ver sus pedidos</button>
            </article>
          }
        </div>
      }
    }
  `,
})
export class VistaClientes implements OnInit {
  private readonly graphql = inject(GraphQL);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly solicitudes = signal<SolicitudFila[]>([]);
  readonly clientes = signal<Comprador[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly ocupado = signal<string | null>(null);
  readonly seleccion = signal<Record<string, string>>({});
  readonly pendientes = computed(() => this.solicitudes().filter((s) => s.estado === 'SOLICITADA'));
  readonly listas = LISTAS;
  readonly plazos = [15, 30];
  readonly lineas = signal<LineaDada[]>([]);
  readonly creditosNuevos = signal<Record<string, { monto?: string; plazo?: number }>>({});
  readonly editandoCredito = signal<string | null>(null);
  readonly limiteEnEdicion = signal('');
  readonly plazoEnEdicion = signal(15);
  readonly fallaDeCredito = signal<string | null>(null);
  readonly bs = bs;
  readonly letra = inicial;

  ngOnInit() {
    void this.cargar();
  }

  estado = (e: string) => ESTADOS_RELACION[e] ?? { texto: e, clase: 'neutro' };
  lista = (tiendaId: string) => this.seleccion()[tiendaId] ?? LISTAS[0].valor;
  hace = (fecha: string) => haceCuanto(fecha);
  verPedidos = (c: Comprador) => pedirNavegar(this.host.nativeElement, `pedidos?q=${encodeURIComponent(c.nombre)}`);

  lineaDe = (tiendaId: string) => this.lineas().find((l) => l.tienda.id === tiendaId) ?? null;
  creditoNuevo = (tiendaId: string) => this.creditosNuevos()[tiendaId]?.monto ?? '';
  plazoNuevo = (tiendaId: string) => this.creditosNuevos()[tiendaId]?.plazo ?? 15;

  anotarCredito(tiendaId: string, monto: string) {
    this.creditosNuevos.update((n) => ({ ...n, [tiendaId]: { ...n[tiendaId], monto } }));
  }

  anotarPlazo(tiendaId: string, plazo: string) {
    this.creditosNuevos.update((n) => ({ ...n, [tiendaId]: { ...n[tiendaId], plazo: Number(plazo) } }));
  }

  abrirCredito(tiendaId: string) {
    const linea = this.lineaDe(tiendaId);
    this.limiteEnEdicion.set(linea ? String(linea.limite.centavos / 100).replace('.', ',') : '');
    this.plazoEnEdicion.set(linea?.plazoDias ?? 15);
    this.fallaDeCredito.set(null);
    this.editandoCredito.set(tiendaId);
  }

  async guardarCredito(c: Comprador) {
    const centavos = centavosDe(this.limiteEnEdicion());
    if (centavos === null) {
      this.fallaDeCredito.set('Escribe el monto, por ejemplo 2.000 (0 para quitarle el crédito)');
      return;
    }
    this.ocupado.set(c.id);
    this.fallaDeCredito.set(null);
    try {
      await this.asignarCredito(c.id, centavos, this.plazoEnEdicion());
      avisar(this.host.nativeElement, `Le diste a ${c.nombre} ${bs(centavos)} a ${this.plazoEnEdicion()} días`);
      this.editandoCredito.set(null);
    } catch (e) {
      this.fallaDeCredito.set((e as Error).message);
    } finally {
      this.ocupado.set(null);
    }
  }

  private async asignarCredito(tiendaId: string, limiteCentavos: number, plazoDias: number) {
    const { asignarCredito } = await this.graphql.consultar<{ asignarCredito: LineaDada }>(ASIGNAR_CREDITO, {
      entrada: { tiendaId, limiteCentavos, plazoDias },
    });
    this.lineas.update((lista) => [...lista.filter((l) => l.tienda.id !== tiendaId), asignarCredito]);
  }

  elegir(tiendaId: string, lista: string) {
    this.seleccion.update((seleccion) => ({ ...seleccion, [tiendaId]: lista }));
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const datos = await this.graphql.consultar<{ misSolicitudes?: SolicitudFila[] | null; misClientes?: Aprobada[] | null; misVentas?: VentaParaClientes[] | null }>(MIS_CLIENTES);
      this.solicitudes.set(datos.misSolicitudes ?? []);
      this.clientes.set(conAprobadas(compradores(datos.misVentas ?? []), datos.misClientes ?? []));
      await this.cargarCreditos();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  /** Los créditos son de Cobros: si no responde, igual se ven los clientes (sin el crédito). */
  private async cargarCreditos() {
    try {
      const { misCreditosDados } = await this.graphql.consultar<{ misCreditosDados?: LineaDada[] | null }>(MIS_CREDITOS);
      this.lineas.set(misCreditosDados ?? []);
    } catch {
      this.lineas.set([]);
    }
  }

  async aprobar(solicitud: SolicitudFila) {
    const tiendaId = solicitud.tienda.id;
    const lista = this.lista(tiendaId);
    const montoDeCredito = this.creditoNuevo(tiendaId);
    const centavos = montoDeCredito.trim() ? centavosDe(montoDeCredito) : 0;
    if (centavos === null) {
      this.error.set(`El crédito de ${solicitud.tienda.nombre} no se entiende. Escribe el monto, por ejemplo 2.000`);
      return;
    }
    await this.decidir(
      solicitud,
      APROBAR_CLIENTE,
      { tiendaId, lista },
      `Aprobaste a ${solicitud.tienda.nombre} con la lista ${this.textoLista(lista)}`,
      async () => {
        if (!centavos) return;
        try {
          await this.asignarCredito(tiendaId, centavos, this.plazoNuevo(tiendaId));
        } catch (e) {
          throw new Error(`Aprobaste a ${solicitud.tienda.nombre}, pero el crédito no se guardó: ${(e as Error).message}. Dáselo desde «Te compran».`);
        }
      },
    );
  }

  async rechazar(solicitud: SolicitudFila) {
    await this.decidir(solicitud, RECHAZAR_CLIENTE, { tiendaId: solicitud.tienda.id }, `Rechazaste la solicitud de ${solicitud.tienda.nombre}`);
  }

  private textoLista(lista: string) {
    return LISTAS.find((l) => l.valor === lista)?.texto ?? lista;
  }

  private async decidir(solicitud: SolicitudFila, mutacion: string, variables: Record<string, unknown>, texto: string, despues?: () => Promise<void>) {
    this.ocupado.set(solicitud.tienda.id);
    this.error.set(null);
    let falla: string | null = null;
    try {
      await this.graphql.consultar(mutacion, variables);
      avisar(this.host.nativeElement, texto);
      try {
        await despues?.();
      } catch (e) {
        falla = (e as Error).message;
      }
      await this.cargar();
    } catch (e) {
      falla = (e as Error).message;
    } finally {
      // cargar() limpia el error: el de la decisión se muestra después
      if (falla) this.error.set(falla);
      this.ocupado.set(null);
    }
  }
}
