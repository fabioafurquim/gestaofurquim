-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('PJ', 'RPA', 'NO_CONTRACT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "ShiftPeriod" AS ENUM ('MORNING', 'INTERMEDIATE', 'AFTERNOON', 'NIGHT');

-- CreateTable
CREATE TABLE "Physiotherapist" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "crefito" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "rg" TEXT,
    "birthDate" TIMESTAMP(3),
    "address" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "exitDate" TIMESTAMP(3),
    "hourValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "additionalValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "contractType" "ContractType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "agencia" TEXT,
    "banco" TEXT,
    "chavePix" TEXT,
    "cnpjEmpresa" TEXT,
    "conta" TEXT,
    "enderecoEmpresa" TEXT,
    "nomeEmpresa" TEXT,
    "tipoPix" TEXT,

    CONSTRAINT "Physiotherapist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftTeam" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "morningSlots" INTEGER NOT NULL DEFAULT 0,
    "intermediateSlots" INTEGER NOT NULL DEFAULT 0,
    "afternoonSlots" INTEGER NOT NULL DEFAULT 0,
    "nightSlots" INTEGER NOT NULL DEFAULT 0,
    "shiftValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "period" "ShiftPeriod" NOT NULL,
    "physiotherapistId" INTEGER NOT NULL,
    "shiftTeamId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isFirstLogin" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "physiotherapistId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysiotherapistTeam" (
    "id" SERIAL NOT NULL,
    "physiotherapistId" INTEGER NOT NULL,
    "shiftTeamId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysiotherapistTeam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Physiotherapist_email_key" ON "Physiotherapist"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Physiotherapist_crefito_key" ON "Physiotherapist"("crefito");

-- CreateIndex
CREATE UNIQUE INDEX "Physiotherapist_cpf_key" ON "Physiotherapist"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftTeam_name_key" ON "ShiftTeam"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_date_period_physiotherapistId_key" ON "Shift"("date", "period", "physiotherapistId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_physiotherapistId_key" ON "User"("physiotherapistId");

-- CreateIndex
CREATE UNIQUE INDEX "PhysiotherapistTeam_physiotherapistId_shiftTeamId_key" ON "PhysiotherapistTeam"("physiotherapistId", "shiftTeamId");

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_physiotherapistId_fkey" FOREIGN KEY ("physiotherapistId") REFERENCES "Physiotherapist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_shiftTeamId_fkey" FOREIGN KEY ("shiftTeamId") REFERENCES "ShiftTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_physiotherapistId_fkey" FOREIGN KEY ("physiotherapistId") REFERENCES "Physiotherapist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysiotherapistTeam" ADD CONSTRAINT "PhysiotherapistTeam_physiotherapistId_fkey" FOREIGN KEY ("physiotherapistId") REFERENCES "Physiotherapist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysiotherapistTeam" ADD CONSTRAINT "PhysiotherapistTeam_shiftTeamId_fkey" FOREIGN KEY ("shiftTeamId") REFERENCES "ShiftTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
