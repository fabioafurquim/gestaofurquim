import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';
import {
  normalizePhysiotherapistTeamAssignments,
  syncPhysiotherapistTeamsByDiff,
  PhysiotherapistTeamSyncError,
} from '@/lib/physiotherapist-team-sync';
import { countFutureShifts } from '@/lib/validations';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await context.params;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
  }
  try {
    const physiotherapist = await prisma.physiotherapist.findUnique({
      where: { id },
      include: {
        teams: {
          where: { isActive: true },
          include: {
            shiftTeam: true
          }
        }
      }
    });
    if (!physiotherapist) {
      return NextResponse.json({ error: 'Fisioterapeuta não encontrado' }, { status: 404 });
    }
    return NextResponse.json(physiotherapist);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar fisioterapeuta' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error, user: currentUser } = await requireAuth();
  if (error) return error;

  const { id: idStr } = await context.params;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
  }
  const body = await request.json();

  const {
    name,
    email,
    phone,
    crefito,
    cpf,
    rg,
    birthDate,
    address,
    startDate,
    exitDate,
    contractType,
    teamIds,
    hourValue,
    additionalValue,
    userType,
    status,
    // Novos campos bancários
    banco,
    agencia,
    conta,
    tipoPix,
    chavePix,
    // Novos campos para PJ
    nomeEmpresa,
    cnpjEmpresa,
    enderecoEmpresa,
    // Campos Telegram
    telegramChatId,
    telegramUsername,
  } = body;

  const parsedCurrentUserId = typeof currentUser.id === 'string' ? parseInt(currentUser.id, 10) : currentUser.id;
  const createdByUserId = Number.isFinite(parsedCurrentUserId) ? parsedCurrentUserId : null;

  const updateData: any = {
    ...(name !== undefined ? { name } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(phone !== undefined ? { phone: phone ?? null } : {}),
    ...(crefito !== undefined ? { crefito } : {}),
    ...(cpf !== undefined ? { cpf } : {}),
    ...(rg !== undefined ? { rg: rg ?? null } : {}),
    ...(birthDate !== undefined ? { birthDate: birthDate ? new Date(birthDate) : null } : {}),
    ...(address !== undefined ? { address: address ?? null } : {}),
    ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
    ...(exitDate !== undefined ? { exitDate: exitDate ? new Date(exitDate) : null } : {}),
    ...(contractType !== undefined ? { contractType } : {}),
    ...(hourValue !== undefined ? { hourValue: `${hourValue}` !== '' ? Number(hourValue) : 0 } : {}),
    ...(additionalValue !== undefined ? { additionalValue: `${additionalValue}` !== '' ? Number(additionalValue) : 0 } : {}),
    ...(userType !== undefined ? { userType } : {}),
    ...(status !== undefined ? { status } : {}),
    // Novos campos bancários (sempre incluir para garantir compatibilidade)
    banco: banco ?? null,
    agencia: agencia ?? null,
    conta: conta ?? null,
    tipoPix: tipoPix ?? null,
    chavePix: chavePix ?? null,
    // Novos campos para PJ (obrigatórios apenas se contractType for 'PJ')
    nomeEmpresa: contractType === 'PJ' ? (nomeEmpresa ?? null) : null,
    cnpjEmpresa: contractType === 'PJ' ? (cnpjEmpresa ?? null) : null,
    enderecoEmpresa: contractType === 'PJ' ? (enderecoEmpresa ?? null) : null,
    // Campos Telegram
    ...(telegramChatId !== undefined ? { telegramChatId: telegramChatId || null } : {}),
    ...(telegramUsername !== undefined ? { telegramUsername: telegramUsername || null } : {}),
  };

  try {
    const teamAssignments = teamIds !== undefined ? normalizePhysiotherapistTeamAssignments(teamIds) : undefined;

    // Verifica se o fisioterapeuta existe
    const existing = await prisma.physiotherapist.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({
        error: 'Fisioterapeuta não encontrado.',
      }, { status: 404 });
    }

    // Verifica se CPF já existe em outro fisioterapeuta
    if (cpf && cpf !== existing.cpf) {
      const existingCpf = await prisma.physiotherapist.findUnique({
        where: { cpf },
      });
      if (existingCpf) {
        return NextResponse.json({
          error: 'CPF já cadastrado. Este CPF já está em uso por outro fisioterapeuta.',
        }, { status: 400 });
      }
    }

    // Verifica se CREFITO já existe em outro fisioterapeuta
    if (crefito && crefito !== existing.crefito) {
      const existingCrefito = await prisma.physiotherapist.findUnique({
        where: { crefito },
      });
      if (existingCrefito) {
        return NextResponse.json({
          error: 'CREFITO já cadastrado. Este número de registro já está em uso por outro fisioterapeuta.',
        }, { status: 400 });
      }
    }

    // Verifica se Email já existe em outro fisioterapeuta
    if (email && email !== existing.email) {
      const existingEmail = await prisma.physiotherapist.findUnique({
        where: { email },
      });
      if (existingEmail) {
        return NextResponse.json({
          error: 'Email já cadastrado. Este email já está em uso por outro fisioterapeuta.',
        }, { status: 400 });
      }
    }

    const updatedPhysiotherapist = await prisma.$transaction(async (tx) => {
      const updated = await tx.physiotherapist.update({
        where: { id },
        data: updateData,
      });

      if (teamAssignments) {
        await syncPhysiotherapistTeamsByDiff(tx, id, teamAssignments, createdByUserId);
      }

      return tx.physiotherapist.findUnique({
        where: { id: updated.id },
        include: {
          teams: {
            where: { isActive: true },
            include: {
              shiftTeam: true,
            },
          },
        },
      });
    });

    if (!updatedPhysiotherapist) {
      return NextResponse.json({ error: 'Fisioterapeuta não encontrado.' }, { status: 404 });
    }

    return NextResponse.json(updatedPhysiotherapist);
  } catch (error: any) {
    console.error('Erro ao atualizar fisioterapeuta:', error);

    if (error instanceof PhysiotherapistTeamSyncError) {
      return NextResponse.json({
        error: error.message,
        details: error.details,
      }, { status: error.statusCode });
    }
    
    // Tratamento específico de erros do Prisma
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0];
      const fieldNames: Record<string, string> = {
        cpf: 'CPF',
        crefito: 'CREFITO',
        email: 'Email',
      };
      const fieldName = fieldNames[field] || 'Campo';
      return NextResponse.json({
        error: `${fieldName} já cadastrado. Este ${fieldName.toLowerCase()} já está em uso por outro fisioterapeuta.`,
      }, { status: 400 });
    }

    if (error.code === 'P2003') {
      return NextResponse.json({
        error: 'Erro de referência: uma ou mais equipes selecionadas não existem.',
      }, { status: 400 });
    }

    if (error.code === 'P2025') {
      return NextResponse.json({
        error: 'Fisioterapeuta não encontrado.',
      }, { status: 404 });
    }

    return NextResponse.json({
      error: 'Erro ao atualizar fisioterapeuta. Verifique os dados e tente novamente.',
    }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id: idStr } = await context.params;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
  }
  try {
    // Verificar se o fisioterapeuta existe
    const existingPhysiotherapist = await prisma.physiotherapist.findUnique({
      where: { id },
    });

    if (!existingPhysiotherapist) {
      return NextResponse.json({ error: 'Fisioterapeuta não encontrado' }, { status: 404 });
    }

    // VALIDAÇÃO CRÍTICA: Verificar plantões futuros
    const futureShiftsInfo = await countFutureShifts(id);

    if (futureShiftsInfo.total > 0) {
      return NextResponse.json({
        error: 'Não é possível excluir fisioterapeuta com plantões futuros',
        message: `Este fisioterapeuta possui ${futureShiftsInfo.total} plantão(ões) futuro(s) agendado(s). Para manter a integridade dos dados, você deve:`,
        suggestions: [
          '1. Remover ou realocar todos os plantões futuros primeiro, OU',
          '2. Inativar o fisioterapeuta ao invés de excluir (altere o status para INACTIVE)'
        ],
        futureShiftsCount: futureShiftsInfo.total,
        shiftsByTeam: futureShiftsInfo.byTeam,
        shifts: futureShiftsInfo.shifts,
      }, { status: 400 });
    }

    // Se não houver plantões futuros, permitir exclusão
    // Excluir o usuário relacionado se existir
    const relatedUser = await prisma.user.findFirst({
      where: { physiotherapistId: id },
    });
    
    if (relatedUser) {
      await prisma.user.delete({
        where: { id: relatedUser.id },
      });
    }

    // Excluir o fisioterapeuta (plantões passados serão mantidos por integridade histórica)
    await prisma.physiotherapist.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Fisioterapeuta excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir fisioterapeuta:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
