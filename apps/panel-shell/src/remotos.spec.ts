import { describe, expect, it, vi } from 'vitest';
import { CargadorDeRemotos, type Manifiesto } from './remotos';

const manifiesto: Manifiesto = {
  gestion: { elemento: 'abasto-gestion', scripts: ['http://localhost:5171/main.js'] },
  inteligencia: { elemento: 'abasto-inteligencia', scripts: ['http://localhost:5172/src/remoto.ts'] },
};

describe('CargadorDeRemotos', () => {
  it('importa cada remoto una sola vez aunque lo pidan varias pantallas', async () => {
    const importar = vi.fn(async () => undefined);
    const cargador = new CargadorDeRemotos(async () => manifiesto, importar, { whenDefined: async () => undefined as never });

    const [a, b] = await Promise.all([cargador.cargar('gestion'), cargador.cargar('gestion')]);

    expect(a).toBe('abasto-gestion');
    expect(b).toBe('abasto-gestion');
    expect(importar).toHaveBeenCalledTimes(1);
  });

  it('si un remoto no carga, el siguiente intento vuelve a probar', async () => {
    const importar = vi.fn().mockRejectedValueOnce(new Error('Gestión no responde')).mockResolvedValue(undefined);
    const cargador = new CargadorDeRemotos(async () => manifiesto, importar, { whenDefined: async () => undefined as never });

    await expect(cargador.cargar('inteligencia')).rejects.toThrow('Gestión no responde');
    await expect(cargador.cargar('inteligencia')).resolves.toBe('abasto-inteligencia');
  });
});
