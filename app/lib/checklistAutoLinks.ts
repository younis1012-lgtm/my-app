// קישור אוטומטי של סעיפי רשימת תיוג לנתונים שכבר קיימים במערכת:
//  1. "איתור בדיקות מקדימות לחומר" → בקרה מקדימה מאושרת לחומר (לשונית חומרים).
//  2. "אימות תוצאות / אישור שכבה קודמת" → רשימת התיוג של השכבה שמתחת, באותו מבנה וחתכים.
// הקובץ טהור (ללא React) כדי שישמש גם את המסך וגם את ייצוא ה-PDF.

import { parseChainage } from "../components/LayerTrackingView";

export type ChecklistAutoLinkKind = "preliminary" | "previousLayer";
export type ChecklistAutoLinkState = "linked" | "pending" | "missing";

export type ChecklistAutoLinkCandidate = { id: string; label: string };

export type ChecklistAutoLink = {
  kind: ChecklistAutoLinkKind;
  state: ChecklistAutoLinkState;
  /** שורות תצוגה קצרות למסך */
  lines: string[];
  /** טקסט קצר להדפסה בעמודת "תעודת מעבדה / מסמך" */
  printText: string;
  /** הערה / אזהרה למשתמש */
  warning?: string;
  selectedId?: string;
  manual: boolean;
  candidates: ChecklistAutoLinkCandidate[];
  record?: any;
};

type Helpers = {
  /** מחזיר "מאושר" לרשומה מאושרת (getApprovalDisplayStatus של המערכת) */
  approvalStatus: (record: any) => string;
  /** מספר התצוגה של רשימת תיוג */
  checklistNumber: (record: any) => string | number;
  /** שיוך לעץ הפרויקט: המבנה העליון והנתיב המלא (אם קיים) */
  treeInfo?: (record: any) => { structure: string; path: string } | null;
};

const text = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

export function checklistAutoLinkKind(description: unknown): ChecklistAutoLinkKind | null {
  const d = text(description);
  if (!d) return null;
  if (/בדיקות?\s+מקדימ|בקרה\s+מקדימה/.test(d)) return "preliminary";
  if (/שכב(ה|ות)\s*ה?קודמ/.test(d) && !/ויזואל|חזות/.test(d)) return "previousLayer";
  return null;
}

// ---------- תאריכים ----------

