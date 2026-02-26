import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ShiftPeriod } from '@prisma/client';
import ExcelJS from 'exceljs';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
        const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
        const teamId = searchParams.get('teamId') ? parseInt(searchParams.get('teamId')!) : undefined;
        const physioId = searchParams.get('physioId') ? parseInt(searchParams.get('physioId')!) : undefined;

        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 1);

        const shifts = await prisma.shift.findMany({
            where: {
                date: { gte: start, lt: end },
                ...(teamId ? { shiftTeamId: teamId } : {}),
                ...(physioId ? { physiotherapistId: physioId } : {}),
            },
            include: { physiotherapist: true, shiftTeam: true },
            orderBy: { date: 'asc' },
        });

        // Buscar valores customizados
        const physiotherapistTeams = await prisma.physiotherapistTeam.findMany();
        const customValueMap = new Map<string, number | null>();
        for (const pt of physiotherapistTeams) {
            const key = `${pt.physiotherapistId}-${pt.shiftTeamId}`;
            const customValue = (pt as any).customShiftValue;
            customValueMap.set(key, customValue ? Number(customValue) : null);
        }

        // Agrupar dados por fisioterapeuta e equipe
        const byPhysio: Record<number, {
            id: number;
            name: string;
            teamBreakdown: Record<number, {
                teamId: number;
                teamName: string;
                periods: Record<ShiftPeriod, number>;
                shiftValue: number;
                totalShifts: number;
                totalValue: number;
            }>;
            totalShifts: number;
            totalValue: number;
            additionalValue: number;
        }> = {};

        for (const shift of shifts) {
            const physio = shift.physiotherapist;
            const team = shift.shiftTeam;
            
            if (!team || !physio) continue;

            const customValueKey = `${physio.id}-${team.id}`;
            const customValue = customValueMap.get(customValueKey);
            const shiftValue = customValue !== null && customValue !== undefined 
                ? customValue 
                : (team.shiftValue?.toNumber() || 0);
            const additionalValue = physio.additionalValue?.toNumber() || 0;

            if (!byPhysio[physio.id]) {
                byPhysio[physio.id] = {
                    id: physio.id,
                    name: physio.name,
                    teamBreakdown: {},
                    totalShifts: 0,
                    totalValue: 0,
                    additionalValue: additionalValue
                };
            }

            if (!byPhysio[physio.id].teamBreakdown[team.id]) {
                byPhysio[physio.id].teamBreakdown[team.id] = {
                    teamId: team.id,
                    teamName: team.name,
                    periods: { MORNING: 0, INTERMEDIATE: 0, AFTERNOON: 0, NIGHT: 0 },
                    shiftValue: shiftValue,
                    totalShifts: 0,
                    totalValue: 0
                };
            }

            const teamBreakdown = byPhysio[physio.id].teamBreakdown[team.id];
            teamBreakdown.periods[shift.period]++;
            teamBreakdown.totalShifts++;
            teamBreakdown.totalValue += shiftValue;

            byPhysio[physio.id].totalShifts++;
            byPhysio[physio.id].totalValue += shiftValue;
        }

        // Criar workbook Excel
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Gestão Furquim';
        workbook.created = new Date();

        const monthNames = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];

        // Planilha de Resumo
        const summarySheet = workbook.addWorksheet('Resumo');
        
        // Título
        summarySheet.mergeCells('A1:H1');
        const titleCell = summarySheet.getCell('A1');
        titleCell.value = `Relatório Financeiro - ${monthNames[month - 1]} ${year}`;
        titleCell.font = { bold: true, size: 16 };
        titleCell.alignment = { horizontal: 'center' };

        // Cabeçalhos
        summarySheet.addRow([]);
        const headerRow = summarySheet.addRow([
            'Fisioterapeuta', 'Equipe', 'Manhã', 'Interm.', 'Tarde', 'Noite', 'Total', 'Valor Unit.', 'Subtotal'
        ]);
        headerRow.font = { bold: true };
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4F46E5' }
            };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: 'center' };
        });

        // Dados
        let grandTotalShifts = 0;
        let grandTotalValue = 0;
        let grandTotalAdditional = 0;

        Object.values(byPhysio).forEach((physio) => {
            const teamBreakdowns = Object.values(physio.teamBreakdown);
            let isFirstRow = true;

            teamBreakdowns.forEach((team) => {
                const totalShiftsTeam = team.periods.MORNING + team.periods.INTERMEDIATE + team.periods.AFTERNOON + team.periods.NIGHT;
                const row = summarySheet.addRow([
                    isFirstRow ? physio.name : '',
                    team.teamName,
                    team.periods.MORNING || '-',
                    team.periods.INTERMEDIATE || '-',
                    team.periods.AFTERNOON || '-',
                    team.periods.NIGHT || '-',
                    totalShiftsTeam,
                    team.shiftValue,
                    team.totalValue
                ]);

                // Formatar valores monetários
                row.getCell(8).numFmt = '"R$" #,##0.00';
                row.getCell(9).numFmt = '"R$" #,##0.00';

                isFirstRow = false;
            });

            // Subtotal do fisioterapeuta
            const subtotalRow = summarySheet.addRow([
                '', 'Subtotal Plantões', '', '', '', '', physio.totalShifts, '', physio.totalValue
            ]);
            subtotalRow.font = { bold: true };
            subtotalRow.getCell(9).numFmt = '"R$" #,##0.00';

            // Valor adicional
            if (physio.additionalValue > 0) {
                const additionalRow = summarySheet.addRow([
                    '', 'Valor Adicional', '', '', '', '', '', '', physio.additionalValue
                ]);
                additionalRow.font = { bold: true, color: { argb: 'FF059669' } };
                additionalRow.getCell(9).numFmt = '"R$" #,##0.00';
            }

            // Total do fisioterapeuta
            const totalPhysio = physio.totalValue + physio.additionalValue;
            const totalRow = summarySheet.addRow([
                '', `TOTAL ${physio.name.toUpperCase()}`, '', '', '', '', '', '', totalPhysio
            ]);
            totalRow.font = { bold: true };
            totalRow.getCell(9).numFmt = '"R$" #,##0.00';
            totalRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFEEF2FF' }
                };
            });

            // Linha em branco
            summarySheet.addRow([]);

            grandTotalShifts += physio.totalShifts;
            grandTotalValue += physio.totalValue;
            grandTotalAdditional += physio.additionalValue;
        });

        // Total Geral
        summarySheet.addRow([]);
        const grandTotalRow = summarySheet.addRow([
            'TOTAL GERAL', '', '', '', '', '', grandTotalShifts, '', grandTotalValue + grandTotalAdditional
        ]);
        grandTotalRow.font = { bold: true, size: 12 };
        grandTotalRow.getCell(9).numFmt = '"R$" #,##0.00';
        grandTotalRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4F46E5' }
            };
            cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        });

        // Ajustar largura das colunas
        summarySheet.columns = [
            { width: 25 }, // Fisioterapeuta
            { width: 20 }, // Equipe
            { width: 10 }, // Manhã
            { width: 10 }, // Interm.
            { width: 10 }, // Tarde
            { width: 10 }, // Noite
            { width: 10 }, // Total
            { width: 12 }, // Valor Unit.
            { width: 15 }, // Subtotal
        ];

        // Gerar buffer
        const buffer = await workbook.xlsx.writeBuffer();

        // Retornar arquivo
        const filename = `relatorio-financeiro-${year}-${String(month).padStart(2, '0')}.xlsx`;
        
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error) {
        console.error('Erro ao gerar Excel:', error);
        return NextResponse.json(
            { error: 'Erro ao gerar arquivo Excel' },
            { status: 500 }
        );
    }
}
