import { describe, expect, it, vi } from 'vitest';
import { limpiarTranscripcion } from './transcriptor';
import { usarVoz, type DependenciasDeVoz } from './usar-voz';

const vozFalsa = (texto: string | Error, permiso = true): DependenciasDeVoz => ({
  grabar: vi.fn(async () => {
    if (!permiso) throw new Error('No tengo permiso para usar el micrófono.');
    return { detener: async () => new Blob(['audio']) };
  }),
  convertir: vi.fn(async () => new Float32Array(16_000)),
  transcriptor: {
    transcribir: vi.fn(async () => {
      if (texto instanceof Error) throw texto;
      return texto;
    }),
  },
});

describe('Voz', () => {
  it('primer clic graba, segundo clic transcribe y entrega el texto', async () => {
    const recibido = vi.fn();
    const voz = usarVoz(recibido, vozFalsa('qué tiendas me tienen que pagar mañana'));

    await voz.alternar();
    expect(voz.estado.value).toBe('grabando');
    expect(voz.textoDelBoton.value).toBe('Detener y preguntar');

    await voz.alternar();
    expect(recibido).toHaveBeenCalledWith('qué tiendas me tienen que pagar mañana');
    expect(voz.estado.value).toBe('lista');
  });

  it('sin permiso del micrófono explica cómo activarlo y no graba', async () => {
    const voz = usarVoz(vi.fn(), vozFalsa('x', false));

    await voz.alternar();
    expect(voz.estado.value).toBe('lista');
    expect(voz.error.value).toContain('permiso');
  });

  it('si no entendió nada, lo dice y no pregunta', async () => {
    const recibido = vi.fn();
    const voz = usarVoz(recibido, vozFalsa(''));

    await voz.alternar();
    await voz.alternar();
    expect(recibido).not.toHaveBeenCalled();
    expect(voz.error.value).toContain('No te entendí');
  });

  it('si el modelo no se pudo cargar, avisa que la primera vez necesita internet', async () => {
    const voz = usarVoz(vi.fn(), vozFalsa(new Error('Failed to fetch')));

    await voz.alternar();
    await voz.alternar();
    expect(voz.error.value).toContain('internet');
    expect(voz.estado.value).toBe('lista');
  });

  it.each([
    ['  ¿Qué tiendas me deben?  ', '¿Qué tiendas me deben?'],
    ['[Música] cuánto vendí este mes...', 'cuánto vendí este mes'],
    ['(ruido)', ''],
  ])('limpia la transcripción: %s', (crudo, limpio) => {
    expect(limpiarTranscripcion(crudo)).toBe(limpio);
  });
});
