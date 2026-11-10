import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import amqp from 'amqplib';
import { Notificaciones } from '../../aplicacion/notificaciones.js';
import type { SobreDeEvento } from '../../dominio/aviso-de-pedido.js';

export const COLA_DE_NOTIFICACIONES = 'conecta.notificaciones';
const EVENTOS = 'abasto.eventos';
const ARGUMENTOS = {
  'x-queue-type': 'quorum',
  'x-dead-letter-exchange': 'abasto.dlx',
  'x-dead-letter-routing-key': COLA_DE_NOTIFICACIONES,
  'x-delivery-limit': 5,
};
const URL = () => process.env.RABBITMQ_URL ?? 'amqp://abasto:abasto@localhost:5680';

type Conexion = Awaited<ReturnType<typeof amqp.connect>>;

/**
 * Notificaciones push de los pedidos. Cola durable (no la exclusiva del tiempo real): si Conecta se reinicia, el
 * «va en camino» igual le llega a la tienda. El evento se confirma cuando ya se mandó; si falla, vuelve a la cola
 * (hasta 5 veces) y el registro de avisos evita que un reintento suene dos veces en el teléfono.
 */
@Injectable()
export class EscuchaDeNotificaciones implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(EscuchaDeNotificaciones.name);
  private conexion?: Conexion;
  private apagando = false;

  constructor(@Inject(Notificaciones) private readonly notificaciones: Notificaciones) {}

  onModuleInit() {
    if (process.env.MENSAJERIA === 'apagada') return;
    void this.conectar();
  }

  async onModuleDestroy() {
    this.apagando = true;
    await this.conexion?.close().catch(() => undefined);
  }

  private async conectar() {
    try {
      const conexion = await amqp.connect(URL());
      this.conexion = conexion;
      conexion.on('close', () => !this.apagando && setTimeout(() => void this.conectar(), 5000));
      conexion.on('error', () => undefined);
      const canal = await conexion.createChannel();
      await canal.assertQueue(`${COLA_DE_NOTIFICACIONES}.dlq`, { durable: true });
      await canal.bindQueue(`${COLA_DE_NOTIFICACIONES}.dlq`, 'abasto.dlx', COLA_DE_NOTIFICACIONES);
      await canal.assertQueue(COLA_DE_NOTIFICACIONES, { durable: true, arguments: ARGUMENTOS });
      await canal.bindQueue(COLA_DE_NOTIFICACIONES, EVENTOS, 'pedido.*');
      await canal.bindQueue(COLA_DE_NOTIFICACIONES, EVENTOS, 'cobro.*');
      await canal.prefetch(10);
      await canal.consume(COLA_DE_NOTIFICACIONES, (mensaje) => {
        if (!mensaje) return;
        let sobre: SobreDeEvento;
        try {
          sobre = JSON.parse(mensaje.content.toString()) as SobreDeEvento;
        } catch {
          this.log.warn('Llegó un evento que no se pudo leer');
          canal.nack(mensaje, false, false);
          return;
        }
        void this.notificaciones
          .avisarEvento(sobre)
          .then(() => canal.ack(mensaje))
          .catch((e: Error) => {
            this.log.error(`No se pudo avisar ${sobre.tipo}: ${e.message}`);
            canal.nack(mensaje, false, true);
          });
      });
      this.log.log(`Notificaciones push escuchando la cola ${COLA_DE_NOTIFICACIONES}`);
    } catch (e) {
      this.log.warn(`RabbitMQ no responde (${(e as Error).message}); reintento en 5 s`);
      if (!this.apagando) setTimeout(() => void this.conectar(), 5000);
    }
  }
}
