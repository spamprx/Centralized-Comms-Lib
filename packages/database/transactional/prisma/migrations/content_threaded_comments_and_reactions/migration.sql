-- Add threaded comments (max depth enforced in API) and multi-emoji reactions.

CREATE TYPE "ReactionEmoji" AS ENUM (
  'LIKE',
  'LOVE',
  'CLAP',
  'INSIGHTFUL',
  'LAUGH',
  'CELEBRATE'
);

ALTER TABLE "content_comments"
  ADD COLUMN "parentId" TEXT;

CREATE INDEX "content_comments_parentId_createdAt_idx"
  ON "content_comments"("parentId", "createdAt");

ALTER TABLE "content_comments"
  ADD CONSTRAINT "content_comments_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "content_comments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "content_reactions" (
  "id" TEXT NOT NULL,
  "emoji" "ReactionEmoji" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "contentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,

  CONSTRAINT "content_reactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "content_reactions_contentId_userId_key"
  ON "content_reactions"("contentId", "userId");
CREATE INDEX "content_reactions_contentId_emoji_createdAt_idx"
  ON "content_reactions"("contentId", "emoji", "createdAt");
CREATE INDEX "content_reactions_userId_createdAt_idx"
  ON "content_reactions"("userId", "createdAt");

ALTER TABLE "content_reactions"
  ADD CONSTRAINT "content_reactions_contentId_fkey"
  FOREIGN KEY ("contentId") REFERENCES "contents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_reactions"
  ADD CONSTRAINT "content_reactions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
