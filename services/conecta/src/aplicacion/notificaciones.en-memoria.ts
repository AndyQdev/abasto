import type { Dispositivo, Notificacion, Promocion, ResultadoDeEnvio } from '../dominio/notificacion.js';
import type { EnviadorDeNotificaciones, RegistroDeAvisos, RegistroDeDispositivos, RegistroDePromociones } from '../dominio/puertos.js';

/** Versiones en memoria para las pruebas (y para correr sin DynamoDB). */
export class DispositivosEnMemoria implements RegistroDeDispositivos {
  readonly filas = new Map<string, Dispositivo>();

  async guardar(d: Dispositivo) {
    this.filas.set(d.token, { ...d });
  }

  async porToken(token: string) {
    return this.filas.get(token) ?? null;
  }

  async quitar(token: string) {
    this.filas.delete(token);
  }

  async deOrganizacion(orgId: string) {
    return [...this.filas.values()].filter((d) => d.orgId === orgId);
  }

  async todos() {
    return [...this.filas.values()];
  }
}

export class PromocionesEnMemoria implements RegistroDePromociones {
  readonly filas = new Map<string, Promocion>();

  async crearSiNoExiste(p: Promocion) {
    if (this.filas.has(p.id)) return false;
    this.filas.set(p.id, { ...p });
    return true;
  }

  async porId(id: string) {
    return this.filas.get(id) ?? null;
  }

  async actualizar(p: Promocion) {
    this.filas.set(p.id, { ...p });
  }

  async ultimas(cuantas: number) {
    return [...this.filas.values()].sort((a, b) => b.creadaEn.localeCompare(a.creadaEn)).slice(0, cuantas);
  }
}

export class AvisosEnMemoria implements RegistroDeAvisos {
  private readonly vistos = new Set<string>();

  async primeraVez(eventoId: string) {
    if (this.vistos.has(eventoId)) return false;
    this.vistos.add(eventoId);
    return true;
  }
}

/** Anota lo que se mandó; `respuestas` permite simular que Firebase rechaza un token. */
export class EnviadorDePrueba implements EnviadorDeNotificaciones {
  readonly modo = 'prueba' as const;
  readonly enviadas: { token: string; notificacion: Notificacion }[] = [];
  readonly respuestas = new Map<string, ResultadoDeEnvio>();

  async enviar(token: string, notificacion: Notificacion) {
    this.enviadas.push({ token, notificacion });
    return this.respuestas.get(token) ?? 'enviada';
  }
}
