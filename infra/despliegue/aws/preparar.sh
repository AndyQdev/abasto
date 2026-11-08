#!/usr/bin/env sh
# Se corre en la máquina de AWS después de `docker compose up -d --build`. Se puede repetir sin problema.
#   1. Crea las tablas en DynamoDB de AWS (idempotencia, conecta, asistente).
#   2. Importa y activa los flujos de n8n.
# Keycloak se deja al día en Google Cloud (infra/despliegue/gcp/preparar.sh).
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

echo "▶ Flujos de n8n"
docker compose exec -T n8n n8n import:workflow --separate --input=/flujos
docker compose exec -T n8n n8n update:workflow --all --active=true
docker compose restart n8n

echo "✔ Listo: https://conecta.$DOMINIO"
