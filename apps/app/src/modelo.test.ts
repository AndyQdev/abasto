import type { Tensor } from 'react-native-fast-tflite';
import { bytesDe, describirTensor, elementosDe, entradaNeutra } from './modelo';

const imagen: Tensor = { name: 'imagen', dataType: 'uint8', shape: [1, 224, 224, 3] };
const salida: Tensor = { name: 'probabilidades', dataType: 'float32', shape: [1, 1001] };

describe('Tensores del modelo', () => {
  it('calcula cuántos elementos tiene cada tensor', () => {
    expect(elementosDe(imagen)).toBe(150528);
    expect(elementosDe(salida)).toBe(1001);
  });

  it('reserva bytes según el tipo de dato', () => {
    expect(bytesDe(imagen)).toBe(150528);
    expect(bytesDe(salida)).toBe(4004);
  });

  it('arma una entrada en cero del tamaño correcto', () => {
    const entrada = entradaNeutra(imagen);
    expect(entrada.byteLength).toBe(150528);
    expect(new Uint8Array(entrada).every((v) => v === 0)).toBe(true);
  });

  it('describe el tensor para la pantalla de diagnóstico', () => {
    expect(describirTensor(imagen)).toBe('imagen · 1×224×224×3 · uint8');
  });
});
