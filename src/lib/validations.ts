import { prisma } from './prisma';
import { ShiftPeriod } from '@prisma/client';

/**
 * Retorna o valor do plantão vigente na data especificada
 * Busca no histórico de preços o valor válido para aquela data
 */
export async function getShiftValueForDate(
  shiftTeamId: number,
  date: Date
): Promise<number> {
  // Buscar o valor mais recente que estava vigente na data
  const priceHistory = await prisma.shiftTeamPriceHistory.findFirst({
    where: {
      shiftTeamId,
      effectiveFrom: {
        lte: date, // Menor ou igual à data do plantão
      },
    },
    orderBy: {
      effectiveFrom: 'desc', // Mais recente primeiro
    },
  });

  if (priceHistory) {
    return Number(priceHistory.shiftValue);
  }

  // Se não houver histórico, usar valor atual da equipe
  const team = await prisma.shiftTeam.findUnique({
    where: { id: shiftTeamId },
    select: { shiftValue: true },
  });

  return team ? Number(team.shiftValue) : 0;
}

/**
 * Retorna o valor customizado do plantão vigente na data especificada
 * Busca no histórico de preços customizados o valor válido para aquela data
 */
export async function getCustomShiftValueForDate(
  physiotherapistTeamId: number,
  date: Date
): Promise<number | null> {
  // Buscar o valor customizado mais recente que estava vigente na data
  const priceHistory = await prisma.physiotherapistTeamPriceHistory.findFirst({
    where: {
      physiotherapistTeamId,
      effectiveFrom: {
        lte: date,
      },
    },
    orderBy: {
      effectiveFrom: 'desc',
    },
  });

  if (priceHistory) {
    return priceHistory.customShiftValue !== null ? Number(priceHistory.customShiftValue) : null;
  }

  // Se não houver histórico, usar valor customizado atual
  const physioTeam = await prisma.physiotherapistTeam.findUnique({
    where: { id: physiotherapistTeamId },
    select: { customShiftValue: true },
  });

  return physioTeam?.customShiftValue !== null && physioTeam?.customShiftValue !== undefined
    ? Number(physioTeam.customShiftValue)
    : null;
}

/**
 * Valida se a redução de vagas é possível considerando plantões futuros
 * Retorna objeto com validação e detalhes dos conflitos
 */
export async function validateSlotReduction(
  shiftTeamId: number,
  period: ShiftPeriod,
  newSlots: number,
  dayType: 'weekday' | 'weekend'
): Promise<{
  isValid: boolean;
  currentCount: number;
  newLimit: number;
  conflicts?: Array<{
    date: string;
    physiotherapist: string;
    shiftId: number;
  }>;
  message?: string;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Buscar todos os feriados futuros
  const holidays = await prisma.holiday.findMany({
    where: {
      date: {
        gte: today,
      },
    },
    select: { date: true },
  });

  const holidayDates = new Set(
    holidays.map((h) => h.date.toISOString().split('T')[0])
  );

  // Buscar plantões futuros do período específico
  const futureShifts = await prisma.shift.findMany({
    where: {
      shiftTeamId,
      period,
      date: {
        gte: today,
      },
    },
    include: {
      physiotherapist: {
        select: { name: true },
      },
    },
    orderBy: {
      date: 'asc',
    },
  });

  // Filtrar plantões por tipo de dia
  const filteredShifts = futureShifts.filter((shift) => {
    const shiftDate = new Date(shift.date);
    const dayOfWeek = shiftDate.getDay();
    const dateStr = shiftDate.toISOString().split('T')[0];
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidayDates.has(dateStr);

    if (dayType === 'weekday') {
      return !isWeekend && !isHoliday;
    } else {
      return isWeekend || isHoliday;
    }
  });

  // Agrupar por data para contar plantões por dia
  const shiftsByDate = new Map<string, typeof filteredShifts>();
  filteredShifts.forEach((shift) => {
    const dateStr = shift.date.toISOString().split('T')[0];
    if (!shiftsByDate.has(dateStr)) {
      shiftsByDate.set(dateStr, []);
    }
    shiftsByDate.get(dateStr)!.push(shift);
  });

  // Verificar se algum dia excede o novo limite
  const conflicts: Array<{
    date: string;
    physiotherapist: string;
    shiftId: number;
  }> = [];

  let maxCount = 0;
  shiftsByDate.forEach((shifts, date) => {
    if (shifts.length > maxCount) {
      maxCount = shifts.length;
    }
    if (shifts.length > newSlots) {
      // Adicionar conflitos (plantões que excedem o novo limite)
      shifts.slice(newSlots).forEach((shift) => {
        conflicts.push({
          date: new Date(shift.date).toLocaleDateString('pt-BR'),
          physiotherapist: shift.physiotherapist.name,
          shiftId: shift.id,
        });
      });
    }
  });

  const isValid = conflicts.length === 0;

  if (!isValid) {
    const dayTypeLabel = dayType === 'weekday' ? 'dias úteis' : 'fins de semana/feriados';
    return {
      isValid: false,
      currentCount: maxCount,
      newLimit: newSlots,
      conflicts,
      message: `Não é possível reduzir as vagas de ${period} para ${newSlots} em ${dayTypeLabel}. Existem ${conflicts.length} plantão(ões) futuro(s) que excedem este limite. Remova ou realoque estes plantões primeiro.`,
    };
  }

  return {
    isValid: true,
    currentCount: maxCount,
    newLimit: newSlots,
    message: 'Redução de vagas permitida.',
  };
}

