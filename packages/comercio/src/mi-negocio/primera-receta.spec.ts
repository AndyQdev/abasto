import { describe, expect, it } from 'vitest';
import { comprasQueEntran } from './compras';
import type { Articulo, Movimiento } from './modelo';
import { itemsParaPedir } from './pedir';
import { PLANTILLAS, plantillasDe } from './plantillas';
import { insumosIniciales, preciosDeReferencia, primeraReceta, productoParaInsumo } from './primera-receta';
import { costoDeReceta, faltantesDelPlan, planificar } from './produccion';
import { CATALOGO_DE_LA_SEMILLA as CATALOGO } from './semilla-de-prueba.spec';

const AHORA = '2026-11-02T10:00:00.000Z';
let n = 0;
const nuevoId = () => `id-${++n}`;
const vacio = { articulos: [] as Articulo[], movimientos: [] as Movimiento[] };
const saltena = PLANTILLAS.find((p) => p.clave === 'saltena-carne')!;

describe('La primera receta, con los insumos en cero', () => {
  it('elige la presentación más chica que alcanza: 2 kg de harina → la arroba; 11,5 kg → la arroba; 20 kg → el quintal', () => {
    const harina = { codigos: ['AB-102', 'AB-101'] };
    expect(productoParaInsumo({ ...harina, cantidad: 2, unidad: 'kg' }, CATALOGO)?.id).toBe('AB-102');
    expect(productoParaInsumo({ ...harina, cantidad: 11.5, unidad: 'kg' }, CATALOGO)?.id).toBe('AB-102');
    expect(productoParaInsumo({ ...harina, cantidad: 20, unidad: 'kg' }, CATALOGO)?.id).toBe('AB-101');
    expect(productoParaInsumo({ ...harina, cantidad: 2000, unidad: 'kg' }, CATALOGO)?.id).toBe('AB-101');
  });

  it('la lista para editar trae cada insumo con su producto; el agua no se compra', () => {
    const lista = insumosIniciales(saltena, CATALOGO);
    expect(lista.find((i) => i.clave === 'harina')).toMatchObject({ grupo: 'Para la masa', cantidad: 2, unidad: 'kg', productoId: 'AB-102', opciones: ['AB-102', 'AB-101'] });
    expect(lista.filter((i) => i.clave === 'agua').every((i) => i.productoId === null)).toBe(true);
  });

  it('guarda la receta sin inventario: crea los artículos en cero, en su unidad, y suma lo repetido', () => {
    const r = primeraReceta({ nombre: 'Salteña de carne', rinde: 50, insumos: insumosIniciales(saltena, CATALOGO) }, CATALOGO, vacio, AHORA, nuevoId);
    const hecho = r.cambios.articulos.find((a) => a.clase === 'HECHO')!;
    const comprados = r.cambios.articulos.filter((a) => a.clase === 'COMPRADO');

    expect(hecho.nombre).toBe('Salteña de carne');
    expect(r.receta).toMatchObject({ articuloId: hecho.id, rinde: 50 });
    expect(comprados.every((a) => a.origen === 'ABASTO' && a.productoId)).toBe(true);
    // Un artículo por producto: sal, huevo y aceite aparecen en dos grupos y se suman
    expect(new Set(comprados.map((a) => a.id)).size).toBe(comprados.length);
    const cantidad = (productoId: string) => r.receta.insumos.find((i) => i.articuloId === `abasto:${productoId}`)?.cantidad;
    expect(cantidad('AB-102')).toBe(2); // harina, en kg
    expect(cantidad('AB-123')).toBe(0.4); // 400 g de azúcar, en kg (la arroba se cuenta en kg)
    expect(cantidad('AB-115')).toBe(12); // 4 huevos en la masa y 8 duros
    expect(cantidad('AB-007')).toBe(0.06); // 30 g y 30 g de sal, en kg
    expect(cantidad('AB-107')).toBe(0.1); // 100 ml de aceite, en L
    // El agua no entra: no tiene artículo
    expect(r.receta.insumos).toHaveLength(comprados.length);
  });

  it('cuánto cuesta cada salteña con los precios de referencia, y qué falta pedir', () => {
    const { receta, cambios } = primeraReceta({ nombre: 'Salteña de carne', rinde: 50, insumos: insumosIniciales(saltena, CATALOGO) }, CATALOGO, vacio, AHORA, nuevoId);
    const libro = { articulos: cambios.articulos, movimientos: [] };
    const referencia = preciosDeReferencia(CATALOGO);

    const costo = costoDeReceta(receta, libro, referencia);
    expect(costo.sinCosto).toEqual([]);
    expect(costo.porUnidadCentavos).toBeGreaterThan(0);
    expect(costoDeReceta(receta, libro).sinCosto.length).toBe(receta.insumos.length);

    // Sin nada en el inventario falta todo; «Pedir lo que falta» elige la presentación de cada uno
    const plan = planificar(receta, 50, libro, referencia);
    expect(plan.alcanza).toBe(false);
    expect(plan.costoCentavos).toBe(costo.totalCentavos);
    const { items, noSeVenden } = itemsParaPedir(faltantesDelPlan(plan), CATALOGO);
    expect(noSeVenden).toEqual([]);
    expect(items.find((i) => i.productoId === 'AB-102')).toMatchObject({ presentacion: 'UNIDAD', cantidad: 1 }); // 1 arroba
    expect(items.find((i) => i.productoId === 'AB-115')).toMatchObject({ cantidad: 1 }); // 1 maple de 30
  });

  it('cuando llega el pedido, la compra entra en el mismo artículo de la receta y ya alcanza', () => {
    const { receta, cambios } = primeraReceta(
      { nombre: 'Pan batido', rinde: 300, insumos: insumosIniciales(plantillasDe('panaderia')[0], CATALOGO) },
      CATALOGO,
      vacio,
      AHORA,
      nuevoId,
    );
    const libro = { articulos: cambios.articulos, movimientos: [] as Movimiento[] };
    const plan = planificar(receta, 300, libro);
    const lineas = itemsParaPedir(faltantesDelPlan(plan), CATALOGO).items.map((i) => ({
      producto: { id: i.productoId, nombre: i.nombre, rubro: null },
      presentacion: i.presentacion,
      cantidad: i.cantidad,
      unidades: i.cantidad * i.unidadesPorPresentacion,
      subtotal: { centavos: 1000, texto: 'Bs 10,00' },
    }));
    const llego = comprasQueEntran([{ id: 'p1', codigo: 'A-1', estado: 'ENTREGADO', lineas } as never], libro, AHORA);

    expect(llego.articulos).toEqual([]); // no duplica: usa los artículos que creó la receta
    expect(planificar(receta, 300, { articulos: libro.articulos, movimientos: llego.movimientos }).alcanza).toBe(true);
  });

  it('si ya tiene el insumo, la receta usa ese artículo y no crea otro', () => {
    const primera = primeraReceta({ nombre: 'Cuñapé', rinde: 50, insumos: insumosIniciales(plantillasDe('horneados')[0], CATALOGO) }, CATALOGO, vacio, AHORA, nuevoId);
    const segunda = primeraReceta(
      { nombre: 'Sonso', rinde: 20, insumos: insumosIniciales(plantillasDe('horneados')[1], CATALOGO) },
      CATALOGO,
      { articulos: primera.cambios.articulos, movimientos: [] },
      AHORA,
      nuevoId,
    );
    expect(segunda.cambios.articulos.map((a) => a.productoId ?? a.clase)).toEqual(expect.arrayContaining(['AB-149', 'HECHO']));
    expect(segunda.cambios.articulos.some((a) => a.productoId === 'AB-144')).toBe(false); // el queso ya estaba
  });

  it('avisa si una cantidad no se puede llevar a la unidad del producto', () => {
    expect(() =>
      primeraReceta(
        { nombre: 'Prueba', rinde: 1, insumos: [{ clave: 'x', nombre: 'Huevo', grupo: '', cantidad: 2, unidad: 'kg', productoId: 'AB-115', opciones: [], origen: 'E' }] },
        CATALOGO,
        vacio,
        AHORA,
        nuevoId,
      ),
    ).toThrow(/Revisa la unidad de Huevo/);
  });
});
