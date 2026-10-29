import { Component, ElementRef, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { ESTILOS_BASE } from '../estilos';
import { GraphQL } from '../graphql';
import { avisar } from '../sesion';

// TODO: mostrar el límite de crédito cuando el schema de Catálogo lo incluya.
interface SolicitudFila {
  tienda: { id: string; nombre: string; ciudad: string };
  estado: string;
}

const MIS_SOLICITUDES = `
  query MisSolicitudes {
    misSolicitudes {
      tienda { id nombre ciudad }
      estado
    }
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
 * Bandeja de tiendas que pidieron ser clientes del mayorista. Aprobar asigna la lista de precios
 * de la red privada; rechazar cierra la solicitud. Los datos son de Catálogo (Laravel).
 */
@Component({
  selector: 'abasto-vista-clientes',
  encapsulation: ViewEncapsulation.ShadowDom,
  styles: [
    ESTILOS_BASE,
    `
      .subtitulo {
        color: hsl(var(--texto-2));
        margin: 0.35rem 0 0;
      }
      .oculto {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
        border: 0;
      }
    `,
  ],
  template: `
    <div class="cabecera">
      <div>
        <h1 class="titulo-pantalla">Clientes</h1>
        <p class="subtitulo">
          Aprueba con una lista de precios a las tiendas que quieren comprarte, o rechaza su solicitud.
        </p>
      </div>
      <div class="contadores">
        <div>
          <strong>{{ solicitudes().length }}</strong
          >solicitudes
        </div>
      </div>
    </div>
    <div class="carta">
      @if (error()) {
        <p class="falla">{{ error() }}</p>
      } @else if (cargando()) {
        <p class="vacio">Cargando solicitudes…</p>
      } @else if (!solicitudes().length) {
        <p class="vacio">No tienes solicitudes pendientes.</p>
      } @else {
        <table>
          <thead>
            <tr>
              <th>Tienda</th>
              <th>Ciudad</th>
              <th>Estado</th>
              <th>Lista de precios</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (s of solicitudes(); track s.tienda.id) {
              <tr>
                <td>
                  <strong>{{ s.tienda.nombre }}</strong>
                </td>
                <td>{{ s.tienda.ciudad }}</td>
                <td>
                  <span class="insignia" [class]="estado(s.estado).clase">{{
                    estado(s.estado).texto
                  }}</span>
                </td>
                <td>
                  <label class="oculto" [attr.for]="'lista-' + s.tienda.id"
                    >Lista de precios para {{ s.tienda.nombre }}</label
                  >
                  <select
                    class="entrada"
                    [id]="'lista-' + s.tienda.id"
                    [value]="lista(s.tienda.id)"
                    [disabled]="ocupado() === s.tienda.id"
                    (change)="elegir(s.tienda.id, $any($event.target).value)"
                  >
                    @for (l of listas; track l.valor) {
                      <option [value]="l.valor">{{ l.texto }}</option>
                    }
                  </select>
                </td>
                <td class="acciones">
                  <button
                    class="boton-secundario"
                    [disabled]="ocupado() === s.tienda.id"
                    (click)="rechazar(s)"
                  >
                    Rechazar
                  </button>
                  <button
                    class="boton-primario"
                    [disabled]="ocupado() === s.tienda.id"
                    (click)="aprobar(s)"
                  >
                    Aprobar
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
})
export class VistaClientes implements OnInit {
  private readonly graphql = inject(GraphQL);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly solicitudes = signal<SolicitudFila[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly ocupado = signal<string | null>(null);
  readonly seleccion = signal<Record<string, string>>({});
  readonly listas = LISTAS;

  ngOnInit() {
    void this.cargar();
  }

  estado = (e: string) => ESTADOS_RELACION[e] ?? { texto: e, clase: 'neutro' };
  lista = (tiendaId: string) => this.seleccion()[tiendaId] ?? LISTAS[0].valor;

  elegir(tiendaId: string, lista: string) {
    this.seleccion.update((seleccion) => ({ ...seleccion, [tiendaId]: lista }));
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const datos = await this.graphql.consultar<{ misSolicitudes: SolicitudFila[] }>(
        MIS_SOLICITUDES,
      );
      this.solicitudes.set(datos.misSolicitudes);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  async aprobar(solicitud: SolicitudFila) {
    const lista = this.lista(solicitud.tienda.id);
    await this.decidir(
      solicitud,
      APROBAR_CLIENTE,
      { tiendaId: solicitud.tienda.id, lista },
      `Aprobaste a ${solicitud.tienda.nombre} con la lista ${this.textoLista(lista)}`,
    );
  }

  async rechazar(solicitud: SolicitudFila) {
    await this.decidir(
      solicitud,
      RECHAZAR_CLIENTE,
      { tiendaId: solicitud.tienda.id },
      `Rechazaste la solicitud de ${solicitud.tienda.nombre}`,
    );
  }

  private textoLista(lista: string) {
    return LISTAS.find((l) => l.valor === lista)?.texto ?? lista;
  }

  private async decidir(
    solicitud: SolicitudFila,
    mutacion: string,
    variables: Record<string, unknown>,
    texto: string,
  ) {
    this.ocupado.set(solicitud.tienda.id);
    this.error.set(null);
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
