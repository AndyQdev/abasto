import { Dinero } from '../dominio/dinero.js';
import { LineaDeCreditoNoExiste } from '../dominio/errores.js';
import { LineaDeCredito } from '../dominio/linea-de-credito.js';
import { AutorizarCredito, LiberarCredito } from './autorizar-credito.js';
import { LineaDeCreditoEnMemoria } from './linea-de-credito.en-memoria.js';

describe('AutorizarCredito', () => {
  const preparar = () => {
    const repo = new LineaDeCreditoEnMemoria([
      new LineaDeCredito({
        id: 'l1',
        tiendaId: 'dr',
        mayoristaId: 'lp',
        limite: Dinero.deBolivianos(4000),
        plazoDias: 15,
        reservas: new Map(),
      }),
    ]);
    return { repo, autorizar: new AutorizarCredito(repo), liberar: new LiberarCredito(repo) };
  };

  it('autoriza, guarda y deja el evento en el outbox', async () => {
    const { repo, autorizar } = preparar();
    const r = await autorizar.ejecutar({ tiendaId: 'dr', mayoristaId: 'lp', pedidoId: 'A-1', centavos: 50000 });
    expect(r.disponible.texto()).toBe('Bs 3.500,00');
    expect(repo.outbox.map((e) => e.tipo)).toEqual(['cobro.credito_autorizado']);
  });

  it('falla si la tienda no tiene crédito con ese mayorista', async () => {
    const { autorizar } = preparar();
    await expect(
      autorizar.ejecutar({ tiendaId: 'dr', mayoristaId: 'lr', pedidoId: 'A-1', centavos: 100 }),
    ).rejects.toThrow(LineaDeCreditoNoExiste);
  });

  it('la compensación devuelve el cupo', async () => {
    const { repo, autorizar, liberar } = preparar();
    await autorizar.ejecutar({ tiendaId: 'dr', mayoristaId: 'lp', pedidoId: 'A-1', centavos: 50000 });
    await liberar.ejecutar({ tiendaId: 'dr', mayoristaId: 'lp', pedidoId: 'A-1' });
    const linea = await repo.buscar('dr', 'lp');
    expect(linea?.disponible.texto()).toBe('Bs 4.000,00');
    expect(repo.outbox.map((e) => e.tipo)).toEqual(['cobro.credito_autorizado', 'cobro.credito_liberado']);
  });
});
