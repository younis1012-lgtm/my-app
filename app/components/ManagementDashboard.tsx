"use client";

// לוח בקרה ניהולי + דוח תקופתי
// מענה לדרישת מפרט נתיבי ישראל 00.02.04.08 – "רכיב הפקת הדו"חות":
//   (2) דו"חות מנהלים המציגים בצורה מסוכמת וגרפית את המידע ומאפשרת איתור חריגים
//   (3)+(4) דו"חות תקופתיים המופקים לפי דרישה (יום / שבוע / חודש / טווח חופשי)
// העיצוב מקורי למערכת Y.K Quality: פסי סטטוס אופקיים, מפת חום לפי עץ המבנה,
// רשימת חריגים וקווי מגמה – ללא גרפי טבעת, מדי מחוג או עמודות+קו.

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

type AnyRecord = Record<string, any>;

type StructureNode = {
  id: string;
  parentId: string;
  name: string;
  code?: string;
  nodeType?: string;
  sortOrder?: number;
};

export type ManagementDashboardProps = {
  projectName: string;
  checklists: AnyRecord[];
  nonconformances: AnyRecord[];
  trialSections: AnyRecord[];
  preliminary: AnyRecord[];
  rfis: AnyRecord[];
  supervisionReports: AnyRecord[];
  holdPoints: AnyRecord[];
  structureNodes: StructureNode[];
  getApprovalStatus: (record: AnyRecord) => string;
  getPreliminaryExpiry: (record: AnyRecord) => string;
  onNavigate: (section: string) => void;
  // פתיחה ישירה של רשומה מסוימת (טופס העריכה שלה) מתוך לוח הבקרה
  onOpenRecord?: (module: ModuleKey, id: string) => void;
};

export type ModuleKey = "checklists" | "nonconformances" | "trialSections" | "preliminary" | "rfi" | "supervisionReports" | "holdPoints";
type State = "closed" | "progress" | "draft" | "rejected";

type Row = {
  module: ModuleKey;
  id: string;
  title: string;
  opened: Date | null;
  closed: Date | null;
  due: Date | null;
  state: State;
  nodeId: string;
  location: string;
  statusText: string;
  raw: AnyRecord;
};

const MODULES: Array<{ key: ModuleKey; label: string; short: string }> = [
  { key: "checklists", label: "רשימות תיוג", short: "רש״ת" },
  { key: "nonconformances", label: "אי־התאמות", short: "NCR" },
  { key: "holdPoints", label: "נקודות עצירה", short: "עצירה" },
  { key: "trialSections", label: "קטעי ניסוי", short: "ניסוי" },
  { key: "preliminary", label: "בקרה מקדימה", short: "מקדימה" },
  { key: "rfi", label: "RFI", short: "RFI" },
  { key: "supervisionReports", label: "פיקוח עליון", short: "פיקוח" },
];

const STATE_META: Record<State, { label: string; color: string }> = {
  closed: { label: "סגור / מאושר", color: "#0f766e" },
  progress: { label: "בטיפול", color: "#d4a017" },
  draft: { label: "טיוטה", color: "#94a3b8" },
  rejected: { label: "נדחה / לא תקין", color: "#b91c1c" },
};

const NAVY = "#0b1f3a";
const DAY = 24 * 60 * 60 * 1000;

// ---------- עזרי תאריך וסטטוס ----------

