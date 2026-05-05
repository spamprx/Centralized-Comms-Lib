-- WhatsApp send request: stores TipTap-to-notification conversion requests for audit/replay.

CREATE TYPE "WhatsAppSendRequestStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "whatsapp_send_requests" (
  "id" TEXT NOT NULL,
  "channelId" TEXT,
  "requestedById" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "recipients" JSONB NOT NULL,
  "tiptapPayload" JSONB NOT NULL,
  "notifyPayload" JSONB NOT NULL,
  "status" "WhatsAppSendRequestStatus" NOT NULL DEFAULT 'PENDING',
  "failureMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "whatsapp_send_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "whatsapp_send_requests_requestedById_createdAt_idx"
  ON "whatsapp_send_requests"("requestedById", "createdAt");
CREATE INDEX "whatsapp_send_requests_status_createdAt_idx"
  ON "whatsapp_send_requests"("status", "createdAt");

ALTER TABLE "whatsapp_send_requests"
  ADD CONSTRAINT "whatsapp_send_requests_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "channels"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "whatsapp_send_requests"
  ADD CONSTRAINT "whatsapp_send_requests_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
