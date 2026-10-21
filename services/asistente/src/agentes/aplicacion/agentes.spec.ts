import { ConsultarReportes } from '../../reportes/aplicacion/consultar-reportes.js';
import type { ConsultorDeReportes } from '../../reportes/puertos.js';
import { PropuestaYaDecidida, type Propuesta } from '../dominio/agente.js';
import type { EjecutorDeAcciones, RepositorioDePropuestas } from '../puertos.js';
import { DecidirPropuesta, EjecutarCobranza } from './agentes.js';

const enMemoria = (): RepositorioDePropuestas & { todas: Map<string, Propuesta> } => {
  const todas = new Map<string, Propuesta>();
  return {
    todas,
    guardar: async (p) => void todas.set(p.id, p),
    buscar: async (_org, id) => todas.get(id) ?? null,
    pendientes: async (org) => [...todas.values()].filter((p) => p.orgId === org && p.estado === 'pendiente'),
  };
};

const tresCuentasQueVencenManana: ConsultorDeReportes = {
  consultar: async () => ({
    columnas: [],
    truncado: false,
    filas: [
      { pedido_id: 'A-1031', tienda_id: 'dr', tienda_nombre: 'Tienda Doña Rosa', saldo_centavos: 120000 },
      { pedido_id: 'A-1033', tienda_id: 'ec', tienda_nombre: 'Minimarket El Cruce', saldo_centavos: 85000 },
      { pedido_id: 'A-1035', tienda_id: 'sj', tienda_nombre: 'Tienda San Juan', saldo_centavos: 42000 },
    ],
  }),
};

describe('Agente de Cobranza', () => {
  const lp = { usuarioId: 'u1', orgId: 'lp' };
  const reportes = new ConsultarReportes(tresCuentasQueVencenManana, { registrar: async () => {} });

  // EjecutarCobranza ni siquiera recibe un ejecutor: proponer es lo único que puede hacer solo
  it('si 3 cuentas vencen mañana, propone 3 recordatorios y no manda ninguno', async () => {
    const propuestas = enMemoria();
    const nuevas = await new EjecutarCobranza(reportes, propuestas).ejecutar(lp);

    expect(nuevas).toHaveLength(3);
    expect(nuevas.every((p) => p.estado === 'pendiente')).toBe(true);
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
    const [primera, segunda] = await new EjecutarCobranza(reportes, propuestas).ejecutar(lp);
    const decidir = new DecidirPropuesta(propuestas, ejecutor);

    await decidir.ejecutar('lp', primera.id, true, 'u1');
    await decidir.ejecutar('lp', segunda.id, false, 'u1');
    await expect(decidir.ejecutar('lp', primera.id, true, 'u1')).rejects.toThrow(PropuestaYaDecidida);

    expect(ejecutadas).toEqual([primera.id]);
  });
});
