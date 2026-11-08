#!/usr/bin/env sh
# Se corre en la máquina de Google Cloud después de `docker compose up -d --build`. Se puede repetir sin problema.
#   1. Deja Keycloak al día: cuentas de servicio y las direcciones públicas del Panel y del Superadmin.
#   2. Carga el catálogo de demostración (mayoristas, tiendas y los productos de Abasto con foto).
# La máquina no necesita Node: el script de Keycloak corre en un contenedor de Node que se borra al terminar.
set -eu
cd "$(dirname "$0")"
set -a
. ./.env
set +a

echo "▶ Keycloak"
docker run --rm --network abasto-gcp_default \
  -v "$PWD/../../keycloak/al-dia.mjs:/al-dia.mjs:ro" \
  -e KEYCLOAK_URL=http://keycloak:8080 \
  -e KEYCLOAK_ADMIN -e KEYCLOAK_ADMIN_CLAVE \
  -e KEYCLOAK_CUENTAS_SECRETO -e KEYCLOAK_COBROS_SECRETO -e KEYCLOAK_CONECTA_SECRETO \
  -e PANEL_URL="https://panel.$DOMINIO" \
  -e GESTION_URL="https://gestion.$DOMINIO" \
  -e INTELIGENCIA_URL="https://inteligencia.$DOMINIO" \
  -e SUPERADMIN_URL="https://superadmin.$DOMINIO" \
  node:22-alpine node /al-dia.mjs

echo "▶ Catálogo de demostración"
docker compose exec -T catalogo php artisan catalogo:semilla
docker compose exec -T catalogo php artisan catalogo:semilla-abasto

echo "✔ Listo: https://panel.$DOMINIO"
