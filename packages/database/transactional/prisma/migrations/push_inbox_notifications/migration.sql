-- CreateEnum
CREATE TYPE "UserPushNotificationType" AS ENUM ('PUSH_SENT');

-- CreateTable
CREATE TABLE "user_push_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UserPushNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_push_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_push_notifications_userId_createdAt_idx" ON "user_push_notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "user_push_notifications_userId_readAt_createdAt_idx" ON "user_push_notifications"("userId", "readAt", "createdAt");

-- AddForeignKey
ALTER TABLE "user_push_notifications"
ADD CONSTRAINT "user_push_notifications_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
