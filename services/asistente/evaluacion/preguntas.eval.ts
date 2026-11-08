// Evaluación del Analista contra PostgreSQL real y el modelo de lenguaje configurado.
// `pnpm --filter @abasto/asistente evaluar` (necesita `pnpm infra`). Usa Gemini en Vertex AI si está configurado (GOOGLE_CLOUD_PROJECT o VERTEX_API_KEY);
// si no, usa el modelo simulado, que solo sirve para comprobar que el evaluador funciona.
import { execSync } from 'node:child_process';
import { hayVertex, ModeloVertex } from '../src/infraestructura/modelos/modelo.vertex.js';
import { ModeloSimulado } from '../src/infraestructura/modelos/modelo.simulado.js';
import { crearPoolLector } from '../src/infraestructura/postgres/conexiones.js';
import { ConsultorPostgres } from '../src/infraestructura/postgres/consultor.pg.js';
import { ConsultarReportes } from '../src/reportes/aplicacion/consultar-reportes.js';
import { ResponderPregunta } from '../src/reportes/aplicacion/responder-pregunta.js';
import { META_DE_ACIERTOS, PREGUNTAS, respuestaCorrecta } from './preguntas.js';

const conGemini = hayVertex();
const solicitante = { usuarioId: 'evaluacion', orgId: 'lp' };

describe(`Analista con ${conGemini ? 'Gemini (Vertex AI)' : 'modelo simulado'}`, () => {
  const lector = crearPoolLector();
  const consultor = new ConsultorPostgres(lector);
  const reportes = new ConsultarReportes(consultor, { registrar: async () => undefined });
  const analista = new ResponderPregunta(conGemini ? new ModeloVertex() : new ModeloSimulado(), reportes);

  beforeAll(() => {
    execSync('node scripts/semilla.mjs', { stdio: 'ignore' }); // datos de demo con fechas relativas a hoy
  });
  afterAll(() => lector.end());

  it(`responde bien al menos ${META_DE_ACIERTOS} de ${PREGUNTAS.length} preguntas`, async () => {
    const informe: string[] = [];
    let aciertos = 0;
    for (const { pregunta, correcta } of PREGUNTAS) {
      const esperado = await consultor.consultar(correcta, solicitante);
      let marca: string;
      try {
        const respuesta = await analista.ejecutar(pregunta, solicitante);
        const bien = respuestaCorrecta(respuesta.filas, esperado.filas);
        if (bien) aciertos++;
        marca = bien ? 'BIEN ' : 'MAL  ';
      } catch (e) {
        marca = `ERROR (${(e as Error).message.slice(0, 60)})`;
      }
      informe.push(`${marca} ${pregunta}`);
    }
    console.log(`\n${informe.join('\n')}\n\nAciertos: ${aciertos}/${PREGUNTAS.length}`);
    // Con el simulado la meta no aplica: no entiende lenguaje natural, solo reconoce las preguntas de la demo
    if (conGemini) expect(aciertos).toBeGreaterThanOrEqual(META_DE_ACIERTOS);
    else expect(aciertos).toBeGreaterThan(0);
  }, 600_000);
});
