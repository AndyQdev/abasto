import { Injectable } from '@nestjs/common';
import { CobroQr, type EstadoCobroQr } from '../../dominio/cobro-qr.js';
import type { CobroQrRepositorio, MensajesProcesados, Outbox } from '../../dominio/cobro-qr.repositorio.js';
import { Dinero } from '../../dominio/dinero.js';
import type { EventoDeCobros } from '../../dominio/eventos.js';
import { PrismaServicio } from './prisma.servicio.js';

type Fila = {
  id: string;
  pedidoId: string;
  tiendaId: string;
  mayoristaId: string;
  centavos: number;
  estado: string;
  codigo: string;
  creadoEn: Date;
  venceEn: Date;
  pagadoEn: Date | null;
};

const aDominio = (f: Fila) =>
  new CobroQr({ ...f, monto: Dinero.deCentavos(f.centavos), estado: f.estado as EstadoCobroQr });

/** Adaptador de salida: guarda el cobro y su outbox en una sola transacción. */
@Injectable()
export class CobroQrPrisma implements CobroQrRepositorio {
  constructor(private readonly prisma: PrismaServicio) {}

  async porPedido(pedidoId: string) {
    const fila = await this.prisma.cobroQr.findUnique({ where: { pedidoId } });
    return fila ? aDominio(fila) : null;
  }

  async pendientesVencidos(ahora: Date) {
    const filas = await this.prisma.cobroQr.findMany({ where: { estado: 'PENDIENTE', venceEn: { lt: ahora } }, take: 100 });
    return filas.map(aDominio);
  }

  async guardar(cobro: CobroQr) {
    const eventos = cobro.sacarEventos();
    const datos = {
      pedidoId: cobro.pedidoId,
      tiendaId: cobro.tiendaId,
      mayoristaId: cobro.mayoristaId,
      centavos: cobro.monto.centavos,
      estado: cobro.estado,
      codigo: cobro.codigo,
      creadoEn: cobro.creadoEn,
      venceEn: cobro.venceEn,
      pagadoEn: cobro.pagadoEn,
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.cobroQr.upsert({ where: { id: cobro.id }, create: { id: cobro.id, ...datos }, update: datos });
      if (eventos.length) await tx.outbox.createMany({ data: eventos.map((e) => ({ tipo: e.tipo, datos: e })) });
    });
  }
}

@Injectable()
export class OutboxPrisma implements Outbox {
  constructor(private readonly prisma: PrismaServicio) {}

  async agregar(evento: EventoDeCobros) {
    await this.prisma.outbox.create({ data: { tipo: evento.tipo, datos: evento } });
  }
}

@Injectable()
export class MensajesProcesadosPrisma implements MensajesProcesados {
  constructor(private readonly prisma: PrismaServicio) {}

  async yaProcesado(id: string) {
    return (await this.prisma.mensajeProcesado.count({ where: { id } })) > 0;
  }

  async marcar(id: string) {
    await this.prisma.mensajeProcesado.upsert({ where: { id }, create: { id }, update: {} });
  }
}
