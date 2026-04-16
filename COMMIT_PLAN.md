# Commit plan (split into reasonable chunks)

This repo’s recent style uses bracketed scopes like `[Admin] ...`, `[Editor] ...`, `[Channel] ...`, `[Chore] ...`.

Notes:
- A few files contain **mixed concerns** (notably `apps/web/src/layouts/EditorLayout.tsx` and `apps/web/src/layouts/ReviewLayout.tsx`). For those, this plan uses **`git add -p`** so you can stage only the relevant hunks per commit.
- Run `git status` between commits to confirm staging looks right.

---

## 1) `[DB] Add user activity + presence timestamps`

**Goal**: persist `lastActiveAt` + `presencePingAt` and related plumbing.

```bash
git add packages/database/transactional/prisma/schema.prisma
git add packages/database/transactional/prisma/migrations/user_last_active_at
git add packages/database/transactional/prisma/migrations/user_presence_ping
git add apps/api/src/middlewares/recordUserActivity.middleware.ts
git add apps/api/src/realtime/adminActivityHub.ts
git add apps/api/src/realtime/wsServer.ts
git add apps/api/src/middlewares/auth.middleware.ts
git add apps/api/src/repository/types/user.ts
git add apps/web/src/hooks/usePresenceHeartbeat.ts
git commit -m \"[Chore] Track user activity and presence\"
```

---

## 2) `[Channel] Persist channel binding on content (DB + API)`

**Goal**: store `Content.channelId` (FK) so channel validation never “vanishes” on refresh; include it in create/save/get.

```bash
git add packages/database/transactional/prisma/schema.prisma
git add packages/database/transactional/prisma/migrations/content_channel_id

git add apps/api/src/repository/types/content.ts
git add apps/api/src/repository/interfaces/contentRepository.ts
git add apps/api/src/repository/implementations/prisma/contentRepository.prisma.ts
git add apps/api/src/modules/content/content.routes.ts
git add apps/api/src/modules/content/content.service.ts

git add apps/web/src/services/contentService.ts
git commit -m \"[Channel] Store channelId on content and expose via API\"
```

---

## 3) `[Editor] Fix editor channel hydration + validation persistence`

**Goal**: ensure editor rehydrates channel/template binding reliably across refresh and convert-to-draft, and clears state on `/editor/new`.

This work lives inside `apps/web/src/layouts/EditorLayout.tsx` alongside other UI changes; stage only the hunks related to channel/template hydration + persistence.

```bash
git add -p apps/web/src/layouts/EditorLayout.tsx
git commit -m \"[Editor] Rehydrate channel validation state across reloads\"
```

Tip: when prompted, include hunks mentioning `templateId`, `channelId`, `pendingTemplateId`, `pendingChannelId`, and hydration from `details.channel`.

---

## 4) `[Review] Merge review requests per content + show correct reviewed version`

**Goal**:
- Only one OPEN review request per content (upgrade to latest version instead of creating duplicates).
- Show the exact version under review (don’t always display latest).
- Make assign-reviewer idempotent and UX-friendly.

```bash
git add apps/api/src/repository/interfaces/reviewRepository.ts
git add apps/api/src/repository/implementations/prisma/reviewRepository.prisma.ts
git add apps/api/src/modules/review/review.service.ts
git add apps/api/src/modules/review/review.routes.ts

# Review UI: stage the hunks that use contentVersionId to load the matching body.
git add -p apps/web/src/layouts/ReviewLayout.tsx

git add apps/web/src/components/ManageReviewersModal.tsx
git add apps/web/src/services/reviewService.ts

git commit -m \"[Review] Merge duplicate requests and render version-specific bodies\"
```

Tip: for `ReviewLayout.tsx` include hunks that add `contentVersionId` and select the matching version body by id.

---

## 5) `[Editor] Add frontend-only translate modal across reading/editor/preview/review`

**Goal**: add translate buttons that translate plain text in the frontend, with a clear “not saved” caution.

```bash
git add apps/web/src/components/common/TranslatePlainTextModal.tsx

# EditorLayout contains other changes; stage only translation-related hunks.
git add -p apps/web/src/layouts/EditorLayout.tsx

git add apps/web/src/layouts/ReadingLayout.tsx
git add apps/web/src/layouts/PreviewLayout.tsx

# ReviewLayout contains both review-version + translate; stage translate hunks only if you split commit 4/5.
git add -p apps/web/src/layouts/ReviewLayout.tsx

git add apps/web/src/components/templates/TemplateLayoutEditor.tsx
git commit -m \"[Editor] Add frontend-only translate tools with unsaved warning\"
```

---

## 6) `[Admin] Fix user status filter + prevent clipped modals`

**Goal**:
- Fix Active/Inactive filter wiring.
- Portal admin modals to avoid being cut off; improve modal scrolling.

```bash
git add apps/web/src/components/admin/SearchAndFilterBar.tsx
git add apps/web/src/components/admin/RoleModal.tsx
git add apps/web/src/components/admin/GroupModal.tsx
git add apps/web/src/components/admin/RolesAndGroupsTab.tsx
git add apps/web/src/components/admin/useTwoStepAdminConfirm.tsx
git commit -m \"[Admin] Fix user status filter and modal rendering\"
```

---

## 7) `[Admin] Channel management updates`

This is the large admin tab refactor/update.

```bash
git add apps/web/src/components/admin/ChannelManagementTab.tsx
git add apps/web/src/services/adminService.ts
git add apps/web/src/lib/adminApi.ts
git add apps/web/src/types/admin.ts
git commit -m \"[Admin] Improve channel management UI and rules\"
```

---

## 8) `[Chore] Remaining web/app wiring & cleanup`

Anything left that is not covered above (navigation/layout tweaks, templates page refactors, minor service edits, etc.).

```bash
git add apps/web/src/components/templates/TemplatesPage.tsx
git add apps/web/src/components/templates/TemplatesPage.tsx
git add apps/web/src/layouts/AuthLayout.tsx
git add apps/web/src/layouts/LandingLayout.tsx
git add apps/web/src/layouts/MyContentLayout.tsx
git add apps/web/src/hooks/useDashboard.ts
git add apps/web/src/hooks/useMyContent.ts
git add apps/web/src/context/AuthContext.tsx
git add apps/web/src/services/authService.ts
git add apps/web/src/services/profileService.ts
git add apps/web/src/services/templateCrudService.ts
git add apps/web/src/lib/analyticsCsv.ts
git add apps/api/src/gateway/http/createGatewayRouter.ts
git add apps/api/src/modules/admin/admin.routes.ts
git add apps/api/src/modules/admin/admin.service.ts
git add apps/api/src/modules/analytics/analytics.routes.ts
git add apps/api/src/modules/auth/auth.routes.ts
git add apps/api/src/modules/auth/auth.service.ts
git add apps/api/src/modules/profile/profile.routes.ts
git add apps/api/src/modules/profile/profile.service.ts
git add apps/api/src/modules/template/template.routes.ts
git add apps/api/src/modules/template/template.service.ts
git add apps/api/src/repository/implementations/prisma/userRoleRepository.prisma.ts
git add apps/api/src/repository/interfaces/userRoleRepository.ts
git add apps/web/src/components/admin/UserManagementTab.tsx
git add apps/web/src/components/admin/UsersTable.tsx
git add apps/web/src/components/admin/UserModal.tsx
git add apps/web/src/components/content/ManageCoAuthorsModal.tsx
git add apps/web/src/components/editor/UseTemplateDialog.tsx
git commit -m \"[Chore] Misc UI refinements and service updates\"
```

After commit 8, run:

```bash
git status
```

and ensure it’s clean.

