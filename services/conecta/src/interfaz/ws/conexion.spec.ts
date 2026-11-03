import { CanalDeTiendas } from '../../aplicacion/canal-de-tiendas.js';
import { atenderConexion, CIERRE, type SocketMinimo } from './conexion.js';

function socketFalso() {
  const oyentes: Record<string, ((d?: unknown) => void)[]> = {};
  const enviados: unknown[] = [];
  const cierres: [number, string][] = [];
  const socket = {
    send: (t: string) => enviados.push(JSON.parse(t)),
    close: (codigo: number, motivo: string) => {
      cierres.push([codigo, motivo]);
      oyentes.close?.forEach((f) => f());
    },
    on: (evento: string, f: (d?: unknown) => void) => {
      (oyentes[evento] ??= []).push(f);
    },
  } as unknown as SocketMinimo;
  const recibir = (texto: string) => oyentes.message?.forEach((f) => f(texto));
  return { socket, enviados, cierres, recibir };
}

const espera = () => new Promise((r) => setTimeout(r, 0));
const sobre = (tiendaId: string) => ({ tipo: 'pedido.entregado', datos: { pedidoId: 'p1', codigo: 'A-9', tiendaId } });

describe('la conexión en tiempo real', () => {
  afterEach(() => vi.useRealTimers());

  it('con un token de tienda queda lista y recibe solo los avisos de esa tienda', async () => {
    const canal = new CanalDeTiendas();
    const f = socketFalso();
    const verificar = vi.fn().mockResolvedValue({ id: 'u', orgId: 'rosa', roles: [] });
    atenderConexion(f.socket, { verificar, canal });
    f.recibir(JSON.stringify({ tipo: 'hola', token: 'tok' }));
    await espera();
    expect(verificar).toHaveBeenCalledWith('tok');
    expect(f.enviados).toEqual([{ tipo: 'listo' }]);
    canal.publicar(sobre('rosa'));
    canal.publicar(sobre('otra'));
    expect(f.enviados).toEqual([{ tipo: 'listo' }, { tipo: 'pedido.entregado', pedidoId: 'p1', codigo: 'A-9', ocurridoEn: null }]);
  });

  it('un token inválido o sin tienda cierra con 4401 y no se suscribe', async () => {
    const canal = new CanalDeTiendas();
    const malo = socketFalso();
    atenderConexion(malo.socket, { verificar: vi.fn().mockRejectedValue(new Error('firma')), canal });
    malo.recibir(JSON.stringify({ tipo: 'hola', token: 'x' }));
    const sinTienda = socketFalso();
    atenderConexion(sinTienda.socket, { verificar: vi.fn().mockResolvedValue({ id: 'u', orgId: '', roles: [] }), canal });
    sinTienda.recibir(JSON.stringify({ tipo: 'hola', token: 'y' }));
    await espera();
    expect(malo.cierres[0][0]).toBe(CIERRE.SIN_SESION);
    expect(sinTienda.cierres[0][0]).toBe(CIERRE.SIN_SESION);
    expect(canal.conexiones()).toBe(0);
  });

  it('sin «hola» a tiempo, o con un mensaje que no se entiende, cierra', () => {
    vi.useFakeTimers();
    const canal = new CanalDeTiendas();
    const callado = socketFalso();
    atenderConexion(callado.socket, { verificar: vi.fn(), canal, esperaMs: 1000 });
    vi.advanceTimersByTime(1001);
    expect(callado.cierres).toEqual([[CIERRE.SIN_SESION, 'Falta la sesión']]);
    const raro = socketFalso();
    atenderConexion(raro.socket, { verificar: vi.fn(), canal });
    raro.recibir('no es json');
    expect(raro.cierres[0][0]).toBe(CIERRE.NO_SE_ENTIENDE);
  });

  it('cuando vence el token cierra con 4001 y deja de recibir', async () => {
    vi.useFakeTimers();
    const canal = new CanalDeTiendas();
    const f = socketFalso();
    atenderConexion(f.socket, { verificar: vi.fn().mockResolvedValue({ id: 'u', orgId: 'rosa', roles: [], venceEn: 60_000 }), canal, ahora: () => 0 });
    f.recibir(JSON.stringify({ tipo: 'hola', token: 't' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(canal.conexiones()).toBe(1);
    await vi.advanceTimersByTimeAsync(60_001);
    expect(f.cierres).toEqual([[CIERRE.VENCIDA, 'La sesión venció']]);
    expect(canal.conexiones()).toBe(0);
  });
});
