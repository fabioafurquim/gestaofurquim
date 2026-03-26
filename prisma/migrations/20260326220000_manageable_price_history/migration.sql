-- AlterTable
ALTER TABLE "public"."ShiftTeamPriceHistory"
ADD COLUMN "changeReason" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedBy" INTEGER;

-- AlterTable
ALTER TABLE "public"."PhysiotherapistTeamPriceHistory"
ADD COLUMN "changeReason" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedBy" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."ShiftTeamPriceHistory"
ADD CONSTRAINT "ShiftTeamPriceHistory_updatedBy_fkey"
FOREIGN KEY ("updatedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PhysiotherapistTeamPriceHistory"
ADD CONSTRAINT "PhysiotherapistTeamPriceHistory_updatedBy_fkey"
FOREIGN KEY ("updatedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
