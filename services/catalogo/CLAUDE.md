# Catálogo · Laravel 13 · clean architecture · dueño: Jhoel

Productos, escalas de precio, stock, mayoristas, tiendas y la red privada (relaciones comerciales y listas de precios). MongoDB (27020), puerto 8082, subgrafo GraphQL con Lighthouse.

- `src/Catalogo/Dominio`: entidades y reglas puras (Producto, PoliticaDePrecios, RelacionComercial). Sin Laravel.
- `src/Catalogo/Aplicacion`: casos de uso (ConsultarCatalogo, ...). Solo usa los puertos de `Dominio/Puertos`.
- `src/Catalogo/Infraestructura`: Mongo, resolvers GraphQL y `Http/ValidarTokenKeycloak`.
- **Tipo de negocio del cliente (01/11, docs/plan-mi-negocio.md):** cada cliente de la app es una `Organizacion` (la crea `entrarConCodigo`) y guarda para qué compra en `organizaciones.negocio` (`tipo`: hogar | tienda | productor; `subtipo`: salteneria | panaderia | horneados | pension | polleria | puesto (02/11), solo y siempre para productor; `elegido_en`). Reglas en `Dominio/NegocioDelCliente` (códigos TIPO_DE_NEGOCIO_INVALIDO, FALTA_SUBTIPO, SUBTIPO_NO_CORRESPONDE, SUBTIPO_INVALIDO); un mayorista no tiene (NEGOCIO_SOLO_CLIENTES). Caso de uso `ElegirTipoDeNegocio`. GraphQL: `miTipoDeNegocio` (null si no eligió), `elegirTipoDeNegocio(tipo, subtipo)`, y `negocio` en `MiOrganizacion` y en la entidad `Tienda` (federación). Se lee en cualquier celular: la app no vuelve a preguntar. Volver a sembrar (`catalogo:semilla`) borra el tipo de las tiendas de la semilla.
- **Usos del producto (02/11, docs/plan-catalogo-real-y-plantillas.md):** `Producto.usos` dice a quién se le muestra en el Inicio de la app (`Producto::USOS`: hogar, tienda y las 6 áreas del productor). Lo edita Abasto en el Panel (`editarProducto(id, { usos })`); `catalogo:semilla-abasto` no pisa lo editado salvo con `--usos`. Buscar encuentra todo. Un producto sin usos no sale en ningún Inicio.
- **Mayoristas de prueba:** `Organizacion.dePrueba` (`de_prueba` en Mongo, lo pone `catalogo:semilla` en lp, lr y mc) sale como `Mayorista.dePrueba`; la app los oculta (`sinPruebas` en comercio). Siguen para los e2e y los casos de uso del parcial.
- **Producto que ya no está (03/11):** si Pedidos o Cobros piden por federación un producto que no existe (un pedido viejo, o uno que se rechazó por eso), `Entidades/Producto` devuelve igual uno con el nombre «Producto que ya no está en el catálogo (código)». Antes devolvía null y el Router anulaba la lista entera de `misVentas` (Panel › Pedidos vacío).
- Deptrac (`deptrac.yaml`) y PHPStan nivel 8 fallan si se rompe una capa o un tipo.
- Schema en `graphql/schema.graphql`. Después de cambiarlo: `docker compose exec catalogo php artisan lighthouse:print-schema --federation > graphql/subgrafo.graphql` y `pnpm supergrafo`.
- Corre en Docker con el código montado: no hace falta PHP en la máquina. Composer y artisan van con `docker compose exec catalogo ...`.

Probar: `docker compose exec catalogo ./vendor/bin/pest` (o `pnpm test:catalogo`), `./vendor/bin/deptrac` y `./vendor/bin/phpstan`. Datos: `php artisan catalogo:semilla`.
