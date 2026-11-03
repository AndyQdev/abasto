import { Component, ElementRef, OnDestroy, OnInit, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { ESTILOS_BASE, busquedaDeLaUrl, inicial } from '../estilos';
import { GraphQL } from '../graphql';
import { Icono } from '../icono';
import { avisar } from '../sesion';

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
  escalas: { presentacion: string; cantidad: number; precioUnitario: { texto: string; centavos?: number } | null }[];
  foto?: string | null;
  precioPorConfirmar?: boolean;
  proveedor?: string | null;
  costoUnitario?: { centavos: number } | null;
  entregaHoras?: number | null;
}

const MIS_PRODUCTOS = `
  query MisProductos($busqueda: String) {
    misProductos(busqueda: $busqueda) {
      id codigo nombre rubro stock estado abastecimiento usos foto precioPorConfirmar proveedor entregaHoras
      costoUnitario { centavos }
      escalas { presentacion cantidad precioUnitario { texto centavos } }
    }
  }`;

const CAMBIAR_USOS = `
  mutation CambiarUsos($id: ID!, $usos: [String!]!) {
    editarProducto(id: $id, entrada: { usos: $usos }) { id usos }
  }`;
const CAMBIAR_ESTADO = `mutation($id: ID!, $estado: EstadoEditableProducto!) { editarProducto(id: $id, entrada: { estado: $estado }) { id estado } }`;
const CREAR = `mutation($e: CrearProductoEntrada!) { crearProducto(entrada: $e) { id } }`;
const EDITAR = `mutation($id: ID!, $e: EditarProductoEntrada!) { editarProducto(id: $id, entrada: $e) { id } }`;
const AJUSTAR_STOCK = `mutation($id: ID!, $s: Int!) { ajustarStock(id: $id, stock: $s) { id } }`;
const CAMBIAR_FOTO = `mutation($id: ID!, $i: String!) { cambiarFotoDeProducto(id: $id, imagen: $i) { id foto } }`;

/** Los usos en el orden de Catálogo (Producto::USOS), con el nombre que ve Abasto y su icono. */
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

/** «Harina de trigo · quintal 46 kg» → título «Harina de trigo» y detalle «Quintal 46 kg»; si no, el rubro va de detalle. */
export function partesDelNombre(p: Pick<ProductoFila, 'nombre' | 'rubro'>): { titulo: string; detalle: string } {
  const [titulo, ...resto] = p.nombre.split(' · ');
  const detalle = resto.join(' · ');
  return detalle ? { titulo, detalle: detalle.charAt(0).toUpperCase() + detalle.slice(1) } : { titulo: p.nombre, detalle: p.rubro };
}

/** «Granos y cereales» → «Granos» para el chip */
export const rubroCorto = (rubro: string) => rubro.split(/\s+y\s+|\s+/)[0];

/** La cápsula de volumen de cada escala: «Unidad» o desde cuántas unidades vale ese precio («12+») */
export function etiquetaDeEscala(e: { presentacion: string; cantidad: number }): string {
  return e.cantidad <= 1 ? 'Unidad' : `${e.cantidad}+`;
}

/** El icono del rubro, en el disco junto al nombre */
export function iconoDeRubro(rubro: string): string {
  const r = rubro.toLowerCase();
  if (r.includes('aceite') || r.includes('grasa')) return 'gota';
  if (r.includes('bebida')) return 'botella';
  if (r.includes('harina') || r.includes('pan')) return 'saco';
  if (r.includes('grano') || r.includes('cereal') || r.includes('abarrote')) return 'bol';
  if (r.includes('carne') || r.includes('pollo')) return 'polleria';
  if (r.includes('huevo') || r.includes('lácteo') || r.includes('lacteo')) return 'huevo';
  if (r.includes('verdura') || r.includes('tubérculo') || r.includes('fruta')) return 'zanahoria';
  if (r.includes('limpieza') || r.includes('higiene')) return 'burbujas';
  if (r.includes('galleta') || r.includes('dulce')) return 'horneados';
  return 'caja';
}

/** «15,40», «15.4» o «Bs 1.540,00» → centavos. Null si no es un monto. */
export function aCentavos(texto: string): number | null {
  let limpio = texto.replace(/bs/i, '').replace(/\s/g, '');
  if (limpio.includes(',')) limpio = limpio.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  return Math.round(Number(limpio) * 100);
}

const aTexto = (centavos: number | null | undefined) => (centavos == null ? '' : (centavos / 100).toFixed(2).replace('.', ','));

/** El código que sigue: AB-121 → AB-122 (el prefijo más usado del catálogo). */
export function codigoSiguiente(codigos: string[]): string {
  const cuenta = new Map<string, number>();
  let maximo = 0;
  for (const c of codigos) {
    const m = /^([A-Z]+)-(\d+)$/.exec(c);
    if (!m) continue;
    cuenta.set(m[1], (cuenta.get(m[1]) ?? 0) + 1);
  }
  const prefijo = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'P';
  for (const c of codigos) {
    const m = new RegExp(`^${prefijo}-(\\d+)$`).exec(c);
    if (m) maximo = Math.max(maximo, Number(m[1]));
  }
  return `${prefijo}-${String(maximo + 1).padStart(3, '0')}`;
}

