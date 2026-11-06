import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import amqp from 'amqplib';
import { Webhooks } from '../../aplicacion/webhooks.js';
import type { SobreDeEvento } from '../../dominio/aviso-de-pedido.js';

export const COLA_DE_WEBHOOKS = 'conecta.webhooks';
const EVENTOS = 'abasto.eventos';
const ARGUMENTOS = { 'x-queue-type': 'quorum', 'x-dead-letter-exchange': 'abasto.dlx', 'x-dead-letter-routing-key': COLA_DE_WEBHOOKS, 'x-delivery-limit': 5 };
const URL = () => process.env.RABBITMQ_URL ?? 'amqp://abasto:abasto@localhost:5680';
const CADA_CUANTO_REVISAR_MS = 30_000;

type Conexion = Awaited<ReturnType<typeof amqp.connect>>;

/**
 * CU-10: a diferencia del tiempo real, los webhooks no se pueden perder. Cola durable: el evento se confirma recién
 * cuando su entrega quedó anotada, y un revisor reintenta lo que falló cada 30 s.
 */
@Injectable()
export class EscuchaDeWebhooks implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(EscuchaDeWebhooks.name);
  private conexion?: Conexion;
  private revisor?: NodeJS.Timeout;
  private apagando = false;

  constructor(@Inject(Webhooks) private readonly webhooks: Webhooks) {}

  onModuleInit() {
    if (process.env.MENSAJERIA === 'apagada') return;
    void this.conectar();
    this.revisor = setInterval(() => void this.webhooks.revisarPendientes().catch((e: Error) => this.log.warn(`No se pudo revisar: ${e.message}`)), CADA_CUANTO_REVISAR_MS);
    this.revisor.unref();
  }

  async onModuleDestroy() {
    this.apagando = true;
    clearInterval(this.revisor);
    await this.conexion?.close().catch(() => undefined);
  }

  private async conectar() {
    try {
      const conexion = await amqp.connect(URL());
      this.conexion = conexion;
      conexion.on('close', () => !this.apagando && setTimeout(() => void this.conectar(), 5000));
      conexion.on('error', () => undefined);
      const canal = await conexion.createChannel();
      // Declarar es idempotente si los argumentos son los mismos: sirve si RabbitMQ arrancó con definiciones viejas
      await canal.assertQueue(`${COLA_DE_WEBHOOKS}.dlq`, { durable: true });
      await canal.bindQueue(`${COLA_DE_WEBHOOKS}.dlq`, 'abasto.dlx', COLA_DE_WEBHOOKS);
      await canal.assertQueue(COLA_DE_WEBHOOKS, { durable: true, arguments: ARGUMENTOS });
      await canal.bindQueue(COLA_DE_WEBHOOKS, EVENTOS, 'pedido.*');
      await canal.bindQueue(COLA_DE_WEBHOOKS, EVENTOS, 'cobro.*');
      await canal.prefetch(10);
      await canal.consume(COLA_DE_WEBHOOKS, (mensaje) => {
        if (!mensaje) return;
        let sobre: SobreDeEvento;
        try {
          sobre = JSON.parse(mensaje.content.toString()) as SobreDeEvento;
        } catch {
          this.log.warn('Llegó un evento que no se pudo leer');
          canal.nack(mensaje, false, false);
          return;
        }
        void this.webhooks
          .anotar(sobre)
          .then((nuevas) => {
            canal.ack(mensaje);
            // El primer intento no frena la cola: si tarda o falla, ya quedó anotado
            for (const entrega of nuevas) void this.webhooks.intentar(entrega).catch((e: Error) => this.log.warn(`No se pudo entregar: ${e.message}`));
          })
          .catch((e: Error) => {
            this.log.error(`No se pudo anotar el aviso: ${e.message}`);
            canal.nack(mensaje, false, true);
          });
      });
      this.log.log(`Webhooks escuchando la cola ${COLA_DE_WEBHOOKS}`);
    } catch (e) {
      this.log.warn(`RabbitMQ no responde (${(e as Error).message}); reintento en 5 s`);
      if (!this.apagando) setTimeout(() => void this.conectar(), 5000);
    }
  }
}
