import { randomUUID } from 'node:crypto';
import { articulo } from '../dominio/ejemplos.js';
import type { Movimiento } from '../dominio/modelo.js';
import { PrismaServicio } from '../../infraestructura/persistencia/prisma.servicio.js';
import { NegocioPrisma } from './negocio.prisma.js';

/**
 * El repositorio contra Postgres de verdad (esquema negocio). Necesita `pnpm todo` (Postgres en 5440):
 * `pnpm --filter @abasto/cobros test:e2e`. No corre en la CI (pnpm test), que no levanta Postgres.
 */
const F = '2026-11-01T12:00:00.000Z';
const prisma = new PrismaServicio();
const repo = new NegocioPrisma(prisma);
const org = `prueba-${randomUUID()}`;
const otra = `prueba-${randomUUID()}`;
const mov = (id: string, clave = id, cantidad = 1): Movimiento => ({ id, articuloId: 'abasto:AB-101', tipo: 'CONSUMO', cantidad, costoUnitarioCentavos: null, origen: 'TANDA', claveUnica: clave, fecha: F, nota: null, ventaId: null, tandaId: 't1' });

afterAll(async () => {
  for (const o of [org, otra]) {
    for (const tabla of ['venta_linea', 'receta_insumo', 'movimiento', 'venta', 'fiado', 'tanda', 'anotacion', 'articulo', 'cliente_fiado', 'receta', 'lista_fija']) {
      await prisma.$executeRawUnsafe(`DELETE FROM negocio.${tabla} WHERE org_id = $1`, o);
    }
  }
  await prisma.$disconnect();
});

describe('Mi negocio en Postgres (esquema negocio)', () => {
  it('guarda con 6 decimales: 10 kg de un quintal de 46 kg', async () => {
    await repo.guardar(org, { articulos: [articulo('abasto:AB-101')], movimientos: [mov('m1', 'k1', -0.217391)] });
    const todo = await repo.desde(org, null);
    expect(todo.movimientos[0].cantidad).toBe(-0.217391);
    expect(todo.articulos[0].medida).toEqual({ envase: 'quintal', porEnvase: 46, unidad: 'kg' });
  });

  it('lo que solo se agrega choca por id o por clave única y no se duplica', async () => {
    expect(await repo.guardar(org, { movimientos: [mov('m1', 'k1'), mov('m2', 'k1'), mov('m3', 'k3')] })).toBe(1);
    expect((await repo.desde(org, null)).movimientos.map((m) => m.id).sort()).toEqual(['m1', 'm3']);
  });

  it('lo editable gana si es más nuevo, y con soloSiNoExisten no se pisa', async () => {
    await repo.guardar(org, { articulos: [articulo('abasto:AB-101', { precioVentaCentavos: 33000, actualizadoEn: '2026-11-01T13:00:00.000Z' })] });
    await repo.guardar(org, { articulos: [articulo('abasto:AB-101', { precioVentaCentavos: 1, actualizadoEn: '2026-11-01T11:00:00.000Z' })] });
    await repo.guardar(org, { articulos: [articulo('abasto:AB-101', { precioVentaCentavos: 2, actualizadoEn: '2026-11-02T00:00:00.000Z' })] }, { soloSiNoExisten: true });
    expect((await repo.desde(org, null)).articulos[0].precioVentaCentavos).toBe(33000);
  });

  it('una venta entra con sus líneas una sola vez; una receta reemplaza sus insumos', async () => {
    const venta = { id: 'v1', fecha: F, lineas: [{ articuloId: 'a', cantidad: 2, precioUnitarioCentavos: 2100, costoUnitarioCentavos: 1750 }, { articuloId: 'b', cantidad: 1.5, precioUnitarioCentavos: 1000, costoUnitarioCentavos: null }], totalCentavos: 5700, costoCentavos: 3500, forma: 'CONTADO' as const, clienteId: null, anulada: false };
    await repo.guardar(org, { ventas: [venta] });
    await repo.guardar(org, { ventas: [venta] });
    const receta = { id: 'r1', articuloId: 'h1', nombre: 'Salteñas', rinde: 100, notas: 'Además lleva 2,7 L de agua', insumos: [{ articuloId: 'abasto:AB-101', cantidad: 5 }, { articuloId: 'papa', cantidad: 4 }], actualizadoEn: F, eliminado: false };
    await repo.guardar(org, { recetas: [receta] });
    await repo.guardar(org, { recetas: [{ ...receta, insumos: [{ articuloId: 'abasto:AB-101', cantidad: 6 }], actualizadoEn: '2026-11-01T14:00:00.000Z' }] });
    const todo = await repo.desde(org, null);
    expect(todo.ventas).toHaveLength(1);
    expect(todo.ventas[0].lineas.map((l) => l.cantidad)).toEqual([2, 1.5]);
    expect(todo.recetas[0].insumos).toEqual([{ articuloId: 'abasto:AB-101', cantidad: 6 }]);
    expect(todo.recetas[0].notas).toBe('Además lleva 2,7 L de agua');
  });

  it('baja solo lo recibido después de la marca y nunca lo de otro cliente', async () => {
    const marca = new Date();
    await new Promise((r) => setTimeout(r, 20));
    await repo.guardar(org, { anotaciones: [{ id: 'g1', tipo: 'GASTO', montoCentavos: 5000, categoria: 'Luz', nota: null, origen: 'MANUAL', claveUnica: 'g1', fecha: F }] });
    await repo.guardar(otra, { articulos: [articulo('solo-de-la-otra')] });
    const nuevo = await repo.desde(org, marca);
    expect(nuevo.anotaciones.map((a) => a.id)).toEqual(['g1']);
    expect(nuevo.articulos).toEqual([]);
    expect((await repo.desde(org, null)).articulos.map((a) => a.id)).not.toContain('solo-de-la-otra');
  });
});
