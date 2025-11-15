import type { PrintFormValues } from '../components/PrintForm/PrintForm'; 
import type { PrintPositions } from '../components/PrintForm/usePrint';

export type BlankType = 'Yellow' | 'Pink' | 'Blue' | 'Voucher';

export const getCoordsForBlank = (blank: BlankType = 'Yellow') => (data: PrintFormValues): PrintPositions => {
  console.log('[getCoordsForBlank] blank:', blank, 'resources length:', Array.isArray(data.resources) ? data.resources.length : 0);

  const yellow: PrintPositions = {
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
    resources: (data.resources || []).map((_, i) => ({
      resource: { x: 171 + i * 17, y: 40 },
      dateFrom: { x: 173 + i * 17, y: 143 },
      dateTo: { x: 173 + i * 17, y: 190 },
      dailyLimit: { x: 173 + i * 17, y: 250 },
      seasonLimit: { x: 173 + i * 17, y: 295 },
    })),
  };

  const pink: PrintPositions = {
    fullName: { x: 459, y: 95 },
    hunterTicketSeries: { x: 503, y: 115 },
    hunterTicketNumber: { x: 503, y: 165 },
    hunterIssueDate: { x: 523, yDay: 120, yMonth: 150, yYear: 255 },
    issueDate: { x: 120, yDay: 660, yMonth: 680, yYear: 700 },
    issuedBy: { x: 120, y: 245 },
    organizationName: { x: 48, y: 20 },
    huntingPlace: { x: 350, y: 70 },
    backIssueDate: { x: 147, yDay: 262, yMonth: 285, yYear: 394 },
    huntType: { x: 544, y: 55 },
    resources: (data.resources || []).map((_, i) => ({
      resource: { x: 187 + i * 16, y: 40 },
      dateFrom: { x: 189 + i * 16, y: 143 },
      dateTo: { x: 189 + i * 16, y: 190 },
      dailyLimit: { x: 189 + i * 16, y: 250 },
      seasonLimit: { x: 189 + i * 16, y: 295 },
    })),
  };

  const blue: PrintPositions = {
    fullName: { x: 455, y: 95 },
    hunterTicketSeries: { x: 498, y: 115 },
    hunterTicketNumber: { x: 498, y: 165 },
    hunterIssueDate: { x: 521, yDay: 120, yMonth: 150, yYear: 255 },
    issueDate: { x: 120, yDay: 660, yMonth: 680, yYear: 700 },
    issuedBy: { x: 31, y: 245 },
    organizationName: { x: 45, y: 20 },
    huntingPlace: { x: 346, y: 70 },
    backIssueDate: { x: 60, yDay: 262, yMonth: 285, yYear: 393 },
    huntType: { x: 541, y: 55 },
    resources: (data.resources || []).map((_, i) => ({
      resource: { x: 171 + i * 17, y: 40 },
      dateFrom: { x: 173 + i * 17, y: 143 },
      dateTo: { x: 173 + i * 17, y: 190 },
      dailyLimit: { x: 173 + i * 17, y: 250 },
      seasonLimit: { x: 173 + i * 17, y: 295 },
    })),
  };

  const voucher: PrintPositions = {
    voucherNumber: { x: 330, y: 527 },
    fullName: { x:71, y: 343 },
    hunterTicketSeries: { x: 88, y: 326 },
    hunterTicketNumber: { x: 117, y: 326 },
    hunterIssueDate: { x: 316, yDay: 326 },
    issueDate: { x: 40, yDay: 128 },
    jobTitle: { x: 40, y: 159 },
    voucherPermissionNumber: { x: 214, y: 268},
    resources: {
      minDateFrom: { x: 50, y: 383 },
      maxDateTo: { x: 352, y:383 },
      specialMark: { x: 36, y: 291 },
    } as any,
  };

  switch (blank) {
    case 'Voucher':
      return voucher;
    case 'Pink':
      return pink;
    case 'Blue':
      return blue;
    case 'Yellow':
    default:
      return yellow;
  }
};