const ESTADOS: Record<string, { texto: string; clase: string }> = {
  ACTIVO: { texto: 'Activo', clase: 'lima' },
  PAUSADO: { texto: 'Pausado', clase: 'neutro' },
  SIN_STOCK: { texto: 'Sin stock', clase: 'neutro' },
  PENDIENTE_DE_REVISION: { texto: 'En revisión', clase: 'advertencia' },
};

const PRESENTACIONES = ['UNIDAD', 'CUARTA', 'DOCENA', 'CAJA', 'FARDO'];

interface FilaDeEscala {
  presentacion: string;
  unidades: string;
  precio: string;
}

interface Borrador {
  id: string | null;
  codigo: string;
  nombre: string;
  rubro: string;
  escalas: FilaDeEscala[];
  costo: string;
  proveedor: string;
  abastecimiento: string;
  stock: string;
  entregaHoras: string;
  usos: string[];
  foto: string | null;
  fotoNueva: string | null;
}

/** Achica la foto a 900 px de lado (JPEG) para que entre en el límite de Catálogo. */
function achicarFoto(archivo: File): Promise<string> {
  return new Promise((resolver, fallar) => {
    const lector = new FileReader();
    lector.onerror = () => fallar(new Error('No se pudo leer la foto'));
    lector.onload = () => {
      const imagen = new Image();
      imagen.onerror = () => fallar(new Error('Esa foto no se puede abrir: prueba con JPG o PNG'));
      imagen.onload = () => {
        const escala = Math.min(1, 900 / Math.max(imagen.width, imagen.height));
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.round(imagen.width * escala);
        lienzo.height = Math.round(imagen.height * escala);
        const ctx = lienzo.getContext('2d');
        if (!ctx) return fallar(new Error('El navegador no pudo preparar la foto'));
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, lienzo.width, lienzo.height);
        ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
        resolver(lienzo.toDataURL('image/jpeg', 0.85));
      };
      imagen.src = lector.result as string;
    };
    lector.readAsDataURL(archivo);
  });
}

/**
 * Catálogo del mayorista (versión 7): tarjetas con foto, precio por volumen, a quién se muestra cada producto en la app
 * (usos: un toque en el icono lo prende o lo apaga), si está activo y el formulario para crear o editar.
 * Los datos son de Catálogo (Laravel).
 */
