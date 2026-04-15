# Centralized Comms Library

Monorepo for the **Centralized Comms Library** platform:

- `apps/web` – Vite + React frontend
- `apps/api` – Express + TypeScript backend
- `packages/database` – Prisma-based transactional database

### Layout convention

- **`apps/api/src/modules/<domain>/`** – HTTP routes, schemas, types, and domain services for that feature (including search: routes, filters, indexing, and retrieval live together under `modules/search/`).
- **`apps/api/src/repository/`** – Persistence: Prisma implementations, interfaces, and row/DTO types.
- **`apps/api/src/shared/`** – Cross-cutting helpers used by many domains (validation, auth context, hashing, cache clients, errors).
- **`apps/api/src/application/`**, **`bootstrap/`**, **`gateway/`**, **`routes/`** – HTTP composition: mounting routers, public/protected route registration, and the top-level API router.
- **`apps/api/src/middlewares/`**, **`config/`**, **`jobs/`**, **`observability/`**, **`platform/`**, **`docs/`** – Infra-adjacent code with clear, single-purpose folders.
- **`apps/web/src/pages/`** – Route-level screens; **`components/`** – UI by area; **`layouts/`** – shell layouts; **`services/`** – API clients; **`lib/`** – shared browser utilities and formatters; **`hooks/`**, **`context/`**, **`store/`**, **`config/`**, **`constants/`**, **`types/`**, **`data/`** – supporting layers as named.

---

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

From repo root:

```bash
cp apps/api/env.example apps/api/.env   # ensure DATABASE_URL matches compose network
docker compose up --build
```

- API: `http://localhost:8000`
- Web: `http://localhost:3000`

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
