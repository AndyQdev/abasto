import { FaltaPrecisar, ModeloNoDisponible } from '../../reportes/puertos.js';
import { hayVertex, ModeloVertex, type ClienteGemini } from './modelo.vertex.js';

const clienteQueResponde = (text: string | undefined) => {
  const pedidos: Array<Parameters<ClienteGemini['models']['generateContent']>[0]> = [];
  const cliente: ClienteGemini = {
    models: {
      generateContent: async (pedido) => {
        pedidos.push(pedido);
        return { text };
      },
    },
  };
  return { cliente, pedidos };
};

describe('ModeloVertex (Gemini en Vertex AI)', () => {
  it('pide JSON con esquema fijo y devuelve la consulta', async () => {
    const { cliente, pedidos } = clienteQueResponde(
      JSON.stringify({ explicacion: "Una prueba.", bloques: [{ plantilla: "kpis", titulo: "Ventas", sql: "SELECT 1" }] }),
    );
    const modelo = new ModeloVertex(cliente, 'gemini-prueba');

    const consulta = await modelo.generarConsulta('¿cuánto vendí?', 'ventas_diarias(dia, total_centavos)');

    expect(consulta).toEqual({
      sql: 'SELECT 1',
      explicacion: 'Una prueba.',
      grafico: 'tabla',
      bloques: [{ plantilla: 'kpis', titulo: 'Ventas', sql: 'SELECT 1' }],
    });
    expect(pedidos[0].model).toBe('gemini-prueba');
    expect(pedidos[0].contents).toBe('¿cuánto vendí?');
    expect(pedidos[0].config.responseMimeType).toBe('application/json');
    expect(pedidos[0].config.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
    expect(pedidos[0].config.responseJsonSchema).toMatchObject({ required: ['explicacion', 'bloques'] });
    expect(pedidos[0].config.systemInstruction).toContain('ventas_diarias(dia, total_centavos)');
  });

  it.each([
    ['sin texto', undefined],
    ['texto que no es JSON', 'SELECT 1'],
    ['una plantilla que no existe', JSON.stringify({ explicacion: 'x', bloques: [{ plantilla: 'torta', titulo: 'x', sql: 'SELECT 1' }] })],
  ])('falla si la respuesta llega %s', async (_caso, text) => {
    const modelo = new ModeloVertex(clienteQueResponde(text).cliente, 'gemini-prueba');
    await expect(modelo.generarConsulta('¿?', '')).rejects.toThrow('no devolvió una consulta');
  });

  it('si la pregunta es ambigua, pregunta de vuelta con opciones en vez de adivinar', async () => {
    const { cliente } = clienteQueResponde(
      JSON.stringify({
        explicacion: '',
        bloques: [],
        aclaracion: '¿Qué reporte quieres?',
        opciones: ['¿Cuánto vendí este mes?', '¿Qué tiendas me deben?'],
      }),
    );
    const promesa = new ModeloVertex(cliente, 'gemini-prueba').generarConsulta('dame un reporte', '');

    await expect(promesa).rejects.toBeInstanceOf(FaltaPrecisar);
    await expect(promesa).rejects.toMatchObject({
      aclaracion: '¿Qué reporte quieres?',
      opciones: ['¿Cuánto vendí este mes?', '¿Qué tiendas me deben?'],
    });
  });

  it('falla si no hay SQL ni aclaración', async () => {
    const { cliente } = clienteQueResponde(JSON.stringify({ explicacion: 'x', bloques: [{ plantilla: 'tabla', titulo: 'x', sql: ' ' }] }));
    await expect(new ModeloVertex(cliente, 'gemini-prueba').generarConsulta('¿?', '')).rejects.toThrow(
      'no devolvió una consulta',
    );
  });

  it('se activa con un proyecto de Google o una llave de Vertex', () => {
    expect(hayVertex({})).toBe(false);
    expect(hayVertex({ GOOGLE_CLOUD_PROJECT: 'abasto' })).toBe(true);
    expect(hayVertex({ VERTEX_API_KEY: 'x' })).toBe(true);
  });
});

describe('ModeloVertex lee los resultados', () => {
  it('manda la pregunta y los datos, y devuelve hallazgos y recomendaciones', async () => {
    const { cliente, pedidos } = clienteQueResponde(
      JSON.stringify({ hallazgos: ['Vendiste Bs 1.200,00, 20 % más.'], recomendaciones: ['Llama a Tienda Lupita.'] }),
    );
    const lectura = await new ModeloVertex(cliente, 'gemini-prueba').leerResultados('¿cómo vendo más?', [
      { titulo: 'Ventas', columnas: ['ventas_bs'], filas: [{ ventas_bs: 1200 }] },
    ]);

    expect(lectura).toEqual({ hallazgos: ['Vendiste Bs 1.200,00, 20 % más.'], recomendaciones: ['Llama a Tienda Lupita.'] });
    expect(pedidos[0].contents).toContain('¿cómo vendo más?');
    expect(pedidos[0].contents).toContain('"ventas_bs":1200');
    expect(pedidos[0].config.systemInstruction).toContain('recomendaciones');
  });

  it('si la lectura no llega bien, devuelve null y no reintenta', async () => {
    const generateContent = vi.fn().mockResolvedValue({ text: 'no es json' });
    await expect(new ModeloVertex({ models: { generateContent } }, 'g').leerResultados('¿?', [])).resolves.toBeNull();
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});

describe('ModeloVertex cuando Vertex se cuelga', () => {
  const respuestaBuena = { text: JSON.stringify({ explicacion: 'x', bloques: [{ plantilla: 'tabla', titulo: 'x', sql: 'SELECT 1' }] }) };

  it('reintenta una vez si el primer pedido falla', async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(new Error('504 DEADLINE_EXCEEDED'))
      .mockResolvedValueOnce(respuestaBuena);
    const modelo = new ModeloVertex({ models: { generateContent } }, 'gemini-prueba');

    await expect(modelo.generarConsulta('¿cuánto vendí?', '')).resolves.toMatchObject({ sql: 'SELECT 1' });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('si falla dos veces avisa que el modelo no está disponible', async () => {
    const generateContent = vi.fn().mockRejectedValue(new Error('504 DEADLINE_EXCEEDED'));
    const modelo = new ModeloVertex({ models: { generateContent } }, 'gemini-prueba');

    await expect(modelo.generarConsulta('¿cuánto vendí?', '')).rejects.toBeInstanceOf(ModeloNoDisponible);
  });
});