export function parseAnyDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value ?? "").trim();
  if (!text) return null;
  const local = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (local) {
    const year = Number(local[3].length === 2 ? `20${local[3]}` : local[3]);
    const date = new Date(year, Number(local[2]) - 1, Number(local[1]), Number(local[4] ?? 0), Number(local[5] ?? 0), Number(local[6] ?? 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const direct = new Date(text);
  return Number.isNaN(direct.getTime()) ? null : direct;
}

const firstDate = (...values: unknown[]) => {
  for (const value of values) {
    const date = parseAnyDate(value);
    if (date) return date;
  }
  return null;
};

const fmt = (date: Date | null) =>
  date ? new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date) : "";

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const text = (...values: unknown[]) => values.map((value) => String(value ?? "").trim()).find(Boolean) ?? "";

function classify(statusText: string): State {
  const value = statusText.toLowerCase();
  if (/לא מאושר|נדחה|לא תקין|rejected/.test(value)) return "rejected";
  if (/סגור|נסגר|מאושר|הושלם|נעול|שוחרר|נענה|approved|closed|done/.test(value)) return "closed";
  if (/טיוטה|draft/.test(value) || !value) return "draft";
  return "progress";
}

export function buildRows(props: ManagementDashboardProps): Row[] {
  const rows: Row[] = [];
  const push = (module: ModuleKey, record: AnyRecord, fields: Partial<Row> & { statusText: string }) => {
    rows.push({
      module,
      id: String(record?.id ?? `${module}-${rows.length}`),
      title: fields.title || "ללא כותרת",
      opened: fields.opened ?? null,
      closed: fields.closed ?? null,
      due: fields.due ?? null,
      state: fields.state ?? classify(fields.statusText),
      nodeId: String(record?.structureNodeId ?? record?.structure_node_id ?? ""),
      location: fields.location ?? text(record?.location, record?.element),
      statusText: fields.statusText,
      raw: record,
    });
  };

  props.checklists.forEach((record) => {
    const approval = props.getApprovalStatus(record);
    const defects = (Array.isArray(record?.items) ? record.items : []).filter((item: AnyRecord) => String(item?.status ?? "").includes("לא תקין")).length;
    const approved = approval === "מאושר";
    const rejected = String(record?.approval?.status ?? "") === "rejected";
    push("checklists", record, {
      title: text(record?.title, record?.category, `רשימת תיוג ${record?.checklistNo ?? ""}`),
      opened: firstDate(record?.date, record?.savedAt),
      closed: approved ? firstDate(record?.savedAt, record?.date) : null,
      statusText: rejected ? "נדחה" : approved ? "מאושר" : defects ? `בטיפול · ${defects} סעיפים לא תקינים` : text(record?.status, "בביצוע"),
      state: rejected ? "rejected" : approved ? "closed" : "progress",
    });
  });

  props.nonconformances.forEach((record) => {
    const status = text(record?.status, "פתוח");
    push("nonconformances", record, {
      title: text(record?.title, record?.description, "אי־התאמה"),
      opened: firstDate(record?.date, record?.savedAt),
      closed: classify(status) === "closed" ? firstDate(record?.closingDate, record?.savedAt) : null,
      due: firstDate(record?.updatedExpectedCloseDate, record?.expectedCloseDate),
      statusText: status,
      state: classify(status) === "closed" ? "closed" : "progress",
    });
  });

  props.trialSections.forEach((record) => {
    const approval = props.getApprovalStatus(record);
    const status = approval === "מאושר" ? "מאושר" : text(record?.status, approval, "בטיפול");
    push("trialSections", record, {
      title: text(record?.title, "קטע ניסוי"),
      opened: firstDate(record?.date, record?.savedAt),
      closed: classify(status) === "closed" ? firstDate(record?.savedAt) : null,
      statusText: status,
    });
  });

  props.preliminary.forEach((record) => {
    const approval = props.getApprovalStatus(record);
    const expiry = parseAnyDate(props.getPreliminaryExpiry(record));
    const expired = Boolean(expiry && expiry < startOfDay(new Date()));
    const status = expired ? "תוקף פג" : approval === "מאושר" ? "מאושר" : text(record?.status, approval, "טיוטה");
    push("preliminary", record, {
      title: text(record?.title, record?.subtype),
      opened: firstDate(record?.date, record?.savedAt),
      closed: approval === "מאושר" ? firstDate(record?.savedAt) : null,
      due: expiry,
      statusText: status,
      state: expired ? "rejected" : classify(status),
    });
  });

  props.rfis.forEach((record) => {
    const status = text(record?.status, "פתוח");
    push("rfi", record, {
      title: text(record?.title, record?.referenceNo, "RFI"),
      opened: firstDate(record?.openDate, record?.savedAt),
      closed: classify(status) === "closed" ? firstDate(record?.closeDate, record?.closedAt) : null,
      statusText: status,
      state: classify(status) === "closed" ? "closed" : "progress",
    });
  });

  props.supervisionReports.forEach((record) => {
    const status = text(record?.status, "פתוח");
    push("supervisionReports", record, {
      title: text(record?.title, record?.reportNo, "דוח פיקוח עליון"),
      opened: firstDate(record?.date, record?.savedAt),
      closed: classify(status) === "closed" ? firstDate(record?.treatmentDate, record?.savedAt) : null,
      due: classify(status) === "closed" ? null : firstDate(record?.treatmentDate),
      statusText: status,
      state: classify(status) === "closed" ? "closed" : "progress",
    });
  });

  props.holdPoints.forEach((record) => {
    const status = text(record?.status, "נוצרה, לא הושלמה");
    push("holdPoints", record, {
      title: text(record?.name, record?.referenceNo, `נקודת עצירה ${record?.serialNo ?? ""}`),
      opened: firstDate(record?.createdAt),
      closed: firstDate(record?.releasedAt),
      statusText: status,
      state: status.includes("שוחרר") ? "closed" : "progress",
      location: text(record?.element, record?.location),
    });
  });

  const nodeNames = new Map(props.structureNodes.map((node) => [node.id, text(node.code && `${node.code} · ${node.name}`, node.name)]));
  rows.forEach((row) => {
    const nodeName = nodeNames.get(row.nodeId);
    if (nodeName) row.location = row.location && row.location !== nodeName ? `${nodeName} · ${row.location}` : nodeName;
  });
  return rows;
}

const isOpenAt = (row: Row, at: Date) => {
  if (row.state === "draft") return false;
  if (row.opened && row.opened > at) return false;
  if (row.state === "closed") return Boolean(row.closed && row.closed > at);
  return true;
};

const isOverdue = (row: Row, today: Date) => row.state !== "closed" && Boolean(row.due && row.due < today);

type Exception = { row: Row; reason: string; weight: number; age: number };

function findExceptions(rows: Row[], today: Date): Exception[] {
  const list: Exception[] = [];
  rows.forEach((row) => {
    const age = row.opened ? Math.max(0, Math.floor((today.getTime() - row.opened.getTime()) / DAY)) : 0;
    if (row.module === "preliminary" && row.state === "rejected") {
      list.push({ row, reason: `תוקף האישור פג ב־${fmt(row.due)}`, weight: 90, age });
      return;
    }
    if (row.module === "preliminary" && row.state !== "closed" && row.due) {
      const left = Math.floor((row.due.getTime() - today.getTime()) / DAY);
      if (left >= 0 && left <= 30) list.push({ row, reason: `תוקף האישור פג בעוד ${left} ימים`, weight: 40, age });
    }
    if (row.state === "rejected" && row.module !== "preliminary") {
      list.push({ row, reason: "רשומה שנדחתה – נדרש טיפול", weight: 80, age });
    }
    if (isOverdue(row, today)) {
      const late = Math.floor((today.getTime() - (row.due as Date).getTime()) / DAY);
      list.push({ row, reason: `חורג מתאריך היעד ב־${late} ימים`, weight: 70 + Math.min(late, 25), age });
    }
    if (row.module === "nonconformances" && row.state !== "closed" && !row.due && age > 30) {
      list.push({ row, reason: `פתוחה ${age} ימים ללא תאריך יעד`, weight: 55, age });
    }
    if (row.module === "nonconformances" && row.state !== "closed" && String(row.raw?.severity ?? "").includes("גבוה")) {
      list.push({ row, reason: "חומרה גבוהה – פתוחה", weight: 75, age });
    }
    if (row.module === "checklists" && row.statusText.includes("לא תקינים")) {
      list.push({ row, reason: row.statusText.replace("בטיפול · ", ""), weight: 50, age });
    }
    if (row.module === "rfi" && row.state !== "closed" && age > 14) {
      list.push({ row, reason: `ממתין להתייחסות ${age} ימים`, weight: 35 + Math.min(age, 30), age });
    }
  });
  const unique = new Map<string, Exception>();
  list.forEach((item) => {
    const key = `${item.row.module}:${item.row.id}`;
    const existing = unique.get(key);
    if (!existing || existing.weight < item.weight) unique.set(key, item);
  });
  return [...unique.values()].sort((a, b) => b.weight - a.weight || b.age - a.age);
}

// ---------- דוח תקופתי (Excel) ----------

type Period = { from: Date; to: Date; label: string };

export async function exportPeriodicReport(rows: Row[], period: Period, projectName: string) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Y.K Quality";
  workbook.created = new Date();
  const today = startOfDay(new Date());
  const inPeriod = (date: Date | null) => Boolean(date && date >= period.from && date <= period.to);
  const headerFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0B1F3A" } };
  const styleHeader = (row: any) => {
    row.eachCell((cell: any) => {
      cell.fill = headerFill;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    row.height = 22;
  };
  const addSheet = (name: string, columns: Array<{ header: string; width: number }>) => {
    const sheet = workbook.addWorksheet(name, { views: [{ rightToLeft: true, state: "frozen", ySplit: 4 }] });
    sheet.getCell("A1").value = `${projectName} – ${name}`;
    sheet.getCell("A1").font = { bold: true, size: 14 };
    sheet.getCell("A2").value = `תקופה: ${period.label} (${fmt(period.from)} – ${fmt(period.to)}) · הופק: ${fmt(new Date())}`;
    sheet.columns = columns.map((column) => ({ width: column.width }));
    const header = sheet.getRow(4);
    header.values = columns.map((column) => column.header);
    styleHeader(header);
    return sheet;
  };

  const summary = addSheet("סיכום תקופה", [
    { header: "מודול", width: 20 },
    { header: "נפתחו בתקופה", width: 15 },
    { header: "נסגרו / אושרו בתקופה", width: 20 },
    { header: "פתוחים בסוף התקופה", width: 20 },
    { header: "באיחור (נכון להיום)", width: 18 },
    { header: "סה״כ בפרויקט", width: 15 },
  ]);
  MODULES.forEach((mod) => {
    const moduleRows = rows.filter((row) => row.module === mod.key);
    summary.addRow([
      mod.label,
      moduleRows.filter((row) => inPeriod(row.opened)).length,
      moduleRows.filter((row) => row.state === "closed" && inPeriod(row.closed)).length,
      moduleRows.filter((row) => isOpenAt(row, period.to)).length,
      moduleRows.filter((row) => isOverdue(row, today)).length,
      moduleRows.length,
    ]);
  });

  const exceptions = addSheet("חריגים לטיפול", [
    { header: "מודול", width: 16 },
    { header: "רשומה", width: 40 },
    { header: "מיקום / רכיב", width: 22 },
    { header: "סטטוס", width: 22 },
    { header: "סיבת החריגה", width: 38 },
    { header: "נפתח", width: 13 },
  ]);
  findExceptions(rows, today).forEach((item) => {
    exceptions.addRow([
      MODULES.find((mod) => mod.key === item.row.module)?.label ?? item.row.module,
      item.row.title,
      item.row.location,
      item.row.statusText,
      item.reason,
      fmt(item.row.opened),
    ]);
  });

  MODULES.forEach((mod) => {
    const moduleRows = rows
      .filter((row) => row.module === mod.key && (inPeriod(row.opened) || inPeriod(row.closed)))
      .sort((a, b) => (a.opened?.getTime() ?? 0) - (b.opened?.getTime() ?? 0));
    const sheet = addSheet(mod.label, [
      { header: "#", width: 6 },
      { header: "רשומה", width: 42 },
      { header: "מיקום / רכיב", width: 24 },
      { header: "נפתח", width: 13 },
      { header: "נסגר / אושר", width: 13 },
      { header: "תאריך יעד / תוקף", width: 16 },
      { header: "סטטוס", width: 26 },
    ]);
    moduleRows.forEach((row, index) => {
      sheet.addRow([index + 1, row.title, row.location, fmt(row.opened), fmt(row.closed), fmt(row.due), row.statusText]);
    });
    if (!moduleRows.length) sheet.addRow(["", "אין רשומות בתקופה זו"]);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `דוח תקופתי - ${projectName} - ${period.label} - ${fmt(period.to).replace(/\//g, "-")}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------- רכיבים גרפיים ----------

const panel: CSSProperties = {
  background: "#fff",
  border: "1px solid #dbe3ee",
  borderRadius: 14,
  padding: 16,
  minWidth: 0,
};

function PanelTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: NAVY, borderInlineStart: "4px solid #d4a017", paddingInlineStart: 10 }}>{children}</h3>
      {hint ? <span style={{ color: "#64748b", fontSize: 13 }}>{hint}</span> : null}
    </div>
  );
}

function StackedBar({ counts, onClick }: { counts: Record<State, number>; onClick?: () => void }) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return (
    <div onClick={onClick} style={{ display: "flex", height: 14, borderRadius: 4, overflow: "hidden", background: "#eef2f7", cursor: onClick ? "pointer" : "default" }}>
      {total
        ? (Object.keys(STATE_META) as State[]).map((state) =>
            counts[state] ? (
              <div
                key={state}
                title={`${STATE_META[state].label}: ${counts[state]}`}
                style={{ width: `${(counts[state] / total) * 100}%`, background: STATE_META[state].color }}
              />
            ) : null,
          )
        : null}
    </div>
  );
}

function Sparkline({ values, color = NAVY }: { values: number[]; color?: string }) {
  const width = 150;
  const height = 38;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((value, index) => `${(index * step).toFixed(1)},${(height - 3 - (value / max) * (height - 8)).toFixed(1)}`);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", direction: "ltr" }} aria-hidden="true">
      <polyline points={`0,${height} ${points.join(" ")} ${width},${height}`} fill={color} opacity={0.08} stroke="none" />
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {values.length ? <circle cx={(values.length - 1) * step} cy={points[points.length - 1].split(",")[1]} r={3} fill={color} /> : null}
    </svg>
  );
}

const heatColor = (value: number, max: number) => {
  if (!value) return "#f8fafc";
  const ratio = Math.min(1, value / Math.max(1, max));
  const alpha = 0.18 + ratio * 0.72;
  return `rgba(185, 28, 28, ${alpha.toFixed(2)})`;
};

// ---------- הרכיב הראשי ----------

type PeriodKey = "day" | "week" | "month" | "quarter" | "custom";

function periodFor(key: PeriodKey, customFrom: string, customTo: string): Period {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const days = (count: number) => new Date(end.getFullYear(), end.getMonth(), end.getDate() - count + 1);
  if (key === "day") return { from: days(1), to: end, label: "יומי" };
  if (key === "week") return { from: days(7), to: end, label: "שבועי" };
  if (key === "quarter") return { from: days(90), to: end, label: "רבעוני" };
  if (key === "custom") {
    const from = parseAnyDate(customFrom) ?? days(30);
    const toDate = parseAnyDate(customTo) ?? end;
    return { from, to: new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59), label: "טווח נבחר" };
  }
  return { from: days(30), to: end, label: "חודשי" };
}

export function ManagementDashboard(props: ManagementDashboardProps) {
  const [periodKey, setPeriodKey] = useState<PeriodKey>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const [showAllExceptions, setShowAllExceptions] = useState(false);
  const [drill, setDrill] = useState<{ title: string; rows: Row[]; module?: ModuleKey } | null>(null);

  const rows = useMemo(
    () => buildRows(props),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.checklists, props.nonconformances, props.trialSections, props.preliminary, props.rfis, props.supervisionReports, props.holdPoints, props.structureNodes],
  );
  const today = useMemo(() => startOfDay(new Date()), []);
  const period = useMemo(() => periodFor(periodKey, customFrom, customTo), [periodKey, customFrom, customTo]);
  const inPeriod = (date: Date | null) => Boolean(date && date >= period.from && date <= period.to);

  const moduleStats = useMemo(
    () =>
      MODULES.map((mod) => {
        const moduleRows = rows.filter((row) => row.module === mod.key);
        const counts: Record<State, number> = { closed: 0, progress: 0, draft: 0, rejected: 0 };
        moduleRows.forEach((row) => (counts[row.state] += 1));
        return {
          ...mod,
          total: moduleRows.length,
          counts,
          open: moduleRows.filter((row) => row.state === "progress" || row.state === "rejected").length,
          overdue: moduleRows.filter((row) => isOverdue(row, today)).length,
          openedInPeriod: moduleRows.filter((row) => inPeriod(row.opened)).length,
          closedInPeriod: moduleRows.filter((row) => row.state === "closed" && inPeriod(row.closed)).length,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, period, today],
  );

  const exceptions = useMemo(() => findExceptions(rows, today), [rows, today]);

  // קווי מגמה – רשומות חדשות לפי חודש, 12 חודשים אחרונים
  const months = useMemo(() => {
    const list: Date[] = [];
    for (let offset = 11; offset >= 0; offset -= 1) list.push(new Date(today.getFullYear(), today.getMonth() - offset, 1));
    return list;
  }, [today]);
  const monthlyNew = (key: ModuleKey) =>
    months.map((month) => {
      const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      return rows.filter((row) => row.module === key && row.opened && row.opened >= month && row.opened < next).length;
    });

  // גיל אי־התאמות פתוחות
  const ncrAging = useMemo(() => {
    const buckets = [
      { label: "עד שבוע", max: 7, count: 0, color: "#0f766e" },
      { label: "8–30 ימים", max: 30, count: 0, color: "#d4a017" },
      { label: "31–90 ימים", max: 90, count: 0, color: "#ea580c" },
      { label: "מעל 90 ימים", max: Infinity, count: 0, color: "#b91c1c" },
    ];
    rows
      .filter((row) => row.module === "nonconformances" && row.state !== "closed")
      .forEach((row) => {
        const age = row.opened ? Math.floor((today.getTime() - row.opened.getTime()) / DAY) : 0;
        const bucket = buckets.find((item) => age <= item.max) ?? buckets[buckets.length - 1];
        bucket.count += 1;
      });
    return buckets;
  }, [rows, today]);
  const ncrOpenTotal = ncrAging.reduce((sum, item) => sum + item.count, 0);

  // מפת חום לפי עץ המבנה – גלגול לרמה העליונה (או לרמה השנייה כשיש שורש יחיד)
  const heatmap = useMemo(() => {
    const byId = new Map(props.structureNodes.map((node) => [node.id, node]));
    const roots = props.structureNodes.filter((node) => !node.parentId || !byId.has(node.parentId));
    const groupLevel = roots.length === 1 ? props.structureNodes.filter((node) => node.parentId === roots[0].id) : roots;
    const groupIds = new Set(groupLevel.map((node) => node.id));
    const groupOf = (nodeId: string) => {
      let current = byId.get(nodeId);
      let guard = 0;
      while (current && !groupIds.has(current.id) && guard < 20) {
        current = current.parentId ? byId.get(current.parentId) : undefined;
        guard += 1;
      }
      return current && groupIds.has(current.id) ? current.id : roots.length === 1 && nodeId === roots[0].id ? roots[0].id : "";
    };
    const columns: Array<{ key: string; label: string; test: (row: Row) => boolean }> = [
      { key: "ncr", label: "NCR פתוחות", test: (row) => row.module === "nonconformances" && row.state !== "closed" },
      { key: "defects", label: "רש״ת עם ליקויים", test: (row) => row.module === "checklists" && row.statusText.includes("לא תקינים") },
      { key: "hold", label: "נק׳ עצירה פתוחות", test: (row) => row.module === "holdPoints" && row.state !== "closed" },
      { key: "rfi", label: "RFI פתוחים", test: (row) => row.module === "rfi" && row.state !== "closed" },
      { key: "super", label: "פיקוח עליון פתוח", test: (row) => row.module === "supervisionReports" && row.state !== "closed" },
      { key: "overdue", label: "באיחור", test: (row) => isOverdue(row, today) },
    ];
    const groups = [
      ...[...groupLevel].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((node) => ({ id: node.id, name: text(node.code && `${node.code} · ${node.name}`, node.name) })),
      ...(roots.length === 1 ? [{ id: roots[0].id, name: `${roots[0].name} (כללי)` }] : []),
      { id: "", name: "ללא שיוך לעץ המבנה" },
    ];
    const cells = groups.map((group) => ({
      ...group,
      cellRows: columns.map((column) => rows.filter((row) => groupOf(row.nodeId) === group.id && column.test(row))),
      values: columns.map((column) => rows.filter((row) => groupOf(row.nodeId) === group.id && column.test(row)).length),
      total: rows.filter((row) => groupOf(row.nodeId) === group.id).length,
    })).filter((group) => group.total > 0);
    const max = Math.max(1, ...cells.flatMap((group) => group.values));
    return { columns, cells, max };
  }, [rows, props.structureNodes, today]);

  const totalOpen = moduleStats.reduce((sum, mod) => sum + mod.open, 0);
  const totalOverdue = moduleStats.reduce((sum, mod) => sum + mod.overdue, 0);
  const checklistStat = moduleStats.find((mod) => mod.key === "checklists");
  const checklistApprovalRate = checklistStat && checklistStat.total ? Math.round((checklistStat.counts.closed / checklistStat.total) * 100) : 0;
  const ncrStat = moduleStats.find((mod) => mod.key === "nonconformances");
  const ncrClosureRate = ncrStat && ncrStat.total ? Math.round((ncrStat.counts.closed / ncrStat.total) * 100) : 0;

  const runExport = async () => {
    setExporting(true);
    try {
      await exportPeriodicReport(rows, period, props.projectName || "פרויקט");
    } catch (error) {
      console.error("Periodic report export failed", error);
      window.alert("הפקת הדוח התקופתי נכשלה. נסה שוב.");
    } finally {
      setExporting(false);
    }
  };

  const periodButton = (key: PeriodKey, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setPeriodKey(key)}
      style={{
        border: `1px solid ${periodKey === key ? NAVY : "#cbd5e1"}`,
        background: periodKey === key ? NAVY : "#fff",
        color: periodKey === key ? "#fff" : NAVY,
        borderRadius: 8,
        padding: "7px 12px",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  const headlineTiles = [
    { label: "פריטים פתוחים", value: totalOpen, note: "בכל המודולים", tone: NAVY },
    { label: "באיחור מתאריך יעד", value: totalOverdue, note: totalOverdue ? "דורש טיפול" : "אין חריגה", tone: totalOverdue ? "#b91c1c" : "#0f766e" },
    { label: "חריגים לטיפול", value: exceptions.length, note: "ראה רשימה למטה", tone: exceptions.length ? "#b45309" : "#0f766e" },
    { label: "שיעור סגירת NCR", value: `${ncrClosureRate}%`, note: `${ncrStat?.counts.closed ?? 0} מתוך ${ncrStat?.total ?? 0}`, tone: NAVY },
    { label: "רשימות תיוג מאושרות", value: `${checklistApprovalRate}%`, note: `${checklistStat?.counts.closed ?? 0} מתוך ${checklistStat?.total ?? 0}`, tone: NAVY },
  ];

  const visibleExceptions = showAllExceptions ? exceptions : exceptions.slice(0, 8);

  const openRecord = (row: Row) => {
    if (props.onOpenRecord) props.onOpenRecord(row.module, row.id);
    else props.onNavigate(row.module);
  };
  const showDrill = (title: string, list: Row[], module?: ModuleKey) => {
    setDrill({ title, rows: list, module });
    setTimeout(() => document.getElementById("yk-dash-drill")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const openRows = rows.filter((row) => row.state === "progress" || row.state === "rejected");
  const tileActions: Array<() => void> = [
    () => showDrill("כל הפריטים הפתוחים", openRows),
    () => showDrill("פריטים באיחור מתאריך יעד", rows.filter((row) => isOverdue(row, today))),
    () => document.getElementById("yk-dash-exceptions")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    () => showDrill("אי־התאמות פתוחות", openRows.filter((row) => row.module === "nonconformances"), "nonconformances"),
    () => showDrill("רשימות תיוג שטרם אושרו", rows.filter((row) => row.module === "checklists" && row.state !== "closed"), "checklists"),
  ];

  return (
    <section dir="rtl" style={{ display: "grid", gap: 16 }}>
      {/* כותרת + בורר תקופה */}
      <div style={{ ...panel, background: NAVY, color: "#fff", border: 0, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#d4a017", fontWeight: 900, fontSize: 13, letterSpacing: 0.5 }}>לוח בקרה ניהולי</div>
          <h2 style={{ margin: "4px 0 0", fontSize: 22 }}>{props.projectName || "פרויקט"}</h2>
          <div style={{ color: "#cbd5e1", fontSize: 13, marginTop: 4 }}>
            תקופה: {period.label} · {fmt(period.from)} – {fmt(period.to)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", background: "#fff", padding: 4, borderRadius: 10 }}>
            {periodButton("day", "יום")}
            {periodButton("week", "שבוע")}
            {periodButton("month", "חודש")}
            {periodButton("quarter", "רבעון")}
            {periodButton("custom", "טווח")}
          </div>
          {periodKey === "custom" ? (
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} style={{ borderRadius: 8, border: 0, padding: 6 }} />
              <span>עד</span>
              <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} style={{ borderRadius: 8, border: 0, padding: 6 }} />
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void runExport()}
            disabled={exporting}
            style={{ border: 0, borderRadius: 10, padding: "10px 16px", fontWeight: 900, background: "#d4a017", color: NAVY, cursor: exporting ? "wait" : "pointer" }}
          >
            {exporting ? "מפיק דוח..." : "⬇ הפק דוח תקופתי (Excel)"}
          </button>
        </div>
      </div>

      {/* מדדים עיקריים */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 12 }}>
        {headlineTiles.map((tile, index) => (
          <div
            key={tile.label}
            role="button"
            tabIndex={0}
            onClick={tileActions[index]}
            onKeyDown={(event) => { if (event.key === "Enter") tileActions[index](); }}
            title="לחץ לפירוט"
            style={{ ...panel, padding: "14px 16px", borderTop: `4px solid ${tile.tone}`, cursor: "pointer" }}
          >
            <div style={{ color: "#475569", fontWeight: 800, fontSize: 13 }}>{tile.label}</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: tile.tone, marginTop: 4 }}>{tile.value}</div>
            <div style={{ color: "#64748b", fontSize: 12 }}>{tile.note} · <span style={{ color: "#1d4ed8", fontWeight: 800 }}>פירוט ←</span></div>
          </div>
        ))}
      </div>

      {/* פירוט לפי בחירה – כל שורה פותחת את הרשומה עצמה */}
      {drill ? (
        <div id="yk-dash-drill" style={{ ...panel, border: `2px solid ${NAVY}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: NAVY }}>{drill.title} ({drill.rows.length})</h3>
            <span style={{ display: "flex", gap: 8 }}>
              {drill.module ? (
                <button type="button" onClick={() => props.onNavigate(drill.module as string)} style={{ border: `1px solid ${NAVY}`, background: "#fff", color: NAVY, borderRadius: 8, padding: "6px 12px", fontWeight: 800, cursor: "pointer" }}>
                  למסך המודול המלא
                </button>
              ) : null}
              <button type="button" onClick={() => setDrill(null)} style={{ border: 0, background: "#e2e8f0", color: NAVY, borderRadius: 8, padding: "6px 12px", fontWeight: 800, cursor: "pointer" }}>
                סגור ✕
              </button>
            </span>
          </div>
          {drill.rows.length ? (
            <div style={{ display: "grid", gap: 6, maxHeight: 420, overflowY: "auto" }}>
              {drill.rows.map((row) => (
                <div
                  key={`${row.module}-${row.id}`}
                  onClick={() => openRecord(row)}
                  style={{ display: "grid", gridTemplateColumns: "70px 1fr auto", gap: 12, alignItems: "center", padding: "8px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer" }}
                >
                  <span style={{ fontSize: 12, fontWeight: 900, color: NAVY }}>{MODULES.find((entry) => entry.key === row.module)?.short}</span>
                  <span style={{ minWidth: 0 }}>
                    <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.title}</b>
                    <small style={{ color: STATE_META[row.state].color, fontWeight: 800 }}>{row.statusText}</small>
                    {row.location ? <small style={{ color: "#64748b" }}> · {row.location}</small> : null}
                    {row.due && row.state !== "closed" ? <small style={{ color: isOverdue(row, today) ? "#b91c1c" : "#64748b" }}> · יעד {fmt(row.due)}</small> : null}
                  </span>
                  <span style={{ color: "#1d4ed8", fontWeight: 900, fontSize: 13, whiteSpace: "nowrap" }}>פתח ←</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#0f766e", fontWeight: 800 }}>✓ אין פריטים</div>
          )}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 16 }}>
        {/* מצב לפי מודול */}
        <div style={panel}>
          <PanelTitle hint="לחיצה על שורה מציגה את הפריטים הפתוחים">מצב רשומות לפי מודול</PanelTitle>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            {(Object.keys(STATE_META) as State[]).map((state) => (
              <span key={state} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                <i style={{ width: 10, height: 10, borderRadius: 2, background: STATE_META[state].color, display: "inline-block" }} />
                {STATE_META[state].label}
              </span>
            ))}
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {moduleStats.map((mod) => (
              <div
                key={mod.key}
                onClick={() => showDrill(`${mod.label} – פריטים פתוחים`, openRows.filter((row) => row.module === mod.key), mod.key)}
                style={{ display: "grid", gridTemplateColumns: "110px 1fr 76px", gap: 10, alignItems: "center", cursor: "pointer" }}
              >
                <span style={{ fontWeight: 800, color: NAVY, fontSize: 14 }}>{mod.label}</span>
                <StackedBar counts={mod.counts} />
                <span style={{ fontSize: 12, color: "#475569", textAlign: "left" }}>
                  <b style={{ color: NAVY }}>{mod.open}</b> / {mod.total} פתוחים
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* פעילות בתקופה */}
        <div style={panel}>
          <PanelTitle hint={`${fmt(period.from)} – ${fmt(period.to)}`}>פעילות בתקופה</PanelTitle>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ color: "#64748b", fontSize: 12, textAlign: "right" }}>
                <th style={{ padding: "6px 4px" }}>מודול</th>
                <th style={{ padding: "6px 4px" }}>נפתחו</th>
                <th style={{ padding: "6px 4px" }}>נסגרו / אושרו</th>
                <th style={{ padding: "6px 4px" }}>מאזן</th>
                <th style={{ padding: "6px 4px" }}>באיחור</th>
              </tr>
            </thead>
            <tbody>
              {moduleStats.map((mod) => {
                const balance = mod.openedInPeriod - mod.closedInPeriod;
                return (
                  <tr key={mod.key} style={{ borderTop: "1px solid #eef2f7" }}>
                    <td style={{ padding: "7px 4px", fontWeight: 800, color: NAVY }}>{mod.label}</td>
                    <td style={{ padding: "7px 4px" }}>{mod.openedInPeriod}</td>
                    <td style={{ padding: "7px 4px" }}>{mod.closedInPeriod}</td>
                    <td style={{ padding: "7px 4px", fontWeight: 900, color: balance > 0 ? "#b45309" : balance < 0 ? "#0f766e" : "#64748b" }}>
                      {balance > 0 ? `▲ ${balance}` : balance < 0 ? `▼ ${Math.abs(balance)}` : "–"}
                    </td>
                    <td style={{ padding: "7px 4px", fontWeight: 900, color: mod.overdue ? "#b91c1c" : "#94a3b8" }}>{mod.overdue || "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>מאזן ▲ = נפתחו יותר משנסגרו (העומס גדל); ▼ = העומס קטן.</div>
        </div>
      </div>

      {/* חריגים */}
      <div id="yk-dash-exceptions" style={panel}>
        <PanelTitle hint={exceptions.length ? `${exceptions.length} פריטים, ממוינים לפי דחיפות · לחיצה פותחת את הרשומה` : undefined}>חריגים לטיפול</PanelTitle>
        {exceptions.length ? (
          <div style={{ display: "grid", gap: 6 }}>
            {visibleExceptions.map((item) => {
              const mod = MODULES.find((entry) => entry.key === item.row.module);
              const severe = item.weight >= 70;
              return (
                <div
                  key={`${item.row.module}-${item.row.id}`}
                  onClick={() => openRecord(item.row)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "74px 1fr auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "9px 12px",
                    borderRadius: 10,
                    borderInlineStart: `4px solid ${severe ? "#b91c1c" : "#d4a017"}`,
                    background: severe ? "#fef6f6" : "#fffbeb",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 900, color: NAVY }}>{mod?.short}</span>
                  <span style={{ minWidth: 0 }}>
                    <b style={{ display: "block", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.row.title}</b>
                    <small style={{ color: severe ? "#991b1b" : "#92400e", fontWeight: 700 }}>{item.reason}</small>
                    {item.row.location ? <small style={{ color: "#64748b" }}> · {item.row.location}</small> : null}
                  </span>
                  <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>{fmt(item.row.opened)}</span>
                </div>
              );
            })}
            {exceptions.length > 8 ? (
              <button type="button" onClick={() => setShowAllExceptions((value) => !value)} style={{ justifySelf: "start", border: 0, background: "none", color: "#1d4ed8", fontWeight: 800, cursor: "pointer", padding: 4 }}>
                {showAllExceptions ? "הצג פחות" : `הצג את כל ${exceptions.length} החריגים`}
              </button>
            ) : null}
          </div>
        ) : (
          <div style={{ color: "#0f766e", fontWeight: 800 }}>✓ לא נמצאו חריגים פתוחים</div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 16 }}>
        {/* גיל אי־התאמות */}
        <div style={panel}>
          <PanelTitle hint={`${ncrOpenTotal} פתוחות`}>גיל אי־התאמות פתוחות</PanelTitle>
          <div style={{ display: "flex", height: 26, borderRadius: 6, overflow: "hidden", background: "#eef2f7" }}>
            {ncrAging.map((bucket) =>
              bucket.count ? (
                <div
                  key={bucket.label}
                  title={`${bucket.label}: ${bucket.count}`}
                  style={{ width: `${(bucket.count / Math.max(1, ncrOpenTotal)) * 100}%`, background: bucket.color, color: "#fff", fontWeight: 900, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  {bucket.count}
                </div>
              ) : null,
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, marginTop: 10 }}>
            {ncrAging.map((bucket) => (
              <span key={bucket.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <i style={{ width: 10, height: 10, borderRadius: 2, background: bucket.color, display: "inline-block" }} />
                {bucket.label}: <b>{bucket.count}</b>
              </span>
            ))}
          </div>
        </div>

        {/* מגמות */}
        <div style={panel}>
          <PanelTitle hint="רשומות חדשות לחודש · 12 חודשים">מגמת פעילות</PanelTitle>
          <div style={{ display: "grid", gap: 8 }}>
            {(["checklists", "nonconformances", "holdPoints", "rfi"] as ModuleKey[]).map((key) => {
              const values = monthlyNew(key);
              const last = values[values.length - 1] ?? 0;
              const previous = values[values.length - 2] ?? 0;
              return (
                <div key={key} style={{ display: "grid", gridTemplateColumns: "100px 150px 1fr", gap: 10, alignItems: "center" }}>
                  <span style={{ fontWeight: 800, color: NAVY, fontSize: 14 }}>{MODULES.find((mod) => mod.key === key)?.label}</span>
                  <Sparkline values={values} color={key === "nonconformances" ? "#b91c1c" : NAVY} />
                  <span style={{ fontSize: 12, color: "#475569" }}>
                    החודש <b style={{ color: NAVY }}>{last}</b>
                    {last !== previous ? <span style={{ color: last > previous ? "#b45309" : "#0f766e" }}> ({last > previous ? "+" : ""}{last - previous})</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* מפת חום לפי עץ המבנה */}
      <div style={panel}>
        <PanelTitle hint="ככל שהתא כהה יותר – ריכוז בעיות גבוה יותר · לחיצה על תא מציגה את הפריטים">איתור חריגים לפי עץ המבנה</PanelTitle>
        {heatmap.cells.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 3, fontSize: 13, minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "right", padding: "6px 8px", color: "#64748b" }}>רכיב</th>
                  {heatmap.columns.map((column) => (
                    <th key={column.key} style={{ padding: "6px 4px", color: "#64748b", fontWeight: 800 }}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.cells.map((group) => (
                  <tr key={group.id || "none"}>
                    <td style={{ padding: "8px", fontWeight: 800, color: NAVY, whiteSpace: "nowrap" }}>{group.name}</td>
                    {group.values.map((value, index) => (
                      <td
                        key={heatmap.columns[index].key}
                        onClick={() => value && showDrill(`${group.name} – ${heatmap.columns[index].label}`, group.cellRows[index])}
                        style={{
                          cursor: value ? "pointer" : "default",
                          textAlign: "center",
                          padding: "8px 4px",
                          borderRadius: 6,
                          fontWeight: 900,
                          background: heatColor(value, heatmap.max),
                          color: value / heatmap.max > 0.5 ? "#fff" : value ? "#7f1d1d" : "#cbd5e1",
                        }}
                      >
                        {value || "·"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ color: "#64748b" }}>עדיין אין רשומות המשויכות לעץ המבנה.</div>
        )}
      </div>
    </section>
  );
}
