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

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);

const orderLocation = (order: LabOrder) => {
  const chainage = [order.fromChainage, order.toChainage].filter(text).join('–');
  return [order.structure, order.element, chainage ? `חתך ${chainage}` : '', order.side ? `צד ${order.side}` : '']
    .filter(text)
    .join(' · ');
};

/** גוף המייל להזמנה – קצר; כל הפרטים בטופס ה-PDF המצורף */
export const labOrderMailText = (order: LabOrder, projectName: string, _checklistLabel?: string) => {
  const kindWord = order.kind === 'measurement' ? 'מדידה' : 'בדיקת מעבדה';
  const rows: Array<[string, string]> = [
    [order.kind === 'measurement' ? 'סוג המדידה' : 'סוג הבדיקה', order.testType],
    ['מיקום', orderLocation(order)],
    ['מועד מבוקש לביצוע', order.plannedAt ? formatPlannedAt(order.plannedAt) : ''],
    ['איש קשר באתר', [order.contactName, order.contactPhone].filter(text).join(' · ')],
  ];
  const lines = rows.filter(([, value]) => text(value)).map(([label, value]) => `${label}: ${value}`);
  return `שלום,\nמצורפת הזמנת ${kindWord} מס' ${order.orderNo} לפרויקט ${projectName}.\n\n${lines.join('\n')}\n\nפרטי ההזמנה המלאים בטופס המצורף.\nנא לציין את מספר ההזמנה (${order.orderNo}) בתעודה ובמייל החוזר.\n\nבברכה${order.contactName ? `\n${order.contactName}` : ''}`;
};

/** טופס הזמנה מסודר (דף לאורך) – מצורף למייל כ-PDF */
export const labOrderDocumentHtml = (
  order: LabOrder,
  options: { projectName: string; checklistLabel: string; headerHtml?: string; footerHtml?: string; styles?: string },
) => {
  const measurement = order.kind === 'measurement';
  const kindWord = measurement ? 'מדידה' : 'בדיקת מעבדה';
  const issued = formatPlannedAt(order.createdAt ? order.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const cell = (label: string, value: unknown, wide = false) =>
    `<td class="lo-label">${escapeHtml(label)}</td><td class="lo-value"${wide ? ' colspan="3"' : ''}>${text(value) ? escapeHtml(value) : '&nbsp;'}</td>`;
  const section = (title: string, rows: string[]) =>
    `<div class="lo-section">${escapeHtml(title)}</div><table class="lo-table">${rows.map((row) => `<tr>${row}</tr>`).join('')}</table>`;
  return `<div class="export-page portrait-export lab-order-export" dir="rtl">
<style>
${options.styles ?? ''}
.lab-order-export{font-family:Arial,"Segoe UI",sans-serif;color:#0b1f3a;padding:28px 34px;box-sizing:border-box;background:#fff}
.lab-order-export .lo-head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #0b1f3a;padding-bottom:10px;margin:12px 0 14px}
.lab-order-export .lo-title{font-size:26px;font-weight:900;margin:0}
.lab-order-export .lo-sub{font-size:13px;color:#475569;margin-top:4px}
.lab-order-export .lo-no{border:2px solid #0b1f3a;border-radius:10px;padding:6px 16px;text-align:center;font-weight:900;font-size:13px}
.lab-order-export .lo-no b{display:block;font-size:26px;line-height:1.1}
.lab-order-export .lo-section{background:#0b1f3a;color:#fff;font-weight:800;font-size:14px;padding:6px 10px;margin-top:14px;border-radius:6px 6px 0 0}
.lab-order-export .lo-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:14px}
.lab-order-export .lo-table td{border:1px solid #c7d2e0;padding:8px 10px;vertical-align:top;word-break:break-word}
.lab-order-export .lo-label{width:19%;background:#f1f5fa;font-weight:800;color:#334155}
.lab-order-export .lo-value{width:31%}
.lab-order-export .lo-notes{min-height:60px;white-space:pre-wrap}
.lab-order-export .lo-request{margin-top:16px;padding:10px 12px;border:1px dashed #b45309;background:#fffbeb;border-radius:8px;font-size:13px;font-weight:700;color:#7c2d12}
.lab-order-export .lo-sign{display:flex;gap:24px;margin-top:26px;font-size:13px}
.lab-order-export .lo-sign div{flex:1;border-top:1px solid #64748b;padding-top:6px;color:#475569}
</style>
${options.headerHtml ?? ''}
<div class="lo-head">
  <div>
    <h1 class="lo-title">הזמנת ${kindWord}</h1>
    <div class="lo-sub">${escapeHtml(options.projectName)}${options.checklistLabel ? ` · ${escapeHtml(options.checklistLabel)}` : ''}</div>
  </div>
  <div class="lo-no">מס' הזמנה<b>${escapeHtml(order.orderNo)}</b>${escapeHtml(issued)}</div>
</div>
${section('פרטי ההזמנה', [
  cell('לכבוד', [order.partyName, order.partyEmail].filter(text).join(' · '), true),
  cell(measurement ? 'סוג המדידה' : 'סוג הבדיקה', order.testType, true),
  cell('מועד מבוקש לביצוע', order.plannedAt ? formatPlannedAt(order.plannedAt) : '') + cell('כמות', order.quantity),
])}
${section('מיקום', [
  cell('מבנה', order.structure) + cell('אלמנט / תת אלמנט', order.element),
  cell('מחתך', order.fromChainage) + cell('עד חתך', order.toChainage),
  cell('צד / היסט', order.side, true),
])}
${measurement ? '' : section('חומר', [cell('מקור החומר', order.materialSource) + cell('סוג החומר', order.materialType)])}
${section('איש קשר באתר', [cell('שם', order.contactName) + cell('טלפון', order.contactPhone)])}
${section('הערות', [`<td class="lo-value lo-notes" colspan="4">${text(order.notes) ? escapeHtml(order.notes) : '&nbsp;'}</td>`])}
<div class="lo-request">נא לציין את מספר ההזמנה (${escapeHtml(order.orderNo)}) בתעודה / בדוח ${measurement ? 'המדידה' : 'הבדיקה'} ובמייל החוזר.</div>
<div class="lo-sign"><div>מזמין: ${escapeHtml(order.createdBy || order.contactName)}</div><div>תאריך: ${escapeHtml(issued)}</div><div>חתימה</div></div>
${options.footerHtml ?? ''}
</div>`;
};
