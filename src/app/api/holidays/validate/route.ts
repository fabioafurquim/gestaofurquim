import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isWeekend, parseLocalDate } from '@/lib/date-utils';

/**
 * API para validar conflitos entre feriados e plantões existentes
 * POST /api/holidays/validate
 */
export async function POST(request: Request) {
    try {
        const { date, name } = await request.json();

        if (!date) {
            return NextResponse.json(
                { error: 'Data é obrigatória' },
                { status: 400 }
            );
        }

        const holidayDate = parseLocalDate(date);
        
        // Verifica se já existe um feriado nesta data
        const existingHoliday = await prisma.holiday.findFirst({
            where: {
                date: {
                    gte: new Date(holidayDate.getFullYear(), holidayDate.getMonth(), holidayDate.getDate()),
                    lt: new Date(holidayDate.getFullYear(), holidayDate.getMonth(), holidayDate.getDate() + 1)
                }
            }
        });

        if (existingHoliday) {
            return NextResponse.json({
                conflict: true,
                type: 'holiday_exists',
                message: `Já existe um feriado cadastrado para esta data: ${existingHoliday.name}`
            });
        }

        // Verifica se existem plantões agendados para esta data
        const existingShifts = await prisma.shift.findMany({
            where: {
                date: {
                    gte: new Date(holidayDate.getFullYear(), holidayDate.getMonth(), holidayDate.getDate()),
                    lt: new Date(holidayDate.getFullYear(), holidayDate.getMonth(), holidayDate.getDate() + 1)
                }
            },
            include: {
                physiotherapist: {
                    select: {
                        name: true
                    }
                },
                shiftTeam: {
                    select: {
                        name: true
                    }
                }
            }
        });

        if (existingShifts.length > 0) {
            const isCurrentlyWeekend = isWeekend(holidayDate);
            
            return NextResponse.json({
                conflict: true,
                type: 'shifts_exist',
                message: `Existem ${existingShifts.length} plantão(ões) agendado(s) para esta data`,
                details: {
                    shiftsCount: existingShifts.length,
                    isCurrentlyWeekend,
                    willBecomeHoliday: true,
                    shifts: existingShifts.map(shift => ({
                        id: shift.id,
                        period: shift.period,
                        physiotherapist: shift.physiotherapist.name,
                        team: shift.shiftTeam.name
                    }))
                },
                warning: isCurrentlyWeekend 
                    ? 'Esta data já é fim de semana. Cadastrar como feriado não alterará as regras de slots.'
                    : 'Cadastrar esta data como feriado mudará as regras de slots de "dias úteis" para "fins de semana/feriados".'
            });
        }

        // Verifica se a data é fim de semana
        if (isWeekend(holidayDate)) {
            return NextResponse.json({
                conflict: false,
                warning: 'Esta data já é fim de semana. Cadastrar como feriado é redundante, mas permitido.',
                type: 'weekend_redundant'
            });
        }

        // Nenhum conflito encontrado
        return NextResponse.json({
            conflict: false,
            message: 'Nenhum conflito encontrado. Feriado pode ser cadastrado com segurança.'
        });

    } catch (error) {
        console.error('Erro ao validar feriado:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}