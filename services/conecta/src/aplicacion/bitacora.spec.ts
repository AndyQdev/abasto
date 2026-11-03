import { origenDe, resumir } from '../dominio/bitacora.js';
import type { Operacion } from '../dominio/operacion.js';
import type { DestinoDeOperaciones } from '../dominio/puertos.js';
import { BitacoraEnMemoria } from './bitacora.en-memoria.js';
import { RegistroEnMemoria } from './registro.en-memoria.js';
import { SincronizarLote } from './sincronizar-lote.js';

const pedido = (clave: string, mayoristaId: string | null = 'lp', cajas = 2): Operacion => ({
  clave,
  tipo: 'pedido.crear',
  datos: { ...(mayoristaId ? { mayoristaId } : {}), lineas: [{ productoId: 'HP-0400', presentacion: 'CAJA', cantidad: cajas }] },
  creadaEn: '2026-11-03T08:42:00-04:00',
});

const preparar = (falla = false) => {
  const bitacora = new BitacoraEnMemoria();
  const destino: DestinoDeOperaciones = {
    aplicar: async () => {
      if (falla) throw new Error('El producto HP-0400 no existe');
      return { id: 'p1', codigo: 'A-2001', total: { texto: 'Bs 120,00' }, tienda: { nombre: 'Tienda Doña Rosa' } };
    },
  };
  let t = 0;
  const caso = new SincronizarLote(new RegistroEnMemoria(), destino, bitacora, () => new Date(Date.UTC(2026, 10, 3, 12, 0, t++)));
  return { caso, bitacora };
};

const WHATSAPP = { origen: 'whatsapp' as const, tiendaId: 'dr' };

describe('Bitácora de Conecta (Panel › Conecta)', () => {
  it('anota cada pedido que entra, con el código, el total y la tienda que devolvió Pedidos', async () => {
    const { caso, bitacora } = preparar();
    await caso.aplicarUna(pedido('k1'), 'token', WHATSAPP);
    expect(bitacora.entradas).toEqual([
      expect.objectContaining({
        mayoristaId: 'lp',
        clave: 'k1',
        origen: 'whatsapp',
        estado: 'aplicada',
        tiendaId: 'dr',
        tiendaNombre: 'Tienda Doña Rosa',
        codigo: 'A-2001',
        total: 'Bs 120,00',
        error: null,
      }),
    ]);
  });

  it('el mismo mensaje repetido queda como «repetida» y no crea otro pedido; el resumen lo cuenta aparte', async () => {
    const { caso, bitacora } = preparar();
    await caso.aplicarUna(pedido('k1'), 'token', WHATSAPP);
    await caso.aplicarUna(pedido('k1'), 'token', WHATSAPP);
    expect(bitacora.entradas.map((e) => e.estado)).toEqual(['aplicada', 'repetida']);
    expect(bitacora.entradas[1].codigo).toBe('A-2001');
    expect(resumir(await bitacora.delMayorista('lp', 10))).toEqual({ aplicadas: 1, repetidas: 1, conProblemas: 0 });
  });

  it('lo rechazado queda con el motivo; lo que no es de un mayorista no se anota', async () => {
    const { caso, bitacora } = preparar(true);
    await caso.aplicarUna(pedido('k2'), 'token', WHATSAPP);
    await caso.aplicarUna(pedido('k3', null), 'token', WHATSAPP);
    expect(bitacora.entradas).toHaveLength(1);
    expect(bitacora.entradas[0]).toMatchObject({ estado: 'rechazada', error: 'El producto HP-0400 no existe' });
  });

  it('si la bitácora falla, el pedido entra igual', async () => {
    const { caso } = preparar();
    const rota = new SincronizarLote(new RegistroEnMemoria(), { aplicar: async () => ({ codigo: 'A-1' }) }, {
      anotar: async () => {
        throw new Error('DynamoDB no responde');
      },
      delMayorista: async () => [],
    });
    expect((await rota.aplicarUna(pedido('k4'), 'token', WHATSAPP)).estado).toBe('aplicada');
    expect(caso).toBeDefined();
  });

  it('el origen sale de la cabecera; la bandeja de la app siempre es «sin señal»', () => {
    expect(origenDe('whatsapp', false)).toBe('whatsapp');
    expect(origenDe('Tienda-En-Linea', false)).toBe('tienda-en-linea');
    expect(origenDe('cualquier cosa', false)).toBe('api');
    expect(origenDe(undefined, false)).toBe('api');
    expect(origenDe('whatsapp', true)).toBe('app-sin-senal');
  });

  it('lo último primero', async () => {
    const { caso, bitacora } = preparar();
    await caso.aplicarUna(pedido('a'), 'token', WHATSAPP);
    await caso.aplicarUna(pedido('b'), 'token', WHATSAPP);
    expect((await bitacora.delMayorista('lp', 10)).map((e) => e.clave)).toEqual(['b', 'a']);
  });
});
