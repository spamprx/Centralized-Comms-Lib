-- Persist per-user reading progress for content.

CREATE TYPE "ReadingProgressStatus" AS ENUM ('NOT_STARTED', 'READING', 'DONE');

CREATE TABLE "content_reading_progress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "percent" INTEGER NOT NULL DEFAULT 0,
  "status" "ReadingProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "content_reading_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "content_reading_progress_userId_contentId_key"
  ON "content_reading_progress"("userId", "contentId");
CREATE INDEX "content_reading_progress_contentId_updatedAt_idx"
  ON "content_reading_progress"("contentId", "updatedAt");
CREATE INDEX "content_reading_progress_userId_updatedAt_idx"
  ON "content_reading_progress"("userId", "updatedAt");
CREATE INDEX "content_reading_progress_status_updatedAt_idx"
  ON "content_reading_progress"("status", "updatedAt");

ALTER TABLE "content_reading_progress"
  ADD CONSTRAINT "content_reading_progress_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_reading_progress"
  ADD CONSTRAINT "content_reading_progress_contentId_fkey"
  FOREIGN KEY ("contentId") REFERENCES "contents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
