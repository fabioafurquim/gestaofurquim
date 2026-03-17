-- AlterTable
ALTER TABLE "public"."NotificationSettings" ADD COLUMN     "shiftDeletionTelegramEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."ShiftDeletionLog" (
    "id" SERIAL NOT NULL,
    "originalShiftId" INTEGER NOT NULL,
    "shiftDate" TIMESTAMP(3) NOT NULL,
    "period" "public"."ShiftPeriod" NOT NULL,
    "shiftTeamId" INTEGER NOT NULL,
    "shiftTeamName" TEXT NOT NULL,
    "physiotherapistId" INTEGER NOT NULL,
    "physiotherapistName" TEXT NOT NULL,
    "deletedByUserId" INTEGER NOT NULL,
    "deletedByUserName" TEXT NOT NULL,
    "deletedByUserRole" "public"."UserRole" NOT NULL,
    "deletedOwnShift" BOOLEAN NOT NULL DEFAULT false,
    "notifiedViaTelegram" BOOLEAN NOT NULL DEFAULT false,
    "notificationSentAt" TIMESTAMP(3),
    "notificationError" TEXT,
    "notificationTargets" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftDeletionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftDeletionLog_createdAt_idx" ON "public"."ShiftDeletionLog"("createdAt");

-- CreateIndex
CREATE INDEX "ShiftDeletionLog_deletedByUserId_createdAt_idx" ON "public"."ShiftDeletionLog"("deletedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ShiftDeletionLog_physiotherapistId_createdAt_idx" ON "public"."ShiftDeletionLog"("physiotherapistId", "createdAt");

-- CreateIndex
CREATE INDEX "ShiftDeletionLog_shiftTeamId_createdAt_idx" ON "public"."ShiftDeletionLog"("shiftTeamId", "createdAt");
