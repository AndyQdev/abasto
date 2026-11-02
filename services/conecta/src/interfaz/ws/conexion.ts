import type { CanalDeTiendas } from '../../aplicacion/canal-de-tiendas.js';
import type { Usuario } from '../../infraestructura/seguridad/autenticacion.guard.js';

/**
 * El protocolo del canal en tiempo real (`/v1/tiempo-real`), sin depender de la librería de WebSocket:
 * 1. La app abre la conexión y manda `{"tipo":"hola","token":"<token de Keycloak>"}` (el token nunca va en la URL,
 *    para que no quede en ningún registro).
 * 2. Si el token vale y es de una tienda, Conecta responde `{"tipo":"listo"}` y desde ahí le manda
 *    `{"tipo":"pedido.confirmado","pedidoId":"…","codigo":"A-1207","ocurridoEn":"…"}` cada vez que cambia un pedido suyo.
 * 3. Cuando el token vence, Conecta cierra con 4001 y la app vuelve a entrar con uno nuevo.
 * Cierres: 4401 sin sesión o sesión inválida, 4001 sesión vencida, 4400 mensaje que no se entiende.
 */
export interface SocketMinimo {
  send(texto: string): void;
  close(codigo: number, motivo: string): void;
  on(evento: 'message', f: (datos: unknown) => void): void;
  on(evento: 'close', f: () => void): void;
}

export const CIERRE = { SIN_SESION: 4401, VENCIDA: 4001, NO_SE_ENTIENDE: 4400 } as const;

export interface OpcionesDeConexion {
  verificar: (token: string) => Promise<Usuario>;
  canal: CanalDeTiendas;
  /** Cuánto se espera el «hola» antes de cerrar */
  esperaMs?: number;
  ahora?: () => number;
}

export function atenderConexion(socket: SocketMinimo, o: OpcionesDeConexion) {
  const ahora = o.ahora ?? Date.now;
  let desuscribir: (() => void) | null = null;
  let cerrada = false;
  const relojes: ReturnType<typeof setTimeout>[] = [];
  const cerrar = (codigo: number, motivo: string) => {
    if (cerrada) return;
    cerrada = true;
    socket.close(codigo, motivo);
  };

  relojes.push(setTimeout(() => !desuscribir && cerrar(CIERRE.SIN_SESION, 'Falta la sesión'), o.esperaMs ?? 10_000));

  socket.on('message', (datos) => {
    if (desuscribir || cerrada) return; // después del «hola» la app no manda nada más
    let mensaje: { tipo?: unknown; token?: unknown };
    try {
      mensaje = JSON.parse(String(datos)) as typeof mensaje;
    } catch {
      return cerrar(CIERRE.NO_SE_ENTIENDE, 'Mensaje inválido');
    }
    if (mensaje.tipo !== 'hola' || typeof mensaje.token !== 'string' || !mensaje.token) return cerrar(CIERRE.SIN_SESION, 'Falta la sesión');
    o.verificar(mensaje.token).then(
      (usuario) => {
        if (cerrada) return;
        if (!usuario.orgId) return cerrar(CIERRE.SIN_SESION, 'La cuenta no tiene tienda');
        desuscribir = o.canal.suscribir(usuario.orgId, (aviso) => socket.send(JSON.stringify(aviso)));
        socket.send(JSON.stringify({ tipo: 'listo' }));
        if (usuario.venceEn) relojes.push(setTimeout(() => cerrar(CIERRE.VENCIDA, 'La sesión venció'), Math.max(0, usuario.venceEn - ahora())));
      },
      () => cerrar(CIERRE.SIN_SESION, 'La sesión no es válida o venció'),
    );
  });

  socket.on('close', () => {
    cerrada = true;
    relojes.forEach(clearTimeout);
    desuscribir?.();
    desuscribir = null;
  });
}
