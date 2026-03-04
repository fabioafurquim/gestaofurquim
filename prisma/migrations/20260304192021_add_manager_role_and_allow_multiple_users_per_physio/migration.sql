-- AlterEnum
ALTER TYPE "public"."UserRole" ADD VALUE 'MANAGER';

-- DropIndex
DROP INDEX "public"."User_physiotherapistId_key";

-- AlterTable
ALTER TABLE "public"."PaymentRecord" ADD COLUMN     "rpaValorServico" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "public"."PhysiotherapistTeam" ADD COLUMN     "customShiftValue" DECIMAL(10,2);
