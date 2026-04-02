-- Create enums for the unified financial module
CREATE TYPE "public"."FinancialClosingStatus" AS ENUM (
    'DRAFT',
    'UNDER_REVIEW',
    'APPROVED_FOR_PAYMENT',
    'BANK_FILE_GENERATED',
    'BANK_SUBMITTED',
    'PAYMENT_CONFIRMED',
    'CLOSED',
    'REOPENED',
    'ARCHIVED'
);

CREATE TYPE "public"."FinancialClosingLineStatus" AS ENUM (
    'DRAFT',
    'UNDER_REVIEW',
    'APPROVED',
    'LOCKED',
    'PAID',
    'CANCELLED'
);

CREATE TYPE "public"."FinancialAdjustmentType" AS ENUM (
    'BONUS',
    'CREDIT',
    'DEBIT',
    'DISCOUNT',
    'CORRECTION',
    'OTHER'
);

CREATE TYPE "public"."FinancialDocumentType" AS ENUM (
    'RPA',
    'INVOICE',
    'PIX_RECEIPT',
    'BANK_FILE',
    'BANK_RETURN',
    'EMAIL_RECEIPT',
    'OTHER'
);

CREATE TYPE "public"."FinancialDocumentStatus" AS ENUM (
    'PENDING',
    'AVAILABLE',
    'ARCHIVED',
    'INVALID'
);

CREATE TYPE "public"."FinancialAuditEventType" AS ENUM (
    'SNAPSHOT_CREATED',
    'LINE_CREATED',
    'ADJUSTMENT_CREATED',
    'DOCUMENT_REGISTERED',
    'BATCH_CREATED',
    'BATCH_GENERATED',
    'STATUS_CHANGED',
    'PAYMENT_CONFIRMED',
    'REOPENED',
    'AUDIT_NOTE'
);

CREATE TYPE "public"."PaymentBatchStatus" AS ENUM (
    'DRAFT',
    'READY',
    'GENERATED',
    'SUBMITTED',
    'CONFIRMED',
    'FAILED',
    'CANCELLED'
);

