import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AbrirCuentaDePedido, type PedidoConfirmado } from '../../aplicacion/cuentas-por-cobrar.js';
import { apagado, conectarConReintento, type Conexion } from './rabbitmq.js';

/** CU-09: la cola de las cuentas por cobrar, solo pedido.confirmado. También está en infra/rabbitmq/definitions.json */
export const COLA_DE_CUENTAS = 'cobros.cuentas';
const EVENTOS = 'abasto.eventos';
const ARGUMENTOS = { 'x-queue-type': 'quorum', 'x-dead-letter-exchange': 'abasto.dlx', 'x-dead-letter-routing-key': COLA_DE_CUENTAS, 'x-delivery-limit': 5 };

/** El sobre del contrato (contracts/asyncapi.yaml) con DatosPedido */
export interface SobreDePedido {
  id: string;
  tipo: string;
  ocurridoEn?: string;
  datos?: Partial<Record<'pedidoId' | 'codigo' | 'tiendaId' | 'mayoristaId' | 'metodoPago', string>> & { totalCentavos?: number | string };
}

/** Lo que trae el evento → lo que entiende el caso de uso. Si falta algo, no hay cuenta que abrir. */
export function pedidoConfirmadoDelSobre(sobre: SobreDePedido, ahora = new Date()): PedidoConfirmado | null {
  const d = sobre.datos;
  if (sobre.tipo !== 'pedido.confirmado' || !d?.pedidoId || !d.tiendaId || !d.mayoristaId || !d.metodoPago) return null;
  const confirmadoEn = sobre.ocurridoEn ? new Date(sobre.ocurridoEn) : ahora;
  return {
    pedidoId: d.pedidoId,
    codigo: d.codigo ?? d.pedidoId,
    tiendaId: d.tiendaId,
    mayoristaId: d.mayoristaId,
    metodoPago: d.metodoPago,
    totalCentavos: Number(d.totalCentavos ?? 0),
    confirmadoEn: Number.isNaN(confirmadoEn.getTime()) ? ahora : confirmadoEn,
  };
}

/**
 * Adaptador de entrada: escucha pedido.confirmado y abre la cuenta por cobrar de los pedidos a crédito o contra entrega.
 * Repetir el evento no abre otra (una cuenta por pedido). Un error inesperado hace nack sin reencolar: tras los
 * reintentos va a cobros.cuentas.dlq, como los comandos de la saga.
 */
@Injectable()
export class ConsumidorDeCuentas implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ConsumidorDeCuentas.name);
  private conexion?: Conexion;
  private apagando = false;

  constructor(@Inject(AbrirCuentaDePedido) private readonly abrir: AbrirCuentaDePedido) {}

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
    // Declarar es idempotente si los argumentos son los mismos: sirve si RabbitMQ arrancó con definiciones viejas
    await canal.assertQueue(`${COLA_DE_CUENTAS}.dlq`, { durable: true });
    await canal.bindQueue(`${COLA_DE_CUENTAS}.dlq`, 'abasto.dlx', COLA_DE_CUENTAS);
    await canal.assertQueue(COLA_DE_CUENTAS, { durable: true, arguments: ARGUMENTOS });
    await canal.bindQueue(COLA_DE_CUENTAS, EVENTOS, 'pedido.confirmado');
    await canal.prefetch(5);
    await canal.consume(COLA_DE_CUENTAS, (mensaje) => {
      if (!mensaje) return;
      let sobre: SobreDePedido;
      try {
        sobre = JSON.parse(mensaje.content.toString()) as SobreDePedido;
      } catch {
        this.log.error(`Llegó un mensaje que no es JSON a ${COLA_DE_CUENTAS}`);
        canal.nack(mensaje, false, false);
        return;
      }
      const pedido = pedidoConfirmadoDelSobre(sobre);
      if (!pedido) {
        canal.ack(mensaje);
        return;
      }
      this.abrir
        .ejecutar(pedido)
        .then((cuenta) => {
          if (cuenta) this.log.log(`Pedido ${pedido.codigo}: cuenta por cobrar de ${cuenta.monto.texto()} (${cuenta.origen})`);
          canal.ack(mensaje);
        })
        .catch((e: unknown) => {
          this.log.error(`No se pudo abrir la cuenta del pedido ${pedido.codigo}: ${(e as Error).message}`);
          canal.nack(mensaje, false, false);
        });
    });
    this.log.log(`Escuchando pedido.confirmado en ${COLA_DE_CUENTAS}`);
  }
}
