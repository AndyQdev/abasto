-- «Mi negocio» (docs/plan-mi-negocio.md): esquema propio `negocio`, aparte de los cobros de la saga (public).
-- Cada fila es de un cliente (org_id) y lleva recibido_en para bajar solo lo nuevo. Cantidades numeric(14,6).

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "negocio";

-- CreateTable
CREATE TABLE "negocio"."articulo" (
    "org_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "detalle" TEXT,
    "rubro" TEXT,
    "envase" TEXT NOT NULL,
    "por_envase" DECIMAL(14,6),
    "unidad" TEXT NOT NULL,
    "clase" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "producto_id" TEXT,
    "proveedor" TEXT,
    "precio_venta_centavos" INTEGER,
    "stock_minimo" DECIMAL(14,6),
    "creado_en" TIMESTAMPTZ(3) NOT NULL,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "recibido_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "articulo_pkey" PRIMARY KEY ("org_id","id")
);

-- CreateTable
CREATE TABLE "negocio"."movimiento" (
    "org_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "articulo_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" DECIMAL(14,6) NOT NULL,
    "costo_unitario_centavos" INTEGER,
    "origen" TEXT NOT NULL,
    "clave_unica" TEXT NOT NULL,
    "fecha" TIMESTAMPTZ(3) NOT NULL,
    "nota" TEXT,
    "venta_id" TEXT,
    "tanda_id" TEXT,
    "recibido_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_pkey" PRIMARY KEY ("org_id","id")
);

-- CreateTable
CREATE TABLE "negocio"."venta" (
    "org_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMPTZ(3) NOT NULL,
    "total_centavos" INTEGER NOT NULL,
    "costo_centavos" INTEGER NOT NULL,
    "forma" TEXT NOT NULL,
    "cliente_id" TEXT,
    "anulada" BOOLEAN NOT NULL DEFAULT false,
    "recibido_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venta_pkey" PRIMARY KEY ("org_id","id")
);

-- CreateTable
CREATE TABLE "negocio"."venta_linea" (
    "org_id" TEXT NOT NULL,
    "venta_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "articulo_id" TEXT NOT NULL,
    "cantidad" DECIMAL(14,6) NOT NULL,
    "precio_unitario_centavos" INTEGER NOT NULL,
    "costo_unitario_centavos" INTEGER,

    CONSTRAINT "venta_linea_pkey" PRIMARY KEY ("org_id","venta_id","numero")
);

-- CreateTable
CREATE TABLE "negocio"."cliente_fiado" (
    "org_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "recibido_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_fiado_pkey" PRIMARY KEY ("org_id","id")
);

-- CreateTable
CREATE TABLE "negocio"."fiado" (
    "org_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto_centavos" INTEGER NOT NULL,
    "venta_id" TEXT,
    "fecha" TIMESTAMPTZ(3) NOT NULL,
    "nota" TEXT,
    "recibido_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiado_pkey" PRIMARY KEY ("org_id","id")
);

-- CreateTable
CREATE TABLE "negocio"."receta" (
    "org_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "articulo_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rinde" DECIMAL(14,6) NOT NULL,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "recibido_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receta_pkey" PRIMARY KEY ("org_id","id")
);

-- CreateTable
CREATE TABLE "negocio"."receta_insumo" (
    "org_id" TEXT NOT NULL,
    "receta_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "articulo_id" TEXT NOT NULL,
    "cantidad" DECIMAL(14,6) NOT NULL,

    CONSTRAINT "receta_insumo_pkey" PRIMARY KEY ("org_id","receta_id","numero")
);

-- CreateTable
CREATE TABLE "negocio"."tanda" (
    "org_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "receta_id" TEXT NOT NULL,
    "articulo_id" TEXT NOT NULL,
    "planificado" DECIMAL(14,6) NOT NULL,
    "obtenido" DECIMAL(14,6) NOT NULL,
    "costo_total_centavos" INTEGER NOT NULL,
    "fecha" TIMESTAMPTZ(3) NOT NULL,
    "recibido_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tanda_pkey" PRIMARY KEY ("org_id","id")
);

-- CreateTable
CREATE TABLE "negocio"."anotacion" (
    "org_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto_centavos" INTEGER NOT NULL,
    "categoria" TEXT NOT NULL,
    "nota" TEXT,
    "origen" TEXT NOT NULL,
    "clave_unica" TEXT NOT NULL,
    "fecha" TIMESTAMPTZ(3) NOT NULL,
    "recibido_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anotacion_pkey" PRIMARY KEY ("org_id","id")
);

-- CreateTable
CREATE TABLE "negocio"."lista_fija" (
    "org_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "producto_id" TEXT NOT NULL,
    "presentacion" TEXT NOT NULL,
    "cantidad" DECIMAL(14,6) NOT NULL,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "recibido_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lista_fija_pkey" PRIMARY KEY ("org_id","id")
);

-- CreateIndex
CREATE INDEX "articulo_org_id_recibido_en_idx" ON "negocio"."articulo"("org_id", "recibido_en");

-- CreateIndex
CREATE INDEX "movimiento_org_id_recibido_en_idx" ON "negocio"."movimiento"("org_id", "recibido_en");

-- CreateIndex
CREATE INDEX "movimiento_org_id_articulo_id_idx" ON "negocio"."movimiento"("org_id", "articulo_id");

-- CreateIndex
CREATE UNIQUE INDEX "movimiento_org_id_clave_unica_key" ON "negocio"."movimiento"("org_id", "clave_unica");

-- CreateIndex
CREATE INDEX "venta_org_id_recibido_en_idx" ON "negocio"."venta"("org_id", "recibido_en");

-- CreateIndex
CREATE INDEX "cliente_fiado_org_id_recibido_en_idx" ON "negocio"."cliente_fiado"("org_id", "recibido_en");

-- CreateIndex
CREATE INDEX "fiado_org_id_recibido_en_idx" ON "negocio"."fiado"("org_id", "recibido_en");

-- CreateIndex
CREATE INDEX "receta_org_id_recibido_en_idx" ON "negocio"."receta"("org_id", "recibido_en");

-- CreateIndex
CREATE INDEX "tanda_org_id_recibido_en_idx" ON "negocio"."tanda"("org_id", "recibido_en");

-- CreateIndex
CREATE INDEX "anotacion_org_id_recibido_en_idx" ON "negocio"."anotacion"("org_id", "recibido_en");

-- CreateIndex
CREATE UNIQUE INDEX "anotacion_org_id_clave_unica_key" ON "negocio"."anotacion"("org_id", "clave_unica");

-- CreateIndex
CREATE INDEX "lista_fija_org_id_recibido_en_idx" ON "negocio"."lista_fija"("org_id", "recibido_en");

-- AddForeignKey
ALTER TABLE "negocio"."venta_linea" ADD CONSTRAINT "venta_linea_org_id_venta_id_fkey" FOREIGN KEY ("org_id", "venta_id") REFERENCES "negocio"."venta"("org_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negocio"."receta_insumo" ADD CONSTRAINT "receta_insumo_org_id_receta_id_fkey" FOREIGN KEY ("org_id", "receta_id") REFERENCES "negocio"."receta"("org_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