-- FinancialClosing
CREATE TABLE "public"."FinancialClosing" (
    "id" SERIAL NOT NULL,
    "referenceMonth" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "public"."FinancialClosingStatus" NOT NULL DEFAULT 'DRAFT',
    "snapshotVersion" INTEGER NOT NULL DEFAULT 1,
    "totalPhysiotherapists" INTEGER NOT NULL DEFAULT 0,
    "totalShifts" INTEGER NOT NULL DEFAULT 0,
    "totalGrossValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAdjustmentValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalNetValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sourceChecksum" TEXT,
    "notes" TEXT,
    "snapshotData" JSONB,
    "generatedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "approvedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialClosing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialClosing_referenceMonth_key" ON "public"."FinancialClosing"("referenceMonth");
CREATE INDEX "FinancialClosing_status_referenceMonth_idx" ON "public"."FinancialClosing"("status", "referenceMonth");
CREATE INDEX "FinancialClosing_year_month_idx" ON "public"."FinancialClosing"("year", "month");

ALTER TABLE "public"."FinancialClosing"
  ADD CONSTRAINT "FinancialClosing_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."FinancialClosing"
  ADD CONSTRAINT "FinancialClosing_approvedBy_fkey"
  FOREIGN KEY ("approvedBy") REFERENCES "public"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- PaymentBatch
CREATE TABLE "public"."PaymentBatch" (
    "id" SERIAL NOT NULL,
    "financialClosingId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'BANCO_INTER',
    "status" "public"."PaymentBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "batchNumber" TEXT,
    "fileName" TEXT,
    "fileId" TEXT,
    "fileHash" TEXT,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "totalValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payload" JSONB,
    "generatedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentBatch_financialClosingId_status_idx" ON "public"."PaymentBatch"("financialClosingId", "status");
CREATE INDEX "PaymentBatch_provider_status_idx" ON "public"."PaymentBatch"("provider", "status");

ALTER TABLE "public"."PaymentBatch"
  ADD CONSTRAINT "PaymentBatch_financialClosingId_fkey"
  FOREIGN KEY ("financialClosingId") REFERENCES "public"."FinancialClosing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."PaymentBatch"
  ADD CONSTRAINT "PaymentBatch_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- FinancialClosingLine
CREATE TABLE "public"."FinancialClosingLine" (
    "id" SERIAL NOT NULL,
    "financialClosingId" INTEGER NOT NULL,
    "physiotherapistId" INTEGER NOT NULL,
    "primaryTeamId" INTEGER,
    "primaryTeamName" TEXT,
    "physiotherapistName" TEXT NOT NULL,
    "physiotherapistEmail" TEXT,
    "contractType" "public"."ContractType" NOT NULL,
    "totalShifts" INTEGER NOT NULL DEFAULT 0,
    "grossCalculatedValue" DECIMAL(12,2) NOT NULL,
    "adjustmentTotalValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netValue" DECIMAL(12,2) NOT NULL,
    "additionalValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "public"."FinancialClosingLineStatus" NOT NULL DEFAULT 'DRAFT',
    "calculationSnapshot" JSONB,
    "shiftDetailsSnapshot" JSONB,
    "teamBreakdownSnapshot" JSONB,
    "lockedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentBatchId" INTEGER,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialClosingLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialClosingLine_financialClosingId_physiotherapistId_key" ON "public"."FinancialClosingLine"("financialClosingId", "physiotherapistId");
CREATE INDEX "FinancialClosingLine_financialClosingId_status_idx" ON "public"."FinancialClosingLine"("financialClosingId", "status");
CREATE INDEX "FinancialClosingLine_physiotherapistId_financialClosingId_idx" ON "public"."FinancialClosingLine"("physiotherapistId", "financialClosingId");

ALTER TABLE "public"."FinancialClosingLine"
  ADD CONSTRAINT "FinancialClosingLine_financialClosingId_fkey"
  FOREIGN KEY ("financialClosingId") REFERENCES "public"."FinancialClosing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."FinancialClosingLine"
  ADD CONSTRAINT "FinancialClosingLine_physiotherapistId_fkey"
  FOREIGN KEY ("physiotherapistId") REFERENCES "public"."Physiotherapist"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."FinancialClosingLine"
  ADD CONSTRAINT "FinancialClosingLine_paymentBatchId_fkey"
  FOREIGN KEY ("paymentBatchId") REFERENCES "public"."PaymentBatch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."FinancialClosingLine"
  ADD CONSTRAINT "FinancialClosingLine_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."FinancialClosingLine"
  ADD CONSTRAINT "FinancialClosingLine_updatedBy_fkey"
  FOREIGN KEY ("updatedBy") REFERENCES "public"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- FinancialAdjustment
CREATE TABLE "public"."FinancialAdjustment" (
    "id" SERIAL NOT NULL,
    "financialClosingId" INTEGER NOT NULL,
    "financialClosingLineId" INTEGER,
    "type" "public"."FinancialAdjustmentType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialAdjustment_financialClosingId_type_idx" ON "public"."FinancialAdjustment"("financialClosingId", "type");
CREATE INDEX "FinancialAdjustment_financialClosingLineId_idx" ON "public"."FinancialAdjustment"("financialClosingLineId");

ALTER TABLE "public"."FinancialAdjustment"
  ADD CONSTRAINT "FinancialAdjustment_financialClosingId_fkey"
  FOREIGN KEY ("financialClosingId") REFERENCES "public"."FinancialClosing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."FinancialAdjustment"
  ADD CONSTRAINT "FinancialAdjustment_financialClosingLineId_fkey"
  FOREIGN KEY ("financialClosingLineId") REFERENCES "public"."FinancialClosingLine"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."FinancialAdjustment"
  ADD CONSTRAINT "FinancialAdjustment_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- FinancialDocument
CREATE TABLE "public"."FinancialDocument" (
    "id" SERIAL NOT NULL,
    "financialClosingId" INTEGER NOT NULL,
    "financialClosingLineId" INTEGER,
    "physiotherapistId" INTEGER,
    "type" "public"."FinancialDocumentType" NOT NULL,
    "status" "public"."FinancialDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'GOOGLE_DRIVE',
    "fileName" TEXT NOT NULL,
    "fileId" TEXT,
    "fileUrl" TEXT,
    "mimeType" TEXT,
    "fileHash" TEXT,
    "folderPath" TEXT,
    "referenceMonth" TEXT NOT NULL,
    "metadata" JSONB,
    "extractedData" JSONB,
    "uploadedBy" INTEGER,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialDocument_financialClosingId_type_idx" ON "public"."FinancialDocument"("financialClosingId", "type");
CREATE INDEX "FinancialDocument_physiotherapistId_type_idx" ON "public"."FinancialDocument"("physiotherapistId", "type");
CREATE INDEX "FinancialDocument_referenceMonth_type_idx" ON "public"."FinancialDocument"("referenceMonth", "type");

ALTER TABLE "public"."FinancialDocument"
  ADD CONSTRAINT "FinancialDocument_financialClosingId_fkey"
  FOREIGN KEY ("financialClosingId") REFERENCES "public"."FinancialClosing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."FinancialDocument"
  ADD CONSTRAINT "FinancialDocument_financialClosingLineId_fkey"
  FOREIGN KEY ("financialClosingLineId") REFERENCES "public"."FinancialClosingLine"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."FinancialDocument"
  ADD CONSTRAINT "FinancialDocument_physiotherapistId_fkey"
  FOREIGN KEY ("physiotherapistId") REFERENCES "public"."Physiotherapist"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."FinancialDocument"
  ADD CONSTRAINT "FinancialDocument_uploadedBy_fkey"
  FOREIGN KEY ("uploadedBy") REFERENCES "public"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- FinancialAuditEvent
CREATE TABLE "public"."FinancialAuditEvent" (
    "id" SERIAL NOT NULL,
    "financialClosingId" INTEGER NOT NULL,
    "financialClosingLineId" INTEGER,
    "financialAdjustmentId" INTEGER,
    "financialDocumentId" INTEGER,
    "paymentBatchId" INTEGER,
    "type" "public"."FinancialAuditEventType" NOT NULL,
    "actorUserId" INTEGER,
    "actorName" TEXT,
    "message" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialAuditEvent_financialClosingId_createdAt_idx" ON "public"."FinancialAuditEvent"("financialClosingId", "createdAt");
CREATE INDEX "FinancialAuditEvent_type_createdAt_idx" ON "public"."FinancialAuditEvent"("type", "createdAt");

ALTER TABLE "public"."FinancialAuditEvent"
  ADD CONSTRAINT "FinancialAuditEvent_financialClosingId_fkey"
  FOREIGN KEY ("financialClosingId") REFERENCES "public"."FinancialClosing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."FinancialAuditEvent"
  ADD CONSTRAINT "FinancialAuditEvent_financialClosingLineId_fkey"
  FOREIGN KEY ("financialClosingLineId") REFERENCES "public"."FinancialClosingLine"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."FinancialAuditEvent"
  ADD CONSTRAINT "FinancialAuditEvent_financialAdjustmentId_fkey"
  FOREIGN KEY ("financialAdjustmentId") REFERENCES "public"."FinancialAdjustment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."FinancialAuditEvent"
  ADD CONSTRAINT "FinancialAuditEvent_financialDocumentId_fkey"
  FOREIGN KEY ("financialDocumentId") REFERENCES "public"."FinancialDocument"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."FinancialAuditEvent"
  ADD CONSTRAINT "FinancialAuditEvent_paymentBatchId_fkey"
  FOREIGN KEY ("paymentBatchId") REFERENCES "public"."PaymentBatch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."FinancialAuditEvent"
  ADD CONSTRAINT "FinancialAuditEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

