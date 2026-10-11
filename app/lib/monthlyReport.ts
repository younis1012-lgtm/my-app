// דוח בקרת איכות חודשי – בניית קובץ Word (docx) מהנתונים שדווחו במערכת.
// מבנה הדוח לפי תבנית "עכו" (דוח חודשי מס' X): מכתב פתיחה, תיאור הפרויקט, נתונים כלליים,
// בקרה מוקדמת, בקרה שוטפת לפי עץ המבנה, אי התאמות, פיקוח עליון, קטעי ניסוי, נספחים ותמונות.
// הקובץ נועד להמשך עריכה ב-Word (הוספת תמונות, תיקוני ניסוח).

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
} from "docx";

export type MonthlyReportConfig = {
  id: string;
  template: "akko";
  enabled: boolean;
  clientName: string; // מזמין העבודה (למשל נתיבי איילון בע"מ)
  recipientName: string; // לכבוד
  recipientCompany: string;
  contractNo: string; // מס' חוזה / מכרז
  projectDescription: string; // תיאור הפרויקט (שורה לכל פסקה / סעיף)
  copies: string; // העתקים – שורה לכל נמען
  signerTitle: string; // תפקיד החותם (מנהל בקרת איכות)
  firstMonth: string; // yyyy-mm – החודש של דוח מס' 1
  appendices: string; // נספחים – שורה לכל נספח
  coverImage: string; // תמונת שער (תצ"א / מפת הפרויקט) – data URL
};

export const defaultMonthlyReportConfig = (): MonthlyReportConfig => ({
  id: `monthly-${Date.now()}`,
  template: "akko",
  enabled: true,
  clientName: "",
  recipientName: "",
  recipientCompany: "",
  contractNo: "",
  projectDescription: "",
  copies: "",
  signerTitle: "מנהל בקרת איכות",
  firstMonth: "",
  appendices: [
    "ריכוז אי התאמות.",
    "ריכוז בקרה מקדימה – קבלני משנה + ספקים + חומרים.",
    "ריכוז קטעי ניסוי.",
    "ריכוז פיקוח עליון.",
    "ריכוזי בדיקות מעבדה.",
  ].join("\n"),
  coverImage: "",
});

// פרטים קבועים מתוך דוח 09.2026 של מגד אלכרום – ממולאים בהפעלה הראשונה בפרויקט זה
export const presetMonthlyReportConfig = (projectName: string): Partial<MonthlyReportConfig> => {
  if (!/אלכרום|אל\s*כרום/.test(projectName)) return {};
  return {
    clientName: 'נתיבי איילון בע"מ',
    recipientName: "עדנאן שבאט",
    recipientCompany: 'ק.ג אופטימום בע"מ – הבטחת איכות',
    contractNo: "CO260000726",
    firstMonth: "2026-09",
    projectDescription: [
      "פרויקט ״ביצוע עבודות תשתית, סלילה ופיתוח ברחוב אבן אלהיית'ם, מג'ד אלכרום״ כולל הרחבה ושדרוג של מבנה הכביש, הרחבת מדרכות, קירות תומכים, הסדרת צמתים, עבודות עפר ומצעים, סלילת אספלט, עבודות חשמל, תקשורת, ניקוז ותאורה (לרבות הטמנת קו מתח גבוה עילי), עבודות פיתוח נופי ושדרוג תשתיות קיימות.",
      "העבודות שיבוצעו במסגרת מכרז זה כוללות בין היתר:",
      "- עבודות עפר: חפירה, מילוי והידוק.",
      "- עבודות סלילה וקרצוף.",
      "- עבודות בטון יצוק באתר.",
      "- עבודות שילוט, תמרור והסדרי תנועה זמניים.",
      "- קירות תומכים.",
      "- ריצוף ואבני שפה.",
      "- עבודות ניקוז.",
      "- עבודות חשמל, תקשורת ותאורה.",
      "- עבודות מצעים ואספלט.",
      "- עבודות סימון כביש.",
      "- עבודות פיתוח נופי.",
      "כמו כן כל עבודה נדרשת לפי המפרט המיוחד; העבודות יבוצעו בהתאם לשלבי הביצוע המצוינים במפרט המיוחד.",
    ].join("\n"),
    copies: [
      'מקסים גולדן, נחום כודדה – אי.שטרן ניהול פרויקטים בע"מ.',
      'חוסיין מריסאת, מוחמד סבאח, פארוק חלו – מפלסי הגליל סלילה עפר ופיתוח בע"מ.',
    ].join("\n"),
    appendices: [
      "ריכוז אי התאמות.",
      "ריכוז בקרה מקדימה – ספקים, קבלנים וחומרים.",
      "ריכוז קטעי ניסוי.",
      "ריכוז פיקוח עליון.",
      "ריכוז בדיקות מעבדה לעבודות בטון, עבודות עפר ואפיון חומרי מילוי.",
    ].join("\n"),
  };
};