const isoOf = (value: unknown) => {
  const raw = text(value);
  if (!raw) return "";
  const iso = raw.match(/20\d{2}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const dmy = raw.match(/(\d{1,2})[./-](\d{1,2})[./-](20\d{2})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return "";
};

export const formatLinkDate = (value: unknown) => {
  const iso = isoOf(value);
  const m = iso.match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : text(value);
};

/** תאריך האישור של רשומה: חתימת האישור האחרונה, אחרת תאריך הרשומה */
export function approvalDateOf(record: any): string {
  const dates: string[] = [];
  const push = (value: unknown) => {
    const iso = isoOf(value);
    if (iso) dates.push(iso);
  };
  push(record?.approvedAt);
  push(record?.approval?.approvedAt);
  push(record?.approval?.approved_at);
  (Array.isArray(record?.approval?.signatures) ? record.approval.signatures : []).forEach((sig: any) => {
    if (text(sig?.signature) || text(sig?.signerName)) push(sig?.signedAt);
  });
  if (!dates.length) {
    (Array.isArray(record?.items) ? record.items : []).forEach((item: any) => {
      if (text(item?.signature?.signature)) push(item?.signature?.signedAt || item?.executionDate);
    });
  }
  if (!dates.length) push(record?.date);
  if (!dates.length) push(record?.savedAt);
  return dates.sort().pop() ?? "";
}

// ---------- חומרים (בקרה מקדימה) ----------

const materialNameOf = (record: any) =>
  text(record?.materialName || record?.material?.materialName || record?.title);
const materialSourceOf = (record: any) => text(record?.material?.source || record?.source || record?.supplierName);

/** "א" / "ב" אם מצוין סוג מצע בטקסט */
const baseClassOf = (value: string) => {
  const m = value.match(/מצע(?:ים)?\s*(?:סוג\s*)?[״"׳'`]?\s*([אב])(?![א-ת])/);
  return m ? m[1] : "";
};

function materialScore(hint: string, record: any) {
  const name = materialNameOf(record);
  if (!name) return -1;
  if (/מצע/.test(hint)) {
    if (!/מצע/.test(name)) return -1;
    const wanted = baseClassOf(hint);
    const have = baseClassOf(name);
    if (wanted && have && wanted !== have) return -1;
    return wanted && have === wanted ? 3 : 2;
  }
  if (/בטון/.test(hint)) return /בטון/.test(name) ? 2 : -1;
  if (/אספלט|ביטומנ/.test(hint)) return /אספלט|ביטומנ/.test(name) ? 2 : -1;
  // ללא רמז ברור לחומר – כל חומר נחשב מועמד, בעדיפות נמוכה
  return 0;
}

function preliminaryLabel(record: any) {
  const name = materialNameOf(record) || "חומר";
  const source = materialSourceOf(record);
  return source ? `${name} · ${source}` : name;
}

export function resolvePreliminaryLink(
  item: any,
  form: any,
  preliminaryRecords: any[],
  helpers: Helpers,
): ChecklistAutoLink {
  const hint = text(
    [item?.description, form?.title, form?.category, form?.workType, form?.roadStructure, form?.notes].join(" "),
  );
  const materials = (preliminaryRecords ?? []).filter((record) => record?.subtype === "materials");
  const scored = materials
    .map((record) => ({ record, score: materialScore(hint, record), approved: helpers.approvalStatus(record) === "מאושר" }))
    .filter((entry) => entry.score >= 0)
    .sort(
      (a, b) =>
        Number(b.approved) - Number(a.approved) ||
        b.score - a.score ||
        approvalDateOf(b.record).localeCompare(approvalDateOf(a.record)),
    );

  const candidates = scored.map(({ record, approved }) => ({
    id: String(record.id),
    label: `${preliminaryLabel(record)}${approved ? "" : " (טרם אושר)"}`,
  }));

  const manualId = text(item?.linkedRecordId);
  const manual = manualId ? materials.find((record) => String(record.id) === manualId) : undefined;
  const chosen = manual ?? scored[0]?.record;

  if (!chosen) {
    return {
      kind: "preliminary",
      state: "missing",
      lines: [],
      printText: "",
      warning: "לא נמצאה בקרה מקדימה לחומר זה במערכת",
      manual: false,
      candidates,
    };
  }

  const approved = helpers.approvalStatus(chosen) === "מאושר";
  const date = formatLinkDate(approvalDateOf(chosen));
  const approvalNo = text(chosen?.material?.approvalNo || chosen?.approvalNo);
  const refNo = approvalNo || text(chosen?.displayNumber || chosen?.formNo || chosen?.number);
  const lines = [
    `בקרה מקדימה לחומר: ${preliminaryLabel(chosen)}`,
    approved ? `סטטוס: מאושר${date ? ` · תאריך אישור: ${date}` : ""}` : "סטטוס: טרם אושר",
  ];
  const printText = [`בקרה מקדימה: ${materialNameOf(chosen) || "חומר"}`, refNo ? `מס׳ ${refNo}` : "", approved && date ? `אושר ${date}` : approved ? "מאושר" : "טרם אושר"]
    .filter(Boolean)
    .join(" · ");

  return {
    kind: "preliminary",
    state: approved ? "linked" : "pending",
    lines,
    printText,
    warning: approved ? undefined : "הבקרה המקדימה לחומר זה טרם אושרה",
    selectedId: String(chosen.id),
    manual: Boolean(manual),
    candidates,
    record: chosen,
  };
}

// ---------- שכבה קודמת ----------

const structureOf = (record: any, helpers?: Helpers) =>
  text(helpers?.treeInfo?.(record)?.structure || record?.roadStructure || record?.structure || record?.building || record?.structureName);
const layerTextOf = (record: any) =>
  text(record?.layerNo || record?.layerNumber || record?.layer || record?.details?.layerNo || record?.location);
const layerNumberOf = (record: any) => {
  const m = layerTextOf(record).match(/(\d+)/);
  return m ? Number(m[1]) : null;
};
const elementTextOf = (record: any, helpers?: Helpers) =>
  text([record?.category, record?.workType, record?.title, helpers?.treeInfo?.(record)?.path].join(" "));
const fromOf = (record: any) => parseChainage(record?.stationSection ?? record?.fromSection ?? record?.fromChainage);
const toOf = (record: any) => parseChainage(record?.toStationSection ?? record?.toSection ?? record?.toChainage);

/** סדר השכבות מלמטה למעלה */
function elementRank(value: string) {
  if (/אספלט|ביטומנ|מצעים\s+מיוצבים/.test(value)) return 6;
  if (/מצע/.test(value)) return baseClassOf(value) === "ב" ? 4 : 5;
  if (/שתית/.test(value)) return 3;
  if (/מילוי|הידוק|החלפת\s+קרקע|עפר/.test(value)) return 2;
  if (/חפיר/.test(value)) return 1;
  return 0;
}

const sameStructure = (a: string, b: string) => {
  if (!a || !b) return true;
  const norm = (value: string) => value.replace(/[\s\-_'"׳״]/g, "").toLowerCase();
  return norm(a) === norm(b) || norm(a).includes(norm(b)) || norm(b).includes(norm(a));
};

function rangesOverlap(form: any, record: any) {
  const a1 = fromOf(form);
  const a2 = toOf(form);
  const b1 = fromOf(record);
  const b2 = toOf(record);
  if (a1 === null || a2 === null || b1 === null || b2 === null) return null;
  const [s1, e1] = a1 <= a2 ? [a1, a2] : [a2, a1];
  const [s2, e2] = b1 <= b2 ? [b1, b2] : [b2, b1];
  if (s1 === e1 || s2 === e2) return Math.max(s1, s2) <= Math.min(e1, e2);
  return Math.max(s1, s2) < Math.min(e1, e2);
}

function previousLayerScore(form: any, record: any, helpers?: Helpers) {
  const n = layerNumberOf(form);
  const m = layerNumberOf(record);
  const formRank = elementRank(elementTextOf(form, helpers));
  const recordRank = elementRank(elementTextOf(record, helpers));
  const sameElement =
    text(record?.templateKey) && text(record?.templateKey) === text(form?.templateKey)
      ? formRank === recordRank
      : formRank !== 0 && formRank === recordRank;

  if (sameElement) {
    if (n !== null && m !== null) {
      if (m === n - 1) return 100;
      if (m < n) return 60 + m;
      return -1;
    }
    return -1;
  }
  // שכבה ראשונה של אלמנט → השכבה העליונה של האלמנט שמתחתיו
  if (formRank > 0 && recordRank > 0 && recordRank < formRank && (n === null || n <= 1)) {
    return 40 + recordRank * 5 + Math.min(m ?? 0, 4);
  }
  return -1;
}

function checklistLabel(record: any, helpers: Helpers) {
  const no = helpers.checklistNumber(record);
  const element = text(record?.category || record?.title) || "רשימת תיוג";
  const layer = layerTextOf(record);
  const from = text(record?.stationSection);
  const to = text(record?.toStationSection);
  // \u2066…\u2069 שומר על סדר החתכים (0+050–0+400) בתוך טקסט עברי
  const range = from || to ? ` · \u2066${from || "?"}–${to || "?"}\u2069` : "";
  return `ר״ת ${no} · ${element}${layer ? ` · שכבה ${layer}` : ""}${range}`;
}

export function resolvePreviousLayerLink(
  item: any,
  form: any,
  checklists: any[],
  currentId: string | null | undefined,
  helpers: Helpers,
): ChecklistAutoLink {
  const formStructure = structureOf(form, helpers);
  const hasChainage = fromOf(form) !== null && toOf(form) !== null;
  const pool = (checklists ?? []).filter((record) => record && String(record.id) !== String(currentId ?? ""));

  const eligible = pool
    .filter((record) => sameStructure(formStructure, structureOf(record, helpers)))
    .filter((record) => rangesOverlap(form, record) !== false);

  const scored = eligible
    .map((record) => ({ record, score: previousLayerScore(form, record, helpers) }))
    .filter((entry) => entry.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(helpers.approvalStatus(b.record) === "מאושר") - Number(helpers.approvalStatus(a.record) === "מאושר") ||
        approvalDateOf(b.record).localeCompare(approvalDateOf(a.record)),
    );

  // לבחירה ידנית: כל רשימות התיוג באותו מבנה וחתכים (ולא רק המתאימות לפי השכבה)
  const candidateRecords = [
    ...scored.map((entry) => entry.record),
    ...eligible.filter((record) => !scored.some((entry) => entry.record === record)),
  ].slice(0, 40);
  const candidates = candidateRecords.map((record) => ({
    id: String(record.id),
    label: `${checklistLabel(record, helpers)}${helpers.approvalStatus(record) === "מאושר" ? "" : " (טרם אושרה)"}`,
  }));

  const manualId = text(item?.linkedRecordId);
  const manual = manualId ? pool.find((record) => String(record.id) === manualId) : undefined;
  const chosen = manual ?? scored[0]?.record;
  const chainageNote = hasChainage ? undefined : "לא הוזנו מחתך / לחתך – הקישור נעשה לפי מבנה ושכבה בלבד";

  if (!chosen) {
    return {
      kind: "previousLayer",
      state: "missing",
      lines: [],
      printText: "",
      warning: layerNumberOf(form) === null && !elementRank(elementTextOf(form, helpers))
        ? "כדי לאתר את השכבה הקודמת יש למלא מספר שכבה, מבנה ומחתך / לחתך"
        : "לא נמצאה רשימת תיוג לשכבה הקודמת באותו מבנה וחתכים",
      manual: false,
      candidates,
    };
  }

  const approved = helpers.approvalStatus(chosen) === "מאושר";
  const date = formatLinkDate(approvalDateOf(chosen));
  const no = helpers.checklistNumber(chosen);
  const lines = [
    `שכבה קודמת: ${checklistLabel(chosen, helpers)}`,
    approved ? `סטטוס: אושרה${date ? ` ב-${date}` : ""}` : "סטטוס: טרם אושרה",
  ];
  if (chainageNote) lines.push(chainageNote);
  const printText = [`ר״ת שכבה קודמת מס׳ ${no}`, approved && date ? `אושרה ${date}` : approved ? "אושרה" : "טרם אושרה"].join(" · ");

  return {
    kind: "previousLayer",
    state: approved ? "linked" : "pending",
    lines,
    printText,
    warning: approved ? undefined : "השכבה הקודמת טרם אושרה – יש לוודא אישור לפני המשך העבודה",
    selectedId: String(chosen.id),
    manual: Boolean(manual),
    candidates,
    record: chosen,
  };
}
