// src/components/PrintForm/usePrint.ts
import { degrees, PDFDocument, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { PrintFormValues } from './PrintForm';

export type XY = { x: number; y: number };
export type XYDate = { x: number; yDay?: number; yMonth?: number; yYear?: number };

export interface ResourcePosition {
  resource: XY;
  dateFrom: XY;
  dateTo: XY;
  dailyLimit: XY;
  seasonLimit: XY;
}

export interface VoucherResourcesPos {
  minDateFrom: XY;
  maxDateTo: XY;
  specialMark: XY;
}

export type ResourcesPositions = ResourcePosition[] | VoucherResourcesPos;

export interface PrintPositions {
  fullName?: XY;
  hunterTicketSeries?: XY;
  hunterTicketNumber?: XY;
  hunterIssueDate?: XYDate;
  issueDate?: XYDate;
  issuedBy?: XY;
  voucherNumber?: XY;
  organizationName?: XY;
  huntingPlace?: XY;
  backIssueDate?: XYDate;
  huntType?: XY;
  jobTitle?: XY;
  voucherNote?: XY;
  voucherPermissionNumber?:XY;
  resources?: ResourcesPositions;

  // поля задней стороны
  backFullName?: XY;
  backOrganizationName?: XY;
  backIssueBy?: XY;
}

const pad2 = (n: number) => n.toString().padStart(2, '0');

const MONTH_NAMES_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export function isVoucherResources(x: ResourcesPositions | undefined): x is VoucherResourcesPos {
  return !!x && typeof x === 'object' && !Array.isArray(x) && 'minDateFrom' in x && 'maxDateTo' in x;
}

export function isResourcePositions(x: ResourcesPositions | undefined): x is ResourcePosition[] {
  return Array.isArray(x);
}

const drawText = (page: any, text: string, pos: XY, font: any, size = 8, rotateDeg = 0) => {
  try {
    page.drawText(text ?? '', { x: pos.x, y: pos.y, font, size, rotate: degrees(rotateDeg) });
  } catch (err) {
    // тихо проглотим ошибки отрисовки, можно раскомментировать для дебага
    // console.error('drawText error', err, { text, pos, size, rotateDeg });
  }
};

/* ---------- Загрузка единственного шрифта (Roboto) ---------- */
// Путь к вашему Roboto в public/
const FONT_PATH = '/Roboto-Regular.ttf';

const loadRoboto = async (pdf: PDFDocument): Promise<any> => {
  try {
    pdf.registerFontkit(fontkit);
  } catch (e) {
    // регистрация может быть уже выполнена — игнорируем
  }

  try {
    const res = await fetch(FONT_PATH);
    if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    return await pdf.embedFont(arrayBuffer as any);
  } catch (err) {
    console.warn(`Не удалось загрузить шрифт Roboto по ${FONT_PATH}. Использую StandardFonts.TimesRoman как запасной.`, err);
    return await pdf.embedFont(StandardFonts.TimesRoman);
  }
};

/* ---------- Генерация PDF для бланков ---------- */
export const generateBlankPdf = async (hunter: any, form: PrintFormValues, coords: PrintPositions) => {
  const pdf = await PDFDocument.create();
  const font = await loadRoboto(pdf);
  const offsetY = 355;

  /* FRONT */
  const front = pdf.addPage([595.28, 841.89]);
  const drawFrontDouble = (text: string, pos: XY) => {
    drawText(front, text, pos, font, 8, 90);
    drawText(front, text, { x: pos.x, y: pos.y + offsetY }, font, 8, 90);
  };

  if (coords.fullName) drawFrontDouble(hunter.fullName || '', coords.fullName);
  if (coords.hunterTicketSeries) drawFrontDouble(hunter.series || '', coords.hunterTicketSeries);
  if (coords.hunterTicketNumber) drawFrontDouble(hunter.number || '', coords.hunterTicketNumber);

  if (coords.hunterIssueDate && hunter.issueDate) {
    const d = new Date(hunter.issueDate);
    if (!isNaN(d.getTime())) {
      const hid = coords.hunterIssueDate!;
      const day = pad2(d.getDate());
      const month = MONTH_NAMES_GENITIVE[d.getMonth()] ?? '';
      const year = d.getFullYear().toString().slice(-2);
      if (hid.yDay) drawFrontDouble(day, { x: hid.x, y: hid.yDay });
      if (hid.yMonth) drawFrontDouble(month, { x: hid.x, y: hid.yMonth });
      if (hid.yYear) drawFrontDouble(year, { x: hid.x, y: hid.yYear });
    }
  }

  if (coords.organizationName) drawFrontDouble((form as any).organizationName || '', coords.organizationName);
  if (coords.huntingPlace) drawFrontDouble((form as any).huntingPlace || '', coords.huntingPlace);
  if (coords.huntType) drawFrontDouble((form as any).huntType || '', coords.huntType);

  if (isResourcePositions(coords.resources)) {
    (coords.resources as ResourcePosition[]).forEach((c, i) => {
      const r = form.resources?.[i];
      if (!r) return;
      drawFrontDouble(r.resource || '', c.resource);
      drawFrontDouble(r.dailyLimit || '', c.dailyLimit);
      drawFrontDouble(r.seasonLimit || '', c.seasonLimit);
      if (r.dateFrom) {
        const d = new Date(r.dateFrom);
        if (!isNaN(d.getTime()))
          drawFrontDouble(`${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear().toString().slice(-2)}`, c.dateFrom);
      }
      if (r.dateTo) {
        const d = new Date(r.dateTo);
        if (!isNaN(d.getTime()))
          drawFrontDouble(`${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear().toString().slice(-2)}`, c.dateTo);
      }
    });
  }

  /* BACK */
  const back = pdf.addPage([595.28, 841.89]);
  const drawBackDouble = (text: string, pos: XY) => {
    drawText(back, text, pos, font, 8, 90);
    drawText(back, text, { x: pos.x, y: pos.y + offsetY }, font, 8, 90);
  };

  if (coords.backFullName) drawBackDouble(hunter.fullName || '', coords.backFullName);
  if (coords.backOrganizationName) drawBackDouble((form as any).organizationName || '', coords.backOrganizationName);

  const backIssuedByText = (form as any).issuedBy ?? (form as any).issuedByName ?? '';
  if (coords.issuedBy) drawBackDouble(backIssuedByText, coords.issuedBy);

  if (coords.backIssueDate && (form as any).issueDate) {
    const d = new Date((form as any).issueDate);
    if (!isNaN(d.getTime())) {
      const bid = coords.backIssueDate!;
      const day = pad2(d.getDate());
      const month = pad2(d.getMonth() + 1);
      const year = d.getFullYear().toString().slice(-2);
      if (bid.yDay) drawBackDouble(day, { x: bid.x, y: bid.yDay });
      if (bid.yMonth) drawBackDouble(month, { x: bid.x, y: bid.yMonth });
      if (bid.yYear) drawBackDouble(year, { x: bid.x, y: bid.yYear });
    }
  }

  return pdf.save();
};

/* ---------- Генерация PDF для ваучеров (с подложкой putevka.pdf) ---------- */
export const generateVoucherPdf = async (
  hunter: any,
  form: PrintFormValues & { voucherFrom?: string; voucherTo?: string },
  coords: PrintPositions
) => {
  // Загружаем PDF фон
  const bgBytes = await fetch('/putevka.pdf').then(r => r.arrayBuffer());
  const bgPdf = await PDFDocument.load(bgBytes);

  // Создаем новый PDF и копируем страницу фона
  const pdf = await PDFDocument.create();
  const [bgPage] = await pdf.copyPages(bgPdf, [0]);
  pdf.addPage(bgPage);
  const page = pdf.getPage(0);

  const font = await loadRoboto(pdf);

  // Горизонтальный сдвиг для дублирования (подогнать под шаблон)
  const OFFSET_X = 387;

  // Утилита: получить XY из XYDate (TS-совместимо)
  const xyFromDatePos = (dpos?: XYDate): XY => {
    if (!dpos) return { x: 0, y: 0 };
    const y = dpos.yDay ?? dpos.yMonth ?? dpos.yYear ?? 0;
    return { x: dpos.x, y };
  };

  // Функция дублирования (вправо по X)
  const drawDoubleX = (text: string, pos: XY, size = 8) => {
    if (!text) return;
    try {
      // левая
      page.drawText(text, { x: pos.x, y: pos.y, font, size });
      // правая (сдвиг по X)
      page.drawText(text, { x: pos.x + OFFSET_X, y: pos.y, font, size });
    } catch (err) {
      console.warn('drawDoubleX error', text, pos, err);
    }
  };

  // Поля ваучера — используем drawDoubleX
  if (coords.voucherNumber) drawDoubleX((form as any).voucherNumber || '', coords.voucherNumber as XY);
  if (coords.fullName) {
    let nameText = hunter.fullName || '';

    // Преобразуем "Фамилия Имя Отчество" → "Фамилия И.О."
    const parts = nameText.trim().split(/\s+/);
    if (parts.length >= 2) {
      const [last, first, middle] = parts;
      nameText = `${last} ${first?.[0] ?? ''}.${middle ? middle[0] + '.' : ''}`;
    }

    drawDoubleX(nameText, coords.fullName as XY);
  }
  if (coords.hunterTicketSeries) drawDoubleX(hunter.series || '', coords.hunterTicketSeries as XY);
  if (coords.hunterTicketNumber) drawDoubleX(hunter.number || '', coords.hunterTicketNumber as XY);
  if (coords.jobTitle) drawDoubleX((form as any).jobTitle || '', coords.jobTitle as XY);
  if (coords.voucherNote) drawDoubleX((form as any).voucherNote || '', coords.voucherNote as XY);

  // Дата выдачи охотничьего билета (используем xyFromDatePos чтобы получить XY)
  if (coords.hunterIssueDate && hunter.issueDate) {
    const d = new Date(hunter.issueDate);
    if (!isNaN(d.getTime())) {
      const str = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
      const posXY = xyFromDatePos(coords.hunterIssueDate);
      drawDoubleX(str, posXY);
    }
  }

  // Дата выдачи путевки (issueDate) — может быть указана как XYDate
  if (coords.issueDate) {
    const date = (form as any).issueDate ? new Date((form as any).issueDate) : new Date();
    if (!isNaN(date.getTime())) {
      const id = coords.issueDate;
      const formatted = `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
      const y = (id as any).y ?? (id as any).yDay ?? (id as any).yMonth ?? (id as any).yYear ?? 0;
      drawDoubleX(formatted, { x: id.x, y });
    }
  }


  // issuedBy — рисуем только если есть coords.issuedBy AND текст
  const issuedByText = (form as any).issuedBy ?? (form as any).issuedByName ?? '';
  if (coords.issuedBy && issuedByText) {
    drawDoubleX(issuedByText, coords.issuedBy as XY);
  }
  const specialMarkText = (form as any).specialMark ?? '';
  if (isVoucherResources(coords.resources) && coords.resources.specialMark && specialMarkText) {
    drawDoubleX(specialMarkText, coords.resources.specialMark);
  }
  const voucherPermissionNumberText = (form as any).voucherPermissionNumber ?? '';
  if (coords.voucherPermissionNumber && voucherPermissionNumberText) {
    drawDoubleX(voucherPermissionNumberText, coords.voucherPermissionNumber);
  }

  // Даты действия путевки (minDateFrom / maxDateTo)
  if (isVoucherResources(coords.resources)) {
    const vres = coords.resources;
    const from = form.voucherFrom ? new Date(form.voucherFrom) : undefined;
    const to = form.voucherTo ? new Date(form.voucherTo) : undefined;
    if (from) drawDoubleX(`${pad2(from.getDate())}.${pad2(from.getMonth() + 1)}.${from.getFullYear().toString().slice(-2)}`, vres.minDateFrom);
    if (to) drawDoubleX(`${pad2(to.getDate())}.${pad2(to.getMonth() + 1)}.${to.getFullYear().toString().slice(-2)}`, vres.maxDateTo);
  }

  return pdf.save();
};

/* ---------- Сам usePrint ---------- */
export const usePrint = () => {
  const printPdf = async (type: 'blank' | 'voucher', hunter: any, form: PrintFormValues, coords: PrintPositions) => {
    const bytes =
      type === 'voucher'
        ? await generateVoucherPdf(hunter, form as any, coords)
        : await generateBlankPdf(hunter, form, coords);

    const blob = new Blob([new Uint8Array(bytes).buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(hunter.fullName || 'document')}_${type === 'voucher' ? 'ваучер' : 'разрешение'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return { printPdf };
};
