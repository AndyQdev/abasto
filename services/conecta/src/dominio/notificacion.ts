import type { SobreDeEvento } from './aviso-de-pedido.js';
import { ErrorDeIntegracion } from './llave-de-api.js';

/**
 * Notificaciones push a la app de las tiendas (10/11, pedido del ingeniero):
 * - cada cambio de estado de un pedido le avisa a los teléfonos de esa tienda;
 * - Abasto manda promociones a todos los que tienen la app.
 *
 * Esto es la parte sin infraestructura: qué se dice en cada caso. El envío lo hace un adaptador (Firebase).
 */

export type Plataforma = 'android' | 'ios';

/** Un teléfono con la app y la sesión de una tienda. El token lo da Firebase y cambia de vez en cuando. */
export interface Dispositivo {
  token: string;
  orgId: string;
  usuarioId: string;
  plataforma: Plataforma;
  registradoEn: string;
  actualizadoEn: string;
}

/** Los canales de Android que crea la app: la persona puede silenciar las promociones sin perder sus pedidos. */
export type Canal = 'pedidos' | 'promociones';

export interface Notificacion {
  titulo: string;
  cuerpo: string;
  canal: Canal;
  /** Android: una notificación con la misma etiqueta reemplaza a la anterior (un pedido = una notificación). */
  etiqueta?: string;
  /** Android: no se va al tocarla. El pedido en camino queda a la vista hasta que llega. */
  fija?: boolean;
  /** Lo que la app necesita para abrir la pantalla correcta al tocarla. Solo textos (así lo pide Firebase). */
  datos: Record<string, string>;
}

/** Cómo terminó un envío a un teléfono. `token-invalido`: desinstalaron la app; el teléfono se borra. */
export type ResultadoDeEnvio = 'enviada' | 'token-invalido' | 'fallida';

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

interface Mensaje {
  estado: string;
  titulo: string;
  cuerpo: (codigo: string) => string;
  fija?: boolean;
}

/**
 * Qué se le dice a la tienda en cada paso. Tuteo, corto y con lo que sigue. Los pasos que no le cambian nada a la
 * tienda (el pedido recién creado, el stock reservado, el QR generado) no avisan: ya está mirando la app.
 */
const MENSAJES: Record<string, Mensaje> = {
  'pedido.confirmado': {
    estado: 'CONFIRMADO',
    titulo: 'Confirmaron tu pedido',
    cuerpo: (c) => `${c} ya está en manos del vendedor. Te avisamos cuando salga.`,
  },
  'pedido.rechazado': {
    estado: 'RECHAZADO',
    titulo: 'No pudieron aceptar tu pedido',
    cuerpo: (c) => `${c} fue rechazado. Toca para ver el motivo; no se te cobró nada.`,
  },
  'pedido.en_preparacion': {
    estado: 'EN_PREPARACION',
    titulo: 'Están preparando tu pedido',
    cuerpo: (c) => `${c}: lo están armando en el depósito.`,
  },
  'pedido.despachado': {
    estado: 'DESPACHADO',
    titulo: 'Tu pedido va en camino',
    cuerpo: (c) => `${c} ya salió. Te avisamos cuando llegue.`,
    fija: true,
  },
  'pedido.entregado': {
    estado: 'ENTREGADO',
    titulo: '¡Llegó tu pedido!',
    cuerpo: (c) => `${c} fue entregado. Ya lo sumamos a tu inventario.`,
  },
  'cobro.qr_pagado': {
    estado: 'PAGADO',
    titulo: 'Recibimos tu pago',
    cuerpo: (c) => `${c}: el pago con QR quedó confirmado.`,
  },
  'pedido.reclamo_resuelto': {
    estado: 'RECLAMO_RESUELTO',
    titulo: 'Respondimos tu reclamo',
    cuerpo: (c) => `${c}: toca para ver la respuesta.`,
  },
};

export const EVENTOS_QUE_AVISAN = Object.keys(MENSAJES);

