import { cantidadAPedir, demandaDeLaSemana, enRiesgo } from '../dominio/demanda.js';
import { validarConsulta } from '../dominio/guardia-sql.js';
import type { RegistroDeAuditoria } from '../puertos.js';
import { ConsultarReportes } from './consultar-reportes.js';
import { ConsultarTableros } from './consultar-tableros.js';

const stock = [
  { producto_id: 'AR-0100', nombre: 'Arroz grano largo 1 kg', stock: 40, vendidas_por_dia: 20 },
  { producto_id: 'AZ-1000', nombre: 'Azúcar refinada 1 kg', stock: 960, vendidas_por_dia: 30 },
  { producto_id: 'CL-1000', nombre: 'Cloro 1 L', stock: 12, vendidas_por_dia: 0 },
];

describe('Demanda de la semana', () => {
  it('usa la primera semana que predijo el ML y, si no hay, el promedio de 30 días', () => {
    const demanda = demandaDeLaSemana(stock, [
      { producto_id: 'AR-0100', semana: '2026-11-09', unidades: 999 },
      { producto_id: 'AR-0100', semana: '2026-11-02', unidades: 210 },
    ]);
    expect(demanda.map((d) => [d.producto_id, d.unidades_semana, d.dias_de_stock])).toEqual([
      ['AR-0100', 210, 1.3],
      ['AZ-1000', 210, 32],
      // sin demanda no se agota: va al final
      ['CL-1000', 0, null],
    ]);
  });

  it('en riesgo es lo que no alcanza para 7 días; se pide para cubrir 2 semanas', () => {
    // Sin ML: arroz 40 u. a 20 por día = 2 días; azúcar 32 días; cloro no se vende
    const [arroz, azucar, cloro] = demandaDeLaSemana(stock, []);
    expect([enRiesgo(arroz), enRiesgo(azucar), enRiesgo(cloro)]).toEqual([true, false, false]);
    expect(cantidadAPedir(arroz)).toBe(240);
    expect(cantidadAPedir(azucar)).toBe(0);
    const [arrozConML] = demandaDeLaSemana(stock, [{ producto_id: 'AR-0100', semana: '2026-11-02', unidades: 210 }]);
    expect(cantidadAPedir(arrozConML)).toBe(380);
  });
});

