import { ShiftPeriod } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth-helpers';
import { isHoliday, isWeekend } from '@/lib/date-utils';
import { sendInstantNotification } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';
import { getSlotDayTypeForDate } from '@/lib/shift-team-slots';

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
        include: { teams: true },
      });

      if (!userPhysio) {
        return NextResponse.json({ error: 'Fisioterapeuta do usuário não encontrado' }, { status: 403 });
      }

      const userBelongsToTeam = userPhysio.teams.some((team) => team.shiftTeamId === parseInt(teamId, 10));
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
      },
      orderBy: [{ date: 'asc' }, { shiftTeamSlot: { sortOrder: 'asc' } }, { physiotherapist: { name: 'asc' } }],
    });

    return NextResponse.json(shifts);
  } catch (error) {
    console.error('Erro ao buscar plantões:', error);
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
    const { date, period, physiotherapistId, shiftTeamId, shiftTeamSlotId } = data as {
      date: string;
      period: ShiftPeriod;
      physiotherapistId: number | string;
      shiftTeamId: number | string;
      shiftTeamSlotId?: number | string;
    };

    if (!date || !period || !physiotherapistId || !shiftTeamId) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    const physio = await prisma.physiotherapist.findUnique({
      where: { id: Number(physiotherapistId) },
      include: { teams: true },
    });

    if (!physio) {
      return NextResponse.json({ error: 'Fisioterapeuta inválido' }, { status: 400 });
    }

    const [year, month, day] = date.split('-').map(Number);
    const zonedDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

    if (physio.status === 'INACTIVE' || (physio.exitDate && physio.exitDate <= zonedDate)) {
      return NextResponse.json({ error: 'Fisioterapeuta indisponível (inativo ou desligado para a data)' }, { status: 400 });
    }

    const belongsToTeam = physio.teams.some((team) => team.shiftTeamId === Number(shiftTeamId));
    if (!belongsToTeam) {
      return NextResponse.json({ error: 'Fisioterapeuta não pertence à equipe selecionada' }, { status: 400 });
    }

    const isWeekendOrHoliday = isWeekend(zonedDate) || (await isHoliday(zonedDate));
    const slotDayType = getSlotDayTypeForDate(zonedDate, isWeekendOrHoliday);

    const shiftTeam = await prisma.shiftTeam.findUnique({
      where: { id: Number(shiftTeamId) },
      include: {
        shiftSlots: {
          where: {
            dayType: slotDayType,
            period,
            isActive: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!shiftTeam) {
      return NextResponse.json({ error: 'Equipe não encontrada' }, { status: 400 });
    }

    if (shiftTeam.shiftSlots.length === 0) {
      return NextResponse.json({ error: 'Não há vagas configuradas para este período na equipe.' }, { status: 400 });
    }

    const occupiedSlotIds = await prisma.shift.findMany({
      where: {
        date: zonedDate,
        period,
        shiftTeamId: Number(shiftTeamId),
      },
      select: {
        shiftTeamSlotId: true,
      },
    });

    const occupiedSet = new Set(occupiedSlotIds.map((shift) => shift.shiftTeamSlotId));
    let targetSlotId = shiftTeamSlotId ? Number(shiftTeamSlotId) : undefined;

    if (targetSlotId) {
      const slot = shiftTeam.shiftSlots.find((item) => item.id === targetSlotId);
      if (!slot) {
        return NextResponse.json({ error: 'A vaga selecionada não pertence a este período/equipe.' }, { status: 400 });
      }

      if (occupiedSet.has(targetSlotId)) {
        return NextResponse.json({ error: 'Esta vaga já está ocupada na data selecionada.' }, { status: 409 });
      }
    } else {
      const firstAvailableSlot = shiftTeam.shiftSlots.find((slot) => !occupiedSet.has(slot.id));
      if (!firstAvailableSlot) {
        return NextResponse.json({ error: 'Não há mais vagas disponíveis para este período nesta data.' }, { status: 400 });
      }
      targetSlotId = firstAvailableSlot.id;
    }

    const duplicate = await prisma.shift.findFirst({
      where: {
        physiotherapistId: Number(physiotherapistId),
        date: zonedDate,
        period,
      },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: 'Já existe um plantão para este fisioterapeuta nesta data e período.' },
        { status: 409 }
      );
    }

    const shift = await prisma.shift.create({
      data: {
        date: zonedDate,
        period,
        physiotherapist: { connect: { id: Number(physiotherapistId) } },
        shiftTeam: { connect: { id: Number(shiftTeamId) } },
        shiftTeamSlot: { connect: { id: targetSlotId } },
      },
    });

    sendInstantNotification(shift.id).catch((notificationError) => {
      console.error('Erro ao enviar notificação instantânea:', notificationError);
    });

    return NextResponse.json({ message: 'Plantão criado com sucesso', shift }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar plantão:', error);
    return NextResponse.json({ error: 'Erro ao criar plantão' }, { status: 500 });
  }
}
