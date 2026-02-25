import { ShiftPeriod } from '@prisma/client';
import { NextResponse, NextRequest } from 'next/server';
import { toZonedTime } from 'date-fns-tz';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { isWeekend, isHoliday } from '@/lib/date-utils';

// GET all shifts for a specific team
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const teamId = searchParams.get('teamId');

  // Verificar autenticação
  const { error, user: currentUser } = await requireAuth();
  if (error) return error;

  if (!teamId) {
    return NextResponse.json([]);
  }

  try {
    // Construir filtros baseados no role do usuário
    const whereClause: any = {
      shiftTeamId: parseInt(teamId),
    };

    // Se o usuário não é ADMIN, só pode ver plantões das suas próprias equipes
    if (currentUser.role === 'USER' && currentUser.physiotherapistId) {
      const userPhysio = await prisma.physiotherapist.findUnique({
        where: { id: currentUser.physiotherapistId },
        include: { teams: true }
      });
      
      if (!userPhysio) {
        return NextResponse.json({ error: 'Fisioterapeuta do usuário não encontrado' }, { status: 403 });
      }
      
      const userBelongsToTeam = userPhysio.teams.some(team => team.shiftTeamId === parseInt(teamId));
      if (!userBelongsToTeam) {
        return NextResponse.json({ error: 'Acesso negado a esta equipe' }, { status: 403 });
      }
    }

    const shifts = await prisma.shift.findMany({
      where: whereClause,
      include: { physiotherapist: true, shiftTeam: true },
      orderBy: { date: 'asc' },
    });
    return NextResponse.json(shifts);
  } catch (error) {
    console.error("Erro ao buscar plantões:", error);
    return NextResponse.json({ error: 'Erro ao buscar plantões' }, { status: 500 });
  }
}

// POST a new shift
export async function POST(request: Request) {
  try {
    // Verificar autenticação
    const { error, user: currentUser } = await requireAuth();
    if (error) return error;

    const data = await request.json();
    const { date, period, physiotherapistId, shiftTeamId } = data as {
      date: string;
      period: ShiftPeriod;
      physiotherapistId: number | string;
      shiftTeamId: number | string;
    };

    if (!date || !period || !physiotherapistId || !shiftTeamId) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    // Validar se usuário USER só pode criar plantões para si mesmo
    if (currentUser.role === 'USER') {
      if (!currentUser.physiotherapistId || currentUser.physiotherapistId !== Number(physiotherapistId)) {
        return NextResponse.json({ error: 'Você só pode criar plantões para si mesmo' }, { status: 403 });
      }
    }

    const physio = await prisma.physiotherapist.findUnique({ 
      where: { id: Number(physiotherapistId) },
      include: { teams: true }
    });
    if (!physio) {
      return NextResponse.json({ error: 'Fisioterapeuta inválido' }, { status: 400 });
    }

    const timeZone = 'America/Sao_Paulo';
    const zonedDate = toZonedTime(date, timeZone);

    if (physio.status === 'INACTIVE' || (physio.exitDate && physio.exitDate <= zonedDate)) {
      return NextResponse.json({ error: 'Fisioterapeuta indisponível (inativo ou desligado para a data)' }, { status: 400 });
    }

    // Verificar se o fisioterapeuta pertence à equipe selecionada (relação many-to-many)
    const belongsToTeam = physio.teams.some(team => team.shiftTeamId === Number(shiftTeamId));
    if (!belongsToTeam) {
      return NextResponse.json({ error: 'Fisioterapeuta não pertence à equipe selecionada' }, { status: 400 });
    }

    // Buscar dados da equipe para validar slots disponíveis
    const shiftTeam = await prisma.shiftTeam.findUnique({
      where: { id: Number(shiftTeamId) }
    });
    if (!shiftTeam) {
      return NextResponse.json({ error: 'Equipe não encontrada' }, { status: 400 });
    }

    // Verificar se é fim de semana ou feriado para usar os slots corretos
    const isWeekendOrHoliday = isWeekend(zonedDate) || await isHoliday(zonedDate);
    
    // Definir os slots máximos baseado no tipo de dia e período
    let maxSlots = 0;
    if (isWeekendOrHoliday) {
      // Usar slots de fim de semana/feriados
      switch (period) {
        case 'MORNING':
          maxSlots = shiftTeam.weekendMorningSlots;
          break;
        case 'INTERMEDIATE':
          maxSlots = shiftTeam.weekendIntermediateSlots;
          break;
        case 'AFTERNOON':
          maxSlots = shiftTeam.weekendAfternoonSlots;
          break;
        case 'NIGHT':
          maxSlots = shiftTeam.weekendNightSlots;
          break;
      }
    } else {
      // Usar slots de dias úteis
      switch (period) {
        case 'MORNING':
          maxSlots = shiftTeam.weekdayMorningSlots;
          break;
        case 'INTERMEDIATE':
          maxSlots = shiftTeam.weekdayIntermediateSlots;
          break;
        case 'AFTERNOON':
          maxSlots = shiftTeam.weekdayAfternoonSlots;
          break;
        case 'NIGHT':
          maxSlots = shiftTeam.weekdayNightSlots;
          break;
      }
    }

    // Verificar se ainda há slots disponíveis para este período na data
    const existingShiftsCount = await prisma.shift.count({
      where: {
        date: zonedDate,
        period: period,
        shiftTeamId: Number(shiftTeamId)
      }
    });

    if (existingShiftsCount >= maxSlots) {
      const dayType = isWeekendOrHoliday ? 'fins de semana/feriados' : 'dias úteis';
      return NextResponse.json({ 
        error: `Não há mais vagas disponíveis para o período ${period.toLowerCase()} nesta data. Limite para ${dayType}: ${maxSlots} plantão(ões)` 
      }, { status: 400 });
    }

    // Validar se usuário USER só pode criar plantões nas suas próprias equipes
    if (currentUser.role === 'USER' && currentUser.physiotherapistId) {
      const userPhysio = await prisma.physiotherapist.findUnique({
        where: { id: currentUser.physiotherapistId },
        include: { teams: true }
      });
      
      if (!userPhysio) {
        return NextResponse.json({ error: 'Fisioterapeuta do usuário não encontrado' }, { status: 403 });
      }
      
      const userBelongsToTeam = userPhysio.teams.some(team => team.shiftTeamId === Number(shiftTeamId));
      if (!userBelongsToTeam) {
        return NextResponse.json({ error: 'Você só pode criar plantões nas suas próprias equipes' }, { status: 403 });
      }
    }

    // Checagem de duplicidade: mesma data e período para o mesmo fisioterapeuta
    const duplicate = await prisma.shift.findFirst({
      where: {
        physiotherapistId: Number(physiotherapistId),
        date: zonedDate,
        period: period,
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: 'Já existe um plantão para este fisioterapeuta nesta data e período.' }, { status: 409 });
    }

    const shift = await prisma.shift.create({
      data: {
        date: zonedDate,
        period,
        physiotherapist: { connect: { id: Number(physiotherapistId) } },
        shiftTeam: { connect: { id: Number(shiftTeamId) } },
      },
    });
    return NextResponse.json({ message: 'Plantão criado com sucesso', shift }, { status: 201 });
  } catch (error: any) {
    console.error("Erro ao criar plantão:", error);
    return NextResponse.json({ error: 'Erro ao criar plantão' }, { status: 500 });
  }
}
