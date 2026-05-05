# Service Layer

## Purpose

The Service Layer is the core of the system. Every piece of domain logic lives here. It is responsible for:

1. **Input validation** — ensuring request data conforms to domain schemas
2. **Object-Level Authorisation** — checking whether the authenticated user can perform this action on this specific resource
3. **Business rule enforcement** — applying domain constraints (lifecycle transitions, review quorum, template integrity)
4. **Domain logic execution** — the actual work (creating content, deciding a review, propagating a component)
5. **Transactional persistence** — committing data changes + outbox events atomically via the Unit of Work

---

## Code Location

```
apps/api/src/modules/<domain>/<domain>.service.ts
apps/api/src/shared/
├── authorization/index.ts      ← checkResourceAccess
├── businessRules/index.ts      ← evaluateBusinessRule
├── circuitBreaker/index.ts     ← withCircuitBreaker
└── aiDraftQuota.ts             ← quota helpers
```

---

## Object-Level Authorisation

**File:** `apps/api/src/shared/authorization/index.ts`

`checkResourceAccess(userId, resourceType, resourceId, action, uow)` performs a per-resource permission check **after** the Gateway has verified the caller's identity.

**Resource types and checks:**
- `content` — is the user the author, a co-author, an assigned reviewer, or an admin? Is the content's visibility compatible with the action?
- `template` — is the user the template owner or an admin?
- `review` — is the user an assigned reviewer for this review request?
- `admin` — does the user have the admin role?

**Group visibility:** For `PRIVATE_TO_GROUP` content, `checkResourceAccess` fetches the user's group memberships from the Repository and checks intersection with the content's target groups.

This two-step model (Gateway verifies identity → Service Layer verifies per-object permission) means that even if a JWT is forged with escalated role claims, the object-level check will still deny access to resources the user does not own.

---

## Business Rule Engine

**File:** `apps/api/src/shared/businessRules/index.ts`

`evaluateBusinessRule(ruleName, context, uow)` is the central point for domain constraint evaluation. Rules are registered by name and invoked by service methods before committing any state change.

**Implemented rule categories:**

| Rule category | Examples |
|--------------|---------|
| Lifecycle transitions | Draft → In Review requires at least one reviewer; Published → Archived requires no active co-author session |
| Visibility changes | Draft cannot be set to PUBLIC before publication |
| Review quorum | All required approvals must be present before state can transition to PUBLISHED |
| Template integrity | Template deletion requires migration of all content using it; template with required fields cannot be activated with empty fields |
| AI content flag | AI-generated content must have at least 1 human reviewer (when policy set) |
| Group membership | Group role assignment does not grant permissions exceeding the assigning admin's own permissions |

Rules return a `{ passed: boolean, reason?: string }` result. On failure, the service throws an `AppError(400, reason)` — never silently continuing.

---

## Unit of Work Pattern

**File:** `apps/api/src/repository/implementations/prisma/unitOfWork.prisma.ts`

`PrismaUnitOfWork` provides:
- `repos()` → returns all Prisma-backed repository instances (content, tags, reviews, users, channels, templates, assets, outbox, audit, etc.)
- `withTransaction(callback)` → wraps the callback in a Prisma `$transaction`, ensuring that all repository operations (data change + outbox event) succeed or fail atomically

**Pattern used in every state-changing service method:**

```typescript
await uow.withTransaction(async (txRepos) => {
  await txRepos.contentRepository.updateState(contentId, newState);
  await txRepos.outboxRepository.create({
    eventType: KnownEventType.CONTENT_STATE_CHANGED,
    payload: { contentId, newState, actorId },
  });
  await txRepos.auditRepository.create({
    action: 'CONTENT_STATE_CHANGED',
    actorId,
    targetId: contentId,
    metadata: { previousState, newState },
  });
});
```

This guarantees that if the process crashes between the database write and the notification dispatch, the outbox event will be picked up on the next poll and the notification will still be sent.

---

## CRDT / Co-Authoring

The Service Layer initialises and manages co-authoring sessions. When two authors open the same document:

1. `content.service.ts → requestCoAuthor` records the co-author relationship in `ContentCoAuthor`
2. `realtime/wsServer.ts` establishes the WebSocket session
3. Document deltas from each author are merged using CRDT semantics
4. The merged document state is persisted to `ContentVersion` on each save
5. All participants receive the merged delta via WebSocket broadcast

CRDT ensures that if Author A deletes a word at position 10 while Author B inserts a word at position 10 simultaneously, both operations produce a consistent merged result without any loss of intent.

---

## Circuit Breakers

**File:** `apps/api/src/shared/circuitBreaker/index.ts`

`withCircuitBreaker(name, fn)` wraps calls to external services:
- Embedding service (AI)
- Async AI Worker
- Notify API (email + WhatsApp)
- External social media APIs

**Circuit states:**
- **Closed (normal):** calls pass through
- **Open:** downstream is failing; calls are rejected immediately with `CircuitOpenError` (no waiting for timeout)
- **Half-open:** after a recovery timeout, one probe request is allowed; if it succeeds, the circuit closes

When a circuit opens, the Service Layer returns a graceful error to the Application Layer, which returns an appropriate HTTP response to the client (e.g. 503 Service Unavailable with a retry hint).

---

## Domain Services Summary

| Service file | Key responsibilities |
|-------------|---------------------|
| `content.service.ts` | CRUD, state transitions, visibility, co-authoring, snapshots, analytics events |
| `review.service.ts` | Review request/assignment lifecycle, decisions, rollback, comments |
| `template.service.ts` | Template CRUD, clone, channel bindings, layout draft/activation, translations |
| `tag.service.ts` | Tag CRUD with taxonomy enforcement |
| `channel.service.ts` | Channel configuration CRUD |
| `admin.service.ts` | Role/group/user management, policy management, audit log, settings, monitoring |
| `profile.service.ts` | User profile, bookmarks, folders, presence |
| `assets.service.ts` | Asset upload/finalization, usage tracking |
| `linkIntegrity.service.ts` | Broken link scanning |
| `whatsappSend.service.ts` | WA payload conversion, batch send, status tracking |
| `emailSend.service.ts` | Email payload build, send via Notify API |
| `componentPropagation.service.ts` | Linked component propagation on version update |
