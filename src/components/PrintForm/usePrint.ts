// src/components/PrintForm/usePrint.ts
import { degrees, PDFDocument, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { PrintFormValues } from './PrintForm';
import robotoFontUrl from '../../assets/Roboto-Regular.ttf';

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
const loadRoboto = async (pdf: PDFDocument): Promise<any> => {
  try {
    pdf.registerFontkit(fontkit);
  } catch (e) {
    // регистрация может быть уже выполнена — игнорируем
  }

  try {
    // Vite встраивает этот шрифт в основной bundle, поэтому генерация PDF
    // не зависит от отдельного сетевого запроса к /Roboto-Regular.ttf.
    const res = await fetch(robotoFontUrl);
    if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    return await pdf.embedFont(arrayBuffer as any);
  } catch (err) {
    console.warn('Не удалось загрузить шрифт Roboto. Использую StandardFonts.TimesRoman как запасной.', err);
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

const formatStatementDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
};

const formatSignatureName = (fullName?: string) => {
  const [lastName = '', firstName = '', middleName = ''] = (fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!lastName) return '';
  const initials = [firstName, middleName]
    .filter(Boolean)
    .map((name) => `${name[0]}.`)
    .join('');
  return initials ? `${lastName} ${initials}` : lastName;
};

const wrapPdfText = (text: string, font: any, size: number, maxWidth: number) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
};

const drawStatementCopy = (
  page: any,
  font: any,
  x: number,
  width: number,
  hunter: any,
  form: PrintFormValues
) => {
  const right = x + width;
  const bodySize = 7.6;
  const legalSize = 8;
  const lineHeight = 11;
  const draw = (text: string, dx: number, y: number, size = bodySize) =>
    page.drawText(text, { x: dx, y, font, size });
  const drawLines = (text: string, dx: number, y: number, maxWidth: number, size = bodySize, leading = lineHeight) => {
    const lines = wrapPdfText(text, font, size, maxWidth);
    lines.forEach((line, index) => draw(line, dx, y - index * leading, size));
    return y - lines.length * leading;
  };
  const centered = (text: string, y: number, size = bodySize) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    draw(text, x + (width - textWidth) / 2, y, size);
  };
  const drawOneLine = (text: string, dx: number, y: number, maxWidth: number, preferredSize: number, minSize = 5) => {
    let size = preferredSize;
    while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.2;
    draw(text, dx, y, size);
  };
  const value = (text: string) => text || '____________________________';

  const resourceNames = (form.resources || [])
    .map((resource) => resource.resource.trim())
    .filter(Boolean)
    .join(', ');
  const fromDates = (form.resources || []).map((resource) => resource.dateFrom).filter(Boolean).sort();
  const toDates = (form.resources || []).map((resource) => resource.dateTo).filter(Boolean).sort();
  const huntFrom = formatStatementDate(fromDates[0]);
  const huntTo = formatStatementDate(toDates[toDates.length - 1]);

  let y = 570;
  y = drawLines('Председателю МОО «Союз общественных охотничье-рыболовных организаций Всеволожского района Ленинградской области»', x + width * 0.47, y, width * 0.53, 6.4, 8);
  y -= 4;
  drawOneLine(`от ${value(hunter.fullName || '')}`, x + width * 0.47, y, width * 0.53, 7.1);
  draw('(Ф.И.О.)', x + width * 0.75, y - 7, 5);
  y -= 17;
  drawOneLine(`Телефон: ${value(form.phone || hunter.phone || '')}`, x + width * 0.47, y, width * 0.53, 6.6);

  y -= 26;
  centered('Заявление', y, 9);
  y -= 18;
  draw('Прошу выдать мне разрешение на добычу охотничьих ресурсов.', x, y, bodySize);
  y -= 14;
  y = drawLines(`Вид охоты: ${value(form.huntType || '')}`, x, y, width, bodySize);
  y -= 1;
  draw('Добываемые охотничьи ресурсы:', x, y, bodySize);
  y -= 8;
  y = drawLines(value(resourceNames), x, y, width, bodySize);
  y -= 1;
  draw('Предполагаемые сроки охоты:', x, y, bodySize);
  y -= 9;
  draw(`с ${value(huntFrom)} по ${value(huntTo)}`, x, y, bodySize);
  y -= 14;
  draw('Места охоты: охот. участок «Соколье»', x, y, bodySize);
  y -= 14;
  draw(`Охотничий билет: серия ${hunter.series || '_____'} №${hunter.number || '________________'}, дата выдачи ${formatStatementDate(hunter.issueDate) || '____________'} г.`, x, y, 6.5);
  y -= 16;
  y = drawLines(`Приложение: ${value(form.specialMark || '')}`, x, y, width, bodySize);
  draw('(при охоте с подружейными собаками, прилагать копии документов)', x + 55, y - 2, 4.8);
  y -= 20;

  const legalParagraphs = [
    'В соответствии с п. 1 ст. 29 Федерального закона «Об охоте и сохранении охотничьих ресурсов и о внесении изменений в отдельные законодательные акты Российской Федерации» от 24 июля 2009 года № 209-ФЗ право на добычу охотничьих ресурсов у физических лиц возникает на основании разрешения.',
    'Бланк разрешения является документом строгой отчетности.',
    'Согласно приказу Минприроды РФ от 29 августа 2014 года № 379 «Об утверждении порядка оформления и выдачи разрешений на добычу охотничьих ресурсов, порядка подачи заявок и заявлений, необходимых для выдачи таких разрешений, и утверждении форм бланков разрешений на добычу копытных животных, медведей, пушных животных, птиц», сведения о добытых охотничьих ресурсах и их количестве направляются по месту выдачи разрешения в течение срока, указанного в разрешении, после добычи, ранения животного или окончания последнего из сроков осуществления охоты.',
    'Я ознакомлен с порядком и сроками представления сведений о добытых охотничьих ресурсах и их количестве.',
    'Я обязуюсь осуществлять охоту гуманным способом в соответствии с международными стандартами.',
    'Я ознакомлен с границами кварталов охотничьего хозяйства, а также границами зон охраны охотничьих ресурсов.',
    'Я ознакомлен с правилами охоты и безопасности при проведении охоты.',
    'Я согласен на обработку своих персональных данных в соответствии с требованиями законодательства Российской Федерации.',
  ];
  const legalLines = legalParagraphs.flatMap((paragraph) => wrapPdfText(paragraph, font, legalSize, width));
  // Размер шрифта соответствует исходному бланку; компактный интервал сохраняет текст читаемым.
  const legalLeading = 10;
  legalLines.forEach((line) => {
    draw(line, x, y, legalSize);
    y -= legalLeading;
  });

  y = Math.max(y - 6, 34);
  const signatureName = formatSignatureName(hunter.fullName);
  draw(`${formatStatementDate(form.issueDate) || '____________'} г.`, x, y, 5.8);
  draw('________________', x + width * 0.49, y, 5.8);
  drawOneLine(signatureName || '________________________', x + width * 0.72, y, width * 0.28, 6.4, 5);
  draw('(подпись заявителя)', x + width * 0.49, y - 7, 4.3);
  draw('(Фамилия и инициалы)', x + width * 0.72, y - 7, 4.3);
  page.drawLine({ start: { x, y: 18 }, end: { x: right, y: 18 }, thickness: 0.25 });
};

/** Печатный лист из двух заявлений на одном листе A4. */
export const generateStatementPdf = async (hunter: any, form: PrintFormValues) => {
  const pdf = await PDFDocument.create();
  const font = await loadRoboto(pdf);
  const page = pdf.addPage([841.89, 595.28]);
  const margin = 16;
  const gap = 18;
  const copyWidth = (841.89 - margin * 2 - gap) / 2;

  drawStatementCopy(page, font, margin, copyWidth, hunter, form);
  drawStatementCopy(page, font, margin + copyWidth + gap, copyWidth, hunter, form);
  page.drawLine({
    start: { x: margin + copyWidth + gap / 2, y: 18 },
    end: { x: margin + copyWidth + gap / 2, y: 578 },
    thickness: 0.35,
    dashArray: [2, 2],
  });

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
