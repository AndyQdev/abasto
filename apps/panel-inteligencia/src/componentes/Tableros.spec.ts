import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SesionDelShell } from '../sesion';
import type { Tableros as DatosDeTableros } from '../tableros/tableros';
import Tableros from './Tableros.vue';

const sesion: SesionDelShell = {
  token: async () => 'token',
  usuario: { id: 'u', nombre: 'Los Pozos', orgId: 'lp', orgNombre: 'Distribuidora Los Pozos', roles: ['mayorista'] },
  urls: { router: '', asistente: 'http://asistente', conecta: '' },
};

const ejemplo: DatosDeTableros = {
  demanda: [
    { producto_id: 'arroz', nombre: 'Arroz', stock: 10, unidades_semana: 20, dias_de_stock: 3 },
    { producto_id: 'aceite', nombre: 'Aceite', stock: 5, unidades_semana: 20, dias_de_stock: 1 },
    { producto_id: 'azucar', nombre: 'Azúcar', stock: 90, unidades_semana: 20, dias_de_stock: 10 },
  ],
  segmentos: [
    { segmento: 'Ocasionales', tiendas: 12, compras_mes: 1, ticket_promedio_centavos: 50000 },
    { segmento: 'Frecuentes', tiendas: 30, compras_mes: 4, ticket_promedio_centavos: 90000 },
  ],
  ventas: [
    { fecha: '2026-10-27', total_centavos: 100000 },
    { fecha: '2026-10-28', total_centavos: 150000 },
    { fecha: '2026-10-29', total_centavos: 250000 },
  ],
  cobranza: { pendiente_centavos: 500000, vencida_centavos: 150000, cuentas_vencidas: 2, vencen_esta_semana: 3 },
};

function responderCon(datos: unknown, estado = 200) {
  return vi.fn(
    async () => new Response(JSON.stringify(datos), { status: estado, headers: { 'content-type': 'application/json' } }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('Pantalla de tableros', () => {
  it('pide los tableros con el token y muestra ventas, cobranza y el stock en riesgo', async () => {
    const pedir = responderCon(ejemplo);
    vi.stubGlobal('fetch', pedir);
    const pantalla = mount(Tableros, { props: { sesion } });

    await flushPromises();

    const [url, opciones] = pedir.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://asistente/v1/tableros');
    expect((opciones.headers as Record<string, string>).authorization).toBe('Bearer token');

    expect(pantalla.text()).toContain('Bs 5.000,00');
    expect(pantalla.text()).toContain('Bs 1.500,00');
    expect(pantalla.text()).toContain('2 cuentas');

    const riesgo = pantalla.findAll('table')[0].findAll('tbody tr');
    expect(riesgo).toHaveLength(2);
    expect(riesgo[0].text()).toContain('Aceite');
    expect(riesgo[0].text()).toContain('1 día');
    expect(riesgo[1].text()).toContain('Arroz');
    expect(riesgo[1].text()).toContain('3 días');
    expect(riesgo.map((f) => f.text()).join(' ')).not.toContain('Azúcar');
  });

  it('sin ventas ni productos en riesgo muestra los dos mensajes de vacío', async () => {
    vi.stubGlobal('fetch', responderCon({ ...ejemplo, ventas: [], demanda: [ejemplo.demanda[2]] }));
    const pantalla = mount(Tableros, { props: { sesion } });

    await flushPromises();

    expect(pantalla.text()).toContain('Todavía no hay ventas confirmadas.');
    expect(pantalla.text()).toContain('Tu stock alcanza para toda la semana.');
  });

  it('muestra quién te debe, el riesgo de mora del ML, lo más vendido, cómo te pagan y las tiendas nuevas o perdidas', async () => {
    vi.stubGlobal(
      'fetch',
      responderCon({
        ...ejemplo,
        masVendidos: [{ producto_id: 'HB-0090', nombre: 'Pasta dental 90 g', unidades_mes: 1800 }],
        teDeben: [
          { tienda_id: 'es', tienda_nombre: 'Tienda La Esquina', saldo_centavos: 75600, vence: '2026-10-31', vencida: true },
          { tienda_id: 'dr', tienda_nombre: 'Tienda Doña Rosa', saldo_centavos: 120000, vence: '2026-11-04', vencida: false },
        ],
        tiendas: {
          nuevas: [{ tienda_id: 'dr', tienda_nombre: 'Tienda Doña Rosa', desde: '2026-10-20' }],
          dejaron: [{ tienda_id: 'sj', tienda_nombre: 'Tienda San Juan', ultima: '2026-09-15' }],
        },
        formasDePago: [{ metodo_pago: 'credito', pedidos: 4, total_centavos: 520000 }],
        mora: [{ tienda_id: 'es', tienda_nombre: 'Tienda La Esquina', riesgo: 0.78, saldo_centavos: 75600, cuentas_vencidas: 1 }],
      }),
    );
    const pantalla = mount(Tableros, { props: { sesion } });
    await flushPromises();

    const deben = pantalla.find('.tablero-te-deben').findAll('tbody tr');
    expect(deben[0].text()).toContain('Vencida (31/10/2026)');
    expect(deben[0].classes()).toContain('vencida');
    expect(deben[1].text()).toContain('Bs 1.200,00');
    expect(pantalla.find('.tablero-mora .riesgo').text()).toBe('78 %');
    expect(pantalla.find('.tablero-mora .riesgo').classes()).toContain('alto');
    expect(pantalla.find('.tablero-mas-vendidos').text()).toContain('Pasta dental 90 g');
    expect(pantalla.find('.tablero-formas-de-pago').text()).toContain('Crédito');
    expect(pantalla.find('.tablero-tiendas').text()).toContain('Tienda Doña Rosa desde 20/10/2026');
    expect(pantalla.find('.tablero-tiendas').text()).toContain('Tienda San Juan última compra 15/09/2026');
  });

  it('con un Asistente que todavía no manda los tableros nuevos, muestra los vacíos sin romperse', async () => {
    vi.stubGlobal('fetch', responderCon(ejemplo));
    const pantalla = mount(Tableros, { props: { sesion } });
    await flushPromises();

    expect(pantalla.text()).toContain('Nadie te debe');
    expect(pantalla.text()).toContain('El ML nocturno todavía no calculó el riesgo');
    expect(pantalla.text()).toContain('Ninguna tienda nueva este mes.');
  });

  it('si el Asistente falla, muestra su mensaje', async () => {
    vi.stubGlobal('fetch', responderCon({ message: 'Asistente caído' }, 500));
    const pantalla = mount(Tableros, { props: { sesion } });

    await flushPromises();

    expect(pantalla.get('.falla').text()).toBe('Asistente caído');
  });
});
