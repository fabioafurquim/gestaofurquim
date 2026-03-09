import { prisma } from './prisma';
import { getShiftValueForDate, getCustomShiftValueForDate } from './validations';

/**
 * Calcula o valor de um plantão considerando histórico de preços
 * Prioriza valor customizado do fisioterapeuta na equipe, depois valor da equipe
 */
export async function calculateShiftValue(
  shiftTeamId: number,
  physiotherapistId: number,
  shiftDate: Date
): Promise<number> {
  // Buscar vínculo fisioterapeuta-equipe
  const physioTeam = await prisma.physiotherapistTeam.findFirst({
    where: {
      physiotherapistId,
      shiftTeamId,
    },
  });

  // Se houver valor customizado, buscar no histórico
  if (physioTeam && physioTeam.customShiftValue) {
    const customValue = await getCustomShiftValueForDate(physioTeam.id, shiftDate);
    if (customValue !== null) {
      return customValue;
    }
  }

  // Caso contrário, usar valor padrão da equipe
  return await getShiftValueForDate(shiftTeamId, shiftDate);
}

/**
 * Calcula pagamento de um fisioterapeuta para um mês específico
 * Usa histórico de valores para cada plantão
 */
export async function calculateMonthlyPayment(
  physiotherapistId: number,
  referenceMonth: string // Formato: "2024-12"
): Promise<{
  totalShifts: number;
  totalValue: number;
  shiftDetails: Array<{
    date: string;
    period: string;
    teamName: string;
    value: number;
  }>;
}> {
  const [year, month] = referenceMonth.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  // Buscar plantões do mês
  const shifts = await prisma.shift.findMany({
    where: {
      physiotherapistId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      shiftTeam: {
        select: { name: true },
      },
    },
    orderBy: {
      date: 'asc',
    },
  });

  let totalValue = 0;
  const shiftDetails: Array<{
    date: string;
    period: string;
    teamName: string;
    value: number;
  }> = [];

  // Calcular valor de cada plantão usando histórico
  for (const shift of shifts) {
    const value = await calculateShiftValue(
      shift.shiftTeamId,
      shift.physiotherapistId,
      shift.date
    );

    totalValue += value;

    shiftDetails.push({
      date: new Date(shift.date).toLocaleDateString('pt-BR'),
      period: shift.period,
      teamName: shift.shiftTeam.name,
      value,
    });
  }

  return {
    totalShifts: shifts.length,
    totalValue,
    shiftDetails,
  };
}

/**
 * Calcula pagamentos de todos os fisioterapeutas para um mês
 * Retorna lista com valores calculados usando histórico
 */
export async function calculateAllMonthlyPayments(
  referenceMonth: string
): Promise<
  Array<{
    physiotherapistId: number;
    physiotherapistName: string;
    email: string;
    contractType: string;
    totalShifts: number;
    totalShiftValue: number;
    additionalValue: number;
    grossValue: number;
  }>
> {
  const [year, month] = referenceMonth.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  // Buscar todos os fisioterapeutas que tiveram plantões no mês
  const shifts = await prisma.shift.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      physiotherapist: {
        select: {
          id: true,
          name: true,
          email: true,
          contractType: true,
          additionalValue: true,
        },
      },
      shiftTeam: true,
    },
  });

  // Agrupar por fisioterapeuta
  const paymentsByPhysio = new Map<
    number,
    {
      physiotherapist: any;
      shifts: typeof shifts;
      totalShiftValue: number;
    }
  >();

  for (const shift of shifts) {
    const physioId = shift.physiotherapist.id;

    if (!paymentsByPhysio.has(physioId)) {
      paymentsByPhysio.set(physioId, {
        physiotherapist: shift.physiotherapist,
        shifts: [],
        totalShiftValue: 0,
      });
    }

    paymentsByPhysio.get(physioId)!.shifts.push(shift);
  }

  // Calcular valores usando histórico
  const results: Array<{
    physiotherapistId: number;
    physiotherapistName: string;
    email: string;
    contractType: string;
    totalShifts: number;
    totalShiftValue: number;
    additionalValue: number;
    grossValue: number;
  }> = [];

  for (const [physioId, data] of paymentsByPhysio) {
    let totalShiftValue = 0;

    // Calcular valor de cada plantão usando histórico
    for (const shift of data.shifts) {
      const value = await calculateShiftValue(
        shift.shiftTeamId,
        shift.physiotherapistId,
        shift.date
      );
      totalShiftValue += value;
    }

    const additionalValue = Number(data.physiotherapist.additionalValue) || 0;
    const grossValue = totalShiftValue + additionalValue;

    results.push({
      physiotherapistId: physioId,
      physiotherapistName: data.physiotherapist.name,
      email: data.physiotherapist.email || '',
      contractType: data.physiotherapist.contractType || 'NO_CONTRACT',
      totalShifts: data.shifts.length,
      totalShiftValue,
      additionalValue,
      grossValue,
    });
  }

  return results.sort((a, b) => a.physiotherapistName.localeCompare(b.physiotherapistName));
}