@Component({
  selector: 'abasto-vista-productos',
  encapsulation: ViewEncapsulation.ShadowDom,
  imports: [Icono],
  styles: [
    ESTILOS_BASE,
    `
      .rubros { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; max-width: calc(100% - 320px); }
      .rubros::-webkit-scrollbar, .areas::-webkit-scrollbar { display: none; }
      .areas { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; max-width: calc(100% - 360px); }
      .areas .segmento { height: 36px; padding: 0 0.85rem; font-size: 0.98rem; gap: 0.45rem; }
      .areas .segmento + .segmento::before { height: 18px; }
      .areas .etiqueta-grupo { font-size: 1.05rem; }
      .vista .segmento { height: 36px; font-size: 1rem; }
      .buscando { display: inline-flex; align-items: center; gap: 0.4rem; height: 40px; padding: 0 0.5rem 0 1rem; border-radius: 999px; background: hsl(var(--tinta)); color: #fff; font-weight: 700; margin-bottom: 1rem; }
      .buscando button { border: 0; background: rgba(255,255,255,0.15); color: #fff; border-radius: 50%; width: 28px; height: 28px; display: grid; place-items: center; }
      .boton-nuevo { height: 54px; padding: 0 2rem; font-size: 1.4rem; }
      .barra-arriba { margin-bottom: 1rem; }

      .catalogo { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(440px, 100%), 1fr)); gap: 1rem; }
      .producto { position: relative; background: hsl(var(--superficie)); border-radius: 30px; box-shadow: var(--sombra-carta); padding: 0.85rem 0.9rem 0.75rem; display: grid; grid-template-rows: 1fr auto; gap: 0.55rem; }
      .producto-arriba { display: grid; grid-template-columns: 146px minmax(0, 1fr); gap: 0.9rem; }
      .producto-foto { height: 186px; border-radius: 22px; background: hsl(60 20% 96%); display: grid; place-items: center; overflow: hidden; font-size: 2.6rem; font-weight: 800; color: hsl(var(--texto-3)); }
      .producto-foto img { width: 100%; height: 100%; object-fit: contain; mix-blend-mode: multiply; }
      .producto-info { min-width: 0; display: grid; gap: 0.55rem; align-content: start; padding-top: 0.15rem; }
      .titulo-fila { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; gap: 0.6rem; }
      .rubro-disco { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; background: hsl(var(--primary-suave)); }
      .titulo-fila strong { display: block; font-size: 1.22rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; }
      .titulo-fila .detalle { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; color: hsl(var(--texto)); margin-top: 0.2rem; font-size: 1.02rem; }
      .titulo-fila .insignia { font-size: 0.9rem; padding: 0.3rem 0.75rem; }
      .por-revisar { font-size: 0.78rem !important; padding: 0.2rem 0.6rem !important; background: hsl(var(--ambar) / 0.55); color: hsl(var(--tinta)); }
      .escalas { display: grid; grid-template-columns: 78px auto; gap: 0.3rem 1rem; align-items: center; justify-content: start; padding-left: 0.2rem; }
      .volumen { text-align: center; padding: 0.12rem 0.4rem; border-radius: 999px; background: hsl(var(--primary)); font-size: 0.92rem; font-weight: 700; white-space: nowrap; }
      .volumen.primera { background: hsl(var(--primary-suave)); font-weight: 600; }
      .precio { font-size: 1.28rem; font-weight: 800; letter-spacing: -0.02em; white-space: nowrap; }
      .sin-precio { color: hsl(var(--texto-3)); grid-column: 1 / -1; }

      /* A quién se muestra: solo los iconos prendidos (como la maqueta); «+» abre los demás para prenderlos */
      .usos { display: flex; align-items: center; gap: 0.15rem; flex-wrap: wrap; padding-left: 0.2rem; }
      .uso { position: relative; width: 32px; height: 32px; border-radius: 10px; border: 0; background: transparent; display: grid; place-items: center; color: hsl(var(--tinta)); padding: 0; }
      .uso + .uso::before { content: ''; position: absolute; left: -1px; top: 7px; height: 18px; width: 1.5px; background: hsl(var(--borde-fuerte)); }
      .uso:hover { background: hsl(var(--primary-suave)); }
      .uso.apagado { color: hsl(var(--texto-3)); opacity: 0.55; }
      .uso.prendido.editando { background: hsl(var(--primary-suave)); }
      .uso:disabled { opacity: 0.5; cursor: wait; }
      .uso.abrir { color: hsl(var(--texto-3)); }
      .uso.abrir::before { display: none; }

      .producto-pie { display: grid; grid-template-columns: 146px auto 1fr; align-items: center; gap: 0.9rem; padding-top: 0.2rem; }
      .producto-pie .raya { width: 1.5px; height: 30px; background: hsl(var(--borde-fuerte)); }
      .producto-pie .boton-contorno { justify-self: end; height: 40px; padding: 0 1.4rem; font-size: 1.05rem; }
      .interruptor { display: inline-flex; align-items: center; justify-content: center; gap: 0.6rem; border: 0; background: transparent; font-weight: 600; font-size: 1.1rem; padding: 0.25rem; }
      .riel { width: 50px; height: 28px; border-radius: 999px; background: hsl(var(--borde-fuerte)); position: relative; transition: background 0.15s; }
      .riel::after { content: ''; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.2); transition: transform 0.15s; }
      .interruptor[aria-checked="true"] .riel { background: hsl(140 50% 36%); }
      .interruptor[aria-checked="true"] .riel::after { transform: translateX(22px); }

      .producto.apagado .producto-foto img { filter: grayscale(1); opacity: 0.55; }
      .producto.apagado .precio, .producto.apagado .titulo-fila strong { color: hsl(var(--texto-3)); }
      .producto.apagado .volumen { background: hsl(var(--tenue)); color: hsl(var(--texto-3)); }
      .producto.apagado .rubro-disco { background: hsl(var(--tenue)); }

      .tabla { padding: 0.5rem; }
      .tabla td .usos { padding: 0; }
      .fila-producto { display: flex; align-items: center; gap: 0.75rem; }

      /* Formulario */
      .campo { display: grid; gap: 0.4rem; }
      .campo > span { font-weight: 700; }
      .campo .ayuda { color: hsl(var(--texto-3)); font-size: 0.8125rem; font-weight: 500; }
      .dos { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
      .escala-fila { display: grid; grid-template-columns: 1.2fr 0.8fr 1fr auto; gap: 0.5rem; align-items: center; }
      .quitar { width: 40px; height: 40px; border-radius: 50%; border: 0; background: hsl(var(--tenue)); display: grid; place-items: center; }
      .agregar { justify-self: start; }
      .foto-editor { display: flex; align-items: center; gap: 1rem; }
      .foto-editor .producto-foto { width: 110px; height: 110px; font-size: 2rem; }
      .elegir-foto { position: relative; overflow: hidden; }
      .elegir-foto input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

      @media (max-width: 1300px) { .rubros, .areas { max-width: 100%; } }
      @media (max-width: 520px) { .catalogo { grid-template-columns: minmax(0, 1fr); } .producto-arriba { grid-template-columns: 100px minmax(0, 1fr); } .producto-pie { grid-template-columns: auto auto; justify-content: space-between; } .producto-pie .raya { display: none; } .producto-foto { height: 130px; } .dos, .escala-fila { grid-template-columns: 1fr 1fr; } }
    `,
  ],
  template: `
    <div class="cabecera">
      <div>
        <h1 class="titulo-pantalla">Productos</h1>
        <p class="subtitulo">Tu catálogo mayorista, siempre actualizado</p>
      </div>
      <span class="capsula-contador"><abasto-icono nombre="calendario" [tamano]="24" /> {{ productos().length }} productos · {{ sinStock() }} sin stock</span>
    </div>

    <div class="barra barra-arriba">
      <div class="segmentos rubros" role="group" aria-label="Filtrar por categoría">
        <button class="segmento" [class.elegido]="rubro() === ''" (click)="rubro.set('')">Todos</button>
        @for (r of rubros(); track r) {
          <button class="segmento" [class.elegido]="rubro() === r" [attr.title]="r" (click)="rubro.set(r)">{{ corto(r) }}</button>
        }
      </div>
      <button class="boton-primario boton-nuevo" (click)="nuevo()"><abasto-icono nombre="mas" [tamano]="26" [grosor]="2.8" /> Nuevo producto</button>
    </div>

    <div class="barra">
      <div class="segmentos areas" role="group" aria-label="Filtrar por área">
        <span class="etiqueta-grupo">Mostrar a:</span>
        @for (a of areas(); track a.clave) {
          <button class="segmento" [class.elegido]="uso() === a.clave" [attr.aria-pressed]="uso() === a.clave"
            [attr.title]="a.cuantos + ' productos'" (click)="uso.set(uso() === a.clave ? 'todos' : a.clave)">
            @if (a.clave !== 'ninguno') { <abasto-icono [nombre]="a.clave" [tamano]="20" /> }
            {{ a.nombre }}
          </button>
        }
      </div>
      <div class="segmentos vista" role="group" aria-label="Cómo ver">
        <button class="segmento oscuro" [class.elegido]="vista() === 'cuadricula'" [attr.aria-pressed]="vista() === 'cuadricula'" (click)="verComo('cuadricula')"><abasto-icono nombre="cuadricula" [tamano]="22" /> Cuadrícula</button>
        <button class="segmento oscuro" [class.elegido]="vista() === 'lista'" [attr.aria-pressed]="vista() === 'lista'" (click)="verComo('lista')"><abasto-icono nombre="lista" [tamano]="22" /> Lista</button>
      </div>
    </div>

    @if (busqueda()) {
      <span class="buscando">Buscando «{{ busqueda() }}»
        <button (click)="buscar('')" aria-label="Quitar la búsqueda"><abasto-icono nombre="cerrar" [tamano]="16" /></button>
      </span>
    }
    @if (error()) { <p class="falla">{{ error() }}</p> }

    @if (!visibles().length) {
      <div class="carta vacio">{{ productos().length ? 'Ningún producto con ese filtro.' : busqueda() ? 'No encontramos productos con esa búsqueda.' : 'Todavía no hay productos: crea el primero con «Nuevo producto».' }}</div>
    } @else if (vista() === 'cuadricula') {
      <div class="catalogo">
        @for (p of visibles(); track p.id) {
          <article class="producto" [class.apagado]="apagado(p)" [attr.aria-label]="p.nombre">
            <div class="producto-arriba">
              <div class="producto-foto">
                @if (p.foto) { <img [src]="p.foto" [alt]="p.nombre" loading="lazy" /> } @else { {{ letra(p.nombre) }} }
              </div>
              <div class="producto-info">
                <div class="titulo-fila">
                  <span class="rubro-disco" [attr.title]="p.rubro"><abasto-icono [nombre]="iconoRubro(p.rubro)" [tamano]="22" /></span>
                  <div>
                    <strong>{{ partes(p).titulo }}</strong>
                    <span class="detalle">{{ partes(p).detalle }}
                      @if (p.precioPorConfirmar) { <span class="insignia por-revisar">Precio por revisar</span> }
                    </span>
                  </div>
                  <span class="insignia" [class]="'insignia ' + estado(p).clase">{{ estado(p).texto }}</span>
                </div>
                <div class="escalas">
                  @for (e of p.escalas; track $index; let primera = $first) {
                    <span class="volumen" [class.primera]="primera">{{ escala(e) }}</span>
                    <span class="precio">{{ e.precioUnitario?.texto ?? '—' }}</span>
                  } @empty {
                    <span class="sin-precio">Sin precio cargado</span>
                  }
                </div>
                <div class="usos" role="group" [attr.aria-label]="'A quién se muestra ' + p.nombre">
                  @for (u of todosLosUsos; track u.clave) {
                    @if (p.usos.includes(u.clave) || abiertoUsos() === p.id) {
                      <button class="uso" [class.prendido]="p.usos.includes(u.clave)" [class.apagado]="!p.usos.includes(u.clave)"
                        [class.editando]="abiertoUsos() === p.id" [disabled]="guardando() === p.id"
                        [attr.aria-pressed]="p.usos.includes(u.clave)" [attr.aria-label]="u.nombre"
                        [attr.title]="(p.usos.includes(u.clave) ? 'Se muestra a ' : 'Mostrar a ') + u.nombre" (click)="alternar(p, u.clave)">
                        <abasto-icono [nombre]="u.clave" [tamano]="20" />
                      </button>
                    }
                  }
                  <button class="uso abrir" [attr.aria-expanded]="abiertoUsos() === p.id" aria-label="Cambiar a quién se muestra"
                    [attr.title]="abiertoUsos() === p.id ? 'Listo' : 'Cambiar a quién se muestra'" (click)="abiertoUsos.set(abiertoUsos() === p.id ? null : p.id)">
                    <abasto-icono [nombre]="abiertoUsos() === p.id ? 'check' : 'mas'" [tamano]="18" />
                  </button>
                </div>
              </div>
            </div>
            <div class="producto-pie">
              <button class="interruptor" role="switch" [attr.aria-checked]="p.estado !== 'PAUSADO'" [disabled]="guardando() === p.id"
                [attr.aria-label]="(p.estado === 'PAUSADO' ? 'Activar ' : 'Pausar ') + p.nombre" (click)="activar(p)">
                <span class="riel"></span> {{ p.estado === 'PAUSADO' ? 'Pausado' : 'Activo' }}
              </button>
              <span class="raya" aria-hidden="true"></span>
              <button class="boton-contorno boton-chico" (click)="editar(p)"><abasto-icono nombre="lapiz" [tamano]="18" /> Editar</button>
            </div>
          </article>
        }
      </div>
    } @else {
      <div class="carta tabla">
        <table>
          <thead><tr><th>Producto</th><th>Precio por volumen</th><th>Se muestra a</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            @for (p of visibles(); track p.id) {
              <tr>
                <td>
                  <div class="fila-producto">
                    <span class="mini">@if (p.foto) { <img [src]="p.foto" alt="" loading="lazy" /> } @else { {{ letra(p.nombre) }} }</span>
                    <div><strong>{{ p.nombre }}</strong><span class="gris mono">{{ p.codigo }} · {{ p.rubro }}</span></div>
                  </div>
                </td>
                <td>
                  @for (e of p.escalas; track $index) { <div><strong>{{ e.precioUnitario?.texto ?? '—' }}</strong> <span class="gris" style="display: inline">c/u · {{ escala(e) }}</span></div> }
                </td>
                <td>
                  <div class="usos">
                    @for (u of todosLosUsos; track u.clave) {
                      <button class="uso" [class.prendido]="p.usos.includes(u.clave)" [disabled]="guardando() === p.id"
                        [attr.aria-pressed]="p.usos.includes(u.clave)" [attr.aria-label]="u.nombre" [attr.title]="u.nombre" (click)="alternar(p, u.clave)">
                        <abasto-icono [nombre]="u.clave" [tamano]="16" />
                      </button>
                    }
                  </div>
                </td>
                <td><span class="insignia" [class]="'insignia ' + estado(p).clase">{{ estado(p).texto }}</span></td>
                <td><button class="boton-contorno boton-chico" (click)="editar(p)">Editar</button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (borrador(); as b) {
      <div class="velo" (click)="cerrarEditor()">
        <aside class="lateral" role="dialog" [attr.aria-label]="b.id ? 'Editar ' + b.nombre : 'Nuevo producto'" (click)="$event.stopPropagation()">
          <div class="lateral-cabeza">
            <div>
              <h2>{{ b.id ? 'Editar producto' : 'Nuevo producto' }}</h2>
              <span class="gris">{{ b.id ? b.codigo : 'Lo ven tus clientes en la app apenas lo guardes' }}</span>
            </div>
            <button class="cerrar" (click)="cerrarEditor()" aria-label="Cerrar"><abasto-icono nombre="cerrar" /></button>
          </div>
          <div class="lateral-cuerpo">
            <div class="foto-editor">
              <div class="producto-foto">
                @if (b.fotoNueva ?? b.foto; as f) { <img [src]="f" alt="" /> } @else { <abasto-icono nombre="foto" [tamano]="36" /> }
              </div>
              <div style="display: grid; gap: 0.4rem">
                <span class="boton-suave boton-chico elegir-foto">
                  {{ b.foto || b.fotoNueva ? 'Cambiar la foto' : 'Ponerle foto' }}
                  <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Elegir la foto del producto" (change)="elegirFoto($event)" />
                </span>
                <span class="gris">Una foto clara, de frente y con fondo liso.</span>
              </div>
            </div>
            <label class="campo"><span>Nombre</span>
              <input class="entrada" [value]="b.nombre" (input)="cambiar('nombre', $any($event.target).value)" placeholder="Harina de trigo · quintal 46 kg" />
              <span class="ayuda">Con « · » separas el producto de su presentación.</span>
            </label>
            <div class="dos">
              @if (!b.id) {
                <label class="campo"><span>Código</span><input class="entrada" [value]="b.codigo" (input)="cambiar('codigo', $any($event.target).value)" /></label>
              }
              <label class="campo"><span>Categoría</span>
                <input class="entrada" list="rubros" [value]="b.rubro" (input)="cambiar('rubro', $any($event.target).value)" placeholder="Granos y cereales" />
              </label>
            </div>
            <datalist id="rubros">@for (r of rubros(); track r) { <option [value]="r"></option> }</datalist>

            <div class="campo">
              <span>Precio por volumen <span class="ayuda">(precio de cada unidad)</span></span>
              @for (e of b.escalas; track $index; let i = $index) {
                <div class="escala-fila">
                  <select class="entrada" [attr.aria-label]="'Presentación ' + (i + 1)" (change)="cambiarEscala(i, 'presentacion', $any($event.target).value)">
                    @for (pr of presentaciones; track pr) { <option [value]="pr" [selected]="pr === e.presentacion">{{ pr.charAt(0) + pr.slice(1).toLowerCase() }}</option> }
                  </select>
                  <input class="entrada" inputmode="numeric" [attr.aria-label]="'Unidades ' + (i + 1)" [value]="e.unidades" (input)="cambiarEscala(i, 'unidades', $any($event.target).value)" placeholder="u." />
                  <input class="entrada" inputmode="decimal" [attr.aria-label]="'Precio por unidad ' + (i + 1)" [value]="e.precio" (input)="cambiarEscala(i, 'precio', $any($event.target).value)" placeholder="Bs 0,00" />
                  <button class="quitar" [disabled]="b.escalas.length === 1" (click)="quitarEscala(i)" [attr.aria-label]="'Quitar el precio ' + (i + 1)"><abasto-icono nombre="cerrar" [tamano]="16" /></button>
                </div>
              }
              <button class="boton-suave boton-chico agregar" (click)="agregarEscala()"><abasto-icono nombre="mas" [tamano]="18" /> Otro precio por volumen</button>
            </div>

            <div class="dos">
              <label class="campo"><span>Te cuesta (c/u)</span><input class="entrada" inputmode="decimal" [value]="b.costo" (input)="cambiar('costo', $any($event.target).value)" placeholder="Bs 0,00" /></label>
              <label class="campo"><span>Dónde lo compras</span>
                <input class="entrada" list="proveedores" [value]="b.proveedor" (input)="cambiar('proveedor', $any($event.target).value)" placeholder="Mercado Los Pozos" />
              </label>
            </div>
            <datalist id="proveedores">@for (pv of proveedores(); track pv) { <option [value]="pv"></option> }</datalist>

            <div class="campo">
              <span>¿Lo tienes en depósito?</span>
              <div class="segmentos" role="group" aria-label="Abastecimiento">
                <button class="segmento" [class.elegido]="b.abastecimiento === 'STOCK'" (click)="cambiar('abastecimiento', 'STOCK')">Sí, tengo stock</button>
                <button class="segmento" [class.elegido]="b.abastecimiento === 'BAJO_PEDIDO'" (click)="cambiar('abastecimiento', 'BAJO_PEDIDO')">Lo compro bajo pedido</button>
              </div>
            </div>
            <div class="dos">
              @if (b.abastecimiento === 'STOCK') {
                <label class="campo"><span>Stock (unidades)</span><input class="entrada" inputmode="numeric" [value]="b.stock" (input)="cambiar('stock', $any($event.target).value)" /></label>
              }
              <label class="campo"><span>Llega en (horas)</span><input class="entrada" inputmode="numeric" [value]="b.entregaHoras" (input)="cambiar('entregaHoras', $any($event.target).value)" placeholder="24" /></label>
            </div>

            <div class="campo">
              <span>Mostrar a</span>
              <div class="usos" style="padding: 0">
                @for (u of todosLosUsos; track u.clave) {
                  <button class="segmento" [class.elegido]="b.usos.includes(u.clave)" [attr.aria-pressed]="b.usos.includes(u.clave)" (click)="alternarUsoDelBorrador(u.clave)">
                    <abasto-icono [nombre]="u.clave" [tamano]="18" /> {{ u.nombre }}
                  </button>
                }
              </div>
            </div>
            @if (errorDelEditor()) { <p class="falla" role="alert">{{ errorDelEditor() }}</p> }
          </div>
          <div class="lateral-pie">
            <button class="boton-secundario" (click)="cerrarEditor()">Cancelar</button>
            <button class="boton-primario" [disabled]="guardandoEditor()" (click)="guardar()">{{ guardandoEditor() ? 'Guardando…' : b.id ? 'Guardar cambios' : 'Crear producto' }}</button>
          </div>
        </aside>
      </div>
    }
  `,
})
export class VistaProductos implements OnInit, OnDestroy {
  private readonly graphql = inject(GraphQL);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly productos = signal<ProductoFila[]>([]);
  readonly error = signal<string | null>(null);
  readonly uso = signal('todos');
  readonly rubro = signal('');
  readonly busqueda = signal(busquedaDeLaUrl());
  readonly vista = signal<'cuadricula' | 'lista'>(this.vistaGuardada());
  readonly guardando = signal<string | null>(null);
  readonly abiertoUsos = signal<string | null>(null);
  readonly borrador = signal<Borrador | null>(null);
  readonly errorDelEditor = signal<string | null>(null);
  readonly guardandoEditor = signal(false);
  readonly todosLosUsos = USOS;
  readonly presentaciones = PRESENTACIONES;
  readonly rubros = computed(() => [...new Set(this.productos().map((p) => p.rubro))].sort((a, b) => a.localeCompare(b, 'es')));
  readonly proveedores = computed(() => [...new Set(this.productos().map((p) => p.proveedor).filter((p): p is string => !!p))].sort());
  readonly visibles = computed(() => {
    const porUso = filtrarPorUso(this.productos(), this.uso());
    return this.rubro() ? porUso.filter((p) => p.rubro === this.rubro()) : porUso;
  });
  readonly areas = computed(() => {
    const lista = this.productos();
    return [
      ...USOS.map((u) => ({ ...u, cuantos: filtrarPorUso(lista, u.clave).length })),
      { clave: 'ninguno', nombre: 'Sin mostrar', cuantos: filtrarPorUso(lista, 'ninguno').length },
    ];
  });

