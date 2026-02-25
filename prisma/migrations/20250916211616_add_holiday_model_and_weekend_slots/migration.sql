-- AlterTable
ALTER TABLE "public"."ShiftTeam" ADD COLUMN     "weekdayAfternoonSlots" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weekdayIntermediateSlots" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weekdayMorningSlots" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weekdayNightSlots" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weekendAfternoonSlots" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weekendIntermediateSlots" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weekendMorningSlots" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weekendNightSlots" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."Holiday" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "public"."Holiday"("date");
