// src/components/PrintForm/usePrint.ts
import { degrees, PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import RobotoFont from '../../assets/Roboto-Regular.ttf';
import type { PrintFormValues } from './PrintForm';

export interface PrintPositions {
    fullName: { x: number; y: number };
    hunterTicketSeries: { x: number; y: number };
    hunterTicketNumber: { x: number; y: number };
    hunterIssueDate: { x: number; yDay: number; yMonth: number; yYear: number };
    issueDate: { x: number; yDay: number; yMonth: number; yYear: number };
    issuedBy: { x: number; y: number };
    organizationName: { x: number; y: number };
    huntingPlace: { x: number; y: number };
    backIssueDate: { x: number; yDay: number; yMonth: number; yYear: number };
    resources: {
        resource: { x: number; y: number };
        dateFrom: { x: number; y: number };
        dateTo: { x: number; y: number };
        dailyLimit: { x: number; y: number };
        seasonLimit: { x: number; y: number };
    }[];
}

const pad2 = (num: number) => num.toString().padStart(2, '0');

// Названия месяцев в родительном падеже (например: "октября")
const MONTH_NAMES_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

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
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const fontBytes = await fetch(RobotoFont).then(res => res.arrayBuffer());
    const font = await pdf.embedFont(fontBytes);

    // === ЛИЦЕВАЯ СТОРОНА ===
    const front = pdf.addPage([595.28, 841.89]);
    const offsetY = 350;
    const drawDouble = (text: string, x: number, y: number, size = 8) => {
        front.drawText(text, { x, y, font, size, rotate: degrees(90) });
        front.drawText(text, { x, y: y + offsetY, font, size, rotate: degrees(90) });
    };

    // Основная информация
    drawDouble(hunter.fullName || '', coords.fullName.x, coords.fullName.y);
    drawDouble(hunter.series || '', coords.hunterTicketSeries.x, coords.hunterTicketSeries.y);
    drawDouble(hunter.number || '', coords.hunterTicketNumber.x, coords.hunterTicketNumber.y);

    // Дата выдачи охот. билета — разбиваем на dd / monthName / yy
    if (hunter.issueDate) {
        const ticketDate = new Date(hunter.issueDate);
        if (!isNaN(ticketDate.getTime())) {
            const day = pad2(ticketDate.getDate());
            const monthName = MONTH_NAMES_GENITIVE[ticketDate.getMonth()] || '';
            const year2 = ticketDate.getFullYear().toString().slice(-2);

            drawDouble(day, coords.hunterIssueDate.x, coords.hunterIssueDate.yDay);
            drawDouble(monthName, coords.hunterIssueDate.x, coords.hunterIssueDate.yMonth);
            drawDouble(year2, coords.hunterIssueDate.x, coords.hunterIssueDate.yYear);
        }
    }

    // Данные из конфига / формы
    drawDouble(form.organizationName || '', coords.organizationName.x, coords.organizationName.y);
    drawDouble(form.huntingPlace || '', coords.huntingPlace.x, coords.huntingPlace.y);


    // Ресурсы
    form.resources.forEach((r, i) => {
        const c = coords.resources[i];
        if (!c) return;

        drawDouble(r.resource || '', c.resource.x, c.resource.y);
        drawDouble(r.dailyLimit || '', c.dailyLimit.x, c.dailyLimit.y);
        drawDouble(r.seasonLimit || '', c.seasonLimit.x, c.seasonLimit.y);

        // dateFrom / dateTo — печатаем как строку dd.mm.yy (если валидно)
        const from = r.dateFrom ? new Date(r.dateFrom) : null;
        if (from && !isNaN(from.getTime())) {
            drawDouble(`${pad2(from.getDate())}.${pad2(from.getMonth() + 1)}.${from.getFullYear().toString().slice(-2)}`, c.dateFrom.x, c.dateFrom.y);
        }
        const to = r.dateTo ? new Date(r.dateTo) : null;
        if (to && !isNaN(to.getTime())) {
            drawDouble(`${pad2(to.getDate())}.${pad2(to.getMonth() + 1)}.${to.getFullYear().toString().slice(-2)}`, c.dateTo.x, c.dateTo.y);
        }
    });

    // === ОБОРОТНАЯ СТОРОНА ===
    const back = pdf.addPage([595.28, 841.89]);
    const backOffsetY = 350;
    const drawBack = (text: string, x: number, y: number, size = 8) => {
        back.drawText(text, { x, y, font, size, rotate: degrees(90) });
        back.drawText(text, { x, y: y + backOffsetY, font, size, rotate: degrees(90) });
    };

    // Разрешение выдал
    drawBack(form.issuedByName || '', coords.issuedBy.x, coords.issuedBy.y);

    // Текущая дата на обороте — разбиваем на dd / mm (тут оставляем цифру) / yy
    const today = new Date();
    drawBack(pad2(today.getDate()), coords.backIssueDate.x, coords.backIssueDate.yDay);
    drawBack(pad2(today.getMonth() + 1), coords.backIssueDate.x, coords.backIssueDate.yMonth);
    drawBack(today.getFullYear().toString().slice(-2), coords.backIssueDate.x, coords.backIssueDate.yYear);

    // --- Сохранение / возврат байтов ---
    const bytes = await pdf.save(); // Uint8Array

    if (returnBytes) return bytes;

    const blob = new Blob([new Uint8Array(bytes).buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${hunter.fullName || 'document'}_разрешение.pdf`;
    a.click();
    URL.revokeObjectURL(url);
};
