import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

import { prisma } from '@/lib/prisma';
import {
  buildMonthlyShiftPaymentEntries,
  groupMonthlyShiftPaymentEntries,
} from '@/lib/payment-calculator';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
    const teamId = searchParams.get('teamId') ? parseInt(searchParams.get('teamId')!) : undefined;
    const physioId = searchParams.get('physioId') ? parseInt(searchParams.get('physioId')!) : undefined;

    const entries = await buildMonthlyShiftPaymentEntries(`${year}-${String(month).padStart(2, '0')}`, {
      teamId,
      physioId,
    });
    const summaries = groupMonthlyShiftPaymentEntries(entries);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gestão Furquim';
    workbook.created = new Date();

    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];

    const summarySheet = workbook.addWorksheet('Resumo');
    summarySheet.mergeCells('A1:I1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = `Relatório Financeiro - ${monthNames[month - 1]} ${year}`;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center' };

    summarySheet.addRow([]);
    const headerRow = summarySheet.addRow([
      'Fisioterapeuta', 'Equipe', 'Manhã', 'Interm.', 'Tarde', 'Noite', 'Total', 'Valor Unit.', 'Subtotal',
    ]);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center' };
    });

    let grandTotalShifts = 0;
    let grandTotalValue = 0;
    let grandTotalAdditional = 0;

    summaries.forEach((physio) => {
      const teamBreakdowns = [...physio.teamBreakdown.values()];
      let isFirstRow = true;

      teamBreakdowns.forEach((team) => {
        const totalShiftsTeam =
          team.periods.MORNING +
          team.periods.INTERMEDIATE +
          team.periods.AFTERNOON +
          team.periods.NIGHT;

        const row = summarySheet.addRow([
          isFirstRow ? physio.physiotherapistName : '',
          team.teamName,
          team.periods.MORNING || '-',
          team.periods.INTERMEDIATE || '-',
          team.periods.AFTERNOON || '-',
          team.periods.NIGHT || '-',
          totalShiftsTeam,
          team.totalShifts > 0 ? Number((team.totalValue / team.totalShifts).toFixed(2)) : 0,
          team.totalValue,
        ]);

        row.getCell(8).numFmt = '"R$" #,##0.00';
        row.getCell(9).numFmt = '"R$" #,##0.00';

        isFirstRow = false;
      });

      const subtotalRow = summarySheet.addRow([
        '', 'Subtotal Plantões', '', '', '', '', physio.totalShifts, '', physio.totalShiftValue,
      ]);
      subtotalRow.font = { bold: true };
      subtotalRow.getCell(9).numFmt = '"R$" #,##0.00';

      if (physio.additionalValue > 0) {
        const additionalRow = summarySheet.addRow([
          '', 'Valor Adicional', '', '', '', '', '', '', physio.additionalValue,
        ]);
        additionalRow.font = { bold: true, color: { argb: 'FF059669' } };
        additionalRow.getCell(9).numFmt = '"R$" #,##0.00';
      }

      const totalRow = summarySheet.addRow([
        '', `TOTAL ${physio.physiotherapistName.toUpperCase()}`, '', '', '', '', '', '', physio.grossValue,
      ]);
      totalRow.font = { bold: true };
      totalRow.getCell(9).numFmt = '"R$" #,##0.00';
      totalRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEEF2FF' },
        };
      });

      summarySheet.addRow([]);

      grandTotalShifts += physio.totalShifts;
      grandTotalValue += physio.totalShiftValue;
      grandTotalAdditional += physio.additionalValue;
    });

    summarySheet.addRow([]);
    const grandTotalRow = summarySheet.addRow([
      'TOTAL GERAL', '', '', '', '', '', grandTotalShifts, '', grandTotalValue + grandTotalAdditional,
    ]);
    grandTotalRow.font = { bold: true, size: 12 };
    grandTotalRow.getCell(9).numFmt = '"R$" #,##0.00';
    grandTotalRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' },
      };
      cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    });

    summarySheet.columns = [
      { width: 25 },
      { width: 20 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 12 },
      { width: 15 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
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
