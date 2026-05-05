# Non-Functional Requirements — Security

## Requirements

| ID | Requirement | Priority |
|----|-------------|---------|
| NFR-SEC-01 | All data in transit shall be encrypted via **TLS 1.3** | HIGH |
| NFR-SEC-02 | Symmetric encryption shall use **AES-256**, with keys derived via **HKDF** and managed through a dedicated secrets manager (e.g. AWS KMS). Keys must be rotated at regular intervals | HIGH |
| NFR-SEC-03 | Authentication tokens shall never be written to persistent logs. Log pipelines shall apply **token-scrubbing** filters before any data reaches the audit or analytics store | MEDIUM |
| NFR-SEC-04 | The library shall enforce **rate limiting** on connection attempts to mitigate abuse. Limits shall be applied before authentication to avoid burning compute on flood traffic | MEDIUM |

---

## Implementation Details

### NFR-SEC-01 — TLS 1.3

- All external HTTPS traffic terminates at the Traffic Layer (reverse proxy / load balancer)
- Minimum TLS version enforced: 1.3 (TLS 1.2 connections are rejected)
- HSTS (`Strict-Transport-Security`) headers set on all responses
- Internal service-to-service communication within the private VPC uses TLS where available
- Database connections: `sslmode=require` in `DATABASE_URL`

### NFR-SEC-02 — AES-256 + HKDF + Key Rotation

- Sensitive data fields (e.g. credential tokens for channel integrations) are encrypted at rest using AES-256-GCM before storage
- Encryption keys are derived via HKDF from a master key stored in the secrets vault (AWS KMS / HashiCorp Vault)
- **Key rotation procedure:**
  1. New master key version created in the vault
  2. HKDF derives new data encryption keys from the new master
  3. Background migration job re-encrypts existing sensitive records with the new keys
  4. Old master key version is deactivated (not deleted — needed for decryption of any in-flight records)
- Rotation frequency: minimum quarterly; on any suspected compromise: immediate

### NFR-SEC-03 — Token Scrubbing

Implemented in the logger middleware and audit log pipeline:

```typescript
// Pattern applied to all log payloads before writing
const TOKEN_PATTERN = /bearer\s+[a-zA-Z0-9._-]+/gi;
const AUTH_HEADER_PATTERN = /authorization:\s*[^\s]+/gi;

function scrubTokens(payload: string): string {
  return payload
    .replace(TOKEN_PATTERN, 'bearer [REDACTED]')
    .replace(AUTH_HEADER_PATTERN, 'authorization: [REDACTED]');
}
```

This function is applied to:
- All log lines before writing to stdout
- All `metadata` fields before writing to `AuditLog`
- All error messages before returning to clients (in case a middleware accidentally included the Authorization header in an error response)

**IP address scrubbing:** IP addresses in audit logs are stored at /24 subnet granularity (last octet zeroed) to balance audit trail completeness with user privacy.

### NFR-SEC-04 — Rate Limiting

**Before authentication (per IP):**
- `express-rate-limit` applied at the Gateway Layer before `authenticate` middleware
- Default: 100 requests per 15-minute window per IP
- Configurable via `RATE_LIMIT_MAX` environment variable

**Auth endpoints (stricter):**
- `authRateLimiter` applied specifically to `POST /auth/login` and `POST /auth/register`
- Default: 10 attempts per 15-minute window per IP
- Failed login attempts count toward the limit; successful ones do not reset it
- On limit exceeded: `429 Too Many Requests` with `Retry-After` header

This means the load of flood traffic never reaches the authentication logic (JWT verification, database user lookup). Flood traffic is rejected at the rate limiter level before any compute-intensive operation runs.

---

## Additional Security Measures

### Object-Level Authorisation (Defence in Depth)

Even if a JWT is crafted with elevated role claims, the Service Layer's `checkResourceAccess` performs an independent per-resource check against the database. A compromised token cannot access resources the attacker does not legitimately own.

### Input Sanitisation

The `sanitize` middleware (applied at the Gateway before all routes) strips:
- HTML tags from all string fields (prevents stored XSS)
- SQL injection patterns (belt-and-suspenders over Prisma's parameterised queries)
- Null bytes and control characters
- Strings exceeding configured maximum lengths

### CORS

CORS is configured in `app.ts` to only allow requests from the configured frontend origin (`CORS_ORIGIN` env variable). Cross-origin requests from untrusted origins are rejected at the HTTP level.

### Privilege Escalation Prevention

The business rule engine checks that an admin cannot grant a role with permissions that exceed their own permission set. This prevents a compromised admin account from escalating to a higher privilege level.

### Outbox Security

Outbox events are internal — they are never exposed via any public API endpoint. The `OutboxEvent` table is only accessible to the background worker process. The audit log (which is admin-queryable) contains the notification records, not the raw outbox payloads.

---

## Threat Model Summary

| Threat | Mitigation |
|--------|-----------|
| DDoS / volumetric flood | Edge Layer (WAF + DDoS protection) |
| Bot traffic | Edge Layer (bot filtering) |
| Brute force login | `authRateLimiter` (IP-based, before auth) |
| JWT forgery | RS256/HS256 signature + object-level re-verification |
| Stolen JWT | Short TTL (24h) + session invalidation via Redis on role revocation |
| SQL injection | Prisma parameterised queries + input sanitisation |
| Stored XSS | Input sanitisation strips HTML tags; output encoding in React |
| Secret sprawl | Centralised vault; no credentials in code or version control |
| Credential exposure in logs | Token scrubbing in logger middleware |
| Privilege escalation | Business rule: cannot grant permissions exceeding own level |
| Data exfiltration via bulk export | Admin audit log exports rate-limited; require admin role |
| Insecure asset access | All asset access via short-lived presigned URLs (not public buckets) |
