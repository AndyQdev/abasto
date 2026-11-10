/**
 * El vigía de las notificaciones push (10/11). Montado una vez en `App.tsx`, con la sesión y la navegación listas:
 * 1. Crea los canales, pide el permiso y registra el teléfono en Conecta (y otra vez si Firebase cambia el token).
 * 2. Al tocar una notificación lleva a su pantalla: el seguimiento del pedido o el producto de la promoción.
 * 3. Pone la notificación fija de «va en camino» cuando un pedido sale y la quita cuando llega (al abrir la app, al
 *    volver a ella y con cada aviso en tiempo real).
 * 4. Al cerrar sesión da de baja el teléfono: lo de esa tienda no le llega a quien entre después.
 */
import { MIS_COMPRAS, type Pedido } from '@abasto/comercio';
import * as Notifications from 'expo-notifications';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { graphql } from './api';
import { useEstado } from './estado';
import { navegacion } from './navegar';
import {
  conciliarEnCamino,
  destinoDe,
  mostrarConLaAppAbierta,
  permiso,
  prepararCanales,
  quitarDeConecta,
  registrarEnConecta,
  tokenDelTelefono,
  type Destino,
  type EstadoDePermiso,
} from './notificaciones';
import { alCerrarSesion, useSesion } from './sesion';
import { unaALaVez, useAvisosDePedidos } from './tiempo-real';

// --- Lo que Cuenta muestra: si están activadas y si el teléfono quedó registrado ---

export interface EstadoDeNotificaciones {
  permiso: EstadoDePermiso | 'cargando';
  /** El teléfono quedó anotado en Conecta para recibir los avisos de esta tienda */
  registrado: boolean;
  /** La app se compiló sin Firebase (falta google-services.json): no hay token */
  sinFirebase: boolean;
}

let estado: EstadoDeNotificaciones = { permiso: 'cargando', registrado: false, sinFirebase: false };
const oyentes = new Set<() => void>();
function cambiar(parcial: Partial<EstadoDeNotificaciones>) {
  estado = { ...estado, ...parcial };
  for (const o of oyentes) o();
}

export function useEstadoDeNotificaciones(): EstadoDeNotificaciones {
  return useSyncExternalStore(
    (o) => {
      oyentes.add(o);
      return () => oyentes.delete(o);
    },
    () => estado,
  );
}

/** Lleva a la pantalla de la notificación. Al abrir la app desde una, la navegación tarda un momento en estar lista. */
export function irA(destino: Destino, intentos = 20): void {
  if (!navegacion.isReady()) {
    if (intentos > 0) setTimeout(() => irA(destino, intentos - 1), 150);
    return;
  }
  if (destino.pantalla === 'Seguimiento') navegacion.navigate('Seguimiento', { id: destino.id });
  else if (destino.pantalla === 'Producto') navegacion.navigate('Producto', { id: destino.id });
  else navegacion.navigate('Pestanas', { screen: 'Inicio' });
}

/** Pide el permiso y deja el teléfono registrado. Lo usa también el botón «Activar» de Cuenta. */
export async function activarNotificaciones(sesion: () => Promise<string | null>, pedir = true): Promise<string | null> {
  await prepararCanales();
  const p = await permiso(pedir);
  cambiar({ permiso: p });
  if (p !== 'activadas') return null;
  const telefono = await tokenDelTelefono();
  if (!telefono) {
    cambiar({ sinFirebase: true, registrado: false });
    return null;
  }
  cambiar({ sinFirebase: false, registrado: await registrarEnConecta(telefono.token, telefono.plataforma, sesion) });
  return telefono.token;
}

export function VigiaDeNotificaciones() {
  // En la vista web de desarrollo no hay notificaciones push
  if (Platform.OS === 'web') return null;
  return <Vigia />;
}

function Vigia() {
  const { usuario, token: sesion } = useSesion();
  const { enLinea } = useEstado();
  const tokenDelEquipo = useRef<string | null>(null);

  // 1. Canales, permiso y registro; otra vez si Firebase cambia el token
  useEffect(() => {
    if (!usuario) return;
    mostrarConLaAppAbierta();
    void activarNotificaciones(sesion).then((t) => (tokenDelEquipo.current = t));
    const cambio = Notifications.addPushTokenListener((t) => {
      const nuevo = typeof t.data === 'string' ? t.data : null;
      if (!nuevo) return;
      tokenDelEquipo.current = nuevo;
      void registrarEnConecta(nuevo, Platform.OS === 'ios' ? 'ios' : 'android', sesion).then((ok) => cambiar({ registrado: ok }));
    });
    // 4. Al salir, este teléfono deja de recibir lo de esta tienda
    const salir = alCerrarSesion(async () => {
      if (tokenDelEquipo.current) await quitarDeConecta(tokenDelEquipo.current, sesion);
      if (Platform.OS === 'android') await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
    });
    return () => {
      cambio.remove();
      salir();
    };
  }, [usuario?.id, sesion]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Tocar una notificación (con la app abierta, de fondo o cerrada) lleva a su pantalla
  useEffect(() => {
    const abrir = (r: Notifications.NotificationResponse | null) => {
      const destino = destinoDe(r?.notification.request.content.data as Record<string, unknown> | undefined);
      if (destino) irA(destino);
    };
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      abrir(r);
      if (r) void Notifications.clearLastNotificationResponseAsync?.().catch(() => undefined);
    });
    const toque = Notifications.addNotificationResponseReceivedListener(abrir);
    return () => toque.remove();
  }, []);

  // 3. La fija de «va en camino»
  const revisar = useMemo(
    () =>
      unaALaVez(async () => {
        if (!enLinea || !usuario) return;
        try {
          const { misCompras } = await graphql<{ misCompras: Pedido[] }>(MIS_COMPRAS);
          await conciliarEnCamino(misCompras);
        } catch {
          // Sin servidor: se revisa al volver la señal o con el próximo aviso
        }
      }),
    [enLinea, usuario?.id], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => {
    void revisar();
    const app = AppState.addEventListener('change', (e) => e === 'active' && void revisar());
    return () => app.remove();
  }, [revisar]);
  useAvisosDePedidos(() => void revisar(), () => void revisar());

  return null;
}
