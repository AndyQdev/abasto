import { buscarReceta, escalarReceta, RECETAS } from './recetas';

describe('Recetas de referencia', () => {
  it('encuentra la receta por cómo se la nombra, con o sin tilde', () => {
    expect(buscarReceta('quiero hacer 300 salteñas')?.id).toBe('saltena');
    expect(buscarReceta('para mis saltenas del sábado')?.id).toBe('saltena');
    expect(buscarReceta('100 empanadas de queso')?.id).toBe('empanada-queso');
    expect(buscarReceta('una torta para 20 personas')?.id).toBe('torta-vainilla');
    expect(buscarReceta('algo rico')).toBeNull();
  });

  it('escala con aritmética: 300 salteñas es el triple de la referencia de 100', () => {
    const saltena = RECETAS.find((r) => r.id === 'saltena')!;
    const { items, supuestos } = escalarReceta(saltena, 300);
    expect(items.find((i) => i.nombre === 'harina de trigo')).toEqual({ nombre: 'harina de trigo', cantidad: 12, unidad: 'kg', envase: null });
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
