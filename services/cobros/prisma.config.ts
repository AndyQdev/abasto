import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/semilla.mjs',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://cobros:cobros@localhost:5440/cobros',
  },
});
