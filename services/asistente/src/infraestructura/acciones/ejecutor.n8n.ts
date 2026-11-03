import { Injectable, Logger } from '@nestjs/common';
import type { Propuesta } from '../../agentes/dominio/agente.js';
import type { EjecutorDeAcciones, ResultadoDeAccion } from '../../agentes/puertos.js';

/**
 * Pasa la acción aprobada al flujo «Acciones de los agentes» de n8n (`infra/n8n/flujos/acciones-de-agentes.json`):
 * pausa el producto en Catálogo, deja listo el WhatsApp de cobranza o el pedido al proveedor.
 * Manda la sesión de quien aprobó para que n8n actúe a su nombre. Sin N8N_WEBHOOK_ACCIONES, o con n8n apagado,
 * la propuesta queda aprobada y la respuesta dice por qué no salió.
 */
@Injectable()
export class EjecutorN8n implements EjecutorDeAcciones {
  private readonly log = new Logger(EjecutorN8n.name);

  private readonly url = process.env.N8N_WEBHOOK_ACCIONES;

  async ejecutar(propuesta: Propuesta, sesion?: string): Promise<ResultadoDeAccion> {
    if (!this.url) {
      this.log.warn(`n8n no está configurado; la acción ${propuesta.accion.tipo} quedó aprobada sin enviarse`);
      return { enviado: false, detalle: 'Quedó aprobada, pero n8n no está configurado (N8N_WEBHOOK_ACCIONES)' };
    }
    try {
      const r = await fetch(this.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': propuesta.id,
          ...(sesion ? { authorization: `Bearer ${sesion}` } : {}),
        },
        body: JSON.stringify(propuesta),
        signal: AbortSignal.timeout(15_000),
      });
      const cuerpo = (await r.json().catch(() => ({}))) as Partial<ResultadoDeAccion>;
      if (!r.ok) return { enviado: false, detalle: cuerpo.detalle ?? `n8n respondió ${r.status}` };
      return {
        enviado: cuerpo.enviado ?? true,
        detalle: cuerpo.detalle ?? 'n8n recibió la acción',
        ...(cuerpo.enlace ? { enlace: cuerpo.enlace } : {}),
      };
    } catch (e) {
      this.log.warn(`n8n no respondió: ${(e as Error).message}`);
      return { enviado: false, detalle: 'Quedó aprobada, pero n8n no respondió (¿está prendido? pnpm n8n)' };
    }
  }
}
