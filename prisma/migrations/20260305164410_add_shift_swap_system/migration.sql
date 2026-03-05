-- CreateEnum
CREATE TYPE "public"."SwapStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "public"."ShiftSwapRequest" (
    "id" SERIAL NOT NULL,
    "shiftId" INTEGER NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "targetPhysioId" INTEGER,
    "status" "public"."SwapStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "responderId" INTEGER,

    CONSTRAINT "ShiftSwapRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."ShiftSwapRequest" ADD CONSTRAINT "ShiftSwapRequest_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "public"."Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShiftSwapRequest" ADD CONSTRAINT "ShiftSwapRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "public"."Physiotherapist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShiftSwapRequest" ADD CONSTRAINT "ShiftSwapRequest_targetPhysioId_fkey" FOREIGN KEY ("targetPhysioId") REFERENCES "public"."Physiotherapist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShiftSwapRequest" ADD CONSTRAINT "ShiftSwapRequest_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "public"."Physiotherapist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
