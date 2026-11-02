import { describe, expect, it } from 'vitest';
import type { Articulo, Movimiento } from './modelo';
import { plantillasDe } from './plantillas';
import { articulosDelEstante, estanteInicial, itemsDelEstante, resumenDeEstante } from './primer-estante';
import { existencias } from './motor';
import { insumosIniciales, primeraReceta, resumenDeRecetas } from './primera-receta';
import { avisoDeStock } from './ventas';
import { CATALOGO_DE_LA_SEMILLA as CATALOGO } from './semilla-de-prueba.spec';

const AHORA = '2026-11-02T10:00:00.000Z';
const vacio = { articulos: [] as Articulo[], movimientos: [] as Movimiento[] };

describe('Arma tu primer estante (tienda)', () => {
  it('trae lo que más se repone, ya marcado, en docena cuando hay', () => {
    const estante = estanteInicial(CATALOGO);
    expect(estante).toHaveLength(19);
    expect(estante.every((l) => l.marcado && l.cantidad === 1)).toBe(true);
    expect(estante.find((l) => l.producto.id === 'AB-001')?.escala.presentacion).toBe('DOCENA');
  });

  it('dice cuánto gana al precio sugerido, y la ganancia se puede cambiar', () => {
    const estante = estanteInicial(CATALOGO).map((l, i) => ({ ...l, marcado: i < 2 }));
    const veinte = resumenDeEstante(estante, 0.2);
    // Arroz Caisy: 12 × Bs 15,40 y azúcar Guabirá: 12 × Bs 7,00
    expect(veinte).toMatchObject({ lineas: 2, costoCentavos: 12 * 1540 + 12 * 700 });
    expect(veinte.gananciaCentavos).toBeGreaterThan(0);
    expect(resumenDeEstante(estante, 0.3).gananciaCentavos).toBeGreaterThan(veinte.gananciaCentavos);
  });

  it('al pedir: los productos van al carrito y quedan en el inventario en cero, con su precio de venta', () => {
    const estante = estanteInicial(CATALOGO).map((l) => (l.producto.id === 'AB-001' ? { ...l, cantidad: 2 } : { ...l, marcado: false }));
    expect(itemsDelEstante(estante)).toEqual([expect.objectContaining({ productoId: 'AB-001', presentacion: 'DOCENA', cantidad: 2 })]);
    const [arroz] = articulosDelEstante(estante, 0.2, vacio, AHORA);
    expect(arroz).toMatchObject({ id: 'abasto:AB-001', productoId: 'AB-001', precioVentaCentavos: 1850 }); // 15,40 + 20 %, a 50 ctvs
    // Todavía no llegó: está «por comprar», no agotado, y no avisa «se te acaba»
    const [x] = existencias({ articulos: [arroz], movimientos: [] });
    expect(x).toMatchObject({ porComprar: true, agotado: true });
    expect(avisoDeStock(x, { articulos: [arroz], movimientos: [] })).toBeNull();
    // Si ya tenía precio, no se lo cambia
    expect(articulosDelEstante(estante, 0.3, { articulos: [arroz], movimientos: [] }, AHORA)).toEqual([]);
  });
});

describe('Después de la primera receta', () => {
  it('cuánto cuesta cada unidad y qué falta, sumando las recetas de la pensión', () => {
    let n = 0;
    const id = () => `r-${++n}`;
    const [majadito, sopa] = plantillasDe('pension');
    const a = primeraReceta({ nombre: majadito.nombre, rinde: 20, insumos: insumosIniciales(majadito, CATALOGO) }, CATALOGO, vacio, AHORA, id);
    const libro = { articulos: a.cambios.articulos, movimientos: [] as Movimiento[] };
    const b = primeraReceta({ nombre: sopa.nombre, rinde: 20, insumos: insumosIniciales(sopa, CATALOGO) }, CATALOGO, libro, AHORA, id);
    libro.articulos.push(...b.cambios.articulos);

    const r = resumenDeRecetas([a.receta, b.receta], libro, CATALOGO);
    expect(r.costos.map((c) => c.receta.nombre)).toEqual(['Majadito', 'Sopa de maní']);
    expect(r.costos.every((c) => c.porUnidadCentavos > 0)).toBe(true);
    // La cebolla está en las dos: sale una sola vez, con lo de las dos (1 kg + 600 g de una arroba de 11,5 kg)
    const cebolla = r.faltantes.filter((f) => f.productoId === 'AB-117');
    expect(cebolla).toHaveLength(1);
    expect(cebolla[0].envases).toBeCloseTo(1.6 / 11.5, 5);
  });
});
