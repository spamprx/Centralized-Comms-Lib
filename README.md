# Centralized Comms Library

Monorepo for the **Centralized Comms Library** platform:

- `apps/web` – Vite + React frontend
- `apps/api` – Express + TypeScript backend
- `packages/database` – Prisma-based transactional database

## Layout convention

- **`apps/api/src/modules/<domain>/`** – HTTP routes, schemas, types, and domain services for that feature (including search: routes, filters, indexing, and retrieval live together under `modules/search/`).
- **`apps/api/src/repository/`** – Persistence: Prisma implementations, interfaces, and row/DTO types.
- **`apps/api/src/shared/`** – Cross-cutting helpers used by many domains (validation, auth context, hashing, cache clients, errors).
- **`apps/api/src/application/`**, **`bootstrap/`**, **`gateway/`**, **`routes/`** – HTTP composition: mounting routers, public/protected route registration, and the top-level API router.
- **`apps/api/src/middlewares/`**, **`config/`**, **`jobs/`**, **`observability/`**, **`platform/`**, **`docs/`** – Infra-adjacent code with clear, single-purpose folders.
- **`apps/web/src/pages/`** – Route-level screens; **`components/`** – UI by area; **`layouts/`** – shell layouts; **`services/`** – API clients; **`lib/`** – shared browser utilities and formatters; **`hooks/`**, **`context/`**, **`store/`**, **`config/`**, **`constants/`**, **`types/`**, **`data/`** – supporting layers as named.

---

## Security (API)

- **CORS:** Set `ALLOWED_ORIGINS` to a comma-separated list of exact web origins (e.g. `https://app.example.com`). In development, if unset, the API allows `http://localhost:3000-3010` and `http://127.0.0.1:3000-3010` by default.
- **Auth:** JWTs are stored in an **HttpOnly** `auth_token` cookie (path `/`). A readable `csrf_token` cookie is used for **double-submit CSRF** — all mutating API calls (`POST`/`PUT`/`PATCH`/`DELETE` under `/api/v1`) must send header `X-CSRF-Token` matching that cookie. The SPA uses `credentials: "include"` and no longer keeps the JWT in `sessionStorage`.
- **Headers:** `helmet` sets CSP (Swagger UI at `/api-docs` uses relaxed CSP), HSTS in production, `Referrer-Policy: no-referrer`, and related hardening on the Express app.
- **Rate limits:** Stricter limiter on `/auth/login` and `/auth/register` (5 req/min/IP) in addition to the general API limiter.
- **Docker Compose:** Copy [.env.example](.env.example) to `.env` and set at least `POSTGRES_PASSWORD`, `JWT_SECRET`, and MinIO credentials — compose uses `${VAR:?message}` so missing secrets fail fast instead of embedding defaults in the file.
- **Dev tools:** `/dev/repo-check` and `/dev/reindex` require `NODE_ENV !== "production"` **and** header `X-Dev-Token: $ADMIN_DEV_TOKEN` when `ADMIN_DEV_TOKEN` is set.

## Prerequisites

- Node.js ≥ 20
- npm ≥ 9
- Docker ≥ 24 (for containerised runs)

Install dependencies once at the repo root:

```bash
npm install
```

---

## Running locally (dev)

### API

From repo root:

```bash
cp apps/api/env.example apps/api/.env   # fill in DATABASE_URL, JWT_SECRET, etc.
npm run dev:api
```

API will be available at `http://localhost:8000`.
Swagger / OpenAPI UI is exposed at `http://localhost:8000/api-docs`.

### Web

```bash
npm run dev:web
```

Web app will be available at `http://localhost:3000`.

---

## Running with Docker Compose

The repo includes a `docker-compose.yml` that wires:

- `db` – PostgreSQL for the transactional database
- `api` – compiled Node.js API (`comms-api`)
- `web` – nginx-served React app (`comms-web`)
- `minio` – S3-compatible object storage for assets/blobs
- `minio-mc` – bootstrap job to create MinIO buckets/policies/quotas

From repo root:

