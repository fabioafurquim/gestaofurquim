import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await context.params;
  const id = parseInt(idStr, 10);
  try {
    const physiotherapist = await prisma.physiotherapist.findUnique({
      where: { id },
      include: {
        teams: {
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
  const { error } = await requireAuth();
  if (error) return error;

  const { id: idStr } = await context.params;
  const id = parseInt(idStr, 10);
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
  } = body;

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
  };

  try {
    // Primeiro, atualizar os dados básicos do fisioterapeuta
    const updatedPhysiotherapist = await prisma.physiotherapist.update({
      where: { id },
      data: updateData,
    });

    // Se teamIds foi fornecido, atualizar as relações com equipes
    if (teamIds !== undefined && Array.isArray(teamIds)) {
      // Remover todas as relações existentes
      await prisma.physiotherapistTeam.deleteMany({
        where: { physiotherapistId: id }
      });

      // Criar novas relações
      if (teamIds.length > 0) {
        await prisma.physiotherapistTeam.createMany({
          data: teamIds.map((teamId: number) => ({
            physiotherapistId: id,
            shiftTeamId: teamId
          }))
        });
      }
    }
    return NextResponse.json(updatedPhysiotherapist);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar fisioterapeuta' }, { status: 500 });
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
  try {
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar se o fisioterapeuta existe
    const existingPhysiotherapist = await prisma.physiotherapist.findUnique({
      where: { id },
    });

    if (!existingPhysiotherapist) {
      return NextResponse.json({ error: 'Fisioterapeuta não encontrado' }, { status: 404 });
    }

    // Excluir todos os plantões relacionados primeiro (devido às foreign keys)
    await prisma.shift.deleteMany({
      where: { physiotherapistId: id },
    });

    // Excluir o usuário relacionado se existir
    const relatedUser = await prisma.user.findFirst({
      where: { physiotherapistId: id },
    });
    
    if (relatedUser) {
      await prisma.user.delete({
        where: { id: relatedUser.id },
      });
    }

    // Excluir o fisioterapeuta
    await prisma.physiotherapist.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Fisioterapeuta excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir fisioterapeuta:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
