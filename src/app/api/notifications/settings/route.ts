import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    let settings = await prisma.notificationSettings.findFirst();

    if (!settings) {
      settings = await prisma.notificationSettings.create({
        data: {},
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const {
      enabled,
      dailyReminderEnabled,
      dailyReminderTime,
      instantNotificationEnabled,
      shiftDeletionTelegramEnabled,
      dailyReminderTemplate,
      instantNotificationTemplate,
    } = body;

    let settings = await prisma.notificationSettings.findFirst();

    if (!settings) {
      settings = await prisma.notificationSettings.create({
        data: {
          enabled,
          dailyReminderEnabled,
          dailyReminderTime,
          instantNotificationEnabled,
          shiftDeletionTelegramEnabled,
          dailyReminderTemplate,
          instantNotificationTemplate,
        },
      });
    } else {
      settings = await prisma.notificationSettings.update({
        where: { id: settings.id },
        data: {
          enabled,
          dailyReminderEnabled,
          dailyReminderTime,
          instantNotificationEnabled,
          shiftDeletionTelegramEnabled,
          dailyReminderTemplate,
          instantNotificationTemplate,
        },
      });
    }

    return NextResponse.json({
      message: 'Configurações atualizadas com sucesso',
      settings,
    });
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
