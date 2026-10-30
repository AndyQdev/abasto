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

  it('si el Asistente falla, muestra su mensaje', async () => {
    vi.stubGlobal('fetch', responderCon({ message: 'Asistente caído' }, 500));
    const pantalla = mount(Tableros, { props: { sesion } });

    await flushPromises();

    expect(pantalla.get('.falla').text()).toBe('Asistente caído');
  });
});
