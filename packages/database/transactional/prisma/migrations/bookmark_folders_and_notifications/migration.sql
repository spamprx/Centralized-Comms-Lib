CREATE TYPE "BookmarkNotificationType" AS ENUM ('BODY_UPDATED', 'PUBLISHED');

CREATE TABLE "bookmark_folders" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bookmark_folders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bookmark_folders_userId_name_key"
  ON "bookmark_folders"("userId", "name");
CREATE INDEX "bookmark_folders_userId_updatedAt_idx"
  ON "bookmark_folders"("userId", "updatedAt");

ALTER TABLE "content_bookmarks"
  ADD COLUMN "folderId" TEXT;

CREATE INDEX "content_bookmarks_folderId_createdAt_idx"
  ON "content_bookmarks"("folderId", "createdAt");

CREATE TABLE "content_bookmark_notifications" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "type" "BookmarkNotificationType" NOT NULL,
  "message" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "content_bookmark_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "content_bookmark_notifications_userId_createdAt_idx"
  ON "content_bookmark_notifications"("userId", "createdAt");
CREATE INDEX "content_bookmark_notifications_userId_readAt_createdAt_idx"
  ON "content_bookmark_notifications"("userId", "readAt", "createdAt");
CREATE INDEX "content_bookmark_notifications_contentId_createdAt_idx"
  ON "content_bookmark_notifications"("contentId", "createdAt");

ALTER TABLE "bookmark_folders"
  ADD CONSTRAINT "bookmark_folders_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_bookmarks"
  ADD CONSTRAINT "content_bookmarks_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "bookmark_folders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "content_bookmark_notifications"
  ADD CONSTRAINT "content_bookmark_notifications_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_bookmark_notifications"
  ADD CONSTRAINT "content_bookmark_notifications_contentId_fkey"
  FOREIGN KEY ("contentId") REFERENCES "contents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
