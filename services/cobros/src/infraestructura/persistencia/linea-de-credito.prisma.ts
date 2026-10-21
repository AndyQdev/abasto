import { Injectable } from '@nestjs/common';
import { Dinero } from '../../dominio/dinero.js';
import { LineaDeCredito, type PlazoDias } from '../../dominio/linea-de-credito.js';
import type { LineaDeCreditoRepositorio } from '../../dominio/linea-de-credito.repositorio.js';
import { PrismaServicio } from './prisma.servicio.js';

type Fila = {
  id: string;
  tiendaId: string;
  mayoristaId: string;
  limiteCentavos: number;
  plazoDias: number;
  reservas: { pedidoId: string; centavos: number }[];
};

const aDominio = (fila: Fila) =>
  new LineaDeCredito({
    id: fila.id,
    tiendaId: fila.tiendaId,
    mayoristaId: fila.mayoristaId,
    limite: Dinero.deCentavos(fila.limiteCentavos),
    plazoDias: fila.plazoDias as PlazoDias,
    reservas: new Map(fila.reservas.map((r) => [r.pedidoId, Dinero.deCentavos(r.centavos)])),
  });

/** Adaptador de salida: guarda el agregado y su outbox en una sola transacción. */
@Injectable()
export class LineaDeCreditoPrisma implements LineaDeCreditoRepositorio {
  constructor(private readonly prisma: PrismaServicio) {}

  async buscar(tiendaId: string, mayoristaId: string) {
    const fila = await this.prisma.lineaDeCredito.findUnique({
      where: { tiendaId_mayoristaId: { tiendaId, mayoristaId } },
      include: { reservas: true },
    });
    return fila ? aDominio(fila) : null;
  }

  async buscarPorId(id: string) {
    const fila = await this.prisma.lineaDeCredito.findUnique({ where: { id }, include: { reservas: true } });
    return fila ? aDominio(fila) : null;
  }

  async guardar(linea: LineaDeCredito) {
    const eventos = linea.sacarEventos();
    await this.prisma.$transaction(async (tx) => {
      await tx.reservaDeCredito.deleteMany({ where: { lineaId: linea.id } });
      await tx.reservaDeCredito.createMany({
        data: linea.listaDeReservas().map((r) => ({
          lineaId: linea.id,
          pedidoId: r.pedidoId,
          centavos: r.monto.centavos,
        })),
      });
      if (eventos.length) {
        await tx.outbox.createMany({ data: eventos.map((e) => ({ tipo: e.tipo, datos: e })) });
      }
    });
  }
}
