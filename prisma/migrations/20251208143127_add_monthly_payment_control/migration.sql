-- CreateEnum
CREATE TYPE "public"."PaymentControlStatus" AS ENUM ('OPEN', 'PROCESSING', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."PaymentRecordStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "public"."MonthlyPaymentControl" (
    "id" SERIAL NOT NULL,
    "referenceMonth" TEXT NOT NULL,
    "status" "public"."PaymentControlStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "MonthlyPaymentControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentRecord" (
    "id" SERIAL NOT NULL,
    "monthlyControlId" INTEGER NOT NULL,
    "physiotherapistId" INTEGER,
    "manualName" TEXT,
    "manualEmail" TEXT,
    "manualContractType" "public"."ContractType",
    "grossValue" DECIMAL(10,2) NOT NULL,
    "rpaOutrosDescontos" DECIMAL(10,2),
    "rpaIss" DECIMAL(10,2),
    "rpaIrrf" DECIMAL(10,2),
    "rpaInss" DECIMAL(10,2),
    "rpaTotalDescontos" DECIMAL(10,2),
    "netValue" DECIMAL(10,2) NOT NULL,
    "rpaFileId" TEXT,
    "rpaFileName" TEXT,
    "nfFileId" TEXT,
    "nfFileName" TEXT,
    "pixReceiptFileId" TEXT,
    "pixReceiptFileName" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "emailStatus" "public"."EmailStatus" NOT NULL DEFAULT 'PENDING',
    "status" "public"."PaymentRecordStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyPaymentControl_referenceMonth_key" ON "public"."MonthlyPaymentControl"("referenceMonth");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_monthlyControlId_physiotherapistId_key" ON "public"."PaymentRecord"("monthlyControlId", "physiotherapistId");

-- AddForeignKey
ALTER TABLE "public"."PaymentRecord" ADD CONSTRAINT "PaymentRecord_monthlyControlId_fkey" FOREIGN KEY ("monthlyControlId") REFERENCES "public"."MonthlyPaymentControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentRecord" ADD CONSTRAINT "PaymentRecord_physiotherapistId_fkey" FOREIGN KEY ("physiotherapistId") REFERENCES "public"."Physiotherapist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
