-- AlterEnum
ALTER TYPE "public"."SwapStatus" ADD VALUE 'PENDING_APPROVAL';

-- AlterTable
ALTER TABLE "public"."ShiftSwapRequest" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" INTEGER;

-- CreateTable
CREATE TABLE "public"."SystemSettings" (
    "id" SERIAL NOT NULL,
    "swapRequiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."ShiftSwapRequest" ADD CONSTRAINT "ShiftSwapRequest_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
