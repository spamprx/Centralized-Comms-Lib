#!/usr/bin/env bash
set -euo pipefail

# commit_plan.sh
# Splits current working tree into 4 commits (repo convention: [Scope] Message).
#
# IMPORTANT:
# - This script uses `git add -p` for mixed-concern files (interactive).
# - Read the prompts carefully when staging hunks.
#
# Usage:
#   bash commit_plan.sh
#
# You can re-run safely; it checks git status between steps.

need_clean_index() {
  if ! git diff --cached --quiet; then
    echo "ERROR: You already have staged changes. Please commit/stash/reset the index first."
    git status --porcelain
    exit 1
  fi
}

pause() {
  echo
  read -r -p "Press Enter to continue..."
}

echo "== Commit plan (4 commits) =="
echo
echo "Repo: $(pwd)"
echo

need_clean_index

echo "Step 0: sanity check"
git status --porcelain
pause

###############################################################################
# Commit 1: DB + API foundations (presence/activity + channelId-on-content)
###############################################################################
echo "== Commit 1/4: [Channel] Persist channel + presence foundations (DB+API) =="
need_clean_index

# DB schema + migrations
git add packages/database/transactional/prisma/schema.prisma
git add packages/database/transactional/prisma/migrations/user_last_active_at \
        packages/database/transactional/prisma/migrations/user_presence_ping \
        packages/database/transactional/prisma/migrations/content_channel_id

# API: presence/activity plumbing (if present)
git add apps/api/src/middlewares/recordUserActivity.middleware.ts \
        apps/api/src/realtime/adminActivityHub.ts \
        apps/api/src/realtime/wsServer.ts \
        apps/api/src/middlewares/auth.middleware.ts \
        apps/api/src/repository/types/user.ts || true

# API: channelId-on-content plumbing
git add apps/api/src/repository/types/content.ts \
        apps/api/src/repository/interfaces/contentRepository.ts \
        apps/api/src/repository/implementations/prisma/contentRepository.prisma.ts \
        apps/api/src/modules/content/content.routes.ts \
        apps/api/src/modules/content/content.service.ts

git commit -m "$(cat <<'EOF'
[Channel] Persist channel binding and presence foundations

EOF
)"

git status --porcelain
pause

###############################################################################
# Commit 2: Review correctness + reviewer assignment UX
###############################################################################
echo "== Commit 2/4: [Review] Merge requests, version-specific review body, idempotent assign =="
need_clean_index

# API: merge/upgrade review requests + idempotent assign response
git add apps/api/src/repository/interfaces/reviewRepository.ts \
        apps/api/src/repository/implementations/prisma/reviewRepository.prisma.ts \
        apps/api/src/modules/review/review.service.ts \
        apps/api/src/modules/review/review.routes.ts

# Web: ManageReviewersModal includes both UX + styling tweaks (keep together here)
git add apps/web/src/components/ManageReviewersModal.tsx

# Web: ReviewLayout is mixed (translate + version-specific body). Stage interactively.
echo
echo "Now staging ReviewLayout hunks interactively."
echo "Include hunks that:"
echo "- add/use contentVersionId per review request"
echo "- load matching version body by id"
echo "Avoid hunks that only add Translate UI (those go to commit 3)."
git add -p apps/web/src/layouts/ReviewLayout.tsx

git commit -m "$(cat <<'EOF'
[Review] Merge requests and render version-specific review bodies

EOF
)"

git status --porcelain
pause

###############################################################################
# Commit 3: Frontend translate tools + editor UX/validation fixes
###############################################################################
echo "== Commit 3/4: [Editor] Frontend-only translate tools + editor UX fixes =="
need_clean_index

git add apps/web/src/components/common/TranslatePlainTextModal.tsx
git add apps/web/src/layouts/ReadingLayout.tsx \
        apps/web/src/layouts/PreviewLayout.tsx

# Template editor translate UX improvements
git add apps/web/src/components/templates/TemplateLayoutEditor.tsx

