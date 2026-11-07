#!/usr/bin/env sh
# Se corre en la máquina de AWS después de `docker compose up -d --build`. Se puede repetir sin problema.
#   1. Crea las tablas en DynamoDB de AWS (idempotencia, conecta, asistente).
#   2. Deja Keycloak al día: cuentas de servicio y las direcciones públicas del Panel y del Superadmin.
#   3. Importa y activa los flujos de n8n.
# Usa el contenedor de Conecta para correr los scripts: la máquina no necesita Node.
set -eu
cd "$(dirname "$0")"
set -a
. ./.env
set +a

echo "▶ Tablas de DynamoDB"
docker compose run --rm --no-deps \
  -v "$PWD/../../dynamodb/crear-tablas.mjs:/repo/services/conecta/crear-tablas.mjs:ro" \
  conecta node crear-tablas.mjs

echo "▶ Keycloak"
docker compose run --rm --no-deps \
  -v "$PWD/../../keycloak/al-dia.mjs:/repo/services/conecta/al-dia.mjs:ro" \
  -e KEYCLOAK_URL=http://keycloak:8080 \
  -e KEYCLOAK_ADMIN -e KEYCLOAK_ADMIN_CLAVE \
  -e KEYCLOAK_CUENTAS_SECRETO -e KEYCLOAK_COBROS_SECRETO -e KEYCLOAK_CONECTA_SECRETO \
  -e PANEL_URL="https://panel.$DOMINIO" \
  -e GESTION_URL="https://gestion.$DOMINIO" \
  -e INTELIGENCIA_URL="https://inteligencia.$DOMINIO" \
  -e SUPERADMIN_URL="https://superadmin.$DOMINIO" \
  conecta node al-dia.mjs

echo "▶ Flujos de n8n"
docker compose exec -T n8n n8n import:workflow --separate --input=/flujos
docker compose exec -T n8n n8n update:workflow --all --active=true
docker compose restart n8n

echo "✔ Listo: https://panel.$DOMINIO"
