# Use Cases

Scenario-based descriptions illustrating how different actor types use the system to accomplish real goals.

---

## UC-01 — Author Creates and Publishes a Policy Notice

**Actor:** Priya (Communications Officer, Author role)

**Context:** The university has updated its examination policy. Priya needs to send the notice to all registered students via Email and Moodle, with approval from the Legal team first.

**Steps:**
1. Priya opens Comms-Library and clicks "New Content"
2. She selects the "Announcement" template (which has Email and Moodle channel bindings pre-configured)
3. She types a short AI prompt: "Draft an examination policy update notice emphasising academic integrity requirements"
4. The AI (Sync AI fast path) returns a structured draft in seconds
5. Priya edits the draft; adds the policy tag to the content
6. She sets visibility to `PUBLIC`
7. The review policy rule `tag:policy → Legal group` automatically assigns the Legal team reviewers
8. Priya clicks "Submit for Review"
9. Dr. Rajan (Legal) receives a notification; opens the item; leaves two inline comments about specific clauses
10. Priya is notified; addresses both comments in the editor; replies to the threads
11. Dr. Rajan marks threads as resolved; approves the item (quorum of 1 met)
12. Content transitions to `PUBLISHED`; Elasticsearch indexes it
13. The Email and Moodle channel bindings render the content appropriately; Priya clicks "Send via Email" and "Publish to Moodle"
14. All students receive the Email; the announcement appears on Moodle

**Outcome:** Single source document; one structured review; multi-channel distribution; full audit trail.

---

## UC-02 — Reviewer Handles a Complex Multi-Reviewer Decision

**Actor:** Dr. Rajan (Reviewer), Prof. Sharma (second Reviewer)

**Context:** A research summary requires approval from both the Academic Affairs and Ethics committees (quorum: all 2 must approve).

**Steps:**
1. Author submits the research summary; both Dr. Rajan and Prof. Sharma are auto-assigned (rules match `content_type:research`)
2. Dr. Rajan opens the item; notices it is similar to a previously published piece; clicks "Run Plagiarism Check"
3. Async AI Worker returns a similarity report — 12% match (below the 30% threshold); attached to the review panel
4. Dr. Rajan approves; author is notified "1 of 2 reviewers approved"
5. Prof. Sharma opens the item; disagrees with a factual claim; clicks "Deny" with a detailed reason
6. Content returns to `DRAFT`; Dr. Rajan's approval is cancelled
7. Author revises the factual claim; re-submits
8. Both reviewers see the diff view: exactly which sentences changed
9. Both approve; content publishes

**Outcome:** Multi-reviewer quorum enforced; plagiarism check used; version diff available; full trace.

---

## UC-03 — Audience Member Uses AI Tutor for Policy Understanding

**Actor:** Aisha (Undergraduate Student, Audience role)

**Context:** Aisha reads the new examination policy notice but does not understand the "academic integrity assessment" clause.

**Steps:**
1. Aisha opens the published notice via the Moodle integration (or direct URL)
2. She bookmarks it immediately (folder: "Exam Prep")
3. She opens the AI Tutor panel; types: "What does the academic integrity assessment requirement mean in practice?"
4. The system retrieves relevant passages from the notice and related published library content (Vector Store lookup)
5. Sync AI generates a plain-language explanation with citations to the specific sections
6. Aisha asks a follow-up: "What happens if I submit late?" — conversation context is preserved in Redis
7. AI Tutor answers with a citation to section 4.2
8. Aisha highlights a passage and adds a private note: "Check this with my advisor"
9. She marks the notice as "Done" in her reading progress
10. Two weeks later she receives a notification: "An item you bookmarked has been updated" — the policy was amended

**Outcome:** AI grounded in library content; private notes; bookmark notifications; progress tracked.

---

## UC-04 — Admin Responds to a Content Spike Alert

**Actor:** Kavitha (Administrator)

