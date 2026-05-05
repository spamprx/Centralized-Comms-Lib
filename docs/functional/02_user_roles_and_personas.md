# User Roles and Personas

## Role Model

Comms-Library uses Role-Based Access Control (RBAC). Every user is assigned one or more roles. Roles carry a set of permissions expressed as `(module, action)` pairs — for example `(content, create)` or `(admin, read)`. Users inherit permissions from all their assigned roles. Group membership can bundle a role onto many users at once.

The four default roles shipped with the system are: **Admin**, **Author**, **Reviewer**, and **Audience**. Administrators can create custom roles with any combination of permissions.

---

## Authors

### Description

Authors are the primary content producers. They create drafts, build and maintain templates, manage reusable components, and drive content through the review pipeline to publication.

### Permissions (default)

- Create, read, update, and delete their own content and drafts
- Submit content for review; assign reviewers
- Create and manage templates, template channel bindings, and formatting rules
- Create and version reusable components
- View analytics for their own content
- Invite co-authors to collaborative editing sessions
- Manage assets (upload, finalize, delete) they own

### Persona — Priya, Communications Officer

**Background:** Priya manages institutional announcements at a mid-size university. She publishes notices that go out via Email, WhatsApp, and the Moodle LMS simultaneously. Before Comms-Library she maintained three separate drafts in separate tools and copy-pasted between them.

**Goals:**
- Draft once, publish everywhere
- Ensure legal and compliance sign-off before release
- Track which students actually read the announcement

**Frustrations (before):**
- Version drift between Email and LMS copies
- No visibility into whether reviewers had actually looked at the content
- Formatting breaking when pasting into Moodle's editor

**How Comms-Library helps:**
- One TipTap editor; channel-specific rendering handled by the template engine
- Structured review pipeline with reviewer notifications and status tracking
- Built-in analytics: views, reading time, engagement

---

## Reviewers

### Description

Reviewers are quality gatekeepers. They assess content submitted by authors, leave inline or general comments, and either approve (moving the content to Published) or deny (returning it to Draft). Reviewers cannot create content themselves but can read any content assigned to them.

### Permissions (default)

- Read content assigned to them for review
- Approve or deny a review assignment (with mandatory comment)
- Leave inline and general comments on content
- Rollback their own previous approval decisions
- Compare content versions side-by-side
- Run plagiarism checks (when the AI quota allows)

### Persona — Dr. Rajan, Faculty Reviewer

**Background:** Dr. Rajan is assigned to review academic communications before they go to students. He receives several items per week across different courses and departments.

**Goals:**
- Quickly understand what changed since the last version
- Leave structured, actionable feedback rather than lengthy emails
- Maintain a record of his review decisions for compliance

**Frustrations (before):**
- Receiving content via email with no versioning
- No way to see whether his previous comments had been addressed
- Approval communicated via informal chat with no audit trail

**How Comms-Library helps:**
- Version comparison view with word-level diffs
- Threaded inline comment threads with Resolved/Open status
- Every decision (approve/deny) stored in the immutable audit log

---

## Audience (End Users)

### Description

The Audience is the consuming tier — students, staff, or other stakeholders who read published content. They do not create or review content. They can interact (reactions, comments, bookmarks) and use AI-powered features like summarisation and the RAG Q&A assistant.

### Permissions (default)

- Read published content they have visibility access to
- React, like, comment, and share content
- Bookmark content and organise bookmarks into folders
- Track their own reading progress
- Take private notes anchored to content passages
- Use AI features: summarise, AI tutor, clustered exploration

### Persona — Aisha, Undergraduate Student

**Background:** Aisha receives course updates, policy notices, and assignment briefs through the institution's Comms-Library deployment.

**Goals:**
- Find relevant content quickly without wading through irrelevant material
- Never miss an updated notice she already bookmarked
- Ask the AI tutor to explain complex policy language in plain terms

**Frustrations (before):**
- Searching through email archives and LMS announcements separately
- No notification when previously-read content was updated
- No way to highlight or annotate content for her own revision

**How Comms-Library helps:**
- Unified full-text search with semantic ranking
- Bookmark notifications when content is updated
- Private notes anchored to passages; AI tutor grounded in library content

---

## Administrators

### Description

Administrators have full system access. They configure the governance model (roles, policies, pipelines), manage users and groups, monitor system health and content volume, and maintain the audit log. They can also invalidate published content when required.

### Permissions (default)

- Create, update, and delete roles and their permission sets
- Create and manage user groups; bulk import via CSV
- Define and enforce review policies (e.g. "all Policy-tagged content requires Legal review")
- Set up multi-stage publication pipelines
- View and export the full audit log
- Monitor real-time KPIs and receive AI anomaly alerts
- Invalidate (unpublish) content; configure system-wide settings

### Persona — Kavitha, IT & Comms Administrator

**Background:** Kavitha is responsible for the institutional deployment of Comms-Library. She sets up which staff can author which categories of content, ensures compliance with the institution's communications policy, and troubleshoots issues.

**Goals:**
- Ensure only approved, compliant content reaches students
- Keep the role/group model in sync with HR system changes
- Get alerted quickly if something unusual happens (content spike, repeated denials)

**Frustrations (before):**
- No central place to see what content was in flight, approved, or rejected
- Role changes required IT tickets to individual systems
- No automated alerting for policy violations

**How Comms-Library helps:**
- Real-time monitoring dashboard with content-state counts and pipeline throughput
- RBAC with group-level role assignment; bulk CSV import for new cohorts
- AI-powered anomaly detection with configurable alerting thresholds

---

## Role Assignment and Groups

Users may hold multiple roles simultaneously. A user can be both an Author and a Reviewer on different content items. The Admin assigns roles directly or via groups. When a user is added to a group, they inherit the group's role; removing them revokes that role and immediately invalidates their cached session token.

Group-level visibility targeting (`Private to Group`) allows content to be published and visible only to a specific group (e.g. "Year 2 Students" or "Legal Team"), independently of the publication state.
