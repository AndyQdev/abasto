import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SUGERENCIAS } from '../reportes/conversacion';
import type { SesionDelShell } from '../sesion';
import type { EventosDeEscucha } from '../voz/escucha';
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
  modelo: 'gemini-3.8-flash',
};

/** Micrófono y Whisper de mentira: dice `dicho` y la prueba decide cuándo se calla. */
function vozFalsa(dicho = 'cuánto me deben') {
  let eventos: EventosDeEscucha | null = null;
  const dependencias: DependenciasDeVoz = {
    escuchar: async (e) => {
      eventos = e;
      return { audio: () => new Float32Array(32_000), hablo: true, finDeLaVoz: 1.65, duracion: 2, detener: () => new Float32Array(32_000) };
    },
    transcriptor: { transcribir: async () => dicho },
    cadaMs: 20,
  };
  return { dependencias, callar: () => eventos?.callo() };
}

// Una pantalla que queda montada seguiría escuchando «online» y respondería las preguntas de la prueba siguiente
enableAutoUnmount(afterEach);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
const sinSenal = (sin: boolean) => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(!sin);
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function preguntar(pantalla: VueWrapper, texto: string) {
  await pantalla.get('input.rp-entrada').setValue(texto);
  await pantalla.get('form').trigger('submit');
  await flushPromises();
}

const chat = (p: VueWrapper) => p.get('.rp-chat');
const mesa = (p: VueWrapper) => p.get('.rp-mesa');

/** Un diagnóstico del negocio: KPIs con el período anterior, una dona y la lectura del Analista. */
const diagnostico = {
  ...respuesta,
  pregunta: '¿cómo va mi negocio?',
  explicacion: 'Cómo va tu negocio en los últimos 30 días.',
  columnas: ['ventas_centavos', 'ventas_centavos_anterior'],
  filas: [{ ventas_centavos: '120000', ventas_centavos_anterior: '100000' }],
  grafico: 'tabla',
  bloques: [
    {
      titulo: 'Últimos 30 días', sql: 'SELECT 1', plantilla: 'kpis', pedida: 'kpis', alternativas: ['kpis', 'tabla'],
      columnas: ['ventas_centavos', 'ventas_centavos_anterior'], filas: [{ ventas_centavos: '120000', ventas_centavos_anterior: '100000' }], truncado: false,
    },
    {
      titulo: 'Cómo te pagan', sql: 'SELECT 2', plantilla: 'dona', pedida: 'dona', alternativas: ['barras', 'dona', 'tabla'],
      columnas: ['metodo_pago', 'total_centavos'], filas: [{ metodo_pago: 'qr', total_centavos: '75000' }, { metodo_pago: 'credito', total_centavos: '25000' }], truncado: false,
    },
  ],
  lectura: { hallazgos: ['Vendiste Bs 1.200,00, 20 % más que los 30 días anteriores.'], recomendaciones: ['Llama a las tiendas que dejaron de comprar.'] },
};

describe('Reportes con plantillas (10/11)', () => {
  it('una vista arma cada bloque con su plantilla: KPIs con variación, dona con leyenda y la lectura del Analista', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(diagnostico)));
    const pantalla = mount(Reportes, { props: { sesion } });
    await preguntar(pantalla, '¿cómo va mi negocio?');

    const m = mesa(pantalla);
    expect(m.findAll('.rp-bloque')).toHaveLength(2);
    expect(m.get('.rp-numero').text()).toContain('Bs 1.200,00');
    expect(m.get('.rp-variacion').text()).toContain('+20,0 %');
    expect(m.get('.rp-variacion').classes()).toContain('sube');
    expect(m.findAll('.dona circle.porcion')).toHaveLength(2);
    expect(m.get('.dona-leyenda').text()).toContain('75 %');
    expect(m.get('.rp-lectura').text()).toContain('Lo que veo');
    expect(m.get('.rp-recomendaciones').text()).toContain('Llama a las tiendas');
  });

  it('«Ver como» cambia la plantilla del bloque a otra en la que encajan los datos', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(diagnostico)));
    const pantalla = mount(Reportes, { props: { sesion } });
    await preguntar(pantalla, '¿cómo va mi negocio?');

    const dona = mesa(pantalla).findAll('.rp-bloque')[1];
    await dona.get('.rp-ver-como button[title="Ver como barras"]').trigger('click');
    expect(dona.findAll('rect.barra')).toHaveLength(2);
    expect(dona.find('.dona').exists()).toBe(false);
  });

  it('el Excel de una vista va con una hoja por bloque', async () => {
    const pedir = vi.fn(async (url: string) => (String(url).endsWith('/excel') ? new Response(new Blob(['x'])) : json(diagnostico)));
    vi.stubGlobal('fetch', pedir);
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const pantalla = mount(Reportes, { props: { sesion } });
    await preguntar(pantalla, '¿cómo va mi negocio?');

    await mesa(pantalla).get('.rp-excel').trigger('click');
    await flushPromises();
    const cuerpo = JSON.parse(String((pedir.mock.calls[1] as unknown as [string, RequestInit])[1].body));
    expect(cuerpo.hojas.map((h: { titulo: string }) => h.titulo)).toEqual(['Últimos 30 días', 'Cómo te pagan']);
  });
});

