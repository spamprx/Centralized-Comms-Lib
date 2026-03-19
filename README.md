# Centralized Comms Library

Monorepo for the **Centralized Comms Library** platform:

- `apps/web` – Vite + React frontend
- `apps/api` – Express + TypeScript backend
- `packages/database` – Prisma-based transactional database

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
