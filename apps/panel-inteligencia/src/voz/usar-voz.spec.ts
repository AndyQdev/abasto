import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventosDeEscucha, IniciarEscucha } from './escucha';
import { limpiarTranscripcion } from './transcriptor';
import { usarVoz, type DependenciasDeVoz } from './usar-voz';

/** Un micrófono de mentira: la prueba decide cuánto se habló y cuándo se calla. */
function microfono({ permiso = true, hablo = true } = {}) {
  let eventos: EventosDeEscucha | null = null;
  // segundos: hasta dónde llega lo dicho (con su cola); silencio: lo que lleva callado después
  const estado = { segundos: 2, silencio: 0, hablo, suelto: false };
  const escuchar: IniciarEscucha = vi.fn(async (e: EventosDeEscucha) => {
    if (!permiso) throw new Error('No tengo permiso para usar el micrófono.');
    eventos = e;
    return {
      audio: () => new Float32Array(estado.segundos * 16_000),
      get hablo() {
        return estado.hablo;
      },
      get finDeLaVoz() {
        return estado.hablo ? estado.segundos - 0.35 : 0;
      },
      get duracion() {
        return estado.segundos + estado.silencio;
      },
      detener: () => {
        estado.suelto = true;
        return new Float32Array(estado.segundos * 16_000);
      },
    };
  });
  return { escuchar, estado, callar: () => eventos?.callo(), nivel: (n: number) => eventos?.nivel(n) };
}

/** Whisper de mentira: devuelve las frases en orden, una por llamada (la última se repite). */
function whisper(...frases: (string | Error)[]) {
  let i = 0;
  return {
    transcribir: vi.fn(async () => {
      const f = frases[Math.min(i++, frases.length - 1)];
      if (f instanceof Error) throw f;
      return f;
    }),
  };
}

