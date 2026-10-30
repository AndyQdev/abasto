import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SesionDelShell } from '../sesion';
import Agentes from './Agentes.vue';

const sesion: SesionDelShell = {
  token: async () => 'token',
  usuario: { id: 'u', nombre: 'Los Pozos', orgId: 'lp', orgNombre: 'Distribuidora Los Pozos', roles: ['mayorista'] },
  urls: { router: '', asistente: 'http://asistente', conecta: '' },
};

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { headers: { 'content-type': 'application/json' } });

const agentes = [
  { id: 'cobranza', nombre: 'Cobranza', mision: 'Que te paguen a tiempo', habilidades: [], horario: '0 8 * * *', requiereAprobacion: [] },
  { id: 'reposicion', nombre: 'Reposición', mision: 'Que nunca te quedes sin stock', habilidades: [], horario: '0 7 * * *', requiereAprobacion: [] },
];

afterEach(() => vi.unstubAllGlobals());

describe('Pantalla de agentes', () => {
  it('«Revisar ahora» corre todos los agentes, resume lo nuevo y recarga lo que espera aprobación', async () => {
    let propuestas: unknown[] = [];
    const pedir = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/v1/agentes/monitorear')) {
        propuestas = [{ id: 'p1', agenteId: 'reposicion', titulo: 'Pedir 380 u. de Arroz', detalle: 'Te quedan 40 u.', creadaEn: '' }];
        return json({ total: 1, agentes: [{ agenteId: 'cobranza', nuevas: 0 }, { agenteId: 'reposicion', nuevas: 1 }] });
      }
      if (url.endsWith('/v1/agentes/propuestas')) return json(propuestas);
      expect(init?.method ?? 'GET').toBe('GET');
      return json(agentes);
    });
    vi.stubGlobal('fetch', pedir);
    const pantalla = mount(Agentes, { props: { sesion } });
    await flushPromises();
    expect(pantalla.text()).toContain('Ningún agente está esperando una decisión.');

    await pantalla.find('.monitor button').trigger('click');
    await flushPromises();

    const llamada = pedir.mock.calls.find(([url]) => url === 'http://asistente/v1/agentes/monitorear')!;
    expect(llamada[1]?.method).toBe('POST');
    expect(pantalla.find('.resumen').text()).toContain('1 propuestas nuevas');
    expect(pantalla.find('.resumen').text()).toContain('Reposición: 1');
    expect(pantalla.text()).toContain('Pedir 380 u. de Arroz');
  });

  it('si ningún agente encontró algo, lo dice', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/monitorear')) return json({ total: 0, agentes: [{ agenteId: 'cobranza', nuevas: 0 }] });
        return json(url.endsWith('/propuestas') ? [] : agentes);
      }),
    );
    const pantalla = mount(Agentes, { props: { sesion } });
    await flushPromises();
    await pantalla.find('.monitor button').trigger('click');
    await flushPromises();

    expect(pantalla.find('.resumen').text()).toContain('Todo en orden');
  });
});
