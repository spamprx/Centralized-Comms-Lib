# Data Layer

## Purpose

The Data Layer is the physical storage tier. Each data store is chosen for its specific access pattern. No single store is used for everything — the system uses the right tool for each type of query.

---

## PostgreSQL (Primary Database)

**Role:** Source of truth for all relational data. All domain entities, audit logs, and outbox events are stored here.

**Version:** PostgreSQL 16

**Connection:** Via Prisma ORM (`@prisma/client`). All queries go through typed repository implementations — raw SQL is not used in application code.

**Schema:** See `packages/database/transactional/prisma/schema.prisma`

**Key design choices:**
- All primary keys use UUID (not auto-increment integer) to avoid enumeration attacks and to support distributed ID generation
- Soft deletes preferred over hard deletes for content and assets (retain for audit)
- The `OutboxEvent` table implements the Transactional Outbox Pattern: events are always in the same database as the data they describe
- The `AuditLog` table is append-only — no UPDATE or DELETE is ever issued on it

**Major table groups:**

| Group | Tables |
|-------|--------|
| Identity & RBAC | `User`, `Role`, `Permission`, `UserRole`, `UserGroup`, `UserGroupMembership` |
| Content | `Content`, `ContentVersion`, `ContentSnapshot`, `ContentCitation`, `ContentCoAuthor` |
| Reader features | `ContentAnnotation`, `ContentBookmark`, `BookmarkFolder`, `ContentBookmarkNotification`, `ContentComment`, `ContentLike`, `ContentReaction`, `ContentView`, `ContentReadingProgress` |
| Templates | `Template`, `TemplateTranslation`, `TemplateLayoutSection`, `TemplateFormattingRule`, `TemplateChannelBinding`, `TemplateTag`, `TemplateCluster` |
| Components | `Component`, `ComponentVersion` |
| Tags | `Tag`, `ContentTag` |
| Review | `ReviewRequest`, `ReviewAssignment`, `ReviewDecision`, `ReviewComment`, `ReviewPolicy` |
| Channels & messaging | `Channel`, `SmsDeliveryLog`, `WhatsAppTemplateRegistry`, `WhatsAppMessageLog`, `WhatsAppSendRequest` |
| Assets | `Asset`, `AssetUsage`, `AssetLinkCheck` |
| Infrastructure | `OutboxEvent`, `AuditLog`, `Workspace` |

**Migrations:** Managed via Prisma Migrate. Migration files live in `packages/database/transactional/prisma/migrations/`. Each migration is a named SQL file with a descriptive slug.

---

## Redis (Cache)

**Role:** High-speed in-memory cache and ephemeral state store.

**Library:** `ioredis`

**Use cases:**

| Key pattern | Purpose | TTL |
|------------|---------|-----|
| `content:detail:{id}` | Cached rendered content for reading view | Invalidated on content update |
| `search:epoch` | Cache epoch for Elasticsearch result cache invalidation | Updated on content publish/modify |
| `ai_quota:{userId}:{YYYY-MM-DD}` | Per-user daily AI request counter | Daily expiry |
| `session:conv:{sessionId}` | AI Tutor conversation history for multi-turn context | Sliding TTL (configurable) |
| `reaction_count:{contentId}` | Real-time reaction/like count | Invalidated on reaction event |
| `session:{userId}` | Session token invalidation marker (set on role revocation) | Matches token expiry |

**Health check:** `GET /health/redis` pings the Redis connection; included in the load balancer health check.

**Cluster / replication:** In production, Redis Sentinel or Redis Cluster is recommended for HA. In the Docker Compose development environment, a single Redis instance is used.

---

## Elasticsearch (Search Index + Vector Store)

**Role:** Full-text search with stemming/synonyms, faceted filtering, and 384-dimensional dense vector similarity search (semantic search + RAG retrieval).

**Version:** Single-node, security disabled in development (Docker Compose). Production deployments should use a 3-node cluster with security enabled.

**Index name:** `comms-content` (configurable via `ELASTICSEARCH_CONTENT_INDEX` env variable)

**Index settings** (`packages/database/elasticsearch/src/comms-content-index.json`):

```json
{
  "settings": {
    "analysis": {
      "analyzer": {
        "stemmer_analyzer": { "type": "custom", "tokenizer": "standard", "filter": ["lowercase", "stemmer"] },
        "synonym_analyzer": { "type": "custom", "tokenizer": "standard", "filter": ["lowercase", "synonym_graph"] },
        "ngram_analyzer": { "type": "custom", "tokenizer": "standard", "filter": ["lowercase", "edge_ngram"] }
      }
    }
  }
}
```

**Index mappings (key fields):**

| Field | Type | Analyzer | Purpose |
|-------|------|---------|---------|
| `id` | keyword | — | Content UUID for joining with PostgreSQL |
| `title` | text | stemmer + edge_ngram | Primary search field; typo-tolerant |
| `summary` | text | stemmer | Summary search |
| `bodyPlain` | text | stemmer + synonym_graph | Full body text search |
| `tags` | keyword[] | — | Faceted filtering |
| `authorId` | keyword | — | Author filter facet |
| `status` | keyword | — | Lifecycle state filter |
| `channelIds` | keyword[] | — | Channel filter facet |
| `publishedAt` | date | — | Date range filter |
| `engagementScore` | float | — | Engagement signal for ranking |
| `titleEmbedding` | dense_vector | dims: 384, similarity: cosine | Semantic similarity search |

**Update cadence:**
- Content publication/modification: synchronous Elasticsearch update within the request cycle
- Vector embeddings: updated asynchronously via the nightly vector reindex job
- Index is guaranteed to be < 5 minutes stale for text fields; < 24 hours stale for vectors

**Client:** `@elastic/elasticsearch` lazy singleton in `packages/database/elasticsearch/src/client.ts`. Initialised when `ELASTICSEARCH_URL` environment variable is set; search features degrade gracefully if not set.

---

## MinIO (Object Storage)

**Role:** Binary asset storage (images, documents, attachments) using an S3-compatible API.

**Library:** `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`

**Bucket layout:**

| Bucket | Contents |
|--------|---------|
| `comms-assets` | User-uploaded files (images, PDFs, attachments) |
| `comms-exports` | Temporary export files (PDF/Markdown exports, CSV downloads) |

**Access pattern:** Presigned URLs (never proxied through the API server):
1. `presignPut(bucket, key, expiresIn)` → client uploads directly to MinIO
2. `presignGet(bucket, key, expiresIn)` → client downloads directly from MinIO

This keeps binary data entirely out of the API server, preventing memory exhaustion from large file uploads.

**Bucket initialization:** `infra/minio/scripts/init-buckets.sh` runs on first startup via the `minio-mc` service in Docker Compose.

**Credentials:** MinIO access key and secret key are injected via environment variables (`MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`). In production these are sourced from the secrets vault.

---

## MongoDB (Supplementary)

**Role:** Document store for unstructured or semi-structured data (optional; present in Docker Compose).

**Current usage:** MongoDB is available via `@comms-lib/db-mongo` package and is included in the Docker Compose stack. It is not currently used by any production domain module but is available for future use (e.g. storing AI job result documents, analytics event streams).

---

## Data Flow Summary

```
Client Request
    │
    ▼
PostgreSQL ← primary reads/writes (via Prisma)
    │
    ├── Redis ← cache layer (fast reads; invalidated on write)
    │
    ├── Elasticsearch ← search queries; ES updated after PG write
    │
    └── MinIO ← binary asset reads/writes (via presigned URLs)
```
