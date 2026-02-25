import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';

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
    const { error } = await requireAuth();
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

    try {
        const updatedTeam = await prisma.shiftTeam.update({
            where: { id: parseInt(id) },
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
                shiftValue: Number(shiftValue ?? 0),
            },
        });
        return NextResponse.json(updatedTeam);
    } catch (error) {
        return NextResponse.json({ error: 'Erro ao atualizar equipe' }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    const { error } = await requireAuth();
    if (error) return error;

    const { id } = await context.params;
    try {
        await prisma.shiftTeam.delete({
            where: { id: parseInt(id) },
        });
        return NextResponse.json({ message: 'Equipe excluída com sucesso' });
    } catch (error) {
        return NextResponse.json({ error: 'Erro ao excluir equipe' }, { status: 500 });
    }
}