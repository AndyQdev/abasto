import { leerCantidad, numeroEnTexto } from './numeros';
import { entenderConReglas, leerItem, partirEnItems } from './reglas';

describe('Números como se dicen', () => {
  it('dígitos, coma decimal y palabras', () => {
    expect(numeroEnTexto('3')).toBe(3);
    expect(numeroEnTexto('2,5')).toBe(2.5);
    expect(numeroEnTexto('tres')).toBe(3);
    expect(numeroEnTexto('dieciséis')).toBe(16);
    expect(numeroEnTexto('docena')).toBeNull();
  });

  it('compuestos, «y medio» y fracciones', () => {
    expect(leerCantidad('veinticinco kilos')).toEqual({ cantidad: 25, resto: 'kilos' });
    expect(leerCantidad('treinta y dos huevos')).toEqual({ cantidad: 32, resto: 'huevos' });
    expect(leerCantidad('dos y medio kilos')).toEqual({ cantidad: 2.5, resto: 'kilos' });
    expect(leerCantidad('ciento cincuenta panes')).toEqual({ cantidad: 150, resto: 'panes' });
    expect(leerCantidad('1/2 kilo')).toEqual({ cantidad: 0.5, resto: 'kilo' });
    expect(leerCantidad('3/4 de litro')).toEqual({ cantidad: 0.75, resto: 'de litro' });
    expect(leerCantidad('aceite')).toBeNull();
  });
});

describe('Entender un pedido sin modelo', () => {
  it('el pedido típico de una tienda', () => {
    const r = entenderConReglas('Necesito tres cajas de aceite, dos fardos de arroz y cinco docenas de huevo');
    expect(r.tipo).toBe('pedido');
    expect(r.items).toEqual([
      { nombre: 'aceite', cantidad: 3, unidad: null, envase: 'caja' },
      { nombre: 'arroz', cantidad: 2, unidad: null, envase: 'fardo' },
      { nombre: 'huevo', cantidad: 5, unidad: null, envase: 'docena' },
    ]);
    expect(r.supuestos).toEqual([]);
  });

  it('kilo y medio, medio kilo y un cuarto', () => {
    expect(leerItem('kilo y medio de harina')).toEqual({ nombre: 'harina', cantidad: 1.5, unidad: 'kg', envase: null });
    expect(leerItem('medio kilo de queso')).toEqual({ nombre: 'queso', cantidad: 0.5, unidad: 'kg', envase: null });
    expect(leerItem('2 quintales de harina')).toEqual({ nombre: 'harina', cantidad: 2, unidad: null, envase: 'quintal' });
  });

  it('una lista con viñetas y renglones', () => {
    expect(partirEnItems('- 2 kg de azúcar\n* 3 maples de huevo\n1. sal y pimienta')).toEqual(['2 kg de azúcar', '3 maples de huevo', 'sal', 'pimienta']);
  });

  it('no parte «dos y medio» y conserva el contenido del producto en el nombre', () => {
    expect(partirEnItems('dos y medio kilos de arroz')).toEqual(['dos y medio kilos de arroz']);
    expect(leerItem('2 aceite fino de 900 ml')).toEqual({ nombre: 'aceite fino de 900 ml', cantidad: 2, unidad: null, envase: null });
  });

  it('una búsqueda sin cantidades no supone nada', () => {
    expect(entenderConReglas('algo para lavar ropa')).toMatchObject({ tipo: 'busqueda', supuestos: [] });
  });

  it('«quiero hacer 100 empanadas» es una receta con su rinde', () => {
    expect(entenderConReglas('quiero hacer 100 empanadas')).toMatchObject({ tipo: 'receta', rinde: 100, preparacion: 'empanadas', items: [] });
    expect(entenderConReglas('voy a hacer una torta para 20 personas')).toMatchObject({ tipo: 'receta', rinde: 20, preparacion: null });
  });

  it('una receta pegada trae sus ingredientes', () => {
    const r = entenderConReglas('Receta de empanadas (rinde 50)\n1 kg de harina\n200 g de manteca\n3 huevos');
    expect(r.tipo).toBe('receta');
    expect(r.rinde).toBe(50);
    expect(r.items.map((i) => [i.nombre, i.cantidad, i.unidad])).toEqual([
      ['harina', 1, 'kg'],
      ['manteca', 200, 'g'],
      ['huevos', 3, 'u.'],
    ]);
  });

  it('en un pedido, lo que no dice cuánto va 1 y se avisa', () => {
    const r = entenderConReglas('3 fardos de arroz, sal');
    expect(r.items[1]).toEqual({ nombre: 'sal', cantidad: 1, unidad: null, envase: null });
    expect(r.supuestos).toEqual(['No dijiste cuánto sal: se toma 1']);
  });
});
