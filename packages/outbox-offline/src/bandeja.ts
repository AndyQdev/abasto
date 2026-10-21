/**
 * Bandeja offline de Abasto: lo que la tienda hace sin señal se guarda aquí y se manda a Conecta
 * cuando vuelve la red. Cada operación recibe su clave UNA vez, al crearse; los reintentos usan
 * la misma clave, por eso Conecta nunca registra dos veces lo mismo.
 */
export type TipoDeOperacion = 'pedido.crear' | 'producto.cargar';
export type EstadoLocal = 'pendiente' | 'aplicada' | 'rechazada' | 'conflicto';

export interface OperacionLocal {
  clave: string;
  tipo: TipoDeOperacion;
  datos: Record<string, unknown>;
  creadaEn: string;
  estado: EstadoLocal;
  intentos: number;
  respuesta?: unknown;
  error?: string;
}

export interface ResultadoRemoto {
  clave: string;
  estado: 'aplicada' | 'repetida' | 'conflicto' | 'rechazada';
  respuesta?: unknown;
  error?: string;
}

/** Dónde se guardan las operaciones: IndexedDB en el navegador, memoria en las pruebas. */
export interface Almacen {
  guardar(operacion: OperacionLocal): Promise<void>;
  todas(): Promise<OperacionLocal[]>;
}

export type Enviar = (operaciones: OperacionLocal[]) => Promise<ResultadoRemoto[]>;

export interface OpcionesDeBandeja {
  generarClave?: () => string;
  ahora?: () => Date;
  /** Máximo de operaciones por lote (Conecta acepta 100). */
  tamanoDeLote?: number;
}

export class Bandeja {
  private sincronizando: Promise<void> | null = null;
  private readonly oyentes = new Set<(ops: OperacionLocal[]) => void>();
  private readonly almacen: Almacen;
  private readonly enviar: Enviar;
  private readonly opciones: OpcionesDeBandeja;

  constructor(almacen: Almacen, enviar: Enviar, opciones: OpcionesDeBandeja = {}) {
    this.almacen = almacen;
    this.enviar = enviar;
    this.opciones = opciones;
  }

  async agregar(tipo: TipoDeOperacion, datos: Record<string, unknown>): Promise<OperacionLocal> {
    const operacion: OperacionLocal = {
      clave: (this.opciones.generarClave ?? (() => crypto.randomUUID()))(),
      tipo,
      datos,
      creadaEn: (this.opciones.ahora ?? (() => new Date()))().toISOString(),
      estado: 'pendiente',
      intentos: 0,
    };
    await this.almacen.guardar(operacion);
    await this.avisar();
    return operacion;
  }

  async pendientes(): Promise<OperacionLocal[]> {
    return (await this.almacen.todas())
      .filter((o) => o.estado === 'pendiente')
      .sort((a, b) => a.creadaEn.localeCompare(b.creadaEn));
  }

  /** Manda lo pendiente en orden. Si ya hay una sincronización en curso, espera esa en vez de empezar otra. */
  sincronizar(): Promise<void> {
    this.sincronizando ??= this.enviarPendientes().finally(() => {
      this.sincronizando = null;
    });
    return this.sincronizando;
  }

  alCambiar(oyente: (ops: OperacionLocal[]) => void): () => void {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  }

  private async enviarPendientes(): Promise<void> {
    const pendientes = await this.pendientes();
    const tamano = this.opciones.tamanoDeLote ?? 100;
    for (let i = 0; i < pendientes.length; i += tamano) {
      const lote = pendientes.slice(i, i + tamano);
      let resultados: ResultadoRemoto[];
      try {
        resultados = await this.enviar(lote);
      } catch {
        // Sin red o Conecta caído: todo queda pendiente con la MISMA clave para el próximo intento
        for (const op of lote) await this.almacen.guardar({ ...op, intentos: op.intentos + 1 });
        await this.avisar();
        return;
      }
      for (const op of lote) {
        const r = resultados.find((x) => x.clave === op.clave);
        if (!r) continue;
        await this.almacen.guardar({
          ...op,
          intentos: op.intentos + 1,
          estado: r.estado === 'repetida' ? 'aplicada' : r.estado,
          respuesta: r.respuesta,
          error: r.error,
        });
      }
    }
    await this.avisar();
  }

  private async avisar() {
    const todas = await this.almacen.todas();
    for (const oyente of this.oyentes) oyente(todas);
  }
}

export class AlmacenEnMemoria implements Almacen {
  private readonly operaciones = new Map<string, OperacionLocal>();

  async guardar(operacion: OperacionLocal) {
    this.operaciones.set(operacion.clave, structuredClone(operacion));
  }

  async todas() {
    return [...this.operaciones.values()].map((o) => structuredClone(o));
  }
}

/** Envía un lote a Conecta (POST /v1/sincronizacion/lotes) con el token de la sesión. */
export function enviarAConecta(url: string, token: () => Promise<string>): Enviar {
  return async (operaciones) => {
    const respuesta = await fetch(`${url}/v1/sincronizacion/lotes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${await token()}` },
      body: JSON.stringify({
        operaciones: operaciones.map(({ clave, tipo, datos, creadaEn }) => ({ clave, tipo, datos, creadaEn })),
      }),
    });
    if (!respuesta.ok) throw new Error(`Conecta respondió ${respuesta.status}`);
    return ((await respuesta.json()) as { resultados: ResultadoRemoto[] }).resultados;
  };
}
