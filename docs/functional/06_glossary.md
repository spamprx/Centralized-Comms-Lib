# Glossary

All terms used in the Comms-Library platform documentation and SRS.

---

| Term | Definition |
|------|-----------|
| **AI Quota** | A per-user daily limit on AI requests, enforced at the Gateway Layer by `aiQuotaEnforcer` middleware. Requests exceeding the quota are rejected with a 429 status before reaching any backend logic. |
| **Application Layer** | The layer responsible for coordinating high-level workflows (content authoring, review pipelines, real-time collaboration). It orchestrates calls to the Service Layer and does not contain business logic itself. |
| **Async AI Worker** | A background process (`intelligence/asyncAiWorker.ts`) that handles long-running AI jobs (template generation, plagiarism checks, content pipeline runs) without blocking the main request thread. Jobs are queued via the Outbox Pattern and dispatched via HTTP to an external AI worker service. |
| **Audit Log** | An immutable, append-only record of every significant system event (`AuditLog` table in PostgreSQL). Used for compliance, security audits, and troubleshooting. Retained for a configurable period (default 2 years). |
| **Authentication** | The Gateway Layer verifies a caller's identity by checking their JWT against the signing keys fetched from the secrets vault. Unauthenticated requests are rejected before reaching any business logic. |
| **Authorisation (Object-Level)** | A per-resource access check performed in the Service Layer by `checkResourceAccess`. Confirms whether the authenticated user is permitted to perform the requested action on that specific item (e.g. "can this user edit content ID X?"). |
| **Bookmark** | A user's saved reference to a content item (`ContentBookmark` model). Organised into folders. Users receive a notification when a bookmarked item is updated. |
| **Business Rule Engine** | The `shared/businessRules/index.ts → evaluateBusinessRule` function. Enforces domain constraints such as valid lifecycle transitions, review quorum requirements, template integrity, and visibility rules. |
| **Cache (Redis)** | An in-memory key-value store (ioredis) used to serve frequently-read data without hitting PostgreSQL. Used for content detail caching, search epoch caching, session token invalidation, AI Tutor conversation context, and real-time reaction counts. |
| **Canvas** | An LMS platform that receives published content via the Channels module. Configured as a `Channel` with type `CANVAS`. |
| **Channel** | A named distribution endpoint with its own rendering configuration (`Channel` model). Examples: Email, SMS, WhatsApp, Moodle, Calendar, Push Notifications. |
| **Circuit Breaker** | A fault-tolerance pattern implemented in `shared/circuitBreaker/index.ts → withCircuitBreaker`. Wraps calls to external services (AI worker, embedding service, Notify API). When the downstream service fails repeatedly, the circuit opens and requests are rejected quickly rather than hanging. |
| **Clustering (AI)** | AI-based grouping of published content by topic. Content embeddings from the Vector Store are clustered by the Async AI Worker. Clusters appear on the Explore page (`F-AUD-007`). |
| **Co-authoring (CRDT/OT)** | Real-time concurrent editing by multiple authors on the same document. Conflict resolution uses CRDT (Conflict-free Replicated Data Type) or OT (Operational Transformation) to guarantee eventual consistency without data loss. |
| **Component** | A reusable content block (`Component` + `ComponentVersion` models). Can be embedded in content items in either Linked mode (auto-updates) or Snapshot mode (static copy). |
| **Content Lifecycle States** | The four governed states a content item moves through: `DRAFT`, `IN_REVIEW`, `PUBLISHED`, `ARCHIVED`. Transitions are validated by the Business Rule Engine and logged to the Audit Log. |
| **CRDT** | Conflict-free Replicated Data Type — a data structure designed for concurrent editing that guarantees all participants converge to the same state without requiring coordination. See Co-authoring. |
| **CRUD** | The four fundamental data operations: Create, Read, Update, Delete. |
| **Data Layer** | The physical storage tier comprising: PostgreSQL (primary relational store), Redis (cache), Elasticsearch (search index + vector store), and MinIO (object storage). |
| **DDoS** | Distributed Denial of Service — a volumetric attack flooding the service with traffic. Blocked at the Edge Layer before reaching internal infrastructure. |
| **Dead-Letter Queue** | Events that have failed all retry attempts are moved to dead-letter status in the `OutboxEvent` table. Administrators can inspect and reprocess them. |
| **Edge Layer** | The outermost defence tier: WAF, DDoS protection, bot filtering, and per-IP rate limiting. All traffic passes through this before reaching the Traffic Layer. |
| **Elasticsearch** | The search engine used for full-text content search and 384-dimensional dense vector similarity search. Index: `comms-content`. |
| **Event Bus** | An internal message bus that routes domain events from the Outbox to notification handlers. Implemented as the `publishEvent` / `fetchUnprocessedEvents` pattern in `integration/eventBus.ts`. |
| **Feature Priority** | Three tiers used in the SRS: **M** Must Have (committed every sprint), **S** Should Have (committed), **N** Nice to Have (stretch goal). |
| **Formatting Rule** | A style constraint defined on a template (`TemplateFormattingRule`). Covers typography, colour palette, heading hierarchy, and media constraints. Authors cannot override locked formatting rules. |
| **Gateway Layer** | The internal security checkpoint that handles TLS termination, payload sanitisation, JWT authentication, per-user rate limiting, and AI quota enforcement. Implemented in `gateway/http/createGatewayRouter.ts`. |
| **Group** | A named collection of users (`UserGroup` model). Groups carry a role; members inherit that role. Used for bulk permission assignment and content visibility targeting. |
| **i18n (Internationalisation)** | Organising UI and template text as key-value pairs per language (`TemplateTranslation` model). Missing translations fall back to the default language. |
| **Intelligence Layer** | A dedicated layer (`intelligence/`) that handles all AI and search work in isolation from the main request path. Contains Sync AI (fast path) and Async AI Worker (background jobs). |
| **Invalidation** | An admin action that immediately hides a published content item from all audience views, removes it from the search index, and retains it in the archive. |
| **Linked Component** | A component embedded in content or a template in live-reference mode. When the component's canonical body is updated, all linked instances are automatically updated via Outbox propagation. |
| **MinIO** | An S3-compatible object storage service used for asset files (images, documents). Accessed via presigned PUT/GET URLs generated by `platform/storage/s3Presign.ts`. |
| **Moodle** | An LMS platform that receives published content via the Channels module. Configured as a `Channel` with type `MOODLE`. |
| **Notify API** | An external HTTP API used to send Email and WhatsApp messages. Integrated in `emailSend.service.ts` and `whatsappSend.service.ts`. |
| **Outbox Pattern** | A reliability pattern that writes a domain event (`OutboxEvent`) to the database in the same transaction as the data change. A separate process then relays the event to the Event Bus. Guarantees no event is silently lost even if the process crashes between the write and the send. |
| **Pipeline** | A configurable sequence of content processing stages set up by an admin (`workflow/workflow.routes.ts`). Each stage has a timeout, escalation rule, and assigned role. |
| **Placeholder** | A variable token in a WhatsApp or template layout (e.g. `{{student_name}}`). Resolved at render time with actual data. Managed via `waPlaceholderManifest.ts`. |
| **Prisma** | The TypeScript ORM used to interact with PostgreSQL. All database access goes through `PrismaUnitOfWork` and typed repository implementations. |
| **Quorum** | A review policy setting that determines how many reviewer approvals are required before content can be published (e.g. "all 3 must approve" or "any 2 of 4"). |
| **RAG (Retrieval-Augmented Generation)** | An AI technique that answers user questions by first retrieving relevant passages from the content library (via Vector Store + Elasticsearch) and then generating a grounded response using those passages as context. Prevents hallucination; every answer includes citations. |
| **RBAC (Role-Based Access Control)** | The permission model used by the platform. Permissions are attached to roles; users acquire permissions through role assignment (directly or via group membership). |
| **Redis** | See Cache (Redis). |
| **Repository Layer** | The only gateway to persistent storage. All reads and writes from the Application and Service layers must go through dedicated repository interfaces (`repository/interfaces/`). Implemented using Prisma (`repository/implementations/prisma/`). |
| **Review Policy** | An admin-defined rule that governs which reviewers are required and what quorum is needed before content of a specific type can be published. |
| **Role** | A named set of permissions (`Role` + `Permission` models). Default roles: Admin, Author, Reviewer, Audience. Custom roles can be created by admins. |
| **Search Index** | The Elasticsearch index (`comms-content`) that powers full-text and vector search. Updated within 5 minutes of content publication. |
| **Service Layer** | The core business logic layer. Validates inputs, checks object-level permissions, enforces business rules, runs domain logic, and commits changes with transactional event records. |
| **Snapshot** | An immutable copy of a content item's body at a specific point in time (`ContentSnapshot` model). Created on every explicit save and on every lifecycle state transition. |
| **SRS** | Software Requirements Specification — the document that defines what the system must do and how well it must do it. |
| **Sync AI (Fast Path)** | The synchronous AI call path (`intelligence/syncAi.ts → runSyncAiTask`). Used for short prompts and quick tasks where the user expects a near-instant response. Wrapped in a circuit breaker. |
| **Tag** | A metadata label applied to content or templates for organisation and discovery (`Tag`, `ContentTag`, `TemplateTag` models). Tags feed Elasticsearch facets. |
| **Template** | A structural scaffold for content that defines sections, required fields, formatting rules, and channel bindings (`Template` model). Content is always created within a template. |
| **TipTap** | The rich-text editor framework used in the frontend and stored as JSON in the database for content bodies and component versions. |
| **Transactional Outbox** | See Outbox Pattern. |
| **Unit of Work** | A pattern (`PrismaUnitOfWork`) that groups multiple repository operations into a single atomic database transaction. Ensures that a data change and its associated `OutboxEvent` are always committed together. |
| **Vector Store** | The Elasticsearch dense vector index (`titleEmbedding` field, 384 dimensions, cosine similarity). Used for semantic similarity search, RAG retrieval, and AI clustering. Updated by `contentEmbedding.ts` and the nightly reindex job. |
| **Visibility Mode** | The audience-facing access control for content, independent of lifecycle state. Modes: `PUBLIC`, `PRIVATE`, `HIDDEN`, `ARCHIVED`, `PRIVATE_TO_GROUP`. |
| **WAF** | Web Application Firewall — blocks malicious requests at the Edge Layer before they reach the API. |
| **WebSocket** | The real-time protocol used for co-authoring (cursor presence, delta broadcasting). WebSocket server attached to the HTTP server in `server.ts` via `realtime/wsServer`. |
| **WhatsApp Business API** | The external API for programmatic WhatsApp messaging. Accessed via the Notify API integration in `whatsappSend.service.ts`. |
