import {
  huellaDe,
  TIPOS_DE_OPERACION,
  type Operacion,
  type ResultadoDeOperacion,
} from '../dominio/operacion.js';
import type { DestinoDeOperaciones, RegistroDeIdempotencia } from '../dominio/puertos.js';

/**
 * Aplica, en orden, las operaciones que juntó la bandeja offline.
 * Cada una se aplica una sola vez aunque el teléfono mande el lote varias veces.
 */
export class SincronizarLote {
  constructor(
    private readonly registro: RegistroDeIdempotencia,
    private readonly destino: DestinoDeOperaciones,
  ) {}

  async ejecutar(operaciones: Operacion[], token: string): Promise<ResultadoDeOperacion[]> {
    const resultados: ResultadoDeOperacion[] = [];
    for (const operacion of operaciones) {
      resultados.push(await this.aplicarUna(operacion, token));
    }
    return resultados;
  }

  async aplicarUna(operacion: Operacion, token: string): Promise<ResultadoDeOperacion> {
    const { clave } = operacion;
    if (!TIPOS_DE_OPERACION.includes(operacion.tipo)) {
      return { clave, estado: 'rechazada', error: `Tipo de operación desconocido: ${operacion.tipo}` };
    }

    const reserva = await this.registro.reservar(clave, huellaDe(operacion));
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
      await this.registro.completar(clave, respuesta);
      return { clave, estado: 'aplicada', respuesta };
    } catch (e) {
      await this.registro.liberar(clave);
      return { clave, estado: 'rechazada', error: e instanceof Error ? e.message : String(e) };
    }
  }
}