```bash
cp apps/api/env.example apps/api/.env   # ensure DATABASE_URL matches compose network
cp .env.example .env                     # set MinIO credentials/config
docker compose up --build
```

- API: `http://localhost:8000`
- Web: `http://localhost:3000`
- MinIO S3 API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001` (from `.env`: `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`)

### MinIO storage limit

Your Docker host must support `storage_opt.size` (overlay2 on XFS with `pquota`) to enforce a hard per-container disk cap.
If unsupported, run MinIO without that option and enforce storage limits externally (host-level quotas or dedicated disk partition).

### MinIO bootstrap behavior

- `minio-mc` runs once after MinIO is healthy and configures:
  - Buckets: `images`, `documents`, `videos`, `backups`, `temp`
  - Versioning: `images`, `documents`, `backups`
  - Lifecycle rules: `temp` expiry (7 days), noncurrent version cleanup
  - Quotas per bucket
  - `app-user` policy with scoped read/write access
  - Optional anonymous-read for `images` (`MINIO_PUBLIC_IMAGES=true`)

Scripts are stored in `infra/minio/scripts`.

### Assets HTTP API (JWT required)

Metadata lives in Postgres (`Asset`, `AssetUsage`); file bytes are stored in MinIO via **presigned PUT**, then finalized server-side.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/assets/upload-intent` | Reserve row + return presigned upload URL |
| `POST` | `/api/v1/assets/:id/finalize` | Mark upload complete after object exists |
| `GET` | `/api/v1/assets` | List (query: `placement`, `category`, `limit`, `offset`) |
| `GET` | `/api/v1/assets/:id/view-link` | Short-lived signed GET URL |
| `DELETE` | `/api/v1/assets/:id` | Soft-delete metadata + remove object |
| `POST` | `/api/v1/assets/:id/usages` | Track usage (`CONTENT` / `TEMPLATE` / `OTHER`) |
| `POST` | `/api/v1/library/:id/share-link` | Signed URL for **library** placement shares |

Set `MINIO_ENDPOINT`, `MINIO_PUBLIC_ENDPOINT`, and credentials in `apps/api/.env` (see `apps/api/env.example`). Docker Compose passes defaults into the `backend` service.

### Notification Framework media flow

For end-to-end WhatsApp/email attachments through notification-framework:

1. Run notification-framework and expose its API on `http://localhost:18000`.
2. Keep CCL backend `NOTIFY_SERVER_URL` pointed to `http://host.docker.internal:18000/notify` (default in compose).
3. Ensure notification-framework has:
   - `PUBLIC_BASE_URL=http://host.docker.internal:18000` (or a real public HTTPS host in production)
   - `MEDIA_URL_TTL_DAYS=30`
4. CCL uploads attachment bytes into notification-framework `/media/upload` and sends notifications by `file_id` (no `public-assets` dependency for comms delivery).

Quick verification script:

```bash
NOTIFY_API_KEY=... \
NOTIFY_CLIENT_ID=... \
TEST_WA_NUMBER=+91XXXXXXXXXX \
TEST_EMAIL=you@example.com \
bash infra/scripts/verify-notify-media-flow.sh
```

The script uploads a remote file to notification-framework `/media/upload`, gets `file_id`, and sends `/notify` with that `file_id`.

---

## Key Back-end Features (Sprint 2)

- **Content**
  - Lifecycle management: `DRAFT → IN_REVIEW → PUBLISHED → ARCHIVED`
  - Visibility rules: `PUBLIC`, `PRIVATE`, `HIDDEN`, `PRIVATE_TO_GROUP`
  - Tag assignment and version history
  - Co-author invitations, acceptance / rejection, and access control

- **Admin**
  - Role CRUD and granular permissions
  - User/group management and group membership
  - User–role assignment and updates

- **Reviews**
  - Review requests for content versions with quorum
  - Reviewer assignments and decision recording
  - Reviewer rollback of decisions back to pending

---

## Docker Images

- API container docs: `infra/docker/api/README.md`
- Web container docs: `infra/docker/web/README.md`
