import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  conciliarEnCamino,
  contenidoEnCamino,
  destinoDe,
  planEnCamino,
  probarEnConecta,
  quitarDeConecta,
  registrarEnConecta,
  type Presentada,
} from './notificaciones';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { MAX: 5, DEFAULT: 3, LOW: 2 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  AndroidNotificationPriority: { LOW: 'low' },
  getPresentedNotificationsAsync: jest.fn(async () => []),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  dismissNotificationAsync: jest.fn(async () => undefined),
}));

const pedido = (id: string, estado: string) => ({ id, codigo: `A-${id}`, estado, mayorista: { nombre: 'Abasto' } });
const enBandeja = (id: string, estado: string, fijaLocal = false): Presentada => ({ identificador: `pedido-${id}`, estado, fijaLocal });

describe('La notificación fija de «va en camino»', () => {
  it('un pedido que sale en camino pone su fija, aunque ya esté la del servidor (que se puede deslizar)', () => {
    expect(planEnCamino([pedido('1', 'DESPACHADO')], [])).toEqual({ mostrar: [pedido('1', 'DESPACHADO')], quitar: [] });
    expect(planEnCamino([pedido('1', 'DESPACHADO')], [enBandeja('1', 'DESPACHADO')]).mostrar).toHaveLength(1);
  });

  it('si la fija ya está, no la vuelve a poner', () => {
    expect(planEnCamino([pedido('1', 'DESPACHADO')], [enBandeja('1', 'DESPACHADO', true)])).toEqual({ mostrar: [], quitar: [] });
  });

  it('cuando el pedido ya llegó se quita el «en camino», pero no el «¡Llegó tu pedido!» que ocupa su lugar', () => {
    expect(planEnCamino([pedido('1', 'ENTREGADO')], [enBandeja('1', 'DESPACHADO', true)])).toEqual({ mostrar: [], quitar: ['pedido-1'] });
    expect(planEnCamino([pedido('1', 'ENTREGADO')], [enBandeja('1', 'ENTREGADO')])).toEqual({ mostrar: [], quitar: [] });
  });

  it('los pedidos que no salieron no tocan la bandeja', () => {
    expect(planEnCamino([pedido('1', 'CONFIRMADO'), pedido('2', 'EN_PREPARACION')], [])).toEqual({ mostrar: [], quitar: [] });
  });

  it('la fija dice qué pedido y de quién, no se puede deslizar y no vuelve a sonar', () => {
    expect(contenidoEnCamino(pedido('1', 'DESPACHADO'))).toMatchObject({
      title: 'Tu pedido va en camino',
      body: 'A-1 · Abasto. Te avisamos apenas llegue.',
      sticky: true,
      autoDismiss: false,
      data: { tipo: 'pedido', pedidoId: '1', estado: 'DESPACHADO', fija: 'local' },
    });
  });

  it('en Android la pone en el mismo lugar de la bandeja que la del servidor y quita las viejas', async () => {
    Platform.OS = 'android';
    jest.mocked(Notifications.getPresentedNotificationsAsync).mockResolvedValueOnce([
      { request: { identifier: 'pedido-2', content: { data: { estado: 'DESPACHADO', fija: 'local' } } } },
    ] as never);

    await conciliarEnCamino([pedido('1', 'DESPACHADO'), pedido('2', 'ENTREGADO')]);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: 'pedido-1', trigger: { channelId: 'en-camino' }, content: expect.objectContaining({ sticky: true }) }),
    );
    expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('pedido-2');
  });
});

describe('Tocar una notificación', () => {
  it.each([
    [{ tipo: 'pedido', pedidoId: 'p-1', estado: 'DESPACHADO' }, { pantalla: 'Seguimiento', id: 'p-1' }],
    [{ tipo: 'promocion', promocionId: 'x', productoId: 'AB-101' }, { pantalla: 'Producto', id: 'AB-101' }],
    [{ tipo: 'promocion', promocionId: 'x', productoId: '' }, { pantalla: 'Inicio' }],
    [{ tipo: 'prueba' }, null],
    [undefined, null],
  ])('%o lleva a %o', (datos, destino) => {
    expect(destinoDe(datos)).toEqual(destino);
  });
});

describe('El teléfono en Conecta', () => {
  const sesion = async () => 'token-de-sesion';
  const respuesta = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });

  it('registra el token del teléfono con la sesión de la tienda', async () => {
    const enviar = jest.fn(async () => respuesta({ registrado: true }));
    expect(await registrarEnConecta('fcm-123', 'android', sesion, enviar as unknown as typeof fetch)).toBe(true);
    const [url, pedido] = enviar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/v1\/dispositivos$/);
    expect(pedido).toMatchObject({ method: 'PUT', headers: { authorization: 'Bearer token-de-sesion' } });
    expect(JSON.parse(pedido.body as string)).toEqual({ token: 'fcm-123', plataforma: 'android' });
  });

  it('sin señal o sin sesión no rompe: queda sin registrar', async () => {
    const sinRed = jest.fn(async () => Promise.reject(new TypeError('Network request failed')));
    expect(await registrarEnConecta('fcm-123', 'android', sesion, sinRed as unknown as typeof fetch)).toBe(false);
    expect(await registrarEnConecta('fcm-123', 'android', async () => null, jest.fn() as unknown as typeof fetch)).toBe(false);
  });

  it('al cerrar sesión lo da de baja (el token va codificado en la dirección)', async () => {
    const enviar = jest.fn(async () => new Response(null, { status: 204 }));
    await quitarDeConecta('abc:APA91b/xyz', sesion, enviar as unknown as typeof fetch);
    expect((enviar.mock.calls[0] as unknown as [string, RequestInit])[0]).toMatch(/\/v1\/dispositivos\/abc%3AAPA91b%2Fxyz$/);
    expect((enviar.mock.calls[0] as unknown as [string, RequestInit])[1].method).toBe('DELETE');
  });

  it('«Probar una notificación» dice a cuántos teléfonos salió', async () => {
    const enviar = jest.fn(async () => respuesta({ telefonos: 1, enviadas: 1 }));
    expect(await probarEnConecta(sesion, enviar as unknown as typeof fetch)).toEqual({ telefonos: 1, enviadas: 1 });
    await expect(probarEnConecta(sesion, jest.fn(async () => respuesta({}, 500)) as unknown as typeof fetch)).rejects.toThrow('señal');
  });
});
