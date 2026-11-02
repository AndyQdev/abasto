import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import amqp from 'amqplib';
import { AtenderComando, type Comando } from '../../aplicacion/atender-comando.js';
import { VencerQrs } from '../../aplicacion/cobros-qr.js';
import { PrismaServicio } from '../persistencia/prisma.servicio.js';

const COLA = 'cobros.comandos';
const EVENTOS = 'abasto.eventos';
const URL = () => process.env.RABBITMQ_URL ?? 'amqp://abasto:abasto@localhost:5680';
export const apagado = () => process.env.MENSAJERIA === 'apagada';

export type Conexion = Awaited<ReturnType<typeof amqp.connect>>;

/** Conecta con reintento cada 5 s: si RabbitMQ no está, el servicio sigue respondiendo GraphQL. */
export async function conectarConReintento(log: Logger, alConectar: (c: Conexion) => Promise<void>, apagando: () => boolean) {
  try {
    const conexion = await amqp.connect(URL());
    conexion.on('close', () => !apagando() && setTimeout(() => void conectarConReintento(log, alConectar, apagando), 5000));
    await alConectar(conexion);
    return conexion;
  } catch (e) {
    log.warn(`RabbitMQ no responde (${(e as Error).message}); reintento en 5 s`);
    if (!apagando()) setTimeout(() => void conectarConReintento(log, alConectar, apagando), 5000);
    return undefined;
  }
}

/**
 * Adaptador de entrada: los comandos de la saga (cola cobros.comandos).
 * Un error inesperado hace nack sin reencolar: tras los reintentos, el mensaje termina en cobros.comandos.dlq
 * y el Superadmin lo muestra en Salud. Los errores de negocio no llegan aquí: salen como cobro.rechazado.
 */
@Injectable()
export class ConsumidorDeComandos implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ConsumidorDeComandos.name);
  private conexion?: Conexion;
  private apagando = false;

  constructor(@Inject(AtenderComando) private readonly atender: AtenderComando) {}

  onModuleInit() {
    if (apagado()) return;
    void conectarConReintento(this.log, (c) => this.escuchar(c), () => this.apagando).then((c) => (this.conexion = c));
  }

  async onModuleDestroy() {
    this.apagando = true;
    await this.conexion?.close().catch(() => undefined);
  }

  private async escuchar(conexion: Conexion) {
    this.conexion = conexion;
    const canal = await conexion.createChannel();
    await canal.prefetch(10);
    await canal.consume(COLA, (mensaje) => {
      if (!mensaje) return;
      const comando = JSON.parse(mensaje.content.toString()) as Comando;
      this.atender
        .ejecutar(comando)
        .then((r) => {
          if (r === 'rechazado') this.log.log(`${comando.tipo} del pedido ${comando.datos.pedidoId}: rechazado`);
          canal.ack(mensaje);
        })
        .catch((e: unknown) => {
          this.log.error(`No se pudo atender ${comando.tipo} ${comando.id}: ${(e as Error).message}`);
          canal.nack(mensaje, false, false);
        });
    });
    this.log.log(`Escuchando la cola ${COLA}`);
  }
}

/**
 * Publicador del outbox: lo que Cobros guardó en la misma transacción que el cambio
 * sale a abasto.eventos con el sobre del contrato. Si el envío falla, se reintenta en la siguiente vuelta.
 */
@Injectable()
export class PublicadorOutbox implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PublicadorOutbox.name);
  private conexion?: Conexion;
  private canal?: Awaited<ReturnType<Conexion['createConfirmChannel']>>;
  private reloj?: ReturnType<typeof setInterval>;
  private apagando = false;
  private ocupado = false;

  constructor(@Inject(PrismaServicio) private readonly prisma: PrismaServicio) {}

  onModuleInit() {
    if (apagado()) return;
    void conectarConReintento(
      this.log,
      async (c) => {
        this.conexion = c;
        this.canal = await c.createConfirmChannel();
        c.on('close', () => (this.canal = undefined));
      },
      () => this.apagando,
    );
    this.reloj = setInterval(() => void this.publicar(), 500);
  }

  async onModuleDestroy() {
    this.apagando = true;
    clearInterval(this.reloj);
    await this.conexion?.close().catch(() => undefined);
  }

  async publicar(): Promise<void> {
    const canal = this.canal;
    if (!canal || this.ocupado) return;
    this.ocupado = true;
    try {
      const pendientes = await this.prisma.outbox.findMany({ where: { publicadoEn: null }, orderBy: { creadoEn: 'asc' }, take: 50 });
      for (const p of pendientes) {
        const datos = p.datos as { pedidoId?: string; mayoristaId?: string };
        const sobre = {
          id: p.id,
          tipo: p.tipo,
          version: 1,
          ocurridoEn: p.creadoEn.toISOString(),
          correlationId: datos.pedidoId ?? null,
          orgId: datos.mayoristaId ?? null,
          datos: p.datos,
        };
        canal.publish(EVENTOS, p.tipo, Buffer.from(JSON.stringify(sobre)), {
          contentType: 'application/json',
          messageId: p.id,
          correlationId: datos.pedidoId,
          persistent: true,
        });
        await canal.waitForConfirms();
        await this.prisma.outbox.update({ where: { id: p.id }, data: { publicadoEn: new Date() } });
      }
    } catch (e) {
      this.log.warn(`No se pudo publicar el outbox: ${(e as Error).message}`);
    } finally {
      this.ocupado = false;
    }
  }
}

/** Revisa cada 15 s los QR vencidos: la saga recibe cobro.rechazado y libera el stock. */
@Injectable()
export class RevisorDeQrs implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(RevisorDeQrs.name);
  private reloj?: ReturnType<typeof setInterval>;

  constructor(@Inject(VencerQrs) private readonly vencer: VencerQrs) {}

  onModuleInit() {
    if (apagado()) return;
    this.reloj = setInterval(() => {
      this.vencer
        .ejecutar()
        .then((n) => n && this.log.log(`${n} QR vencidos`))
        .catch((e: unknown) => this.log.warn(`No se pudieron revisar los QR: ${(e as Error).message}`));
    }, 15_000);
  }

  onModuleDestroy() {
    clearInterval(this.reloj);
  }
}
