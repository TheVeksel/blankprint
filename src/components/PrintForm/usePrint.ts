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

const formatDate = (dateStr: string | Date) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear().toString().slice(-2)}`;
};

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
}) => {
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

    drawDouble(hunter.fullName, coords.fullName.x, coords.fullName.y);
    drawDouble(hunter.series, coords.hunterTicketSeries.x, coords.hunterTicketSeries.y);
    drawDouble(hunter.number, coords.hunterTicketNumber.x, coords.hunterTicketNumber.y);

    const ticketDate = new Date(hunter.issueDate);
    drawDouble(formatDate(ticketDate), coords.hunterIssueDate.x, coords.hunterIssueDate.yDay);
    drawDouble(form.organizationName, coords.organizationName.x, coords.organizationName.y);
    drawDouble(form.huntingPlace, coords.huntingPlace.x, coords.huntingPlace.y);

    form.resources.forEach((r, i) => {
        const c = coords.resources[i];
        if (!c) return;

        drawDouble(r.resource, c.resource.x, c.resource.y);
        drawDouble(r.dailyLimit, c.dailyLimit.x, c.dailyLimit.y);
        drawDouble(r.seasonLimit, c.seasonLimit.x, c.seasonLimit.y);

        drawDouble(formatDate(r.dateFrom), c.dateFrom.x, c.dateFrom.y);
        drawDouble(formatDate(r.dateTo), c.dateTo.x, c.dateTo.y);
    });

    // === ОБОРОТНАЯ СТОРОНА ===
    const back = pdf.addPage([595.28, 841.89]);
    const backOffsetY = 350;
    const drawBack = (text: string, x: number, y: number, size = 8) => {
        back.drawText(text, { x, y, font, size, rotate: degrees(90) });
        back.drawText(text, { x, y: y + backOffsetY, font, size, rotate: degrees(90) });
    };

    drawBack(form.issuedByName, coords.issuedBy.x, coords.issuedBy.y);

    const today = new Date();
    drawBack(formatDate(today), coords.backIssueDate.x, coords.backIssueDate.yDay);

    const bytes = await pdf.save();

    if (returnBytes) return bytes;

    // Скачивание PDF по умолчанию
    const blob = new Blob([new Uint8Array(bytes).buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${hunter.fullName}_разрешение.pdf`;
    a.click();
    URL.revokeObjectURL(url);
};
