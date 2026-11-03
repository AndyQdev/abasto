# Cobros · NestJS · DDD · dueño: Andrés

Pagos por QR, crédito, cuotas y comisiones. Base `cobros` en Postgres (5440) con Prisma 7, puerto 8083, subgrafo GraphQL (`schema.graphql`).

- `dominio/`: agregados y objetos de valor (LineaDeCredito, CobroQr, Dinero). No importa Nest ni Prisma.
- `aplicacion/`: casos de uso (AutorizarCredito, LiberarCredito, GenerarQr, PagarQr, DevolverQr, VencerQrs) y `AtenderComando`, que reparte los comandos de la saga.
- `infraestructura/`: Prisma (el cliente se genera en `persistencia/generado` y no se versiona; una sola conexión para todo Cobros en `PersistenciaModule`), seguridad con jose y `mensajeria/rabbitmq.ts` (consumidor de `cobros.comandos`, publicador del outbox y revisor de QR vencidos).
- `interfaz/`: GraphQL y HTTP. Cobros le agrega `cobro` a `Pedido` por federación.
- dependency-cruiser (`pnpm arquitectura`) falla si el dominio importa infraestructura.

En la saga: `cobros.autorizar_credito` → `cobro.credito_autorizado` o `cobro.rechazado` (con el motivo); `cobros.generar_qr` → QR pendiente, y `cobro.qr_pagado` cuando la tienda paga; un QR sin pagar vence a los `QR_VIGENCIA_MINUTOS` (30) y sale `cobro.rechazado`. Compensaciones: `cobros.liberar_credito` y `cobros.devolver_qr`.

## Cuentas por cobrar (CU-09, 03/11)

- `CuentaPorCobrar` (dominio): una por pedido a crédito o contra entrega. La abre `AbrirCuentaDePedido` al llegar `pedido.confirmado` (cola `cobros.cuentas`, `infraestructura/mensajeria/cuentas.rabbitmq.ts`). El crédito vence a los `plazoDias` de la línea (15 si no tiene); contra entrega no tiene fecha.
- `RegistrarPago`: solo el mayorista del token; nunca más que el saldo; el `pagoId` lo manda el Panel y un pago repetido no se cuenta dos veces. Publica `cobro.pago_registrado` (lo proyecta Asistente). Al saldar un crédito, `LineaDeCredito.saldar` quita la reserva **sin** publicar `cobro.credito_liberado` (es una compensación de la saga: Pedidos la tomaría como tal).
- Tablas `cuentas_por_cobrar` y `pagos_de_cuenta` (esquema `public`). `pagado_centavos` lo recalcula la base sumando los pagos dentro de la transacción y un CHECK impide pasar el monto: dos cobros a la vez no pueden cobrar de más.
- GraphQL: `cuentasPorCobrar(conPagadas)` y `registrarPago(entrada)`. La semilla carga 6 cuentas de demostración (`demo-cxc-…`).

- `QR_DE_PRUEBA=si` habilita `pagarQrDePrueba` para la demo. Con un banco real se apaga.
- Los guards corren también en los campos de federación (`fieldResolverEnhancers: ['guards']`); el token se verifica una vez por petición.

## «Mi negocio» (01/11, docs/plan-mi-negocio.md)

El inventario, las ventas, el fiado, las recetas, las tandas, las cuentas y la lista fija de cada cliente de la app. Vive en Cobros pero **aparte**: módulo `src/mi-negocio/` con sus propias capas (dependency-cruiser aplica las mismas reglas) y **esquema propio `negocio`** en Postgres (los cobros de la saga siguen en `public`). Para sacarlo a un servicio propio alcanza con mover la carpeta, sus modelos de Prisma y su cola.

- **Contrato con la app**: los campos son los de `packages/comercio/src/mi-negocio/modelo.ts` (la app guarda una copia sin señal y la sube). GraphQL: `miNegocio(desde)` baja todo lo del cliente (desde vacío = celular nuevo) o lo recibido después de la marca `hasta` de la bajada anterior; `sincronizarMiNegocio(cambios)` sube la cola del teléfono.
- **Regla de la sincronización** (la misma que `fusionar` de la app): lo que solo se agrega (movimientos y anotaciones por `clave_unica`; ventas, fiados y tandas por id) entra una vez (`createMany` con `skipDuplicates`); lo editable (artículos, clientes, recetas, lista) gana si `actualizadoEn` es igual o más nuevo. Todo o nada, en una transacción, con validaciones en español (`dominio/reglas.ts`).
- **Toda fila lleva `org_id`** (del token, nunca de un argumento) y `recibido_en` (marca del servidor). La marca `hasta` se da 5 s antes de ahora: lo que se estaba guardando vuelve a bajar en lugar de perderse.
- Cantidades en `numeric(14,6)` (10 kg de un quintal de 46 kg son 0,217391 quintales); montos en centavos.
- **Las compras entregadas entran solas**: cola `cobros.mi-negocio` (binding `pedido.entregado`). Pedidos agrega las líneas al evento (cambio aditivo de `DatosPedido`). Cobros pide el nombre y el rubro a Catálogo por `_entities` con la cuenta de servicio `cobros-servicio` (la crea `infra/keycloak/al-dia.mjs`; secreto en `KEYCLOAK_COBROS_SECRETO`) y registra con las mismas claves que el teléfono: artículo `abasto:<productoId>`, ENTRADA `pedido:<pedidoId>:<productoId>:<presentación>` y GASTO `pedido:<pedidoId>` («Compras en Abasto»). Lo que el cliente ya editó no se pisa (`soloSiNoExisten`). Si Catálogo no responde, el artículo queda con el código como nombre.
- Pruebas: `src/mi-negocio/**/*.spec.ts` (dominio, sincronización, evento) y `negocio.prisma.e2e-spec.ts` contra Postgres (`pnpm --filter @abasto/cobros test:e2e`, necesita `pnpm todo`). De punta a punta: `e2e/pruebas/mi-negocio-servidor.spec.ts`.

Probar: `pnpm --filter @abasto/cobros test`. La saga completa: `pnpm e2e` (`e2e/pruebas/compra.spec.ts`). Migraciones: `pnpm --filter @abasto/cobros prisma:migrar`.
