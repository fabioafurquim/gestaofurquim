import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/auth';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { clearTwoFactorCookies } from '@/lib/two-factor';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
    newPassword: z.string().min(6, 'Nova senha deve ter pelo menos 6 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = changePasswordSchema.parse(body);
    const userId =
      typeof session.user.id === 'string' ? parseInt(session.user.id, 10) : session.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    const isCurrentPasswordValid = await verifyPassword(validatedData.currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 400 });
    }

    const hashedNewPassword = await hashPassword(validatedData.newPassword);
    const updatedUser = await prisma.$transaction(async (tx) => {
      const userRecord = await tx.user.update({
        where: { id: userId },
        data: {
          password: hashedNewPassword,
          isFirstLogin: false,
          mustChangePassword: false,
        },
      });

      await tx.trustedTwoFactorDevice.deleteMany({
        where: { userId },
      });

      return userRecord;
    });

    const response = NextResponse.json({
      message: 'Senha alterada com sucesso.',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        physiotherapistId: updatedUser.physiotherapistId,
        isFirstLogin: updatedUser.isFirstLogin,
        mustChangePassword: updatedUser.mustChangePassword,
      },
    });

    clearTwoFactorCookies(response, { clearTrustedDevice: true });

    return response;
  } catch (error) {
    console.error('Erro ao alterar senha:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? 'Dados inválidos.' },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
