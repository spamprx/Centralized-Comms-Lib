-- CreateTable
CREATE TABLE "user_device_fcm_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_device_fcm_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_device_fcm_tokens_token_key" ON "user_device_fcm_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "user_device_fcm_tokens_userId_deviceId_key" ON "user_device_fcm_tokens"("userId", "deviceId");

-- CreateIndex
CREATE INDEX "user_device_fcm_tokens_userId_updatedAt_idx" ON "user_device_fcm_tokens"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "user_device_fcm_tokens_deviceId_idx" ON "user_device_fcm_tokens"("deviceId");

-- AddForeignKey
ALTER TABLE "user_device_fcm_tokens" ADD CONSTRAINT "user_device_fcm_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
