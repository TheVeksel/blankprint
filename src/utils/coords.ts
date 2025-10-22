// src/utils/coords.ts
import type { PrintFormValues } from '../components/PrintForm/PrintForm';

// Возвращаемая структура — совпадает с тем, что ожидает usePrint.generatePdf
export type BlankType = 'Yellow' | 'Pink' | 'Blue';

export const getCoordsForBlank = (blank: BlankType) => (data: PrintFormValues) => {
  // === ЖЁЛТЫЙ (пример) ===
  const yellow = {
    fullName: { x: 455, y: 95 },
    hunterTicketSeries: { x: 498, y: 115 },
    hunterTicketNumber: { x: 498, y: 165 },
    hunterIssueDate: { x: 521, yDay: 120, yMonth: 150, yYear: 255 },
    issueDate: { x: 120, yDay: 660, yMonth: 680, yYear: 700 },
    issuedBy: { x: 31, y: 245 },
    organizationName: { x: 45, y: 20 },
    huntingPlace: { x: 346, y: 70 },
    backIssueDate: { x: 60, yDay: 262, yMonth: 285, yYear: 393 },
    huntType: { x: 540, y: 55 },
    resources: data.resources.map((_, i) => ({
      resource: { x: 171 + i * 17, y: 40 },
      dateFrom: { x: 173 + i * 17, y: 143 },
      dateTo: { x: 173 + i * 17, y: 190 },
      dailyLimit: { x: 173 + i * 17, y: 250 },
      seasonLimit: { x: 173 + i * 17, y: 295 },
    })),
  };

  const pink = {fullName: { x: 457, y: 95 },
    hunterTicketSeries: { x: 501, y: 115 },
    hunterTicketNumber: { x: 501, y: 165 },
    hunterIssueDate: { x: 523, yDay: 120, yMonth: 150, yYear: 255 },
    issueDate: { x: 120, yDay: 660, yMonth: 680, yYear: 700 },
    issuedBy: { x: 120, y: 245 },
    organizationName: { x: 45, y: 20 },
    huntingPlace: { x: 348, y: 70 },
    backIssueDate: { x: 146, yDay: 262, yMonth: 285, yYear: 393 },
    huntType: { x: 542, y: 55 },
    resources: data.resources.map((_, i) => ({
      resource: { x: 187 + i * 16, y: 40 },
      dateFrom: { x: 189 + i * 16, y: 143 },
      dateTo: { x: 189 + i * 16, y: 190 },
      dailyLimit: { x: 189 + i * 16, y: 250 },
      seasonLimit: { x: 189 + i * 16, y: 295 },
    })),};

  const blue = { ...yellow };

  switch (blank) {
    case 'Pink':
      return pink;
    case 'Blue':
      return blue;
    case 'Yellow':
    default:
      return yellow;
  }
};
