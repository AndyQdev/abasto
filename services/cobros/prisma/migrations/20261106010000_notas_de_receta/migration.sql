-- Lo que la receta lleva y no se compra (el agua): se muestra al cocinar, sin artículo ni costo.
ALTER TABLE "negocio"."receta" ADD COLUMN "notas" TEXT;
