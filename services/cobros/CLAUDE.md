# Cobros · NestJS · DDD · dueño: Andrés

Pagos por QR, crédito, cuotas y comisiones. Base `cobros` en Postgres (5440) con Prisma 7, puerto 8083, subgrafo GraphQL (`schema.graphql`).

- `dominio/`: agregados y objetos de valor (LineaDeCredito, Dinero). No importa Nest ni Prisma.
- `aplicacion/`: casos de uso (AutorizarCredito, LiberarCredito).
- `infraestructura/`: Prisma (el cliente se genera en `persistencia/generado` y no se versiona) y seguridad con jose.
- `interfaz/`: GraphQL y HTTP.
- dependency-cruiser (`pnpm arquitectura`) falla si el dominio importa infraestructura.

Probar: `pnpm --filter @abasto/cobros test`. Migraciones: `pnpm --filter @abasto/cobros prisma:migrar`.
