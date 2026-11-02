import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RegistrarCompraEntregada } from '../aplicacion/casos-de-uso.js';
import type { PedidoEntregado } from '../dominio/compra-entregada.js';
import { apagado, conectarConReintento, type Conexion } from '../../infraestructura/mensajeria/rabbitmq.js';

/** La cola de Mi negocio: solo pedido.entregado. También está en infra/rabbitmq/definitions.json con los mismos argumentos */
export const COLA_DE_ENTREGAS = 'cobros.mi-negocio';
const EVENTOS = 'abasto.eventos';
const ARGUMENTOS = { 'x-queue-type': 'quorum', 'x-dead-letter-exchange': 'abasto.dlx', 'x-dead-letter-routing-key': COLA_DE_ENTREGAS, 'x-delivery-limit': 5 };

/** El sobre del contrato (contracts/asyncapi.yaml) con los datos del pedido entregado */
export interface SobreDeEntrega {
  id: string;
  tipo: string;
  datos: PedidoEntregado & { lineas?: PedidoEntregado['lineas'] };
}

/** Lo que trae el evento → lo que entiende el caso de uso. Sin líneas (eventos de antes del 01/11) no hay nada que registrar */
export function pedidoDelSobre(sobre: SobreDeEntrega): PedidoEntregado | null {
  const d = sobre.datos;
  if (sobre.tipo !== 'pedido.entregado' || !d?.pedidoId || !d.tiendaId || !Array.isArray(d.lineas)) return null;
  return {
    pedidoId: d.pedidoId,
    codigo: d.codigo,
    tiendaId: d.tiendaId,
    totalCentavos: Number(d.totalCentavos ?? 0),
    lineas: d.lineas.map((l) => ({ productoId: l.productoId, presentacion: l.presentacion, unidades: Number(l.unidades), subtotalCentavos: Number(l.subtotalCentavos) })),
  };
}

/**
 * Adaptador de entrada: escucha pedido.entregado y registra la compra en «Mi negocio» del cliente. Repetir el evento
 * no duplica nada (claves únicas). Un error inesperado hace nack sin reencolar: tras los reintentos va a
 * cobros.mi-negocio.dlq, como los comandos de la saga.
 */
@Injectable()
export class ConsumidorDeEntregas implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ConsumidorDeEntregas.name);
  private conexion?: Conexion;
  private apagando = false;

  constructor(@Inject(RegistrarCompraEntregada) private readonly registrar: RegistrarCompraEntregada) {}

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
    // Por si RabbitMQ arrancó con definiciones viejas: declarar es idempotente si los argumentos son los mismos
    await canal.assertQueue(`${COLA_DE_ENTREGAS}.dlq`, { durable: true });
    await canal.bindQueue(`${COLA_DE_ENTREGAS}.dlq`, 'abasto.dlx', COLA_DE_ENTREGAS);
    await canal.assertQueue(COLA_DE_ENTREGAS, { durable: true, arguments: ARGUMENTOS });
    await canal.bindQueue(COLA_DE_ENTREGAS, EVENTOS, 'pedido.entregado');
    await canal.prefetch(5);
    await canal.consume(COLA_DE_ENTREGAS, (mensaje) => {
      if (!mensaje) return;
      let sobre: SobreDeEntrega;
      try {
        sobre = JSON.parse(mensaje.content.toString()) as SobreDeEntrega;
      } catch {
        this.log.error('Llegó un mensaje que no es JSON a cobros.mi-negocio');
        canal.nack(mensaje, false, false);
        return;
      }
      const pedido = pedidoDelSobre(sobre);
      if (!pedido) {
        canal.ack(mensaje);
        return;
      }
      this.registrar
        .ejecutar(pedido)
        .then((n) => {
          if (n) this.log.log(`Pedido ${pedido.codigo}: ${n} registros en Mi negocio de ${pedido.tiendaId}`);
          canal.ack(mensaje);
        })
        .catch((e: unknown) => {
          this.log.error(`No se pudo registrar el pedido ${pedido.codigo} en Mi negocio: ${(e as Error).message}`);
          canal.nack(mensaje, false, false);
        });
    });
    this.log.log(`Escuchando pedido.entregado en ${COLA_DE_ENTREGAS}`);
  }
}
