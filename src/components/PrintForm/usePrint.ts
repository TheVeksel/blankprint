// src/components/PrintForm/usePrint.ts
import { degrees, PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import RobotoFont from '../../assets/Roboto-Regular.ttf';
import type { PrintFormValues } from './PrintForm';

export type XY = { x: number; y: number };
export type XYDate = { x: number; yDay?: number; yMonth?: number; yYear?: number };

// Позиция одной строки ресурса (обычные бланки)
export interface ResourcePosition {
  resource: XY;
  dateFrom: XY;
  dateTo: XY;
  dailyLimit: XY;
  seasonLimit: XY;
}

// Специальная форма ресурсов для ваучера (min/max)
export interface VoucherResourcesPos {
  minDateFrom: XY;
  maxDateTo: XY;
}

// resources: либо массив ResourcePosition (обычный бланк),
// либо объект VoucherResourcesPos (ваучер)
export type ResourcesPositions = ResourcePosition[] | VoucherResourcesPos;

/**
 * PrintPositions — все поля, которые присутствуют у "полных" бланков,
 * но некоторые поля сделаны опциональными (например, у ваучера их может не быть).
 */
export interface PrintPositions {
  // обязательные в любом бланке
  fullName: XY;
  hunterTicketSeries: XY;
  hunterTicketNumber: XY;
  hunterIssueDate: XYDate;
  issueDate: XYDate;
  issuedBy: XY;

  // опциональные (необязательны для ваучера)
  voucherNumber?: XY;
  organizationName?: XY;
  huntingPlace?: XY;
  backIssueDate?: XYDate;
  huntType?: XY;

  // resources может быть массивом (обычный бланк) или объектом (ваучер)
  resources?: ResourcesPositions;
}

/* ---------- вспомогательные utils ---------- */

const pad2 = (num: number) => num.toString().padStart(2, '0');

// Названия месяцев в родительном падеже (например: "октября")
const MONTH_NAMES_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

export function isVoucherResources(x: ResourcesPositions | undefined): x is VoucherResourcesPos {
  return !!x && typeof x === 'object' && !Array.isArray(x) && 'minDateFrom' in (x as any) && 'maxDateTo' in (x as any);
}

export function isResourcePositions(x: ResourcesPositions | undefined): x is ResourcePosition[] {
  return Array.isArray(x);
}

/* ---------- Генерация PDF (реализация с pdf-lib) ---------- */

export const generatePdf = async ({
  hunter,
  form,
  coords,
  returnBytes = false,
}: {
  hunter: { fullName: string; series: string; number: string; issueDate: string | Date };
  form: PrintFormValues;
  coords: PrintPositions;
  returnBytes?: boolean;
}): Promise<Uint8Array | void> => {
  // Простые проверки
  if (!coords) throw new Error('generatePdf: coords is required');
  if (!coords.fullName) throw new Error('generatePdf: coords.fullName is required');
  if (!coords.hunterTicketSeries) throw new Error('generatePdf: coords.hunterTicketSeries is required');
  if (!coords.hunterTicketNumber) throw new Error('generatePdf: coords.hunterTicketNumber is required');

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes = await fetch(RobotoFont).then((res) => res.arrayBuffer());
  const font = await pdf.embedFont(fontBytes);

  // === Лицевая ===
  const front = pdf.addPage([595.28, 841.89]);
  const offsetY = 350; // двойная печать: на лицевой/дублирующей области
  const drawDouble = (text: string, x: number, y: number, size = 8) => {
    try {
      front.drawText(text ?? '', { x, y, font, size, rotate: degrees(90) });
      front.drawText(text ?? '', { x, y: y + offsetY, font, size, rotate: degrees(90) });
    } catch (e) {
      // fail-safe: ничего не ломаем в рендере
    }
  };

  // Основные поля
  drawDouble(hunter.fullName || '', coords.fullName.x, coords.fullName.y);
  drawDouble(hunter.series || '', coords.hunterTicketSeries.x, coords.hunterTicketSeries.y);
  drawDouble(hunter.number || '', coords.hunterTicketNumber.x, coords.hunterTicketNumber.y);

  // Дата выдачи охотничьего билета (ticket)
  if (hunter.issueDate && coords.hunterIssueDate) {
    const ticketDate = new Date(hunter.issueDate);
    if (!isNaN(ticketDate.getTime())) {
      const d = pad2(ticketDate.getDate());
      const monthName = MONTH_NAMES_GENITIVE[ticketDate.getMonth()] || '';
      const y2 = ticketDate.getFullYear().toString().slice(-2);
      if (coords.hunterIssueDate.yDay !== undefined) drawDouble(d, coords.hunterIssueDate.x, coords.hunterIssueDate.yDay);
      if (coords.hunterIssueDate.yMonth !== undefined) drawDouble(monthName, coords.hunterIssueDate.x, coords.hunterIssueDate.yMonth);
      if (coords.hunterIssueDate.yYear !== undefined) drawDouble(y2, coords.hunterIssueDate.x, coords.hunterIssueDate.yYear);
    }
  }

  // Поля из формы (организация, место охоты, тип охоты)
  if (coords.organizationName) drawDouble(form.organizationName || '', coords.organizationName.x, coords.organizationName.y);
  if (coords.huntingPlace) drawDouble(form.huntingPlace || '', coords.huntingPlace.x, coords.huntingPlace.y);
  if (coords.huntType) drawDouble((form as any).huntType || '', coords.huntType.x, coords.huntType.y);

  // Если есть voucherNumber — напечатаем
  if (coords.voucherNumber) {
    const vnum = (form as any).voucherNumber || '';
    drawDouble(vnum, coords.voucherNumber.x, coords.voucherNumber.y);
  }

  // Ресурсы: обычный массив (yellow/pink/blue)
  if (isResourcePositions(coords.resources)) {
    coords.resources.forEach((c, i) => {
      const r = form.resources?.[i];
      if (!r) return;

      drawDouble(r.resource || '', c.resource.x, c.resource.y);
      drawDouble(r.dailyLimit || '', c.dailyLimit.x, c.dailyLimit.y);
      drawDouble(r.seasonLimit || '', c.seasonLimit.x, c.seasonLimit.y);

      // dateFrom/dateTo формат dd.mm.yy — используем instanceof Date для безопасности типов
      const from = r.dateFrom ? new Date(r.dateFrom) : undefined;
      if (from instanceof Date && !isNaN(from.getTime())) {
        drawDouble(`${pad2(from.getDate())}.${pad2(from.getMonth() + 1)}.${from.getFullYear().toString().slice(-2)}`, c.dateFrom.x, c.dateFrom.y);
      }
      const to = r.dateTo ? new Date(r.dateTo) : undefined;
      if (to instanceof Date && !isNaN(to.getTime())) {
        drawDouble(`${pad2(to.getDate())}.${pad2(to.getMonth() + 1)}.${to.getFullYear().toString().slice(-2)}`, c.dateTo.x, c.dateTo.y);
      }
    });
  } else if (isVoucherResources(coords.resources)) {
    // Ваучер: рассчитываем min(dateFrom) и max(dateTo) по форме (если есть)
    const voucherRes = coords.resources; // теперь тип известен как VoucherResourcesPos
    let minFrom: Date | undefined;
    let maxTo: Date | undefined;

    (form.resources || []).forEach((r) => {
      const f = r.dateFrom ? new Date(r.dateFrom) : undefined;
      const t = r.dateTo ? new Date(r.dateTo) : undefined;

      if (f instanceof Date && !isNaN(f.getTime())) {
        if (!minFrom || f.getTime() < minFrom.getTime()) minFrom = f;
      }
      if (t instanceof Date && !isNaN(t.getTime())) {
        if (!maxTo || t.getTime() > maxTo.getTime()) maxTo = t;
      }
    });

    if (minFrom instanceof Date && voucherRes.minDateFrom) {
      drawDouble(`${pad2(minFrom.getDate())}.${pad2(minFrom.getMonth() + 1)}.${minFrom.getFullYear().toString().slice(-2)}`, voucherRes.minDateFrom.x, voucherRes.minDateFrom.y);
    }
    if (maxTo instanceof Date && voucherRes.maxDateTo) {
      drawDouble(`${pad2(maxTo.getDate())}.${pad2(maxTo.getMonth() + 1)}.${maxTo.getFullYear().toString().slice(-2)}`, voucherRes.maxDateTo.x, voucherRes.maxDateTo.y);
    }
  }

  // === Оборотная сторона ===
  const back = pdf.addPage([595.28, 841.89]);
  const backOffsetY = 350;
  const drawBack = (text: string, x: number, y: number, size = 8) => {
    try {
      back.drawText(text ?? '', { x, y, font, size, rotate: degrees(90) });
      back.drawText(text ?? '', { x, y: y + backOffsetY, font, size, rotate: degrees(90) });
    } catch (e) {
      // ignore
    }
  };

  // Кто выдал
  if (coords.issuedBy) {
    drawBack(form.issuedByName || '', coords.issuedBy.x, coords.issuedBy.y);
  }

  // Текущая дата на обороте — если есть coords.backIssueDate (раздельные yDay/yMonth/yYear)
  if (coords.backIssueDate) {
    const today = new Date();
    if (coords.backIssueDate.yDay !== undefined) drawBack(pad2(today.getDate()), coords.backIssueDate.x, coords.backIssueDate.yDay);
    if (coords.backIssueDate.yMonth !== undefined) drawBack(pad2(today.getMonth() + 1), coords.backIssueDate.x, coords.backIssueDate.yMonth);
    if (coords.backIssueDate.yYear !== undefined) drawBack(today.getFullYear().toString().slice(-2), coords.backIssueDate.x, coords.backIssueDate.yYear);
  }

  // Сохраняем / отдаем
  const bytes = await pdf.save(); // Uint8Array

  if (returnBytes) return bytes;

  const blob = new Blob([new Uint8Array(bytes).buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(hunter.fullName || 'document')}_разрешение.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};
