import { ShiftPeriod, ShiftSlotDayType } from '@prisma/client';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 18;
const LABEL_COLUMN_WIDTH = 92;
const HEADER_BLOCK_HEIGHT = 70;
const BASE_WEEK_TITLE_HEIGHT = 11;
const BASE_WEEK_HEADER_ROW_HEIGHT = 14;
const BASE_WEEK_BODY_ROW_HEIGHT = 13;
const BASE_WEEK_GAP = 6;

const PERIODS: ShiftPeriod[] = ['MORNING', 'INTERMEDIATE', 'AFTERNOON', 'NIGHT'];

const PERIOD_LABELS: Record<ShiftPeriod, string> = {
  MORNING: 'Manhã',
  INTERMEDIATE: 'Intermediário',
  AFTERNOON: 'Tarde',
  NIGHT: 'Noite',
};

const DAY_LABELS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const COLORS = {
  pageBackground: rgb(0.983, 0.988, 0.995),
  ink: rgb(0.16, 0.18, 0.22),
  mutedInk: rgb(0.38, 0.41, 0.47),
  white: rgb(1, 1, 1),
  border: rgb(0.79, 0.84, 0.9),
  headerBand: rgb(0.95, 0.975, 1),
  headerAccent: rgb(0.82, 0.9, 0.98),
  headerMeta: rgb(0.38, 0.45, 0.55),
  weekTitleFill: rgb(0.93, 0.965, 0.995),
  weekTitleText: rgb(0.25, 0.34, 0.46),
  blankCell: rgb(0.95, 0.965, 0.98),
  blankText: rgb(0.68, 0.73, 0.79),
  weekdayHeader: rgb(0.95, 0.975, 1),
  weekendHeader: rgb(0.935, 0.965, 0.995),
  weekdayDay: rgb(0.985, 0.993, 1),
  weekendDay: rgb(0.965, 0.982, 0.998),
};

const PERIOD_COLORS: Record<ShiftPeriod, { labelFill: RGB; valueFill: RGB; labelText: RGB }> = {
  MORNING: {
    labelFill: rgb(0.9, 0.95, 0.995),
    valueFill: rgb(0.972, 0.989, 1),
    labelText: rgb(0.24, 0.34, 0.48),
  },
  INTERMEDIATE: {
    labelFill: rgb(0.915, 0.948, 0.99),
    valueFill: rgb(0.976, 0.988, 0.999),
    labelText: rgb(0.25, 0.35, 0.47),
  },
  AFTERNOON: {
    labelFill: rgb(0.922, 0.955, 0.992),
    valueFill: rgb(0.978, 0.99, 1),
    labelText: rgb(0.24, 0.34, 0.46),
  },
  NIGHT: {
    labelFill: rgb(0.93, 0.958, 0.994),
    valueFill: rgb(0.981, 0.992, 1),
    labelText: rgb(0.24, 0.33, 0.45),
  },
};

export interface MonthlyExportTeamSlot {
  id: number;
  period: ShiftPeriod;
  dayType: ShiftSlotDayType;
  description: string;
  sortOrder: number;
}

export interface MonthlyExportTeam {
  id: number;
  name: string;
  shiftSlots: MonthlyExportTeamSlot[];
}

export interface MonthlyExportShift {
  id: number;
  date: Date;
  period: ShiftPeriod;
  physiotherapist: {
    name: string;
  };
  shiftTeamSlot: {
    id: number;
    description: string;
    sortOrder: number;
    dayType: ShiftSlotDayType;
    period: ShiftPeriod;
  };
}

interface MonthlyShiftPdfParams {
  team: MonthlyExportTeam;
  year: number;
  month: number;
  shifts: MonthlyExportShift[];
  holidayDates: string[];
}

interface CalendarDay {
  date: Date | null;
}

interface SlotRow {
  slotId: number;
  label: string;
  period: ShiftPeriod;
  values: string[];
}

interface WeekSection {
  title: string;
  days: CalendarDay[];
  rows: SlotRow[];
}

