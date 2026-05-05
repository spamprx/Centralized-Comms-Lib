# Non-Functional Requirements — Performance

## Requirements

| ID | Requirement | Priority |
|----|-------------|---------|
| NFR-PERF-01 | End-to-end request latency shall not exceed **100 ms at p95** and **300 ms at p99** under nominal load | HIGH |
| NFR-PERF-02 | The system shall support concurrent read and write operations without lock contention. Read throughput shall not degrade by more than 10% under simultaneous write load | HIGH |
| NFR-PERF-03 | The system shall support **1 000 concurrent writes** | HIGH |

---

## How the Architecture Achieves These Targets

### Latency (NFR-PERF-01)

**Redis cache for hot reads:**
The most frequently accessed data — published content details and search results — is served from Redis with sub-millisecond latency. A cache hit bypasses Prisma + PostgreSQL entirely.

- Content detail: cached on first read; invalidated on content update or visibility change
- Search results: epoch-based cache invalidation (cache epoch incremented on each content change)

**Elasticsearch for search:**
Full-text search queries hit Elasticsearch (not PostgreSQL). ES is optimised for read-heavy workloads and returns results with highlighted snippets in typically 10–50 ms.

**No N+1 queries:**
Repository implementations use Prisma's `include` to fetch relations in a single query. Association data (author, tags, channels) is loaded alongside the primary entity, not in separate round-trips.

**Async offloading:**
Long-running AI jobs are async (Outbox → AI Worker). API request handling returns within milliseconds; computation is offloaded.

**Connection pooling:**
Prisma manages a PostgreSQL connection pool. ioredis maintains a persistent Redis connection. Neither incurs connection setup latency per request.

### Concurrent Writes (NFR-PERF-02 and NFR-PERF-03)

**PostgreSQL row-level locking:**
Prisma transactions use row-level locks (`SELECT ... FOR UPDATE`) on the specific content record, not table-level locks. Concurrent writes to different content items never block each other.

**Outbox non-contention:**
Outbox events are written to a separate table from the domain data. They use `INSERT` operations only (no updates on the same row from concurrent writers).

**Elasticsearch async indexing:**
ES index updates are made synchronously on publish but are handled by ES's own write buffer. A publish operation does not wait for ES to fully index before returning a response.

**Load balancing:**
Multiple API instances share load. 1 000 concurrent writes are distributed across instances; no single instance needs to handle all 1 000 simultaneously.

### Target Sizing

At 1 000 concurrent writes:
- Expected write size: 5–50 KB per request (TipTap JSON body)
- Expected Prisma operations: 2–4 per write (content update + snapshot + outbox event + audit log)
- PostgreSQL target: 500–2 000 TPS (achievable with a well-tuned instance, e.g. `db.r6g.xlarge`)
- API instances needed: ~5 instances × 200 requests/instance concurrency

---

## Performance Monitoring

Latency is tracked via the `http_request_duration_seconds` Prometheus histogram. Grafana dashboards show p50/p95/p99 latency per endpoint.

**Alert thresholds:**
- `p95 > 200ms` for content reads → investigate Redis cache hit rate
- `p95 > 500ms` for content saves → investigate PostgreSQL query plan
- `p95 > 2s` for AI-assisted endpoints → check circuit breaker state

---

## Known Bottlenecks and Mitigations

| Bottleneck | Mitigation |
|-----------|-----------|
| AI Sync call latency (50–200 ms) | Async path for all long-running AI tasks; sync path only for time-critical short tasks |
| Elasticsearch vector reindex | Nightly job (not inline); incremental updates on publish |
| Complex analytics aggregations | Use `ContentAnalyticsEvent` table with indexed `contentId` + `occurredAt`; cache aggregation results |
| Large TipTap JSON bodies | Gzip compression on responses; Redis stores compressed values |
| Co-authoring WebSocket fan-out | Each session has its own WebSocket handler; broadcasts are O(participants per doc) not O(all users) |
