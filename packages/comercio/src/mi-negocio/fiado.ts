/**
 * El cuaderno de fiado (fase 4): a quién le fía la tienda (o el productor), cuánto le debe y desde cuándo.
 * DEBE suma (una venta fiada o algo anotado a mano) y PAGA resta. Nada se borra: un pago es un registro más.
 */
import type { ClienteDeFiado, DatosDeNegocio, MovimientoDeFiado } from './modelo';
import { ErrorDeInventario } from './motor';

export function clienteDeFiado(nombre: string, telefono: string | null, ahora: string, id: string): ClienteDeFiado {
  const limpio = nombre.trim().replace(/\s+/g, ' ');
  if (limpio.length < 2) throw new ErrorDeInventario('Escribe el nombre');
  const numero = telefono?.replace(/\D/g, '') || null;
  return { id, nombre: limpio, telefono: numero, creadoEn: ahora, actualizadoEn: ahora, eliminado: false };
}

/** Lo que paga (o lo que se anota que debe, sin venta de por medio) */
export function anotarFiado(cliente: ClienteDeFiado, tipo: 'DEBE' | 'PAGA', montoCentavos: number, nota: string | null, ahora: string, id: string): MovimientoDeFiado {
  if (!Number.isFinite(montoCentavos) || montoCentavos <= 0) throw new ErrorDeInventario('Escribe el monto');
  return { id, clienteId: cliente.id, tipo, montoCentavos: Math.round(montoCentavos), ventaId: null, fecha: ahora, nota: nota?.trim() || null };
}

export interface SaldoDeFiado {
  cliente: ClienteDeFiado;
  /** Lo que debe hoy (positivo); 0 si está al día */
  saldoCentavos: number;
  /** Desde cuándo debe: la fecha del primer DEBE que no terminó de pagar */
  debeDesde: string | null;
  movimientos: MovimientoDeFiado[];
}

/** Quién debe y cuánto, el que más debe primero; los que están al día al final */
export function saldosDeFiado(datos: Pick<DatosDeNegocio, 'clientes' | 'fiados'>): SaldoDeFiado[] {
  return datos.clientes
    .filter((c) => !c.eliminado)
    .map((cliente) => {
      const suyos = datos.fiados.filter((f) => f.clienteId === cliente.id).sort((a, b) => a.fecha.localeCompare(b.fecha));
      let saldo = 0;
      let debeDesde: string | null = null;
      for (const f of suyos) {
        saldo += f.tipo === 'DEBE' ? f.montoCentavos : -f.montoCentavos;
        if (saldo > 0 && debeDesde === null) debeDesde = f.fecha;
        if (saldo <= 0) debeDesde = null;
      }
      return { cliente, saldoCentavos: Math.max(saldo, 0), debeDesde, movimientos: [...suyos].reverse() };
    })
    .sort((a, b) => b.saldoCentavos - a.saldoCentavos || a.cliente.nombre.localeCompare(b.cliente.nombre, 'es'));
}

/** Todo lo que le deben a la persona */
export const totalFiado = (saldos: SaldoDeFiado[]) => saldos.reduce((s, x) => s + x.saldoCentavos, 0);
