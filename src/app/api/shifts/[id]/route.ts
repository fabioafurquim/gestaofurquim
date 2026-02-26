import { ShiftPeriod } from '@prisma/client';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';

// PUT (Update) a shift
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await context.params;
  const id = parseInt(idStr, 10);
  try {
    // Verificar autenticação
    const { error, user: currentUser } = await requireAuth();
    if (error) return error;

    const data = await request.json();
    const { period, physiotherapistId, date } = data as { period: ShiftPeriod; physiotherapistId: number | string; date?: string };

    console.log('=== PUT /api/shifts/[id] ===');
    console.log('ID:', id);
    console.log('Dados recebidos:', { period, physiotherapistId, date });

    if (!period || !physiotherapistId) {
      return NextResponse.json({ error: 'Período e Fisioterapeuta são obrigatórios' }, { status: 400 });
    }

    const existing = await prisma.shift.findUnique({ where: { id }, select: { date: true, physiotherapistId: true, shiftTeamId: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Plantão não encontrado' }, { status: 404 });
    }
    
    console.log('Plantão existente:', existing);

    // Validar se usuário USER só pode editar seus próprios plantões
    if (currentUser.role === 'USER') {
      if (!currentUser.physiotherapistId || existing.physiotherapistId !== currentUser.physiotherapistId) {
        return NextResponse.json({ error: 'Você só pode editar seus próprios plantões' }, { status: 403 });
      }
      
      // Usuário USER só pode alterar para si mesmo
      if (Number(physiotherapistId) !== currentUser.physiotherapistId) {
        return NextResponse.json({ error: 'Você só pode atribuir plantões para si mesmo' }, { status: 403 });
      }
    }

    // Determinar a data a ser usada (nova ou existente)
    // Se a data vier como string YYYY-MM-DD, precisamos criar a data corretamente
    let targetDate: Date;
    if (date) {
      // Criar data no formato UTC para evitar problemas de timezone
      const [year, month, day] = date.split('-').map(Number);
      targetDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    } else {
      targetDate = existing.date;
    }
    
    console.log('Data alvo:', targetDate, 'Data original:', date);

    // Checar duplicidade na nova combinação
    const duplicate = await prisma.shift.findFirst({
      where: {
        id: { not: id },
        physiotherapistId: Number(physiotherapistId),
        date: targetDate,
        period: period,
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: 'Já existe um plantão para este fisioterapeuta nesta data e período.' }, { status: 409 });
    }

    const updatedShift = await prisma.shift.update({
      where: { id },
      data: {
        period,
        date: targetDate,
        physiotherapist: { connect: { id: Number(physiotherapistId) } },
      },
    });
    
    console.log('Plantão atualizado com sucesso:', updatedShift);
    
    return NextResponse.json({ message: 'Plantão atualizado com sucesso', shift: updatedShift });
  } catch (error) {
    console.error(`Erro ao atualizar plantão ${id}:`, error);
    return NextResponse.json({ error: 'Erro ao atualizar plantão' }, { status: 500 });
  }
}

// DELETE a shift
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await context.params;
  const id = parseInt(idStr, 10);

  try {
    // Verificar autenticação
    const { error, user: currentUser } = await requireAuth();
    if (error) return error;

    // Verificar se o plantão existe e obter informações
    const existingShift = await prisma.shift.findUnique({
      where: { id },
      select: { id: true, physiotherapistId: true },
    });

    if (!existingShift) {
      return NextResponse.json({ error: 'Plantão não encontrado' }, { status: 404 });
    }

    // Validar se usuário USER só pode excluir seus próprios plantões
    if (currentUser.role === 'USER') {
      if (!currentUser.physiotherapistId || existingShift.physiotherapistId !== currentUser.physiotherapistId) {
        return NextResponse.json({ error: 'Você só pode excluir seus próprios plantões' }, { status: 403 });
      }
    }

    await prisma.shift.delete({
      where: { id },
    });
    return NextResponse.json({ message: 'Plantão excluído com sucesso' }, { status: 200 });
  } catch (error) {
    console.error(`Erro ao excluir plantão ${id}:`, error);
    return NextResponse.json({ error: 'Erro ao excluir plantão' }, { status: 500 });
  }
}