import { DirectorioCatalogo } from './directorio.catalogo.js';

const respuesta = (entidades: { id: string; nombre: string }[]) =>
  Promise.resolve(new Response(JSON.stringify({ data: { _entities: entidades } })));

describe('Directorio de tiendas (Catálogo)', () => {
  it('pide los nombres a Catálogo y recuerda los que ya conoce', async () => {
    const pedir = vi.fn(() => respuesta([{ id: 'dl', nombre: 'Despensa Lupita' }]));
    const directorio = new DirectorioCatalogo('http://catalogo/graphql', pedir as unknown as typeof fetch);

    expect(await directorio.nombres(['dl'])).toEqual({ dl: 'Despensa Lupita' });
    expect(await directorio.nombres(['dl'])).toEqual({ dl: 'Despensa Lupita' });
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it('una tienda que Catálogo no conoce queda con su id y se vuelve a preguntar después', async () => {
    const pedir = vi.fn(() => respuesta([{ id: 'zz', nombre: 'zz' }]));
    const directorio = new DirectorioCatalogo('http://catalogo/graphql', pedir as unknown as typeof fetch);

    expect(await directorio.nombres(['zz'])).toEqual({ zz: 'zz' });
    await directorio.nombres(['zz']);
    expect(pedir).toHaveBeenCalledTimes(2);
  });

  it('si Catálogo no responde, usa los ids y no lanza error', async () => {
    const pedir = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')));
    const directorio = new DirectorioCatalogo('http://catalogo/graphql', pedir as unknown as typeof fetch);

    expect(await directorio.nombres(['am', 'dr'])).toEqual({ am: 'am', dr: 'dr' });
  });

  it('sin tiendas no llama a Catálogo', async () => {
    const pedir = vi.fn();
    const directorio = new DirectorioCatalogo('http://catalogo/graphql', pedir as unknown as typeof fetch);

    expect(await directorio.nombres([])).toEqual({});
    expect(pedir).not.toHaveBeenCalled();
  });
});