interface LayoutMetrics {
  weekTitleHeight: number;
  headerRowHeight: number;
  bodyRowHeight: number;
  weekGap: number;
  titleFontSize: number;
  dayFontSize: number;
  dayNumberFontSize: number;
  labelFontSize: number;
  valueFontSize: number;
}

type ShiftIndex = Record<string, Record<number, string>>;
type SlotRegistry = Map<number, MonthlyExportTeamSlot>;

export async function generateMonthlyShiftPdf({
  team,
  year,
  month,
  shifts,
  holidayDates,
}: MonthlyShiftPdfParams): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const holidays = new Set(holidayDates);
  const slotRegistry = buildSlotRegistry(team.shiftSlots, shifts);
  const shiftIndex = buildShiftIndex(shifts);
  const weeks = buildWeeksForMonth(year, month);
  const sections = weeks.map((week, index) => buildWeekSection(week, holidays, shiftIndex, slotRegistry, index + 1));
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const layout = calculateLayout(sections);

  drawPageBackground(page);

  let cursorY = drawPageHeader(page, boldFont, regularFont, team.name, year, month);

  sections.forEach((section, index) => {
    cursorY = drawWeekSection(page, cursorY, section, regularFont, boldFont, layout);

    if (index < sections.length - 1) {
      cursorY -= layout.weekGap;
    }
  });

  return pdfDoc.save();
}

function buildSlotRegistry(teamSlots: MonthlyExportTeamSlot[], shifts: MonthlyExportShift[]): SlotRegistry {
  const registry = new Map<number, MonthlyExportTeamSlot>();

  for (const slot of teamSlots) {
    registry.set(slot.id, slot);
  }

  for (const shift of shifts) {
    registry.set(shift.shiftTeamSlot.id, {
      id: shift.shiftTeamSlot.id,
      description: shift.shiftTeamSlot.description,
      sortOrder: shift.shiftTeamSlot.sortOrder,
      dayType: shift.shiftTeamSlot.dayType,
      period: shift.shiftTeamSlot.period,
    });
  }

  return registry;
}

function drawPageBackground(page: PDFPage) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: COLORS.pageBackground,
  });
}

function buildShiftIndex(shifts: MonthlyExportShift[]): ShiftIndex {
  const index = {} as ShiftIndex;

  for (const shift of shifts) {
    const dateKey = formatStoredDate(shift.date);

    if (!index[dateKey]) {
      index[dateKey] = {};
    }

    index[dateKey][shift.shiftTeamSlot.id] = shift.physiotherapist.name;
  }

  return index;
}

function buildWeeksForMonth(year: number, month: number): CalendarDay[][] {
  const weeks: CalendarDay[][] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  let currentWeek: CalendarDay[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const currentDate = new Date(year, month - 1, day);
    const mondayIndex = getMondayIndex(currentDate);

    if (currentWeek.length === 0) {
      for (let blank = 0; blank < mondayIndex; blank += 1) {
        currentWeek.push({ date: null });
      }
    }

    currentWeek.push({ date: currentDate });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ date: null });
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

function buildWeekSection(
  days: CalendarDay[],
  holidays: Set<string>,
  shiftIndex: ShiftIndex,
  slotRegistry: SlotRegistry,
  weekIndex: number
): WeekSection {
  const rows: SlotRow[] = [];

  for (const period of PERIODS) {
    const slotIds = getWeekSlotIdsForPeriod(days, period, holidays, shiftIndex, slotRegistry);

    for (const slotId of slotIds) {
      const slot = slotRegistry.get(slotId);
      if (!slot) continue;

      rows.push({
        slotId,
        period,
        label: `${PERIOD_LABELS[period]} - ${slot.description}`,
        values: days.map((day) => {
          if (!day.date) return '';
          const dateKey = formatLocalDate(day.date);
          return formatDisplayName(shiftIndex[dateKey]?.[slotId] ?? '');
        }),
      });
    }
  }

  return {
    title: buildWeekTitle(days, weekIndex),
    days,
    rows,
  };
}

