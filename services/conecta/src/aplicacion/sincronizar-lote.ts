import {
  huellaDe,
  TIPOS_DE_OPERACION,
  type Operacion,
  type ResultadoDeOperacion,
} from '../dominio/operacion.js';
import { entradaDe, type ContextoDeEntrada } from '../dominio/bitacora.js';
import type { Bitacora, DestinoDeOperaciones, RegistroDeIdempotencia } from '../dominio/puertos.js';

/**
 * Aplica, en orden, las operaciones que juntó la bandeja offline.
 * Cada una se aplica una sola vez aunque el teléfono mande el lote varias veces.
 */
export class SincronizarLote {
  constructor(
    private readonly registro: RegistroDeIdempotencia,
    private readonly destino: DestinoDeOperaciones,
    private readonly bitacora?: Bitacora,
    private readonly reloj: () => Date = () => new Date(),
  ) {}

  async ejecutar(operaciones: Operacion[], token: string, contexto?: ContextoDeEntrada): Promise<ResultadoDeOperacion[]> {
    const resultados: ResultadoDeOperacion[] = [];
    for (const operacion of operaciones) {
      resultados.push(await this.aplicarUna(operacion, token, contexto));
    }
    return resultados;
  }

  /** Aplica y, si hay bitácora, anota lo que pasó. Anotar nunca hace fallar la operación. */
  async aplicarUna(operacion: Operacion, token: string, contexto?: ContextoDeEntrada): Promise<ResultadoDeOperacion> {
    const resultado = await this.aplicar(operacion, token, contexto?.tiendaId ?? null);
    if (this.bitacora && contexto) {
      const entrada = entradaDe(operacion, resultado, contexto, this.reloj());
      if (entrada) await this.bitacora.anotar(entrada).catch(() => undefined);
    }
    return resultado;
  }

  private async aplicar(operacion: Operacion, token: string, empresa: string | null): Promise<ResultadoDeOperacion> {
    const { clave } = operacion;
    // Cada empresa tiene sus claves: si otra usa el mismo UUID, nunca recibe la respuesta de esta
    const claveDelRegistro = empresa ? `${empresa}|${clave}` : clave;
    if (!TIPOS_DE_OPERACION.includes(operacion.tipo)) {
      return { clave, estado: 'rechazada', error: `Tipo de operación desconocido: ${operacion.tipo}` };
    }

    const reserva = await this.registro.reservar(claveDelRegistro, huellaDe(operacion));
    switch (reserva.tipo) {
      case 'repetida':
        return { clave, estado: 'repetida', respuesta: reserva.respuesta };
      case 'conflicto':
        return { clave, estado: 'conflicto', error: 'La misma clave llegó con otro contenido' };
      case 'en_curso':
        return { clave, estado: 'rechazada', error: 'La operación se está aplicando; reintenta en unos segundos' };
    }

    try {
      const respuesta = await this.destino.aplicar(operacion, token);
      await this.registro.completar(claveDelRegistro, respuesta);
      return { clave, estado: 'aplicada', respuesta };
    } catch (e) {
      await this.registro.liberar(claveDelRegistro);
      return { clave, estado: 'rechazada', error: e instanceof Error ? e.message : String(e) };
    }
  }
}
