import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SesionDelShell } from '../sesion';
import type { DependenciasDeVoz } from '../voz/usar-voz';
import Reportes from './Reportes.vue';

const sesion: SesionDelShell = {
  token: async () => 'token',
  usuario: { id: 'u', nombre: 'Los Pozos', orgId: 'lp', orgNombre: 'Distribuidora Los Pozos', roles: ['mayorista'] },
  urls: { router: '', asistente: 'http://asistente', conecta: '' },
};

const respuesta = {
  pregunta: 'cuánto me deben',
  sql: 'SELECT ...',
  explicacion: 'Lo que debe cada tienda.',
  grafico: 'barras',
  columnas: ['tienda_nombre', 'saldo_centavos'],
  filas: [
    { tienda_nombre: 'Tienda Doña Rosa', saldo_centavos: 120000 },
    { tienda_nombre: 'Minimarket El Cruce', saldo_centavos: 85000 },
  ],
  truncado: false,
  modelo: 'simulado',
};

const voz: DependenciasDeVoz = {
  grabar: async () => ({ detener: async () => new Blob(['audio']) }),
  convertir: async () => new Float32Array(16_000),
  transcriptor: { transcribir: async () => 'cuánto me deben' },
};

afterEach(() => vi.unstubAllGlobals());

describe('Pantalla de reportes', () => {
  it('lo dicho por voz se escribe en la pregunta, se pregunta solo y se dibuja el gráfico', async () => {
    const pedir = vi.fn(async () => new Response(JSON.stringify(respuesta), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', pedir);
    const pantalla = mount(Reportes, { props: { sesion, voz } });

    await pantalla.get('button.microfono').trigger('click');
    await flushPromises();
    expect(pantalla.get('button.microfono').text()).toBe('Detener y preguntar');

    await pantalla.get('button.microfono').trigger('click');
    await flushPromises();

    expect((pantalla.get('input').element as HTMLInputElement).value).toBe('cuánto me deben');
    expect(JSON.parse(String((pedir.mock.calls[0] as unknown[])[1] && ((pedir.mock.calls[0] as unknown[])[1] as RequestInit).body))).toEqual({
      texto: 'cuánto me deben',
    });
    expect(pantalla.get('svg[role="img"]').attributes('aria-label')).toBe('Saldo por tienda');
    expect(pantalla.text()).toContain('Bs 1.200,00');
    expect(pantalla.findAll('rect.barra')).toHaveLength(2);
  });

  it('si el modelo pide tabla, no dibuja gráfico', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ...respuesta, grafico: 'tabla' }), { headers: { 'content-type': 'application/json' } })),
    );
    const pantalla = mount(Reportes, { props: { sesion, voz } });

    await pantalla.get('form').trigger('submit');
    await flushPromises();

    expect(pantalla.find('svg[role="img"]').exists()).toBe(false);
    expect(pantalla.findAll('tbody tr')).toHaveLength(2);
  });
});
