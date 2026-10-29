import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import amqp from 'amqplib';
import type pg from 'pg';
import { POOL_DUENO } from '../infraestructura/postgres/conexiones.js';
import { proyectar, tiendasQueNecesita, type Evento } from './proyectar.js';
import { DIRECTORIO_DE_TIENDAS, type DirectorioDeTiendas } from './puertos.js';

const COLA = 'asistente.proyector';

/**
 * Escucha todos los eventos (cola asistente.proyector) y actualiza la base de reportes.
 * Cada evento se aplica una sola vez gracias a la tabla eventos_proyectados.
 * Si RabbitMQ no está, reintenta cada 5 segundos sin tumbar el servicio.
 */
@Injectable()
export class ProyectorServicio implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ProyectorServicio.name);
  private conexion?: Awaited<ReturnType<typeof amqp.connect>>;
  private apagando = false;

  constructor(
    @Inject(POOL_DUENO) private readonly pool: pg.Pool,
    @Inject(DIRECTORIO_DE_TIENDAS) private readonly directorio: DirectorioDeTiendas,
  ) {}

  onModuleInit() {
    if (process.env.PROYECTOR === 'apagado') return;
    void this.conectar();
  }

  async onModuleDestroy() {
    this.apagando = true;
    await this.conexion?.close().catch(() => undefined);
  }

  /** Aplica un evento en una transacción. Devuelve false si ya se había proyectado. */
  async aplicar(evento: Evento): Promise<boolean> {
    // Los nombres se piden antes de abrir la transacción: una llamada de red no debe tener filas bloqueadas
    const tiendas = await this.directorio.nombres(tiendasQueNecesita(evento));
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const nuevo = await cliente.query(
        'INSERT INTO eventos_proyectados (id, tipo) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
        [evento.id, evento.tipo],
      );
      if (nuevo.rowCount === 0) {
        await cliente.query('ROLLBACK');
        return false;
      }
      for (const s of proyectar(evento, tiendas)) await cliente.query(s.sql, s.parametros);
      await cliente.query('COMMIT');
      return true;
    } catch (e) {
      await cliente.query('ROLLBACK');
      throw e;
    } finally {
      cliente.release();
    }
  }

  private async conectar(): Promise<void> {
    const url = process.env.RABBITMQ_URL ?? 'amqp://abasto:abasto@localhost:5680';
    try {
      this.conexion = await amqp.connect(url);
      this.conexion.on('close', () => !this.apagando && setTimeout(() => void this.conectar(), 5000));
      const canal = await this.conexion.createChannel();
      await canal.prefetch(20);
      await canal.consume(COLA, (mensaje) => {
        if (!mensaje) return;
        const evento = JSON.parse(mensaje.content.toString()) as Evento;
        this.aplicar(evento)
          .then(() => canal.ack(mensaje))
          // nack sin reencolar: tras los reintentos de la cola, el mensaje termina en asistente.proyector.dlq
          .catch((e: unknown) => {
            this.log.error(`No se pudo proyectar ${evento.tipo} ${evento.id}: ${(e as Error).message}`);
            canal.nack(mensaje, false, false);
          });
      });
      this.log.log(`Proyector escuchando la cola ${COLA}`);
    } catch (e) {
      this.log.warn(`RabbitMQ no responde (${(e as Error).message}); reintento en 5 s`);
      if (!this.apagando) setTimeout(() => void this.conectar(), 5000);
    }
  }
}
