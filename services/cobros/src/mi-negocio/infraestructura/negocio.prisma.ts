import { Inject, Injectable } from '@nestjs/common';
import type { CambiosDeNegocio, DatosDeNegocio } from '../dominio/modelo.js';
import type { RepositorioDeNegocio } from '../dominio/puertos.js';
import { PrismaServicio } from '../../infraestructura/persistencia/prisma.servicio.js';

type Tx = Parameters<Parameters<PrismaServicio['$transaction']>[0]>[0];
const fecha = (t: string) => new Date(t);
const iso = (d: Date) => d.toISOString();
const num = (d: unknown) => (d === null || d === undefined ? null : Number(d));

/**
 * «Mi negocio» en el esquema negocio de Postgres. Todo en una transacción:
 * - Lo que solo se agrega (movimientos, ventas, fiados, tandas, anotaciones) usa createMany con skipDuplicates
 *   (ON CONFLICT DO NOTHING): choca con la llave (org_id, id) o con (org_id, clave_unica) y no se duplica.
 * - Lo editable (artículos, clientes, recetas, lista) se compara con lo guardado: gana si actualizado_en es igual o
 *   más nuevo. Con soloSiNoExisten (lo que arma el servidor al entregar un pedido) no pisa nada del cliente.
 * Cada escritura pone recibido_en = ahora, que es lo que usa miNegocio(desde) para bajar solo lo nuevo.
 */
@Injectable()
export class NegocioPrisma implements RepositorioDeNegocio {
  constructor(@Inject(PrismaServicio) private readonly prisma: PrismaServicio) {}

  async guardar(orgId: string, c: CambiosDeNegocio, opciones: { soloSiNoExisten?: boolean } = {}): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      let escritos = 0;
      const ahora = new Date();
      const gana = async <T extends { actualizadoEn: Date }>(actual: T | null, llega: string) =>
        !actual || (!opciones.soloSiNoExisten && actual.actualizadoEn.getTime() <= fecha(llega).getTime());

      for (const a of c.articulos ?? []) {
        const actual = await tx.negocioArticulo.findUnique({ where: { orgId_id: { orgId, id: a.id } }, select: { actualizadoEn: true } });
        if (!(await gana(actual, a.actualizadoEn))) continue;
        const datos = {
          nombre: a.nombre,
          detalle: a.detalle,
          rubro: a.rubro,
          envase: a.medida.envase,
          porEnvase: a.medida.porEnvase,
          unidad: a.medida.unidad,
          clase: a.clase,
          origen: a.origen,
          productoId: a.productoId,
          proveedor: a.proveedor,
          precioVentaCentavos: a.precioVentaCentavos,
          stockMinimo: a.stockMinimo,
          creadoEn: fecha(a.creadoEn),
          actualizadoEn: fecha(a.actualizadoEn),
          eliminado: a.eliminado,
          recibidoEn: ahora,
        };
        await tx.negocioArticulo.upsert({ where: { orgId_id: { orgId, id: a.id } }, create: { orgId, id: a.id, ...datos }, update: datos });
        escritos++;
      }

      for (const k of c.clientes ?? []) {
        const actual = await tx.negocioClienteFiado.findUnique({ where: { orgId_id: { orgId, id: k.id } }, select: { actualizadoEn: true } });
        if (!(await gana(actual, k.actualizadoEn))) continue;
        const datos = { nombre: k.nombre, telefono: k.telefono, creadoEn: fecha(k.creadoEn), actualizadoEn: fecha(k.actualizadoEn), eliminado: k.eliminado, recibidoEn: ahora };
        await tx.negocioClienteFiado.upsert({ where: { orgId_id: { orgId, id: k.id } }, create: { orgId, id: k.id, ...datos }, update: datos });
        escritos++;
      }

      for (const r of c.recetas ?? []) {
        const actual = await tx.negocioReceta.findUnique({ where: { orgId_id: { orgId, id: r.id } }, select: { actualizadoEn: true } });
        if (!(await gana(actual, r.actualizadoEn))) continue;
        const datos = { articuloId: r.articuloId, nombre: r.nombre, rinde: r.rinde, actualizadoEn: fecha(r.actualizadoEn), eliminado: r.eliminado, recibidoEn: ahora };
        await tx.negocioReceta.upsert({ where: { orgId_id: { orgId, id: r.id } }, create: { orgId, id: r.id, ...datos }, update: datos });
        // Los insumos son parte de la receta: se reemplazan con ella
        await tx.negocioRecetaInsumo.deleteMany({ where: { orgId, recetaId: r.id } });
        if (r.insumos.length) {
          await tx.negocioRecetaInsumo.createMany({ data: r.insumos.map((i, n) => ({ orgId, recetaId: r.id, numero: n, articuloId: i.articuloId, cantidad: i.cantidad })) });
        }
        escritos++;
      }

