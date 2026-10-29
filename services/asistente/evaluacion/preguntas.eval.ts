// Evaluación del Analista contra PostgreSQL real y el modelo de lenguaje configurado.
// `pnpm --filter @abasto/asistente evaluar` (necesita `pnpm infra`). Usa Claude si hay ANTHROPIC_API_KEY;
// sin llave usa el modelo simulado, que solo sirve para comprobar que el evaluador funciona.
import { execSync } from 'node:child_process';
import { ModeloAnthropic } from '../src/infraestructura/modelos/modelo.anthropic.js';
import { ModeloSimulado } from '../src/infraestructura/modelos/modelo.simulado.js';
import { crearPoolLector } from '../src/infraestructura/postgres/conexiones.js';
import { ConsultorPostgres } from '../src/infraestructura/postgres/consultor.pg.js';
import { ConsultarReportes } from '../src/reportes/aplicacion/consultar-reportes.js';
import { ResponderPregunta } from '../src/reportes/aplicacion/responder-pregunta.js';
import { META_DE_ACIERTOS, PREGUNTAS, respuestaCorrecta } from './preguntas.js';

const conClaude = Boolean(process.env.ANTHROPIC_API_KEY);
const solicitante = { usuarioId: 'evaluacion', orgId: 'lp' };

describe(`Analista con ${conClaude ? 'Claude' : 'modelo simulado'}`, () => {
  const lector = crearPoolLector();
  const consultor = new ConsultorPostgres(lector);
  const reportes = new ConsultarReportes(consultor, { registrar: async () => undefined });
  const analista = new ResponderPregunta(conClaude ? new ModeloAnthropic() : new ModeloSimulado(), reportes);

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
    if (conClaude) expect(aciertos).toBeGreaterThanOrEqual(META_DE_ACIERTOS);
    else expect(aciertos).toBeGreaterThan(0);
  }, 600_000);
});
