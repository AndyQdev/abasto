/**
 * Reglas de DDD que se prueban en cada PR (`pnpm arquitectura`).
 * Asistente: puertos y adaptadores por módulo (reportes, agentes).
 * <modulo>/dominio ← <modulo>/aplicacion ← infraestructura / interfaz. Nunca al revés.
 */
module.exports = {
  forbidden: [
    {
      name: 'dominio-puro',
      comment: 'El dominio no conoce Nest, la base, el modelo de lenguaje ni las otras capas.',
      severity: 'error',
      from: { path: '^src/(reportes|agentes)/dominio' },
      to: {
        path: ['^src/(reportes|agentes)/aplicacion', '^src/(infraestructura|interfaz|mcp|proyector)', 'node_modules/(@nestjs|pg|@aws-sdk|@google/genai|express|jose|amqplib)'],
      },
    },
    {
      name: 'aplicacion-sin-detalles',
      comment: 'Los casos de uso no conocen Nest ni cómo se guarda o se expone nada.',
      severity: 'error',
      from: { path: '^src/(reportes|agentes)/aplicacion' },
      to: { path: ['^src/(infraestructura|interfaz|mcp|proyector)', 'node_modules/(@nestjs|pg|@aws-sdk|@google/genai|express|amqplib)'] },
    },
    {
      name: 'infraestructura-no-usa-interfaz',
      severity: 'error',
      from: { path: '^src/infraestructura' },
      to: { path: '^src/interfaz' },
    },
    {
      name: 'sin-ciclos',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(\\.spec\\.ts$|/generado/)' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { extensions: ['.ts', '.js'] },
  },
};
