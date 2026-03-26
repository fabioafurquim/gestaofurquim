-- CreateTable
CREATE TABLE "public"."ShiftTeamPriceHistory" (
    "id" SERIAL NOT NULL,
    "shiftTeamId" INTEGER NOT NULL,
    "shiftValue" DECIMAL(10,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,

    CONSTRAINT "ShiftTeamPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PhysiotherapistTeamPriceHistory" (
    "id" SERIAL NOT NULL,
    "physiotherapistTeamId" INTEGER NOT NULL,
    "customShiftValue" DECIMAL(10,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,

    CONSTRAINT "PhysiotherapistTeamPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftTeamPriceHistory_shiftTeamId_effectiveFrom_idx" ON "public"."ShiftTeamPriceHistory"("shiftTeamId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "PhysiotherapistTeamPriceHistory_physiotherapistTeamId_effec_idx" ON "public"."PhysiotherapistTeamPriceHistory"("physiotherapistTeamId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "public"."ShiftTeamPriceHistory" ADD CONSTRAINT "ShiftTeamPriceHistory_shiftTeamId_fkey" FOREIGN KEY ("shiftTeamId") REFERENCES "public"."ShiftTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShiftTeamPriceHistory" ADD CONSTRAINT "ShiftTeamPriceHistory_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PhysiotherapistTeamPriceHistory" ADD CONSTRAINT "PhysiotherapistTeamPriceHistory_physiotherapistTeamId_fkey" FOREIGN KEY ("physiotherapistTeamId") REFERENCES "public"."PhysiotherapistTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PhysiotherapistTeamPriceHistory" ADD CONSTRAINT "PhysiotherapistTeamPriceHistory_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
