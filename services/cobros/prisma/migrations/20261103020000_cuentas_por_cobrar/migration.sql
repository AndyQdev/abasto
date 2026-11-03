-- CU-09: cuentas por cobrar de pedidos a crédito o contra entrega, y sus pagos (que nunca se editan ni se borran)
CREATE TABLE "public"."cuentas_por_cobrar" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tienda_id" TEXT NOT NULL,
    "mayorista_id" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "centavos" INTEGER NOT NULL,
    "abierta_en" TIMESTAMP(3) NOT NULL,
    "vence_en" TIMESTAMP(3),
    "pagado_centavos" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cuentas_por_cobrar_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cuentas_por_cobrar_origen_check" CHECK ("origen" IN ('CREDITO', 'CONTRA_ENTREGA')),
    CONSTRAINT "cuentas_por_cobrar_montos_check" CHECK ("centavos" > 0 AND "pagado_centavos" BETWEEN 0 AND "centavos")
);

CREATE TABLE "public"."pagos_de_cuenta" (
    "id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "centavos" INTEGER NOT NULL,
    "forma" TEXT NOT NULL,
    "nota" TEXT,
    "registrado_en" TIMESTAMP(3) NOT NULL,
    "registrado_por" TEXT NOT NULL,

    CONSTRAINT "pagos_de_cuenta_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pagos_de_cuenta_centavos_check" CHECK ("centavos" > 0),
    CONSTRAINT "pagos_de_cuenta_forma_check" CHECK ("forma" IN ('EFECTIVO', 'TRANSFERENCIA', 'QR'))
);

CREATE UNIQUE INDEX "cuentas_por_cobrar_pedido_id_key" ON "public"."cuentas_por_cobrar"("pedido_id");
CREATE INDEX "cuentas_por_cobrar_mayorista_id_pagado_centavos_idx" ON "public"."cuentas_por_cobrar"("mayorista_id", "pagado_centavos");
CREATE INDEX "pagos_de_cuenta_cuenta_id_idx" ON "public"."pagos_de_cuenta"("cuenta_id");

ALTER TABLE "public"."pagos_de_cuenta" ADD CONSTRAINT "pagos_de_cuenta_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "public"."cuentas_por_cobrar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