const voz = (m: ReturnType<typeof microfono>, w: ReturnType<typeof whisper>): DependenciasDeVoz => ({
  escuchar: m.escuchar,
  transcriptor: w,
  cadaMs: 1000,
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Voz en vivo', () => {
  it('mientras hablas muestra lo que va entendiendo y, al callarte, entrega la pregunta sin volver a transcribir', async () => {
    const m = microfono();
    const w = whisper('cuánto', 'cuánto me deben');
    const recibido = vi.fn();
    const v = usarVoz(recibido, voz(m, w));

    await v.alternar();
    expect(v.estado.value).toBe('escuchando');
    m.nivel(0.6);
    expect(v.nivel.value).toBe(0.6);

    await vi.advanceTimersByTimeAsync(1000);
    expect(v.parcial.value).toBe('cuánto');

    m.estado.segundos = 3;
    await vi.advanceTimersByTimeAsync(1000);
    expect(v.parcial.value).toBe('cuánto me deben');

    // Se calló: lo transcrito ya cubre hasta la última palabra, así que sale al toque
    m.callar();
    await vi.advanceTimersByTimeAsync(0);
    expect(recibido).toHaveBeenCalledWith('cuánto me deben');
    expect(w.transcribir).toHaveBeenCalledTimes(2);
    expect(m.estado.suelto).toBe(true);
    expect(v.estado.value).toBe('lista');
    expect(v.parcial.value).toBe('');
  });

  it('si ya entendió todo y la persona hace una pausa, la pregunta sale sin esperar el silencio completo', async () => {
    const m = microfono();
    const w = whisper('lo más vendido del mes');
    const recibido = vi.fn();
    const v = usarVoz(recibido, voz(m, w));

    await v.alternar();
    await vi.advanceTimersByTimeAsync(1000);
    expect(v.parcial.value).toBe('lo más vendido del mes');

    // Una pausa corta (como al respirar) todavía no envía
    m.estado.silencio = 0.4;
    await vi.advanceTimersByTimeAsync(1000);
    expect(recibido).not.toHaveBeenCalled();

    m.estado.silencio = 0.9;
    await vi.advanceTimersByTimeAsync(1000);
    expect(recibido).toHaveBeenCalledWith('lo más vendido del mes');
    expect(w.transcribir).toHaveBeenCalledTimes(1);
  });

  it('en un equipo lento no transcribe mientras la persona sigue hablando: espera la primera pausa', async () => {
    const m = microfono();
    const transcribir = vi.fn(() => new Promise<string>((r) => setTimeout(() => r('cuánto vendí este mes'), 3000)));
    const recibido = vi.fn();
    const v = usarVoz(recibido, { escuchar: m.escuchar, transcriptor: { transcribir }, cadaMs: 300 });

    await v.alternar();
    // Primera frase con pausa: se transcribe y se mide que este equipo tarda 3 s
    await vi.advanceTimersByTimeAsync(3500);
    expect(transcribir).toHaveBeenCalledTimes(1);

    // Sigue hablando sin pausa: no se lanza otra transcripción
    m.estado.segundos = 4;
    m.estado.silencio = -0.35;
    await vi.advanceTimersByTimeAsync(2000);
    expect(transcribir).toHaveBeenCalledTimes(1);

    // Hace una pausa: ahora sí, y al seguir callado la pregunta sale con ese texto
    m.estado.silencio = 0;
    await vi.advanceTimersByTimeAsync(3500);
    expect(transcribir).toHaveBeenCalledTimes(2);
    m.estado.silencio = 0.6;
    await vi.advanceTimersByTimeAsync(300);
    expect(recibido).toHaveBeenCalledWith('cuánto vendí este mes');
  });

  it('si lo último que dijo todavía no se transcribió, lo transcribe entero al terminar', async () => {
    const m = microfono();
    const w = whisper('qué tiendas', 'qué tiendas me tienen que pagar mañana');
    const recibido = vi.fn();
    const v = usarVoz(recibido, voz(m, w));

    await v.alternar();
    await vi.advanceTimersByTimeAsync(1000);
    expect(v.parcial.value).toBe('qué tiendas');

    m.estado.segundos = 4;
    m.callar();
    await vi.advanceTimersByTimeAsync(0);
    expect(recibido).toHaveBeenCalledWith('qué tiendas me tienen que pagar mañana');
    expect(w.transcribir).toHaveBeenCalledTimes(2);
  });

  it('«Listo» (segundo toque) no espera el silencio', async () => {
    const m = microfono();
    const recibido = vi.fn();
    const v = usarVoz(recibido, voz(m, whisper('lo más vendido')));

    await v.alternar();
    await v.alternar();
    expect(recibido).toHaveBeenCalledWith('lo más vendido');
  });

  it('no transcribe mientras la persona no dijo nada (Whisper inventa frases con el silencio)', async () => {
    const m = microfono({ hablo: false });
    const w = whisper('Gracias por ver el video');
    const recibido = vi.fn();
    const v = usarVoz(recibido, voz(m, w));

    await v.alternar();
    await vi.advanceTimersByTimeAsync(3000);
    expect(w.transcribir).not.toHaveBeenCalled();

    m.callar();
    await vi.advanceTimersByTimeAsync(0);
    expect(recibido).not.toHaveBeenCalled();
    expect(v.error.value).toContain('No te escuché');
  });

  it('cancelar suelta el micrófono y no pregunta nada', async () => {
    const m = microfono();
    const recibido = vi.fn();
    const v = usarVoz(recibido, voz(m, whisper('cuánto me deben')));

    await v.alternar();
    v.cancelar();
    m.callar();
    await vi.advanceTimersByTimeAsync(2000);
    expect(m.estado.suelto).toBe(true);
    expect(recibido).not.toHaveBeenCalled();
    expect(v.estado.value).toBe('lista');
  });

  it('sin permiso del micrófono explica cómo activarlo y no escucha', async () => {
    const v = usarVoz(vi.fn(), voz(microfono({ permiso: false }), whisper('x')));

    await v.alternar();
    expect(v.estado.value).toBe('lista');
    expect(v.error.value).toContain('permiso');
  });

  it('si no entendió nada, lo dice y no pregunta', async () => {
    const recibido = vi.fn();
    const v = usarVoz(recibido, voz(microfono(), whisper('')));

    await v.alternar();
    await v.alternar();
    expect(recibido).not.toHaveBeenCalled();
    expect(v.error.value).toContain('No te entendí');
  });

  it('si el modelo no se pudo cargar, avisa que la primera vez necesita internet', async () => {
    const v = usarVoz(vi.fn(), voz(microfono(), whisper(new Error('Failed to fetch'))));

    await v.alternar();
    await v.alternar();
    expect(v.error.value).toContain('internet');
    expect(v.estado.value).toBe('lista');
  });

  it('mientras el modelo se baja (la primera vez), escucha igual y transcribe cuando está', async () => {
    const m = microfono();
    let listo: () => void = () => undefined;
    const w = { ...whisper('cuánto vendí'), preparar: () => new Promise<void>((r) => (listo = r)) };
    const v = usarVoz(vi.fn(), { escuchar: m.escuchar, transcriptor: w, cadaMs: 1000 });

    await v.alternar();
    await vi.advanceTimersByTimeAsync(2000);
    expect(w.transcribir).not.toHaveBeenCalled();

    listo();
    await vi.advanceTimersByTimeAsync(1000);
    expect(v.parcial.value).toBe('cuánto vendí');
  });
});

describe('Limpieza de lo que entiende Whisper', () => {
  it.each([
    ['  ¿Qué tiendas me deben?  ', '¿Qué tiendas me deben?'],
    ['[Música] cuánto vendí este mes...', 'cuánto vendí este mes'],
    ['(ruido)', ''],
    ['Subtítulos realizados por la comunidad de Amara.org', ''],
    ['Gracias.', ''],
    ['¡Gracias por ver el video!', ''],
    ['gracias, ¿cuánto vendí hoy?', 'gracias, ¿cuánto vendí hoy?'],
  ])('%s → «%s»', (crudo, limpio) => {
    expect(limpiarTranscripcion(crudo)).toBe(limpio);
  });
});
