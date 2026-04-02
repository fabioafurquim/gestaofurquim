import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import type { FinancialClosingLine } from '@prisma/client';

type ClosingLine = FinancialClosingLine;

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function drawText(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size = 10, color = rgb(0.11, 0.17, 0.29)) {
  page.drawText(text, {
    x,
    y,
    size,
    font,
    color,
  });
}

function drawHeader(page: PDFPage, boldFont: PDFFont, regularFont: PDFFont, referenceMonth: string) {
  drawText(page, boldFont, 'Relatório Bruto RPA para Contabilidade', 40, 790, 18);
  drawText(page, regularFont, `Competência: ${referenceMonth}`, 40, 770, 11);
  drawText(
    page,
    regularFont,
    'Base oficial do fechamento financeiro para emissão das RPAs.',
    40,
    754,
    10,
    rgb(0.35, 0.35, 0.35)
  );

  page.drawLine({
    start: { x: 40, y: 744 },
    end: { x: 555, y: 744 },
    thickness: 1,
    color: rgb(0.82, 0.85, 0.9),
  });
}

export async function generateRpaGrossValuesPdf(params: {
  referenceMonth: string;
  lines: ClosingLine[];
}) {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([595.28, 841.89]);
  drawHeader(page, boldFont, regularFont, params.referenceMonth);

  let y = 720;
  const rpaLines = params.lines
    .filter((line) => line.contractType === 'RPA' && line.status !== 'CANCELLED')
    .sort((a, b) => a.physiotherapistName.localeCompare(b.physiotherapistName));

  if (rpaLines.length === 0) {
    drawText(page, regularFont, 'Nenhum fisioterapeuta RPA encontrado para a competência selecionada.', 40, y, 12);
    return pdfDoc.save();
  }

  const headerY = y;
  drawText(page, boldFont, 'Fisioterapeuta', 40, headerY, 10);
  drawText(page, boldFont, 'Plantões', 260, headerY, 10);
  drawText(page, boldFont, 'Valor Plantões', 330, headerY, 10);
  drawText(page, boldFont, 'Adicionais', 430, headerY, 10);
  drawText(page, boldFont, 'Bruto', 510, headerY, 10);
  y -= 16;

  for (const line of rpaLines) {
    if (y < 70) {
      page = pdfDoc.addPage([595.28, 841.89]);
      drawHeader(page, boldFont, regularFont, params.referenceMonth);
      y = 720;
    }

    const grossValue = Number(line.grossCalculatedValue);
    const additionalValue = Number(line.additionalValue);
    const shiftsValue = grossValue - additionalValue;

    drawText(page, regularFont, line.physiotherapistName, 40, y, 10);
    drawText(page, regularFont, String(line.totalShifts), 278, y, 10);
    drawText(page, regularFont, formatCurrency(shiftsValue), 330, y, 10);
    drawText(page, regularFont, formatCurrency(additionalValue), 430, y, 10);
    drawText(page, boldFont, formatCurrency(grossValue), 500, y, 10);
    y -= 16;
  }

  return pdfDoc.save();
}
