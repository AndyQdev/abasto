import { Injectable, Logger } from '@nestjs/common';
import type { Propuesta } from '../../agentes/dominio/agente.js';
import type { EjecutorDeAcciones } from '../../agentes/puertos.js';

/**
 * Pasa la acción aprobada a un flujo de n8n (por ejemplo, el que manda el WhatsApp).
 * Sin N8N_WEBHOOK_ACCIONES no envía nada y lo dice: así se puede trabajar sin n8n prendido.
 */
@Injectable()
export class EjecutorN8n implements EjecutorDeAcciones {
  private readonly log = new Logger(EjecutorN8n.name);
  private readonly url = process.env.N8N_WEBHOOK_ACCIONES;

  async ejecutar(propuesta: Propuesta) {
    if (!this.url) {
      this.log.warn(`n8n no está configurado; la acción ${propuesta.accion.tipo} quedó aprobada sin enviarse`);
      return { enviado: false, detalle: 'n8n no está configurado (N8N_WEBHOOK_ACCIONES)' };
    }
    const r = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': propuesta.id },
      body: JSON.stringify(propuesta),
    });
    return { enviado: r.ok, detalle: `n8n respondió ${r.status}` };
  }
}