export const normalizeMonthlyReportConfig = (item: any): MonthlyReportConfig => {
  const base = defaultMonthlyReportConfig();
  const text = (key: keyof MonthlyReportConfig) =>
    item?.[key] === undefined || item?.[key] === null ? (base[key] as string) : String(item[key]);
  return {
    id: String(item?.id ?? base.id),
    template: "akko",
    enabled: item?.enabled !== false,
    clientName: text("clientName"),
    recipientName: text("recipientName"),
    recipientCompany: text("recipientCompany"),
    contractNo: text("contractNo"),
    projectDescription: text("projectDescription"),
    copies: text("copies"),
    signerTitle: text("signerTitle"),
    firstMonth: text("firstMonth"),
    appendices: text("appendices"),
    coverImage: text("coverImage"),
  };
};

/** text – כל מה שמתאר את העבודה (שם הרשימה, סוג התבנית, תיקייה) – לשיוך לסוג העבודה */
export type MonthlyWorkRow = { structure: string; from: string; to: string; offset: string; work: string; notes: string; text?: string };

// סוגי העבודות לבקרה השוטפת – מתוך תיאור הפרויקט: כל שורה שמתחילה ב"-" היא סוג עבודה (טבלה בדוח)
export const workCategoriesFromDescription = (description: string) =>
  String(description ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-•*·]/.test(line))
    .map((line) => line.replace(/^[-•*·]\s*/, "").replace(/[.:]\s*$/, "").trim())
    .filter(Boolean);

// מילות מפתח לכל סוג עבודה (בנוסף למילים שבשם הסוג עצמו)
const WORK_KEYWORDS: Array<[RegExp, string[]]> = [
  [/עפר/, ["עפר", "חפיר", "מילוי", "הידוק", "שתית", "חציב"]],
  [/סליל|קרצוף/, ["סליל", "קרצוף", "ריסוס"]],
  [/בטון/, ["בטון", "יציק", "ברזל", "זיון", "טפסנ", "CLSM"]],
  [/שילוט|תמרור|הסדר/, ["שילוט", "שלט", "תמרור", "הסדר תנועה", "הסדרי תנועה", "מעקה זמני"]],
  [/קיר/, ["קיר", "תומך", "אבן לקט", "גביונ"]],
  [/ריצוף|אבני שפה/, ["ריצוף", "מרצפ", "אבני שפה", "אבן שפה", "אבני גן", "מדרכ"]],
  [/ניקוז/, ["ניקוז", "קולטן", "שוח", "תעל", "מעביר", "צנרת", "צינור", "ביוב"]],
  [/חשמל|תאור|תקשורת/, ["חשמל", "תאור", "תקשורת", "עמוד", "כבל", "שרוול"]],
  [/מצע|אספלט/, ["מצע", "אספלט", "תא\"צ", "תא״צ", "שכבה נושאת", "שכבה מקשרת"]],
  [/סימון/, ["סימון", "צבע כביש"]],
  [/פיתוח|נופי|גינון/, ["גינון", "נופי", "השקי", "נטיע", "צמחי"]],
];
const keywordsForCategory = (category: string) => {
  const own = category.replace(/עבודות|ה?כביש(?!\S)|[,()]/g, " ").split(/\s+/).filter((word) => word.length > 2);
  const extra = WORK_KEYWORDS.filter(([pattern]) => pattern.test(category)).flatMap(([, words]) => words);
  return Array.from(new Set([...own, ...extra]));
};
export const classifyWork = (categories: string[], text: string) => {
  let best = -1;
  let bestScore = 0;
  categories.forEach((category, index) => {
    const score = keywordsForCategory(category).filter((word) => text.includes(word)).length;
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  });
  return best;
};
export type MonthlyListRow = { date: string; title: string; detail: string; status: string };
export type NcStatusPair = { QC: number; QA: number };
export type NcStatusGroup = { total: NcStatusPair; grades: NcStatusPair[] };

