# AI Subsystem — Quota Enforcement

## Purpose

AI inference is computationally expensive and carries a per-call cost from the external AI service provider. Without limits, a small number of heavy users could exhaust compute resources and deny service to others. The quota system enforces per-user daily limits at the Gateway Layer, before any AI work is done.

---

## Architecture

Quota enforcement is a two-layer check:

1. **Gateway Layer** (`aiQuotaEnforcer` middleware): Enforces the daily per-user limit on every AI-routed request. This is the primary gate — no AI call ever reaches the Service Layer if the quota is exceeded.

2. **Service Layer** (implicit): For async AI jobs, the `enqueueAsyncAiJob` call is gated by the same quota check. The check happens when the user makes the HTTP request to queue the job, not when the job actually runs.

---

## Implementation

**File:** `apps/api/src/shared/aiDraftQuota.ts`

The quota uses Redis as the counter store. The key structure is:

```
ai_quota:{userId}:{YYYY-MM-DD}
```

### `checkAndIncrementQuota(userId, limit)`

1. `INCR ai_quota:{userId}:{date}` (atomic Redis increment)
2. On first increment: set TTL to `SECONDS_UNTIL_MIDNIGHT` (daily reset)
3. If the post-increment value > limit: return `{ allowed: false, remaining: 0 }`
4. Otherwise: return `{ allowed: true, remaining: limit - count }`

**Atomicity:** Using Redis `INCR` ensures the counter is incremented and checked in a single atomic operation with no race condition between concurrent requests.

### `aiQuotaEnforcer` middleware

```typescript
const result = await checkAndIncrementQuota(req.user.userId, getDailyLimit(req.user));
if (!result.allowed) {
  return res.status(429).json({
    error: 'AI_QUOTA_EXCEEDED',
    message: `Daily AI request limit reached. Resets at midnight UTC.`,
    remaining: 0,
    resetAt: endOfDayUTC()
  });
}
```

The `X-AI-Quota-Remaining` header is set on all AI responses so clients can show a usage indicator.

---

## Quota Limits

The default quota is set via environment variable `AI_QUOTA_DAILY_LIMIT` (default: 50 requests per user per day).

Admins can configure different limits per user group via `PATCH /admin/settings`:

```json
{
  "aiQuota": {
    "defaultRequestsPerDay": 50,
    "groupOverrides": [
      { "groupId": "uuid-faculty-group", "requestsPerDay": 200 },
      { "groupId": "uuid-student-group", "requestsPerDay": 30 }
    ]
  }
}
```

The middleware resolves the applicable limit by checking (in priority order):
1. Per-group override (highest-limit group wins if user is in multiple groups)
2. Default limit

---

## What Counts as a Quota-Gated Request

Every request routed through the `/api/v1/ai/` subtree or any endpoint that calls a Sync AI task or enqueues an Async AI job counts against the quota.

| Feature | Counts? | Path |
|---------|---------|------|
| AI draft generation (short) | Yes | Sync AI |
| AI draft generation (long) | Yes | Async AI (on enqueue) |
| AI summarize | Yes | Sync or Async |
| RAG Q&A / AI Tutor | Yes | Sync AI |
| AI screening (auto) | No | System-initiated; not user-triggered |
| AI auto-approval (auto) | No | System-initiated |
| Vector embedding (at publish) | No | System-initiated |
| Content check (search) | No | Keyword-only; no AI quota |
| Smart ranking (semantic=true) | Yes | Sync AI for embedding |
| Template AI draft | Yes | Async AI (on enqueue) |

"System-initiated" means the AI call is triggered automatically by a system workflow (e.g. AI screening fires when content enters the review queue). These are not attributed to any specific user's quota.

---

## Quota Exhaustion Behaviour

When a user's quota is exhausted:

1. Gateway returns `429 Too Many Requests` with:
   - `error: "AI_QUOTA_EXCEEDED"`
   - `resetAt: ISO8601` (next midnight UTC)
   - `remaining: 0`

2. The request is rejected **before** any AI service is called — no cost is incurred

3. The frontend displays: "You've reached your daily AI limit. It resets at [time]."

4. Non-AI features continue to work normally — quota only affects AI-routed endpoints

---

## Quota Monitoring

Admins can see AI usage patterns via:

```
GET /api/v1/analytics/ai-insights
```

Returns per-user and aggregate AI usage stats. The AI Monitoring feature (F-ADM-006) uses this data to detect unusual spikes (e.g. a script hammering AI endpoints) and trigger anomaly alerts.

---

## Future Enhancement: Token-Based Quota

The current implementation counts requests (not tokens). A more precise quota system would count LLM input+output tokens per request, since a 100-word RAG answer costs far less than a 5,000-word template generation. Token-based quotas are planned but not implemented in the current release.
