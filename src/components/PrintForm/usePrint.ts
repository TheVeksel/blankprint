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
 * PrintPositions — возможные поля в шаблоне.
 * Важное: большинство полей опциональны — печатаем только те, что есть в coords.
 */
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
  resources?: ResourcesPositions;
}

/* ---------- helpers ---------- */

const pad2 = (num: number) => num.toString().padStart(2, '0');

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

/* ---------- generatePdf (voucher-safe, no back for voucher) ---------- */

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
  if (!coords) throw new Error('generatePdf: coords is required');

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes = await fetch(RobotoFont).then((res) => res.arrayBuffer());
  const font = await pdf.embedFont(fontBytes);

  const offsetY = 355; // vertical duplicate offset

  const drawOnPage = (page: any, text: string, pos: XY, yOffset = 0, size = 8) => {
    try {
      page.drawText(text ?? '', { x: pos.x, y: pos.y + yOffset, font, size, rotate: degrees(90) });
    } catch (e) {
      // fail-safe: ignore drawing error
    }
  };

  // voucherMode detection
  const voucherMode = isVoucherResources(coords.resources);

  // --- FRONT PAGE ---
  const front = pdf.addPage([595.28, 841.89]);

  const drawFrontDouble = (text: string, pos: XY) => {
    drawOnPage(front, text, pos, 0);
    drawOnPage(front, text, pos, offsetY);
  };

  // Voucher mode: conservative printing (only voucher-related + explicitly present coords)
  if (voucherMode) {
    // voucherNumber
    if (coords.voucherNumber) {
      const vnum = (form as any).voucherNumber || '';
      drawFrontDouble(vnum, coords.voucherNumber);
    }

    // voucher dates (priority: form.voucherFrom / form.voucherTo, else derive min/max)
    const vres = coords.resources as VoucherResourcesPos;
    let fromDate: Date | undefined;
    let toDate: Date | undefined;
    const rawFrom = (form as any).voucherFrom ?? null;
    const rawTo = (form as any).voucherTo ?? null;
    if (rawFrom) {
      const d = new Date(rawFrom);
      if (!isNaN(d.getTime())) fromDate = d;
    }
    if (rawTo) {
      const d = new Date(rawTo);
      if (!isNaN(d.getTime())) toDate = d;
    }
    if ((!fromDate || !toDate) && form.resources && form.resources.length) {
      form.resources.forEach((r) => {
        const f = r.dateFrom ? new Date(r.dateFrom) : undefined;
        const t = r.dateTo ? new Date(r.dateTo) : undefined;
        if (f && !isNaN(f.getTime())) {
          if (!fromDate || f.getTime() < fromDate.getTime()) fromDate = f;
        }
        if (t && !isNaN(t.getTime())) {
          if (!toDate || t.getTime() > toDate.getTime()) toDate = t;
        }
      });
    }
    if (fromDate && vres.minDateFrom) {
      drawFrontDouble(`${pad2(fromDate.getDate())}.${pad2(fromDate.getMonth() + 1)}.${fromDate.getFullYear().toString().slice(-2)}`, vres.minDateFrom);
    }
    if (toDate && vres.maxDateTo) {
      drawFrontDouble(`${pad2(toDate.getDate())}.${pad2(toDate.getMonth() + 1)}.${toDate.getFullYear().toString().slice(-2)}`, vres.maxDateTo);
    }

    // Additionally print any other fields ONLY if they are explicitly present in voucher coords.
    // This keeps voucher output minimal unless you intentionally added coords for them.
    if (coords.fullName) drawFrontDouble(hunter.fullName || '', coords.fullName);
    if (coords.hunterTicketSeries) drawFrontDouble(hunter.series || '', coords.hunterTicketSeries);
    if (coords.hunterTicketNumber) drawFrontDouble(hunter.number || '', coords.hunterTicketNumber);
    if (coords.hunterIssueDate && hunter.issueDate) {
      const hid = coords.hunterIssueDate as XYDate;
      const tdate = new Date(hunter.issueDate);
      if (!isNaN(tdate.getTime())) {
        const d = pad2(tdate.getDate());
        const m = MONTH_NAMES_GENITIVE[tdate.getMonth()] || '';
        const y2 = tdate.getFullYear().toString().slice(-2);
        if (hid.yDay !== undefined) drawFrontDouble(d, { x: hid.x, y: hid.yDay });
        if (hid.yMonth !== undefined) drawFrontDouble(m, { x: hid.x, y: hid.yMonth });
        if (hid.yYear !== undefined) drawFrontDouble(y2, { x: hid.x, y: hid.yYear });
      }
    }
    if (coords.organizationName) drawFrontDouble((form as any).organizationName || '', coords.organizationName);
    if (coords.huntingPlace) drawFrontDouble((form as any).huntingPlace || '', coords.huntingPlace);
    if (coords.huntType) drawFrontDouble((form as any).huntType || '', coords.huntType);

    // IMPORTANT: do NOT render resource rows in voucher mode (by design)
  } else {
    // --- NORMAL (non-voucher) mode ---
    if (coords.fullName) drawFrontDouble(hunter.fullName || '', coords.fullName);
    if (coords.hunterTicketSeries) drawFrontDouble(hunter.series || '', coords.hunterTicketSeries);
    if (coords.hunterTicketNumber) drawFrontDouble(hunter.number || '', coords.hunterTicketNumber);

    if (coords.hunterIssueDate && hunter.issueDate) {
      const hid = coords.hunterIssueDate as XYDate;
      const ticketDate = new Date(hunter.issueDate);
      if (!isNaN(ticketDate.getTime())) {
        const d = pad2(ticketDate.getDate());
        const monthName = MONTH_NAMES_GENITIVE[ticketDate.getMonth()] || '';
        const y2 = ticketDate.getFullYear().toString().slice(-2);
        if (hid.yDay !== undefined) drawFrontDouble(d, { x: hid.x, y: hid.yDay });
        if (hid.yMonth !== undefined) drawFrontDouble(monthName, { x: hid.x, y: hid.yMonth });
        if (hid.yYear !== undefined) drawFrontDouble(y2, { x: hid.x, y: hid.yYear });
      }
    }

    if (coords.organizationName) drawFrontDouble((form as any).organizationName || '', coords.organizationName);
    if (coords.huntingPlace) drawFrontDouble((form as any).huntingPlace || '', coords.huntingPlace);
    if (coords.huntType) drawFrontDouble((form as any).huntType || '', coords.huntType);

    // Resources table
    if (isResourcePositions(coords.resources)) {
      (coords.resources as ResourcePosition[]).forEach((c, i) => {
        const r = form.resources?.[i];
        if (!r) return;
        drawFrontDouble(r.resource || '', c.resource);
        drawFrontDouble(r.dailyLimit || '', c.dailyLimit);
        drawFrontDouble(r.seasonLimit || '', c.seasonLimit);
        if (r.dateFrom) {
          const from = new Date(r.dateFrom);
          if (!isNaN(from.getTime())) drawFrontDouble(`${pad2(from.getDate())}.${pad2(from.getMonth() + 1)}.${from.getFullYear().toString().slice(-2)}`, c.dateFrom);
        }
        if (r.dateTo) {
          const to = new Date(r.dateTo);
          if (!isNaN(to.getTime())) drawFrontDouble(`${pad2(to.getDate())}.${pad2(to.getMonth() + 1)}.${to.getFullYear().toString().slice(-2)}`, c.dateTo);
        }
      });
    }
  }

  // --- BACK PAGE: создаём и рендерим ТОЛЬКО если НЕ voucherMode ---
  if (!voucherMode) {
    const back = pdf.addPage([595.28, 841.89]);

    const drawBackSingle = (text: string, pos: XY, yOffset = 0) => {
      try {
        back.drawText(text ?? '', { x: pos.x, y: pos.y + yOffset, font, size: 8, rotate: degrees(90) });
      } catch (e) {
        // ignore
      }
    };
    const drawBackDouble = (text: string, pos: XY) => {
      drawBackSingle(text, pos, 0);
      drawBackSingle(text, pos, offsetY);
    };

    if (coords.issuedBy) {
      drawBackDouble((form as any).issuedByName || '', coords.issuedBy);
    }

    if (coords.backIssueDate) {
      const bid = coords.backIssueDate as XYDate;
      const today = new Date();
      if (bid.yDay !== undefined) drawBackDouble(pad2(today.getDate()), { x: bid.x, y: bid.yDay });
      if (bid.yMonth !== undefined) drawBackDouble(pad2(today.getMonth() + 1), { x: bid.x, y: bid.yMonth });
      if (bid.yYear !== undefined) drawBackDouble(today.getFullYear().toString().slice(-2), { x: bid.x, y: bid.yYear });
    }
  }

  // --- Save & return ---
  const bytes = await pdf.save();
  if (returnBytes) return bytes;

   const blob = new Blob([new Uint8Array(bytes).buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(hunter.fullName || 'document')}_разрешение.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};
