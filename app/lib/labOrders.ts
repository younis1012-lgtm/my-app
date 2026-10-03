// הזמנות מעבדה / מודד – נשמרות בתוך סעיף רשימת התיוג (item.labOrders).
// הסטטוס לא נשמר ידנית: הוא נגזר מהתעודות שצורפו לאותו סעיף אחרי פתיחת ההזמנה.
// כך הזמנה נסגרת גם כשהתוצאות הגיעו במייל רגיל והבקר צירף אותן ידנית לסעיף.

export type LabOrderKind = 'lab' | 'measurement';

export type LabOrder = {
  id: string;
  orderNo: number;
  kind: LabOrderKind;
  testType: string;
  partyId: string;
  partyName: string;
  partyEmail: string;
  structure: string;
  element: string;
  fromChainage: string;
  toChainage: string;
  side: string;
  materialSource: string;
  materialType: string;
  quantity: string;
  plannedAt: string; // YYYY-MM-DDTHH:mm
  contactName: string;
  contactPhone: string;
  notes: string;
  /** 'email' = נשלחה מהמערכת, 'external' = נשלחה מחוץ למערכת ונרשמה */
  sentVia: 'email' | 'external' | '';
  createdAt: string; // ISO
  createdBy: string;
  cancelled?: boolean;
  /** תעודות שכבר היו בסעיף כשההזמנה נפתחה – לא סוגרות אותה */
  baselineAttachmentIds: string[];
};

export type LabOrderStatus = 'open' | 'partial' | 'closed' | 'cancelled';

export type LabOrderState = {
  order: LabOrder;
  status: LabOrderStatus;
  required: number;
  attachmentIds: string[];
  certificates: string[];
  overdueDays: number;
};

export type LabOrderSummary = {
  id: string;
  orderNo: number;
  kind: LabOrderKind;
  itemId: string;
  itemIndex: number;
  testType: string;
  partyName: string;
  structure: string;
  element: string;
  plannedAt: string;
  sentVia: LabOrder['sentVia'];
  status: LabOrderStatus;
  required: number;
  received: number;
  certificates: string[];
  overdueDays: number;
};

const text = (value: unknown) => String(value ?? '').trim();

export const LAB_ORDER_KIND_LABEL: Record<LabOrderKind, string> = { lab: 'מעבדה', measurement: 'מודד' };

export const LAB_ORDER_STATUS_LABEL: Record<LabOrderStatus, string> = {
  open: 'ממתינה לתוצאות',
  partial: 'התקבלה חלקית',
  closed: 'נסגרה',
  cancelled: 'בוטלה',
};

/** בדיקת חוזק 7 ו-28 יום – נדרשות שתי תעודות לסגירה */
export const isTwoStageTest = (testType: unknown) => {
  const value = text(testType);
  return /(^|\D)28(\D|$)/.test(value) && /(^|\D)7(\D|$)/.test(value);
};

export const normalizeLabOrder = (raw: any, index = 0): LabOrder => ({
  id: text(raw?.id) || `order-${Date.now()}-${index}`,
  orderNo: Number(raw?.orderNo) || 0,
  kind: raw?.kind === 'measurement' ? 'measurement' : 'lab',
  testType: text(raw?.testType),
  partyId: text(raw?.partyId),
  partyName: text(raw?.partyName),
  partyEmail: text(raw?.partyEmail),
  structure: text(raw?.structure),
  element: text(raw?.element),
  fromChainage: text(raw?.fromChainage),
  toChainage: text(raw?.toChainage),
  side: text(raw?.side),
  materialSource: text(raw?.materialSource),
  materialType: text(raw?.materialType),
  quantity: text(raw?.quantity),
  plannedAt: text(raw?.plannedAt),
  contactName: text(raw?.contactName),
  contactPhone: text(raw?.contactPhone),
  notes: String(raw?.notes ?? ''),
  sentVia: raw?.sentVia === 'email' || raw?.sentVia === 'external' ? raw.sentVia : '',
  createdAt: text(raw?.createdAt) || new Date().toISOString(),
  createdBy: text(raw?.createdBy),
  cancelled: raw?.cancelled === true,
  baselineAttachmentIds: Array.isArray(raw?.baselineAttachmentIds) ? raw.baselineAttachmentIds.map(String) : [],
});

export const itemLabOrders = (item: any): LabOrder[] =>
  Array.isArray(item?.labOrders) ? item.labOrders.map((order: any, index: number) => normalizeLabOrder(order, index)) : [];

const daysSince = (value: string, now: Date) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.floor((now.getTime() - date.getTime()) / 86400000);
};