describe('Reportes como chat con mesa de trabajo', () => {
  it('la pregunta queda en el chat y el reporte se arma en la mesa con su gráfico y su resumen', async () => {
    const pedir = vi.fn(async () => json(respuesta));
    vi.stubGlobal('fetch', pedir);
    const pantalla = mount(Reportes, { props: { sesion } });

    await preguntar(pantalla, 'cuánto me deben');

    expect(JSON.parse(String((pedir.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ texto: 'cuánto me deben' });
    expect(chat(pantalla).get('.rp-fila.tu').text()).toContain('cuánto me deben');
    expect(chat(pantalla).find('.rp-visto').exists()).toBe(true);
    expect(chat(pantalla).get('.rp-globo.reporte').text()).toContain('Lo que debe cada tienda.');
    expect(mesa(pantalla).get('[role="tab"][aria-selected="true"]').text()).toContain('Cuánto me deben');
    expect(mesa(pantalla).get('svg[role="img"]').attributes('aria-label')).toBe('Saldo por tienda');
    expect(mesa(pantalla).findAll('rect.barra')).toHaveLength(2);
    expect(mesa(pantalla).get('.rp-resumen').text()).toContain('Bs 2.050,00');
    expect(mesa(pantalla).text()).toContain('Bs 1.200,00');
  });

  it('una sola fila con números se ve en grande; si el modelo pide tabla, no hay gráfico', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ ...respuesta, grafico: 'tabla', columnas: ['total_centavos', 'pedidos'], filas: [{ total_centavos: '4500000', pedidos: '64' }] }))
        .mockResolvedValueOnce(json({ ...respuesta, grafico: 'tabla' })),
    );
    const pantalla = mount(Reportes, { props: { sesion } });

    await preguntar(pantalla, '¿Cuánto vendí este mes?');
    expect(mesa(pantalla).findAll('.rp-numero').map((n) => n.text())).toEqual(['TotalBs 45.000,00', 'Pedidos64']);

    await preguntar(pantalla, 'cuánto me deben');
    expect(mesa(pantalla).find('svg[role="img"]').exists()).toBe(false);
    expect(mesa(pantalla).findAll('tbody tr')).toHaveLength(2);
  });

  it('cada pregunta abre su pestaña; desde el chat se vuelve a una anterior y se puede cerrar', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json(respuesta))
        .mockResolvedValueOnce(json({ ...respuesta, pregunta: 'lo más vendido', explicacion: 'Lo que más sale.', columnas: ['nombre', 'vendidas'], filas: [{ nombre: 'Arroz', vendidas: 9 }, { nombre: 'Azúcar', vendidas: 5 }] })),
    );
    const pantalla = mount(Reportes, { props: { sesion } });
    await preguntar(pantalla, 'cuánto me deben');
    await preguntar(pantalla, 'lo más vendido');

    expect(mesa(pantalla).findAll('[role="tab"]').map((t) => t.text())).toEqual(['Cuánto me deben', 'Lo más vendido']);
    expect(mesa(pantalla).text()).toContain('Arroz');

    await chat(pantalla).findAll('.rp-tarjeta')[0].trigger('click');
    expect(mesa(pantalla).text()).toContain('Tienda Doña Rosa');

    await mesa(pantalla).get('[aria-label="Cerrar Cuánto me deben"]').trigger('click');
    expect(mesa(pantalla).findAll('[role="tab"]')).toHaveLength(1);
    expect(chat(pantalla).text()).toContain('Cerraste este reporte.');
    expect(mesa(pantalla).text()).toContain('Arroz');
  });

  it('la misma pregunta otra vez actualiza su pestaña en lugar de abrir otra igual', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json(respuesta))
        .mockResolvedValueOnce(json({ ...respuesta, filas: [{ tienda_nombre: 'Tienda Doña Rosa', saldo_centavos: 50000 }] })),
    );
    const pantalla = mount(Reportes, { props: { sesion } });
    await preguntar(pantalla, 'cuánto me deben');
    await preguntar(pantalla, '¿Cuánto me deben?');

    expect(mesa(pantalla).findAll('[role="tab"]')).toHaveLength(1);
    expect(mesa(pantalla).text()).toContain('Bs 500,00');
    // Las dos respuestas del chat llevan a la misma pestaña, ya al día
    expect(chat(pantalla).findAll('.rp-tarjeta')).toHaveLength(2);
    expect(chat(pantalla).text()).not.toContain('Cerraste este reporte.');
  });

  it('la conversación sigue al volver de otra pantalla; «Nueva» la borra', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(respuesta)));
    const primera = mount(Reportes, { props: { sesion } });
    await preguntar(primera, 'cuánto me deben');
    primera.unmount();

    const otra = mount(Reportes, { props: { sesion } });
    expect(chat(otra).get('.rp-fila.tu').text()).toContain('cuánto me deben');
    expect(mesa(otra).text()).toContain('Tienda Doña Rosa');

    await otra.get('.rp-chat-cabecera button').trigger('click');
    expect(otra.find('.rp-fila.tu').exists()).toBe(false);
    expect(mesa(otra).text()).toContain('Mesa de trabajo');
  });

  it('una plantilla de la mesa vacía pregunta con un toque', async () => {
    const pedir = vi.fn(async () => json(respuesta));
    vi.stubGlobal('fetch', pedir);
    const pantalla = mount(Reportes, { props: { sesion } });

    await mesa(pantalla).findAll('.rp-plantilla')[0].trigger('click');
    await flushPromises();
    expect(JSON.parse(String((pedir.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ texto: SUGERENCIAS[0].pregunta });
    expect(mesa(pantalla).text()).toContain('Tienda Doña Rosa');
  });
});

