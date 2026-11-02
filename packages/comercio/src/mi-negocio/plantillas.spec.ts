import { describe, expect, it } from 'vitest';
import { separarContenido } from '../catalogo';
import { SUBTIPOS_DE_PRODUCTOR } from '../negocios';
import { medidaDeContenido } from './medidas';
import { ESTANTE_DE_TIENDA, PLANTILLAS, insumosDePlantilla, plantillasDe, textoDeRinde } from './plantillas';
import { CATALOGO_DE_LA_SEMILLA } from './semilla-de-prueba.spec';

/** El catálogo real (la semilla de Catálogo): una plantilla nunca pide algo que Abasto no vende o que viene en otra medida */
const CATALOGO = new Map(CATALOGO_DE_LA_SEMILLA.map((p) => [p.id, { nombre: p.nombre, usos: p.usos ?? [] }]));

const FAMILIA: Record<string, string> = { kg: 'peso', g: 'peso', L: 'volumen', ml: 'volumen', 'u.': 'unidades' };

describe('Plantillas de la primera receta', () => {
  it('lee el catálogo de la semilla', () => {
    expect(CATALOGO.size).toBe(138);
  });

  it('cada área tiene sus plantillas: 3 para salteñería, 6 platos para la pensión', () => {
    for (const area of SUBTIPOS_DE_PRODUCTOR) expect(plantillasDe(area).length, area).toBeGreaterThan(0);
    expect(plantillasDe('salteneria').map((p) => p.nombre)).toEqual(['Salteña de carne', 'Salteña de pollo', 'Empanada de queso']);
    expect(plantillasDe('pension')).toHaveLength(6);
    expect(PLANTILLAS).toHaveLength(20);
    expect(new Set(PLANTILLAS.map((p) => p.clave)).size).toBe(20);
  });

  it('todo insumo que se compra existe en el catálogo, en una medida que sirve, y se muestra a su área', () => {
    for (const p of PLANTILLAS) {
      for (const i of insumosDePlantilla(p)) {
        const donde = `${p.nombre} › ${i.nombre}`;
        expect(i.cantidad, donde).toBeGreaterThan(0);
        if (i.clave === 'agua') {
          expect(i.codigos, 'el agua no se compra').toEqual([]);
          continue;
        }
        expect(i.codigos.length, donde).toBeGreaterThan(0);
        for (const codigo of i.codigos) {
          const producto = CATALOGO.get(codigo);
          expect(producto, `${donde}: ${codigo} no está en el catálogo`).toBeDefined();
          const medida = medidaDeContenido(separarContenido(producto!.nombre).contenido);
          expect(FAMILIA[medida.unidad], `${donde}: ${producto!.nombre} se cuenta en ${medida.unidad}`).toBe(FAMILIA[i.unidad]);
        }
        // «Para tu receta» del Inicio: al menos una presentación se le muestra al área
        expect(i.codigos.some((c) => CATALOGO.get(c)!.usos.includes(p.area)), `${donde} no se muestra a ${p.area}`).toBe(true);
      }
    }
  });

  it('cada cantidad dice de dónde sale: publicada (F), ajustada (A) o estimada (E)', () => {
    for (const i of PLANTILLAS.flatMap(insumosDePlantilla)) {
      expect(['F', 'A', 'E']).toContain(i.origen);
      if (i.origen === 'F') expect(i.fuentes.length).toBeGreaterThan(0);
    }
    const harina = insumosDePlantilla(PLANTILLAS[0]).find((i) => i.clave === 'harina')!;
    expect(harina).toMatchObject({ cantidad: 2, unidad: 'kg', origen: 'F', fuentes: ['F1'] });
    const pasas = insumosDePlantilla(PLANTILLAS[0]).find((i) => i.clave === 'pasas')!;
    expect(pasas).toMatchObject({ origen: 'A', fuentes: ['F2'] });
  });

  it('las agrupa como en la cocina y dice cuánto rinde', () => {
    expect(PLANTILLAS[0].grupos.map((g) => g.titulo)).toEqual(['Para la masa', 'Para el jigote', 'Para adentro']);
    expect(textoDeRinde(PLANTILLAS[0], 50)).toBe('Salen 50 salteñas');
    expect(textoDeRinde(PLANTILLAS[0], 1)).toBe('Salen 1 salteña');
  });

  it('el primer estante de la tienda: todo se vende a tiendas', () => {
    for (const codigo of ESTANTE_DE_TIENDA) expect(CATALOGO.get(codigo)?.usos, codigo).toContain('tienda');
  });
});
