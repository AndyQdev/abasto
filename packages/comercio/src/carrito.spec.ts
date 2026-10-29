import { describe, expect, it } from 'vitest';
import { agregar, bs, cantidadConUnidad, porMayorista, type ItemDeCarrito } from './carrito';

const shampoo: ItemDeCarrito = {
  productoId: 'HP-0400',
  nombre: 'Shampoo 400 ml',
  mayoristaId: 'lp',
  mayoristaNombre: 'Distribuidora Los Pozos',
  presentacion: 'CAJA',
  cantidad: 1,
  unidadesPorPresentacion: 48,
  precioUnitarioCentavos: 1800,
};

describe('Carrito', () => {
  it('sumar el mismo producto en la misma presentación no duplica la línea', () => {
    const carrito = agregar(agregar([], shampoo), shampoo);
    expect(carrito).toHaveLength(1);
    expect(cantidadConUnidad(carrito[0])).toBe('2 cajas · 96 u.');
  });

  it('un pedido por mayorista, con su total estimado', () => {
    const carrito = agregar(agregar([], { ...shampoo, cantidad: 2 }), {
      ...shampoo,
      productoId: 'X',
      mayoristaId: 'lr',
      mayoristaNombre: 'Importadora La Ramada',
      precioUnitarioCentavos: null,
    });
    const pedidos = porMayorista(carrito);
    expect(pedidos.map((p) => p.mayoristaNombre)).toEqual(['Distribuidora Los Pozos', 'Importadora La Ramada']);
    expect(bs(pedidos[0].totalEstimadoCentavos)).toBe('Bs 1.728,00');
  });
});
