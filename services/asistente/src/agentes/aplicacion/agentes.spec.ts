import { ConsultarReportes } from '../../reportes/aplicacion/consultar-reportes.js';
import type { ConsultorDeReportes } from '../../reportes/puertos.js';
import { PropuestaYaDecidida, type Propuesta } from '../dominio/agente.js';
import type { EjecutorDeAcciones, RepositorioDePropuestas } from '../puertos.js';
import {
  DecidirPropuesta,
  EjecutarMision,
  MisionCatalogo,
  MisionCobranza,
  MisionReposicion,
  MonitorearNegocio,
  type Mision,
} from './agentes.js';

const enMemoria = (): RepositorioDePropuestas & { todas: Map<string, Propuesta> } => {
  const todas = new Map<string, Propuesta>();
  return {
    todas,
    guardar: async (p) => void todas.set(p.id, p),
    buscar: async (_org, id) => todas.get(id) ?? null,
    pendientes: async (org) => [...todas.values()].filter((p) => p.orgId === org && p.estado === 'pendiente'),
  };
};

/** Un consultor falso que responde según la tabla que lee la consulta. */
const datos = (porTabla: Record<string, Record<string, unknown>[]>): ConsultarReportes => {
  const consultor: ConsultorDeReportes = {
    consultar: async (sql) => {
      const tabla = Object.keys(porTabla).find((t) => sql.includes(`FROM ${t}`));
      return { columnas: [], truncado: false, filas: tabla ? porTabla[tabla] : [] };
    },
  };
  return new ConsultarReportes(consultor, { registrar: async () => {} });
};

const lp = { usuarioId: 'u1', orgId: 'lp' };

const tresCuentasQueVencenManana = datos({
  cuentas_por_cobrar: [
    { pedido_id: 'A-1031', tienda_id: 'dr', tienda_nombre: 'Tienda Doña Rosa', saldo_centavos: 120000 },
    { pedido_id: 'A-1033', tienda_id: 'ec', tienda_nombre: 'Minimarket El Cruce', saldo_centavos: 85000 },
    { pedido_id: 'A-1035', tienda_id: 'sj', tienda_nombre: 'Tienda San Juan', saldo_centavos: 42000 },
  ],
});

const stockDeLosPozos = datos({
  stock_productos: [
    { producto_id: 'AR-0100', nombre: 'Arroz grano largo 1 kg', stock: 40, vendidas_por_dia: 20 },
    { producto_id: 'AZ-1000', nombre: 'Azúcar refinada 1 kg', stock: 960, vendidas_por_dia: 30 },
    { producto_id: 'AT-0100', nombre: 'Atún en lata 100 g', stock: 0, vendidas_por_dia: 6 },
    { producto_id: 'CL-1000', nombre: 'Cloro 1 L', stock: 0, vendidas_por_dia: 0 },
  ],
  // El ML predijo más arroz que el promedio: manda la predicción
  prediccion_demanda: [{ producto_id: 'AR-0100', semana: '2026-11-02', unidades: 210 }],
});

describe('Agente de Cobranza', () => {
  it('si 3 cuentas vencen mañana, propone 3 recordatorios y no manda ninguno', async () => {
    const propuestas = enMemoria();
    const nuevas = await new EjecutarMision(propuestas).ejecutar(new MisionCobranza(tresCuentasQueVencenManana), lp);

    expect(nuevas).toHaveLength(3);
    expect(nuevas.every((p) => p.estado === 'pendiente' && p.agenteId === 'cobranza')).toBe(true);
    expect(nuevas[0].accion.datos.mensaje).toContain('Bs 1.200,00');
    expect(await propuestas.pendientes('lp')).toHaveLength(3);
  });

  it('solo una propuesta aprobada se ejecuta, y una sola vez', async () => {
    const propuestas = enMemoria();
    const ejecutadas: string[] = [];
    const ejecutor: EjecutorDeAcciones = {
      ejecutar: async (p) => {
        ejecutadas.push(p.id);
        return { enviado: true, detalle: 'n8n recibió la acción' };
      },
    };
    const [primera, segunda] = await new EjecutarMision(propuestas).ejecutar(
      new MisionCobranza(tresCuentasQueVencenManana),
      lp,
    );
    const decidir = new DecidirPropuesta(propuestas, ejecutor);

    await decidir.ejecutar('lp', primera.id, true, 'u1');
    await decidir.ejecutar('lp', segunda.id, false, 'u1');
    await expect(decidir.ejecutar('lp', primera.id, true, 'u1')).rejects.toThrow(PropuestaYaDecidida);

    expect(ejecutadas).toEqual([primera.id]);
  });
});

