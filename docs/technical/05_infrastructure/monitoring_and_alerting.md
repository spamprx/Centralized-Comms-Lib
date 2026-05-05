# Infrastructure — Monitoring and Alerting

## Observability Stack

| Signal | Tool | Location |
|--------|------|---------|
| **Metrics** | Prometheus (`prom-client`) | `GET /metrics` on every API instance |
| **Application logs** | Structured JSON via `logger.ts` | stdout → log aggregator |
| **Audit log** | PostgreSQL `AuditLog` table | `GET /admin/logs` |
| **Error tracking** | Unhandled rejection handler in `server.ts` | Logs to stdout + optional Sentry |
| **Uptime / health** | `GET /health`, `/health/db`, `/health/redis` | Load balancer health checks |
| **AI anomaly detection** | Async AI Worker `ANOMALY_DETECT` | Admin dashboard alerts |

---

## Prometheus Metrics

The API server exposes a Prometheus-compatible scrape endpoint:

```
GET /metrics
```

Enabled when `METRICS_ENABLED=true` (default). Disabled in environments where Prometheus is not available.

### Metrics categories

| Metric name | Type | Description |
|-------------|------|-------------|
| `http_request_duration_seconds` | Histogram | Request latency by method, route, status code |
| `http_requests_total` | Counter | Total requests by method, route, status |
| `active_connections` | Gauge | Current open HTTP connections |
| `content_by_state` | Gauge | Content count per lifecycle state |
| `review_queue_depth` | Gauge | Pending review assignments |
| `outbox_pending` | Gauge | Unprocessed outbox events |
| `outbox_dead_letter` | Gauge | Dead-lettered events (alert threshold: > 0) |
| `ai_quota_usage` | Counter | AI requests per user per day |
| `redis_cache_hit_total` | Counter | Redis cache hits (search + content detail) |
| `redis_cache_miss_total` | Counter | Redis cache misses |
| `elasticsearch_query_duration_seconds` | Histogram | ES query latency |

### Grafana dashboards

Prometheus metrics feed Grafana dashboards for:
- **API overview:** p95/p99 latency, request rate, error rate
- **Content pipeline:** review queue depth, state transition rates
- **AI usage:** quota utilisation per group, async job queue depth
- **Data layer:** PostgreSQL connection pool usage, Redis memory, ES indexing lag

---

## Health Checks

### `GET /health`

Returns overall system health. Used by the load balancer for instance health checks.

**Response (healthy):**
```json
{
  "status": "ok",
  "timestamp": "ISO8601",
  "services": {
    "db": "ok",
    "redis": "ok",
    "elasticsearch": "ok | degraded | unavailable"
  }
}
```

**Response (unhealthy):** Returns `503 Service Unavailable` when any critical service (DB or Redis) is unreachable.

**Elasticsearch degradation:** Elasticsearch being unavailable does not cause a 503 — search features degrade gracefully (empty results returned) while content CRUD continues to work.

### `GET /health/db`

Direct PostgreSQL connectivity test. Runs `SELECT 1` to verify the connection.

### `GET /health/redis`

Direct Redis connectivity test. Runs `PING` to verify the connection.

---

## Structured Logging

All application logs are written as structured JSON via `logger.ts` (Winston or Pino).

**Log format:**
```json
{
  "timestamp": "ISO8601",
  "level": "info | warn | error",
  "message": "string",
  "requestId": "uuid",
  "userId": "uuid (scrubbed if not authorised context)",
  "module": "content.service | review.service | ...",
  "duration_ms": 45
}
```

**Log levels:**
- `error` — unhandled exceptions, circuit breaker trips, database connection failures
- `warn` — rate limit hits, quota exhaustion, degraded mode activation, dead-letter events
- `info` — state transitions, notable domain events (content published, user added to group)
- `debug` — detailed request/response (disabled in production)

**Token scrubbing:** Authorization headers and JWT tokens are stripped from all log output before writing.

---

## AI Anomaly Detection

The Async AI Worker runs a continuous `ANOMALY_DETECT` job that analyses metrics from the analytics store.

**Anomaly detection signals:**
- Content creation rate: > 3× baseline rate in a 15-minute window
- Denial rate: > 50% of review decisions are denials (may indicate bad content or policy misconfiguration)
- Failed login rate: > 10 failures per IP in 5 minutes
- Outbox dead-letter count: any increase
- AI quota exhaustion: multiple users hitting quota in < 1 hour

**Alert delivery:**
1. Admin dashboard banner (in-app notification via `NOTIFICATION:ANOMALY_ALERT`)
2. Email to configured admin addresses via Notify API
3. Alert includes: anomaly description, affected metric, threshold exceeded, suggested investigation steps

**Configuring thresholds:**
```
PATCH /api/v1/admin/settings
{
  "aiMonitor": {
    "contentCreationRateMultiplier": 3,
    "denialRateThreshold": 0.5,
    "loginFailureWindowMinutes": 5,
    "loginFailureCountThreshold": 10
  }
}
```

---

## Real-Time Admin Dashboard

`GET /api/v1/admin/monitoring/metrics` returns live KPIs. The Admin Monitor dashboard (`AdminLayout.tsx`) auto-refreshes this endpoint.

KPIs displayed:
- Active users (last 15 min)
- Content counts per state (from PostgreSQL)
- Review queue depth (pending assignments)
- Pipeline stage bottlenecks (stages with most pending items)
- Outbox queue depth and dead-letter count
- Recent anomaly alerts timeline

---

## Alerting Integration

For production deployments, route Prometheus alerts via:

- **PagerDuty:** for critical p0 alerts (DB unreachable, 50% error rate)
- **Slack webhook:** for warning-level alerts (review queue depth > 50, dead-letter count > 0)
- **Email (via Notify API):** for admin-level alerts (anomaly detection, quota exhaustion)
