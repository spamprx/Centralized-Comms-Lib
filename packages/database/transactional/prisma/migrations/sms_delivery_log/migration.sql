-- Track outbound SMS sends and provider delivery receipts.
-- Enforces that referenced channel rows use channels.key = 'sms'.

CREATE TYPE "SmsDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

CREATE TABLE "sms_delivery_logs" (
  "id" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "toPhoneNumber" TEXT NOT NULL,
  "providerSid" TEXT,
  "status" "SmsDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "providerUpdatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sms_delivery_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sms_delivery_logs_providerSid_key" ON "sms_delivery_logs"("providerSid");
CREATE INDEX "sms_delivery_logs_contentId_createdAt_idx" ON "sms_delivery_logs"("contentId", "createdAt");
CREATE INDEX "sms_delivery_logs_channelId_createdAt_idx" ON "sms_delivery_logs"("channelId", "createdAt");
CREATE INDEX "sms_delivery_logs_status_createdAt_idx" ON "sms_delivery_logs"("status", "createdAt");
CREATE INDEX "sms_delivery_logs_toPhoneNumber_createdAt_idx" ON "sms_delivery_logs"("toPhoneNumber", "createdAt");

ALTER TABLE "sms_delivery_logs"
  ADD CONSTRAINT "sms_delivery_logs_contentId_fkey"
  FOREIGN KEY ("contentId") REFERENCES "contents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sms_delivery_logs"
  ADD CONSTRAINT "sms_delivery_logs_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "channels"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION enforce_sms_channel_for_delivery_logs()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "channels" c
    WHERE c."id" = NEW."channelId" AND c."key" = 'sms'
  ) THEN
    RAISE EXCEPTION 'sms_delivery_logs.channelId must reference channels.key=''sms''';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sms_delivery_logs_channel_guard
BEFORE INSERT OR UPDATE OF "channelId" ON "sms_delivery_logs"
FOR EACH ROW
EXECUTE FUNCTION enforce_sms_channel_for_delivery_logs();
