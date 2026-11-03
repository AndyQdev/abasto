import { compraEntregada, medidaDeContenido, separarContenido, type PedidoEntregado } from './compra-entregada.js';

const AHORA = '2026-11-01T12:00:00.000Z';
const pedido: PedidoEntregado = {
  pedidoId: 'p-1',
  codigo: 'A-0001',
  tiendaId: 'rosa',
  totalCentavos: 63100,
  lineas: [
    { productoId: 'AB-101', presentacion: 'UNIDAD', unidades: 2, subtotalCentavos: 57000 },
    { productoId: 'AB-114', presentacion: 'UNIDAD', unidades: 2, subtotalCentavos: 6100 },
  ],
};
const productos = new Map([
  ['AB-101', { nombre: 'Harina de trigo · quintal 46 kg', rubro: 'Harinas y panificación' }],
  ['AB-114', { nombre: 'Huevo · maple de 30', rubro: 'Huevos y lácteos' }],
]);

describe('las medidas son las mismas que en el teléfono (packages/comercio)', () => {
  it('lee la medida del nombre del producto', () => {
    expect(medidaDeContenido('quintal 46 kg')).toEqual({ envase: 'quintal', porEnvase: 46, unidad: 'kg' });
    expect(medidaDeContenido('arroba 11,5 kg')).toEqual({ envase: 'arroba', porEnvase: 11.5, unidad: 'kg' });
    expect(medidaDeContenido('maple de 30')).toEqual({ envase: 'maple', porEnvase: 30, unidad: 'u.' });
    expect(medidaDeContenido('bidón 5 L')).toEqual({ envase: 'bidón', porEnvase: 5, unidad: 'L' });
    expect(medidaDeContenido('900 ml')).toEqual({ envase: 'unidad', porEnvase: 900, unidad: 'ml' });
    expect(medidaDeContenido('3 de 110 g')).toEqual({ envase: 'paquete', porEnvase: 3, unidad: 'u.' });
    expect(medidaDeContenido('24 rollos')).toEqual({ envase: 'paquete', porEnvase: 24, unidad: 'rollos' });
    expect(medidaDeContenido(null)).toEqual({ envase: 'unidad', porEnvase: 1, unidad: 'u.' });
  });

  it('separa el nombre del contenido', () => {
    expect(separarContenido('Harina de trigo · quintal 46 kg')).toEqual({ nombre: 'Harina de trigo', contenido: 'quintal 46 kg' });
    expect(separarContenido('Aceite Fino 900 ml')).toEqual({ nombre: 'Aceite Fino', contenido: '900 ml' });
    expect(separarContenido('Huevo')).toEqual({ nombre: 'Huevo', contenido: null });
  });
});

describe('un pedido entregado entra solo a Mi negocio', () => {
  it('crea los artículos y las entradas con la clave del teléfono y el costo pagado por unidad', () => {
    const r = compraEntregada(pedido, productos, AHORA);
    expect(r.articulos.map((a) => [a.id, a.nombre, a.detalle, a.medida.envase, a.rubro])).toEqual([
      ['abasto:AB-101', 'Harina de trigo', 'quintal 46 kg', 'quintal', 'Harinas y panificación'],
      ['abasto:AB-114', 'Huevo', 'maple de 30', 'maple', 'Huevos y lácteos'],
    ]);
    expect(r.movimientos[0]).toMatchObject({ claveUnica: 'pedido:p-1:AB-101:UNIDAD', tipo: 'ENTRADA', origen: 'ABASTO', cantidad: 2, costoUnitarioCentavos: 28500, nota: 'Pedido A-0001' });
  });

  it('deja el gasto del pedido con la forma de gastoDeCompra (las cuentas del hogar)', () => {
    expect(compraEntregada(pedido, productos, AHORA).anotaciones).toEqual([
      { id: 'pedido:p-1', tipo: 'GASTO', montoCentavos: 63100, categoria: 'Compras en Abasto', nota: 'Pedido A-0001', origen: 'ABASTO', claveUnica: 'pedido:p-1', fecha: AHORA },
    ]);
  });

  it('si Catálogo no respondió, el artículo queda con el código y se puede completar después', () => {
    const r = compraEntregada(pedido, new Map(), AHORA);
    expect(r.articulos[0]).toMatchObject({ id: 'abasto:AB-101', nombre: 'AB-101', rubro: null });
  });

  it('una línea sin unidades no entra y un pedido de Bs 0 no deja gasto', () => {
    const r = compraEntregada({ ...pedido, totalCentavos: 0, lineas: [{ ...pedido.lineas[0], unidades: 0 }] }, productos, AHORA);
    expect(r).toEqual({ articulos: [], movimientos: [], anotaciones: [] });
  });
});
