-- AlterTable
ALTER TABLE "public"."Physiotherapist" ADD COLUMN     "telegramChatId" TEXT,
ADD COLUMN     "telegramUsername" TEXT;

-- CreateTable
CREATE TABLE "public"."NotificationSettings" (
    "id" SERIAL NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyReminderTime" TEXT NOT NULL DEFAULT '18:00',
    "instantNotificationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyReminderTemplate" TEXT NOT NULL DEFAULT '🏥 Lembrete de Plantão

Olá, {{name}}! 👋

Você está escalado para amanhã:

📅 Data: {{date}}
⏰ Período: {{period}}
🏢 Equipe: {{team}}

Boa sorte! 💪',
    "instantNotificationTemplate" TEXT NOT NULL DEFAULT '✅ Novo Plantão Cadastrado

Olá, {{name}}!

Você foi escalado para:

📅 Data: {{date}}
⏰ Período: {{period}}
🏢 Equipe: {{team}}

Confira no sistema!',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationLog" (
    "id" SERIAL NOT NULL,
    "physiotherapistId" INTEGER NOT NULL,
    "shiftId" INTEGER,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'telegram',
    "messageType" TEXT NOT NULL,
    "errorMessage" TEXT,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationLog_physiotherapistId_sentAt_idx" ON "public"."NotificationLog"("physiotherapistId", "sentAt");

-- CreateIndex
CREATE INDEX "NotificationLog_shiftId_idx" ON "public"."NotificationLog"("shiftId");

-- AddForeignKey
ALTER TABLE "public"."NotificationLog" ADD CONSTRAINT "NotificationLog_physiotherapistId_fkey" FOREIGN KEY ("physiotherapistId") REFERENCES "public"."Physiotherapist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationLog" ADD CONSTRAINT "NotificationLog_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "public"."Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
