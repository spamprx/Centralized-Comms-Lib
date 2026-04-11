# ── Build stage ─────────────────────────────────────────────
# Context: monorepo root  →  docker build -f infra/docker/api/Dockerfile -t comms-api .
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/database/transactional/package.json ./packages/database/transactional/
COPY packages/database/mongo/package.json ./packages/database/mongo/
COPY packages/database/elasticsearch/package.json ./packages/database/elasticsearch/

RUN npm ci

COPY infra/scripts/prep-api-build.js ./infra/scripts/prep-api-build.js

COPY apps/api/tsconfig.json ./apps/api/
COPY apps/api/src/ ./apps/api/src/

COPY packages/database/mongo/tsconfig.json ./packages/database/mongo/
COPY packages/database/mongo/src/ ./packages/database/mongo/src/

COPY packages/database/elasticsearch/tsconfig.json ./packages/database/elasticsearch/
COPY packages/database/elasticsearch/src/ ./packages/database/elasticsearch/src/

COPY packages/database/transactional/prisma/ ./packages/database/transactional/prisma/
RUN npm install -D prisma@6 && npx prisma generate --schema=packages/database/transactional/prisma/schema.prisma

RUN npm run build -w @comms-lib/db-mongo -w @comms-lib/db-elasticsearch && \
    SKIP_DB_DRIVERS_BUILD=1 npm run build --workspace=apps/api

# ── Production stage ────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk --no-cache upgrade

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/database/transactional/package.json ./packages/database/transactional/
COPY packages/database/mongo/package.json ./packages/database/mongo/
COPY packages/database/elasticsearch/package.json ./packages/database/elasticsearch/

RUN npm ci --omit=dev

COPY packages/database/transactional/prisma/ ./packages/database/transactional/prisma/
RUN npm install prisma@6 ts-node typescript && npx prisma generate --schema=packages/database/transactional/prisma/schema.prisma

COPY --from=builder /app/packages/database/mongo/dist ./packages/database/mongo/dist
COPY --from=builder /app/packages/database/elasticsearch/dist ./packages/database/elasticsearch/dist

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY infra/docker/api/entrypoint.sh ./infra/docker/api/entrypoint.sh

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8000/health || exit 1

CMD ["sh", "infra/docker/api/entrypoint.sh"]
