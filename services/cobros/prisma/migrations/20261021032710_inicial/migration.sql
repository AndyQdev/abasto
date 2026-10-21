-- CreateTable
CREATE TABLE "lineas_de_credito" (
    "id" TEXT NOT NULL,
    "tienda_id" TEXT NOT NULL,
    "mayorista_id" TEXT NOT NULL,
    "limite_centavos" INTEGER NOT NULL,
    "plazo_dias" INTEGER NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lineas_de_credito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas_de_credito" (
    "linea_id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "centavos" INTEGER NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservas_de_credito_pkey" PRIMARY KEY ("linea_id","pedido_id")
);

-- CreateTable
CREATE TABLE "outbox" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicado_en" TIMESTAMP(3),

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensajes_procesados" (
    "id" TEXT NOT NULL,
    "procesado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensajes_procesados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lineas_de_credito_tienda_id_mayorista_id_key" ON "lineas_de_credito"("tienda_id", "mayorista_id");

-- CreateIndex
CREATE INDEX "outbox_publicado_en_idx" ON "outbox"("publicado_en");

-- AddForeignKey
ALTER TABLE "reservas_de_credito" ADD CONSTRAINT "reservas_de_credito_linea_id_fkey" FOREIGN KEY ("linea_id") REFERENCES "lineas_de_credito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
