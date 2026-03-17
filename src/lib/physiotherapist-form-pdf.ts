import { readFile } from 'fs/promises';
import path from 'path';
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from 'pdf-lib';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const FIELD_GAP = 14;
const LABEL_SIZE = 8.5;
const TITLE_SIZE = 16.5;
const LINE_OFFSET = 23;
const FIELD_HEIGHT = 44;
const SECTION_SPACING = 6;

type FieldSpec = {
  label: string;
  span?: number;
};

export async function generatePhysiotherapistFormPdf() {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logoImage = await loadLogo(pdfDoc);

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  drawPageHeader(
    page,
    boldFont,
    regularFont,
    logoImage,
    'Ficha de Cadastro de Fisioterapeuta',
    'Favor enviar para a gestão após preenchimento'
  );

  let currentY = PAGE_HEIGHT - 114;

  currentY = drawSectionTitle(page, boldFont, '1. Dados pessoais', currentY);
  currentY = drawFieldRow(page, boldFont, currentY, [
    { label: 'Nome completo', span: 7 },
    { label: 'Email', span: 5 },
  ]);
  currentY = drawFieldRow(page, boldFont, currentY, [
    { label: 'Telefone / WhatsApp', span: 4 },
    { label: 'Data de nascimento', span: 3 },
    { label: 'CPF', span: 2.5 },
    { label: 'RG', span: 2.5 },
  ]);
  currentY = drawFieldRow(page, boldFont, currentY, [
    { label: 'CREFITO', span: 3 },
    { label: 'Data de início / disponibilidade', span: 4.5 },
    { label: 'Cidade / UF', span: 4.5 },
  ]);
  currentY = drawLargeField(page, boldFont, currentY, 'Endereço completo');

  currentY = drawSectionTitle(page, boldFont, '2. Modalidade de contratação', currentY - SECTION_SPACING);
  currentY = drawCheckboxRow(page, regularFont, currentY, ['PJ (Pessoa Jurídica)', 'RPA (Pessoa Física)']);

  currentY = drawSectionTitle(page, boldFont, '3. Dados bancários / pagamento', currentY - SECTION_SPACING);
  currentY = drawFieldRow(page, boldFont, currentY, [
    { label: 'Banco', span: 3 },
    { label: 'Agência', span: 2.5 },
    { label: 'Conta', span: 3 },
    { label: 'Tipo de PIX', span: 3.5 },
  ]);
  currentY = drawLargeField(page, boldFont, currentY, 'Chave PIX');

  currentY = drawSectionTitle(page, boldFont, '4. Informações de contratação PJ', currentY - SECTION_SPACING);
  currentY = drawFieldRow(page, boldFont, currentY, [
    { label: 'Nome da empresa', span: 7 },
    { label: 'CNPJ', span: 5 },
  ]);
  currentY = drawLargeField(page, boldFont, currentY, 'Endereço da empresa');

  currentY = drawSectionTitle(page, boldFont, '5. Informações de contratação RPA', currentY - SECTION_SPACING);
  currentY = drawFieldRow(page, boldFont, currentY, [
    { label: 'Nome completo para recibo', span: 7 },
    { label: 'CPF para recibo', span: 5 },
  ]);

  drawSignatureBlock(page, regularFont, boldFont, currentY + 8);

  return pdfDoc.save();
}

async function loadLogo(pdfDoc: PDFDocument) {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    const logoBytes = await readFile(logoPath);
    return pdfDoc.embedPng(logoBytes);
  } catch (error) {
    console.error('Erro ao carregar logo do formulário:', error);
    return null;
  }
}

function drawPageHeader(
  page: PDFPage,
  boldFont: PDFFont,
  regularFont: PDFFont,
  logoImage: PDFImage | null,
  title: string,
  subtitle: string
) {
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 86,
    width: PAGE_WIDTH,
    height: 86,
    color: rgb(0.955, 0.978, 1),
  });

  page.drawRectangle({
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 74,
    width: CONTENT_WIDTH,
    height: 56,
    color: rgb(0.975, 0.988, 1),
  });

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 8,
    width: PAGE_WIDTH,
    height: 8,
    color: rgb(0.82, 0.9, 0.98),
  });

  const logoWidth = 168;
  const logoHeight = 84;
  const logoX = PAGE_MARGIN;
  const logoY = PAGE_HEIGHT - 85;
  const textX = logoImage ? PAGE_MARGIN + logoWidth + 14 : PAGE_MARGIN;

  if (logoImage) {
    const scaled = logoImage.scaleToFit(logoWidth, logoHeight);
    page.drawImage(logoImage, {
      x: logoX,
      y: logoY,
      width: scaled.width,
      height: scaled.height,
      opacity: 0.98,
    });
  }

  page.drawText(title, {
    x: textX,
    y: PAGE_HEIGHT - 38,
    size: TITLE_SIZE,
    font: boldFont,
    color: rgb(0.14, 0.22, 0.34),
  });

  page.drawText(subtitle, {
    x: textX,
    y: PAGE_HEIGHT - 54,
    size: 9.5,
    font: regularFont,
    color: rgb(0.3, 0.42, 0.56),
  });

  page.drawText('Furquim Fisioterapia • Formulário para preenchimento manual', {
    x: textX,
    y: PAGE_HEIGHT - 68,
    size: 8,
    font: regularFont,
    color: rgb(0.39, 0.5, 0.62),
  });
}

