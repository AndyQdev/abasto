import { validarConsulta } from '../src/reportes/dominio/guardia-sql.js';
import { PREGUNTAS, respuestaCorrecta } from './preguntas.js';

describe('Evaluador de preguntas', () => {
  it('son 20 preguntas y todas sus respuestas correctas pasan la guardia', () => {
    expect(PREGUNTAS).toHaveLength(20);
    for (const { pregunta, correcta } of PREGUNTAS) {
      expect(validarConsulta(correcta).ok, pregunta).toBe(true);
    }
  });

  it('acierta con las mismas filas aunque traiga columnas de más y en otro orden', () => {
    const correcta = [{ tienda_nombre: 'Tienda Doña Rosa' }, { tienda_nombre: 'Minimarket El Cruce' }];
    const respuesta = [
      { tienda_nombre: 'Minimarket El Cruce', saldo_centavos: 85000 },
      { tienda_nombre: 'tienda doña rosa', saldo_centavos: 120000 },
    ];
    expect(respuestaCorrecta(respuesta, correcta)).toBe(true);
  });

  it('tolera redondeos de promedios pero no montos distintos', () => {
    expect(respuestaCorrecta([{ ticket: 45120.4 }], [{ t: 45120 }])).toBe(true);
    expect(respuestaCorrecta([{ total: 4512 }], [{ total: 451200 }])).toBe(false);
  });

  it('falla si faltan o sobran filas', () => {
    expect(respuestaCorrecta([{ n: 'a' }], [{ n: 'a' }, { n: 'b' }])).toBe(false);
    expect(respuestaCorrecta([{ n: 'a' }, { n: 'a' }], [{ n: 'a' }])).toBe(false);
  });
});