      for (const i of c.lista ?? []) {
        const actual = await tx.negocioListaFija.findUnique({ where: { orgId_id: { orgId, id: i.id } }, select: { actualizadoEn: true } });
        if (!(await gana(actual, i.actualizadoEn))) continue;
        const datos = { productoId: i.productoId, presentacion: i.presentacion, cantidad: i.cantidad, actualizadoEn: fecha(i.actualizadoEn), eliminado: i.eliminado, recibidoEn: ahora };
        await tx.negocioListaFija.upsert({ where: { orgId_id: { orgId, id: i.id } }, create: { orgId, id: i.id, ...datos }, update: datos });
        escritos++;
      }

      if (c.movimientos?.length) {
        escritos += (
          await tx.negocioMovimiento.createMany({
            skipDuplicates: true,
            data: c.movimientos.map((m) => ({
              orgId,
              id: m.id,
              articuloId: m.articuloId,
              tipo: m.tipo,
              cantidad: m.cantidad,
              costoUnitarioCentavos: m.costoUnitarioCentavos,
              origen: m.origen,
              claveUnica: m.claveUnica,
              fecha: fecha(m.fecha),
              nota: m.nota,
              ventaId: m.ventaId ?? null,
              tandaId: m.tandaId ?? null,
              recibidoEn: ahora,
            })),
          })
        ).count;
      }

      escritos += await this.ventas(tx, orgId, c, ahora);

