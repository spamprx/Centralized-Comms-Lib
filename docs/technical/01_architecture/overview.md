# Architecture Overview

## Design Philosophy

The Comms-Library API is built as eleven clearly separated, vertically ordered layers. Every inbound HTTP request passes through them in order from top (client) to bottom (storage). This design enforces three properties:

1. **Security-in-depth** — Attacks are stopped as early as possible, before expensive compute runs.
2. **Independent scalability** — Each layer can be scaled or replaced without touching adjacent layers.
3. **Predictable flow** — A developer reading any part of the codebase can trace any request by following the same eleven-layer sequence.

---

## The Eleven Layers

```
┌──────────────────────────────────────────────────┐
│  1. Client Layer                                 │  Web browsers, mobile, API clients
├──────────────────────────────────────────────────┤
│  2. Edge Protection Layer                        │  WAF, DDoS, bot filter, IP rate limit
├──────────────────────────────────────────────────┤
│  3. Traffic Layer                                │  TLS termination, reverse proxy, load balancer
├──────────────────────────────────────────────────┤
│  4. Platform Services                            │  Secrets vault (no service stores secrets locally)
├──────────────────────────────────────────────────┤
│  5. Gateway Layer                                │  Sanitise → Auth → Rate limit → AI quota
├──────────────────────────────────────────────────┤
│  6. Application Layer                            │  Workflow orchestration, route mapping
├──────────────────────────────────────────────────┤
│  7. Service Layer                                │  Domain logic, business rules, permissions
├──────────────────────────────────────────────────┤
│  8. Intelligence Layer                           │  Sync AI, Async AI Worker, search
├──────────────────────────────────────────────────┤
│  9. Repository Layer                             │  Typed data access, Unit of Work
├──────────────────────────────────────────────────┤
│ 10. Integration Layer                            │  Event bus, retries, notifications, outbox
├──────────────────────────────────────────────────┤
│ 11. Data Layer                                   │  PostgreSQL, Redis, Elasticsearch, MinIO
└──────────────────────────────────────────────────┘
```

---

## Standard Ingress Pipeline

Every client-originated API request traverses the following path before reaching any business logic:

```
Client
  → Edge Protection (WAF → DDoS → Bot Filter → IP Rate Limit)
  → Traffic Layer (Reverse Proxy → Load Balancer → TLS Termination)
  → Gateway Layer
      → sanitize (payload sanitisation)
      → rateLimiter (per-IP throttle)
      → authenticate (JWT verification → secrets vault)
      → recordUserActivity
      [AI routes only: → aiQuotaEnforcer]
  → Application Layer (route matching)
  → Service Layer (domain logic)
```

This pipeline is established in `gateway/http/createGatewayRouter.ts` and bootstrapped via `bootstrap/createApiRouter.ts`.

---

## Key Design Decisions

### 1. Security-in-Depth (Three Checkpoints)

Traffic passes through three successive security checkpoints before any backend logic executes:

- **Edge Protection Layer:** blocks volumetric DDoS, bot traffic, and per-IP floods
- **Traffic Layer:** terminates TLS; unauthenticated plaintext never reaches internal services
- **Gateway Layer:** verifies JWT, sanitises payloads, enforces rate limits and AI quotas

This means that even if the Gateway is misconfigured, the Edge and Traffic layers still provide a minimum security floor.

### 2. Centralised Secret Management

No service stores credentials locally. All secrets (database passwords, JWT signing keys, external API keys) are fetched at runtime from the Platform Services vault. This eliminates secret sprawl and enables immediate key rotation without redeployment.

In practice: the API container receives environment variables injected at startup (sourced from the vault). `config/storageEnv.ts` and environment constants centralise these references.

### 3. Independent Scalability

The Application Layer (workflow orchestration) and Service Layer (domain logic) are separated. Adding a new workflow type (e.g. a new channel integration) requires only Application Layer changes — the Service Layer's business rules are unaffected. Both layers can be scaled independently based on observed bottlenecks.

### 4. AI Workload Isolation

AI workloads run in a dedicated Intelligence Layer. Two paths:

- **Sync AI (I1):** Short, fast tasks (tag suggestion, format validation, query embedding). Handled inline; the HTTP request awaits the result.
- **Async AI Worker (I2):** Long-running jobs (template generation, plagiarism checks, content pipeline). Dispatched via the Outbox Pattern; the HTTP request returns immediately with a job ID.

This prevents heavy AI computation from introducing latency into regular API calls.

### 5. Transactional Reliability (Outbox Pattern)

Domain events are never silently lost. The Service Layer writes the data change **and** an `OutboxEvent` record in the same database transaction. A background relay (the Integration Layer) reads unprocessed outbox events and forwards them to the Event Bus. If the relay crashes after writing the event but before forwarding it, the event is retried on the next poll — it will never be skipped.

### 6. Polyglot Persistence (Right Tool for Each Query Type)

| Query type | Storage | Rationale |
|-----------|---------|-----------|
| Relational data (content, reviews, users) | PostgreSQL via Prisma | ACID transactions, complex joins |
| High-frequency reads | Redis | Sub-millisecond latency for cached content details |
| Full-text search | Elasticsearch | Stemming, synonyms, typo tolerance, facets |
| Semantic similarity | Elasticsearch dense vector | 384-dim cosine similarity, co-located with text search |
| Binary assets | MinIO (S3-compatible) | Large file storage with presigned URL access |

---

## Monorepo Structure

```
Centralized-Comms-Lib/
├── apps/
│   ├── api/          ← Express/Node.js API (TypeScript)
│   └── web/          ← React/Vite frontend (TypeScript)
├── packages/
│   ├── database/transactional/   ← Prisma schema + migrations + seed
│   └── database/elasticsearch/   ← ES index settings and mappings
├── infra/
│   ├── docker/       ← Dockerfiles for API and frontend
│   ├── minio/        ← MinIO bucket init scripts
│   └── scripts/      ← Dev/test helper scripts
└── docs/             ← This documentation
```

---

## Layer-by-Layer Reference

| Layer | Code location | Primary exports |
|-------|--------------|----------------|
| Gateway | `apps/api/src/gateway/` | `createGatewayRouter` |
| Application | `apps/api/src/application/` | `registerProtectedRoutes`, `registerAiRoutes` |
| Service (modules) | `apps/api/src/modules/` | `contentService`, `reviewService`, `adminService`, … |
| Intelligence | `apps/api/src/intelligence/` | `runSyncAiTask`, `enqueueAsyncAiJob`, `embedText` |
| Repository | `apps/api/src/repository/` | `PrismaUnitOfWork`, typed repository interfaces |
| Integration | `apps/api/src/integration/` | `publishEvent`, `dispatchNotification`, `withIdempotencyRetry` |
| Shared | `apps/api/src/shared/` | `checkResourceAccess`, `evaluateBusinessRule`, `withCircuitBreaker` |
| Platform | `apps/api/src/platform/` | `presignPut`, `presignGet`, `deleteObject` |
