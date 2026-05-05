# Repository Layer

## Purpose

The Repository Layer is the **only gateway to persistent storage**. All reads and writes from the Application and Service layers must go through typed repository interfaces, not through raw database clients. This enforces:

- A clean separation between domain logic and storage implementation
- The ability to swap the database (e.g. from PostgreSQL to a different provider) by replacing only repository implementations, without touching service code
- Consistent transaction boundaries via the Unit of Work pattern

---

## Code Location

```
apps/api/src/repository/
├── interfaces/
│   ├── index.ts                    ← barrel re-export
│   ├── contentRepository.ts
│   ├── userRoleRepository.ts
│   ├── tagRepository.ts
│   ├── reviewRepository.ts
│   ├── reviewPolicyRepository.ts
│   ├── auditRepository.ts
│   ├── outboxRepository.ts
│   ├── channelRepository.ts
│   ├── templateRepository.ts
│   ├── workspaceRepository.ts
│   ├── templateTranslationRepository.ts
│   ├── componentRegistryRepository.ts
│   ├── templateLayoutSectionRepository.ts
│   ├── contentCitationRepository.ts
│   ├── contentSnapshotRepository.ts
│   └── assetRepository.ts
├── implementations/
│   └── prisma/
│       ├── unitOfWork.prisma.ts
│       ├── contentRepository.prisma.ts
│       ├── componentRegistryRepository.prisma.ts
│       ├── assetRepository.prisma.ts
│       └── … (one file per interface)
├── types/
│   ├── content.ts
│   ├── componentRegistry.ts
│   └── … (domain DTO types)
└── index.ts                        ← getPrismaClient, PrismaUnitOfWork
```

---

## Repository Interfaces

Each interface defines the contract for one domain aggregate. Services depend on the interface, not the implementation.

### IContentRepository

| Method | Description |
|--------|-------------|
| `create(draft)` | Persist a new content record with DRAFT state |
| `findById(id, userId?)` | Fetch content with visibility-aware filtering |
| `findMany(filters)` | List content with pagination, state, and visibility filters |
| `updateState(id, state)` | Transition lifecycle state |
| `updateVisibility(id, mode, groupIds?)` | Update visibility mode and optional group bindings |
| `saveBody(id, body)` | Persist TipTap JSON body; create snapshot |
| `appendSnapshot(id, snapshot)` | Write an immutable snapshot record |
| `listSnapshots(id)` | Return version history list |
| `getSnapshot(id, version)` | Fetch a specific snapshot |
| `assignTag(id, tagId)` | Create `ContentTag` join record |
| `removeTag(id, tagId)` | Delete `ContentTag` join record |
| `softDelete(id)` | Mark content as deleted; not physically removed |

### IReviewRepository

| Method | Description |
|--------|-------------|
| `createRequest(data)` | Create a `ReviewRequest` record |
| `createAssignment(data)` | Assign a reviewer; create `ReviewAssignment` |
| `getRequestById(id)` | Fetch request with assignments and decisions |
| `updateAssignmentStatus(id, status)` | Transition assignment state |
| `createDecision(data)` | Persist `ReviewDecision` |
| `createComment(data)` | Add `ReviewComment` to a thread |
| `listAssignmentsForReviewer(userId)` | Fetch reviewer's assignment queue |

### IOutboxRepository

| Method | Description |
|--------|-------------|
| `create(event)` | Write an `OutboxEvent` record (called within a transaction) |
| `fetchUnprocessed(limit)` | Poll for events with `status = PENDING` |
| `markProcessed(id)` | Set event status to `PROCESSED` |
| `incrementRetry(id)` | Increment retry count |
| `deadLetter(id)` | Move event to dead-letter status |

### IAuditRepository

| Method | Description |
|--------|-------------|
| `create(entry)` | Append an immutable audit log entry |
| `query(filters)` | Search log entries with date/actor/action filters |
| `export(filters)` | Return a cursor/stream for CSV/JSON export |

### IAssetRepository

| Method | Description |
|--------|-------------|
| `create(asset)` | Create `Asset` record after upload intent |
| `finalize(id, metadata)` | Mark asset as uploaded; store S3 key and metadata |
| `findById(id)` | Fetch asset with usage counts |
| `listForOwner(userId)` | List assets owned by a user |
| `delete(id)` | Mark asset as deleted (soft delete) |
| `createUsage(data)` | Register `AssetUsage` link to content/template |
| `createLinkCheck(data)` | Record `AssetLinkCheck` result |

---

## Unit of Work (`PrismaUnitOfWork`)

**File:** `apps/api/src/repository/implementations/prisma/unitOfWork.prisma.ts`

```typescript
class PrismaUnitOfWork {
  repos(): AllRepositories
  withTransaction<T>(callback: (repos: AllRepositories) => Promise<T>): Promise<T>
}
```

`withTransaction` wraps the callback in a Prisma `$transaction`. All repository operations inside the callback share the same database connection and are committed atomically. If any operation throws, the entire transaction is rolled back.

The pattern ensures that a domain event (`OutboxEvent`) is always written in the same transaction as the data change it describes. There is no window where the data is committed but the event is not.

---

## getPrismaClient

**File:** `apps/api/src/repository/index.ts`

`getPrismaClient()` returns a singleton Prisma client instance. The client is initialised once at startup and reused across all requests. Connection pooling is handled by Prisma's built-in pool.

---

## Type Safety

All repository methods are fully typed. Domain DTOs in `repository/types/` mirror the Prisma model types but are decoupled from them — services import from `repository/types/` rather than from `@prisma/client` directly. This ensures that changes to the Prisma schema do not silently break service code; TypeScript compilation will catch mismatches.
