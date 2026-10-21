import type { RegistroDeIdempotencia, Reserva } from '../dominio/puertos.js';

/** Registro en memoria para pruebas. Es atómico porque Node ejecuta cada reservar() sin interrupciones. */
export class RegistroEnMemoria implements RegistroDeIdempotencia {
  private readonly claves = new Map<string, { huella: string; respuesta?: unknown; completa: boolean }>();

  async reservar(clave: string, huella: string): Promise<Reserva> {
    const actual = this.claves.get(clave);
    if (!actual) {
      this.claves.set(clave, { huella, completa: false });
      return { tipo: 'nueva' };
    }
    if (actual.huella !== huella) return { tipo: 'conflicto' };
    return actual.completa ? { tipo: 'repetida', respuesta: actual.respuesta } : { tipo: 'en_curso' };
  }

  async completar(clave: string, respuesta: unknown) {
    const actual = this.claves.get(clave);
    if (actual) this.claves.set(clave, { ...actual, respuesta, completa: true });
  }

  async liberar(clave: string) {
    this.claves.delete(clave);
  }
}
