# Feature Catalog — Collaboration

The Collaboration module ("Troops") provides workgroup-level features for peer review, shared drafting spaces, and community Q&A. All three features are classified as **Nice to Have** stretch goals and are not included in committed sprint deliverables.

---

## F-COL-001 — Peer Review `[Nice to Have]`

Users within a workgroup can request and conduct informal peer reviews on draft content, separate from the formal review workflow.

**Capabilities:**
- Request a peer review from one or more group members
- Inline annotations visible to all group reviewers (distinct from the formal reviewer comment threads)
- Overall feedback summary per reviewer
- Review status visible to all group members (Pending / In Progress / Completed)

**Relationship to the formal review workflow:** Peer review is informal and does not affect the content's lifecycle state. It is a collaboration tool, not a publication gate. Peer review outcomes can inform whether an author is confident enough to submit for formal review.

**Implementation status:** Stretch goal (Sprint 3). Not yet implemented. The `workspace` concept and `Workspace` model in Prisma provide the foundation.

---

## F-COL-002 — Shared Space `[Nice to Have]`

Workgroups have a shared content space for collaborative drafting and resource pooling.

**Capabilities:**
- Group members can co-draft documents in the shared space
- Configurable access levels: Read Only, Comment, Edit
- Unified activity feed showing recent actions by all members
- Content in the shared space can be promoted to the main authoring workflow once ready

**Implementation status:** Stretch goal (Sprint 4). Not yet implemented. `Workspace` model and `group.routes.ts` provide structural groundwork.

---

## F-COL-003 — Q&A `[Nice to Have]`

A question-and-answer forum within workgroups for discussing content and resolving queries.

**Capabilities:**
- Post questions anchored to a specific content item or freestanding within the group
- Threaded answers
- Accepted answer marking by the question poser
- Upvote/downvote on questions and answers
- Notifications when a question you follow receives a new answer

**Implementation status:** Stretch goal (Sprint 5). Not yet implemented. The `ContentComment` model with threading covers a subset of this; a dedicated Q&A entity is needed.

---

## Notes on Priority

All three collaboration features are in the "Nice to Have" tier. They are designed to enhance engagement and knowledge sharing among working groups but are not prerequisites for the core authoring → review → publish flow. They will be implemented based on team capacity after all Must Have and Should Have features are delivered.
