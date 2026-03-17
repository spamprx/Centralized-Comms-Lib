#!/bin/sh
set -eu

SCHEMA_PATH="${PRISMA_SCHEMA_PATH:-packages/database/transactional/prisma/schema.prisma}"
TRANSACTIONAL_PKG_DIR="${SCHEMA_PATH%/prisma/schema.prisma}"
RUN_DB_PUSH="${RUN_DB_PUSH:-true}"
RUN_DB_SEED="${RUN_DB_SEED:-true}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set; skipping DB setup."
  exec node apps/api/dist/main.js
fi

echo "Preparing database (schema: ${SCHEMA_PATH})..."

if [ "${RUN_DB_PUSH}" = "true" ]; then
  i=0
  until npx prisma db push --schema="${SCHEMA_PATH}" --skip-generate 2>&1; do
    i=$((i + 1))
    if [ "$i" -ge 30 ]; then
      echo "ERROR: db push failed after ${i} attempts."
      exit 1
    fi
    echo "Waiting for database... (${i}/30)"
    sleep 2
  done
  echo "Database schema is up to date."
fi

if [ "${RUN_DB_SEED}" = "true" ]; then
  echo "Seeding database..."
  cd "${TRANSACTIONAL_PKG_DIR}"
  npx prisma db seed 2>&1
  cd /app
  echo "Seed complete."
fi

exec node apps/api/dist/main.js