/** La notificación que le toca a la tienda por este evento, o null si este evento no avisa. */
export function notificacionDePedido(sobre: SobreDeEvento): { tiendaId: string; notificacion: Notificacion } | null {
  const mensaje = MENSAJES[sobre.tipo];
  const tiendaId = texto(sobre.datos?.tiendaId);
  const pedidoId = texto(sobre.datos?.pedidoId) ?? texto(sobre.correlationId);
  if (!mensaje || !tiendaId || !pedidoId) return null;
  const codigo = texto(sobre.datos?.codigo);
  return {
    tiendaId,
    notificacion: {
      titulo: mensaje.titulo,
      cuerpo: mensaje.cuerpo(codigo ? `Tu pedido ${codigo}` : 'Tu pedido'),
      canal: 'pedidos',
      etiqueta: `pedido-${pedidoId}`,
      fija: mensaje.fija ?? false,
      datos: { tipo: 'pedido', pedidoId, codigo: codigo ?? '', estado: mensaje.estado, evento: sobre.tipo },
    },
  };
}

// --- Promociones ---

export interface Promocion {
  id: string;
  titulo: string;
  mensaje: string;
  /** Si la promoción es de un producto, tocarla abre su ficha. */
  productoId: string | null;
  creadaPor: string;
  creadaEn: string;
  /** Teléfonos a los que se intentó mandar */
  destinatarios: number;
  enviadas: number;
  fallidas: number;
}

export interface EntradaDePromocion {
  titulo: string;
  mensaje: string;
  productoId?: string | null;
}

/** Android corta el título a una línea y el texto a dos o tres: más largo no se lee. */
export const LARGO_DEL_TITULO = 60;
export const LARGO_DEL_MENSAJE = 180;

export function validarPromocion(entrada: EntradaDePromocion): { titulo: string; mensaje: string; productoId: string | null } {
  const titulo = (entrada.titulo ?? '').trim();
  const mensaje = (entrada.mensaje ?? '').trim();
  const productoId = texto(entrada.productoId) ?? null;
  if (titulo.length < 3) throw new ErrorDeIntegracion('TITULO_REQUERIDO', 'Escribe un título de al menos 3 letras');
  if (titulo.length > LARGO_DEL_TITULO) throw new ErrorDeIntegracion('TITULO_LARGO', `El título va hasta ${LARGO_DEL_TITULO} letras: en el teléfono se corta`);
  if (mensaje.length < 3) throw new ErrorDeIntegracion('MENSAJE_REQUERIDO', 'Escribe el mensaje de la promoción');
  if (mensaje.length > LARGO_DEL_MENSAJE) throw new ErrorDeIntegracion('MENSAJE_LARGO', `El mensaje va hasta ${LARGO_DEL_MENSAJE} letras: en el teléfono se corta`);
  if (productoId && !/^[A-Z]{2}-\d{3,4}$/.test(productoId)) throw new ErrorDeIntegracion('PRODUCTO_INVALIDO', 'El código del producto es como AB-101');
  return { titulo, mensaje, productoId };
}

export function notificacionDePromocion(p: Pick<Promocion, 'id' | 'titulo' | 'mensaje' | 'productoId'>): Notificacion {
  return {
    titulo: p.titulo,
    cuerpo: p.mensaje,
    canal: 'promociones',
    datos: { tipo: 'promocion', promocionId: p.id, productoId: p.productoId ?? '' },
  };
}

export function validarDispositivo(entrada: { token?: unknown; plataforma?: unknown }): { token: string; plataforma: Plataforma } {
  const token = typeof entrada.token === 'string' ? entrada.token.trim() : '';
  // Los tokens de Firebase son largos (~160) y sin espacios; esto frena basura sin atarse a un formato que cambia
  if (token.length < 20 || token.length > 4096 || /\s/.test(token)) throw new ErrorDeIntegracion('TOKEN_INVALIDO', 'El teléfono no mandó un token válido');
  const plataforma = entrada.plataforma === 'ios' ? 'ios' : entrada.plataforma === 'android' ? 'android' : null;
  if (!plataforma) throw new ErrorDeIntegracion('PLATAFORMA_INVALIDA', 'La plataforma es android o ios');
  return { token, plataforma };
}
