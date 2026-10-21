# Catálogo · Laravel 13 · clean architecture · dueño: Jhoel

Productos, escalas de precio, stock, mayoristas, tiendas y la red privada (relaciones comerciales y listas de precios). MongoDB (27020), puerto 8082, subgrafo GraphQL con Lighthouse.

- `src/Catalogo/Dominio`: entidades y reglas puras (Producto, PoliticaDePrecios, RelacionComercial). Sin Laravel.
- `src/Catalogo/Aplicacion`: casos de uso (ConsultarCatalogo, ...). Solo usa los puertos de `Dominio/Puertos`.
- `src/Catalogo/Infraestructura`: Mongo, resolvers GraphQL y `Http/ValidarTokenKeycloak`.
- Deptrac (`deptrac.yaml`) y PHPStan nivel 8 fallan si se rompe una capa o un tipo.
- Schema en `graphql/schema.graphql`. Después de cambiarlo: `docker compose exec catalogo php artisan lighthouse:print-schema --federation > graphql/subgrafo.graphql` y `pnpm supergrafo`.
- Corre en Docker con el código montado: no hace falta PHP en la máquina. Composer y artisan van con `docker compose exec catalogo ...`.

Probar: `docker compose exec catalogo ./vendor/bin/pest` (o `pnpm test:catalogo`), `./vendor/bin/deptrac` y `./vendor/bin/phpstan`. Datos: `php artisan catalogo:semilla`.