describe('Preguntar hablando', () => {
  it('mientras hablas, la burbuja muestra lo que se entiende; al callarte se pregunta sola', async () => {
    const pedir = vi.fn(async () => json(respuesta));
    vi.stubGlobal('fetch', pedir);
    const voz = vozFalsa();
    const pantalla = mount(Reportes, { props: { sesion, voz: voz.dependencias } });

    await pantalla.get('button[aria-label="Hablar"]').trigger('click');
    await flushPromises();
    expect(pantalla.get('.rp-burbuja.en-vivo').text()).toBe('Te escucho…');
    expect(pantalla.find('button[aria-label="Listo, ya terminé"]').exists()).toBe(true);

    await esperar(60);
    await flushPromises();
    expect(pantalla.get('.rp-burbuja.en-vivo').text()).toBe('cuánto me deben');
    expect(pedir).not.toHaveBeenCalled();

    voz.callar();
    await flushPromises();
    expect(pantalla.find('.rp-burbuja.en-vivo').exists()).toBe(false);
    expect(JSON.parse(String((pedir.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ texto: 'cuánto me deben' });
    // La burbuja que queda dice que fue dictada
    expect(chat(pantalla).find('.rp-fila.tu .rp-meta svg').exists()).toBe(true);
    expect(mesa(pantalla).text()).toContain('Bs 1.200,00');
  });
});

describe('Reportes sin señal', () => {
  it('lo dicho por voz sin señal espera en el chat y se responde solo al volver la señal', async () => {
    const senal = sinSenal(true);
    const pedir = vi.fn(async () => json(respuesta));
    vi.stubGlobal('fetch', pedir);
    const voz = vozFalsa();
    const pantalla = mount(Reportes, { props: { sesion, voz: voz.dependencias }, attachTo: document.body });

    // Whisper transcribe dentro del navegador aunque no haya red
    await pantalla.get('button[aria-label="Hablar"]').trigger('click');
    await flushPromises();
    voz.callar();
    await flushPromises();

    expect(pedir).not.toHaveBeenCalled();
    expect(chat(pantalla).get('.rp-burbuja.espera').text()).toContain('cuánto me deben');
    expect(chat(pantalla).get('.rp-globo.aviso').text()).toContain('tu pregunta quedó guardada');

    senal.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    await flushPromises();

    expect(pedir).toHaveBeenCalledTimes(1);
    expect(chat(pantalla).find('.rp-burbuja.espera').exists()).toBe(false);
    expect(chat(pantalla).text()).toContain('Volvió la señal');
    expect(mesa(pantalla).text()).toContain('Bs 1.200,00');
  });

  it('sin señal muestra el último reporte guardado de la misma pregunta y no deja exportar', async () => {
    const senal = sinSenal(false);
    vi.stubGlobal('fetch', vi.fn(async () => json(respuesta)));
    const primera = mount(Reportes, { props: { sesion } });
    await preguntar(primera, 'cuánto me deben');
    primera.unmount();
    sessionStorage.clear(); // otro día: la conversación ya no está, lo guardado en el equipo sí

    const otra = mount(Reportes, { props: { sesion } });
    expect(mesa(otra).get('.rp-guardados').text()).toContain('cuánto me deben');
    // Se cae la red a mitad: fetch lanza TypeError
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    senal.mockReturnValue(true);
    await preguntar(otra, '¿Cuánto me deben?');

    expect(chat(otra).text()).toContain('último reporte guardado');
    expect(mesa(otra).text()).toContain('guardado el');
    expect(mesa(otra).text()).toContain('Bs 1.200,00');
    expect(mesa(otra).get('.rp-excel').attributes('disabled')).toBeDefined();
  });

  it('si el Asistente dice que no (no es falta de red), se muestra el error y no se encola', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ message: 'La tabla x no está disponible' }, 400)));
    const pantalla = mount(Reportes, { props: { sesion } });
    await preguntar(pantalla, 'la tabla x');

    expect(chat(pantalla).get('.rp-globo.falla').text()).toBe('La tabla x no está disponible');
    expect(chat(pantalla).find('.rp-burbuja.espera').exists()).toBe(false);
    expect(localStorage.getItem('abasto:inteligencia:pendientes:lp')).toBeNull();
  });
});

