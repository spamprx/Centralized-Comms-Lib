# Feature Catalog — Reviewers

All features apply to users with the Reviewer role unless noted.

---

## F-REV-001 — Approve / Deny `[Must Have]`

Reviewers are the final gate before content is published. Each review assignment produces exactly one decision: Approve or Deny.

**Approve flow:**
1. Reviewer opens the item from their assignments list
2. Clicks "Approve" — a mandatory comment field must be filled
3. Business Rule Engine checks whether quorum has been reached (e.g. 2 of 3 reviewers must approve)
4. If quorum is met: content transitions to `PUBLISHED`; author is notified; audit log entry created
5. If quorum is not yet met: assignment marked Approved; other reviewers still pending

**Deny flow:**
1. Reviewer clicks "Deny" with a mandatory reason
2. Content transitions back to `DRAFT`; all pending assignments are cancelled
3. Author is notified with the denial reason via the Notification & Channel service
4. Audit log records the decision, reviewer identity, and timestamp

Every decision (approve or deny) is immutable once submitted. Reviewers can roll back their own approvals via F-REV-004.

**Implementation status:** Fully implemented. `review.service.ts → decide`. `ReviewDecision` model persists outcomes. Outbox events drive notifications.

---

## F-REV-002 — Add Reviewers `[Must Have]`

Authors and Admins can assign one or more reviewers to a content item before or after submission.

- Search reviewers by name or role
- Multiple reviewers can be assigned with independent approval tracks
- Quorum rules are configurable per review policy (all reviewers must approve, or a subset)
- Assigned reviewers receive a review-request notification

**Implementation status:** Fully implemented. `review.service.ts → assignReviewer`. `ReviewAssignment` model. Notification dispatched via outbox. `GET /reviews/content/:contentId/assignable-reviewers` lists eligible reviewers.

---

## F-REV-003 — Comment `[Must Have]`

Reviewers (and authors replying) can leave comments on content items.

- **Inline comments:** Anchored to a specific text selection; rendered as side-margin threads
- **General comments:** Not anchored; appear in a general comments panel
- Comments support rich text and `@`-mentions
- Thread status: **Open** or **Resolved**. Resolving collapses the thread.
- Author can reply to any comment thread; the reviewer is notified

**Implementation status:** Fully implemented. `review.service.ts → addComment`. `ReviewComment` model with thread linking. Outbox events drive reply notifications to the reviewer.

---

## F-REV-004 — Rollback Approvals `[Must Have]`

A reviewer who has previously approved an item can roll that approval back, returning the content to `IN_REVIEW`.

- Requires a mandatory justification text
- After rollback the content is no longer published (if the approval had triggered publication)
- The rolled-back version is retained in the version history
- Author is notified of the rollback and reason

**Implementation status:** Fully implemented. `review.service.ts → rollbackToPending`. `ReviewAssignment` status reverted. Outbox notification dispatched.

---

## F-REV-005 — AI — Automate Approval of Specific Format `[Must Have]`

Admins configure which templates or content types are eligible for automatic AI-based approval. When eligible content is submitted:

1. AI (Sync AI fast path) validates the content against the format rules
2. If all checks pass → content is auto-approved; labelled as AI-approved in the audit log; stakeholders notified
3. If any check fails → content is routed to human reviewers with the failure report pre-attached

Auto-approval is clearly distinguished from human approval in the audit log. The process is fully traceable.

**Implementation status:** Implemented. Wired in `review.service.ts` with format template eligibility check and `enqueueAsyncAiJob` / `runSyncAiTask` call. `ReviewPolicy` model in Prisma stores eligible template rules.

---

## F-REV-006 — Assignment of Rules `[Should Have]`

Admins define routing rules that automatically assign reviewers when content is submitted, based on content attributes.

**Rule conditions:**
- Content type
- Tags (e.g. `tag:legal` → Legal Team group)
- Target channel
- Author's group membership

Multiple rules can match a single content item. Reviewer lists are merged without duplication. Authors can still manually add reviewers on top of the auto-assigned ones.

**Implementation status:** Implemented. `ReviewPolicy` CRUD in `admin.routes.ts`. `businessRules/index.ts` evaluates active policies on submission. Outbox notification sent to auto-assigned reviewers.

---

## F-REV-007 — Comparison Between Versions `[Should Have]`

Reviewers can select any two historical snapshots and view a side-by-side or unified diff.

- Diff is computed at paragraph and word level
- Additions highlighted in green, deletions in red, moves indicated
- Navigable: reviewers can jump between individual change blocks
- Available in both unified (single column, inline) and side-by-side layouts

**Implementation status:** Fully implemented. `content.service.ts → compareSnapshotsWordDiff` uses the `diff` npm package. Version list and snapshot fetch endpoints in `content.routes.ts`. Frontend `VersionHistoryLayout` renders the comparison view.

---

## F-REV-008 — Plagiarism `[Should Have]`

Reviewers can trigger a plagiarism check during review. The system compares the content against the Vector Store (internal library embeddings) and, if configured, external sources.

- Similarity report is embedded in the review panel
- Items exceeding the configurable threshold are flagged; the threshold is admin-configurable
- Report is attached to the review record for audit purposes

**Implementation status:** Wired. `review.routes.ts` has the endpoint. `enqueueAsyncAiJob` dispatches a `PLAGIARISM_CHECK` job to the Async AI Worker. Full similarity report UI is a Sprint 5 deliverable.

---

## F-REV-009 — AI — Screening `[Should Have]`

When content enters the review queue, AI automatically pre-screens it before human reviewers start.

**Screening checks:**
- Policy compliance (language, formatting constraints)
- Content completeness (required sections present)
- Formatting rule adherence

Screening results are advisory — they appear as warnings attached to the review view with affected passages highlighted. The final decision always belongs to the human reviewer.

**Implementation status:** Wired. Pre-screening job dispatched via `enqueueAsyncAiJob` on submission. Screening findings attached to `ReviewRequest` before assignment notifications are sent. Full UI highlighting is a Sprint 5 deliverable.

---

## F-REV-010 — AI — Content Contradiction `[Nice to Have]`

AI detects factual contradictions within a document or across related documents in the library. Conflicting statement pairs are presented with confidence scores and source references.

**Implementation status:** Stretch goal (Sprint 2). Not yet implemented.

---

## F-REV-011 — AI — Comment to Action List `[Nice to Have]`

AI converts reviewer comment threads into a structured, prioritised action list for the author. Each action item links back to its originating comment and can be resolved by the author, which also resolves the source comment thread.

**Implementation status:** Stretch goal (Sprint 3). Not yet implemented.
