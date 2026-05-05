#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   bash split_commits_by_owner.sh
#
# Notes:
# - Run from repo root.
# - This script creates multiple commits with different authors and dates.
# - Only paths listed in commit_group() are staged; anything else stays uncommitted
#   until you add it to a group below (or run git add yourself).
# - Intentionally omitted: Firebase service account JSON (*.json under repo root
#   matching *firebase*adminsdk*). Add to .gitignore instead of committing.
# - If a commit has no staged changes, it is skipped.

BASE_DATE="2026-05-05T14:20:00+05:30"
MINUTES_STEP=8
COMMIT_INDEX=0

next_date() {
  date -d "${BASE_DATE} + $((COMMIT_INDEX * MINUTES_STEP)) minutes" +"%Y-%m-%dT%H:%M:%S%:z"
}

author_name() {
  sed -E 's/^(.*) <.*>$/\1/' <<<"$1"
}

author_email() {
  sed -E 's/^.*<(.*)>$/\1/' <<<"$1"
}

commit_group() {
  local author="$1"
  local message="$2"
  shift 2
  local files=("$@")

  git restore --staged :/
  git add -A "${files[@]}"

  if git diff --staged --quiet; then
    echo "SKIP: ${message} (no changes in selected files)"
    return 0
  fi

  local dt
  dt="$(next_date)"
  local name
  local email
  name="$(author_name "${author}")"
  email="$(author_email "${author}")"

  echo
  echo "----------------------------------------"
  echo "Author : ${author}"
  echo "Committer: ${name} <${email}>"
  echo "Date   : ${dt}"
  echo "Message: ${message}"
  echo "Files  :"
  git diff --staged --name-only
  echo "----------------------------------------"

  GIT_COMMITTER_NAME="${name}" \
  GIT_COMMITTER_EMAIL="${email}" \
  GIT_AUTHOR_DATE="${dt}" \
  GIT_COMMITTER_DATE="${dt}" \
  git commit --author="${author}" -m "${message}"

  COMMIT_INDEX=$((COMMIT_INDEX + 1))
}

# 1) Sathwik Reddy - Frontend
commit_group \
  "Sai Sathwik <sathwik1977@gmail.com>" \
  "[Frontend] Improve reviewer workflow and sidebar UX" \
  apps/web/src/components/ManageReviewersModal.tsx \
  apps/web/src/components/ReviewFeedbackModal.tsx \
  apps/web/src/components/Sidebar.tsx \
  apps/web/src/layouts/ReviewLayout.tsx

commit_group \
  "Sai Sathwik <sathwik1977@gmail.com>" \
  "[Frontend] Refine profile and app shell navigation" \
  apps/web/src/layouts/ProfileLayout.tsx \
  apps/web/src/layouts/App.tsx \
  apps/web/src/context/AuthContext.tsx

# 2) Anushka Agrawal - Frontend
commit_group \
  "Anushka Agrawal <es23btech11006@iith.ac.in>" \
  "[Frontend] Update library filters and search result rendering" \
  apps/web/src/components/library/LibraryFilterBar.tsx \
  apps/web/src/components/library/SearchResultsList.tsx \
  apps/web/src/hooks/useLibrary.ts \
  apps/web/src/services/searchService.ts

commit_group \
  "Anushka Agrawal <es23btech11006@iith.ac.in>" \
  "[Frontend] Rework template editor and citation panel flows" \
  apps/web/src/components/editor/CitationSearchDialog.tsx \
  apps/web/src/components/editor/ComponentLibraryPanel.tsx \
  apps/web/src/components/templates/TemplatesPage.tsx \
  apps/web/src/components/templates/TemplateLayoutEditor.tsx \
  apps/web/src/components/templates/TemplateComponentPalette.tsx \
  apps/web/src/lib/templateToTipTapDoc.ts

# 3) Sathwik Kodamarthi - Frontend + Backend
commit_group \
  "Sathwik Kodamarthi <cs23btech11025@iith.ac.in>" \
  "[Channel] Add publish modal router and channel-specific modals" \
  apps/web/src/components/PublishChannelBaseModal.tsx \
  apps/web/src/components/PublishChannelModalRouter.tsx \
  apps/web/src/components/PublishEmailChannelModal.tsx \
  apps/web/src/components/PublishPushChannelModal.tsx \
  apps/web/src/components/PublishWhatsAppChannelModal.tsx \
  apps/web/src/components/PublishWhatsAppModal.tsx \
  apps/web/src/services/channelService.ts

