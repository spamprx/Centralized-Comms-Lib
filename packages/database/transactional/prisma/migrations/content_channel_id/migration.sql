-- Add channelId directly to contents table so the editor never needs a join to find the channel.
-- Back-fill: resolve channelId from template_channel_bindings for rows that already have a templateId.

ALTER TABLE "contents" ADD COLUMN "channelId" TEXT;

ALTER TABLE "contents"
  ADD CONSTRAINT "contents_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "channels"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "contents_channelId_idx" ON "contents"("channelId");

-- Back-fill existing rows that have a templateId with the first bound channelId.
UPDATE "contents" c
SET "channelId" = (
  SELECT tcb."channelId"
  FROM "template_channel_bindings" tcb
  WHERE tcb."templateId" = c."templateId"
  LIMIT 1
)
WHERE c."templateId" IS NOT NULL
  AND c."channelId" IS NULL;
