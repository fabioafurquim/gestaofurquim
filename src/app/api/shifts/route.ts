import { ShiftPeriod } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth-helpers';
import { sendInstantNotification } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';
import { createRecurringShiftSeries, type ActingUser } from '@/lib/shift-series';
import { createSingleShift, getPreferredSlot, parseShiftDate, ShiftCreationError } from '@/lib/shift-creation';

function toActingUser(user: { id: number | string; name: string; role: 'ADMIN' | 'MANAGER' | 'USER' }): ActingUser {
  return {
    id: typeof user.id === 'string' ? parseInt(user.id, 10) : user.id,
    name: user.name,
    role: user.role,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const teamId = searchParams.get('teamId');

  const { error, user: currentUser } = await requireAuth();
  if (error) return error;

  if (!teamId) {
    return NextResponse.json([]);
  }

  try {
    const whereClause: { shiftTeamId: number } = {
      shiftTeamId: parseInt(teamId, 10),
    };

    if (currentUser.role === 'USER' && currentUser.physiotherapistId) {
      const userPhysio = await prisma.physiotherapist.findUnique({
        where: { id: currentUser.physiotherapistId },
        include: { teams: { where: { isActive: true } } },
      });

      if (!userPhysio) {
        return NextResponse.json({ error: 'Fisioterapeuta do usuário não encontrado' }, { status: 403 });
      }

      const userBelongsToTeam = userPhysio.teams.some(
        (team: { shiftTeamId: number }) => team.shiftTeamId === parseInt(teamId, 10)
      );
      if (!userBelongsToTeam) {
        return NextResponse.json({ error: 'Acesso negado a esta equipe' }, { status: 403 });
      }
    }

    const shifts = await prisma.shift.findMany({
      where: whereClause,
      include: {
        physiotherapist: true,
        shiftTeam: true,
        shiftTeamSlot: true,
        shiftSeries: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            weekdays: true,
            status: true,
            shiftTeamSlotId: true,
            period: true,
          },
        },
        seriesException: {
          select: {
            type: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }, { shiftTeamSlot: { sortOrder: 'asc' } }, { physiotherapist: { name: 'asc' } }],
    });

    return NextResponse.json(shifts);
  } catch (caughtError) {
    console.error('Erro ao buscar plantões:', caughtError);
    return NextResponse.json({ error: 'Erro ao buscar plantões' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error, user: currentUser } = await requireAuth();
    if (error) return error;

    if (currentUser.role === 'USER') {
      return NextResponse.json(
        { error: 'A criação de plantões é exclusiva da gestão.' },
        { status: 403 }
      );
    }

    const data = await request.json();
    const { date, period, physiotherapistId, shiftTeamId, shiftTeamSlotId, recurrence } = data as {
      date: string;
      period: ShiftPeriod;
      physiotherapistId: number | string;
      shiftTeamId: number | string;
      shiftTeamSlotId?: number | string;
      recurrence?: {
        frequency: 'WEEKLY' | 'CUSTOM_WEEKLY';
        untilDate: string;
        weekdays?: number[];
      };
    };

    if (!date || !period || !physiotherapistId || !shiftTeamId) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    const normalizedDate = parseShiftDate(date);

    if (recurrence?.frequency === 'WEEKLY' || recurrence?.frequency === 'CUSTOM_WEEKLY') {
      if (!shiftTeamSlotId) {
        return NextResponse.json(
          { error: 'Selecione a vaga base para criar uma recorrência.' },
          { status: 400 }
        );
      }

      if (!recurrence.untilDate) {
        return NextResponse.json(
          { error: 'Informe a data final da recorrência.' },
          { status: 400 }
        );
      }

      const untilDate = parseShiftDate(recurrence.untilDate);
      if (untilDate < normalizedDate) {
        return NextResponse.json(
          { error: 'A data final da recorrência deve ser igual ou posterior à data inicial.' },
          { status: 400 }
        );
      }

      const preferredSlot = await getPreferredSlot(Number(shiftTeamSlotId));
      if (preferredSlot.shiftTeamId !== Number(shiftTeamId) || preferredSlot.period !== period) {
        return NextResponse.json(
          { error: 'A vaga base da recorrência não pertence à equipe/período selecionados.' },
          { status: 400 }
        );
      }

      const result = await createRecurringShiftSeries({
        startDate: normalizedDate,
        endDate: untilDate,
        weekdays:
          recurrence.weekdays && recurrence.weekdays.length > 0
            ? recurrence.weekdays
            : [normalizedDate.getUTCDay()],
        period,
        physiotherapistId: Number(physiotherapistId),
        shiftTeamId: Number(shiftTeamId),
        shiftTeamSlotId: Number(shiftTeamSlotId),
        actingUser: toActingUser(currentUser),
      });

      result.created.forEach((shift) => {
        sendInstantNotification(shift.id).catch((notificationError) => {
          console.error('Erro ao enviar notificação instantânea:', notificationError);
        });
      });

      if (result.created.length === 0) {
        return NextResponse.json(
          {
            error: 'Nenhum plantão da recorrência pôde ser criado.',
            summary: {
              ...result,
              mode: 'RECURRING',
            },
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          message: `Recorrência processada: ${result.created.length} plantão(ões) criado(s) e ${result.skipped.length} pulado(s).`,
          summary: {
            ...result,
            mode: 'RECURRING',
          },
        },
        { status: 201 }
      );
    }

    const shift = await createSingleShift({
      date: normalizedDate,
      period,
      physiotherapistId: Number(physiotherapistId),
      shiftTeamId: Number(shiftTeamId),
      shiftTeamSlotId: shiftTeamSlotId ? Number(shiftTeamSlotId) : undefined,
    });

    sendInstantNotification(shift.id).catch((notificationError) => {
      console.error('Erro ao enviar notificação instantânea:', notificationError);
    });

    return NextResponse.json({ message: 'Plantão criado com sucesso', shift }, { status: 201 });
  } catch (caughtError) {
    console.error('Erro ao criar plantão:', caughtError);

    if (caughtError instanceof ShiftCreationError) {
      return NextResponse.json({ error: caughtError.message }, { status: caughtError.statusCode });
    }

    return NextResponse.json({ error: 'Erro ao criar plantão' }, { status: 500 });
  }
}
