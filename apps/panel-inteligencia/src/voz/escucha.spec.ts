import { describe, expect, it } from 'vitest';
import { aDieciseisKHz, DetectorDeVoz, volumen } from './escucha';

const TROZO = 20; // ms

/** Pasa `ms` de audio con ese volumen por el detector. Devuelve en qué momento pidió terminar (o null). */
function sonar(d: DetectorDeVoz, rms: number, ms: number, desde = 0): number | null {
  for (let t = 0; t < ms; t += TROZO) {
    if (d.procesar(rms, TROZO).terminar) return desde + t + TROZO;
  }
  return null;
}

describe('Detector de voz', () => {
  it('termina poco después de que la persona se calla', () => {
    const d = new DetectorDeVoz();
    expect(sonar(d, 0.002, 400)).toBeNull();
    expect(sonar(d, 0.12, 1500, 400)).toBeNull();
    expect(d.hablo).toBe(true);
    expect(d.finDeLaVoz).toBe(1900);
    // 1,1 s de silencio después de la última palabra
    expect(sonar(d, 0.002, 2000, 1900)).toBe(3000);
  });

  it('una pausa corta en medio de la frase no corta la pregunta', () => {
    const d = new DetectorDeVoz();
    sonar(d, 0.1, 800);
    expect(sonar(d, 0.002, 600)).toBeNull();
    expect(sonar(d, 0.1, 800)).toBeNull();
  });

  it('un ruido suelto (una tos) no cuenta como hablar; sin voz, deja de escuchar a los 8 s', () => {
    const d = new DetectorDeVoz();
    sonar(d, 0.2, 120);
    expect(d.hablo).toBe(false);
    expect(sonar(d, 0.002, 9000, 120)).toBe(8000);
  });

  it('en un lugar con ruido, el fondo no se toma por voz pero la voz sí', () => {
    const d = new DetectorDeVoz();
    expect(sonar(d, 0.02, 2000)).toBeNull();
    expect(d.hablo).toBe(false);
    sonar(d, 0.15, 1000, 2000);
    expect(d.hablo).toBe(true);
    expect(sonar(d, 0.02, 2000, 3000)).toBe(4100);
  });

  it('corta a los 30 s aunque siga hablando', () => {
    const d = new DetectorDeVoz();
    expect(sonar(d, 0.1, 40_000)).toBe(30_000);
  });
});

describe('Audio para Whisper', () => {
  it('pasa de 48 kHz a 16 kHz promediando cada tres muestras', () => {
    const entrada = Float32Array.from({ length: 48 }, (_, i) => i);
    const salida = aDieciseisKHz(entrada, 48_000);
    expect(salida).toHaveLength(16);
    expect(salida[0]).toBe(1);
    expect(salida[15]).toBe(46);
  });

  it('de 44,1 kHz sale el largo justo y 16 kHz queda igual', () => {
    expect(aDieciseisKHz(new Float32Array(44_100), 44_100)).toHaveLength(16_000);
    const igual = new Float32Array(10);
    expect(aDieciseisKHz(igual, 16_000)).toBe(igual);
  });

  it('el volumen es la raíz del promedio de los cuadrados', () => {
    expect(volumen(Float32Array.from([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5);
    expect(volumen(new Float32Array(0))).toBe(0);
  });
});
