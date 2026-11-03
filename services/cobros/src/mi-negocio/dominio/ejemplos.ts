/** Un artículo de ejemplo (la harina por quintal) para las pruebas del módulo. */
import type { Articulo } from './modelo.js';

const F = '2026-11-01T12:00:00.000Z';
export const articulo = (id: string, extra: Partial<Articulo> = {}): Articulo => ({
  id,
  nombre: 'Harina de trigo',
  detalle: 'quintal 46 kg',
  rubro: 'Harinas y panificación',
  medida: { envase: 'quintal', porEnvase: 46, unidad: 'kg' },
  clase: 'COMPRADO',
  origen: 'ABASTO',
  productoId: 'AB-101',
  proveedor: null,
  precioVentaCentavos: null,
  stockMinimo: null,
  creadoEn: F,
  actualizadoEn: F,
  eliminado: false,
  ...extra,
});