function drawSectionTitle(page: PDFPage, boldFont: PDFFont, title: string, topY: number) {
  page.drawRectangle({
    x: PAGE_MARGIN,
    y: topY - 8,
    width: CONTENT_WIDTH,
    height: 18,
    color: rgb(0.94, 0.972, 1),
  });

  page.drawRectangle({
    x: PAGE_MARGIN,
    y: topY - 8,
    width: 4,
    height: 18,
    color: rgb(0.73, 0.84, 0.97),
  });

  page.drawText(title, {
    x: PAGE_MARGIN + 10,
    y: topY,
    size: 11.5,
    font: boldFont,
    color: rgb(0.17, 0.29, 0.43),
  });

  page.drawLine({
    start: { x: PAGE_MARGIN, y: topY - 7 },
    end: { x: PAGE_WIDTH - PAGE_MARGIN, y: topY - 7 },
    color: rgb(0.82, 0.89, 0.96),
    thickness: 1,
  });

  return topY - 27;
}

function drawFieldRow(page: PDFPage, boldFont: PDFFont, topY: number, fields: FieldSpec[]) {
  const totalSpan = fields.reduce((sum, field) => sum + (field.span ?? 1), 0);
  const totalGapWidth = FIELD_GAP * Math.max(0, fields.length - 1);
  const availableWidth = CONTENT_WIDTH - totalGapWidth;
  let currentX = PAGE_MARGIN;

  fields.forEach((field, index) => {
    const width = availableWidth * ((field.span ?? 1) / totalSpan);
    drawSingleField(page, boldFont, currentX, topY, width, field.label);
    currentX += width;

    if (index < fields.length - 1) {
      currentX += FIELD_GAP;
    }
  });

  return topY - FIELD_HEIGHT;
}

function drawLargeField(page: PDFPage, boldFont: PDFFont, topY: number, label: string) {
  drawSingleField(page, boldFont, PAGE_MARGIN, topY, CONTENT_WIDTH, label);
  return topY - FIELD_HEIGHT;
}

function drawSingleField(page: PDFPage, boldFont: PDFFont, x: number, topY: number, width: number, label: string) {
  page.drawText(label, {
    x,
    y: topY,
    size: LABEL_SIZE,
    font: boldFont,
    color: rgb(0.24, 0.33, 0.43),
  });

  page.drawLine({
    start: { x, y: topY - LINE_OFFSET },
    end: { x: x + width, y: topY - LINE_OFFSET },
    color: rgb(0.37, 0.48, 0.61),
    thickness: 0.8,
  });
}

function drawCheckboxRow(page: PDFPage, regularFont: PDFFont, topY: number, options: string[]) {
  const boxSize = 11;
  const groupGap = 34;
  const totalGapWidth = groupGap * Math.max(0, options.length - 1);
  const groupWidth = (CONTENT_WIDTH - totalGapWidth) / options.length;
  let currentX = PAGE_MARGIN;

  options.forEach((option, index) => {
    page.drawRectangle({
      x: currentX,
      y: topY - 2,
      width: boxSize,
      height: boxSize,
      borderColor: rgb(0.38, 0.5, 0.64),
      borderWidth: 0.9,
      color: rgb(0.98, 0.992, 1),
    });

    page.drawText(option, {
      x: currentX + 18,
      y: topY + 1,
      size: 8.5,
      font: regularFont,
      color: rgb(0.24, 0.34, 0.44),
    });

    currentX += groupWidth;
    if (index < options.length - 1) {
      currentX += groupGap;
    }
  });

  return topY - 30;
}

function drawSignatureBlock(page: PDFPage, regularFont: PDFFont, boldFont: PDFFont, topY: number) {
  page.drawText('Assinatura e conferência', {
    x: PAGE_MARGIN,
    y: topY,
    size: 10.5,
    font: boldFont,
    color: rgb(0.17, 0.29, 0.43),
  });

  const lineY = topY - 30;
  const signatureWidth = (CONTENT_WIDTH - 36) * 0.68;
  const dateX = PAGE_MARGIN + signatureWidth + 36;

  page.drawLine({
    start: { x: PAGE_MARGIN, y: lineY },
    end: { x: PAGE_MARGIN + signatureWidth, y: lineY },
    color: rgb(0.37, 0.48, 0.61),
    thickness: 0.8,
  });

  page.drawText('Assinatura do fisioterapeuta', {
    x: PAGE_MARGIN,
    y: topY - 44,
    size: 8,
    font: regularFont,
    color: rgb(0.39, 0.5, 0.62),
  });

  page.drawLine({
    start: { x: dateX, y: lineY },
    end: { x: PAGE_WIDTH - PAGE_MARGIN, y: lineY },
    color: rgb(0.37, 0.48, 0.61),
    thickness: 0.8,
  });

  page.drawText('Data', {
    x: dateX,
    y: topY - 44,
    size: 8,
    font: regularFont,
    color: rgb(0.39, 0.5, 0.62),
  });
}