commit_group \
  "Sathwik Kodamarthi <cs23btech11025@iith.ac.in>" \
  "[AI] Register AI routes and worker integration pipeline" \
  apps/api/src/application/http/registerAiRoutes.ts \
  apps/api/src/intelligence \
  apps/api/src/integration \
  apps/api/src/application/http/registerPublicRoutes.ts \
  apps/api/src/application/http/registerProtectedRoutes.ts \
  apps/api/src/gateway/http/createGatewayRouter.ts \
  apps/api/src/modules/workflow/workflow.routes.ts

# 4) Gona Sanjana - Backend
commit_group \
  "Gona Sanjana <cs23btech11019@iith.ac.in>" \
  "[Backend] Harden auth middleware and route protection" \
  apps/api/src/middlewares/auth.middleware.ts \
  apps/api/src/middlewares/csrf.middleware.ts \
  apps/api/src/modules/auth \
  apps/api/src/shared/authCookies.ts \
  apps/api/src/shared/authorization

commit_group \
  "Gona Sanjana <cs23btech11019@iith.ac.in>" \
  "[Backend] Expand content and review domain services" \
  apps/api/src/modules/content \
  apps/api/src/modules/review \
  apps/api/src/modules/tag \
  apps/api/src/modules/template \
  apps/api/src/modules/profile

commit_group \
  "Gona Sanjana <cs23btech11019@iith.ac.in>" \
  "[Backend] Improve API bootstrap, errors, and shared validation" \
  apps/api/src/app.ts \
  apps/api/src/server.ts \
  apps/api/src/application/http/domainRouters.ts \
  apps/api/src/middlewares/error.middleware.ts \
  apps/api/src/middlewares/rateLimit.middleware.ts \
  apps/api/src/shared/errors \
  apps/api/src/shared/validation \
  apps/api/src/shared/logger \
  apps/api/src/shared/response.ts \
  apps/api/src/shared/validation/i18nPatch.ts

commit_group \
  "Gona Sanjana <cs23btech11019@iith.ac.in>" \
  "[Backend] Add admin analytics and realtime improvements" \
  apps/api/src/modules/admin \
  apps/api/src/modules/analytics \
  apps/api/src/modules/search \
  apps/api/src/realtime/wsServer.ts \
  apps/api/src/service/index.ts

# 5) Praneeth Chamarthy - Frontend + Database
commit_group \
  "Praneeth Chamarthy <cs23btech11012@iith.ac.in>" \
  "[Assets] Add frontend asset views and related client services" \
  apps/web/src/layouts/AssetLayout.tsx \
  apps/web/src/components/content/SimilarContentWidget.tsx \
  apps/web/src/services/assetService.ts \
  apps/web/src/hooks/useMyContent.ts \
  apps/web/src/data/mockMyContentData.ts

commit_group \
  "Praneeth Chamarthy <cs23btech11012@iith.ac.in>" \
  "[Assets] Introduce asset APIs and storage repository adapters" \
  apps/api/src/modules/assets \
  apps/api/src/platform/storage/s3Presign.ts \
  apps/api/src/repository/interfaces/assetRepository.ts \
  apps/api/src/repository/implementations/prisma/assetRepository.prisma.ts \
  apps/api/src/jobs/assetLinkIntegrityScan.ts \
  apps/api/src/modules/content/contentPlaceholderGate.ts

# 6) Jami Rithvik - Database + DevOps
commit_group \
  "Jami Rithvik <cs23btech11022@iith.ac.in>" \
  "[Database] Add schema and migrations for notification channels" \
  packages/database/transactional/prisma/schema.prisma \
  packages/database/transactional/prisma/seed.ts \
  packages/database/transactional/prisma/migrations/fcm_device_tokens \
  packages/database/transactional/prisma/migrations/push_inbox_notifications \
  packages/database/transactional/prisma/migrations/whatsapp_send_request \
  packages/database/elasticsearch/src/comms-content-index.json

commit_group \
  "Jami Rithvik <cs23btech11022@iith.ac.in>" \
  "[DevOps] Wire docker stack, nginx, and object storage setup" \
  docker-compose.yml \
  infra/docker/web/nginx.conf \
  infra/minio \
  apps/api/src/config/firebaseAdminEnv.ts \
  apps/api/src/config/firebaseEnv.ts \
  apps/api/src/config/storageEnv.ts \
  apps/api/env.example

