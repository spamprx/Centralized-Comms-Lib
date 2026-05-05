# Non-Functional Requirements — Availability

## Requirements

| ID | Requirement | Priority |
|----|-------------|---------|
| **Uptime target** | 99.9% availability per calendar month (≈ 8.7 hours downtime/year) | — |
| NFR-AVL-01 | Load balancers shall distribute traffic across all active nodes with health-check intervals of small duration, automatically rerouting requests away from degraded instances without manual intervention | HIGH |
| NFR-AVL-02 | All primary data stores shall maintain synchronous replication to at least one standby replica within the same region, with asynchronous cross-region replication for disaster recovery. **Failover shall complete within 30 seconds** | HIGH |

---

## Implementation

### NFR-AVL-01 — Load Balancing + Automatic Rerouting

The Traffic Layer implements an Application Load Balancer (ALB) with:

- **Health check endpoint:** `GET /health` on each API instance
- **Health check interval:** 15 seconds
- **Unhealthy threshold:** 2 consecutive failures → instance removed from rotation
- **Recovery threshold:** 3 consecutive passes → instance restored to rotation

This means a failed instance is detected in < 30 seconds (2 × 15 s interval) and traffic is rerouted immediately. No manual intervention required.

The load balancer uses a least-connections algorithm to prevent any single instance from being overloaded during uneven traffic spikes.

**Auto-scaling:** In production, the API ECS service is configured with target tracking auto-scaling:
- Scale out when average CPU > 70% for 3 minutes
- Scale in when average CPU < 20% for 10 minutes
- Minimum instances: 2 (for redundancy even at low traffic)
- Maximum instances: 20

### NFR-AVL-02 — Data Store Replication

#### PostgreSQL (Primary)

**Within-region (synchronous):**
- RDS Multi-AZ deployment: one primary + one synchronous standby replica in a different Availability Zone
- All writes must be acknowledged by the standby before the write is considered committed
- Standby promotion is automatic: if primary fails, RDS promotes the standby; DNS endpoint updates within 30 seconds

**Cross-region (asynchronous):**
- RDS Read Replica in a secondary region (asynchronous lag typically < 1 second)
- Cross-region replica serves as Disaster Recovery target; promotion is manual (RTO: ~10 minutes for DR failover, which is acceptable for a regional disaster scenario)

#### Redis

**Within-region:** Redis Sentinel with 1 master + 1 replica:
- Sentinel monitors master health; promotes replica if master is unreachable for > 5 seconds
- Client reconnects automatically (ioredis supports Sentinel mode)

**Cross-region:** Separate Redis instance in DR region; populated by the application as needed (cache is ephemeral — loss is acceptable; warmup is natural as requests come in)

#### Elasticsearch

**Within-region:** 3-node cluster with `number_of_replicas: 1`:
- Each shard has one primary + one replica
- Any single node failure leaves all shards accessible
- New primary shard election completes in < 30 seconds

**Cross-region:** Cross-Cluster Replication (CCR) to a secondary ES cluster. Secondary serves as both a DR target and a read replica for cross-region search (planned enhancement).

#### MinIO / Object Storage

- In production: Amazon S3 with multi-AZ replication (inherently highly available)
- Cross-region: S3 Cross-Region Replication with `COPY` mode for all buckets
- Objects are never deleted permanently — lifecycle policies move old versions to Glacier after 90 days

---

## Graceful Degradation

The system is designed to degrade gracefully rather than fail completely when components are unavailable:

| Component unavailable | Impact | Degraded behaviour |
|----------------------|--------|-------------------|
| **Redis** | Cache miss on every request | Reads go to PostgreSQL; performance degrades but content is still served |
| **Elasticsearch** | Search unavailable | `/search/content` returns empty results with `503 SEARCH_UNAVAILABLE`; content CRUD continues normally |
| **AI service** | AI features unavailable | Circuit breaker opens; AI endpoints return 503; all non-AI features continue |
| **Notify API** | Notification delivery fails | Outbox events accumulate in PENDING state; notifications delivered when service recovers |
| **MinIO / S3** | Asset upload/download fails | Asset operations return 503; content text (stored in PostgreSQL) still accessible |

This means a failure in any single component never causes a complete system outage. The most critical components (PostgreSQL + API) can serve core functionality even if all other services are down.

---

## Reconnection and Recovery

The API server implements automatic reconnection for all persistent connections:

**Prisma (PostgreSQL):** Automatic reconnection with exponential backoff. Failed queries are retried up to 3 times before returning an error to the caller.

**ioredis (Redis):** ioredis has built-in reconnection logic:
- On disconnect: attempts to reconnect immediately, then with exponential backoff
- While disconnected: operations fail fast (no hanging) — the caller handles gracefully

**Elasticsearch (`@elastic/elasticsearch`):** Built-in retry logic for transient failures (connection refused, timeout). Configured with `maxRetries: 3`.

**External APIs (Notify, AI service):** Wrapped in circuit breakers. On repeated failures, circuit opens → fast fail → circuit probes for recovery → circuit closes on success.

---

## Recovery Time Objective (RTO) and Recovery Point Objective (RPO)

| Scenario | RTO | RPO |
|----------|-----|-----|
| Single API instance failure | < 30s (LB reroutes) | 0 (stateless) |
| Primary DB failure (Multi-AZ) | < 30s (automatic failover) | 0 (synchronous replica) |
| Redis failure (Sentinel) | < 10s (automatic promotion) | 0 (cache is ephemeral) |
| ES node failure (3-node cluster) | < 30s (shard rebalancing) | 0 (replicated shards) |
| Full region failure (DR) | ~10 minutes (manual promotion) | < 1s of data (async replication lag) |

These values satisfy the SRS requirement of "failover shall complete within 30 seconds" for within-region failures (NFR-AVL-02).
