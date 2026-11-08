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
      JSON.stringify({ sql: 'SELECT 1', explicacion: 'Una prueba.', grafico: 'tabla' }),
    );
    const modelo = new ModeloVertex(cliente, 'gemini-prueba');

    const consulta = await modelo.generarConsulta('¿cuánto vendí?', 'ventas_diarias(dia, total_centavos)');

    expect(consulta).toEqual({ sql: 'SELECT 1', explicacion: 'Una prueba.', grafico: 'tabla' });
    expect(pedidos[0].model).toBe('gemini-prueba');
    expect(pedidos[0].contents).toBe('¿cuánto vendí?');
    expect(pedidos[0].config.responseMimeType).toBe('application/json');
    expect(pedidos[0].config.responseJsonSchema).toMatchObject({ required: ['sql', 'explicacion', 'grafico'] });
    expect(pedidos[0].config.systemInstruction).toContain('ventas_diarias(dia, total_centavos)');
  });

  it.each([
    ['sin texto', undefined],
    ['texto que no es JSON', 'SELECT 1'],
    ['un gráfico que no existe', JSON.stringify({ sql: 'SELECT 1', explicacion: 'x', grafico: 'torta' })],
  ])('falla si la respuesta llega %s', async (_caso, text) => {
    const modelo = new ModeloVertex(clienteQueResponde(text).cliente, 'gemini-prueba');
    await expect(modelo.generarConsulta('¿?', '')).rejects.toThrow('no devolvió una consulta');
  });

  it('se activa con un proyecto de Google o una llave de Vertex', () => {
    expect(hayVertex({})).toBe(false);
    expect(hayVertex({ GOOGLE_CLOUD_PROJECT: 'abasto' })).toBe(true);
    expect(hayVertex({ VERTEX_API_KEY: 'x' })).toBe(true);
  });
});