/**
 * Conta plantões futuros de um fisioterapeuta
 * Opcionalmente filtrado por equipe
 */
export async function countFutureShifts(
  physiotherapistId: number,
  shiftTeamId?: number
): Promise<{
  total: number;
  byTeam?: Record<string, { teamName: string; count: number }>;
  shifts?: Array<{
    id: number;
    date: string;
    period: string;
    teamName: string;
  }>;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const where: any = {
    physiotherapistId,
    date: {
      gte: today,
    },
  };

  if (shiftTeamId) {
    where.shiftTeamId = shiftTeamId;
  }

  const shifts = await prisma.shift.findMany({
    where,
    include: {
      shiftTeam: {
        select: { name: true },
      },
    },
    orderBy: {
      date: 'asc',
    },
  });

  const total = shifts.length;

  // Agrupar por equipe
  const byTeam: Record<string, { teamName: string; count: number }> = {};
  shifts.forEach((shift) => {
    const teamId = shift.shiftTeamId.toString();
    if (!byTeam[teamId]) {
      byTeam[teamId] = {
        teamName: shift.shiftTeam.name,
        count: 0,
      };
    }
    byTeam[teamId].count++;
  });

  const shiftsList = shifts.map((shift) => ({
    id: shift.id,
    date: new Date(shift.date).toLocaleDateString('pt-BR'),
    period: shift.period,
    teamName: shift.shiftTeam.name,
  }));

  return {
    total,
    byTeam,
    shifts: shiftsList,
  };
}

/**
 * Calcula vagas disponíveis para uma data/período específico
 * Considera tipo de dia (útil/fim de semana/feriado)
 */
export async function getAvailableSlots(
  shiftTeamId: number,
  date: Date,
  period: ShiftPeriod
): Promise<{
  total: number;
  occupied: number;
  available: number;
  dayType: 'weekday' | 'weekend';
}> {
  const dateStr = date.toISOString().split('T')[0];
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Verificar se é feriado
  const holiday = await prisma.holiday.findUnique({
    where: { date: new Date(dateStr) },
  });

  const dayType: 'weekday' | 'weekend' = isWeekend || holiday ? 'weekend' : 'weekday';

  // Buscar configuração da equipe
  const team = await prisma.shiftTeam.findUnique({
    where: { id: shiftTeamId },
  });

  if (!team) {
    return { total: 0, occupied: 0, available: 0, dayType };
  }

  // Determinar total de vagas baseado no tipo de dia e período
  let totalSlots = 0;
  if (dayType === 'weekday') {
    switch (period) {
      case 'MORNING':
        totalSlots = team.weekdayMorningSlots;
        break;
      case 'INTERMEDIATE':
        totalSlots = team.weekdayIntermediateSlots;
        break;
      case 'AFTERNOON':
        totalSlots = team.weekdayAfternoonSlots;
        break;
      case 'NIGHT':
        totalSlots = team.weekdayNightSlots;
        break;
    }
  } else {
    switch (period) {
      case 'MORNING':
        totalSlots = team.weekendMorningSlots;
        break;
      case 'INTERMEDIATE':
        totalSlots = team.weekendIntermediateSlots;
        break;
      case 'AFTERNOON':
        totalSlots = team.weekendAfternoonSlots;
        break;
      case 'NIGHT':
        totalSlots = team.weekendNightSlots;
        break;
    }
  }

  // Contar plantões ocupados naquela data/período
  const occupiedCount = await prisma.shift.count({
    where: {
      shiftTeamId,
      date: new Date(dateStr),
      period,
    },
  });

  return {
    total: totalSlots,
    occupied: occupiedCount,
    available: Math.max(0, totalSlots - occupiedCount),
    dayType,
  };
}

/**
 * Valida se é possível criar um plantão sem exceder vagas
 */
export async function validateShiftCreation(
  shiftTeamId: number,
  date: Date,
  period: ShiftPeriod
): Promise<{
  isValid: boolean;
  message?: string;
  slotsInfo?: {
    total: number;
    occupied: number;
    available: number;
  };
}> {
  const slots = await getAvailableSlots(shiftTeamId, date, period);

  if (slots.available <= 0) {
    return {
      isValid: false,
      message: `Não há vagas disponíveis para ${period} nesta data. Total: ${slots.total}, Ocupadas: ${slots.occupied}`,
      slotsInfo: {
        total: slots.total,
        occupied: slots.occupied,
        available: slots.available,
      },
    };
  }

  return {
    isValid: true,
    message: `Vaga disponível. ${slots.available} de ${slots.total} vagas restantes.`,
    slotsInfo: {
      total: slots.total,
      occupied: slots.occupied,
      available: slots.available,
    },
  };
}