export type MonthlyReportData = {
  config: MonthlyReportConfig;
  year: number;
  month: number; // 1-12
  reportNo: number;
  issueDate: Date;
  projectName: string;
  qcCompany: { name: string; logo: string; service: string; address: string; phone: string; email: string };
  signerName: string;
  general: Array<[string, string]>; // נתונים כלליים – תווית / ערך
  preliminary: { subcontractors: MonthlyListRow[]; suppliers: MonthlyListRow[]; materials: MonthlyListRow[] };
  trialSections: MonthlyListRow[];
  works: MonthlyWorkRow[]; // ממוין לפי מבנה
  nonconformances: { project: NcStatusGroup; month: NcStatusGroup; open: NcStatusGroup; openedThisMonth: MonthlyListRow[] };
  supervision: MonthlyListRow[];
};

const HEB_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
export const hebrewMonthName = (month: number) => HEB_MONTHS[(month - 1 + 12) % 12];
const pad = (n: number) => String(n).padStart(2, "0");
const dmy = (date: Date) => `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
const lastDay = (year: number, month: number) => new Date(year, month, 0).getDate();

const FONT = "Arial";
const NAVY = "0B1F3A";
const GREY = "D9E2EC";

const run = (text: string, options: { bold?: boolean; size?: number; color?: string; underline?: boolean } = {}) =>
  new TextRun({
    text,
    font: FONT,
    rightToLeft: true,
    bold: options.bold,
    size: options.size ?? 22,
    color: options.color,
    underline: options.underline ? {} : undefined,
  });

const para = (
  text: string | TextRun[],
  options: { bold?: boolean; size?: number; center?: boolean; spacingAfter?: number; spacingBefore?: number; color?: string; underline?: boolean } = {},
) =>
  new Paragraph({
    bidirectional: true,
    alignment: options.center ? AlignmentType.CENTER : AlignmentType.RIGHT,
    spacing: { after: options.spacingAfter ?? 80, before: options.spacingBefore ?? 0 },
    children: typeof text === "string" ? [run(text, options)] : text,
  });

const heading = (text: string) =>
  para(text, { bold: true, size: 28, color: NAVY, spacingBefore: 240, spacingAfter: 120, underline: true });

const subHeading = (text: string) => para(text, { bold: true, size: 24, spacingBefore: 120, spacingAfter: 80 });

const border = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const borders = { top: border, bottom: border, left: border, right: border };

const cell = (text: string, options: { bold?: boolean; shade?: boolean; width?: number; center?: boolean; span?: number } = {}) =>
  new TableCell({
    borders,
    columnSpan: options.span,
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    verticalAlign: VerticalAlignTable.CENTER,
    shading: options.shade ? { type: ShadingType.CLEAR, color: "auto", fill: GREY } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: String(text ?? "")
      .split("\n")
      .map((line) => para(line, { bold: options.bold, size: 20, center: options.center, spacingAfter: 0 })),
  });

const table = (rows: TableRow[]) =>
  new Table({
    visuallyRightToLeft: true,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });

const lines = (text: string) =>
  String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const dataUrlBytes = (dataUrl: string) => {
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl || "");
  if (!match) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { bytes, type: match[1].toLowerCase().startsWith("png") ? ("png" as const) : ("jpg" as const) };
};

const imageSize = (dataUrl: string) =>
  new Promise<{ width: number; height: number }>((resolve) => {
    if (typeof Image === "undefined") return resolve({ width: 200, height: 100 });
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || 200, height: image.naturalHeight || 100 });
    image.onerror = () => resolve({ width: 200, height: 100 });
    image.src = dataUrl;
  });

// מיון שורות לפי המספר שבשם (אישור ספקים מס' 1, 2, 3…), ובאותו מספר – לפי תאריך
const listNumber = (text: string) => {
  const match = text.match(/מס['׳"]?\s*(\d+)/) || text.match(/(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
};
const listDate = (text: string) => {
  const match = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(text);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
};
const sortListRows = (rows: MonthlyListRow[]) =>
  rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        listNumber(a.row.title) - listNumber(b.row.title) ||
        listDate(a.row.date).localeCompare(listDate(b.row.date)) ||
        a.index - b.index,
    )
    .map(({ row }) => row);

const listOrNone = (unsortedRows: MonthlyListRow[], none: string, columns: [string, string, string, string]) => {
  const rows = sortListRows(unsortedRows);
  return rows.length
    ? [
        table([
          new TableRow({ tableHeader: true, children: columns.map((label) => cell(label, { bold: true, shade: true, center: true })) }),
          ...rows.map(
            (row) => new TableRow({ cantSplit: true, children: [cell(row.date, { center: true, width: 14 }), cell(row.title, { width: 36 }), cell(row.detail, { width: 34 }), cell(row.status, { center: true, width: 16 })] }),
          ),
        ]),
        para(""),
      ]
    : [para(none)];
};

export async function buildMonthlyReportDocx(data: MonthlyReportData): Promise<Blob> {
  const { config } = data;
  const monthName = hebrewMonthName(data.month);
  const periodFrom = `01.${pad(data.month)}.${data.year}`;
  const periodTo = `${lastDay(data.year, data.month)}.${pad(data.month)}.${data.year}`;

  // לוגו חברת הבקרה בראש כל עמוד
  const headerChildren: Paragraph[] = [];
  const logo = dataUrlBytes(data.qcCompany.logo);
  if (logo) {
    const size = await imageSize(data.qcCompany.logo);
    const height = 56;
    const width = Math.min(220, Math.round((size.width / Math.max(1, size.height)) * height));
    headerChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: logo.bytes, type: logo.type, transformation: { width, height } })],
      }),
    );
  } else if (data.qcCompany.name) {
    headerChildren.push(para(data.qcCompany.name, { bold: true, size: 26, center: true, color: NAVY }));
  }
  const footerText = [data.qcCompany.service, data.qcCompany.address, data.qcCompany.phone, data.qcCompany.email].filter(Boolean).join("  |  ");

  const ncTable = () => {
    const g = data.nonconformances;
    const head1 = new TableRow({
      tableHeader: true,
      children: [
        cell("נפתח על ידי", { bold: true, shade: true, center: true }),
        cell("אי התאמות שנפתחו מתחילת הפרויקט", { bold: true, shade: true, center: true, span: 2 }),
        cell("אי התאמות שנפתחו בחודש המדווח", { bold: true, shade: true, center: true, span: 2 }),
        cell("אי התאמות שטרם נסגרו", { bold: true, shade: true, center: true, span: 2 }),
      ],
    });
    const head2 = new TableRow({
      tableHeader: true,
      children: [
        cell("", { shade: true }),
        ...[0, 1, 2].flatMap(() => [cell('סה"כ', { bold: true, shade: true, center: true }), cell("בדרגה 3", { bold: true, shade: true, center: true })]),
      ],
    });
    const rowFor = (who: "QC" | "QA") =>
      new TableRow({
        children: [
          cell(who, { bold: true, center: true }),
          ...[g.project, g.month, g.open].flatMap((group) => [
            cell(String(group.total[who]), { center: true }),
            cell(String(group.grades[2]?.[who] ?? 0), { center: true }),
          ]),
        ],
      });
    return table([head1, head2, rowFor("QC"), rowFor("QA")]);
  };

  // בקרה שוטפת – טבלה לכל סוג עבודה מתיאור הפרויקט; סוג שלא בוצע בו דבר – "בחודש המדווח לא בוצעו עבודות"
  const categories = workCategoriesFromDescription(config.projectDescription);
  const byCategory = new Map<number, MonthlyWorkRow[]>();
  data.works.forEach((row) => {
    const index = categories.length ? classifyWork(categories, `${row.text ?? ""} ${row.work} ${row.structure}`) : -1;
    byCategory.set(index, [...(byCategory.get(index) ?? []), row]);
  });
  const workTable = (title: string, rows: MonthlyWorkRow[]) => [
    table([
      new TableRow({
        tableHeader: true,
        children: [cell(title, { bold: true, shade: true, span: 6 })],
      }),
      new TableRow({
        tableHeader: true,
        children: [
          cell("מבנה / אלמנט", { bold: true, shade: true, width: 22 }),
          cell("מחתך", { bold: true, shade: true, center: true, width: 10 }),
          cell("עד חתך", { bold: true, shade: true, center: true, width: 10 }),
          cell("הסט", { bold: true, shade: true, center: true, width: 9 }),
          cell("מהות העבודה", { bold: true, shade: true, width: 31 }),
          cell("הערות", { bold: true, shade: true, width: 18 }),
        ],
      }),
      ...(rows.length
        ? rows.map(
            (row) =>
              new TableRow({
                cantSplit: true,
                children: [
                  cell(row.structure),
                  cell(row.from, { center: true }),
                  cell(row.to, { center: true }),
                  cell(row.offset, { center: true }),
                  cell(row.work),
                  cell(row.notes),
                ],
              }),
          )
        : [
            new TableRow({
              children: [cell(""), cell(""), cell(""), cell(""), cell("בחודש המדווח לא בוצעו עבודות"), cell("")],
            }),
          ]),
    ]),
    para(""),
  ];
  const workTables: Array<Paragraph | Table> = [
    ...categories.flatMap((category, index) => workTable(`3.1.${index + 1} ${category}`, byCategory.get(index) ?? [])),
    ...((byCategory.get(-1) ?? []).length
      ? workTable(categories.length ? `3.1.${categories.length + 1} עבודות נוספות` : "עבודות שבוצעו", byCategory.get(-1) ?? [])
      : []),
  ];

  // תמונת שער (מפת הפרויקט / תצ"א)
  const cover = dataUrlBytes(config.coverImage);
  const coverParagraphs: Paragraph[] = [];
  if (cover) {
    const size = await imageSize(config.coverImage);
    const width = 520;
    const height = Math.round((size.height / Math.max(1, size.width)) * width);
    coverParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 160 },
        children: [new ImageRun({ data: cover.bytes, type: cover.type, transformation: { width, height: Math.min(height, 420) } })],
      }),
    );
  }

  const children: Array<Paragraph | Table> = [
    // מכתב פתיחה
    para(`דו"ח בקרת איכות`, { bold: true, size: 32, center: true, color: NAVY }),
    para(dmy(data.issueDate), { center: true, spacingAfter: 240 }),
    para("לכבוד", { bold: true }),
    ...lines(config.recipientName).map((line) => para(line)),
    ...lines(config.recipientCompany).map((line) => para(line)),
    para("שלום רב,", { spacingBefore: 160 }),
    para([run("הנדון: ", { bold: true, underline: true }), run(data.projectName, { bold: true, underline: true })], { spacingBefore: 120, center: true }),
    ...(config.contractNo ? [para(`חוזה / מכרז מס' ${config.contractNo}`, { bold: true, center: true })] : []),
    ...(config.clientName ? [para(`מזמין: ${config.clientName}`, { center: true })] : []),
    para(`דיווח בקרת איכות – חודש ${monthName} ${data.year}.`, { bold: true, center: true }),
    para(`דו"ח חודשי מס' ${data.reportNo}`, { bold: true, spacingAfter: 160, center: true }),
    para(
      `מצ"ב דו"ח חודשי המפרט את פעילות ההקמה ובקרת האיכות בפרויקט ${data.projectName} לתקופה ${periodFrom} – ${periodTo}.`,
      { spacingAfter: 200, center: true },
    ),
    ...coverParagraphs,
    ...(lines(config.copies).length ? [para("העתקים:", { bold: true, underline: true }), ...lines(config.copies).map((line) => para(line))] : []),
    para("בכבוד רב,", { spacingBefore: 240 }),
    para(data.signerName, { bold: true }),
    para(config.signerTitle || "מנהל בקרת איכות"),
    para(data.qcCompany.name),
    new Paragraph({ children: [new PageBreak()] }),

    // תוכן עניינים
    heading("תוכן העניינים"),
    ...["תיאור הפרויקט", "בקרה מוקדמת", "בקרה שוטפת", "אי התאמות וליקויים במשך הביצוע", "פיקוח עליון", "קטעי ניסוי", "נספחים וריכוזים במערכת", "תמונות"].map(
      (title, index) => para(`${index + 1}. ${title}`),
    ),

    // 1. הפרויקט
    heading("1. הפרויקט"),
    table([
      new TableRow({
        children: [
          cell("תיאור הפרויקט", { bold: true, shade: true, width: 20 }),
          new TableCell({
            borders,
            width: { size: 80, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: (lines(config.projectDescription).length ? lines(config.projectDescription) : [" "]).map((line) =>
              para(line, { size: 20, spacingAfter: 40 }),
            ),
          }),
        ],
      }),
    ]),
    para(""),
    subHeading("נתונים כלליים"),
    table(
      data.general.map(
        ([label, value]) => new TableRow({ children: [cell(label, { bold: true, shade: true, width: 30 }), cell(value, { width: 70 })] }),
      ),
    ),

    // 2. בקרה מוקדמת
    heading("2. בקרה מוקדמת"),
    subHeading("2.1 אישורי קבלני משנה"),
    ...listOrNone(data.preliminary.subcontractors, "בחודש המדווח לא אושרו קבלני משנה.", ["תאריך", "קבלן משנה", "תחום / פרטים", "סטטוס"]),
    subHeading("2.2 אישור ספקים"),
    ...listOrNone(data.preliminary.suppliers, "בחודש המדווח לא אושרו ספקים.", ["תאריך", "ספק", "מוצר / פרטים", "סטטוס"]),
    subHeading("2.3 אישור חומרים"),
    ...listOrNone(data.preliminary.materials, "בחודש המדווח לא אושרו חומרים.", ["תאריך", "חומר", "מקור / פרטים", "סטטוס"]),
    subHeading("2.4 קטעי ניסוי"),
    ...listOrNone(data.trialSections, "בחודש המדווח לא בוצעו קטעי ניסוי.", ["תאריך", "קטע ניסוי", "מיקום", "סטטוס"]),

    // 3. בקרה שוטפת
    heading("3. בקרה שוטפת"),
    para("*העבודות מחולקות לפי סוגי העבודות בפרויקט; המבנה / האלמנט לפי עץ מבנה מאושר", { size: 20 }),
    subHeading("3.1 פירוט עבודות שבוצעו במהלך החודש:"),
    ...(workTables.length ? workTables : [para("בחודש המדווח לא בוצעו עבודות.")]),

    // 4. אי התאמות
    heading("4. אי התאמות וליקויים במשך הביצוע"),
    para(
      `בחודש המדווח נפתחו ${data.nonconformances.month.total.QC + data.nonconformances.month.total.QA} אי התאמות. פירוט אי ההתאמות בטבלת ריכוז אי ההתאמות המצורפת כנספח לדו"ח זה.`,
    ),
    ncTable(),
    para(""),
    ...(data.nonconformances.openedThisMonth.length
      ? [
          subHeading("אי התאמות שנפתחו בחודש המדווח"),
          ...listOrNone(data.nonconformances.openedThisMonth, "", ["תאריך", "אי התאמה", "תיאור", "סטטוס"]),
        ]
      : []),

    // 5. פיקוח עליון
    heading("5. פיקוח עליון"),
    ...listOrNone(data.supervision, "בחודש המדווח לא התקבלו דוחות פיקוח עליון. ראה נספח ריכוז פיקוח עליון.", ["תאריך ביקור", "נושא", "מתכנן / תחום", "סטטוס"]),

    // 6. קטעי ניסוי
    heading("6. קטעי ניסוי"),
    para(data.trialSections.length ? `בחודש המדווח בוצעו ${data.trialSections.length} קטעי ניסוי – ראה סעיף 2.4 ונספח ריכוז קטעי ניסוי.` : "בחודש המדווח לא בוצעו קטעי ניסוי."),

    // 7. נספחים
    heading("7. נספחים וריכוזים במערכת"),
    ...lines(config.appendices).map((line, index) => para(`7.${index + 1} ${line}`)),

    // 8. תמונות
    new Paragraph({ children: [new PageBreak()] }),
    heading("8. תמונות"),
    para("(יש להוסיף כאן תמונות מהשטח – כותרת לכל קבוצת תמונות)", { color: "64748B", size: 20 }),
  ];

  const doc = new Document({
    creator: data.qcCompany.name || "Y.K Quality",
    title: `דוח בקרת איכות ${pad(data.month)}.${data.year} – ${data.projectName}`,
    styles: { default: { document: { run: { font: FONT, size: 22, rightToLeft: true } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1300, bottom: 1000, left: 1000, right: 1000 } } },
        headers: { default: new Header({ children: headerChildren }) },
        footers: {
          default: new Footer({
            children: [
              ...(footerText ? [para(footerText, { size: 16, center: true, color: "475569" })] : []),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], font: FONT, size: 16 })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}
