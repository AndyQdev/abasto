import { articulo } from './ejemplos.js';
import type { CambiosDeNegocio } from './modelo.js';
import { CambioInvalido, MAXIMO_POR_SUBIDA, validarCambios } from './reglas.js';

const F = '2026-11-01T12:00:00.000Z';

const mal = (c: CambiosDeNegocio, mensaje: RegExp) => expect(() => validarCambios(c)).toThrow(mensaje);

describe('lo que sube el teléfono se revisa antes de guardar', () => {
  it('acepta lo que está bien', () => {
    expect(() =>
      validarCambios({
        articulos: [articulo('abasto:AB-101')],
        movimientos: [{ id: 'm1', articuloId: 'abasto:AB-101', tipo: 'AJUSTE', cantidad: -0.217391, costoUnitarioCentavos: null, origen: 'MANUAL', claveUnica: 'ajuste:m1', fecha: F, nota: null }],
        ventas: [{ id: 'v1', fecha: F, lineas: [{ articuloId: 'a', cantidad: 2, precioUnitarioCentavos: 2100, costoUnitarioCentavos: 1750 }], totalCentavos: 4200, costoCentavos: 3500, forma: 'FIADO', clienteId: 'k1', anulada: false }],
        recetas: [{ id: 'r1', articuloId: 'h1', nombre: 'Salteñas', rinde: 100, insumos: [{ articuloId: 'abasto:AB-101', cantidad: 5 }], actualizadoEn: F, eliminado: false }],
      }),
    ).not.toThrow();
  });

  it('rechaza montos negativos, tipos que no existen y recetas que no rinden', () => {
    mal({ articulos: [articulo('a', { precioVentaCentavos: -1 })] }, /precio de venta/);
    mal({ movimientos: [{ id: 'm', articuloId: 'a', tipo: 'REGALO' as 'ENTRADA', cantidad: 1, costoUnitarioCentavos: null, origen: 'MANUAL', claveUnica: 'k', fecha: F, nota: null }] }, /tipo que no existe/);
    mal({ recetas: [{ id: 'r', articuloId: 'h', nombre: 'Pan', rinde: 0, insumos: [], actualizadoEn: F, eliminado: false }] }, /rendir más de cero/);
    mal({ fiados: [{ id: 'f', clienteId: 'k', tipo: 'DEBE', montoCentavos: 0, ventaId: null, fecha: F, nota: null }] }, /mayor a cero/);
    mal({ anotaciones: [{ id: 'a', tipo: 'GASTO', montoCentavos: 500, categoria: 'Luz', nota: null, origen: 'MANUAL', claveUnica: 'a', fecha: 'ayer' }] }, /fecha/);
  });

  it('una venta fiada tiene que decir a quién', () => {
    mal({ ventas: [{ id: 'v', fecha: F, lineas: [{ articuloId: 'a', cantidad: 1, precioUnitarioCentavos: 100, costoUnitarioCentavos: null }], totalCentavos: 100, costoCentavos: 0, forma: 'FIADO', clienteId: null, anulada: false }] }, /a quién/);
  });

  it('no acepta más de lo que cabe en una subida', () => {
    const muchos = Array.from({ length: MAXIMO_POR_SUBIDA + 1 }, (_, i) => articulo(`a${i}`));
    expect(() => validarCambios({ articulos: muchos })).toThrow(CambioInvalido);
  });
});
