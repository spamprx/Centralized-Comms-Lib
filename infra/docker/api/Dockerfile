# ── Build stage ─────────────────────────────────────────────
# Context: monorepo root  →  docker build -f infra/docker/api/Dockerfile -t comms-api .
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN npm ci

COPY apps/api/tsconfig.json ./apps/api/
COPY apps/api/src/ ./apps/api/src/

COPY packages/database/transactional/prisma/ ./packages/database/transactional/prisma/
RUN npm install -D prisma@6 && npx prisma generate --schema=packages/database/transactional/prisma/schema.prisma

RUN npm run build --workspace=apps/api

# ── Production stage ────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk --no-cache upgrade

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN npm ci --omit=dev

COPY packages/database/transactional/prisma/ ./packages/database/transactional/prisma/
RUN npm install prisma@6 && npx prisma generate --schema=packages/database/transactional/prisma/schema.prisma

COPY --from=builder /app/apps/api/dist ./apps/api/dist

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8000/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
