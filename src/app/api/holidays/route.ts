import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { parseLocalDate } from '@/lib/date-utils';

const prisma = new PrismaClient();

// Schema de validação para criação de feriado
const createHolidaySchema = z.object({
  date: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Data inválida"
  }),
  name: z.string().min(1, "Nome é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres"),
  description: z.string().optional()
});

// Schema de validação para atualização de feriado
const updateHolidaySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres").optional(),
  description: z.string().optional()
});

/**
 * GET /api/holidays - Lista todos os feriados
 */
export async function GET() {
  try {
    const holidays = await prisma.holiday.findMany({
      orderBy: {
        date: 'asc'
      }
    });

    return NextResponse.json(holidays);
  } catch (error) {
    console.error('Erro ao buscar feriados:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/holidays - Cria um novo feriado
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createHolidaySchema.parse(body);

    const holidayDate = parseLocalDate(validatedData.date);
    
    // Verifica se já existe um feriado nesta data
    const existingHoliday = await prisma.holiday.findUnique({
      where: { date: holidayDate }
    });

    if (existingHoliday) {
      return NextResponse.json(
        { error: 'Já existe um feriado cadastrado para esta data' },
        { status: 400 }
      );
    }

    // Verifica se existem plantões cadastrados para esta data
    const existingShifts = await prisma.shift.findMany({
      where: {
        date: holidayDate
      }
    });

    if (existingShifts.length > 0) {
      return NextResponse.json(
        { 
          error: 'Não é possível cadastrar feriado para esta data pois existem plantões já cadastrados. Exclua os plantões primeiro.',
          shiftsCount: existingShifts.length
        },
        { status: 400 }
      );
    }

    // Cria o feriado
    const holiday = await prisma.holiday.create({
      data: {
        date: holidayDate,
        name: validatedData.name,
        description: validatedData.description
      }
    });

    return NextResponse.json(holiday, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Erro ao criar feriado:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}