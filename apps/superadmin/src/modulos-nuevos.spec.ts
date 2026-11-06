import { describe, expect, it } from 'vitest';
import { conProblemas, tasaDeEntrega, textoDeEntrega, type EntregaDeAviso } from './integraciones';
import { escala, porCiudad, reporteEnCsv, type Reporte, type TiendaDeReporte } from './reportes';
import { celular, filtrarTiendas, textoDeNegocio, type TiendaDeAbasto } from './tiendas';

const tienda = (parcial: Partial<TiendaDeAbasto>): TiendaDeAbasto => ({
  id: 't',
  nombre: 'Tienda',
  ciudad: '',
  telefono: null,
  registradaEn: null,
  dePrueba: false,
  suspendida: false,
  motivoSuspension: null,
  negocio: null,
  ...parcial,
});

describe('Tiendas', () => {
  it('dice qué es cada una en palabras simples', () => {
    expect(textoDeNegocio(null)).toBe('Sin elegir');
    expect(textoDeNegocio({ tipo: 'hogar', subtipo: null })).toBe('Hogar');
    expect(textoDeNegocio({ tipo: 'tienda', subtipo: null })).toBe('Tienda');
    expect(textoDeNegocio({ tipo: 'productor', subtipo: 'salteneria' })).toBe('Productor · Salteñería');
    expect(textoDeNegocio({ tipo: 'productor', subtipo: 'otra' })).toBe('Productor');
  });

  it('filtra por estado y busca sin importar tildes ni mayúsculas', () => {
    const lista = [
      tienda({ id: 'a', nombre: 'Almacén Mery', ciudad: 'Santa Cruz' }),
      tienda({ id: 'b', nombre: 'Doña Rosa', suspendida: true, telefono: '59171234567' }),
    ];
    expect(filtrarTiendas(lista, 'todas', '').map((t) => t.id)).toEqual(['a', 'b']);
    expect(filtrarTiendas(lista, 'activas', '').map((t) => t.id)).toEqual(['a']);
    expect(filtrarTiendas(lista, 'suspendidas', '').map((t) => t.id)).toEqual(['b']);
    expect(filtrarTiendas(lista, 'todas', 'almacen').map((t) => t.id)).toEqual(['a']);
    expect(filtrarTiendas(lista, 'todas', 'DOÑA').map((t) => t.id)).toEqual(['b']);
    expect(filtrarTiendas(lista, 'todas', '7123').map((t) => t.id)).toEqual(['b']);
    expect(filtrarTiendas(lista, 'activas', 'rosa')).toEqual([]);
  });

  it('muestra el celular agrupado', () => {
    expect(celular('59171234567')).toBe('+591 712 34 567');
    expect(celular(null)).toBe('—');
    expect(celular('otro')).toBe('otro');
  });
});

const entrega = (parcial: Partial<EntregaDeAviso>): EntregaDeAviso => ({
  id: 'e',
  orgId: 'dr',
  url: 'https://mitienda.bo',
  tipo: 'pedido.confirmado',
  estado: 'entregada',
  intentos: 1,
  proximoEn: null,
  ultimoError: null,
  creadaEn: '2026-11-06T10:00:00Z',
  ...parcial,
});

describe('Integraciones', () => {
  it('muestra primero lo que ya no se va a reintentar y deja afuera lo que llegó o recién se está enviando', () => {
    const lista = conProblemas([
      entrega({ id: 'llego' }),
      entrega({ id: 'recien', estado: 'pendiente', intentos: 0 }),
      entrega({ id: 'reintentando', estado: 'pendiente', creadaEn: '2026-11-06T12:00:00Z' }),
      entrega({ id: 'perdida', estado: 'fallida', creadaEn: '2026-11-01T12:00:00Z' }),
    ]);
    expect(lista.map((e) => e.id)).toEqual(['perdida', 'reintentando']);
  });

  it('dice cuánto de lo enviado llega', () => {
    expect(tasaDeEntrega([])).toBeNull();
    expect(tasaDeEntrega([entrega({}), entrega({}), entrega({ estado: 'fallida' })])).toBe('67 %');
  });

  it('nombra cada estado', () => {
    expect(textoDeEntrega(entrega({})).texto).toBe('Llegó');
    expect(textoDeEntrega(entrega({ estado: 'fallida' })).texto).toBe('No llegó');
    expect(textoDeEntrega(entrega({ estado: 'pendiente' })).texto).toBe('Reintentando');
  });
});

const venta = (id: string, ciudad: string | null, centavos: number, pedidos = 1): TiendaDeReporte => ({
  tienda: { id, ciudad },
  pedidos,
  ventas: { centavos, texto: '' },
});

describe('Reportes', () => {
  it('junta las ventas por ciudad, de la que más vende a la que menos, y lo que no tiene ciudad al final', () => {
    const ciudades = porCiudad([venta('a', 'La Paz', 100), venta('b', 'Santa Cruz', 500, 2), venta('c', 'La Paz', 50), venta('d', '', 9_000), venta('e', null, 1)]);
    expect(ciudades).toEqual([
      { ciudad: 'Santa Cruz', tiendas: 1, pedidos: 2, centavos: 500 },
      { ciudad: 'La Paz', tiendas: 2, pedidos: 2, centavos: 150 },
      { ciudad: 'Sin ciudad', tiendas: 2, pedidos: 2, centavos: 9_001 },
    ]);
  });

  it('la barra más grande llega a 100 %, una chica se ve y cero no dibuja nada', () => {
    expect(escala([100, 50, 1, 0])).toEqual([100, 50, 3, 0]);
    expect(escala([0, 0])).toEqual([0, 0]);
    expect(escala([])).toEqual([]);
  });

  it('el CSV abre bien en Excel y no ejecuta fórmulas', () => {
    const reporte: Reporte = {
      pedidos: 1,
      ventas: { centavos: 100, texto: '' },
      semanas: [{ desde: '2026-11-02', pedidos: 3, tiendas: 2, ventas: { centavos: 123_450, texto: '' } }],
      tiendas: [venta('a', '=HYPERLINK("x")', 100), venta('b', 'Santa; Cruz', 50)],
    };
    const csv = reporteEnCsv(reporte);
    expect(csv).toContain('2026-11-02;3;2;1234,50');
    expect(csv).toContain(`"'=HYPERLINK(""x"")";1;1;1,00`);
    expect(csv).toContain('"Santa; Cruz";1;1;0,50');
  });
});