/** מצב כל הזמנות הסעיף, לפי התעודות שצורפו אחרי פתיחת כל הזמנה (לפי סדר פתיחה) */
export const deriveLabOrderStates = (item: any, now = new Date()): LabOrderState[] => {
  const orders = itemLabOrders(item).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const attachments: any[] = Array.isArray(item?.attachments) ? item.attachments : [];
  const used = new Set<string>();
  return orders.map((order) => {
    const required = order.kind === 'lab' && isTwoStageTest(order.testType) ? 2 : 1;
    const baseline = new Set(order.baselineAttachmentIds);
    const mine: any[] = [];
    if (!order.cancelled) {
      for (const attachment of attachments) {
        const id = text(attachment?.id);
        const kind = attachment?.kind === 'measurement' ? 'measurement' : attachment?.kind === 'lab' ? 'lab' : 'other';
        // תעודה "אחרת" נחשבת לכל סוג הזמנה; תעודת מעבדה לא סוגרת הזמנת מודד ולהפך
        if (!id || used.has(id) || baseline.has(id) || (kind !== 'other' && kind !== order.kind)) continue;
        mine.push(attachment);
        used.add(id);
        if (mine.length >= required) break;
      }
    }
    const status: LabOrderStatus = order.cancelled ? 'cancelled' : mine.length >= required ? 'closed' : mine.length ? 'partial' : 'open';
    // איחור: 7 ימים ממועד הביצוע בלי תעודה; בחוזק 28 יום – 35 ימים לתעודה השנייה
    const graceDays = status === 'partial' ? 35 : 7;
    const overdueDays = (status === 'open' || status === 'partial') && order.plannedAt ? Math.max(0, daysSince(order.plannedAt, now) - graceDays) : 0;
    return {
      order,
      status,
      required,
      attachmentIds: mine.map((a) => text(a.id)),
      certificates: mine.map((a) => text(a.certificateNo) || text(a.name)).filter(Boolean),
      overdueDays,
    };
  });
};

/** סיכום קל של ההזמנות ברשימת תיוג – נשמר ב-details כדי שמסך המעקב לא יטען את כל הקבצים */
export const summarizeChecklistLabOrders = (items: any[], now = new Date()): LabOrderSummary[] =>
  (Array.isArray(items) ? items : []).flatMap((item, itemIndex) =>
    deriveLabOrderStates(item, now).map((state) => ({
      id: state.order.id,
      orderNo: state.order.orderNo,
      kind: state.order.kind,
      itemId: text(item?.id),
      itemIndex,
      testType: state.order.testType,
      partyName: state.order.partyName,
      structure: state.order.structure,
      element: state.order.element,
      plannedAt: state.order.plannedAt,
      sentVia: state.order.sentVia,
      status: state.status,
      required: state.required,
      received: state.attachmentIds.length,
      certificates: state.certificates,
      overdueDays: state.overdueDays,
    })),
  );

/** חישוב מחדש של איחור לסיכום שנשמר (הסטטוס עצמו נשמר בשמירת הרשימה) */
export const refreshSummaryOverdue = (summary: LabOrderSummary, now = new Date()): LabOrderSummary => {
  if (summary.status !== 'open' && summary.status !== 'partial') return { ...summary, overdueDays: 0 };
  const graceDays = summary.status === 'partial' ? 35 : 7;
  return { ...summary, overdueDays: summary.plannedAt ? Math.max(0, daysSince(summary.plannedAt, now) - graceDays) : 0 };
};

export const formatPlannedAt = (value: string) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return value || '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  const hasTime = /T\d{2}:\d{2}/.test(value);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}${hasTime ? ` · ${pad(date.getHours())}:${pad(date.getMinutes())}` : ''}`;
};

/** גוף המייל להזמנה – טבלת פרטים בטקסט */
export const labOrderMailText = (order: LabOrder, projectName: string, checklistLabel: string) => {
  const rows: Array<[string, string]> = [
    ['מספר הזמנה', String(order.orderNo)],
    ['פרויקט', projectName],
    ['רשימת תיוג', checklistLabel],
    [order.kind === 'measurement' ? 'סוג המדידה' : 'סוג הבדיקה', order.testType],
    ['מבנה', order.structure],
    ['אלמנט / תת אלמנט', order.element],
    ['מחתך', order.fromChainage],
    ['עד חתך', order.toChainage],
    ['צד', order.side],
    ['מקור החומר', order.materialSource],
    ['סוג החומר', order.materialType],
    ['כמות', order.quantity],
    ['מועד מבוקש לביצוע', formatPlannedAt(order.plannedAt)],
    ['איש קשר באתר', [order.contactName, order.contactPhone].filter(Boolean).join(' · ')],
    ['הערות', order.notes.trim()],
  ];
  const lines = rows.filter(([, value]) => text(value)).map(([label, value]) => `${label}: ${value}`);
  const kindWord = order.kind === 'measurement' ? 'מדידה' : 'בדיקת מעבדה';
  return `שלום,\nמבוקש לבצע ${kindWord} לפי הפרטים הבאים:\n\n${lines.join('\n')}\n\nנא לציין את מספר ההזמנה (${order.orderNo}) בתעודה ובמייל החוזר.\nבברכה`;
};