describe('Agente de Reposición', () => {
  it('pide para dos semanas lo que no alcanza para 7 días, usando la demanda que predijo el ML', async () => {
    const hallazgos = await new MisionReposicion(stockDeLosPozos).buscar(lp);

    expect(hallazgos.map((h) => h.clave)).toEqual(['reposicion:AT-0100', 'reposicion:AR-0100']);
    const arroz = hallazgos[1];
    // 210 u. por semana · 2 semanas − 40 en stock
    expect(arroz.accion).toEqual({
      tipo: 'crear_pedido_a_proveedor',
      datos: { productoId: 'AR-0100', nombre: 'Arroz grano largo 1 kg', cantidad: 380 },
    });
    expect(arroz.detalle).toBe('Te quedan 40 u., alcanzan para 1.3 días. Se espera vender 210 u. esta semana.');
    expect(hallazgos[0].detalle).toContain('Ya no tienes stock');
  });

  it('no propone nada para lo que alcanza o no se vende', async () => {
    const hallazgos = await new MisionReposicion(stockDeLosPozos).buscar(lp);
    expect(hallazgos.map((h) => h.accion.datos.productoId)).not.toContain('AZ-1000');
    expect(hallazgos.map((h) => h.accion.datos.productoId)).not.toContain('CL-1000');
  });
});

describe('Agente de Catálogo', () => {
  it('propone pausar lo que está sin stock, primero lo que las tiendas más piden', async () => {
    const consultas: string[] = [];
    const reportes = new ConsultarReportes(
      {
        consultar: async (sql) => {
          consultas.push(sql);
          return {
            columnas: [],
            truncado: false,
            filas: [
              { producto_id: 'AT-0100', nombre: 'Atún en lata 100 g', vendidas_por_dia: 6 },
              { producto_id: 'CL-1000', nombre: 'Cloro 1 L', vendidas_por_dia: 0 },
            ],
          };
        },
      },
      { registrar: async () => {} },
    );
    const hallazgos = await new MisionCatalogo(reportes).buscar(lp);

    expect(consultas[0]).toContain('WHERE stock = 0');
    expect(hallazgos.map((h) => h.titulo)).toEqual(['Pausar Atún en lata 100 g', 'Pausar Cloro 1 L']);
    expect(hallazgos[0].detalle).toContain('6 u. por día');
    expect(hallazgos.every((h) => h.accion.tipo === 'pausar_producto')).toBe(true);
  });
});

describe('Correr una misión', () => {
  it('no vuelve a proponer lo que todavía espera una decisión', async () => {
    const propuestas = enMemoria();
    const mision = new MisionReposicion(stockDeLosPozos);
    const ejecutar = new EjecutarMision(propuestas);

    expect(await ejecutar.ejecutar(mision, lp)).toHaveLength(2);
    expect(await ejecutar.ejecutar(mision, lp)).toHaveLength(0);
    expect(await propuestas.pendientes('lp')).toHaveLength(2);
  });

  it('una vez decidida, el mismo asunto se puede proponer otra vez', async () => {
    const propuestas = enMemoria();
    const mision = new MisionReposicion(stockDeLosPozos);
    const ejecutar = new EjecutarMision(propuestas);
    const [atun] = await ejecutar.ejecutar(mision, lp);
    await new DecidirPropuesta(propuestas, { ejecutar: async () => ({ enviado: true, detalle: '' }) }).ejecutar(
      'lp',
      atun.id,
      false,
      'u1',
    );

    expect((await ejecutar.ejecutar(mision, lp)).map((p) => p.clave)).toEqual(['reposicion:AT-0100']);
  });
});

describe('Monitorear mi negocio', () => {
  it('corre todas las misiones y resume cuántas propuestas dejó cada agente', async () => {
    const propuestas = enMemoria();
    const misiones: Mision[] = [
      new MisionCobranza(tresCuentasQueVencenManana),
      new MisionReposicion(stockDeLosPozos),
      new MisionCatalogo(stockDeLosPozos),
    ];
    const resumen = await new MonitorearNegocio(misiones, new EjecutarMision(propuestas)).monitorear(lp);

    expect(resumen.agentes).toEqual([
      { agenteId: 'cobranza', nuevas: 3 },
      { agenteId: 'reposicion', nuevas: 2 },
      // el consultor falso devuelve las 4 filas: el filtro stock = 0 lo hace Postgres
      { agenteId: 'catalogo', nuevas: 4 },
    ]);
    expect(resumen.total).toBe(9);
  });

  it('si una misión falla, las demás igual corren y el resumen dice cuál falló', async () => {
    const rota: Mision = {
      agenteId: 'catalogo',
      buscar: async () => {
        throw new Error('Postgres no responde');
      },
    };
    const resumen = await new MonitorearNegocio(
      [rota, new MisionCobranza(tresCuentasQueVencenManana)],
      new EjecutarMision(enMemoria()),
    ).monitorear(lp);

    expect(resumen.agentes[0]).toEqual({ agenteId: 'catalogo', nuevas: 0, error: 'Postgres no responde' });
    expect(resumen.total).toBe(3);
  });
});
