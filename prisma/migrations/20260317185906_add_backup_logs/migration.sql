-- CreateTable
CREATE TABLE "public"."BackupLog" (
    "id" SERIAL NOT NULL,
    "triggerType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "storageTarget" TEXT,
    "driveFileId" TEXT,
    "driveFileName" TEXT,
    "driveWebViewLink" TEXT,
    "errorMessage" TEXT,
    "createdByUserId" INTEGER,
    "createdByName" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackupLog_createdAt_idx" ON "public"."BackupLog"("createdAt");

-- CreateIndex
CREATE INDEX "BackupLog_triggerType_createdAt_idx" ON "public"."BackupLog"("triggerType", "createdAt");

-- CreateIndex
CREATE INDEX "BackupLog_status_createdAt_idx" ON "public"."BackupLog"("status", "createdAt");
