#!/usr/bin/env sh
# Se corre en la máquina de Azure después de `docker compose up -d --build`. Se puede repetir.
# Crea la tabla `asistente` en el DynamoDB Local de esta máquina (usa el contenedor del Asistente: no hace falta Node).
set -eu
cd "$(dirname "$0")"
docker compose run --rm --no-deps \
  -v "$PWD/../../dynamodb/crear-tablas.mjs:/repo/services/asistente/crear-tablas.mjs:ro" \
  -e DYNAMODB_URL=http://dynamodb:8000 \
  asistente node crear-tablas.mjs
docker compose restart asistente
echo "✔ Listo"
