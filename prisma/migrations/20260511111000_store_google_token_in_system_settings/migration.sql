ALTER TABLE "public"."SystemSettings"
ADD COLUMN "googleTokenEncrypted" TEXT,
ADD COLUMN "googleTokenUpdatedAt" TIMESTAMP(3);
