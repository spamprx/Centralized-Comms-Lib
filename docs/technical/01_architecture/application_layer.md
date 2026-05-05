# Application Layer

## Purpose

The Application Layer coordinates high-level workflows. It is the first layer that has knowledge of the application's domain structure. Its responsibilities are:

- Route matching — mapping HTTP requests to the correct domain module
- Workflow orchestration — combining calls to Service Layer modules for multi-step operations
- Asset management coordination — directing file upload/download flows
- Real-time session management — establishing WebSocket collaboration sessions

The Application Layer does **not** contain business logic, permission checks, or data access. Those belong to the Service and Repository layers respectively.

---

## Code Location

```
apps/api/src/application/http/
├── domainRouters.ts           ← maps router names to Express Router instances
├── registerPublicRoutes.ts    ← mounts /auth
├── registerProtectedRoutes.ts ← mounts all domain routers
└── registerAiRoutes.ts        ← mounts /ai/health (quota-gated)

apps/api/src/bootstrap/
└── createApiRouter.ts         ← composes Gateway + Application into the root router
```

---

## Domain Router Map

`domainRouters.ts` exports the `applicationDomainRouters` object, which is a map from router name to its Express `Router` instance. Each router is imported from its module directory.

```typescript
// Conceptual representation
applicationDomainRouters = {
  content:      contentRouter,      // modules/content/content.routes.ts
  tags:         tagRouter,          // modules/tag/tag.routes.ts
  reviews:      reviewRouter,       // modules/review/review.routes.ts
  admin:        adminRouter,        // modules/admin/admin.routes.ts
  analytics:    analyticsRouter,    // modules/analytics/analytics.routes.ts
  channels:     channelRouter,      // modules/channel/channel.routes.ts
  templates:    templateRouter,     // modules/template/template.routes.ts
  search:       searchRouter,       // modules/search/search.routes.ts
  components:   componentRouter,    // modules/component/component.routes.ts
  citations:    citationRouter,     // modules/citation/citation.routes.ts
  profile:      profileRouter,      // modules/profile/profile.routes.ts
  groups:       groupRouter,        // modules/group/group.routes.ts
  assets:       assetRouter,        // modules/assets/assets.routes.ts
  library:      libraryRouter,      // modules/library/library.routes.ts
  workflows:    workflowRouter,     // modules/workflow/workflow.routes.ts
  whatsappSend: whatsappSendRouter, // modules/whatsapp-send/whatsappSend.routes.ts
  emailSend:    emailSendRouter,    // modules/email-send/emailSend.routes.ts
}
```

---

## Application-Level Orchestration Patterns

### Content Engine

The content module's Application Layer functions (`Content & Template Engine` in the SRS) handle:
- Opening the editor with a blank or template-initialised state
- Rendering the published content view (served from Redis cache or Prisma fallback)
- Composing template + content for channel-specific rendering at distribution time

### Workflow Engine

The workflow module coordinates multi-step pipeline runs:
1. Application Layer receives `POST /workflows/pipeline-run`
2. Validates the pipeline configuration (ordered steps, associated content ID)
3. For each step, dispatches either a Sync AI task or an Async AI job
4. Aggregates step results; returns a summary report

### Asset Management

Upload flow (two-step):
1. `POST /assets/upload-intent` → Application Layer calls `platform/storage/s3Presign.ts → presignPut` → returns presigned URL to client
2. Client uploads directly to MinIO using the presigned URL
3. `POST /assets/:id/finalize` → Application Layer records the completed asset in the Repository

Download flow:
1. `GET /assets/:id/view-link` → Application Layer calls `presignGet` → returns short-lived signed URL
2. Client fetches directly from MinIO

This two-step pattern keeps binary data out of the API server entirely.

### Real-Time Collaboration

The Application Layer coordinates the WebSocket collaboration session:
1. Author connects via WebSocket (`realtime/wsServer.ts`)
2. Application Layer verifies JWT on the WebSocket handshake
3. Opens a collaboration session for the content item; registers participant
4. Broadcasts cursor positions and document deltas to all participants
5. Session closure is detected on WebSocket disconnect

---

## OpenAPI Documentation

Each domain router file contains inline OpenAPI annotations (`swagger-jsdoc` format). These are compiled into a full OpenAPI 3.0 spec served at:

```
GET /api-docs
```

The spec covers all protected and public endpoints, including request/response schemas, authentication requirements, and error codes.

---

## Module Directory Structure

Each domain module follows a consistent structure:

```
modules/<domain>/
├── <domain>.routes.ts   ← Express Router + OpenAPI annotations
├── <domain>.service.ts  ← Domain service (business logic + repository calls)
└── <domain>.types.ts    ← TypeScript types and DTOs
```

Larger modules have additional files:
- `formattingRule.service.ts` (template module)
- `componentPropagation.service.ts` (component module)
- `contentSearch.service.ts` (search module)
- `contentEmbedding.ts` (search module)
- `linkIntegrity.service.ts` (assets module)
