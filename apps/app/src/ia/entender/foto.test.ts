import { leerFoto } from './foto';

const r = (codigo: string, confianza: number) => ({ codigo, confianza });

describe('Qué dice la foto (umbrales medidos con fotos de prueba)', () => {
  it('un plato con parecido alto y ventaja clara es seguro', () => {
    expect(leerFoto([r('AB-005', 0.4)], [r('pique-macho', 0.9), r('silpancho', 0.84)])).toMatchObject({ tipo: 'plato', plato: 'pique-macho', seguro: true });
  });

  it('si el segundo está muy cerca, pregunta «¿Es esto?» con las opciones', () => {
    const l = leerFoto([], [r('majadito', 0.85), r('silpancho', 0.836), r('saltena', 0.6)]);
    expect(l).toMatchObject({ tipo: 'plato', seguro: false });
    expect(l.tipo === 'plato' && l.opciones.map((o) => o.codigo)).toEqual(['majadito', 'silpancho']);
  });

  it('con parecido bajo no afirma nada (el error de la salteña dio 0,44)', () => {
    expect(leerFoto([r('AB-005', 0.55)], [r('silpancho', 0.44)])).toEqual({ tipo: 'nada' });
  });

  it('un producto del catálogo gana si se parece más que cualquier plato', () => {
    expect(leerFoto([r('AB-014', 0.93)], [r('salchipapa', 0.5)])).toEqual({ tipo: 'producto', codigo: 'AB-014', confianza: 0.93 });
  });
});
