/**
 * Reglas de DDD que se prueban en cada PR (`pnpm arquitectura`).
 * Conecta: modular por capas. dominio ← aplicacion ← infraestructura / interfaz. Nunca al revés.
 */
module.exports = {
  forbidden: [
    {
      name: 'dominio-puro',
      comment: 'El dominio no conoce Nest, DynamoDB ni las otras capas.',
      severity: 'error',
      from: { path: '^src/dominio' },
      to: {
        path: ['^src/(aplicacion|infraestructura|interfaz)', 'node_modules/(@nestjs|@aws-sdk|express|jose|zod)'],
      },
    },
    {
      name: 'aplicacion-sin-detalles',
      comment: 'Los casos de uso no conocen Nest ni cómo se guarda o se expone nada.',
      severity: 'error',
      from: { path: '^src/aplicacion' },
      to: { path: ['^src/(infraestructura|interfaz)', 'node_modules/(@nestjs|@aws-sdk|express)'] },
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
