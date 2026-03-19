# API Container (`comms-api`)

Express + TypeScript backend compiled to plain JS and served by **node:20-alpine**.  
All commands are run from the **monorepo root** (`Centralized-Comms-Lib/`).

---

## What's inside

| Stage     | Image             | Purpose                                                               |
|-----------|-------------------|-----------------------------------------------------------------------|
| `builder` | `node:20-alpine`  | Runs `npm ci` + `tsc`, outputs compiled JS to `dist/`                |
| `runner`  | `node:20-alpine`  | Installs prod-only deps, runs `node dist/main.js` as a non-root user |

---

## Prerequisites

- Docker ≥ 24
- A `package-lock.json` present at the monorepo root (run `npm install` once if missing)
- An `.env` file (copy from `apps/api/env.example`)

```bash
cp apps/api/env.example apps/api/.env
# Then fill in real values (JWT_SECRET, DATABASE_URL, REDIS_URL, …)
```

---

## Build

> **Context path**: The build context is the monorepo root (`.`) so Docker can access the root lockfile and workspace manifests.  
> **Dockerfile path**: `infra/docker/api/Dockerfile`

```bash
docker build \
  -f infra/docker/api/Dockerfile \
  -t comms-api \
  .
```

---

## Run

```bash
docker run --rm -p 8000:8000 --env-file apps/api/.env comms-api
```

The API is now available at **<http://localhost:8000>**.

### Detached (background)

```bash
docker run -d \
  --name comms-api \
  -p 8000:8000 \
  --env-file apps/api/.env \
  comms-api

# View logs
docker logs -f comms-api

# Stop
docker stop comms-api
```

### Pass individual env vars (alternative)

```bash
docker run --rm -p 8000:8000 \
  -e NODE_ENV=production \
  -e PORT=8000 \
  -e JWT_SECRET=changeme \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  comms-api
```

---

## Verify

```bash
# Health / reachability check
curl http://localhost:8000/health

# Should return {"status":"ok"}
```

---

## Environment variables

| Variable              | Required | Default       | Description                            |
|-----------------------|----------|---------------|----------------------------------------|
| `PORT`                | No       | `8000`        | Port the server listens on             |
| `NODE_ENV`            | No       | `development` | Set to `production` in containers      |
| `JWT_SECRET`          | **Yes**  | —             | Secret used to sign/verify JWTs        |
| `JWT_ISSUER`          | No       | —             | JWT issuer claim                       |
| `JWT_AUDIENCE`        | No       | —             | JWT audience claim                     |
| `DATABASE_URL`        | **Yes**  | —             | PostgreSQL connection string           |
| `REDIS_URL`           | No       | —             | Redis connection string                |
| `REMOTE_URL`          | **Yes**       | —             | Base URL of the web frontend (for CORS, links) |
| `AI_DAILY_QUOTA`      | No       | `50`          | Max AI requests per day                |
| `AI_QUOTA_WINDOW_MS`  | No       | `86400000`    | Quota window in milliseconds           |

---

## Customisation

| What             | How                                                                     |
|------------------|-------------------------------------------------------------------------|
| Change the port  | Edit `PORT` env var and the host-side of `-p <HOST>:8000`               |
| Add a database   | Pass `DATABASE_URL` via `--env-file` or `-e`                            |
| Add Prisma       | Uncomment the `prisma` blocks in the Dockerfile and rebuild             |
| Add HTTPS / TLS  | Use a reverse proxy (Caddy, nginx, Traefik) in front of this container  |
