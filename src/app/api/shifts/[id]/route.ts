import { ShiftPeriod } from '@prisma/client';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth-helpers';
import { deleteShiftWithScope, type ActingUser, type ShiftSeriesScope, updateShiftWithScope } from '@/lib/shift-series';
import { prisma } from '@/lib/prisma';
import { ShiftCreationError } from '@/lib/shift-creation';

function parseApiDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function toActingUser(user: { id: number | string; name: string; role: 'ADMIN' | 'MANAGER' | 'USER' }): ActingUser {
  return {
    id: typeof user.id === 'string' ? parseInt(user.id, 10) : user.id,
    name: user.name,
    role: user.role,
  };
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await context.params;
  const id = parseInt(idStr, 10);

  try {
    const { error, user: currentUser } = await requireAuth();
    if (error) return error;

    if (currentUser.role === 'USER') {
      return NextResponse.json(
        { error: 'A alteração de plantões é exclusiva da gestão.' },
        { status: 403 }
      );
    }

    const data = await request.json();
    const { period, physiotherapistId, date, shiftTeamSlotId, scope, recurrence } = data as {
      period: ShiftPeriod;
      physiotherapistId: number | string;
      date?: string;
      shiftTeamSlotId?: number | string;
      scope?: ShiftSeriesScope;
      recurrence?: {
        endDate?: string;
        weekdays?: number[];
      };
    };

    if (!period || !physiotherapistId) {
      return NextResponse.json({ error: 'Período e fisioterapeuta são obrigatórios' }, { status: 400 });
    }

    const result = await updateShiftWithScope({
      shiftId: id,
      scope: scope ?? 'THIS',
      physiotherapistId: Number(physiotherapistId),
      period,
      shiftTeamSlotId: shiftTeamSlotId ? Number(shiftTeamSlotId) : undefined,
      date: parseApiDate(date),
      recurrence: recurrence
        ? {
            endDate: parseApiDate(recurrence.endDate),
            weekdays: recurrence.weekdays,
          }
        : undefined,
      actingUser: toActingUser(currentUser),
    });

    if (result.mode === 'THIS') {
      const shift = await prisma.shift.findUnique({
        where: { id },
      });

      return NextResponse.json({
        message: 'Plantão atualizado com sucesso',
        shift,
        summary: result,
      });
    }

    return NextResponse.json({
      message: 'Série de plantões atualizada com sucesso',
      summary: result,
    });
  } catch (error) {
    console.error(`Erro ao atualizar plantão ${id}:`, error);

    if (error instanceof ShiftCreationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: 'Erro ao atualizar plantão' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await context.params;
  const id = parseInt(idStr, 10);

  try {
    const { error, user: currentUser } = await requireAuth();
    if (error) return error;

    if (currentUser.role === 'USER') {
      return NextResponse.json(
        { error: 'A exclusão de plantões é exclusiva da gestão.' },
        { status: 403 }
      );
    }

    const searchParams = new URL(request.url).searchParams;
    const scope = (searchParams.get('scope') as ShiftSeriesScope | null) ?? 'THIS';

    const result = await deleteShiftWithScope({
      shiftId: id,
      scope,
      actingUser: toActingUser(currentUser),
    });

    return NextResponse.json({
      message:
        result.mode === 'THIS'
          ? 'Plantão excluído com sucesso'
          : 'Série de plantões atualizada com sucesso',
      summary: result,
    });
  } catch (error) {
    console.error(`Erro ao excluir plantão ${id}:`, error);

    if (error instanceof ShiftCreationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: 'Erro ao excluir plantão' }, { status: 500 });
  }
}
