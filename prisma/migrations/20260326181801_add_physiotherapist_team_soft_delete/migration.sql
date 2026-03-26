-- AlterTable
ALTER TABLE "public"."PhysiotherapistTeam" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."PhysiotherapistTeamPriceHistory" ALTER COLUMN "customShiftValue" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."ShiftTeamSlot" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "PhysiotherapistTeam_physiotherapistId_isActive_idx" ON "public"."PhysiotherapistTeam"("physiotherapistId", "isActive");

-- CreateIndex
CREATE INDEX "PhysiotherapistTeam_shiftTeamId_isActive_idx" ON "public"."PhysiotherapistTeam"("shiftTeamId", "isActive");
