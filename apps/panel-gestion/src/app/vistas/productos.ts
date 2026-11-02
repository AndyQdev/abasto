import { Component, OnInit, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { ESTILOS_BASE } from '../estilos';
import { GraphQL } from '../graphql';

export interface ProductoFila {
  id: string;
  codigo: string;
  nombre: string;
  rubro: string;
  stock: number;
  estado: string;
  /** BAJO_PEDIDO: se compra cuando entra el pedido; su stock en 0 no es «sin stock» */
  abastecimiento?: string;
  /** A quién se le muestra en el Inicio de la app (hogar, tienda o un área del productor) */
  usos: string[];
  escalas: { presentacion: string; cantidad: number; precioUnitario: { texto: string } }[];
}

const MIS_PRODUCTOS = `
  query MisProductos($busqueda: String) {
    misProductos(busqueda: $busqueda) {
      id codigo nombre rubro stock estado abastecimiento usos
      escalas { presentacion cantidad precioUnitario { texto } }
    }
  }`;

const CAMBIAR_USOS = `
  mutation CambiarUsos($id: ID!, $usos: [String!]!) {
    editarProducto(id: $id, entrada: { usos: $usos }) { id usos }
  }`;

/** Los usos en el orden de Catálogo (Producto::USOS), con el nombre que ve Abasto. */
export const USOS: { clave: string; nombre: string }[] = [
  { clave: 'hogar', nombre: 'Hogar' },
  { clave: 'tienda', nombre: 'Tienda' },
  { clave: 'salteneria', nombre: 'Salteñería' },
  { clave: 'panaderia', nombre: 'Panadería' },
  { clave: 'horneados', nombre: 'Horneados' },
  { clave: 'pension', nombre: 'Pensión' },
  { clave: 'polleria', nombre: 'Pollería' },
  { clave: 'puesto', nombre: 'Puesto' },
];

/** Filtro por área: «todos», un uso, o «ninguno» (los que no se muestran en ningún Inicio). */
export function filtrarPorUso(productos: ProductoFila[], uso: string): ProductoFila[] {
  if (uso === 'todos') return productos;
  if (uso === 'ninguno') return productos.filter((p) => !p.usos.length);
  return productos.filter((p) => p.usos.includes(uso));
}

/** Prende o apaga un uso y deja la lista en el orden de siempre. */
export function alternarUso(usos: string[], uso: string): string[] {
  const nuevos = usos.includes(uso) ? usos.filter((u) => u !== uso) : [...usos, uso];
  return USOS.map((u) => u.clave).filter((c) => nuevos.includes(c));
}

const ESTADOS: Record<string, string> = {
  ACTIVO: 'exito',
  PAUSADO: 'neutro',
  SIN_STOCK: 'error',
  PENDIENTE_DE_REVISION: 'advertencia',
};

/**
 * Catálogo del mayorista con su escala de precios (cuarta, docena, caja) y a quién se muestra cada producto en la app
 * (usos, 02/11): un toque en la etiqueta lo prende o lo apaga. Los datos son de Catálogo (Laravel).
 */
@Component({
  selector: 'abasto-vista-productos',
  encapsulation: ViewEncapsulation.ShadowDom,
  styles: [
    ESTILOS_BASE,
    `
      .areas { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-bottom: 1rem; }
      .area { border: 1px solid hsl(var(--borde)); background: hsl(var(--superficie)); color: hsl(var(--texto-2)); border-radius: 9999px; padding: 0.375rem 0.75rem; font: inherit; font-size: 0.8125rem; cursor: pointer; }
      .area.elegida { background: hsl(var(--primary)); border-color: hsl(var(--primary)); color: hsl(var(--primary-texto)); font-weight: 600; }
      .area small { opacity: 0.7; margin-left: 0.25rem; }
      .usos { display: flex; flex-wrap: wrap; gap: 0.25rem; max-width: 22rem; }
      .uso { border: 1px dashed hsl(var(--borde)); background: transparent; color: hsl(var(--texto-3)); border-radius: 9999px; padding: 0.125rem 0.5rem; font: inherit; font-size: 0.6875rem; cursor: pointer; }
      .uso.prendido { border-style: solid; border-color: transparent; background: hsl(var(--exito-suave)); color: hsl(var(--exito-suave-texto)); font-weight: 600; }
      .uso:disabled { opacity: 0.5; cursor: wait; }
      .ayuda { color: hsl(var(--texto-3)); font-size: 0.8125rem; margin: -0.5rem 0 0.75rem; }
    `,
  ],
  template: `
    <div class="cabecera">
      <h1 class="titulo-pantalla">Productos</h1>
      <div class="contadores">
        <div><strong>{{ productos().length }}</strong>productos</div>
        <div><strong>{{ sinStock() }}</strong>sin stock</div>
      </div>
    </div>
    <div class="filtros">
      <input class="entrada relleno" placeholder="Buscar producto" (keyup.enter)="buscar($any($event.target).value)" />
      <button class="boton-primario" disabled title="Tarea de F1: formulario con escalas">Nuevo producto</button>
    </div>
    <div class="areas" role="group" aria-label="Filtrar por área">
      @for (a of areas(); track a.clave) {
        <button class="area" [class.elegida]="uso() === a.clave" (click)="uso.set(a.clave)">{{ a.nombre }}<small>{{ a.cuantos }}</small></button>
      }
    </div>
    <p class="ayuda">«Se muestra a» decide qué ve cada cliente en el Inicio de la app. Toca una etiqueta para prenderla o apagarla. Buscar encuentra todo igual.</p>
    <div class="carta">
      @if (error()) {
        <p class="falla">{{ error() }}</p>
      }
      @if (!visibles().length) {
        <p class="vacio">{{ productos().length ? 'Ningún producto en esta área.' : 'Todavía no hay productos.' }}</p>
      } @else {
        <table>
          <thead><tr><th>Producto</th><th>Rubro</th><th>Se muestra a</th><th>Precio por volumen</th><th>Estado</th></tr></thead>
          <tbody>
            @for (p of visibles(); track p.id) {
              <tr>
                <td><strong>{{ p.nombre }}</strong><span class="gris mono">{{ p.codigo }}</span></td>
                <td>{{ p.rubro }}</td>
                <td>
                  <div class="usos">
                    @for (u of todosLosUsos; track u.clave) {
                      <button class="uso" [class.prendido]="p.usos.includes(u.clave)" [disabled]="guardando() === p.id"
                        [attr.aria-pressed]="p.usos.includes(u.clave)" (click)="alternar(p, u.clave)">{{ u.nombre }}</button>
                    }
                  </div>
                </td>
                <td>
                  @for (e of p.escalas; track e.presentacion) {
                    <span>{{ e.precioUnitario.texto }}<span class="gris">c/u por {{ e.presentacion.toLowerCase() }} ({{ e.cantidad }} u.)</span></span>
                  }
                </td>
                <td><span class="insignia" [class]="clase(p.estado)">{{ texto(p.estado) }}</span></td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
})
export class VistaProductos implements OnInit {
  private readonly graphql = inject(GraphQL);
  readonly productos = signal<ProductoFila[]>([]);
  readonly error = signal<string | null>(null);
  readonly uso = signal('todos');
  readonly guardando = signal<string | null>(null);
  readonly todosLosUsos = USOS;
  readonly visibles = computed(() => filtrarPorUso(this.productos(), this.uso()));
  readonly areas = computed(() => {
    const lista = this.productos();
    return [
      { clave: 'todos', nombre: 'Todos', cuantos: lista.length },
      ...USOS.map((u) => ({ ...u, cuantos: filtrarPorUso(lista, u.clave).length })),
      { clave: 'ninguno', nombre: 'Sin mostrar', cuantos: filtrarPorUso(lista, 'ninguno').length },
    ];
  });

  ngOnInit() {
    void this.buscar('');
  }

  sinStock = () => this.productos().filter((p) => p.stock === 0 && p.abastecimiento !== 'BAJO_PEDIDO').length;
  clase = (e: string) => ESTADOS[e] ?? 'neutro';
  texto = (e: string) => e.charAt(0) + e.slice(1).toLowerCase().replace(/_/g, ' ');

  async buscar(busqueda: string) {
    try {
      const datos = await this.graphql.consultar<{ misProductos: ProductoFila[] }>(MIS_PRODUCTOS, { busqueda: busqueda || null });
      this.productos.set(datos.misProductos);
      this.error.set(null);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  /** Cambia en pantalla al toque; si Catálogo lo rechaza, vuelve atrás y avisa. */
  async alternar(p: ProductoFila, uso: string) {
    const antes = p.usos;
    const usos = alternarUso(antes, uso);
    const poner = (u: string[]) => this.productos.update((l) => l.map((x) => (x.id === p.id ? { ...x, usos: u } : x)));
    poner(usos);
    this.guardando.set(p.id);
    try {
      await this.graphql.consultar(CAMBIAR_USOS, { id: p.id, usos });
      this.error.set(null);
    } catch (e) {
      poner(antes);
      this.error.set(`No se pudo cambiar «${p.nombre}»: ${(e as Error).message}`);
    } finally {
      this.guardando.set(null);
    }
  }
}
