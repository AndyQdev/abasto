import { distanciaMetros, etiquetaSugerida, sugerida, textoDeGeocodigo, type Direccion } from './direcciones';

const casa: Direccion = { id: 'a', etiqueta: 'Casa', calle: 'Av. Banzer 123', zona: 'Santa Cruz', referencia: '', latitud: -17.7833, longitud: -63.1821 };
const tienda: Direccion = { id: 'b', etiqueta: 'Tienda', calle: 'Calle Sucre 45', zona: 'Centro', referencia: '', latitud: -17.7900, longitud: -63.1800 };

describe('Direcciones de entrega', () => {
  it('arma la dirección con lo que devuelve el GPS', () => {
    expect(textoDeGeocodigo({ street: 'Av. Banzer', streetNumber: '123', district: 'Equipetrol', city: 'Santa Cruz de la Sierra' })).toEqual({
      calle: 'Av. Banzer 123',
      zona: 'Equipetrol, Santa Cruz de la Sierra',
    });
  });

  it('sin calle usa el nombre del lugar, y nunca queda vacía', () => {
    expect(textoDeGeocodigo({ name: 'Mercado Los Pozos', city: 'Santa Cruz' }).calle).toBe('Mercado Los Pozos');
    expect(textoDeGeocodigo({}).calle).toBe('Mi ubicación');
  });

  it('mide la distancia en metros', () => {
    const m = distanciaMetros({ latitud: -17.7833, longitud: -63.1821 }, { latitud: -17.79, longitud: -63.18 });
    expect(m).toBeGreaterThan(700);
    expect(m).toBeLessThan(800);
  });

  it('al abrir sugiere la guardada que está cerca de donde estás', () => {
    expect(sugerida([casa, tienda], 'a', { latitud: -17.7899, longitud: -63.1801 })?.id).toBe('b');
  });

  it('si ninguna está cerca, sugiere la última que elegiste', () => {
    expect(sugerida([casa, tienda], 'b', { latitud: -16.5, longitud: -68.15 })?.id).toBe('b');
    expect(sugerida([casa, tienda], null, null)?.id).toBe('a');
    expect(sugerida([], null, null)).toBeNull();
  });

  it('la primera es Casa y después sugiere la que falta', () => {
    expect(etiquetaSugerida([])).toBe('Casa');
    expect(etiquetaSugerida([casa])).toBe('Tienda');
    expect(etiquetaSugerida([casa, tienda, { ...casa, id: 'c', etiqueta: 'Trabajo' }])).toBe('Otra');
  });
});
