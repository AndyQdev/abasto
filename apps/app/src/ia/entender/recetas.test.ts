import { PLANTILLAS } from '@abasto/comercio';
import { buscarReceta, desdePlantilla, escalarReceta, RECETAS } from './recetas';

describe('Recetas de referencia', () => {
  it('encuentra la receta por cómo se la nombra, con o sin tilde', () => {
    expect(buscarReceta('quiero hacer 300 salteñas')?.id).toBe('saltena-carne');
    expect(buscarReceta('para mis saltenas del sábado')?.id).toBe('saltena-carne');
    expect(buscarReceta('100 empanadas de queso')?.id).toBe('empanada-queso');
    expect(buscarReceta('una torta para 20 personas')?.id).toBe('torta-vainilla');
    expect(buscarReceta('algo rico')).toBeNull();
  });

  it('escala con aritmética: 300 salteñas es seis veces la plantilla de 50', () => {
    const saltena = RECETAS.find((r) => r.id === 'saltena-carne')!;
    const { items, supuestos } = escalarReceta(saltena, 300);
    expect(items.find((i) => i.nombre === 'harina de trigo')).toMatchObject({ nombre: 'harina de trigo', cantidad: 12, unidad: 'kg', envase: null });
    expect(supuestos[0]).toContain('receta de referencia');
  });

  it('lo que se cuenta por unidad se redondea hacia arriba (no hay medio huevo)', () => {
    const torta = RECETAS.find((r) => r.id === 'torta-vainilla')!;
    expect(escalarReceta(torta, 25).items.find((i) => i.nombre === 'huevo')?.cantidad).toBe(10);
  });

  it('sin rinde calcula para la referencia y lo avisa', () => {
    const pan = RECETAS.find((r) => r.id === 'pan-batalla')!;
    const { items, supuestos } = escalarReceta(pan, null);
    expect(items[0].cantidad).toBe(5);
    expect(supuestos[1]).toBe('No dijiste cuántas: calculamos para 100 panes');
  });

  it('todas las recetas tienen ingredientes con cantidad positiva y unidad', () => {
    for (const r of RECETAS) {
      expect(r.ingredientes.length).toBeGreaterThan(0);
      for (const i of r.ingredientes) expect(i.cantidad).toBeGreaterThan(0);
    }
  });
});

describe('Una sola lista de recetas: las plantillas de Mi negocio y las nuestras', () => {
  it('cada plantilla entra con los códigos del catálogo y sin lo que no se compra (el agua)', () => {
    const saltena = desdePlantilla(PLANTILLAS.find((p) => p.clave === 'saltena-carne')!);
    expect(saltena.plato).toBe('saltena');
    expect(saltena.alias).toEqual(expect.arrayContaining(['salteña de carne', 'salteñas de carne', 'salteñas']));
    expect(saltena.ingredientes.find((i) => i.nombre === 'agua')).toBeUndefined();
    expect(saltena.ingredientes.find((i) => i.nombre === 'huevo')?.cantidad).toBe(12);
    for (const p of PLANTILLAS) for (const i of desdePlantilla(p).ingredientes) expect(i.codigos?.length).toBeGreaterThan(0);
  });

  it('cada insumo de cada receta dice qué producto del catálogo lo vende', () => {
    for (const r of RECETAS) {
      for (const i of r.ingredientes) {
        expect({ receta: r.id, insumo: i.nombre, codigos: i.codigos?.filter((c) => /^AB-\d{3}$/.test(c)).length ?? 0 }).toMatchObject({ codigos: i.codigos?.length || -1 });
      }
    }
    expect(buscarReceta('quiero 50 tucumanas')?.id).toBe('tucumana');
    expect(buscarReceta('picante de pollo para 10')?.id).toBe('picante-pollo');
  });

  it('no hay dos recetas con el mismo id', () => {
    expect(new Set(RECETAS.map((r) => r.id)).size).toBe(RECETAS.length);
  });
});
