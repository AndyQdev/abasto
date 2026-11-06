import { act, configure, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';
import { conectarTienda, resultadoDeEntrega, ultimoUso } from '../conectar-tienda';
import { ConectarTienda } from './ConectarTienda';

jest.mock('@expo/vector-icons', () => ({ Ionicons: ({ name }: { name: string }) => jest.requireActual('react').createElement('Text', null, `[${name}]`) }));
jest.mock('../sesion', () => {
  // El token es estable, como en la app (useCallback): si cambiara en cada dibujo, la pantalla cargaría sin parar
  const token = async () => 'token-de-la-sesion';
  return { useSesion: () => ({ token }) };
});

configure({ asyncUtilTimeout: 5000 });
jest.setTimeout(30000);

type Respuesta = { estado?: number; cuerpo?: unknown };
const LLAVE = { id: 'l1', nombre: 'Mi WooCommerce', termina: 'ab12', creadaEn: '2026-11-06T12:00:00Z', ultimoUsoEn: null };
const WEBHOOK = { id: 'w1', url: 'https://mitienda.bo/avisos', creadoEn: '2026-11-06T12:00:00Z' };

/** Conecta de mentira: responde según el método y la ruta, y anota lo que le piden. */
function conecta(rutas: Record<string, Respuesta>) {
  const pedidos: { ruta: string; cabeceras: Record<string, string>; cuerpo?: unknown }[] = [];
  const falso = jest.fn(async (url: string, opciones: { method: string; headers: Record<string, string>; body?: string }) => {
    const ruta = `${opciones.method} ${url.replace(/^https?:\/\/[^/]+/, '')}`;
    pedidos.push({ ruta, cabeceras: opciones.headers, cuerpo: opciones.body ? JSON.parse(opciones.body) : undefined });
    const r = rutas[ruta] ?? { cuerpo: [] };
    const estado = r.estado ?? 200;
    return { ok: estado < 400, status: estado, json: async () => r.cuerpo } as Response;
  });
  globalThis.fetch = falso as unknown as typeof fetch;
  return pedidos;
}

describe('CU-10 · Conectar mi tienda en línea', () => {
  it('saca una llave: la muestra una sola vez y se puede compartir', async () => {
    const pedidos = conecta({ 'POST /v1/llaves': { estado: 201, cuerpo: { llave: 'abk_123_secreto', datos: LLAVE } } });
    const compartir = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    await render(<ConectarTienda />);
    await screen.findByText(/Todavía no tienes llaves/);

    await fireEvent.changeText(screen.getByLabelText('Nombre de la llave'), 'Mi WooCommerce');
    await fireEvent.press(screen.getByLabelText('Sacar una llave'));

    await screen.findByText('abk_123_secreto');
    expect(pedidos.find((p) => p.ruta === 'POST /v1/llaves')?.cuerpo).toEqual({ nombre: 'Mi WooCommerce' });
    expect(pedidos.every((p) => p.cabeceras.authorization === 'Bearer token-de-la-sesion')).toBe(true);

    await fireEvent.press(screen.getByLabelText('Copiar o compartir'));
    expect(compartir).toHaveBeenCalledWith({ message: 'abk_123_secreto' });

    await fireEvent.press(screen.getByLabelText('Ya la guardé'));
    expect(screen.queryByText('abk_123_secreto')).toBeNull();
  });

  it('la lista no muestra el secreto y revocar pide confirmación', async () => {
    const pedidos = conecta({ 'GET /v1/llaves': { cuerpo: [LLAVE] }, 'DELETE /v1/llaves/l1': { estado: 204 } });
    const alerta = jest.spyOn(Alert, 'alert');
    await render(<ConectarTienda />);
    await screen.findByText('Mi WooCommerce');
    expect(screen.getByText(/Termina en ab12/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Revocar'));
    expect(pedidos.some((p) => p.ruta.startsWith('DELETE'))).toBe(false);

    const botones = alerta.mock.calls[0]?.[2] ?? [];
    await act(async () => botones.find((b) => b.style === 'destructive')?.onPress?.());
    await waitFor(() => expect(pedidos.some((p) => p.ruta === 'DELETE /v1/llaves/l1')).toBe(true));
  });

  it('muestra en español lo que responde Conecta', async () => {
    conecta({ 'POST /v1/webhooks': { estado: 400, cuerpo: { message: 'Tiene que empezar con https://' } } });
    await render(<ConectarTienda />);
    await screen.findByText(/Todavía no tienes llaves/);
    await fireEvent.changeText(screen.getByLabelText('Dirección de tu tienda'), 'http://mitienda.bo');
    await fireEvent.press(screen.getByLabelText('Agregar dirección'));
    await screen.findByText('Tiene que empezar con https://');
  });

  it('agrega una dirección, muestra su clave una vez y dice cómo llegó el último aviso', async () => {
    const pedidos = conecta({
      'GET /v1/webhooks': { cuerpo: [WEBHOOK] },
      'GET /v1/entregas': { cuerpo: [{ id: 'e1', webhookId: 'w1', tipo: 'pedido.confirmado', estado: 'fallida', ultimoError: 'Respondió 500', creadaEn: '2026-11-06T12:00:00Z' }] },
      'POST /v1/webhooks': { estado: 201, cuerpo: { secreto: 'whs_clave', datos: WEBHOOK } },
      'POST /v1/entregas/e1/reenviar': { cuerpo: { id: 'e1', estado: 'entregada' } },
    });
    await render(<ConectarTienda />);
    await screen.findByText('No llegó: Respondió 500');

    await fireEvent.press(screen.getByLabelText('Reenviar'));
    await waitFor(() => expect(pedidos.some((p) => p.ruta === 'POST /v1/entregas/e1/reenviar')).toBe(true));

    await fireEvent.changeText(screen.getByLabelText('Dirección de tu tienda'), 'https://mitienda.bo/otro');
    await fireEvent.press(screen.getByLabelText('Agregar dirección'));
    await screen.findByText('whs_clave');
  });

  it('sin señal lo dice y no se queda cargando', async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new Error('Network request failed');
    }) as unknown as typeof fetch;
    await render(<ConectarTienda />);
    await screen.findByText('No hay conexión. Revisa tu señal y vuelve a intentar.');
    expect(screen.queryByText('Cargando…')).toBeNull();
  });
});