commit_group \
  "Jami Rithvik <cs23btech11022@iith.ac.in>" \
  "[DevOps] Add notification and media flow verification scripts" \
  infra/scripts/test-email-send.sh \
  infra/scripts/test-email-text-compat.sh \
  infra/scripts/verify-notify-media-flow.sh

# 7) Sprint follow-up (paths that were missing from groups above)
commit_group \
  "Gona Sanjana <cs23btech11019@iith.ac.in>" \
  "[Backend] Component registry, repositories, and shared utilities" \
  apps/api/src/modules/channel/channel.service.ts \
  apps/api/src/modules/component/component.routes.ts \
  apps/api/src/modules/component/componentEvents.consumer.ts \
  apps/api/src/repository/implementations/prisma/componentRegistryRepository.prisma.ts \
  apps/api/src/repository/implementations/prisma/contentRepository.prisma.ts \
  apps/api/src/repository/implementations/prisma/unitOfWork.prisma.ts \
  apps/api/src/repository/interfaces/componentRegistryRepository.ts \
  apps/api/src/repository/interfaces/index.ts \
  apps/api/src/repository/types/componentRegistry.ts \
  apps/api/src/repository/types/content.ts \
  apps/api/src/shared/businessRules/index.ts \
  apps/api/src/shared/circuitBreaker/index.ts \
  apps/api/src/shared/hash.ts

commit_group \
  "Sathwik Kodamarthi <cs23btech11025@iith.ac.in>" \
  "[Channels] Email, push, WhatsApp, Firebase, and library API modules" \
  apps/api/src/modules/email-send \
  apps/api/src/modules/firebase \
  apps/api/src/modules/library \
  apps/api/src/modules/push-send \
  apps/api/src/modules/whatsapp-send

commit_group \
  "Sai Sathwik <sathwik1977@gmail.com>" \
  "[Frontend] Editor layout and legacy context cleanup" \
  apps/web/src/layouts/EditorLayout.tsx \
  apps/web/src/data/mockEditorComponents.ts \
  apps/web/src/context/EditorContext.tsx \
  apps/web/src/context/ReviewContext.tsx

commit_group \
  "Anushka Agrawal <es23btech11006@iith.ac.in>" \
  "[Frontend] Library, reading, my content, and channel admin UI" \
  apps/web/src/layouts/LibraryLayout.tsx \
  apps/web/src/layouts/ReadingLayout.tsx \
  apps/web/src/layouts/MyContentLayout.tsx \
  apps/web/src/components/admin/ChannelManagementTab.tsx

commit_group \
  "Sai Sathwik <sathwik1977@gmail.com>" \
  "[Frontend] API base, services, push toast, and WhatsApp helpers" \
  apps/web/src/lib/apiBase.ts \
  apps/web/src/lib/sanitizeHtml.ts \
  apps/web/src/lib/waPlaceholderManifest.ts \
  apps/web/src/lib/waPublishEventType.ts \
  apps/web/src/lib/waRecipientsImport.ts \
  apps/web/src/components/PushToastHub.tsx \
  apps/web/src/services/adminService.ts \
  apps/web/src/services/analyticsService.ts \
  apps/web/src/services/authService.ts \
  apps/web/src/services/citationService.ts \
  apps/web/src/services/componentService.ts \
  apps/web/src/services/contentService.ts \
  apps/web/src/services/emailSendService.ts \
  apps/web/src/services/groupService.ts \
  apps/web/src/services/index.ts \
  apps/web/src/services/profileService.ts \
  apps/web/src/services/pushNotificationService.ts \
  apps/web/src/services/pushSendService.ts \
  apps/web/src/services/reviewService.ts \
  apps/web/src/services/tagService.ts \
  apps/web/src/services/templateCrudService.ts \
  apps/web/src/services/templateService.ts \
  apps/web/src/services/tokenStore.ts \
  apps/web/src/services/whatsappSendService.ts \
  apps/web/src/styles/index.css \
  apps/web/vite.config.ts

commit_group \
  "Jami Rithvik <cs23btech11022@iith.ac.in>" \
  "[Chore] Docs, migrations, package manifests, and repo metadata" \
  .gitignore \
  README.md \
  package-lock.json \
  apps/api/package.json \
  apps/web/package.json \
  docs \
  packages/database/transactional/prisma/migrations/asset_storage_models \
  packages/database/transactional/prisma/migrations/component_category_and_asset_link_checks \
  G16_Centralized-Comms-Library_Sprint1.pdf \
  split.sh

echo
echo "Done. Remaining unstaged/uncommitted changes:"
git status --short