      if (c.fiados?.length) {
        escritos += (
          await tx.negocioFiado.createMany({
            skipDuplicates: true,
            data: c.fiados.map((f) => ({ orgId, id: f.id, clienteId: f.clienteId, tipo: f.tipo, montoCentavos: f.montoCentavos, ventaId: f.ventaId, fecha: fecha(f.fecha), nota: f.nota, recibidoEn: ahora })),
          })
        ).count;
      }
      if (c.tandas?.length) {
        escritos += (
          await tx.negocioTanda.createMany({
            skipDuplicates: true,
            data: c.tandas.map((t) => ({ orgId, id: t.id, recetaId: t.recetaId, articuloId: t.articuloId, planificado: t.planificado, obtenido: t.obtenido, costoTotalCentavos: t.costoTotalCentavos, fecha: fecha(t.fecha), recibidoEn: ahora })),
          })
        ).count;
      }
      if (c.anotaciones?.length) {
        escritos += (
          await tx.negocioAnotacion.createMany({
            skipDuplicates: true,
            data: c.anotaciones.map((a) => ({ orgId, id: a.id, tipo: a.tipo, montoCentavos: a.montoCentavos, categoria: a.categoria, nota: a.nota, origen: a.origen, claveUnica: a.claveUnica, fecha: fecha(a.fecha), recibidoEn: ahora })),
          })
        ).count;
      }
      return escritos;
    });
  }

  /** Una venta y sus líneas entran juntas, una sola vez */
  private async ventas(tx: Tx, orgId: string, c: CambiosDeNegocio, ahora: Date) {
    let escritas = 0;
    for (const v of c.ventas ?? []) {
      const { count } = await tx.negocioVenta.createMany({
        skipDuplicates: true,
        data: [{ orgId, id: v.id, fecha: fecha(v.fecha), totalCentavos: v.totalCentavos, costoCentavos: v.costoCentavos, forma: v.forma, clienteId: v.clienteId, anulada: v.anulada, recibidoEn: ahora }],
      });
      if (!count) continue;
      await tx.negocioVentaLinea.createMany({
        data: v.lineas.map((l, n) => ({ orgId, ventaId: v.id, numero: n, articuloId: l.articuloId, cantidad: l.cantidad, precioUnitarioCentavos: l.precioUnitarioCentavos, costoUnitarioCentavos: l.costoUnitarioCentavos })),
      });
      escritas++;
    }
    return escritas;
  }

  async desde(orgId: string, desde: Date | null): Promise<DatosDeNegocio> {
    const donde = { orgId, ...(desde ? { recibidoEn: { gt: desde } } : {}) };
    const orden = { recibidoEn: 'asc' as const };
    const [articulos, movimientos, ventas, clientes, fiados, recetas, tandas, anotaciones, lista] = await Promise.all([
      this.prisma.negocioArticulo.findMany({ where: donde, orderBy: orden }),
      this.prisma.negocioMovimiento.findMany({ where: donde, orderBy: orden }),
      this.prisma.negocioVenta.findMany({ where: donde, orderBy: orden, include: { lineas: { orderBy: { numero: 'asc' } } } }),
      this.prisma.negocioClienteFiado.findMany({ where: donde, orderBy: orden }),
      this.prisma.negocioFiado.findMany({ where: donde, orderBy: orden }),
      this.prisma.negocioReceta.findMany({ where: donde, orderBy: orden, include: { insumos: { orderBy: { numero: 'asc' } } } }),
      this.prisma.negocioTanda.findMany({ where: donde, orderBy: orden }),
      this.prisma.negocioAnotacion.findMany({ where: donde, orderBy: orden }),
      this.prisma.negocioListaFija.findMany({ where: donde, orderBy: orden }),
    ]);
    return {
      articulos: articulos.map((a) => ({
        id: a.id,
        nombre: a.nombre,
        detalle: a.detalle,
        rubro: a.rubro,
        medida: { envase: a.envase, porEnvase: num(a.porEnvase), unidad: a.unidad },
        clase: a.clase as 'COMPRADO' | 'HECHO',
        origen: a.origen as 'ABASTO' | 'OTRO_PROVEEDOR',
        productoId: a.productoId,
        proveedor: a.proveedor,
        precioVentaCentavos: a.precioVentaCentavos,
        stockMinimo: num(a.stockMinimo),
        creadoEn: iso(a.creadoEn),
        actualizadoEn: iso(a.actualizadoEn),
        eliminado: a.eliminado,
      })),
      movimientos: movimientos.map((m) => ({
        id: m.id,
        articuloId: m.articuloId,
        tipo: m.tipo as DatosDeNegocio['movimientos'][number]['tipo'],
        cantidad: Number(m.cantidad),
        costoUnitarioCentavos: m.costoUnitarioCentavos,
        origen: m.origen as DatosDeNegocio['movimientos'][number]['origen'],
        claveUnica: m.claveUnica,
        fecha: iso(m.fecha),
        nota: m.nota,
        ventaId: m.ventaId,
        tandaId: m.tandaId,
      })),
      ventas: ventas.map((v) => ({
        id: v.id,
        fecha: iso(v.fecha),
        totalCentavos: v.totalCentavos,
        costoCentavos: v.costoCentavos,
        forma: v.forma as 'CONTADO' | 'FIADO',
        clienteId: v.clienteId,
        anulada: v.anulada,
        lineas: v.lineas.map((l) => ({ articuloId: l.articuloId, cantidad: Number(l.cantidad), precioUnitarioCentavos: l.precioUnitarioCentavos, costoUnitarioCentavos: l.costoUnitarioCentavos })),
      })),
      clientes: clientes.map((k) => ({ id: k.id, nombre: k.nombre, telefono: k.telefono, creadoEn: iso(k.creadoEn), actualizadoEn: iso(k.actualizadoEn), eliminado: k.eliminado })),
      fiados: fiados.map((f) => ({ id: f.id, clienteId: f.clienteId, tipo: f.tipo as 'DEBE' | 'PAGA', montoCentavos: f.montoCentavos, ventaId: f.ventaId, fecha: iso(f.fecha), nota: f.nota })),
      recetas: recetas.map((r) => ({
        id: r.id,
        articuloId: r.articuloId,
        nombre: r.nombre,
        rinde: Number(r.rinde),
        insumos: r.insumos.map((i) => ({ articuloId: i.articuloId, cantidad: Number(i.cantidad) })),
        actualizadoEn: iso(r.actualizadoEn),
        eliminado: r.eliminado,
      })),
      tandas: tandas.map((t) => ({ id: t.id, recetaId: t.recetaId, articuloId: t.articuloId, planificado: Number(t.planificado), obtenido: Number(t.obtenido), costoTotalCentavos: t.costoTotalCentavos, fecha: iso(t.fecha) })),
      anotaciones: anotaciones.map((a) => ({
        id: a.id,
        tipo: a.tipo as 'INGRESO' | 'GASTO',
        montoCentavos: a.montoCentavos,
        categoria: a.categoria,
        nota: a.nota,
        origen: a.origen as 'MANUAL' | 'ABASTO',
        claveUnica: a.claveUnica,
        fecha: iso(a.fecha),
      })),
      lista: lista.map((i) => ({ id: i.id, productoId: i.productoId, presentacion: i.presentacion, cantidad: Number(i.cantidad), actualizadoEn: iso(i.actualizadoEn), eliminado: i.eliminado })),
    };
  }
}
