# Infrastructure — CI/CD Pipeline

## Overview

The CI/CD pipeline runs on GitHub Actions. Each sprint's features are developed on feature branches and merged to `main` via pull requests. The pipeline runs on every push and pull request.

---

## Pipeline Stages

```
Push / PR
    │
    ▼
1. Install & Lint
    │ turbo build (TypeScript compile + ESLint)
    │
    ▼
2. Unit Tests
    │ turbo test (Jest across all packages)
    │
    ▼
3. Build Docker Images
    │ docker build api + frontend
    │
    ▼
4. Integration Tests (staging DB)
    │ prisma migrate deploy
    │ seed test data
    │ Jest integration tests
    │
    ▼
5. Push Images to Registry
    │ docker push to ECR / GHCR
    │
    ▼
6. Deploy to Staging
    │ ECS service update / kubectl apply
    │ Run smoke tests
    │
    ▼
7. Deploy to Production (manual gate on main branch)
```

---

## Package Manager & Build Tool

- **Package manager:** npm (with workspace support via `package.json` workspaces)
- **Monorepo build:** Turborepo (`turbo.json`)
- **TypeScript:** `tsc` (strict mode, no implicit any)
- **Linting:** ESLint with TypeScript rules

### Key scripts

```bash
# Development
npm run dev             # Start all services in dev mode (turbo)

# API-specific
cd apps/api
npm run dev             # ts-node-dev hot reload
npm run build           # tsc compile to dist/
npm run start           # node dist/server.js
npm run job:vector-reindex   # manual vector reindex
npm run job:link-scan        # manual asset link scan

# Testing
npm test                # Jest
npm run test:coverage   # Jest with coverage report

# Database
npx prisma migrate dev --name <name>   # create migration
npx prisma migrate deploy              # apply migrations (production)
npx prisma db seed                     # seed initial data
npx prisma studio                      # GUI data browser
```

---

## Test Strategy

### Unit tests (`*.test.ts`)

- Located alongside source files in each module directory
- Test individual service functions with mocked repositories (Prisma mock)
- Test business rule evaluation with known fixture inputs
- Test circuit breaker behaviour with simulated failures

### Integration tests

- Spin up a test PostgreSQL database (separate from dev)
- Run actual Prisma migrations on the test DB
- Test full request flows through the Express app (using `supertest`)
- Verify that outbox events are created correctly
- Verify search index sync behaviour

### End-to-end tests (frontend)

- Playwright or Cypress (planned but not in current CI)
- Will test user flows: register → create draft → submit → review → publish → read

---

## Branch Strategy

| Branch | Purpose | Deployment target |
|--------|---------|------------------|
| `main` | Stable, production-ready | Production (manual gate) |
| `staging` | Integration testing | Staging environment |
| `sprint/<N>` | Sprint development | Dev / preview |
| `feature/<name>` | Individual feature | None (PR only) |

---

## Sprint Cadence

Each sprint has a defined set of committed features (see `docs/technical/07_sprint_implementation_notes/`). At sprint end:

1. All feature branches are merged to `sprint/<N>`
2. Sprint branch is merged to `main` after QA sign-off
3. A Git tag is created: `v0.N.0` (e.g. `v0.2.0` for Sprint 2)
4. CI/CD deploys the tagged image to production

---

## Environment Promotion

```
Feature branch
    → PR → code review
    → Merge to sprint/<N>
    → Auto-deploy to dev environment (docker compose)
    → QA testing
    → Merge sprint/<N> to main
    → Tag: v0.N.0
    → Auto-deploy to staging
    → Smoke tests pass
    → Manual gate: approve production deploy
    → Deploy to production
    → Monitor metrics for 30 minutes
    → Close sprint
```

---

## Rollback Procedure

If a production deployment causes issues:

1. ECS: update service to use the previous image tag (e.g. `v0.N-1.0`)
2. Database: if a migration was applied, run `prisma migrate resolve --rolled-back <migration-name>` (only if the migration is reversible)
3. For irreversible schema changes: roll forward with a fix migration rather than reverting

This is why all schema changes should be backward-compatible (add columns with defaults; never remove columns in the same deployment that removes code using them).
