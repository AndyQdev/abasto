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

/**
 * Los clientes de la venta (02/11, pedido de Andrés): al vender se puede anotar a quién, sin formulario. Se escribe el
 * nombre (y el celular, si quiere) y la próxima vez aparece al escribir las primeras letras. Nunca se repite: el mismo
 * nombre (sin importar mayúsculas, tildes ni espacios) o el mismo celular es la misma persona.
 */
export const claveDeNombre = (nombre: string) =>
  nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Los que coinciden con lo escrito (cada palabra en cualquier parte del nombre, o el celular), los que más compran primero */
export function buscarClientes(datos: Pick<DatosDeNegocio, 'clientes' | 'ventas'>, texto: string, maximo = 5): ClienteDeFiado[] {
  const palabras = claveDeNombre(texto).split(' ').filter(Boolean);
  const digitos = texto.replace(/\D/g, '');
  if (!palabras.length) return [];
  const compras = new Map<string, { n: number; ultima: string }>();
  for (const v of datos.ventas) {
    if (!v.clienteId || v.anulada) continue;
    const c = compras.get(v.clienteId) ?? { n: 0, ultima: '' };
    compras.set(v.clienteId, { n: c.n + 1, ultima: v.fecha > c.ultima ? v.fecha : c.ultima });
  }
  return datos.clientes
    .filter((c) => !c.eliminado)
    .filter((c) => {
      const nombre = claveDeNombre(c.nombre);
      return palabras.every((p) => nombre.includes(p)) || (digitos.length >= 3 && !!c.telefono?.includes(digitos));
    })
    .sort((a, b) => {
      const x = compras.get(a.id);
      const y = compras.get(b.id);
      return (y?.n ?? 0) - (x?.n ?? 0) || (y?.ultima ?? '').localeCompare(x?.ultima ?? '') || a.nombre.localeCompare(b.nombre, 'es');
    })
    .slice(0, maximo);
}

/** El que ya existe con ese nombre o ese celular */
export function clienteExistente(datos: Pick<DatosDeNegocio, 'clientes'>, nombre: string, telefono?: string | null): ClienteDeFiado | null {
  const clave = claveDeNombre(nombre);
  const numero = telefono?.replace(/\D/g, '') || null;
  const vivos = datos.clientes.filter((c) => !c.eliminado);
  return (numero ? vivos.find((c) => c.telefono === numero) : undefined) ?? vivos.find((c) => claveDeNombre(c.nombre) === clave) ?? null;
}

/**
 * El cliente de una venta: si ya existe se usa ese (y si ahora trae el celular que le faltaba, se le suma); si no, uno
 * nuevo. `guardar` dice si hay que guardarlo (nuevo o con el celular nuevo).
 */
export function clienteParaVenta(
  datos: Pick<DatosDeNegocio, 'clientes'>,
  nombre: string,
  telefono: string | null,
  ahora: string,
  id: string,
): { cliente: ClienteDeFiado; guardar: boolean } {
  const numero = telefono?.replace(/\D/g, '') || null;
  const ya = clienteExistente(datos, nombre, numero);
  if (!ya) return { cliente: clienteDeFiado(nombre, numero, ahora, id), guardar: true };
  if (numero && !ya.telefono) return { cliente: { ...ya, telefono: numero, actualizadoEn: ahora }, guardar: true };
  return { cliente: ya, guardar: false };
}
