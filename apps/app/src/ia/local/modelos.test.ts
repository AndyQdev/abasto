import { manifiesto, modeloRecomendado, modelosPosibles, nivelDelDispositivo, urlDe, type Capacidades } from './modelos';

const telefono = (memoriaMb: number | null, espacioLibreMb: number | null = 20_000, arquitecturas = ['arm64-v8a']): Capacidades => ({
  memoriaMb,
  arquitecturas,
  espacioLibreMb,
});

describe('Cada teléfono recibe el modelo que puede correr', () => {
  it('clasifica por memoria', () => {
    expect(nivelDelDispositivo(telefono(2_000))).toBe('ninguno');
    expect(nivelDelDispositivo(telefono(3_000))).toBe('basico');
    expect(nivelDelDispositivo(telefono(4_000))).toBe('medio');
    expect(nivelDelDispositivo(telefono(8_000))).toBe('alto');
    expect(nivelDelDispositivo(telefono(12_000))).toBe('maximo');
  });

  it('un procesador de 32 bits o sin dato de memoria se queda con reglas, ML Kit y MobileNetV3', () => {
    expect(nivelDelDispositivo(telefono(6_000, 20_000, ['armeabi-v7a']))).toBe('ninguno');
    expect(nivelDelDispositivo(telefono(null))).toBe('ninguno');
    expect(modeloRecomendado(telefono(6_000, 20_000, ['armeabi-v7a']))).toBeNull();
  });

  it('un Android económico de 3 GB recibe el modelo de 450M (~330 MB)', () => {
    expect(modeloRecomendado(telefono(3_000))?.id).toBe('lfm2.5-vl-450m');
  });

  it('uno intermedio de 4 GB recibe Qwen3.5 0.8B y uno de 8 GB, Qwen3.5 2B', () => {
    expect(modeloRecomendado(telefono(4_000))?.id).toBe('qwen3.5-0.8b');
    expect(modeloRecomendado(telefono(8_000))?.id).toBe('qwen3.5-2b');
  });

  it('uno potente de 12 GB recibe Gemma 4, y E4B solo si sobra memoria', () => {
    expect(modeloRecomendado(telefono(12_000))?.id).toBe('gemma-4-e4b');
    expect(modeloRecomendado(telefono(11_500))?.id).toBe('gemma-4-e2b');
  });

  it('si no hay espacio para el que le toca, baja a uno más liviano que sí entra', () => {
    expect(modeloRecomendado(telefono(8_000, 2_000))?.id).toBe('qwen3.5-0.8b');
    expect(modeloRecomendado(telefono(8_000, 500))).toBeNull();
  });

  it('los más capaces van primero en la lista de posibles', () => {
    expect(modelosPosibles(telefono(8_000)).map((m) => m.id)).toEqual(['qwen3.5-2b', 'qwen3.5-0.8b', 'lfm2.5-vl-450m']);
  });

  it('descarga de Hugging Face o de un espejo propio con la misma estructura', () => {
    const archivo = manifiesto.modelos[0].archivos.modelo;
    expect(urlDe(archivo)).toBe(`https://huggingface.co/${archivo.ruta}`);
    expect(urlDe(archivo, 'https://modelos.abasto.bo/')).toBe(`https://modelos.abasto.bo/${archivo.ruta}`);
  });

  it('el manifiesto no tiene ids repetidos y todo archivo trae su tamaño y su SHA-256', () => {
    const ids = manifiesto.modelos.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of manifiesto.modelos) {
      for (const a of [m.archivos.modelo, m.archivos.proyector!]) {
        expect(a.bytes).toBeGreaterThan(0);
        expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
      }
    }
  });
});