# EditorLayout is mixed (channel hydration + translate + UI tweaks). Stage interactively.
echo
echo "Now staging EditorLayout hunks interactively."
echo "Include hunks that:"
echo "- add translate button/modal"
echo "- remove WhatsApp media-count UI / unused mediaCount"
echo "- move save/validation errors to top banner"
echo "Avoid hunks that are strictly channelId persistence/hydration (those belong to commit 1)."
git add -p apps/web/src/layouts/EditorLayout.tsx

# If any remaining translate-only hunks exist in ReviewLayout, stage them now.
echo
echo "Optional: stage any remaining Translate-only hunks in ReviewLayout."
echo "If you already staged all translate changes elsewhere, just quit the interactive prompt."
git add -p apps/web/src/layouts/ReviewLayout.tsx || true

git commit -m "$(cat <<'EOF'
[Editor] Add frontend-only translate tools and improve editor feedback

EOF
)"

git status --porcelain
pause

###############################################################################
# Commit 4: Admin UI fixes + remaining refactors
###############################################################################
echo "== Commit 4/4: [Admin] Admin UX fixes and remaining refactors =="
need_clean_index

# Admin UI fixes (filters + modals/portals + channel management)
git add apps/web/src/components/admin/SearchAndFilterBar.tsx \
        apps/web/src/components/admin/RoleModal.tsx \
        apps/web/src/components/admin/GroupModal.tsx \
        apps/web/src/components/admin/RolesAndGroupsTab.tsx \
        apps/web/src/components/admin/useTwoStepAdminConfirm.tsx \
        apps/web/src/components/admin/ChannelManagementTab.tsx \
        apps/web/src/hooks/useAdmin.ts \
        apps/web/src/types/admin.ts \
        apps/web/src/services/adminService.ts \
        apps/web/src/lib/adminApi.ts

# Remaining web/app wiring that changed alongside admin work
git add apps/web/src/components/templates/TemplatesPage.tsx \
        apps/web/src/layouts/AuthLayout.tsx \
        apps/web/src/layouts/LandingLayout.tsx \
        apps/web/src/layouts/MyContentLayout.tsx \
        apps/web/src/hooks/useDashboard.ts \
        apps/web/src/hooks/useMyContent.ts \
        apps/web/src/context/AuthContext.tsx \
        apps/web/src/services/authService.ts \
        apps/web/src/services/profileService.ts \
        apps/web/src/services/templateCrudService.ts \
        apps/web/src/lib/analyticsCsv.ts \
        apps/web/src/components/admin/UserManagementTab.tsx \
        apps/web/src/components/admin/UsersTable.tsx \
        apps/web/src/components/admin/UserModal.tsx \
        apps/web/src/components/content/ManageCoAuthorsModal.tsx \
        apps/web/src/components/editor/UseTemplateDialog.tsx || true

# Remaining API changes (if they are not already staged/committed)
git add apps/api/src/gateway/http/createGatewayRouter.ts \
        apps/api/src/modules/admin/admin.routes.ts \
        apps/api/src/modules/admin/admin.service.ts \
        apps/api/src/modules/analytics/analytics.routes.ts \
        apps/api/src/modules/auth/auth.routes.ts \
        apps/api/src/modules/auth/auth.service.ts \
        apps/api/src/modules/profile/profile.routes.ts \
        apps/api/src/modules/profile/profile.service.ts \
        apps/api/src/modules/template/template.routes.ts \
        apps/api/src/modules/template/template.service.ts \
        apps/api/src/repository/implementations/prisma/userRoleRepository.prisma.ts \
        apps/api/src/repository/interfaces/userRoleRepository.ts || true

git add COMMIT_PLAN.md commit_plan.sh

git commit -m "$(cat <<'EOF'
[Admin] Improve admin UX and consolidate related updates

EOF
)"

echo
echo "Done. Final status:"
git status

