# Gateway Layer

## Purpose

The Gateway Layer is the internal security and routing checkpoint. It processes every request after it has been stripped of network-level threats by the Edge and Traffic layers. The Gateway is responsible for:

1. Payload sanitisation (stripping malformed or dangerous content)
2. JWT authentication (identity verification)
3. Per-user rate limiting / throttling
4. AI quota enforcement (for AI-routed requests)
5. Route dispatch (directing the clean, authenticated request to the correct domain router)

---

## Implementation

**File:** `apps/api/src/gateway/http/createGatewayRouter.ts`

**Exported:** `createGatewayRouter(): Router`

The gateway router is the root Express router mounted at the API version prefix (`/api/v1`). All protected and public routes are registered on it.

---

## Middleware Pipeline

The Gateway applies middleware in strict order:

```
Incoming request
    │
    ▼
1. sanitize              ← strips dangerous characters from req.body, req.query, req.params
    │
    ▼
2. rateLimiter           ← per-IP request rate limit (express-rate-limit)
    │
    ▼
3. registerPublicRoutes  ← /auth only, with authRateLimiter (stricter limit)
    │  (public requests return here)
    ▼
4. authenticate          ← verifies JWT; attaches decoded user to req.user
    │
    ▼
5. recordUserActivity    ← updates last-seen timestamp for the user (async, non-blocking)
    │
    ▼
6a. /ai subtree:
    │   aiQuotaEnforcer  ← checks user's daily AI request count against limit; 429 if exceeded
    │   registerAiRoutes ← AI health endpoint
    │
6b. /everything else:
    registerProtectedRoutes ← domain routers for all business modules
```

---

## sanitize Middleware

Walks the entire request body, query string, and URL parameters. Strips or escapes:
- HTML tags in string values (prevents stored XSS)
- Null bytes and control characters
- Excessively long strings (applies a configurable maximum length)

Located in `apps/api/src/middlewares/sanitize.ts` (referenced from the gateway).

---

## authenticate Middleware

1. Reads the `Authorization: Bearer <token>` header
2. Verifies the JWT signature using the signing key fetched from Platform Services (secrets vault)
3. Checks the token's expiry claim
4. Attaches the decoded payload (`userId`, `roles`, `groups`) to `req.user`
5. On failure: returns 401 without any body that reveals system internals

**Key rotation:** The signing key is fetched at startup and cached. A key rotation script can force a reload without restarting the server (hot reload via the vault).

---

## rateLimiter

Uses `express-rate-limit`. Configured with:
- Window: 15 minutes (sliding window)
- Max requests: configurable via environment variable `RATE_LIMIT_MAX`
- Key function: client IP address (X-Forwarded-For header, trusted proxy configured)
- On limit exceeded: 429 Too Many Requests with `Retry-After` header

A stricter `authRateLimiter` is applied to `POST /auth/login` and `POST /auth/register` to mitigate brute-force attacks.

---

## aiQuotaEnforcer

Applied only to the `/api/v1/ai` route subtree.

1. Reads `req.user.userId`
2. Checks Redis key `ai_quota:{userId}:{date}` for today's request count
3. If count ≥ `AI_QUOTA_DAILY_LIMIT` (env variable): returns 429 with quota details
4. Otherwise: increments the counter (atomic Redis INCR with daily TTL) and calls `next()`
5. Quota limit is configurable per user group by admins (via admin settings)

**File:** `apps/api/src/shared/aiDraftQuota.ts`

---

## Route Registration

### Public Routes

`registerPublicRoutes` (`application/http/registerPublicRoutes.ts`) mounts only the authentication router:

```
/api/v1/auth/register  POST  ← user self-registration
/api/v1/auth/login     POST  ← JWT issuance
/api/v1/auth/logout    POST  ← token invalidation
```

### Protected Routes

`registerProtectedRoutes` (`application/http/registerProtectedRoutes.ts`) mounts all domain routers. Every request reaching these routes has already passed authentication.

| Mount path | Domain router |
|-----------|--------------|
| `/content` | contentRouter |
| `/tags` | tagRouter |
| `/reviews` | reviewRouter |
| `/admin` | adminRouter |
| `/analytics` | analyticsRouter |
| `/channels` | channelRouter |
| `/templates` | templateRouter |
| `/search` | searchRouter |
| `/components` | componentRouter |
| `/citations` | citationRouter |
| `/profile` | profileRouter |
| `/groups` | groupRouter |
| `/assets` | assetRouter |
| `/library` | libraryRouter |
| `/workflows` | workflowRouter |
| `/whatsapp-send` | whatsappSendRouter |
| `/email-send` | emailSendRouter |

### AI Routes

`registerAiRoutes` (`application/http/registerAiRoutes.ts`) currently exposes only a health check under the AI quota-gated subtree:

```
/api/v1/ai/health  GET  ← confirms AI service reachability (after quota check)
```

Actual AI function calls (embedding, task execution, job dispatch) are invoked from domain service code rather than through a separate `/ai/` HTTP façade.

---

## Error Handling

The Gateway does not catch domain errors. A global `errorMiddleware` registered in `app.ts` handles:
- `AppError` instances (structured errors with HTTP status and code)
- `PrismaClientKnownRequestError` (converted to appropriate 400/409 responses)
- Unhandled errors (logged and returned as 500)

Token scrubbing is applied at the logging pipeline level: JWT tokens and authorization headers are stripped from all log output before it reaches the audit store (NFR-SEC-03).
