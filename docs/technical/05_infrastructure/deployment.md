# Infrastructure — Deployment

## Development Environment

The entire development stack runs locally via Docker Compose. All services are defined in `docker-compose.yml` at the repository root.

### Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `postgres` | `postgres:16` | 5432 | Primary relational database (`comms` DB) |
| `redis` | `redis:alpine` | 6379 | Cache, session tokens, AI quota counters |
| `elasticsearch` | `elasticsearch:8.x` | 9200 | Full-text search + vector store |
| `mongo` | `mongo:7` | 27017 | Supplementary document store (future use) |
| `minio` | `minio/minio` | 9000 / 9001 | Object storage (S3-compatible) |
| `minio-mc` | `minio/mc` | — | One-shot bucket init (init-buckets.sh) |
| `backend` | Custom (`infra/docker/api/Dockerfile`) | 3001 | Node.js API server |
| `frontend` | Custom (`infra/docker/frontend/Dockerfile`) + nginx | 3000 | React SPA behind nginx |

### Starting the stack

```bash
docker compose up -d
```

### Database setup (first time)

```bash
# Run Prisma migrations
npx prisma migrate deploy --schema packages/database/transactional/prisma/schema.prisma

# Seed initial data (roles, default admin user, sample content)
npx prisma db seed --schema packages/database/transactional/prisma/schema.prisma
```

### Environment variables

The API server reads configuration from environment variables. Copy `.env.example` to `.env` and fill in:

```bash
# Database
DATABASE_URL=postgresql://comms:comms@postgres:5432/comms

# Redis
REDIS_URL=redis://redis:6379

# Elasticsearch
ELASTICSEARCH_URL=http://elasticsearch:9200
ELASTICSEARCH_CONTENT_INDEX=comms-content

# JWT
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRES_IN=24h

# MinIO
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_ASSETS_BUCKET=comms-assets
MINIO_EXPORTS_BUCKET=comms-exports

# Notify API (email + WhatsApp)
NOTIFY_API_URL=https://notify.example.com
NOTIFY_CLIENT_ID=your-client-id
NOTIFY_API_KEY=your-api-key

# AI services
EMBEDDING_SERVICE_URL=http://ai-service:8080
AI_QUOTA_DAILY_LIMIT=50

# Background workers
ENABLE_OUTBOX_WORKER=true
ENABLE_NIGHTLY_VECTOR_REINDEX=true
ENABLE_ASSET_LINK_SCAN=true
OUTBOX_POLL_INTERVAL_MS=5000
```

---

## Production Deployment

### Container Build

Dockerfiles:
- API: `infra/docker/api/Dockerfile` — multi-stage Node.js build (build → production)
- Frontend: `infra/docker/frontend/Dockerfile` — Vite build → nginx static serving

### Recommended Production Architecture

```
Internet
    │
    ▼
CloudFront (CDN) / WAF
    │
    ▼
Application Load Balancer (HTTPS → HTTP internally)
    │
    ├── API ECS/EKS cluster (multiple containers, auto-scaling)
    │
    └── Frontend S3 static website (or nginx on ECS)

Data tier (same VPC, private subnets):
    ├── RDS PostgreSQL 16 (Multi-AZ, synchronous standby replica)
    ├── ElastiCache Redis (Cluster mode or Sentinel)
    ├── Amazon OpenSearch (Elasticsearch-compatible, 3-node)
    ├── MinIO on ECS or Amazon S3
    └── Amazon DocumentDB (if MongoDB is used)

External:
    ├── Embedding/AI service (separate ECS service or managed)
    └── Notify API (third-party SaaS)
```

### Horizontal Scaling

The API server is stateless — all state lives in PostgreSQL, Redis, and Elasticsearch. Multiple API containers can run in parallel behind the load balancer without coordination.

**Outbox worker consideration:** Only one container should run the outbox worker at a time to avoid duplicate event processing. Use a distributed lock (Redis `SETNX`) or a leader-election mechanism to ensure only the active leader runs the worker. Alternatively, separate the outbox worker into a dedicated single-instance sidecar service.

### Container Orchestration

For production, use ECS (simpler) or Kubernetes (more control):

```yaml
# ECS Task Definition outline (not production-ready — illustrative only)
api:
  image: comms-lib/api:latest
  cpu: 512
  memory: 1024
  environment:
    DATABASE_URL: "{{ ssm:/comms/database_url }}"
    REDIS_URL: "{{ ssm:/comms/redis_url }}"
    # ...
  healthCheck:
    command: ["CMD-SHELL", "curl -f http://localhost:3001/health || exit 1"]
    interval: 30
    timeout: 5
    retries: 3
```

---

## Turbo (Monorepo Build)

The repository uses **Turborepo** (`turbo.json`) to manage builds across the monorepo:

```bash
# Build all packages and apps
turbo build

# Run API in dev mode with hot reload
turbo dev --filter=api

# Run tests across all workspaces
turbo test
```

---

## Database Migrations

Migrations are managed with Prisma Migrate.

```bash
# Create a new migration after schema changes
npx prisma migrate dev --name describe_change

# Apply pending migrations in production
npx prisma migrate deploy
```

Migration files live in `packages/database/transactional/prisma/migrations/`. Each migration is a descriptive SQL file. Current migrations include:

- `asset_storage_models/` — Asset, AssetUsage, AssetLinkCheck models
- `component_category_and_asset_link_checks/` — ComponentCategory enum, AssetLinkCheck
- `whatsapp_send_request/` — WhatsAppSendRequest, WhatsAppMessageLog models

---

## MinIO Bucket Initialization

On first startup, the `minio-mc` service runs `infra/minio/scripts/init-buckets.sh`:

```bash
mc alias set local http://minio:9000 minioadmin minioadmin
mc mb local/comms-assets
mc mb local/comms-exports
```

`infra/minio/scripts/setup-policies.sh` configures download policies for the exports bucket (public read for presigned URLs).

---

## GitHub Actions CI/CD

`.github/workflows/` contains the CI pipeline. Per sprint:

1. **Build:** `turbo build` — compiles TypeScript, runs lint
2. **Test:** `turbo test` — Jest unit tests for all packages
3. **Docker:** `docker build` for API and frontend images
4. **Migrate:** `prisma migrate deploy` against the staging database
5. **Deploy:** Push images to ECR; update ECS service (or kubectl apply)
