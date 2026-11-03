import { useEffect, useRef } from 'react';
import { URLS } from './config';
import { useEstado } from './estado';
import { tokenActual } from './sesion';

/**
 * Los pedidos en tiempo real (02/11): en vez de preguntar cada pocos segundos, la app abre un WebSocket con Conecta
 * (`/v1/tiempo-real`, el mismo puerto 8084) y Conecta le avisa cuando cambia un pedido suyo. El aviso solo dice qué
 * pedido cambió; la pantalla lo vuelve a pedir por GraphQL con la sesión.
 *
 * - Una sola conexión para toda la app, abierta mientras alguna pantalla escucha (Compras, Seguimiento).
 * - Se presenta con `{"tipo":"hola","token":…}` (el token nunca va en la URL).
 * - Si se corta, vuelve a intentar cada vez más espaciado (1 s, 2 s, 4 s… hasta 30 s); sin señal no intenta.
 * - Al volver a conectarse avisa `alReconectar`, para que la pantalla pida todo una vez (por si se perdió algo).
 * - Cuando el token vence, Conecta cierra con 4001 y se vuelve a entrar enseguida con uno nuevo.
 */
export interface AvisoDePedido {
  tipo: string;
  pedidoId: string;
  codigo: string | null;
  ocurridoEn: string | null;
}

interface Oyente {
  alAviso: (a: AvisoDePedido) => void;
  alReconectar?: () => void;
}

/** Lo que usa el canal del WebSocket del teléfono (así se prueba con uno falso) */
export interface SocketDelTelefono {
  onopen: (() => void) | null;
  onmessage: ((m: { data: unknown }) => void) | null;
  onclose: ((e: { code: number }) => void) | null;
  onerror: (() => void) | null;
  send(texto: string): void;
  close(): void;
}

export interface DependenciasDelCanal {
  crear: (url: string) => SocketDelTelefono;
  token: () => Promise<string | null>;
  url: string;
  programar?: (f: () => void, ms: number) => ReturnType<typeof setTimeout>;
  cancelar?: (t: ReturnType<typeof setTimeout>) => void;
}

export const urlDelCanal = (conecta = URLS.conecta) => `${conecta.replace(/^http/, 'ws').replace(/\/$/, '')}/v1/tiempo-real`;

const MAXIMO_MS = 30_000;
const SESION_VENCIDA = 4001;

export class CanalEnVivo {
  private readonly oyentes = new Set<Oyente>();
  private socket: SocketDelTelefono | null = null;
  private conectando = false;
  private enLinea = true;
  private intentos = 0;
  private yaEstuvoListo = false;
  private reintento: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly d: DependenciasDelCanal) {}

  suscribir(oyente: Oyente): () => void {
    this.oyentes.add(oyente);
    void this.conectar();
    return () => {
      this.oyentes.delete(oyente);
      if (!this.oyentes.size) this.cerrar();
    };
  }

  /** Sin señal se corta y no se intenta; al volver, se conecta (y quien escucha vuelve a pedir todo) */
  ponerEnLinea(enLinea: boolean) {
    if (this.enLinea === enLinea) return;
    this.enLinea = enLinea;
    if (!enLinea) this.cerrar();
    else void this.conectar();
  }

  get conectado() {
    return this.socket !== null && this.yaEstuvoListo;
  }

  private cerrar() {
    this.limpiarReintento();
    const s = this.socket;
    this.socket = null;
    if (s) {
      s.onclose = null;
      s.close();
    }
  }

  private limpiarReintento() {
    if (this.reintento) (this.d.cancelar ?? clearTimeout)(this.reintento);
    this.reintento = null;
  }

  private programarReintento(ms?: number) {
    if (!this.enLinea || !this.oyentes.size || this.reintento) return;
    const espera = ms ?? Math.min(MAXIMO_MS, 1000 * 2 ** this.intentos);
    this.intentos += 1;
    this.reintento = (this.d.programar ?? setTimeout)(() => {
      this.reintento = null;
      void this.conectar();
    }, espera);
  }

  private async conectar() {
    if (this.socket || this.conectando || !this.enLinea || !this.oyentes.size) return;
    this.conectando = true;
    let token: string | null = null;
    try {
      token = await this.d.token();
    } catch {
      token = null;
    }
    this.conectando = false;
    if (this.socket || !this.enLinea || !this.oyentes.size) return;
    if (!token) return this.programarReintento();

    const s = this.d.crear(this.d.url);
    this.socket = s;
    s.onopen = () => s.send(JSON.stringify({ tipo: 'hola', token }));
    s.onerror = () => undefined; // el cierre llega después por onclose
    s.onmessage = (m) => {
      let datos: { tipo?: string; pedidoId?: string };
      try {
        datos = JSON.parse(String(m.data)) as typeof datos;
      } catch {
        return;
      }
      if (datos.tipo === 'listo') {
        const volvio = this.yaEstuvoListo;
        this.yaEstuvoListo = true;
        this.intentos = 0;
        if (volvio) this.oyentes.forEach((o) => o.alReconectar?.());
        return;
      }
      if (typeof datos.pedidoId === 'string') this.oyentes.forEach((o) => o.alAviso(datos as AvisoDePedido));
    };
    s.onclose = (e) => {
      if (this.socket !== s) return;
      this.socket = null;
      // Token vencido: se entra enseguida con uno nuevo; cualquier otro corte, con espera creciente
      this.programarReintento(e.code === SESION_VENCIDA ? 0 : undefined);
    };
  }
}

/** La conexión de la app (una sola) */
export const canalEnVivo = new CanalEnVivo({
  crear: (url) => new WebSocket(url) as unknown as SocketDelTelefono,
  token: tokenActual,
  url: urlDelCanal(),
});

/**
 * Escucha los avisos de los pedidos mientras la pantalla está montada. `alAviso` recibe cada cambio; `alReconectar`
 * se llama al volver la conexión (para pedir todo una vez). Las funciones pueden cambiar en cada render.
 */
export function useAvisosDePedidos(alAviso: (a: AvisoDePedido) => void, alReconectar?: () => void, canal: CanalEnVivo = canalEnVivo) {
  const { enLinea } = useEstado();
  const aviso = useRef(alAviso);
  const reconectar = useRef(alReconectar);
  aviso.current = alAviso;
  reconectar.current = alReconectar;

  useEffect(() => {
    canal.ponerEnLinea(enLinea);
  }, [canal, enLinea]);

  useEffect(
    () =>
      canal.suscribir({
        alAviso: (a) => aviso.current(a),
        alReconectar: () => reconectar.current?.(),
      }),
    [canal],
  );
}

/**
 * Una función async que nunca corre dos veces a la vez: si la llaman mientras corre (llegan varios avisos juntos),
 * corre una sola vez más al terminar. Así cinco avisos seguidos son a lo sumo dos pedidos al servidor.
 */
export function unaALaVez(f: () => Promise<void>) {
  let corriendo = false;
  let otraVez = false;
  const correr = async (): Promise<void> => {
    if (corriendo) {
      otraVez = true;
      return;
    }
    corriendo = true;
    try {
      await f();
    } finally {
      corriendo = false;
      if (otraVez) {
        otraVez = false;
        void correr();
      }
    }
  };
  return correr;
}
