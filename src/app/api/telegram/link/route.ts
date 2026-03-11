import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { physiotherapistId, chatId, username } = body;

    if (!physiotherapistId || !chatId) {
      return NextResponse.json(
        { error: 'physiotherapistId e chatId são obrigatórios' },
        { status: 400 }
      );
    }

    const physio = await prisma.physiotherapist.findUnique({
      where: { id: Number(physiotherapistId) },
    });

    if (!physio) {
      return NextResponse.json(
        { error: 'Fisioterapeuta não encontrado' },
        { status: 404 }
      );
    }

    const updated = await prisma.physiotherapist.update({
      where: { id: Number(physiotherapistId) },
      data: {
        telegramChatId: chatId,
        telegramUsername: username || null,
      },
    });

    return NextResponse.json({
      message: 'Telegram vinculado com sucesso',
      physiotherapist: {
        id: updated.id,
        name: updated.name,
        telegramChatId: updated.telegramChatId,
        telegramUsername: updated.telegramUsername,
      },
    });
  } catch (error) {
    console.error('Erro ao vincular Telegram:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const physiotherapistId = searchParams.get('physiotherapistId');

    if (!physiotherapistId) {
      return NextResponse.json(
        { error: 'physiotherapistId é obrigatório' },
        { status: 400 }
      );
    }

    await prisma.physiotherapist.update({
      where: { id: Number(physiotherapistId) },
      data: {
        telegramChatId: null,
        telegramUsername: null,
      },
    });

    return NextResponse.json({ message: 'Telegram desvinculado com sucesso' });
  } catch (error) {
    console.error('Erro ao desvincular Telegram:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
