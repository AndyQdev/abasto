import { Component, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { ESTILOS_BASE } from '../estilos';
import { GraphQL } from '../graphql';

interface ProductoFila {
  id: string;
  codigo: string;
  nombre: string;
  rubro: string;
  stock: number;
  estado: string;
  escalas: { presentacion: string; cantidad: number; precioUnitario: { texto: string } }[];
}

const MIS_PRODUCTOS = `
  query MisProductos($busqueda: String) {
    misProductos(busqueda: $busqueda) {
      id codigo nombre rubro stock estado
      escalas { presentacion cantidad precioUnitario { texto } }
    }
  }`;

const ESTADOS: Record<string, string> = {
  ACTIVO: 'exito',
  PAUSADO: 'neutro',
  SIN_STOCK: 'error',
  PENDIENTE_DE_REVISION: 'advertencia',
};

/** Catálogo del mayorista con su escala de precios (cuarta, docena, caja). Los datos son de Catálogo (Laravel). */
@Component({
  selector: 'abasto-vista-productos',
  encapsulation: ViewEncapsulation.ShadowDom,
  styles: [ESTILOS_BASE],
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
    <div class="carta">
      @if (error()) {
        <p class="falla">{{ error() }}</p>
      } @else if (!productos().length) {
        <p class="vacio">Todavía no hay productos.</p>
      } @else {
        <table>
          <thead><tr><th>Producto</th><th>Rubro</th><th class="num">Stock</th><th>Precio por volumen</th><th>Estado</th></tr></thead>
          <tbody>
            @for (p of productos(); track p.id) {
              <tr>
                <td><strong>{{ p.nombre }}</strong><span class="gris mono">{{ p.codigo }}</span></td>
                <td>{{ p.rubro }}</td>
                <td class="num">{{ p.stock }} u.</td>
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

  ngOnInit() {
    void this.buscar('');
  }

  sinStock = () => this.productos().filter((p) => p.stock === 0).length;
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
}