describe('Pregunta ambigua', () => {
  it('el Analista pregunta de vuelta en el chat y responde la opción elegida con un toque', async () => {
    sinSenal(false);
    const pedir = vi
      .fn()
      .mockResolvedValueOnce(json({ statusCode: 422, message: '¿Qué reporte quieres ver?', opciones: ['¿Cuánto me deben?', '¿Cuánto vendí este mes?'] }, 422))
      .mockResolvedValueOnce(json(respuesta));
    vi.stubGlobal('fetch', pedir);
    const pantalla = mount(Reportes, { props: { sesion } });

    await preguntar(pantalla, 'dame un reporte');

    const aclaracion = chat(pantalla).get('.rp-globo.aclaracion');
    expect(aclaracion.get('p').text()).toBe('¿Qué reporte quieres ver?');
    const opciones = aclaracion.findAll('.rp-chip');
    expect(opciones.map((b) => b.text())).toEqual(['¿Cuánto me deben?', '¿Cuánto vendí este mes?']);
    expect(mesa(pantalla).find('[role="tab"]').exists()).toBe(false);

    await opciones[0].trigger('click');
    await flushPromises();

    expect(JSON.parse(pedir.mock.calls[1][1].body)).toEqual({ texto: '¿Cuánto me deben?' });
    expect(mesa(pantalla).text()).toContain('Lo que debe cada tienda.');
  });
});