**Context:** The AI monitoring system detects an unusual spike in content creation at 2 AM — 40 new drafts in one hour (normal rate: 2/hour).

**Steps:**
1. Kavitha receives an email alert (Notify API): "Anomaly detected: content creation rate 20× normal"
2. She opens the Admin Monitor dashboard — the alert banner is visible with suggested investigation steps
3. She navigates to Admin → Logs; filters by action `CONTENT_CREATED` and date range (last 2 hours)
4. All 40 drafts were created by a single service account; she exports the log as CSV
5. Kavitha determines the service account credentials were compromised
6. She navigates to Admin → Users; selects the service account; clicks "Bulk Delete Drafts" (multi-select all 40 drafts)
7. She revokes the service account's Author role → session token invalidated in Redis
8. She resets the account's password and notifies the security team
9. The anomaly alert is resolved; the audit log shows Kavitha's actions with timestamps

**Outcome:** Rapid anomaly detection; full audit trail; bulk management capabilities.

---

## UC-05 — Author Builds a Reusable Component Library

**Actor:** Sanjay (Senior Communications Author)

**Context:** The university brand requires a consistent legal disclaimer at the bottom of all student-facing communications. Sanjay creates a reusable component so that all authors get the up-to-date disclaimer automatically.

**Steps:**
1. Sanjay creates a new Component named "Legal Disclaimer 2026"
2. He writes the disclaimer text in the TipTap component editor
3. Publishes the component version (`ComponentVersion` record created)
4. Other authors drag the component into their content items in Linked mode
5. The Legal team updates the disclaimer wording; Sanjay updates the component body (new `ComponentVersion`)
6. The `COMPONENT.VERSION_UPDATED` outbox event fires
7. `componentEvents.consumer` picks up the event; `propagateLinkedComponentToContent` updates every content item that has a linked instance
8. All affected content items are updated atomically; no author action required
9. Affected authors receive a notification: "A linked component in your content was updated"

**Outcome:** Write-once, propagate everywhere; consistent branding; no manual synchronisation.

---

## UC-06 — WhatsApp Batch Send for Event Registration

**Actor:** Priya (Author / Communications Officer)

**Context:** A student orientation event needs a WhatsApp message sent to all 800 registered students.

**Steps:**
1. Priya creates a WhatsApp-bound content item using the "Event Notification" template
2. She fills in the event details (date, venue, link)
3. Navigates to "Publish → WhatsApp"
4. Clicks `POST /whatsapp-send/convert` — the system converts TipTap JSON to WhatsApp block format, filling in placeholder values
5. She uploads a CSV of recipient phone numbers via the UI
6. Clicks "Preview" — sees exactly what each recipient will receive
7. Clicks "Send Batch" → `POST /whatsapp-send/send-batch`
8. `WhatsAppSendRequest` record created with `PENDING` status; each recipient tracked in `WhatsAppMessageLog`
9. Notify API dispatches messages to WhatsApp Business API
10. Status is polled; Priya can see delivery progress (delivered / failed counts) in real time
11. For failed numbers, Priya can retry or export a failed-list CSV

**Outcome:** Template-driven WhatsApp sends; per-recipient tracking; retry capability.

---

## UC-07 — Template Cloning for a New Academic Year

**Actor:** Template Administrator / Author

**Context:** Last year's course guide templates need to be updated for the new academic year without affecting last year's published archive.

**Steps:**
1. Admin opens the "Course Guide 2025" template
2. Clicks "Clone" — `POST /templates/:id/clone`
3. A new "Course Guide 2026" template is created (independent deep copy, new ID, `DRAFT` state)
4. Author updates the new template: new dates, formatting tweaks, adds a new section
5. AI-generated translation keys are updated for each supported language
6. Template is activated: `POST /templates/:id/activate`
7. 2025 template and all content using it are untouched; they remain in their published state
8. New content for 2026 is created using the "Course Guide 2026" template

**Outcome:** Year-over-year template management; no risk of affecting historical content.
