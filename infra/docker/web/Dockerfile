# ── Build stage ─────────────────────────────────────────────
# Context: monorepo root  →  docker build -f infra/docker/web/Dockerfile -t comms-web .
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN npm ci

COPY apps/web/ ./apps/web/

RUN npm run build --workspace=apps/web

# ── Serve with Nginx ────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

RUN apk --no-cache upgrade && \
    rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY infra/docker/web/nginx.conf /etc/nginx/conf.d/default.conf

RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup \
        /usr/share/nginx/html \
        /var/cache/nginx \
        /var/log/nginx \
        /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown appuser:appgroup /var/run/nginx.pid

USER appuser

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
