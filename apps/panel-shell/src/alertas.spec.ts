import { describe, expect, it } from 'vitest';
import { armarAlertas, haceCuanto } from './alertas';
import { destinoDeBusqueda, moduloDe } from './navegacion';

const ahora = new Date('2026-11-02T15:00:00Z').getTime();

describe('alertas del Panel', () => {
  it('pone primero el pedido que espera hace más y después las tiendas que piden ser clientes', () => {
    const alertas = armarAlertas(
      {
        misVentas: [
          { id: '2', codigo: 'A-1342', creadoEn: '2026-11-02T14:50:00Z', total: { texto: 'Bs 120,00' }, tienda: { nombre: 'Doña Rosa' } },
          { id: '1', codigo: 'A-1340', creadoEn: '2026-11-02T13:00:00Z', total: { texto: 'Bs 80,00' }, tienda: { nombre: null } },
        ],
        misSolicitudes: [
          { estado: 'SOLICITADA', tienda: { id: 't1', nombre: 'Despensa Lupita' } },
          { estado: 'APROBADA', tienda: { id: 't2', nombre: 'Ya aprobada' } },
        ],
      },
      ahora,
    );
    expect(alertas.map((a) => a.titulo)).toEqual(['Confirma A-1340', 'Confirma A-1342', 'Despensa Lupita quiere comprarte']);
    expect(alertas[0].detalle).toBe('Una tienda · Bs 80,00 · hace 2 h');
    expect(alertas[0].ruta).toBe('pedidos?q=A-1340');
  });

  it('sin datos (subgrafo caído) no hay alertas', () => {
    expect(armarAlertas({ misVentas: null, misSolicitudes: null })).toEqual([]);
  });

  it('dice hace cuánto con palabras', () => {
    expect(haceCuanto('2026-11-02T14:59:40Z', ahora)).toBe('recién');
    expect(haceCuanto('2026-11-02T14:48:00Z', ahora)).toBe('hace 12 min');
    expect(haceCuanto('2026-10-31T15:00:00Z', ahora)).toBe('hace 2 días');
  });
});

describe('buscador del header', () => {
  it('un código de pedido va a Pedidos y lo demás a Productos', () => {
    expect(destinoDeBusqueda('A-1342')).toBe('pedidos?q=A-1342');
    expect(destinoDeBusqueda('1342')).toBe('pedidos?q=1342');
    expect(destinoDeBusqueda(' arroz ')).toBe('productos?q=arroz');
    expect(destinoDeBusqueda('   ')).toBeNull();
  });

  it('la ruta con búsqueda sigue siendo su módulo', () => {
    expect(moduloDe('productos?q=arroz').ruta).toBe('productos');
    expect(moduloDe('no-existe').ruta).toBe('inicio');
  });
});

describe('escala del Panel', () => {
  it('en escritorio se achica para verse como en 2000 px; en pantallas grandes y en el teléfono no', async () => {
    const { escalaPara } = await import('./escala');
    expect(escalaPara(1520)).toBe(0.76);
    expect(escalaPara(1920)).toBe(0.96);
    expect(escalaPara(2200)).toBe(1);
    expect(escalaPara(1260)).toBe(0.7);
    expect(escalaPara(390)).toBe(1);
  });
});
