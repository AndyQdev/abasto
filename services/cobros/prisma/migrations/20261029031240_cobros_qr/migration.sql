-- CreateTable
CREATE TABLE "cobros_qr" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "tienda_id" TEXT NOT NULL,
    "mayorista_id" TEXT NOT NULL,
    "centavos" INTEGER NOT NULL,
    "estado" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL,
    "vence_en" TIMESTAMP(3) NOT NULL,
    "pagado_en" TIMESTAMP(3),

    CONSTRAINT "cobros_qr_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cobros_qr_pedido_id_key" ON "cobros_qr"("pedido_id");

-- CreateIndex
CREATE INDEX "cobros_qr_estado_vence_en_idx" ON "cobros_qr"("estado", "vence_en");
