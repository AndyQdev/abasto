import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { CanalEnVivo, unaALaVez, urlDelCanal, useAvisosDePedidos, type SocketDelTelefono } from './tiempo-real';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('./api', () => ({ graphql: jest.fn() }));
let mockEnLinea = true;
jest.mock('./estado', () => ({ useEstado: () => ({ enLinea: mockEnLinea }) }));

/** Un WebSocket de mentira: la prueba hace de Conecta */
class SocketFalso implements SocketDelTelefono {
  static creados: SocketFalso[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  enviados: string[] = [];
  cerrado = false;
  constructor(readonly url: string) {
    SocketFalso.creados.push(this);
  }
  send(t: string) {
    this.enviados.push(t);
  }
  close() {
    this.cerrado = true;
  }
  // Lo que hace Conecta
  abrir() {
    this.onopen?.();
  }
  listo() {
    this.onmessage?.({ data: JSON.stringify({ tipo: 'listo' }) });
  }
  avisar(tipo: string, pedidoId: string) {
    this.onmessage?.({ data: JSON.stringify({ tipo, pedidoId, codigo: 'A-1', ocurridoEn: null }) });
  }
  cortar(code = 1006) {
    this.onclose?.({ code });
  }
}

const espera = () => new Promise((r) => setTimeout(r, 0));

function armar(token: () => Promise<string | null> = async () => 'tok') {
  SocketFalso.creados = [];
  const relojes: { f: () => void; ms: number }[] = [];
  const canal = new CanalEnVivo({
    crear: (url) => new SocketFalso(url),
    token,
    url: 'ws://pc:8084/v1/tiempo-real',
    programar: (f, ms) => {
      relojes.push({ f, ms });
      return relojes.length as unknown as ReturnType<typeof setTimeout>;
    },
    cancelar: () => undefined,
  });
  return { canal, relojes, ultimo: () => SocketFalso.creados[SocketFalso.creados.length - 1] };
}

describe('el canal en vivo de los pedidos', () => {
  it('la dirección sale de la de Conecta', () => {
    expect(urlDelCanal('http://192.168.0.19:8084')).toBe('ws://192.168.0.19:8084/v1/tiempo-real');
    expect(urlDelCanal('https://conecta.abasto.bo/')).toBe('wss://conecta.abasto.bo/v1/tiempo-real');
  });

  it('se abre con el primer oyente, se presenta con el token y reparte los avisos', async () => {
    const { canal, ultimo } = armar();
    const alAviso = jest.fn();
    canal.suscribir({ alAviso });
    await espera();
    const s = ultimo();
    s.abrir();
    expect(JSON.parse(s.enviados[0])).toEqual({ tipo: 'hola', token: 'tok' });
    s.listo();
    s.avisar('pedido.confirmado', 'p1');
    expect(alAviso).toHaveBeenCalledWith({ tipo: 'pedido.confirmado', pedidoId: 'p1', codigo: 'A-1', ocurridoEn: null });
    expect(canal.conectado).toBe(true);
  });

  it('una sola conexión para varias pantallas; se cierra cuando ya nadie escucha', async () => {
    const { canal, ultimo } = armar();
    const salirA = canal.suscribir({ alAviso: jest.fn() });
    const salirB = canal.suscribir({ alAviso: jest.fn() });
    await espera();
    expect(SocketFalso.creados).toHaveLength(1);
    salirA();
    expect(ultimo().cerrado).toBe(false);
    salirB();
    expect(ultimo().cerrado).toBe(true);
  });

  it('si se corta reintenta cada vez más espaciado y, al volver, pide reconectar (para traer todo una vez)', async () => {
    const { canal, relojes, ultimo } = armar();
    const alReconectar = jest.fn();
    canal.suscribir({ alAviso: jest.fn(), alReconectar });
    await espera();
    ultimo().abrir();
    ultimo().listo();
    expect(alReconectar).not.toHaveBeenCalled();

    ultimo().cortar();
    expect(relojes.map((r) => r.ms)).toEqual([1000]);
    relojes[0].f();
    await espera();
    ultimo().cortar(); // falla otra vez antes de abrir
    expect(relojes.map((r) => r.ms)).toEqual([1000, 2000]);
    relojes[1].f();
    await espera();
    ultimo().abrir();
    ultimo().listo();
    expect(alReconectar).toHaveBeenCalledTimes(1);
  });

  it('con la sesión vencida (4001) vuelve a entrar enseguida', async () => {
    const { canal, relojes, ultimo } = armar();
    canal.suscribir({ alAviso: jest.fn() });
    await espera();
    ultimo().abrir();
    ultimo().listo();
    ultimo().cortar(4001);
    expect(relojes.map((r) => r.ms)).toEqual([0]);
  });

  it('sin señal no intenta; al volver la señal se conecta', async () => {
    const { canal } = armar();
    canal.ponerEnLinea(false);
    canal.suscribir({ alAviso: jest.fn() });
    await espera();
    expect(SocketFalso.creados).toHaveLength(0);
    canal.ponerEnLinea(true);
    await espera();
    expect(SocketFalso.creados).toHaveLength(1);
  });

  it('sin sesión no abre nada y lo vuelve a intentar más tarde', async () => {
    const { canal, relojes } = armar(async () => null);
    canal.suscribir({ alAviso: jest.fn() });
    await espera();
    expect(SocketFalso.creados).toHaveLength(0);
    expect(relojes).toHaveLength(1);
  });
});

describe('useAvisosDePedidos', () => {
  function Pantalla({ canal, alAviso }: { canal: CanalEnVivo; alAviso: (id: string) => void }) {
    useAvisosDePedidos((a) => alAviso(a.pedidoId), undefined, canal);
    return <Text>pedidos</Text>;
  }

  it('la pantalla recibe los avisos mientras está montada y suelta la conexión al salir', async () => {
    mockEnLinea = true;
    const { canal, ultimo } = armar();
    const alAviso = jest.fn();
    const { unmount } = await render(<Pantalla canal={canal} alAviso={alAviso} />);
    expect(screen.getByText('pedidos')).toBeTruthy();
    await espera();
    ultimo().abrir();
    ultimo().listo();
    ultimo().avisar('pedido.despachado', 'p7');
    expect(alAviso).toHaveBeenCalledWith('p7');
    await unmount();
    expect(ultimo().cerrado).toBe(true);
  });
});

describe('unaALaVez', () => {
  it('cinco avisos juntos son a lo sumo dos pedidos al servidor', async () => {
    let resolver: () => void = () => undefined;
    const traer = jest.fn(() => new Promise<void>((r) => (resolver = r)));
    const una = unaALaVez(traer);
    void una();
    void una();
    void una();
    void una();
    void una();
    expect(traer).toHaveBeenCalledTimes(1);
    resolver();
    await espera();
    await espera();
    expect(traer).toHaveBeenCalledTimes(2);
    resolver();
    await espera();
    expect(traer).toHaveBeenCalledTimes(2);
  });
});
