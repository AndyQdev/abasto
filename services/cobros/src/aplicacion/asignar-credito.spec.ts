import { describe, expect, it } from 'vitest';
import { Dinero } from '../dominio/dinero.js';
import { LineaDeCredito } from '../dominio/linea-de-credito.js';
import { AsignarCredito } from './asignar-credito.js';
import { ConsultarCredito } from './consultar-credito.js';
import { LineaDeCreditoEnMemoria } from './linea-de-credito.en-memoria.js';

const MAYORISTA = { orgId: 'lp', roles: ['mayorista'] };

function armar(iniciales: LineaDeCredito[] = []) {
  const lineas = new LineaDeCreditoEnMemoria(iniciales);
  return { lineas, asignar: new AsignarCredito(lineas, () => 'linea-1'), consultar: new ConsultarCredito(lineas) };
}

describe('CU-04 · Dar crédito a una tienda', () => {
  it('abre la línea de la tienda con el mayorista del token', async () => {
    const { asignar, lineas } = armar();
    await asignar.ejecutar({ tiendaId: 'dr', limiteCentavos: 500_000, plazoDias: 30 }, MAYORISTA);
    const linea = await lineas.buscar('dr', 'lp');
    expect(linea?.limite.centavos).toBe(500_000);
    expect(linea?.disponible.centavos).toBe(500_000);
    expect(linea?.plazoDias).toBe(30);
  });

  it('con una línea que ya existe cambia el límite y el plazo, y conserva lo usado', async () => {
    const existente = LineaDeCredito.abrir('l', 'dr', 'lp', Dinero.deCentavos(500_000), 15);
    existente.autorizar('p1', Dinero.deCentavos(100_000));
    const { asignar, lineas } = armar([existente]);
    await asignar.ejecutar({ tiendaId: 'dr', limiteCentavos: 800_000, plazoDias: 30 }, MAYORISTA);
    const linea = await lineas.buscar('dr', 'lp');
    expect(linea?.id).toBe('l');
    expect(linea?.usado.centavos).toBe(100_000);
    expect(linea?.disponible.centavos).toBe(700_000);
    expect(linea?.plazoDias).toBe(30);
  });

  it('no deja bajar el límite por debajo de lo que la tienda ya usó', async () => {
    const existente = LineaDeCredito.abrir('l', 'dr', 'lp', Dinero.deCentavos(500_000), 15);
    existente.autorizar('p1', Dinero.deCentavos(300_000));
    const { asignar } = armar([existente]);
    await expect(asignar.ejecutar({ tiendaId: 'dr', limiteCentavos: 200_000, plazoDias: 15 }, MAYORISTA)).rejects.toMatchObject({
      codigo: 'LIMITE_MENOR_QUE_LO_USADO',
    });
  });

  it('con límite cero la tienda ya no puede comprar a crédito', async () => {
    const existente = LineaDeCredito.abrir('l', 'dr', 'lp', Dinero.deCentavos(500_000), 15);
    const { asignar, lineas } = armar([existente]);
    await asignar.ejecutar({ tiendaId: 'dr', limiteCentavos: 0, plazoDias: 15 }, MAYORISTA);
    const linea = await lineas.buscar('dr', 'lp');
    expect(() => linea?.autorizar('p1', Dinero.deCentavos(100))).toThrow();
  });

  it('el plazo solo puede ser 15 o 30 días', async () => {
    const { asignar } = armar();
    await expect(asignar.ejecutar({ tiendaId: 'dr', limiteCentavos: 100, plazoDias: 45 }, MAYORISTA)).rejects.toMatchObject({ codigo: 'PLAZO_INVALIDO' });
  });

  it('una tienda no puede dar crédito ni un mayorista dárselo a sí mismo', async () => {
    const { asignar } = armar();
    await expect(asignar.ejecutar({ tiendaId: 'x', limiteCentavos: 100, plazoDias: 15 }, { orgId: 'dr', roles: ['tienda'] })).rejects.toMatchObject({
      codigo: 'SIN_PERMISO',
    });
    await expect(asignar.ejecutar({ tiendaId: 'lp', limiteCentavos: 100, plazoDias: 15 }, MAYORISTA)).rejects.toMatchObject({ codigo: 'SIN_PERMISO' });
  });

  it('solo la tienda o el mayorista de la línea pueden leerla', async () => {
    const { consultar } = armar([LineaDeCredito.abrir('l', 'dr', 'lp', Dinero.deCentavos(100), 15)]);
    expect((await consultar.deLaSesion('dr', 'lp', 'dr'))?.id).toBe('l');
    expect((await consultar.deLaSesion('dr', 'lp', 'lp'))?.id).toBe('l');
    await expect(consultar.deLaSesion('dr', 'lp', 'otra')).rejects.toMatchObject({ codigo: 'SIN_PERMISO' });
  });
});
