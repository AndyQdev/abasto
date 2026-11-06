import { describe, expect, it } from 'vitest';
import { motivoParaRechazar } from './entregador.http.js';

const publica = async () => [{ address: '93.184.216.34' }];

describe('CU-10 · A dónde se puede mandar un webhook', () => {
  it('acepta una dirección https pública', async () => {
    expect(await motivoParaRechazar('https://mitienda.bo/abasto', false, publica)).toBeNull();
  });

  it('pide https', async () => {
    expect(await motivoParaRechazar('http://mitienda.bo/abasto', false, publica)).toContain('https://');
    expect(await motivoParaRechazar('ftp://mitienda.bo', false, publica)).toContain('https://');
    expect(await motivoParaRechazar('no es una url', false, publica)).toContain('no se entiende');
  });

  it.each([
    'https://127.0.0.1/x',
    'https://10.1.2.3/x',
    'https://192.168.0.5/x',
    'https://172.20.0.2/x',
    'https://169.254.169.254/latest/meta-data',
    'https://[::1]/x',
    'https://[fd00::1]/x',
    'https://[::ffff:10.0.0.1]/x',
  ])('no acepta la dirección interna %s', async (url) => {
    expect(await motivoParaRechazar(url, false, publica)).toContain('pública');
  });

  it('no acepta un nombre que apunta a una dirección interna', async () => {
    expect(await motivoParaRechazar('https://trampa.bo/x', false, async () => [{ address: '93.184.216.34' }, { address: '10.0.0.8' }])).toContain('pública');
  });

  it('no acepta usuario ni contraseña en la dirección', async () => {
    expect(await motivoParaRechazar('https://a:b@mitienda.bo/', false, publica)).toContain('usuario');
  });

  it('avisa si el nombre no existe', async () => {
    expect(
      await motivoParaRechazar('https://noexiste.bo/', false, async () => {
        throw new Error('ENOTFOUND');
      }),
    ).toContain('No encontramos noexiste.bo');
  });

  it('en desarrollo acepta lo local', async () => {
    expect(await motivoParaRechazar('http://host.docker.internal:9000/x', true, publica)).toBeNull();
    expect(await motivoParaRechazar('ftp://x', true, publica)).toContain('https://');
  });
});
