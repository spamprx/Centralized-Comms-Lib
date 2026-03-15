#!/bin/sh
set -e
SCHEMA="packages/database/transactional/prisma/schema.prisma"
echo "Applying database schema..."
npx prisma migrate deploy --schema="$SCHEMA" 2>/dev/null || npx prisma db push --schema="$SCHEMA" --skip-generate
echo "Starting API..."
exec node apps/api/dist/main.js
