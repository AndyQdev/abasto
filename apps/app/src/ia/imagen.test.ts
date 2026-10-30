import { LADO, aEntradaDelModelo, recorteCentrado } from './imagen';

describe('Imagen para el modelo', () => {
  it('recorta el cuadrado del medio de una foto vertical u horizontal', () => {
    expect(recorteCentrado(3000, 4000)).toEqual({ originX: 0, originY: 500, width: 3000, height: 3000 });
    expect(recorteCentrado(4000, 3000)).toEqual({ originX: 500, originY: 0, width: 3000, height: 3000 });
    expect(recorteCentrado(224, 224)).toEqual({ originX: 0, originY: 0, width: 224, height: 224 });
  });

  it('deja RGB de 0 a 255 y descarta el canal alfa', () => {
    const rgba = new Uint8Array(LADO * LADO * 4);
    rgba.set([255, 128, 0, 77], 0);
    rgba.set([1, 2, 3, 255], rgba.length - 4);
    const rgb = aEntradaDelModelo(rgba, LADO, LADO);
    expect(rgb).toHaveLength(LADO * LADO * 3);
    expect(Array.from(rgb.slice(0, 3))).toEqual([255, 128, 0]);
    expect(Array.from(rgb.slice(-3))).toEqual([1, 2, 3]);
  });

  it('avisa si la imagen no llegó reducida al tamaño del modelo', () => {
    expect(() => aEntradaDelModelo(new Uint8Array(4), 1, 1)).toThrow('tiene que ser de 224×224 y es de 1×1');
    expect(() => aEntradaDelModelo(new Uint8Array(10), LADO, LADO)).toThrow('llegaron 10');
  });
});
