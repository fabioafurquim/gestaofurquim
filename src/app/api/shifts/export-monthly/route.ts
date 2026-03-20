import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';
import { generateMonthlyShiftPdf } from '@/lib/monthly-shift-pdf';

function sanitizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error) return error;

  const teamIdParam = request.nextUrl.searchParams.get('teamId');
  const monthParam = request.nextUrl.searchParams.get('month');

  if (!teamIdParam || !monthParam) {
    return NextResponse.json({ error: 'Parâmetros teamId e month são obrigatórios' }, { status: 400 });
  }

  const teamId = Number(teamIdParam);
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(monthParam);

  if (!Number.isInteger(teamId) || !monthMatch) {
    return NextResponse.json({ error: 'Parâmetros inválidos para exportação' }, { status: 400 });
  }

  const year = Number(monthMatch[1]);
  const month = Number(monthMatch[2]);

  if (month < 1 || month > 12) {
    return NextResponse.json({ error: 'Mês inválido para exportação' }, { status: 400 });
  }

  const team = await prisma.shiftTeam.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      shiftSlots: {
        where: { isActive: true },
        select: {
          id: true,
          period: true,
          dayType: true,
          description: true,
          sortOrder: true,
        },
        orderBy: [{ dayType: 'asc' }, { period: 'asc' }, { sortOrder: 'asc' }],
      },
    },
  });

  if (!team) {
    return NextResponse.json({ error: 'Equipe não encontrada' }, { status: 404 });
  }

  if (user?.role === 'USER' && user.physiotherapistId) {
    const userPhysio = await prisma.physiotherapist.findUnique({
      where: { id: Number(user.physiotherapistId) },
      include: { teams: true },
    });

    if (!userPhysio) {
      return NextResponse.json({ error: 'Fisioterapeuta do usuário não encontrado' }, { status: 403 });
    }

    const belongsToTeam = userPhysio.teams.some((item) => item.shiftTeamId === teamId);
    if (!belongsToTeam) {
      return NextResponse.json({ error: 'Acesso negado a esta equipe' }, { status: 403 });
    }
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const nextMonthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const holidayStart = new Date(year, month - 1, 1);
  const nextHolidayStart = new Date(year, month, 1);

  const [shifts, holidays] = await Promise.all([
    prisma.shift.findMany({
      where: {
        shiftTeamId: teamId,
        date: {
          gte: monthStart,
          lt: nextMonthStart,
        },
      },
      select: {
        id: true,
        date: true,
        period: true,
        shiftTeamSlot: {
          select: {
            id: true,
            description: true,
            sortOrder: true,
            dayType: true,
            period: true,
          },
        },
        physiotherapist: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        { date: 'asc' },
        { shiftTeamSlot: { sortOrder: 'asc' } },
        { physiotherapist: { name: 'asc' } },
      ],
    }),
    prisma.holiday.findMany({
      where: {
        date: {
          gte: holidayStart,
          lt: nextHolidayStart,
        },
      },
      select: {
        date: true,
      },
    }),
  ]);

  const pdfBytes = await generateMonthlyShiftPdf({
    team,
    year,
    month,
    shifts,
    holidayDates: holidays.map((holiday) => {
      return [
        holiday.date.getFullYear(),
        String(holiday.date.getMonth() + 1).padStart(2, '0'),
        String(holiday.date.getDate()).padStart(2, '0'),
      ].join('-');
    }),
  });

  const monthLabel = `${year}-${String(month).padStart(2, '0')}`;
  const fileName = `escala-${sanitizeFileName(team.name)}-${monthLabel}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
