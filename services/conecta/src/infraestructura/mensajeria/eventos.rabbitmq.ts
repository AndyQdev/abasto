import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import amqp from 'amqplib';
import { CanalDeTiendas } from '../../aplicacion/canal-de-tiendas.js';
import type { SobreDeEvento } from '../../dominio/aviso-de-pedido.js';

const EVENTOS = 'abasto.eventos';
const URL = () => process.env.RABBITMQ_URL ?? 'amqp://abasto:abasto@localhost:5680';

type Conexion = Awaited<ReturnType<typeof amqp.connect>>;

/**
 * Escucha pedido.* y cobro.* de abasto.eventos para el tiempo real. Cada instancia de Conecta tiene su propia cola,
 * exclusiva y que se borra sola al apagarse: los avisos son en vivo (si nadie estaba conectado no hace falta
 * guardarlos; al reconectar la app vuelve a pedir la lista). Si RabbitMQ no está, reintenta cada 5 s y la API sigue.
 */
@Injectable()
export class EscuchaDeEventos implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(EscuchaDeEventos.name);
  private conexion?: Conexion;
  private apagando = false;

  constructor(@Inject(CanalDeTiendas) private readonly canal: CanalDeTiendas) {}

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
      const { queue } = await canal.assertQueue('', { exclusive: true, autoDelete: true });
      await canal.bindQueue(queue, EVENTOS, 'pedido.*');
      await canal.bindQueue(queue, EVENTOS, 'cobro.*');
      await canal.consume(
        queue,
        (mensaje) => {
          if (!mensaje) return;
          try {
            this.canal.publicar(JSON.parse(mensaje.content.toString()) as SobreDeEvento);
          } catch {
            this.log.warn('Llegó un evento que no se pudo leer');
          }
        },
        { noAck: true },
      );
      this.log.log(`Tiempo real escuchando pedido.* y cobro.* de ${EVENTOS}`);
    } catch (e) {
      this.log.warn(`RabbitMQ no responde (${(e as Error).message}); reintento en 5 s`);
      if (!this.apagando) setTimeout(() => void this.conectar(), 5000);
    }
  }
}
