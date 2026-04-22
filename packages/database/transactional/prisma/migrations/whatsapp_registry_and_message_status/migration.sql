-- WhatsApp template registry + per-message status persistence.
-- Enforces that channel references point to channels.key = 'whatsapp'.

CREATE TYPE "WhatsAppTemplateApprovalState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED');
CREATE TYPE "WhatsAppTemplateSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED');
CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

CREATE TABLE "whatsapp_template_registry" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "templateName" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "approvalState" "WhatsAppTemplateApprovalState" NOT NULL DEFAULT 'PENDING',
  "syncStatus" "WhatsAppTemplateSyncStatus" NOT NULL DEFAULT 'PENDING',
  "lastSyncAt" TIMESTAMP(3),
  "metaTemplateId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "whatsapp_template_registry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "whatsapp_message_logs" (
  "id" TEXT NOT NULL,
  "wamid" TEXT NOT NULL,
  "contentId" TEXT,
  "channelId" TEXT NOT NULL,
  "templateId" TEXT,
  "toPhoneNumber" TEXT NOT NULL,
  "status" "WhatsAppMessageStatus" NOT NULL DEFAULT 'QUEUED',
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "sentAt" TIMESTAMP(3),
  "statusUpdatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "whatsapp_message_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_template_registry_channelId_templateName_language_key"
  ON "whatsapp_template_registry"("channelId", "templateName", "language");
CREATE INDEX "whatsapp_template_registry_approvalState_updatedAt_idx"
  ON "whatsapp_template_registry"("approvalState", "updatedAt");
CREATE INDEX "whatsapp_template_registry_syncStatus_updatedAt_idx"
  ON "whatsapp_template_registry"("syncStatus", "updatedAt");
CREATE INDEX "whatsapp_template_registry_lastSyncAt_idx"
  ON "whatsapp_template_registry"("lastSyncAt");

CREATE UNIQUE INDEX "whatsapp_message_logs_wamid_key"
  ON "whatsapp_message_logs"("wamid");
CREATE INDEX "whatsapp_message_logs_contentId_createdAt_idx"
  ON "whatsapp_message_logs"("contentId", "createdAt");
CREATE INDEX "whatsapp_message_logs_channelId_createdAt_idx"
  ON "whatsapp_message_logs"("channelId", "createdAt");
CREATE INDEX "whatsapp_message_logs_templateId_createdAt_idx"
  ON "whatsapp_message_logs"("templateId", "createdAt");
CREATE INDEX "whatsapp_message_logs_status_createdAt_idx"
  ON "whatsapp_message_logs"("status", "createdAt");
CREATE INDEX "whatsapp_message_logs_toPhoneNumber_createdAt_idx"
  ON "whatsapp_message_logs"("toPhoneNumber", "createdAt");

ALTER TABLE "whatsapp_template_registry"
  ADD CONSTRAINT "whatsapp_template_registry_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "channels"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "whatsapp_message_logs"
  ADD CONSTRAINT "whatsapp_message_logs_contentId_fkey"
  FOREIGN KEY ("contentId") REFERENCES "contents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "whatsapp_message_logs"
  ADD CONSTRAINT "whatsapp_message_logs_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "channels"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "whatsapp_message_logs"
  ADD CONSTRAINT "whatsapp_message_logs_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "whatsapp_template_registry"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION enforce_whatsapp_channel_for_template_registry()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "channels" c
    WHERE c."id" = NEW."channelId" AND c."key" = 'whatsapp'
  ) THEN
    RAISE EXCEPTION 'whatsapp_template_registry.channelId must reference channels.key=''whatsapp''';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER whatsapp_template_registry_channel_guard
BEFORE INSERT OR UPDATE OF "channelId" ON "whatsapp_template_registry"
FOR EACH ROW
EXECUTE FUNCTION enforce_whatsapp_channel_for_template_registry();

CREATE OR REPLACE FUNCTION enforce_whatsapp_channel_for_message_logs()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "channels" c
    WHERE c."id" = NEW."channelId" AND c."key" = 'whatsapp'
  ) THEN
    RAISE EXCEPTION 'whatsapp_message_logs.channelId must reference channels.key=''whatsapp''';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER whatsapp_message_logs_channel_guard
BEFORE INSERT OR UPDATE OF "channelId" ON "whatsapp_message_logs"
FOR EACH ROW
EXECUTE FUNCTION enforce_whatsapp_channel_for_message_logs();