function getWeekSlotIdsForPeriod(
  days: CalendarDay[],
  period: ShiftPeriod,
  holidays: Set<string>,
  shiftIndex: ShiftIndex,
  slotRegistry: SlotRegistry
) {
  const slotMap = new Map<number, MonthlyExportTeamSlot>();

  for (const day of days) {
    if (!day.date) continue;

    const dayType = getDayType(day.date, holidays);

    for (const slot of slotRegistry.values()) {
      if (slot.period === period && slot.dayType === dayType) {
        slotMap.set(slot.id, slot);
      }
    }

    const dateKey = formatLocalDate(day.date);
    const shiftSlots = shiftIndex[dateKey] ?? {};

    for (const slotIdKey of Object.keys(shiftSlots)) {
      const slotId = Number(slotIdKey);
      const slot = slotRegistry.get(slotId);
      if (slot && slot.period === period && slot.dayType === dayType) {
        slotMap.set(slot.id, slot);
      }
    }
  }

  return [...slotMap.values()]
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.description.localeCompare(right.description, 'pt-BR');
    })
    .map((slot) => slot.id);
}

function buildWeekTitle(days: CalendarDay[], weekIndex: number) {
  const activeDays = days.filter((day) => day.date).map((day) => day.date as Date);

  if (activeDays.length === 0) {
    return `Semana ${weekIndex}`;
  }

  const first = activeDays[0];
  const last = activeDays[activeDays.length - 1];

  return `Semana ${weekIndex}  •  ${String(first.getDate()).padStart(2, '0')} a ${String(last.getDate()).padStart(2, '0')}`;
}

function calculateLayout(sections: WeekSection[]): LayoutMetrics {
  const availableHeight = PAGE_HEIGHT - PAGE_MARGIN * 2 - HEADER_BLOCK_HEIGHT;
  const baseContentHeight =
    sections.reduce((total, section) => {
      return (
        total +
        BASE_WEEK_TITLE_HEIGHT +
        BASE_WEEK_HEADER_ROW_HEIGHT * 2 +
        BASE_WEEK_BODY_ROW_HEIGHT * section.rows.length
      );
    }, 0) +
    BASE_WEEK_GAP * Math.max(0, sections.length - 1);

  const scale = Math.min(1, availableHeight / Math.max(baseContentHeight, 1));

  return {
    weekTitleHeight: Math.max(5.8, BASE_WEEK_TITLE_HEIGHT * scale),
    headerRowHeight: Math.max(6.4, BASE_WEEK_HEADER_ROW_HEIGHT * scale),
    bodyRowHeight: Math.max(5.3, BASE_WEEK_BODY_ROW_HEIGHT * scale),
    weekGap: Math.max(1.4, BASE_WEEK_GAP * scale),
    titleFontSize: Math.max(4.8, 7 * scale),
    dayFontSize: Math.max(4.2, 7.2 * scale),
    dayNumberFontSize: Math.max(4.4, 7.4 * scale),
    labelFontSize: Math.max(4.1, 6.4 * scale),
    valueFontSize: Math.max(4.6, 7.4 * scale),
  };
}

function drawPageHeader(
  page: PDFPage,
  boldFont: PDFFont,
  regularFont: PDFFont,
  teamName: string,
  year: number,
  month: number
): number {
  const bandHeight = 58;
  const bandY = PAGE_HEIGHT - bandHeight;
  const monthLabel = capitalize(
    new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month - 1, 1))
  );

  page.drawRectangle({
    x: 0,
    y: bandY,
    width: PAGE_WIDTH,
    height: bandHeight,
    color: COLORS.headerBand,
  });

  page.drawRectangle({
    x: 0,
    y: bandY,
    width: PAGE_WIDTH,
    height: 3,
    color: COLORS.headerAccent,
  });

  page.drawText('Escala Mensal de Plantões', {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 23,
    size: 14,
    font: boldFont,
    color: COLORS.ink,
  });

  page.drawText(teamName, {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 37,
    size: 9.8,
    font: regularFont,
    color: COLORS.headerMeta,
  });

  page.drawText('Furquim Fisioterapia', {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 51,
    size: 7.4,
    font: regularFont,
    color: COLORS.mutedInk,
  });

  const badgeWidth = Math.max(108, boldFont.widthOfTextAtSize(monthLabel, 9.1) + 18);
  const badgeX = PAGE_WIDTH - PAGE_MARGIN - badgeWidth;

  page.drawRectangle({
    x: badgeX,
    y: PAGE_HEIGHT - 43,
    width: badgeWidth,
    height: 22,
    color: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 0.55,
  });

  page.drawText(monthLabel, {
    x: badgeX + 9,
    y: PAGE_HEIGHT - 34.5,
    size: 9.1,
    font: boldFont,
    color: COLORS.ink,
  });

  return PAGE_HEIGHT - HEADER_BLOCK_HEIGHT;
}