describe('CU-10 · Lógica de conectar la tienda', () => {
  it('sin sesión no llama a Conecta', async () => {
    const enviar = jest.fn();
    await expect(conectarTienda(async () => null, enviar as unknown as typeof fetch).llaves()).rejects.toThrow('Tu sesión venció');
    expect(enviar).not.toHaveBeenCalled();
  });

  it('un error interno no se le muestra a la persona', async () => {
    const enviar = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({ message: 'TypeError: x is not a function' }) }));
    await expect(conectarTienda(async () => 't', enviar as unknown as typeof fetch).llaves()).rejects.toThrow('Algo falló de nuestro lado');
  });

  it('dice qué pasó con cada aviso', () => {
    expect(resultadoDeEntrega({ estado: 'entregada', ultimoError: null })).toBe('Llegó a tu tienda');
    expect(resultadoDeEntrega({ estado: 'pendiente', ultimoError: 'caído' })).toContain('Lo volvemos a intentar');
    expect(resultadoDeEntrega({ estado: 'fallida', ultimoError: 'caído' })).toBe('No llegó: caído');
  });

  it('dice si la llave se está usando', () => {
    const ahora = new Date(2026, 10, 6, 15);
    expect(ultimoUso(null, ahora)).toBe('Todavía no se usó');
    expect(ultimoUso(new Date(2026, 10, 6, 9).toISOString(), ahora)).toBe('Se usó hoy');
    expect(ultimoUso(new Date(2026, 9, 28, 9).toISOString(), ahora)).toBe('Se usó el 28/10/2026');
  });
});
