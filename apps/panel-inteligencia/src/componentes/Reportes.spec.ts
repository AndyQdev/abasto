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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { headers: { 'content-type': 'application/json' } });
const sinSenal = (sin: boolean) => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(!sin);

describe('Reportes sin señal', () => {
  it('lo dicho por voz sin señal queda guardado y se responde solo al volver la señal', async () => {
    const senal = sinSenal(true);
    const pedir = vi.fn(async () => json(respuesta));
    vi.stubGlobal('fetch', pedir);
    const pantalla = mount(Reportes, { props: { sesion, voz }, attachTo: document.body });

    // Whisper transcribe dentro del navegador aunque no haya red
    await pantalla.get('button.microfono').trigger('click');
    await flushPromises();
    await pantalla.get('button.microfono').trigger('click');
    await flushPromises();

    expect(pedir).not.toHaveBeenCalled();
    expect(pantalla.get('.aviso-senal').text()).toContain('tu pregunta quedó guardada');
    expect(pantalla.get('.pendientes').text()).toContain('cuánto me deben');

    senal.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    await flushPromises();

    expect(pedir).toHaveBeenCalledTimes(1);
    expect(pantalla.find('.pendientes').exists()).toBe(false);
    expect(pantalla.text()).toContain('Bs 1.200,00');
    expect(pantalla.get('.aviso-senal').text()).toContain('Volvió la señal');
    pantalla.unmount();
  });

  it('sin señal muestra el último reporte guardado de la misma pregunta y no deja exportar', async () => {
    const senal = sinSenal(false);
    vi.stubGlobal('fetch', vi.fn(async () => json(respuesta)));
    const pantalla = mount(Reportes, { props: { sesion, voz } });
    await pantalla.get('input').setValue('cuánto me deben');
    await pantalla.get('form').trigger('submit');
    await flushPromises();
    pantalla.unmount();

    senal.mockReturnValue(false);
    const otra = mount(Reportes, { props: { sesion, voz } });
    expect(otra.get('.guardados').text()).toContain('cuánto me deben');
    senal.mockReturnValue(true);
    await otra.get('input').setValue('¿Cuánto me deben?');
    // Se cae la red a mitad: fetch lanza TypeError
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await otra.get('form').trigger('submit');
    await flushPromises();

    expect(otra.get('.aviso-senal').text()).toContain('último reporte guardado');
    expect(otra.text()).toContain('guardado el');
    expect(otra.text()).toContain('Bs 1.200,00');
    expect(otra.get('.resultado .boton-primario').attributes('disabled')).toBeDefined();
  });

  it('si el Asistente dice que no (no es falta de red), se muestra el error y no se encola', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'La tabla x no está disponible' }), { status: 400 })));
    const pantalla = mount(Reportes, { props: { sesion, voz } });
    await pantalla.get('form').trigger('submit');
    await flushPromises();

    expect(pantalla.get('.falla').text()).toBe('La tabla x no está disponible');
    expect(pantalla.find('.pendientes').exists()).toBe(false);
  });
});

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