  private readonly alBuscar = (e: Event) => void this.buscar((e as CustomEvent<{ texto: string }>).detail.texto);

  ngOnInit() {
    document.addEventListener('abasto:buscar', this.alBuscar);
    void this.buscar(this.busqueda());
  }

  ngOnDestroy() {
    document.removeEventListener('abasto:buscar', this.alBuscar);
  }

  sinStock = () => this.productos().filter((p) => (p.stock === 0 && p.abastecimiento !== 'BAJO_PEDIDO') || p.estado === 'SIN_STOCK').length;
  estado = (p: ProductoFila) => ESTADOS[p.estado] ?? { texto: p.estado, clase: 'neutro' };
  apagado = (p: ProductoFila) => p.estado === 'PAUSADO' || p.estado === 'SIN_STOCK';
  partes = partesDelNombre;
  escala = etiquetaDeEscala;
  iconoRubro = iconoDeRubro;
  corto = rubroCorto;
  letra = inicial;

  private vistaGuardada(): 'cuadricula' | 'lista' {
    try {
      return localStorage.getItem('abasto-productos-vista') === 'lista' ? 'lista' : 'cuadricula';
    } catch {
      return 'cuadricula';
    }
  }

  verComo(v: 'cuadricula' | 'lista') {
    this.vista.set(v);
    try {
      localStorage.setItem('abasto-productos-vista', v);
    } catch {
      // Solo no se recuerda
    }
  }

