-- Review policies: admin-defined publication review requirements

CREATE TABLE IF NOT EXISTS "review_policies" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "contentType" "ContentType" NOT NULL,
  "channelId" TEXT NULL,
  "userGroupId" TEXT NULL,
  "quorumRequired" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NULL
);

-- Foreign keys (match Prisma onDelete: SetNull)
ALTER TABLE "review_policies"
  ADD CONSTRAINT "review_policies_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "channels"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "review_policies"
  ADD CONSTRAINT "review_policies_userGroupId_fkey"
  FOREIGN KEY ("userGroupId") REFERENCES "user_groups"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "review_policies"
  ADD CONSTRAINT "review_policies_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "review_policies_contentType_idx" ON "review_policies"("contentType");
CREATE INDEX IF NOT EXISTS "review_policies_channelId_idx" ON "review_policies"("channelId");
CREATE INDEX IF NOT EXISTS "review_policies_userGroupId_idx" ON "review_policies"("userGroupId");
CREATE INDEX IF NOT EXISTS "review_policies_isActive_idx" ON "review_policies"("isActive");

