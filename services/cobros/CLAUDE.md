# Cobros · NestJS · DDD · dueño: Andrés

Pagos por QR, crédito, cuotas y comisiones. Base `cobros` en Postgres (5440) con Prisma 7, puerto 8083, subgrafo GraphQL (`schema.graphql`).

- `dominio/`: agregados y objetos de valor (LineaDeCredito, CobroQr, Dinero). No importa Nest ni Prisma.
- `aplicacion/`: casos de uso (AutorizarCredito, LiberarCredito, GenerarQr, PagarQr, DevolverQr, VencerQrs) y `AtenderComando`, que reparte los comandos de la saga.
- `infraestructura/`: Prisma (el cliente se genera en `persistencia/generado` y no se versiona), seguridad con jose y `mensajeria/rabbitmq.ts` (consumidor de `cobros.comandos`, publicador del outbox y revisor de QR vencidos).
- `interfaz/`: GraphQL y HTTP. Cobros le agrega `cobro` a `Pedido` por federación.
- dependency-cruiser (`pnpm arquitectura`) falla si el dominio importa infraestructura.

En la saga: `cobros.autorizar_credito` → `cobro.credito_autorizado` o `cobro.rechazado` (con el motivo); `cobros.generar_qr` → QR pendiente, y `cobro.qr_pagado` cuando la tienda paga; un QR sin pagar vence a los `QR_VIGENCIA_MINUTOS` (30) y sale `cobro.rechazado`. Compensaciones: `cobros.liberar_credito` y `cobros.devolver_qr`.

- `QR_DE_PRUEBA=si` habilita `pagarQrDePrueba` para la demo. Con un banco real se apaga.
- Los guards corren también en los campos de federación (`fieldResolverEnhancers: ['guards']`); el token se verifica una vez por petición.

Probar: `pnpm --filter @abasto/cobros test`. La saga completa: `pnpm e2e` (`e2e/pruebas/compra.spec.ts`). Migraciones: `pnpm --filter @abasto/cobros prisma:migrar`.
