# User Flow — Review Workflow

This document describes the review process from the moment content is submitted through to a final decision (approve or deny), including assignment, commenting, and rollback scenarios.

---

## Overview

```
Content submitted → Reviewers assigned → Review in progress
                                              ↓
                               [Comments ←→ Author replies]
                                              ↓
                            Approve ──────────────── Deny
                               ↓                       ↓
                          [Quorum check]          Back to DRAFT
                               ↓
                     Quorum met → PUBLISHED
                     Quorum not met → Waiting for others
                               ↓
                    [Rollback possible] ← PUBLISHED
```

---

## Step 1 — Reviewer Assignment

### Assignment modes

**Manual (by Author):**
1. Author opens the "Manage Reviewers" dialog before or after submission
2. Searches for reviewers by name or role
3. Selects one or more reviewers; clicks "Assign"
4. `ReviewAssignment` records created; `REVIEW.ASSIGNED` outbox event dispatched
5. Each assigned reviewer receives a notification

**Auto-assignment (by Rules):**
1. Admin has defined rules in Review Policies (e.g. `tag:legal → Legal Group`)
2. When content matches a rule on submission, the matching group/users are auto-assigned
3. Auto-assignment fires before manual notifications, so reviewers always see the full assignment list

**Quorum configuration:**
- Admins set the required approval threshold per policy: e.g. "all reviewers must approve" or "any 2 of 3"
- The `ReviewPolicy` model stores the quorum rule
- Quorum is re-evaluated on every approval decision

---

## Step 2 — Opening the Review

1. Reviewer opens "My Assignments" — items in `IN_REVIEW` state assigned to them
2. Reviewer clicks into an item; the reading view opens with the Approve/Deny toolbar
3. If AI pre-screening is configured: screening warnings are displayed at the top of the review panel:
   - Policy violations
   - Incomplete sections
   - Formatting rule failures
4. Reviewer can navigate the version history to see what changed since the last version

---

## Step 3 — Leaving Comments

### Inline comment

1. Reviewer selects a specific passage
2. Clicks "Comment" — a comment card appears anchored to the selection
3. Reviewer types rich-text comment; can `@mention` other reviewers
4. Comment is persisted as `ReviewComment`; author is notified
5. Status = `OPEN`

### General comment

1. Reviewer types in the General Comments panel (not anchored to a selection)
2. Same persistence and notification flow

### Author response

1. Author receives a notification ("Reviewer left a comment on [Title]")
2. Author opens the item; sees inline margin indicators for each comment
3. Author replies to the comment thread
4. Reviewer is notified of the reply
5. Once the issue is addressed, the reviewer marks the thread `RESOLVED` — it collapses

---

## Step 4 — Version Comparison (Optional)

1. Reviewer opens the History panel
2. Selects two snapshots (e.g. "Original submission" vs "Latest re-submission after comments")
3. Side-by-side diff renders: additions in green, deletions in red, word-level granularity
4. Reviewer can navigate between individual change blocks
5. This step does not change the review state

---

## Step 5 — Making the Decision

### Approve

1. All open comment threads should ideally be resolved before approval (advisory, not mandatory unless policy enforces it)
2. Reviewer clicks "Approve"
3. Mandatory comment field must be filled (approval rationale)
4. System submits `ReviewDecision(APPROVED)` for this assignment
5. **Quorum check:**
   - Not yet met → assignment marked Approved; remaining reviewers still pending; author notified of partial approval
   - Met → content transitions to `PUBLISHED` (see content creation flow Phase 4)
6. Audit log entry created with reviewer identity, decision, and rationale

### Deny

1. Reviewer clicks "Deny"
2. Mandatory denial reason must be provided
3. `ReviewDecision(DENIED)` created
4. Content transitions immediately to `DRAFT` regardless of other reviewers' status
5. All other pending `ReviewAssignment` records are cancelled
6. `REVIEW.DENIED` outbox event → author notified with the denial reason
7. Audit log records decision, reviewer, reason, and timestamp
8. Author can address the feedback and re-submit

---

## Step 6 — Rollback (Post-Approval)

A reviewer who has approved can roll back their approval — including after the content has been published.

1. Reviewer navigates to the published item
2. Clicks "Rollback Approval"
3. System prompts for a mandatory justification
4. `ReviewAssignment` status reverts to `PENDING`
5. If content was `PUBLISHED`: state reverts to `IN_REVIEW`
6. `REVIEW.ROLLED_BACK` outbox event → author notified with justification
7. Audit log records rollback with reviewer identity and justification
8. Content is re-queued for review; the author may need to address the concern

---

## AI-Assisted Review

### Auto-Approval (F-REV-005)

For templates marked as auto-approval eligible by the admin:
1. On submission, Sync AI validates the content against format rules
2. If all checks pass: content is auto-approved and transitions to `PUBLISHED`
3. Audit log entry clearly labelled `AI_AUTO_APPROVED`
4. If any check fails: content is routed to human reviewers with failure report pre-attached

### AI Screening (F-REV-009)

On every submission to review:
1. Async AI Worker pre-screens the content
2. Screening findings (policy violations, incomplete sections) are attached to the review record
3. Human reviewer sees warnings before starting their review
4. Screening results are advisory; they do not block or auto-decide the review

---

## Notification Summary

| Event | Notified Party |
|-------|---------------|
| Content submitted for review | All assigned reviewers |
| Reviewer auto-assigned by rule | Newly assigned reviewer |
| Reviewer leaves a comment | Author |
| Author replies to comment | Comment-thread reviewer |
| Reviewer approves (partial quorum) | Author ("N of M approved") |
| Reviewer approves (quorum met → published) | Author + all reviewers |
| Reviewer denies | Author (with reason) |
| Reviewer rolls back approval | Author (with justification) |
| AI auto-approval | Author + admin |
