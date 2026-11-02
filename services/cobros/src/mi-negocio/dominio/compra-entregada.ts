/**
 * Lo que se compra en Abasto entra solo al inventario del cliente cuando el pedido se entrega (evento
 * pedido.entregado de Pedidos). Es la misma regla que el teléfono (packages/comercio/src/mi-negocio/compras.ts y
 * hogar.ts): las mismas claves y la misma forma, así los dos caminos nunca duplican.
 * - Un artículo `abasto:<productoId>` por producto (si el cliente ya lo tenía, no se toca).
 * - Una ENTRADA por línea con la clave `pedido:<pedidoId>:<productoId>:<presentación>` y el costo pagado por unidad.
 * - Un GASTO «Compras en Abasto» con la clave `pedido:<pedidoId>` por el total (las cuentas del hogar).
 */
import type { Anotacion, Articulo, Medida, Movimiento } from './modelo.js';

export interface LineaEntregada {
  productoId: string;
  presentacion: string;
  unidades: number;
  subtotalCentavos: number;
}

export interface PedidoEntregado {
  pedidoId: string;
  codigo: string;
  tiendaId: string;
  totalCentavos: number;
  lineas: LineaEntregada[];
}

/** Lo que Catálogo sabe del producto; si no responde, se usa el código */
export interface DatosDeProducto {
  nombre: string;
  rubro: string | null;
}

export const COMPRAS_EN_ABASTO = 'Compras en Abasto';
export const claveDeCompra = (pedidoId: string, productoId: string, presentacion: string) => `pedido:${pedidoId}:${productoId}:${presentacion}`;
export const idDeArticuloDeAbasto = (productoId: string) => `abasto:${productoId}`;

export function compraEntregada(p: PedidoEntregado, productos: Map<string, DatosDeProducto>, ahora: string) {
  const articulos = new Map<string, Articulo>();
  const movimientos: Movimiento[] = [];
  for (const l of p.lineas) {
    if (l.unidades <= 0) continue;
    const id = idDeArticuloDeAbasto(l.productoId);
    if (!articulos.has(id)) {
      const datos = productos.get(l.productoId);
      const { nombre, contenido } = separarContenido(datos?.nombre ?? l.productoId);
      articulos.set(id, {
        id,
        nombre,
        detalle: contenido,
        rubro: datos?.rubro ?? null,
        medida: medidaDeContenido(contenido),
        clase: 'COMPRADO',
        origen: 'ABASTO',
        productoId: l.productoId,
        proveedor: null,
        precioVentaCentavos: null,
        stockMinimo: null,
        creadoEn: ahora,
        actualizadoEn: ahora,
        eliminado: false,
      });
    }
    const clave = claveDeCompra(p.pedidoId, l.productoId, l.presentacion);
    movimientos.push({
      id: clave,
      articuloId: id,
      tipo: 'ENTRADA',
      cantidad: l.unidades,
      costoUnitarioCentavos: Math.round(l.subtotalCentavos / l.unidades),
      origen: 'ABASTO',
      claveUnica: clave,
      fecha: ahora,
      nota: `Pedido ${p.codigo}`,
    });
  }
  const anotaciones: Anotacion[] =
    p.totalCentavos > 0
      ? [{ id: `pedido:${p.pedidoId}`, tipo: 'GASTO', montoCentavos: p.totalCentavos, categoria: COMPRAS_EN_ABASTO, nota: `Pedido ${p.codigo}`, origen: 'ABASTO', claveUnica: `pedido:${p.pedidoId}`, fecha: ahora }]
      : [];
  return { articulos: [...articulos.values()], movimientos, anotaciones };
}

// ── Copia de packages/comercio (catalogo.ts y mi-negocio/medidas.ts): el servicio no depende del paquete de la app.
// La prueba compra-entregada.spec.ts fija los mismos casos que mi-negocio.spec.ts de comercio.

const CONTENIDO = /\s(\d+(?:[.,]\d+)?\s?(?:kg|g|ml|l|cc|u\.?))$/i;

export function separarContenido(nombre: string): { nombre: string; contenido: string | null } {
  const [antes, ...despues] = nombre.split(' · ');
  if (despues.length) return { nombre: antes.trim(), contenido: despues.join(' · ').trim() };
  const m = nombre.match(CONTENIDO);
  return m ? { nombre: nombre.slice(0, m.index).trim(), contenido: m[1] } : { nombre, contenido: null };
}

const UNIDAD: Medida = { envase: 'unidad', porEnvase: 1, unidad: 'u.' };
const ENVASES_CON_PESO = ['quintal', 'arroba', 'balde', 'bidón', 'bidon', 'bolsa', 'botella', 'lata', 'caja', 'paquete', 'sobre', 'frasco'];
const ENVASES_CON_UNIDADES = ['maple', 'paquete', 'caja', 'docena', 'bolsa', 'fardo'];
const numero = (t: string) => Number(t.replace(/\./g, '').replace(',', '.'));
const unidadDe = (t: string) => {
  const u = t.toLowerCase();
  if (u === 'kg' || u === 'g' || u === 'ml') return u;
  return u === 'cc' ? 'ml' : 'L';
};

export function medidaDeContenido(contenido: string | null | undefined): Medida {
  const t = (contenido ?? '').trim().toLowerCase();
  if (!t) return UNIDAD;
  const conUnidades = t.match(new RegExp(`^(${ENVASES_CON_UNIDADES.join('|')}) de (\\d+)`));
  if (conUnidades) return { envase: conUnidades[1], porEnvase: Number(conUnidades[2]), unidad: 'u.' };
  const varios = t.match(/^(\d+) de \d+(?:[.,]\d+)?\s?(?:kg|g|ml|l|cc)\b/);
  if (varios) return { envase: 'paquete', porEnvase: Number(varios[1]), unidad: 'u.' };
  const rollos = t.match(/^(\d+) rollos?\b/);
  if (rollos) return { envase: 'paquete', porEnvase: Number(rollos[1]), unidad: 'rollos' };
  const peso = t.match(new RegExp(`^(?:(${ENVASES_CON_PESO.join('|')})\\s+)?(\\d+(?:[.,]\\d+)?)\\s?(kg|g|ml|l|cc)\\b`));
  if (peso) return { envase: peso[1] === 'bidon' ? 'bidón' : (peso[1] ?? 'unidad'), porEnvase: numero(peso[2]), unidad: unidadDe(peso[3]) };
  return UNIDAD;
}
