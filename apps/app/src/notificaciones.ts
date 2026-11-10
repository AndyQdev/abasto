/**
 * Notificaciones push (10/11, pedido del ingeniero): la tienda se entera de cada paso de su pedido y de las
 * promociones de Abasto aunque tenga la app cerrada. Las manda Conecta por Firebase; aquí está lo del teléfono:
 * - los canales de Android (Pedidos suena; Promociones se puede silenciar aparte; «En camino» es la fija, sin sonido);
 * - el permiso y el token del teléfono, que se registran en Conecta con la sesión;
 * - a dónde lleva tocar cada notificación;
 * - la notificación fija de «va en camino», como en las apps de delivery: no se puede deslizar y se va sola cuando
 *   el pedido llega. Usa el mismo lugar de la bandeja que las del servidor (`pedido-<id>`): cada paso reemplaza al
 *   anterior y nunca hay dos del mismo pedido.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { URLS } from './config';

export const CANAL_PEDIDOS = 'pedidos';
export const CANAL_PROMOCIONES = 'promociones';
export const CANAL_EN_CAMINO = 'en-camino';

type Token = () => Promise<string | null>;
type Enviar = typeof fetch;

export type Plataforma = 'android' | 'ios';
export type EstadoDePermiso = 'activadas' | 'desactivadas' | 'sin-preguntar';

/** Los canales se crean una vez; Android los recuerda y la persona los maneja en Ajustes. */
export async function prepararCanales(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANAL_PEDIDOS, {
    name: 'Tus pedidos',
    description: 'Cuando confirman tu pedido, sale en camino y llega',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 200, 250],
    lightColor: '#C9F45A',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync(CANAL_PROMOCIONES, {
    name: 'Promociones',
    description: 'Ofertas de Abasto',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  // La fija de «en camino» no vuelve a sonar: ya sonó la del servidor cuando salió el pedido
  await Notifications.setNotificationChannelAsync(CANAL_EN_CAMINO, {
    name: 'Pedido en camino',
    description: 'Queda a la vista mientras tu pedido viaja',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    enableVibrate: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/** Con la app abierta, las notificaciones también se muestran (si no, se pierden mientras miras otra pantalla). */
export function mostrarConLaAppAbierta(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/** Lee el permiso; con `pedir`, lo pide si nunca se preguntó (Android 13+ muestra su diálogo). */
export async function permiso(pedir: boolean): Promise<EstadoDePermiso> {
  let actual = await Notifications.getPermissionsAsync();
  if (!actual.granted && actual.canAskAgain && pedir) actual = await Notifications.requestPermissionsAsync();
  if (actual.granted) return 'activadas';
  return actual.canAskAgain ? 'sin-preguntar' : 'desactivadas';
}

/** El token de Firebase del teléfono. Null si la app se compiló sin Firebase (falta google-services.json). */
export async function tokenDelTelefono(): Promise<{ token: string; plataforma: Plataforma } | null> {
  try {
    const t = await Notifications.getDevicePushTokenAsync();
    const token = typeof t.data === 'string' ? t.data : '';
    return token ? { token, plataforma: Platform.OS === 'ios' ? 'ios' : 'android' } : null;
  } catch {
    return null;
  }
}

async function conecta(ruta: string, sesion: Token, metodo: string, cuerpo: unknown, enviar: Enviar): Promise<Response> {
  const t = await sesion();
  if (!t) throw new Error('Sin sesión');
  return enviar(`${URLS.conecta}${ruta}`, {
    method: metodo,
    headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
  });
}

/** Le dice a Conecta «a este teléfono, los avisos de mi tienda». Se repite al entrar: es idempotente. */
export async function registrarEnConecta(token: string, plataforma: Plataforma, sesion: Token, enviar: Enviar = fetch): Promise<boolean> {
  try {
    const r = await conecta('/v1/dispositivos', sesion, 'PUT', { token, plataforma }, enviar);
    return r.ok;
  } catch {
    return false;
  }
}

/** Al cerrar sesión: este teléfono deja de recibir lo de esa tienda. */
export async function quitarDeConecta(token: string, sesion: Token, enviar: Enviar = fetch): Promise<void> {
  await conecta(`/v1/dispositivos/${encodeURIComponent(token)}`, sesion, 'DELETE', undefined, enviar).catch(() => undefined);
}

/** «Probar notificación» de Cuenta: Conecta le manda una a los teléfonos de esta tienda. */
export async function probarEnConecta(sesion: Token, enviar: Enviar = fetch): Promise<{ telefonos: number; enviadas: number }> {
  const r = await conecta('/v1/dispositivos/prueba', sesion, 'POST', {}, enviar);
  if (!r.ok) throw new Error('No se pudo mandar la prueba. Revisa tu señal.');
  return (await r.json()) as { telefonos: number; enviadas: number };
}

// --- Qué pasa al tocar una notificación ---

export type Destino = { pantalla: 'Seguimiento'; id: string } | { pantalla: 'Producto'; id: string } | { pantalla: 'Inicio' };

const texto = (v: unknown) => (typeof v === 'string' && v ? v : null);

/** Un pedido abre su seguimiento; una promoción, su producto (o el Inicio); la de prueba no lleva a ningún lado. */
export function destinoDe(datos: Record<string, unknown> | undefined | null): Destino | null {
  if (!datos) return null;
  const pedidoId = texto(datos.pedidoId);
  if (datos.tipo === 'pedido' && pedidoId) return { pantalla: 'Seguimiento', id: pedidoId };
  if (datos.tipo === 'promocion') {
    const productoId = texto(datos.productoId);
    return productoId ? { pantalla: 'Producto', id: productoId } : { pantalla: 'Inicio' };
  }
  return null;
}

// --- «Va en camino»: la notificación fija ---

export interface PedidoParaAvisar {
  id: string;
  codigo: string;
  estado: string;
  mayorista?: { nombre?: string | null } | null;
}

export interface Presentada {
  identificador: string;
  estado: string | null;
  /** La puso la app (la fija de verdad). La del servidor se puede deslizar: se cambia por esta. */
  fijaLocal: boolean;
}

export const identificadorDelPedido = (id: string) => `pedido-${id}`;

/**
 * Qué hacer con la bandeja según cómo están los pedidos:
 * - un pedido en camino sin su fija → mostrarla (reemplaza a la del servidor, que se puede deslizar);
 * - un «en camino» de un pedido que ya no está en camino → quitarlo (si ya llegó «¡Llegó tu pedido!» ocupa ese lugar
 *   con otro estado y no se toca).
 */
export function planEnCamino(compras: PedidoParaAvisar[], presentadas: Presentada[]): { mostrar: PedidoParaAvisar[]; quitar: string[] } {
  const enBandeja = new Map(presentadas.map((p) => [p.identificador, p]));
  const mostrar: PedidoParaAvisar[] = [];
  const quitar: string[] = [];
  for (const pedido of compras) {
    const id = identificadorDelPedido(pedido.id);
    const actual = enBandeja.get(id);
    if (pedido.estado === 'DESPACHADO') {
      if (!actual?.fijaLocal || actual.estado !== 'DESPACHADO') mostrar.push(pedido);
    } else if (actual?.estado === 'DESPACHADO') {
      quitar.push(id);
    }
  }
  return { mostrar, quitar };
}

export function contenidoEnCamino(p: PedidoParaAvisar): Notifications.NotificationContentInput {
  const vendedor = p.mayorista?.nombre;
  return {
    title: 'Tu pedido va en camino',
    body: `${p.codigo}${vendedor ? ` · ${vendedor}` : ''}. Te avisamos apenas llegue.`,
    data: { tipo: 'pedido', pedidoId: p.id, codigo: p.codigo, estado: 'DESPACHADO', fija: 'local' },
    sticky: true,
    autoDismiss: false,
    priority: Notifications.AndroidNotificationPriority.LOW,
  };
}

async function presentadas(): Promise<Presentada[]> {
  const enBandeja = await Notifications.getPresentedNotificationsAsync();
  return enBandeja.map((n) => {
    const datos = (n.request.content.data ?? {}) as Record<string, unknown>;
    return { identificador: n.request.identifier, estado: texto(datos.estado), fijaLocal: datos.fija === 'local' };
  });
}

/** Pone o quita la fija de «en camino» según los pedidos. Se llama al abrir la app y con cada aviso en tiempo real. */
export async function conciliarEnCamino(compras: PedidoParaAvisar[]): Promise<void> {
  if (Platform.OS !== 'android') return;
  const plan = planEnCamino(compras, await presentadas());
  for (const pedido of plan.mostrar) {
    await Notifications.scheduleNotificationAsync({
      identifier: identificadorDelPedido(pedido.id),
      content: contenidoEnCamino(pedido),
      trigger: { channelId: CANAL_EN_CAMINO },
    });
  }
  for (const id of plan.quitar) await Notifications.dismissNotificationAsync(id);
}