function drawWeekSection(
  page: PDFPage,
  topY: number,
  section: WeekSection,
  regularFont: PDFFont,
  boldFont: PDFFont,
  layout: LayoutMetrics
): number {
  const dayColumnWidth = (PAGE_WIDTH - PAGE_MARGIN * 2 - LABEL_COLUMN_WIDTH) / 7;
  const totalWidth = LABEL_COLUMN_WIDTH + dayColumnWidth * 7;
  let cursorY = topY;

  drawCell(page, PAGE_MARGIN, cursorY, totalWidth, layout.weekTitleHeight, COLORS.weekTitleFill, COLORS.border, 0.55);
  page.drawRectangle({
    x: PAGE_MARGIN,
    y: cursorY - layout.weekTitleHeight,
    width: 4,
    height: layout.weekTitleHeight,
    color: COLORS.headerAccent,
  });
  drawCellText(
    page,
    section.title,
    PAGE_MARGIN + 8,
    cursorY,
    totalWidth - 8,
    layout.weekTitleHeight,
    boldFont,
    layout.titleFontSize,
    'left',
    COLORS.weekTitleText
  );

  cursorY -= layout.weekTitleHeight;

  drawCell(page, PAGE_MARGIN, cursorY, LABEL_COLUMN_WIDTH, layout.headerRowHeight, COLORS.weekdayHeader, COLORS.border, 0.55);
  drawCellText(page, 'Vaga', PAGE_MARGIN, cursorY, LABEL_COLUMN_WIDTH, layout.headerRowHeight, boldFont, layout.dayFontSize, 'center', COLORS.mutedInk);

  DAY_LABELS.forEach((dayLabel, index) => {
    const x = PAGE_MARGIN + LABEL_COLUMN_WIDTH + dayColumnWidth * index;
    const fill = index >= 5 ? COLORS.weekendHeader : COLORS.weekdayHeader;
    drawCell(page, x, cursorY, dayColumnWidth, layout.headerRowHeight, fill, COLORS.border, 0.55);
    drawCellText(page, dayLabel, x, cursorY, dayColumnWidth, layout.headerRowHeight, boldFont, layout.dayFontSize, 'center', COLORS.mutedInk);
  });

  cursorY -= layout.headerRowHeight;

  drawCell(page, PAGE_MARGIN, cursorY, LABEL_COLUMN_WIDTH, layout.headerRowHeight, COLORS.white, COLORS.border, 0.55);
  drawCellText(page, 'Dia', PAGE_MARGIN, cursorY, LABEL_COLUMN_WIDTH, layout.headerRowHeight, boldFont, layout.dayNumberFontSize, 'center', COLORS.ink);

  section.days.forEach((day, index) => {
    const x = PAGE_MARGIN + LABEL_COLUMN_WIDTH + dayColumnWidth * index;
    const fill = !day.date ? COLORS.blankCell : index >= 5 ? COLORS.weekendDay : COLORS.weekdayDay;

    drawCell(page, x, cursorY, dayColumnWidth, layout.headerRowHeight, fill, COLORS.border, 0.55);
    drawCellText(
      page,
      day.date ? String(day.date.getDate()).padStart(2, '0') : '',
      x,
      cursorY,
      dayColumnWidth,
      layout.headerRowHeight,
      boldFont,
      layout.dayNumberFontSize,
      'center',
      day.date ? COLORS.ink : COLORS.blankText
    );
  });

  cursorY -= layout.headerRowHeight;

  for (const row of section.rows) {
    const palette = PERIOD_COLORS[row.period];

    drawCell(page, PAGE_MARGIN, cursorY, LABEL_COLUMN_WIDTH, layout.bodyRowHeight, palette.labelFill, COLORS.border, 0.5);
    drawCellText(
      page,
      row.label,
      PAGE_MARGIN,
      cursorY,
      LABEL_COLUMN_WIDTH,
      layout.bodyRowHeight,
      boldFont,
      layout.labelFontSize,
      'left',
      palette.labelText,
      layout.labelFontSize,
      false
    );

    row.values.forEach((value, index) => {
      const x = PAGE_MARGIN + LABEL_COLUMN_WIDTH + dayColumnWidth * index;
      const isBlankDay = !section.days[index]?.date;
      const fill = isBlankDay ? COLORS.blankCell : palette.valueFill;

      drawCell(page, x, cursorY, dayColumnWidth, layout.bodyRowHeight, fill, COLORS.border, 0.5);
      drawCellText(
        page,
        value,
        x,
        cursorY,
        dayColumnWidth,
        layout.bodyRowHeight,
        boldFont,
        layout.valueFontSize,
        'center',
        isBlankDay ? COLORS.blankText : COLORS.ink,
        layout.valueFontSize,
        false
      );
    });

    cursorY -= layout.bodyRowHeight;
  }

  return cursorY;
}

