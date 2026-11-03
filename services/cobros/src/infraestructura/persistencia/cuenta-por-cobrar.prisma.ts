import { Injectable } from '@nestjs/common';
import { CuentaPorCobrar, type FormaDePago, type OrigenDeCuenta } from '../../dominio/cuenta-por-cobrar.js';
import type { CuentaPorCobrarRepositorio } from '../../dominio/cuenta-por-cobrar.repositorio.js';
import { Dinero } from '../../dominio/dinero.js';
import type { LineaDeCredito } from '../../dominio/linea-de-credito.js';
import { PrismaServicio } from './prisma.servicio.js';

type Fila = {
  id: string;
  pedidoId: string;
  codigo: string;
  tiendaId: string;
  mayoristaId: string;
  origen: string;
  centavos: number;
  abiertaEn: Date;
  venceEn: Date | null;
  pagos: { id: string; centavos: number; forma: string; nota: string | null; registradoEn: Date; registradoPor: string }[];
};

const aDominio = (f: Fila) =>
  new CuentaPorCobrar({
    id: f.id,
    pedidoId: f.pedidoId,
    codigo: f.codigo,
    tiendaId: f.tiendaId,
    mayoristaId: f.mayoristaId,
    origen: f.origen as OrigenDeCuenta,
    monto: Dinero.deCentavos(f.centavos),
    abiertaEn: f.abiertaEn,
    venceEn: f.venceEn,
    pagos: f.pagos.map((p) => ({
      id: p.id,
      monto: Dinero.deCentavos(p.centavos),
      forma: p.forma as FormaDePago,
      nota: p.nota ?? undefined,
      registradoEn: p.registradoEn,
      registradoPor: p.registradoPor,
    })),
  });

/** Adaptador de salida de CU-09: la cuenta, sus pagos, el outbox y (si se saldó un crédito) el cupo, en una transacción. */
@Injectable()
export class CuentaPorCobrarPrisma implements CuentaPorCobrarRepositorio {
  constructor(private readonly prisma: PrismaServicio) {}

  async porPedido(pedidoId: string) {
    const fila = await this.prisma.cuentaPorCobrar.findUnique({ where: { pedidoId }, include: { pagos: true } });
    return fila ? aDominio(fila) : null;
  }

  async delMayorista(mayoristaId: string, conPagadas: boolean) {
    const filas = await this.prisma.cuentaPorCobrar.findMany({
      where: { mayoristaId },
      include: { pagos: true },
      orderBy: { abiertaEn: 'desc' },
      // Las pagadas se listan solo las últimas: lo que importa es lo que falta cobrar
      take: conPagadas ? 500 : undefined,
    });
    return filas.map(aDominio).filter((c) => conPagadas || c.estado !== 'PAGADA');
  }

  async guardar(cuenta: CuentaPorCobrar, lineaSaldada?: LineaDeCredito) {
    const eventos = cuenta.sacarEventos();
    await this.prisma.$transaction(async (tx) => {
      const datos = {
        codigo: cuenta.codigo,
        tiendaId: cuenta.tiendaId,
        mayoristaId: cuenta.mayoristaId,
        origen: cuenta.origen,
        centavos: cuenta.monto.centavos,
        abiertaEn: cuenta.abiertaEn,
        venceEn: cuenta.venceEn,
      };
      await tx.cuentaPorCobrar.upsert({
        where: { id: cuenta.id },
        create: { id: cuenta.id, pedidoId: cuenta.pedidoId, ...datos },
        update: {},
      });
      // Los pagos solo se agregan: uno que ya estaba (mismo id) no entra otra vez
      await tx.pagoDeCuenta.createMany({
        data: cuenta.listaDePagos().map((p) => ({
          id: p.id,
          cuentaId: cuenta.id,
          centavos: p.monto.centavos,
          forma: p.forma,
          nota: p.nota ?? null,
          registradoEn: p.registradoEn,
          registradoPor: p.registradoPor,
        })),
        skipDuplicates: true,
      });
      // Lo pagado lo suma la base: si dos personas cobran a la vez, el CHECK (pagado ≤ monto) frena el cobro de más
      await tx.$executeRaw`UPDATE cuentas_por_cobrar
           SET pagado_centavos = (SELECT coalesce(sum(centavos), 0) FROM pagos_de_cuenta WHERE cuenta_id = ${cuenta.id})
         WHERE id = ${cuenta.id}`;
      if (lineaSaldada) {
        // El cupo vuelve: solo se borra la reserva de este pedido (la línea no tiene eventos que publicar)
        await tx.reservaDeCredito.deleteMany({ where: { lineaId: lineaSaldada.id, pedidoId: cuenta.pedidoId } });
      }
      if (eventos.length) {
        await tx.outbox.createMany({ data: eventos.map((e) => ({ tipo: e.tipo, datos: e })) });
      }
    });
  }
}