  async buscar(busqueda: string) {
    this.busqueda.set(busqueda);
    try {
      const datos = await this.graphql.consultar<{ misProductos: ProductoFila[] }>(MIS_PRODUCTOS, { busqueda: busqueda || null });
      this.productos.set(datos.misProductos);
      this.error.set(null);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  private poner(id: string, cambio: Partial<ProductoFila>) {
    this.productos.update((l) => l.map((x) => (x.id === id ? { ...x, ...cambio } : x)));
  }

  /** Cambia en pantalla al toque; si Catálogo lo rechaza, vuelve atrás y avisa. */
  async alternar(p: ProductoFila, uso: string) {
    const antes = p.usos;
    const usos = alternarUso(antes, uso);
    this.poner(p.id, { usos });
    this.guardando.set(p.id);
    try {
      await this.graphql.consultar(CAMBIAR_USOS, { id: p.id, usos });
      this.error.set(null);
    } catch (e) {
      this.poner(p.id, { usos: antes });
      this.error.set(`No se pudo cambiar «${p.nombre}»: ${(e as Error).message}`);
    } finally {
      this.guardando.set(null);
    }
  }

  /** Pausar lo saca de la app sin borrarlo; activarlo lo vuelve a mostrar. */
  async activar(p: ProductoFila) {
    const antes = p.estado;
    const nuevo = antes === 'PAUSADO' ? 'ACTIVO' : 'PAUSADO';
    this.poner(p.id, { estado: nuevo });
    this.guardando.set(p.id);
    try {
      const r = await this.graphql.consultar<{ editarProducto: { estado: string } }>(CAMBIAR_ESTADO, { id: p.id, estado: nuevo });
      this.poner(p.id, { estado: r.editarProducto.estado });
      avisar(this.host.nativeElement, nuevo === 'PAUSADO' ? `Pausaste ${p.nombre}: ya no sale en la app` : `${p.nombre} vuelve a salir en la app`);
      this.error.set(null);
    } catch (e) {
      this.poner(p.id, { estado: antes });
      this.error.set(`No se pudo cambiar «${p.nombre}»: ${(e as Error).message}`);
    } finally {
      this.guardando.set(null);
    }
  }

  nuevo() {
    this.errorDelEditor.set(null);
    this.borrador.set({
      id: null,
      codigo: codigoSiguiente(this.productos().map((p) => p.codigo)),
      nombre: '',
      rubro: this.rubro(),
      escalas: [{ presentacion: 'UNIDAD', unidades: '1', precio: '' }],
      costo: '',
      proveedor: '',
      abastecimiento: 'BAJO_PEDIDO',
      stock: '0',
      entregaHoras: '24',
      usos: ['hogar', 'tienda'],
      foto: null,
      fotoNueva: null,
    });
  }

  editar(p: ProductoFila) {
    this.errorDelEditor.set(null);
    this.borrador.set({
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      rubro: p.rubro,
      escalas: p.escalas.map((e) => ({ presentacion: e.presentacion, unidades: String(e.cantidad), precio: aTexto(e.precioUnitario?.centavos) })),
      costo: aTexto(p.costoUnitario?.centavos),
      proveedor: p.proveedor ?? '',
      abastecimiento: p.abastecimiento ?? 'STOCK',
      stock: String(p.stock),
      entregaHoras: p.entregaHoras == null ? '' : String(p.entregaHoras),
      usos: [...p.usos],
      foto: p.foto ?? null,
      fotoNueva: null,
    });
    if (!p.escalas.length) this.agregarEscala();
  }

  cerrarEditor() {
    this.borrador.set(null);
  }

  cambiar<K extends keyof Borrador>(campo: K, valor: Borrador[K]) {
    this.borrador.update((b) => (b ? { ...b, [campo]: valor } : b));
  }

  cambiarEscala(i: number, campo: keyof FilaDeEscala, valor: string) {
    this.borrador.update((b) => {
      if (!b) return b;
      const escalas = b.escalas.map((e, j) => {
        if (j !== i) return e;
        const nueva = { ...e, [campo]: valor };
        // Elegir docena pone 12 u.; unidad, 1
        if (campo === 'presentacion' && valor === 'DOCENA') nueva.unidades = '12';
        if (campo === 'presentacion' && valor === 'UNIDAD') nueva.unidades = '1';
        return nueva;
      });
      return { ...b, escalas };
    });
  }

  agregarEscala() {
    this.borrador.update((b) => (b ? { ...b, escalas: [...b.escalas, { presentacion: 'CAJA', unidades: '', precio: '' }] } : b));
  }

  quitarEscala(i: number) {
    this.borrador.update((b) => (b ? { ...b, escalas: b.escalas.filter((_, j) => j !== i) } : b));
  }

  alternarUsoDelBorrador(uso: string) {
    this.borrador.update((b) => (b ? { ...b, usos: alternarUso(b.usos, uso) } : b));
  }

  async elegirFoto(evento: Event) {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    if (!archivo) return;
    try {
      this.cambiar('fotoNueva', await achicarFoto(archivo));
      this.errorDelEditor.set(null);
    } catch (e) {
      this.errorDelEditor.set((e as Error).message);
    }
  }

  /** Revisa lo escrito y lo manda a Catálogo: crear, o editar + stock + foto. */
  async guardar() {
    const b = this.borrador();
    if (!b) return;
    const nombre = b.nombre.trim();
    if (!nombre) return this.errorDelEditor.set('Ponle un nombre al producto.');
    if (!b.rubro.trim()) return this.errorDelEditor.set('Elige o escribe su categoría.');
    const escalas = [];
    for (const [i, e] of b.escalas.entries()) {
      const unidades = Number(e.unidades);
      const precio = aCentavos(e.precio);
      if (!Number.isInteger(unidades) || unidades < 1) return this.errorDelEditor.set(`Pon cuántas unidades trae el precio ${i + 1}.`);
      if (precio === null || precio <= 0) return this.errorDelEditor.set(`Escribe el precio ${i + 1} así: 15,40.`);
      escalas.push({ presentacion: e.presentacion, unidades, precioUnitarioCentavos: precio });
    }
    const costo = b.costo.trim() ? aCentavos(b.costo) : null;
    if (b.costo.trim() && costo === null) return this.errorDelEditor.set('Escribe lo que te cuesta así: 12,50.');
    const stock = b.abastecimiento === 'STOCK' ? Number(b.stock || 0) : 0;
    if (!Number.isInteger(stock) || stock < 0) return this.errorDelEditor.set('El stock va en unidades enteras.');
    const horas = b.entregaHoras.trim() ? Number(b.entregaHoras) : null;
    if (horas !== null && (!Number.isInteger(horas) || horas < 0)) return this.errorDelEditor.set('Las horas de entrega van en número entero.');

    const comun = {
      nombre,
      rubro: b.rubro.trim(),
      escalas,
      abastecimiento: b.abastecimiento,
      entregaHoras: horas,
      costoUnitarioCentavos: costo,
      proveedor: b.proveedor.trim() || null,
      usos: b.usos,
    };
    this.guardandoEditor.set(true);
    this.errorDelEditor.set(null);
    try {
      let id = b.id;
      if (id) {
        await this.graphql.consultar(EDITAR, { id, e: comun });
        const antes = this.productos().find((p) => p.id === id);
        if (b.abastecimiento === 'STOCK' && antes && antes.stock !== stock) await this.graphql.consultar(AJUSTAR_STOCK, { id, s: stock });
      } else {
        const r = await this.graphql.consultar<{ crearProducto: { id: string } }>(CREAR, { e: { ...comun, codigo: b.codigo.trim(), stock } });
        id = r.crearProducto.id;
      }
      if (b.fotoNueva) await this.graphql.consultar(CAMBIAR_FOTO, { id, i: b.fotoNueva });
      avisar(this.host.nativeElement, b.id ? `Guardaste ${nombre}` : `Creaste ${nombre}: ya sale en la app`);
      this.borrador.set(null);
      await this.buscar(this.busqueda());
    } catch (e) {
      this.errorDelEditor.set((e as Error).message);
    } finally {
      this.guardandoEditor.set(false);
    }
  }
}
