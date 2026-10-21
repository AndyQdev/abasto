/**
 * Bandeja «por subir» de Abasto Campo. Cada producto cargado en el puesto queda aquí con su clave,
 * que no cambia entre reintentos: Conecta nunca lo registra dos veces.
 * Misma idea que packages/outbox-offline de Mercado, adaptada a SQLite.
 */
export type EstadoLocal = 'pendiente' | 'subido' | 'rechazado' | 'conflicto';

export interface ProductoCargado {
  nombre: string;
  rubro: string;
  presentacion: 'UNIDAD' | 'CUARTA' | 'DOCENA' | 'CAJA' | 'FARDO';
  unidades: number;
  precioUnitarioCentavos: number;
}

export interface OperacionLocal {
  clave: string;
  datos: ProductoCargado;
  creadaEn: string;
  estado: EstadoLocal;
  intentos: number;
  error?: string;
}

export interface Almacen {
  guardar(op: OperacionLocal): Promise<void>;
  todas(): Promise<OperacionLocal[]>;
}

export interface ResultadoRemoto {
  clave: string;
  estado: 'aplicada' | 'repetida' | 'conflicto' | 'rechazada';
  error?: string;
}

export type Enviar = (ops: OperacionLocal[]) => Promise<ResultadoRemoto[]>;

export class BandejaCampo {
  private readonly almacen: Almacen;
  private readonly enviar: Enviar;
  private readonly generarClave: () => string;

  constructor(almacen: Almacen, enviar: Enviar, generarClave: () => string) {
    this.almacen = almacen;
    this.enviar = enviar;
    this.generarClave = generarClave;
  }

  async agregar(datos: ProductoCargado, ahora = new Date()): Promise<OperacionLocal> {
    const op: OperacionLocal = {
      clave: this.generarClave(),
      datos,
      creadaEn: ahora.toISOString(),
      estado: 'pendiente',
      intentos: 0,
    };
    await this.almacen.guardar(op);
    return op;
  }

  async porSubir(): Promise<OperacionLocal[]> {
    return (await this.almacen.todas()).filter((o) => o.estado === 'pendiente').sort((a, b) => a.creadaEn.localeCompare(b.creadaEn));
  }

  /** Sube todo lo pendiente. Sin señal no pierde nada: suma un intento y espera al próximo. */
  async subir(): Promise<{ subidos: number; pendientes: number }> {
    const pendientes = await this.porSubir();
    if (!pendientes.length) return { subidos: 0, pendientes: 0 };
    let resultados: ResultadoRemoto[];
    try {
      resultados = await this.enviar(pendientes);
    } catch {
      for (const op of pendientes) await this.almacen.guardar({ ...op, intentos: op.intentos + 1 });
      return { subidos: 0, pendientes: pendientes.length };
    }
    let subidos = 0;
    for (const op of pendientes) {
      const r = resultados.find((x) => x.clave === op.clave);
      if (!r) continue;
      const estado: EstadoLocal = r.estado === 'aplicada' || r.estado === 'repetida' ? 'subido' : r.estado === 'conflicto' ? 'conflicto' : 'rechazado';
      if (estado === 'subido') subidos++;
      await this.almacen.guardar({ ...op, intentos: op.intentos + 1, estado, error: r.error });
    }
    return { subidos, pendientes: pendientes.length - subidos };
  }
}

/** Manda el lote a Conecta como operaciones `producto.cargar`. */
export function enviarAConecta(url: string, token: () => Promise<string>): Enviar {
  return async (ops) => {
    const r = await fetch(`${url}/v1/sincronizacion/lotes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${await token()}` },
      body: JSON.stringify({
        operaciones: ops.map((o) => ({ clave: o.clave, tipo: 'producto.cargar', datos: o.datos, creadaEn: o.creadaEn })),
      }),
    });
    if (!r.ok) throw new Error(`Conecta respondió ${r.status}`);
    return ((await r.json()) as { resultados: ResultadoRemoto[] }).resultados;
  };
}
