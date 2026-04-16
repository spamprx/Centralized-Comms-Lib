-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "presencePingAt" TIMESTAMP(3);
