-- CreateEnum
CREATE TYPE "public"."ShiftSeriesStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ShiftSeriesExceptionType" AS ENUM ('SKIP', 'MODIFIED');

-- AlterTable
ALTER TABLE "public"."PhysiotherapistTeamPriceHistory" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."Shift" ADD COLUMN     "isSeriesException" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shiftSeriesId" INTEGER;

-- AlterTable
ALTER TABLE "public"."ShiftTeamPriceHistory" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "public"."ShiftSeries" (
    "id" SERIAL NOT NULL,
    "shiftTeamId" INTEGER NOT NULL,
    "physiotherapistId" INTEGER NOT NULL,
    "shiftTeamSlotId" INTEGER NOT NULL,
    "period" "public"."ShiftPeriod" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "weekdays" INTEGER[],
    "status" "public"."ShiftSeriesStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShiftSeriesException" (
    "id" SERIAL NOT NULL,
    "shiftSeriesId" INTEGER NOT NULL,
    "occurrenceDate" DATE NOT NULL,
    "type" "public"."ShiftSeriesExceptionType" NOT NULL,
    "shiftId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftSeriesException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftSeries_shiftTeamId_status_idx" ON "public"."ShiftSeries"("shiftTeamId", "status");

-- CreateIndex
CREATE INDEX "ShiftSeries_physiotherapistId_status_idx" ON "public"."ShiftSeries"("physiotherapistId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftSeriesException_shiftId_key" ON "public"."ShiftSeriesException"("shiftId");

-- CreateIndex
CREATE INDEX "ShiftSeriesException_shiftSeriesId_occurrenceDate_idx" ON "public"."ShiftSeriesException"("shiftSeriesId", "occurrenceDate");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftSeriesException_shiftSeriesId_occurrenceDate_key" ON "public"."ShiftSeriesException"("shiftSeriesId", "occurrenceDate");

-- CreateIndex
CREATE INDEX "Shift_shiftSeriesId_date_idx" ON "public"."Shift"("shiftSeriesId", "date");

-- AddForeignKey
ALTER TABLE "public"."Shift" ADD CONSTRAINT "Shift_shiftSeriesId_fkey" FOREIGN KEY ("shiftSeriesId") REFERENCES "public"."ShiftSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShiftSeries" ADD CONSTRAINT "ShiftSeries_shiftTeamId_fkey" FOREIGN KEY ("shiftTeamId") REFERENCES "public"."ShiftTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShiftSeries" ADD CONSTRAINT "ShiftSeries_physiotherapistId_fkey" FOREIGN KEY ("physiotherapistId") REFERENCES "public"."Physiotherapist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShiftSeries" ADD CONSTRAINT "ShiftSeries_shiftTeamSlotId_fkey" FOREIGN KEY ("shiftTeamSlotId") REFERENCES "public"."ShiftTeamSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShiftSeriesException" ADD CONSTRAINT "ShiftSeriesException_shiftSeriesId_fkey" FOREIGN KEY ("shiftSeriesId") REFERENCES "public"."ShiftSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShiftSeriesException" ADD CONSTRAINT "ShiftSeriesException_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "public"."Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
