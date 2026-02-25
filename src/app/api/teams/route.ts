import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const teams = await prisma.shiftTeam.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(teams);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar equipes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const data = await request.json();
  const { 
    name, 
    morningSlots, 
    intermediateSlots, 
    afternoonSlots, 
    nightSlots, 
    weekdayMorningSlots,
    weekdayIntermediateSlots,
    weekdayAfternoonSlots,
    weekdayNightSlots,
    weekendMorningSlots,
    weekendIntermediateSlots,
    weekendAfternoonSlots,
    weekendNightSlots,
    shiftValue 
  } = data;

  try {
    const team = await prisma.shiftTeam.create({
      data: {
        name,
        // Campos antigos (mantidos por compatibilidade)
        morningSlots: Number(morningSlots ?? 0),
        intermediateSlots: Number(intermediateSlots ?? 0),
        afternoonSlots: Number(afternoonSlots ?? 0),
        nightSlots: Number(nightSlots ?? 0),
        // Novos campos para dias úteis
        weekdayMorningSlots: Number(weekdayMorningSlots ?? 0),
        weekdayIntermediateSlots: Number(weekdayIntermediateSlots ?? 0),
        weekdayAfternoonSlots: Number(weekdayAfternoonSlots ?? 0),
        weekdayNightSlots: Number(weekdayNightSlots ?? 0),
        // Novos campos para fins de semana/feriados
        weekendMorningSlots: Number(weekendMorningSlots ?? 0),
        weekendIntermediateSlots: Number(weekendIntermediateSlots ?? 0),
        weekendAfternoonSlots: Number(weekendAfternoonSlots ?? 0),
        weekendNightSlots: Number(weekendNightSlots ?? 0),
        shiftValue: Number(shiftValue ?? 0),
      },
    });
    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar equipe' }, { status: 500 });
  }
}
