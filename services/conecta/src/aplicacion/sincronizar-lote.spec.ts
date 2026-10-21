import type { Operacion } from '../dominio/operacion.js';
import type { DestinoDeOperaciones } from '../dominio/puertos.js';
import { RegistroEnMemoria } from './registro.en-memoria.js';
import { SincronizarLote } from './sincronizar-lote.js';

const pedido = (clave: string, cajas = 2): Operacion => ({
  clave,
  tipo: 'pedido.crear',
  datos: { mayoristaId: 'lp', lineas: [{ productoId: 'HP-0400', presentacion: 'caja', cantidad: cajas }] },
  creadaEn: '2026-10-20T08:42:00-04:00',
});

const preparar = (falla = false) => {
  let llamadas = 0;
  const destino: DestinoDeOperaciones = {
    aplicar: async (op) => {
      llamadas++;
      await new Promise((r) => setTimeout(r, 5));
      if (falla) throw new Error('Pedidos no responde');
      return { pedidoId: `A-${1000 + llamadas}`, clave: op.clave };
    },
  };
  return { caso: new SincronizarLote(new RegistroEnMemoria(), destino), llamadas: () => llamadas };
};

describe('SincronizarLote', () => {
  it('aplica una operación nueva', async () => {
    const { caso } = preparar();
    const [r] = await caso.ejecutar([pedido('k1')], 'token');
    expect(r).toMatchObject({ clave: 'k1', estado: 'aplicada', respuesta: { pedidoId: 'A-1001' } });
  });

  it('un reintento devuelve la misma respuesta y no crea otro pedido', async () => {
    const { caso, llamadas } = preparar();
    await caso.ejecutar([pedido('k1')], 'token');
    const [r] = await caso.ejecutar([pedido('k1')], 'token');
    expect(r).toMatchObject({ estado: 'repetida', respuesta: { pedidoId: 'A-1001' } });
    expect(llamadas()).toBe(1);
  });

  it('20 envíos simultáneos con la misma clave crean un solo pedido', async () => {
    const { caso, llamadas } = preparar();
    const resultados = await Promise.all(Array.from({ length: 20 }, () => caso.aplicarUna(pedido('k1'), 'token')));
    expect(llamadas()).toBe(1);
    expect(resultados.filter((r) => r.estado === 'aplicada')).toHaveLength(1);
  });

  it('la misma clave con otro contenido es un conflicto', async () => {
    const { caso } = preparar();
    await caso.ejecutar([pedido('k1', 2)], 'token');
    const [r] = await caso.ejecutar([pedido('k1', 3)], 'token');
    expect(r.estado).toBe('conflicto');
  });

  it('si el destino falla, la clave se libera para el próximo reintento', async () => {
    const fallido = preparar(true);
    const [r1] = await fallido.caso.ejecutar([pedido('k1')], 'token');
    expect(r1.estado).toBe('rechazada');
    const [r2] = await fallido.caso.ejecutar([pedido('k1')], 'token');
    expect(r2.estado).toBe('rechazada');
    expect(fallido.llamadas()).toBe(2);
  });

  it('rechaza tipos que no conoce', async () => {
    const { caso } = preparar();
    const [r] = await caso.ejecutar([{ ...pedido('k1'), tipo: 'borrar.todo' as never }], 'token');
    expect(r.estado).toBe('rechazada');
  });
});
