# User Flow — Content Creation (Draft → Review → Publish)

This document describes the complete lifecycle of a piece of content from initial creation through to publication, including the system's automated steps at each transition.

---

## Overview

```
[New Content] → DRAFT → [Submit] → IN_REVIEW → [Approved] → PUBLISHED
                                              ↓
                                          [Denied] → DRAFT
                                              ↓
                              [Rollback] ← PUBLISHED
                                              ↓
                                          ARCHIVED
```

---

## Phase 1: Create a Draft

### Actor: Author

1. Author navigates to "New Content" in the editor
2. Optionally selects a **template** to use as structural scaffolding
3. System assigns a unique content ID; a blank `DRAFT` record is persisted in PostgreSQL
4. TipTap editor opens; author writes or uses AI-assisted drafting:
   - **AI short prompt** → `runSyncAiTask` returns generated text inline (< 2 s)
   - **AI long-form outline** → `enqueueAsyncAiJob` queues generation; author continues other work; result appears when ready
5. Author adds **tags** from the taxonomy (auto-suggest active)
6. Author sets **visibility**: Private (default for drafts) or Private to Group
7. Author **saves** — a `ContentSnapshot` is appended to the version history
8. Author can invite **co-authors**: sends an invitation via `requestCoAuthor`; invitee accepts; both are now in a live collaborative session

**System behaviours:**
- Every explicit save creates an immutable snapshot
- Co-author presence is broadcast over WebSocket to all participants
- Draft is invisible to Audience regardless of visibility setting

---

## Phase 2: Submit for Review

### Actor: Author

1. Author clicks "Submit for Review"
2. System validates:
   - At least one reviewer must be assigned (or auto-assignment rules must match)
   - Active co-author sessions must be closed or paused
   - Business rules (e.g. policy: AI-generated content needs at least one human reviewer) must pass
3. Content state transitions: `DRAFT` → `IN_REVIEW`
4. A `ContentSnapshot` is created for this transition
5. Outbox event `REVIEW.SUBMITTED` is published
6. Notification dispatcher notifies all assigned reviewers (email or in-app)
7. If auto-assignment rules match, additional reviewers are assigned before notification

**If validation fails:**
- System returns a specific, actionable error (e.g. "Review policy 'Legal' requires Legal group assignment")
- State does not change; author is directed to fix the issue

---

## Phase 3: Review

### Actor: Reviewer(s)

1. Reviewer sees item in their "My Assignments" queue
2. Reviewer reads the content; can compare with any previous version (side-by-side diff)
3. Reviewer leaves **inline comments** (threaded, anchored to text selections) or general comments
4. Author receives comment notifications; replies inline; marks threads as resolved when addressed
5. If AI pre-screening was configured: screening warnings are pre-attached when reviewer opens the item
6. Reviewer makes their decision:

**Approve:**
1. Reviewer submits an approval with a mandatory comment
2. `ReviewDecision` record created; `ReviewAssignment` status = `APPROVED`
3. Business rule checks quorum (e.g. 2 of 3 reviewers must approve)
4. If quorum met → content transitions to `PUBLISHED` (see Phase 4)
5. If quorum not yet met → other reviewers remain pending; author informed of partial approval

**Deny:**
1. Reviewer submits a denial with a mandatory reason
2. Content transitions back to `DRAFT`; all pending assignments cancelled
3. `REVIEW.DENIED` outbox event → author notified with the denial reason
4. Author revises the content and can re-submit

---

## Phase 4: Publication

### Trigger: Review quorum met or AI auto-approval

1. Content state transitions: `IN_REVIEW` → `PUBLISHED`
2. `ContentSnapshot` created for the transition
3. Elasticsearch search index updated (content becomes discoverable)
4. Redis cache cleared for relevant audience views
5. `CONTENT.PUBLISHED` outbox event published
6. Users who bookmarked the item receive a `ContentBookmarkNotification` if it was previously published and this is a re-publication

**Visibility enforcement at publication:**
- `PUBLIC` → available to all authenticated audience members
- `PRIVATE_TO_GROUP` → only group members can access
- `HIDDEN` → excluded from all search results; direct URL only

---

## Phase 5: Post-Publication

### Available actions after publication

| Action | Actor | Effect |
|--------|-------|--------|
| **Archive** | Author or Admin | State → `ARCHIVED`; removed from search index; read-only |
| **Rollback** | Reviewer or Admin | State → `IN_REVIEW`; must provide justification |
| **Invalidate** | Admin only | Immediately hidden from audience; retained in archive |
| **Update** | Author | State → `DRAFT` for editing; must go through review again |

---

## Visibility vs. State Matrix

| | DRAFT | IN_REVIEW | PUBLISHED | ARCHIVED |
|-|-------|-----------|-----------|----------|
| Author + co-authors | ✓ | ✓ | ✓ | ✓ read-only |
| Assigned reviewers | read-only | ✓ | ✓ | ✓ read-only |
| Audience (public) | ✗ | ✗ | ✓ (if PUBLIC) | ✗ |
| Audience (group) | ✗ | ✗ | ✓ (if in group) | ✗ |
| Admin | ✓ | ✓ | ✓ | ✓ |

---

## Audit Trail

Every state transition, visibility change, reviewer assignment, and decision is written to the `AuditLog` table. The log is immutable and filterable. Each entry includes: actor user ID, action type, content ID, timestamp, and previous/new values where applicable.
