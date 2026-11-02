/**
 * Reglas de DDD que se prueban en cada PR (`pnpm arquitectura`).
 * dominio ← aplicacion ← infraestructura / interfaz. Nunca al revés. Vale igual para el módulo src/mi-negocio.
 */
module.exports = {
  forbidden: [
    {
      name: 'dominio-puro',
      comment: 'El dominio no conoce Nest, Prisma, GraphQL ni las otras capas.',
      severity: 'error',
      from: { path: '^src/(mi-negocio/)?dominio' },
      to: {
        path: ['^src/(mi-negocio/)?(aplicacion|infraestructura|interfaz)', 'node_modules/(@nestjs|@prisma|prisma|graphql|express|jose)'],
      },
    },
    {
      name: 'aplicacion-sin-detalles',
      comment: 'Los casos de uso no conocen Nest ni cómo se guarda o se expone nada.',
      severity: 'error',
      from: { path: '^src/(mi-negocio/)?aplicacion' },
      to: { path: ['^src/(mi-negocio/)?(infraestructura|interfaz)', 'node_modules/(@nestjs|@prisma|prisma|graphql|express)'] },
    },
    {
      name: 'infraestructura-no-usa-interfaz',
      severity: 'error',
      from: { path: '^src/(mi-negocio/)?infraestructura' },
      to: { path: '^src/(mi-negocio/)?interfaz' },
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
