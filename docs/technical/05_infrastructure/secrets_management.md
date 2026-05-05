# Infrastructure — Secrets Management

## Design Principle

No service stores credentials locally. All secrets are injected at runtime via environment variables sourced from a centralised secrets vault. This eliminates secret sprawl — there is one authoritative location for every credential, and rotation requires a vault update rather than a code deployment.

---

## Secret Categories

| Category | Examples | Where used |
|----------|---------|-----------|
| **Database credentials** | `DATABASE_URL` (includes password) | API server → Prisma |
| **Cache credentials** | `REDIS_URL` (may include auth password) | API server → ioredis |
| **JWT signing key** | `JWT_SECRET` | Gateway Layer → authentication |
| **Object storage keys** | `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` | API server → S3 SDK |
| **AI service key** | `EMBEDDING_SERVICE_API_KEY` | Intelligence Layer |
| **Notify API credentials** | `NOTIFY_CLIENT_ID`, `NOTIFY_API_KEY` | Email/WhatsApp sends |
| **Elasticsearch credentials** | (optional) `ELASTICSEARCH_USERNAME`, `ELASTICSEARCH_PASSWORD` | Search client |

---

## Encryption Standards

### Symmetric encryption at rest (NFR-SEC-02)

- Algorithm: **AES-256** (AES in GCM mode for authenticated encryption)
- Key derivation: **HKDF** (HMAC-based Key Derivation Function) using a master key from the vault
- Key material: sourced from AWS KMS, HashiCorp Vault, or GCP Cloud KMS depending on deployment
- Key rotation: mandatory at regular intervals (minimum: quarterly). Rotation requires no server restart — new keys are fetched at startup from the vault

### Transit encryption (NFR-SEC-01)

- All external API calls (Notify API, AI service) use **TLS 1.3**
- All internal service-to-service calls within the private VPC use TLS 1.3 where supported
- Database connections use TLS (`sslmode=require` in `DATABASE_URL`)

---

## JWT Signing

JWT tokens use **RS256** (RSA + SHA-256) or **HS256** (HMAC-SHA256) depending on deployment configuration. The signing key is the value of `JWT_SECRET` or the RSA private key path.

The Gateway Layer fetches the current signing key from the vault at startup. Key rotation:
1. A new key is added to the vault
2. The API server can be signalled to reload the key without restart
3. Tokens signed with the old key continue to be valid until they expire
4. After token expiry window (default: 24 hours), the old key can be removed

**Token scrubbing (NFR-SEC-03):** JWT tokens are never written to logs. The log middleware strips `Authorization` headers and any field matching `/bearer\s+[a-zA-Z0-9._-]+/i` from log payloads before writing to the audit store.

---

## Platform Services (Vault)

**File:** `apps/api/src/platform/secrets.ts` (referenced; not fully detailed in public code)

At startup, the API server:
1. Reads vault address from `VAULT_ADDR` environment variable
2. Authenticates to the vault using the container's IAM role (for AWS KMS) or a Vault token
3. Fetches the current versions of all required secrets
4. Injects them into process environment / config objects

In development (Docker Compose), secrets are passed directly as environment variables in `docker-compose.yml`. The `docker-compose.yml` references `.env` (git-ignored) for local secret values.

---

## MinIO Object Storage Keys

Asset URLs are never served raw. All access uses presigned URLs:

- **PUT:** `presignPut(bucket, key, expiresInSeconds)` — 15 minute expiry for uploads
- **GET:** `presignGet(bucket, key, expiresInSeconds)` — 1 hour expiry for downloads

Presigned URLs are signed using the MinIO access key via AWS SDK v3 HMAC-SHA256. The MinIO access key and secret key are sourced from environment variables and never logged.

**File:** `apps/api/src/platform/storage/s3Presign.ts`

---

## Security Checklist for Operations

| Check | Frequency | Responsible |
|-------|-----------|-------------|
| Rotate `JWT_SECRET` | Quarterly | Ops/Security team |
| Rotate `MINIO_SECRET_KEY` | Quarterly | Ops/Security team |
| Rotate `NOTIFY_API_KEY` | On provider rotation schedule | Ops team |
| Rotate DB password | Quarterly (or on breach) | DBA/Ops |
| Review dead-letter events for credential leaks | Monthly | Admin |
| Verify token scrubbing in audit log sample | Monthly | Security audit |
| Confirm TLS certificate validity (30-day warning) | Weekly (automated) | CI/CD alert |