function drawCell(
  page: PDFPage,
  x: number,
  topY: number,
  width: number,
  height: number,
  fillColor: RGB,
  borderColor: RGB,
  borderWidth: number
) {
  page.drawRectangle({
    x,
    y: topY - height,
    width,
    height,
    color: fillColor,
    borderColor,
    borderWidth,
  });
}

function drawCellText(
  page: PDFPage,
  text: string,
  x: number,
  topY: number,
  width: number,
  height: number,
  font: PDFFont,
  initialFontSize: number,
  align: 'left' | 'center',
  color: RGB,
  minFontSize = 4.4,
  shrinkToFit = true
) {
  const content = fitText(text, font, initialFontSize, width - 8, minFontSize, shrinkToFit);
  const textWidth = font.widthOfTextAtSize(content.text, content.fontSize);
  const textX = align === 'left' ? x + 4 : x + (width - textWidth) / 2;
  const textY = topY - height + (height - content.fontSize) / 2 + 1.15;

  page.drawText(content.text, {
    x: textX,
    y: textY,
    size: content.fontSize,
    font,
    color,
  });
}

function fitText(
  text: string,
  font: PDFFont,
  initialFontSize: number,
  maxWidth: number,
  minFontSize: number,
  shrinkToFit: boolean
) {
  let fontSize = initialFontSize;
  const normalizedText = text.trim();

  if (!normalizedText) {
    return { text: '', fontSize };
  }

  if (shrinkToFit) {
    while (fontSize > minFontSize && font.widthOfTextAtSize(normalizedText, fontSize) > maxWidth) {
      fontSize -= 0.2;
    }
  }

  if (font.widthOfTextAtSize(normalizedText, fontSize) <= maxWidth) {
    return { text: normalizedText, fontSize };
  }

  let truncated = normalizedText;

  while (truncated.length > 1 && font.widthOfTextAtSize(`${truncated}...`, fontSize) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }

  return {
    text: `${truncated}...`,
    fontSize,
  };
}

function formatStoredDate(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function formatLocalDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function getDayType(date: Date, holidays: Set<string>): ShiftSlotDayType {
  return date.getDay() === 0 || date.getDay() === 6 || holidays.has(formatLocalDate(date)) ? 'WEEKEND' : 'WEEKDAY';
}

function getMondayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function formatDisplayName(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (!normalized) return '';

  const parts = normalized.split(' ');
  const displayName = parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1]}`;

  return displayName.toLocaleUpperCase('pt-BR');
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
