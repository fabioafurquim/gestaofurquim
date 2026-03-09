import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';
import { validateSlotReduction, countFutureShifts } from '@/lib/validations';
import { ShiftPeriod } from '@prisma/client';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    try {
        const team = await prisma.shiftTeam.findUnique({
            where: { id: parseInt(id) },
        });
        if (!team) {
            return NextResponse.json({ error: 'Equipe não encontrada' }, { status: 404 });
        }
        return NextResponse.json(team);
    } catch (error) {
        return NextResponse.json({ error: 'Erro ao buscar equipe' }, { status: 500 });
    }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { id } = await context.params;
    const data = await request.json();
    const { 
        name, 
        // Campos antigos (mantidos por compatibilidade)
        morningSlots, 
        intermediateSlots, 
        afternoonSlots, 
        nightSlots, 
        // Novos campos para dias úteis
        weekdayMorningSlots,
        weekdayIntermediateSlots,
        weekdayAfternoonSlots,
        weekdayNightSlots,
        // Novos campos para fins de semana/feriados
        weekendMorningSlots,
        weekendIntermediateSlots,
        weekendAfternoonSlots,
        weekendNightSlots,
        shiftValue 
    } = data;

    const teamId = parseInt(id);

    try {
        // Buscar equipe atual para comparar valores
        const currentTeam = await prisma.shiftTeam.findUnique({
            where: { id: teamId },
        });

        if (!currentTeam) {
            return NextResponse.json({ error: 'Equipe não encontrada' }, { status: 404 });
        }

        // VALIDAÇÃO 1: Verificar redução de vagas vs plantões futuros
        const validationErrors: string[] = [];
        const validationDetails: any[] = [];

        // Validar dias úteis
        const weekdayValidations = [
            { period: 'MORNING' as ShiftPeriod, newSlots: Number(weekdayMorningSlots ?? morningSlots ?? 0), currentSlots: currentTeam.weekdayMorningSlots },
            { period: 'INTERMEDIATE' as ShiftPeriod, newSlots: Number(weekdayIntermediateSlots ?? intermediateSlots ?? 0), currentSlots: currentTeam.weekdayIntermediateSlots },
            { period: 'AFTERNOON' as ShiftPeriod, newSlots: Number(weekdayAfternoonSlots ?? afternoonSlots ?? 0), currentSlots: currentTeam.weekdayAfternoonSlots },
            { period: 'NIGHT' as ShiftPeriod, newSlots: Number(weekdayNightSlots ?? nightSlots ?? 0), currentSlots: currentTeam.weekdayNightSlots },
        ];

        for (const validation of weekdayValidations) {
            if (validation.newSlots < validation.currentSlots) {
                const result = await validateSlotReduction(teamId, validation.period, validation.newSlots, 'weekday');
                if (!result.isValid) {
                    validationErrors.push(result.message || 'Erro ao validar redução de vagas');
                    validationDetails.push({
                        period: validation.period,
                        dayType: 'weekday',
                        conflicts: result.conflicts,
                    });
                }
            }
        }

        // Validar fins de semana
        const weekendValidations = [
            { period: 'MORNING' as ShiftPeriod, newSlots: Number(weekendMorningSlots ?? morningSlots ?? 0), currentSlots: currentTeam.weekendMorningSlots },
            { period: 'INTERMEDIATE' as ShiftPeriod, newSlots: Number(weekendIntermediateSlots ?? intermediateSlots ?? 0), currentSlots: currentTeam.weekendIntermediateSlots },
            { period: 'AFTERNOON' as ShiftPeriod, newSlots: Number(weekendAfternoonSlots ?? afternoonSlots ?? 0), currentSlots: currentTeam.weekendAfternoonSlots },
            { period: 'NIGHT' as ShiftPeriod, newSlots: Number(weekendNightSlots ?? nightSlots ?? 0), currentSlots: currentTeam.weekendNightSlots },
        ];

        for (const validation of weekendValidations) {
            if (validation.newSlots < validation.currentSlots) {
                const result = await validateSlotReduction(teamId, validation.period, validation.newSlots, 'weekend');
                if (!result.isValid) {
                    validationErrors.push(result.message || 'Erro ao validar redução de vagas');
                    validationDetails.push({
                        period: validation.period,
                        dayType: 'weekend',
                        conflicts: result.conflicts,
                    });
                }
            }
        }

        // Se houver erros de validação, retornar
        if (validationErrors.length > 0) {
            return NextResponse.json({
                error: 'Não é possível reduzir as vagas',
                details: validationErrors,
                conflicts: validationDetails,
            }, { status: 400 });
        }

        // VALIDAÇÃO 2: Criar histórico de valor se o shiftValue mudou
        const newShiftValue = Number(shiftValue ?? 0);
        const valueChanged = newShiftValue !== Number(currentTeam.shiftValue);

        // Usar transação para garantir atomicidade
        const result = await prisma.$transaction(async (tx) => {
            // Atualizar equipe
            const updatedTeam = await tx.shiftTeam.update({
                where: { id: teamId },
                data: {
                    name,
                    // Campos antigos (mantidos por compatibilidade)
                    morningSlots: Number(morningSlots ?? 0),
                    intermediateSlots: Number(intermediateSlots ?? 0),
                    afternoonSlots: Number(afternoonSlots ?? 0),
                    nightSlots: Number(nightSlots ?? 0),
                    // Novos campos para dias úteis
                    weekdayMorningSlots: Number(weekdayMorningSlots ?? morningSlots ?? 0),
                    weekdayIntermediateSlots: Number(weekdayIntermediateSlots ?? intermediateSlots ?? 0),
                    weekdayAfternoonSlots: Number(weekdayAfternoonSlots ?? afternoonSlots ?? 0),
                    weekdayNightSlots: Number(weekdayNightSlots ?? nightSlots ?? 0),
                    // Novos campos para fins de semana/feriados
                    weekendMorningSlots: Number(weekendMorningSlots ?? morningSlots ?? 0),
                    weekendIntermediateSlots: Number(weekendIntermediateSlots ?? intermediateSlots ?? 0),
                    weekendAfternoonSlots: Number(weekendAfternoonSlots ?? afternoonSlots ?? 0),
                    weekendNightSlots: Number(weekendNightSlots ?? nightSlots ?? 0),
                    shiftValue: newShiftValue,
                },
            });

            // Se o valor mudou, criar registro no histórico
            if (valueChanged && newShiftValue > 0 && session) {
                const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id;
                
                await tx.shiftTeamPriceHistory.create({
                    data: {
                        shiftTeamId: teamId,
                        shiftValue: newShiftValue,
                        effectiveFrom: new Date(), // A partir de agora
                        createdBy: userId,
                    },
                });
            }

            return updatedTeam;
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Erro ao atualizar equipe:', error);
        return NextResponse.json({ error: 'Erro ao atualizar equipe' }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    const { error } = await requireAuth();
    if (error) return error;

    const { id } = await context.params;
    const teamId = parseInt(id);

    try {
        // VALIDAÇÃO: Verificar se há plantões futuros
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const futureShiftsCount = await prisma.shift.count({
            where: {
                shiftTeamId: teamId,
                date: {
                    gte: today,
                },
            },
        });

        if (futureShiftsCount > 0) {
            // Buscar detalhes dos plantões para retornar ao usuário
            const futureShifts = await prisma.shift.findMany({
                where: {
                    shiftTeamId: teamId,
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
                take: 10, // Limitar a 10 para não sobrecarregar a resposta
            });

            const shiftsList = futureShifts.map(shift => ({
                id: shift.id,
                date: new Date(shift.date).toLocaleDateString('pt-BR'),
                period: shift.period,
                physiotherapist: shift.physiotherapist.name,
            }));

            return NextResponse.json({
                error: 'Não é possível excluir equipe com plantões futuros',
                message: `Esta equipe possui ${futureShiftsCount} plantão(ões) futuro(s) agendado(s). Remova ou realoque estes plantões antes de excluir a equipe.`,
                futureShiftsCount,
                shifts: shiftsList,
            }, { status: 400 });
        }

        // Se não houver plantões futuros, permitir exclusão
        await prisma.shiftTeam.delete({
            where: { id: teamId },
        });

        return NextResponse.json({ message: 'Equipe excluída com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir equipe:', error);
        return NextResponse.json({ error: 'Erro ao excluir equipe' }, { status: 500 });
    }
}