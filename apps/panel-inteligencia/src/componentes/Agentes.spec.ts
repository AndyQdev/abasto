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

  it('al aprobar muestra lo que hizo n8n y el WhatsApp listo para abrir', async () => {
    let propuestas: unknown[] = [
      { id: 'p1', agenteId: 'cobranza', titulo: 'Recordar a Doña Rosa que vence A-1051', detalle: 'Saldo Bs 120,00', creadaEn: '' },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/decision')) {
          propuestas = [];
          return json({
            propuesta: { id: 'p1', estado: 'aprobada' },
            ejecucion: { enviado: true, detalle: 'Recordatorio del pedido A-1051 listo', enlace: 'https://wa.me/?text=Hola' },
          });
        }
        return json(url.endsWith('/propuestas') ? propuestas : agentes);
      }),
    );
    const pantalla = mount(Agentes, { props: { sesion } });
    await flushPromises();
    await pantalla.findAll('.propuesta .boton-primario')[0].trigger('click');
    await flushPromises();

    const resultado = pantalla.find('.ejecucion');
    expect(resultado.text()).toContain('Hecho por n8n · Recordar a Doña Rosa que vence A-1051');
    expect(resultado.find('a').attributes('href')).toBe('https://wa.me/?text=Hola');
  });

  it('si n8n no está prendido, la propuesta queda aprobada y lo dice', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/decision')) return json({ ejecucion: { enviado: false, detalle: 'n8n no respondió' } });
        return json(
          url.endsWith('/propuestas') ? [{ id: 'p1', agenteId: 'catalogo', titulo: 'Pausar Atún', detalle: '', creadaEn: '' }] : agentes,
        );
      }),
    );
    const pantalla = mount(Agentes, { props: { sesion } });
    await flushPromises();
    await pantalla.findAll('.propuesta .boton-primario')[0].trigger('click');
    await flushPromises();

    expect(pantalla.find('.ejecucion').text()).toContain('Aprobada, pero no salió · Pausar Atún');
    expect(pantalla.find('.ejecucion a').exists()).toBe(false);
  });
});