describe('Tableros', () => {
  const respuestas: Record<string, Record<string, unknown>[]> = {
    stock_productos: stock,
    prediccion_demanda: [],
    segmento_tiendas: [{ segmento: 'Compra por caja', tiendas: '3', compras_mes: '2.5', ticket_promedio_centavos: '180000' }],
    ventas_diarias: [{ fecha: '2026-10-29', total_centavos: '360000' }],
    cuentas_por_cobrar: [{ pendiente_centavos: 205000, vencida_centavos: 42000, cuentas_vencidas: 1, vencen_esta_semana: 2 }],
  };

  // Las consultas nuevas leen las mismas tablas: se reconocen por lo que piden
  const porConsulta: [string, Record<string, unknown>[]][] = [
    ['unidades_mes', [{ producto_id: 'AZ-1000', nombre: 'Azúcar refinada 1 kg', unidades_mes: '900' }]],
    ['ORDER BY vencida', [{ tienda_id: 'es', tienda_nombre: 'Tienda La Esquina', saldo_centavos: '75600', vence: new Date('2026-10-31T00:00:00Z'), vencida: 1 }]],
    ['min(creado_en)', [
      { tienda_id: 'dr', tienda_nombre: 'Tienda Doña Rosa', primera: '2026-10-20', ultima: '2026-11-02' },
      { tienda_id: 'sj', tienda_nombre: 'Tienda San Juan', primera: '2026-08-01', ultima: '2026-09-15' },
      { tienda_id: 'ec', tienda_nombre: 'Minimarket El Cruce', primera: '2026-08-01', ultima: '2026-11-01' },
    ]],
    ['metodo_pago, count', [{ metodo_pago: 'credito', pedidos: '4', total_centavos: '520000' }]],
    ['FROM riesgo_mora', [{ tienda_id: 'es', tienda_nombre: 'Tienda La Esquina', riesgo: '0.7800', saldo_centavos: '75600', cuentas_vencidas: 1 }]],
  ];
  const responder = async (sql: string) => {
    const propia = porConsulta.find(([marca]) => sql.includes(marca));
    const tabla = Object.keys(respuestas).find((t) => sql.includes(`FROM ${t}`))!;
    return { columnas: [], truncado: false, filas: propia ? propia[1] : respuestas[tabla] };
  };

  it('arma los tableros pasando por la guardia y dejando auditoría con origen «tablero»', async () => {
    const auditoria: RegistroDeAuditoria[] = [];
    const reportes = new ConsultarReportes({ consultar: responder }, { registrar: async (r) => void auditoria.push(r) });

    const tableros = await new ConsultarTableros(reportes, () => new Date('2026-11-03T12:00:00Z')).ejecutar({
      usuarioId: 'u1',
      orgId: 'lp',
    });

    expect(tableros.demanda[0].producto_id).toBe('AR-0100');
    expect(tableros.segmentos).toEqual([
      { segmento: 'Compra por caja', tiendas: 3, compras_mes: 2.5, ticket_promedio_centavos: 180000 },
    ]);
    expect(tableros.ventas).toEqual([{ fecha: '2026-10-29', total_centavos: 360000 }]);
    expect(tableros.cobranza).toEqual({
      pendiente_centavos: 205000,
      vencida_centavos: 42000,
      cuentas_vencidas: 1,
      vencen_esta_semana: 2,
    });
    expect(tableros.masVendidos).toEqual([{ producto_id: 'AZ-1000', nombre: 'Azúcar refinada 1 kg', unidades_mes: 900 }]);
    expect(tableros.teDeben).toEqual([
      { tienda_id: 'es', tienda_nombre: 'Tienda La Esquina', saldo_centavos: 75600, vence: '2026-10-31', vencida: true },
    ]);
    // Doña Rosa compró por primera vez hace 2 semanas; San Juan no vuelve desde septiembre; El Cruce sigue comprando
    expect(tableros.tiendas).toEqual({
      nuevas: [{ tienda_id: 'dr', tienda_nombre: 'Tienda Doña Rosa', desde: '2026-10-20' }],
      dejaron: [{ tienda_id: 'sj', tienda_nombre: 'Tienda San Juan', ultima: '2026-09-15' }],
    });
    expect(tableros.formasDePago).toEqual([{ metodo_pago: 'credito', pedidos: 4, total_centavos: 520000 }]);
    expect(tableros.mora).toEqual([
      { tienda_id: 'es', tienda_nombre: 'Tienda La Esquina', riesgo: 0.78, saldo_centavos: 75600, cuentas_vencidas: 1 },
    ]);
    expect(auditoria).toHaveLength(10);
    expect(auditoria.every((r) => r.origen === 'tablero' && r.resultado === 'ok')).toBe(true);
  });

  it('sin cuentas por cobrar todo queda en cero', async () => {
    const reportes = new ConsultarReportes(
      { consultar: async () => ({ columnas: [], truncado: false, filas: [] }) },
      { registrar: async () => {} },
    );
    const { cobranza, demanda } = await new ConsultarTableros(reportes).ejecutar({ usuarioId: 'u1', orgId: 'lp' });
    expect(cobranza).toEqual({ pendiente_centavos: 0, vencida_centavos: 0, cuentas_vencidas: 0, vencen_esta_semana: 0 });
    expect(demanda).toEqual([]);
  });

  it('la guardia acepta las consultas de los tableros y de los agentes', async () => {
    const consultas: string[] = [];
    const reportes = new ConsultarReportes(
      {
        consultar: async (sql) => {
          consultas.push(sql);
          return { columnas: [], truncado: false, filas: [] };
        },
      },
      { registrar: async () => {} },
    );
    await new ConsultarTableros(reportes).ejecutar({ usuarioId: 'u1', orgId: 'lp' });
    expect(consultas).toHaveLength(10);
    for (const sql of consultas) expect(validarConsulta(sql).ok).toBe(true);
  });
});
