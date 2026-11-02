import { ESQUEMA_DE_INTENCION, instrucciones, leerRespuesta } from './con-modelo';

describe('Lo que devuelve el modelo de lenguaje se revisa antes de usarlo', () => {
  it('acepta un pedido bien formado', () => {
    const r = leerRespuesta(
      JSON.stringify({
        tipo: 'pedido',
        items: [{ nombre: 'Aceite', cantidad: 3, unidad: null, envase: 'caja' }],
        preparacion: null,
        rinde: null,
        supuestos: [],
      }),
    );
    expect(r).toEqual({ tipo: 'pedido', items: [{ nombre: 'aceite', cantidad: 3, unidad: null, envase: 'caja' }], preparacion: null, rinde: null, supuestos: [] });
  });

  it('acepta el JSON envuelto en un bloque de código', () => {
    expect(leerRespuesta('```json\n{"tipo":"receta","items":[],"preparacion":"torta de chocolate","rinde":20,"supuestos":["relleno de chocolate blanco"]}\n```')).toMatchObject({
      tipo: 'receta',
      preparacion: 'torta de chocolate',
      rinde: 20,
    });
  });

  it('descarta lo inventado o roto: cantidades negativas, unidades y envases que no existen, items sin nombre', () => {
    const r = leerRespuesta(
      JSON.stringify({
        tipo: 'pedido',
        items: [
          { nombre: 'arroz', cantidad: -2, unidad: 'toneladas', envase: 'contenedor' },
          { nombre: '', cantidad: 1, unidad: 'kg', envase: null },
        ],
        preparacion: null,
        rinde: null,
        supuestos: [],
      }),
    );
    expect(r?.items).toEqual([{ nombre: 'arroz', cantidad: null, unidad: null, envase: null }]);
  });

  it('si no es JSON, no tiene tipo válido o no trae nada útil, devuelve null (se usan las reglas)', () => {
    expect(leerRespuesta('Claro, aquí tienes tu pedido')).toBeNull();
    expect(leerRespuesta('{"tipo":"charla","items":[]}')).toBeNull();
    expect(leerRespuesta('{"tipo":"pedido","items":[],"preparacion":null}')).toBeNull();
  });

  it('las instrucciones dicen que nunca invente y llevan el negocio y el catálogo', () => {
    const i = instrucciones({ negocio: 'productor (salteñería)', nombresDelCatalogo: ['Harina de trigo · quintal 46 kg'] });
    expect(i).toContain('Nunca inventes precios');
    expect(i).toContain('salteñería');
    expect(i).toContain('Harina de trigo');
    expect(ESQUEMA_DE_INTENCION.required).toContain('supuestos');
  });
});
