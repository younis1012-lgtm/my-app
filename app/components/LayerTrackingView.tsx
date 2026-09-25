"use client";

// מעקב שכבות גרפי – לשונית במסך "מעקב רשימות תיוג".
// לכל מבנה: שורה לכל שכבה/אלמנט, ציר חתכים, פס לכל רשימת תיוג (מחתך–עד חתך),
// צבע לפי סטטוס, על הפס מספרי תעודות המעבדה, ואייקון מדידה רק כשצורפה מדידה בפועל.
//
// חתכים: כל קטע הוא טווח חצי־פתוח [מחתך, עד חתך). לכן 1–10 ו־10–23 נוגעים ואינם
// חופפים – הם מוצגים ברצף על אותה שורה. חפיפה אמיתית (1–12 ו־10–23) מוצגת בשורה
// נוספת בתוך השכבה ומסומנת. חתכים שהוזנו הפוך (23→10) מתוקנים אוטומטית.

import { useMemo, useRef, useState, type CSSProperties } from "react";

export type LayerTrackingInputRow = {
  id: string;
  number: string | number;
  title: string;
  date: string;
  status: string;
  structure: string;
  element: string;
  layer: string;
  fromSection: string;
  toSection: string;
  location: string;
  record: any;
};

type Props = {
  rows: LayerTrackingInputRow[];
  getFullRecord: (id: string) => any | undefined;
  certificatesLoading: boolean;
  projectName: string;
  onOpen: (record: any) => void;
};

type Cert = { no: string; failed: boolean; label: string };
type Measurement = { name: string };

type Segment = {
  row: LayerTrackingInputRow;
  from: number;
  to: number;
  approved: boolean;
  certs: Cert[];
  measurements: Measurement[];
  failed: boolean;
  lane: number;
  overlaps: Array<{ number: string | number; from: number; to: number }>;
};

type LayerRow = { key: string; label: string; rank: number; category: "earth" | "other"; segments: Segment[]; lanes: number };

type StructureGroup = { key: string; name: string; layers: LayerRow[]; unplaced: LayerTrackingInputRow[]; min: number; max: number };

const NAVY = "#0b1f3a";
const TEAL = "#0f766e";
const GOLD = "#d4a017";
const RED = "#b91c1c";
const EPS = 1e-6;

// ---------- עזרים ----------

// "0+520" → 520, "1+250.5" → 1250.5, "125" → 125
export function parseChainage(value: unknown): number | null {
  const text = String(value ?? "").trim().replace(/,/g, ".");
  if (!text) return null;
  const plus = text.match(/^(-?\d+)\s*\+\s*(\d+(?:\.\d+)?)$/);
  if (plus) return Number(plus[1]) * 1000 + Number(plus[2]);
  const num = text.match(/^-?\d+(?:\.\d+)?$/);
  return num ? Number(text) : null;
}

const formatChainage = (value: number, usesPlus: boolean) => {
  if (!usesPlus) return String(Math.round(value * 100) / 100);
  const km = Math.floor(value / 1000);
  const m = Math.round(value - km * 1000);
  return `${km}+${String(m).padStart(3, "0")}`;
};

const codeOf = (text: string) => {
  const match = String(text ?? "").toUpperCase().match(/\b([A-Z]{1,4})\s*-?\s*(\d{1,4})\b/);
  return match ? `${match[1]}${match[2].padStart(2, "0")}` : "";
};

const normalizeName = (text: string) => String(text ?? "").replace(/\s+/g, " ").trim();

const isEarthworks = (element: string) => /חפיר|הידוק|מילוי|שתית|מצע|עפר|החלפת קרקע/.test(element);

function layerKey(row: LayerTrackingInputRow, groupName: string) {
  const layer = normalizeName(row.layer);
  const element = normalizeName(row.element) || "ללא אלמנט";
  if (/חפיר/.test(element)) {
    return { key: "excavation", label: "חפירה", rank: -2, category: "earth" as const, element };
  }
  if (/שתית/.test(layer)) return { key: `${element}|subgrade`, label: "שתית", rank: -1, category: "earth" as const, element };
  const numeric = layer.match(/^(\d+)$/);
  if (numeric) {
    const n = Number(numeric[1]);
    if (n === 0 && !isEarthworks(element)) return { key: `${element}|0`, label: `${element}`, rank: 50, category: "other" as const, element };
    return { key: `${element}|${n}`, label: `שכבה ${n}`, rank: n, category: isEarthworks(element) ? ("earth" as const) : ("other" as const), element };
  }
  const extra = normalizeName(row.structure);
  const sameAsGroup = !extra || extra === groupName || (codeOf(extra) !== "" && codeOf(extra) === codeOf(groupName));
  const label = sameAsGroup ? element : `${element} – ${extra}`;
  return { key: `${element}|${label}`, label, rank: 100, category: "other" as const, element };
}

const CERTIFICATE_KEYS = [
  "certificateNo",
  "certificateNumber",
  "documentNo",
  "מספר תעודת בדיקה",
  "מספר תעודה",
  "מס' תעודה",
  "מס׳ תעודה",
  "מס' תעודת בדיקה צפיפות/ רטיבות שדה",
  "מס׳ תעודת בדיקה צפיפות/ רטיבות שדה",
  "מס' תעודת בדיקההידוק רגיל",
  "מס׳ תעודת בדיקההידוק רגיל",
  "מס' תעודת בדיקה",
  "מס׳ תעודת בדיקה",
];

const pickCertificate = (source: any): string => {
  if (!source || typeof source !== "object") return "";
  for (const key of CERTIFICATE_KEYS) {
    const value = String(source?.[key] ?? "").trim();
    if (value) return value;
  }
  return "";
};

function certificateNumberOf(attachment: any, item: any, labAttachmentCount: number): string {
  return (
    pickCertificate(attachment) ||
    pickCertificate(attachment?.densityResults) ||
    pickCertificate(attachment?.labResults) ||
    pickCertificate(attachment?.results) ||
    pickCertificate(attachment?.concreteResults) ||
    // מספר שנשמר ברמת הסעיף שייך לתעודה רק כשיש בסעיף תעודה אחת
    (labAttachmentCount === 1
      ? pickCertificate(item) || pickCertificate(item?.densityResults) || pickCertificate(item?.labResults) || pickCertificate(item?.concreteResults)
      : "")
  );
}

function certificatesOf(full: any): { certs: Cert[]; measurements: Measurement[]; failed: boolean } {
  const certs: Cert[] = [];
  const measurements: Measurement[] = [];
  let failed = false;
  const seen = new Set<string>();
  const items = Array.isArray(full?.items) ? full.items : [];
  items.forEach((item: any) => {
    const itemFailed = String(item?.status ?? "").includes("לא תקין");
    const attachments = Array.isArray(item?.attachments) ? item.attachments : [];
    const labAttachments = attachments.filter((attachment: any) => String(attachment?.kind ?? "") === "lab");
    attachments.forEach((attachment: any) => {
      const kind = String(attachment?.kind ?? "");
      if (kind === "measurement") {
        measurements.push({ name: String(attachment?.name ?? "מדידה") });
        return;
      }
      if (kind !== "lab") return;
      // מספר התעודה נלקח רק משדות מספר התעודה שנשמרו (בקובץ, בתוצאות או בסעיף) –
      // לא ממספרים שבשם הקובץ, שלרוב הם מספר פרויקט/חוזה שחוזר בכל הקבצים.
      const no = certificateNumberOf(attachment, item, labAttachments.length);
      const key = no || String(attachment?.name ?? attachment?.id ?? certs.length);
      if (seen.has(key)) return;
      seen.add(key);
      const resultText = JSON.stringify(attachment?.results ?? attachment?.labResults ?? {});
      const certFailed = itemFailed || /לא עומד|לא תקין|נכשל|fail/i.test(resultText);
      if (certFailed) failed = true;
      certs.push({ no: no || "ללא מס׳", failed: certFailed, label: String(attachment?.name ?? "") });
    });
  });
  return { certs, measurements, failed };
}

export function buildGroups(rows: LayerTrackingInputRow[], getFull: (id: string) => any): StructureGroup[] {
  // שיוך למבנה: לפי קוד (RW01, DC01…) אם קיים, אחרת לפי שם המבנה
  const groups = new Map<string, { names: Map<string, number>; rows: LayerTrackingInputRow[] }>();
  rows.forEach((row) => {
    const structure = normalizeName(row.structure) || normalizeName(row.location) || "ללא מבנה";
    const code = codeOf(structure) || codeOf(row.layer) || codeOf(row.location);
    const key = code || structure;
    const entry = groups.get(key) ?? { names: new Map<string, number>(), rows: [] as LayerTrackingInputRow[] };
    entry.names.set(structure, (entry.names.get(structure) ?? 0) + 1);
    entry.rows.push(row);
    groups.set(key, entry);
  });

  const result: StructureGroup[] = [];
  groups.forEach((entry, key) => {
    const names = [...entry.names.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
    const codeName = names.find(([name]) => codeOf(name) === key)?.[0];
    const name = codeName || names[0]?.[0] || key;
    const layerMap = new Map<string, LayerRow & { elementDate: number }>();
    const unplaced: LayerTrackingInputRow[] = [];
    let min = Infinity;
    let max = -Infinity;
    entry.rows.forEach((row) => {
      let from = parseChainage(row.fromSection);
      let to = parseChainage(row.toSection);
      if (from === null && to !== null) from = to;
      if (to === null && from !== null) to = from;
      if (from === null || to === null) {
        unplaced.push(row);
        return;
      }
      if (from > to) [from, to] = [to, from];
      min = Math.min(min, from);
      max = Math.max(max, to);
      const layer = layerKey(row, name);
      const full = getFull(row.id) ?? row.record;
      const { certs, measurements, failed } = certificatesOf(full);
      const approved = String(row.status).includes("מאושר");
      const layerRow = layerMap.get(layer.key) ?? { key: layer.key, label: layer.label, rank: layer.rank, category: layer.category, segments: [], lanes: 1, elementDate: Infinity };
      const time = Date.parse(row.date);
      if (Number.isFinite(time)) layerRow.elementDate = Math.min(layerRow.elementDate, time);
      layerRow.segments.push({ row, from, to, approved, certs, measurements, failed, lane: 0, overlaps: [] });
      layerMap.set(layer.key, layerRow);
    });

    // כשיש כמה אלמנטים עם שכבות ממוספרות – מציינים את האלמנט בשם השורה
    const numericElements = new Set([...layerMap.values()].filter((l) => l.rank >= 0 && l.rank < 50).map((l) => l.key.split("|")[0]));
    const elementOrder = new Map<string, number>();
    [...layerMap.values()].forEach((l) => {
      const element = l.key.split("|")[0];
      elementOrder.set(element, Math.min(elementOrder.get(element) ?? Infinity, l.elementDate));
    });

    const layers = [...layerMap.values()].map((layer) => {
      if (numericElements.size > 1 && layer.rank >= 0 && layer.rank < 50) layer.label = `${layer.key.split("|")[0]} · ${layer.label}`;
      // שיבוץ לשורות: קטעים נוגעים (10–23 אחרי 1–10) באותה שורה, חפיפה אמיתית בשורה נוספת
      const sorted = [...layer.segments].sort((a, b) => a.from - b.from || a.to - b.to);
      const laneEnds: number[] = [];
      sorted.forEach((segment) => {
        let lane = laneEnds.findIndex((end) => segment.from >= end - EPS);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(segment.to);
        } else laneEnds[lane] = segment.to;
        segment.lane = lane;
      });
      sorted.forEach((a) => {
        sorted.forEach((b) => {
          if (a === b) return;
          const start = Math.max(a.from, b.from);
          const end = Math.min(a.to, b.to);
          if (end - start > EPS) a.overlaps.push({ number: b.row.number, from: start, to: end });
        });
      });
      layer.lanes = Math.max(1, laneEnds.length);
      layer.segments = sorted;
      return layer;
    });

    layers.sort((a, b) => {
      // עליון בתרשים = שכבה עליונה: קודם "אחר" (יציקות), אחר כך עפר לפי סדר ביצוע ושכבה
      if (a.category !== b.category) return a.category === "other" ? -1 : 1;
      const ea = elementOrder.get(a.key.split("|")[0]) ?? 0;
      const eb = elementOrder.get(b.key.split("|")[0]) ?? 0;
      if (a.rank < 0 || b.rank < 0) return b.rank - a.rank;
      if (ea !== eb) return eb - ea;
      return b.rank - a.rank;
    });

    result.push({ key, name, layers, unplaced, min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 1 });
  });
  return result.sort((a, b) => b.layers.reduce((s, l) => s + l.segments.length, 0) - a.layers.reduce((s, l) => s + l.segments.length, 0));
}

// ---------- ייצוא ל־Excel ----------
// גיליון לכל מבנה בצורת "גאנט": שורה לכל שכבה (ושורות נוספות לחפיפות), עמודה לכל
// מקטע חתך, והפס של כל רשימת תיוג כתאים ממוזגים וצבועים עם מספרי התעודות.
// בנוסף גיליון "רשימה" עם כל הפרטים לסינון ומיון.

const excelSheetName = (name: string, used: Set<string>) => {
  const base = name.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 28) || "מבנה";
  let candidate = base;
  let index = 2;
  while (used.has(candidate)) candidate = `${base.slice(0, 25)} (${index++})`;
  used.add(candidate);
  return candidate;
};

const excelStep = (span: number) => {
  const candidates = [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  return candidates.find((step) => span / step <= 120) ?? 1000;
};

export async function exportLayerTrackingExcel(
  groups: StructureGroup[],
  projectName: string,
  usesPlus: boolean,
  labelFor: (segment: Segment) => string,
) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Y.K Quality";
  const used = new Set<string>();
  const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;
  const thin = { style: "thin" as const, color: { argb: "FFFFFFFF" } };

  // גיליון רשימה
  const list = workbook.addWorksheet(excelSheetName("רשימה", used), { views: [{ rightToLeft: true, state: "frozen", ySplit: 3 }] });
  list.getCell("A1").value = `מעקב שכבות – ${projectName}`;
  list.getCell("A1").font = { bold: true, size: 14 };
  list.getCell("A2").value = `הופק ${new Date().toLocaleDateString("he-IL")} · Y.K Quality`;
  const headers = ["מבנה", "שכבה / אלמנט", "רשימת תיוג", "תאריך", "סטטוס", "מחתך", "עד חתך", "תעודות מעבדה", "תעודה שלא עמדה", "מדידה מצורפת", "חפיפה עם"];
  const headerRow = list.getRow(3);
  headerRow.values = headers;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(NAVY) } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  list.columns = [28, 26, 12, 12, 12, 11, 11, 26, 16, 26, 26].map((width) => ({ width }));
  groups.forEach((group) => {
    group.layers.forEach((layer) => {
      layer.segments.forEach((segment) => {
        const row = list.addRow([
          group.name,
          layer.label,
          String(segment.row.number),
          segment.row.date,
          segment.row.status,
          formatChainage(segment.from, usesPlus),
          formatChainage(segment.to, usesPlus),
          segment.certs.map((cert) => cert.no).join(", "),
          segment.certs.filter((cert) => cert.failed).map((cert) => cert.no).join(", "),
          segment.measurements.map((m) => m.name).join(", "),
          segment.overlaps.map((o) => `רש״ת ${o.number} (${formatChainage(o.from, usesPlus)}–${formatChainage(o.to, usesPlus)})`).join(", "),
        ]);
        row.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: segment.approved ? "FFD1FAE5" : "FFFEF3C7" } };
        if (segment.failed) row.getCell(9).font = { bold: true, color: { argb: argb(RED) } };
      });
    });
    group.unplaced.forEach((row) => {
      list.addRow([group.name, row.layer || row.element, String(row.number), row.date, row.status, "", "", "", "", "", "ללא חתכים – לא ממוקם"]);
    });
  });
  list.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: headers.length } };

  // גיליון גרפי לכל מבנה
  groups.forEach((group) => {
    if (!group.layers.length) return;
    const sheet = workbook.addWorksheet(excelSheetName(group.name, used), { views: [{ rightToLeft: false, state: "frozen", xSplit: 1, ySplit: 4 }] });
    const step = excelStep(group.max - group.min);
    const lo = Math.floor(group.min / step) * step;
    const hi = Math.ceil(group.max / step) * step;
    const columns = Math.max(1, Math.round((hi - lo) / step));
    const colOf = (value: number) => 2 + Math.min(columns - 1, Math.max(0, Math.floor((value - lo) / step + 1e-9)));
    const endColOf = (value: number) => 2 + Math.min(columns - 1, Math.max(0, Math.ceil((value - lo) / step - 1e-9) - 1));
    sheet.getColumn(1).width = 30;
    for (let c = 0; c < columns; c += 1) sheet.getColumn(2 + c).width = 3.2;
    sheet.getCell("A1").value = `מעקב שכבות – ${group.name}`;
    sheet.getCell("A1").font = { bold: true, size: 14 };
    sheet.getCell("A2").value = `${projectName} · הופק ${new Date().toLocaleDateString("he-IL")} · כל עמודה = ${step} יח׳ חתך · ירוק = מאושר, צהוב = בטיפול, גבול אדום = תעודה שלא עמדה, (מ) = צורפה מדידה`;
    sheet.getCell("A2").font = { size: 10, color: { argb: "FF475569" } };
    // כותרת ציר החתכים – תווית כל כמה עמודות
    const labelEvery = Math.max(1, Math.ceil(columns / 20));
    const axis = sheet.getRow(4);
    axis.getCell(1).value = "שכבה / חתך";
    axis.getCell(1).font = { bold: true };
    for (let c = 0; c < columns; c += labelEvery) {
      const endCol = Math.min(columns - 1, c + labelEvery - 1);
      if (endCol > c) sheet.mergeCells(4, 2 + c, 4, 2 + endCol);
      const cell = axis.getCell(2 + c);
      cell.value = formatChainage(lo + c * step, usesPlus);
      cell.font = { size: 9, color: { argb: "FF64748B" } };
      cell.alignment = { horizontal: "left" };
    }
    let rowIndex = 5;
    let previous: string | null = null;
    group.layers.forEach((layer) => {
      if (previous && previous !== layer.category) {
        const sep = sheet.getRow(rowIndex);
        for (let c = 1; c <= columns + 1; c += 1) sep.getCell(c).border = { top: { style: "dashed", color: { argb: "FF94A3B8" } } };
        rowIndex += 1;
      }
      previous = layer.category;
      const firstRow = rowIndex;
      for (let lane = 0; lane < layer.lanes; lane += 1) {
        const row = sheet.getRow(rowIndex + lane);
        row.height = 20;
        for (let c = 0; c < columns; c += 1) {
          row.getCell(2 + c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F6F9" } };
        }
      }
      if (layer.lanes > 1) sheet.mergeCells(firstRow, 1, firstRow + layer.lanes - 1, 1);
      const labelCell = sheet.getCell(firstRow, 1);
      labelCell.value = layer.label;
      labelCell.font = { bold: true, color: { argb: argb(NAVY) } };
      labelCell.alignment = { vertical: "middle", horizontal: "right" };
      const occupied = new Set<string>();
      layer.segments.forEach((segment) => {
        const r = firstRow + segment.lane;
        let start = colOf(segment.from);
        const end = Math.max(start, endColOf(segment.to));
        while (start <= end && occupied.has(`${r}:${start}`)) start += 1;
        if (start > end) return;
        for (let c = start; c <= end; c += 1) occupied.add(`${r}:${c}`);
        if (end > start) sheet.mergeCells(r, start, r, end);
        const cell = sheet.getCell(r, start);
        const label = labelFor(segment);
        cell.value = `${label}${segment.measurements.length ? " (מ)" : ""}`;
        cell.note = [
          `רשימת תיוג ${segment.row.number} · ${segment.row.status}`,
          `חתכים ${formatChainage(segment.from, usesPlus)}–${formatChainage(segment.to, usesPlus)} · ${segment.row.date}`,
          `תעודות: ${segment.certs.map((cert) => cert.no + (cert.failed ? " ✗" : "")).join(", ") || "לא שויכו"}`,
          segment.measurements.length ? `מדידה: ${segment.measurements.map((m) => m.name).join(", ")}` : "",
          segment.overlaps.length ? `חפיפה עם ${segment.overlaps.map((o) => `רש״ת ${o.number}`).join(", ")}` : "",
        ].filter(Boolean).join("\n");
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(segment.approved ? TEAL : GOLD) } };
        cell.font = { bold: true, size: 9, color: { argb: segment.certs.length ? "FFFFFFFF" : "FFFDE68A" } };
        cell.alignment = { horizontal: "center", vertical: "middle", shrinkToFit: true };
        const edge = segment.failed ? { style: "medium" as const, color: { argb: argb(RED) } } : thin;
        cell.border = { top: edge, bottom: edge, left: edge, right: edge };
      });
      rowIndex += layer.lanes;
    });
    if (group.unplaced.length) {
      rowIndex += 1;
      sheet.getCell(rowIndex, 1).value = `ללא חתכים – לא ממוקמים: ${group.unplaced.map((row) => `רש״ת ${row.number}`).join(", ")}`;
      sheet.getCell(rowIndex, 1).font = { bold: true, color: { argb: "FF92400E" } };
    }
    sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `מעקב שכבות - ${projectName} - ${new Date().toLocaleDateString("he-IL").replace(/\//g, "-")}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function niceTicks(min: number, max: number) {
  const span = Math.max(1, max - min);
  const raw = span / 8;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + EPS; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { ticks, lo: start, hi: end };
}

// ---------- רכיב ----------

type LabelMode = "certs" | "number" | "date";

const panel: CSSProperties = { background: "#fff", border: "1px solid #dbe3ee", borderRadius: 14, padding: "16px 18px", minWidth: 0 };

function RulerIcon({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={16} height={16} rx={3} fill="#fff" stroke={NAVY} strokeWidth={1.2} />
      <path d="M3 12 L12 3 M5 12 L4.5 10.5 M7.5 9.5 L6.5 8.5 M10 7 L9 6" stroke={NAVY} strokeWidth={1.2} fill="none" />
    </g>
  );
}

export function LayerTrackingView({ rows, getFullRecord, certificatesLoading, projectName, onOpen }: Props) {
  const [structureFilter, setStructureFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [labelMode, setLabelMode] = useState<LabelMode>("certs");
  const [hover, setHover] = useState<{ segment: Segment; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (statusFilter === "approved" && !String(row.status).includes("מאושר")) return false;
        if (statusFilter === "open" && String(row.status).includes("מאושר")) return false;
        return true;
      }),
    [rows, statusFilter],
  );
  const groups = useMemo(() => buildGroups(filteredRows, getFullRecord), [filteredRows, getFullRecord]);
  const visibleGroups = structureFilter ? groups.filter((group) => group.key === structureFilter) : groups;
  const usesPlus = rows.some((row) => /\+/.test(String(row.fromSection)) || /\+/.test(String(row.toSection)));

  const [exportingExcel, setExportingExcel] = useState(false);
  const exportExcel = async () => {
    setExportingExcel(true);
    try {
      await exportLayerTrackingExcel(visibleGroups, projectName || "פרויקט", usesPlus, labelFor);
    } catch (error) {
      console.error("Layer tracking Excel export failed", error);
      window.alert("הפקת קובץ ה־Excel נכשלה. נסה שוב.");
    } finally {
      setExportingExcel(false);
    }
  };

  const exportPdf = () => {
    const html = containerRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank");
    if (!win) {
      window.alert("הדפדפן חסם את פתיחת הדוח. אפשר חלונות קופצים לאתר זה ונסה שוב.");
      return;
    }
    win.document.open();
    win.document.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>מעקב שכבות – ${projectName}</title>
<style>@page{size:A4 landscape;margin:10mm}body{margin:0;font-family:Heebo,Arial,sans-serif;color:${NAVY}}button,select{display:none!important}.yk-lt-panel{break-inside:avoid;margin-bottom:10px}svg{max-width:100%;height:auto}</style></head>
<body><h1 style="font-size:20px;margin:0 0 4px">מעקב שכבות – ${projectName}</h1><div style="font-size:12px;color:#475569;margin-bottom:10px">הופק ${new Date().toLocaleDateString("he-IL")} · Y.K Quality</div>${html}
<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},400)});</script></body></html>`);
    win.document.close();
  };

  const labelFor = (segment: Segment) => {
    if (labelMode === "number") return String(segment.row.number);
    if (labelMode === "date") return segment.row.date;
    if (!segment.certs.length) return certificatesLoading ? "…" : "ללא תעודה";
    return segment.certs.map((cert) => cert.no).join(", ");
  };

  const W = 1100;
  const left = 200;
  const right = 1080;
  const barH = 24;
  const laneGap = 4;

  return (
    <section dir="rtl" style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 700 }}>
            מבנה
            <select value={structureFilter} onChange={(event) => setStructureFilter(event.target.value)} style={{ font: "inherit", padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1" }}>
              <option value="">כל המבנים ({groups.length})</option>
              {groups.map((group) => (
                <option key={group.key} value={group.key}>{group.name}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 700 }}>
            סטטוס
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ font: "inherit", padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1" }}>
              <option value="">הכול</option>
              <option value="approved">מאושר</option>
              <option value="open">בטיפול</option>
            </select>
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 700 }}>
            על הפס
            <select value={labelMode} onChange={(event) => setLabelMode(event.target.value as LabelMode)} style={{ font: "inherit", padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1" }}>
              <option value="certs">מספרי תעודות מעבדה</option>
              <option value="number">מספר רשימת תיוג</option>
              <option value="date">תאריך ביצוע</option>
            </select>
          </label>
        </div>
        <span style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => void exportExcel()} disabled={exportingExcel} style={{ border: `1px solid ${NAVY}`, background: "#fff", color: NAVY, borderRadius: 8, padding: "9px 16px", fontWeight: 900, cursor: exportingExcel ? "wait" : "pointer" }}>
            {exportingExcel ? "מפיק Excel..." : "⬇ הפק Excel"}
          </button>
          <button type="button" onClick={exportPdf} style={{ border: 0, background: GOLD, color: NAVY, borderRadius: 8, padding: "9px 16px", fontWeight: 900, cursor: "pointer" }}>
            ⎙ הפק PDF
          </button>
        </span>
      </div>

      <div style={{ ...panel, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", padding: "8px 14px", fontSize: 13, color: "#334155" }}>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}><i style={{ width: 14, height: 14, background: TEAL, borderRadius: 3, display: "inline-block" }} />מאושר</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}><i style={{ width: 14, height: 14, background: GOLD, borderRadius: 3, display: "inline-block" }} />בטיפול</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}><i style={{ width: 14, height: 14, background: GOLD, border: `3px solid ${RED}`, borderRadius: 3, display: "inline-block", boxSizing: "border-box" }} />תעודה שלא עמדה בדרישה</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}><svg width={16} height={16} aria-hidden="true"><RulerIcon x={0} y={0} /></svg>צורפה מדידה</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}><i style={{ width: 10, height: 10, background: RED, transform: "rotate(45deg)", display: "inline-block" }} />חפיפת חתכים</span>
        {certificatesLoading ? <span style={{ color: "#9a7410", fontWeight: 700 }}>טוען את נתוני התעודות…</span> : null}
      </div>

      <div ref={containerRef} style={{ display: "grid", gap: 14, position: "relative" }}>
        {visibleGroups.length === 0 ? <div style={panel}>אין רשימות תיוג להצגה.</div> : null}
        {visibleGroups.map((group) => {
          const { ticks, lo, hi } = niceTicks(group.min, group.max);
          const x = (value: number) => left + ((value - lo) / Math.max(EPS, hi - lo)) * (right - left);
          // גובה שורות
          let y = 30;
          const positions = new Map<string, number>();
          const separators: number[] = [];
          let previous: string | null = null;
          group.layers.forEach((layer) => {
            if (previous && previous !== layer.category) {
              separators.push(y + 1);
              y += 10;
            }
            previous = layer.category;
            positions.set(layer.key, y);
            y += layer.lanes * (barH + laneGap) + 6;
          });
          const H = y + 40;
          const all = group.layers.flatMap((layer) => layer.segments);
          const approvedCount = all.filter((segment) => segment.approved).length;
          const certCount = all.reduce((sum, segment) => sum + segment.certs.length, 0);
          const measurementCount = all.filter((segment) => segment.measurements.length).length;
          return (
            <div key={group.key} className="yk-lt-panel" style={panel}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: NAVY }}>{group.name}</h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
                  <span style={{ background: "#f1f5f9", borderRadius: 8, padding: "4px 10px" }}><b>{all.length + group.unplaced.length}</b> רשימות תיוג</span>
                  <span style={{ background: "#ecfdf5", color: "#065f46", borderRadius: 8, padding: "4px 10px" }}><b>{all.length ? Math.round((approvedCount / all.length) * 100) : 0}%</b> מאושרות</span>
                  <span style={{ background: "#eff6ff", color: "#1e3a8a", borderRadius: 8, padding: "4px 10px" }}><b>{certCount}</b> תעודות מעבדה</span>
                  <span style={{ background: "#f8fafc", color: NAVY, borderRadius: 8, padding: "4px 10px" }}><b>{measurementCount}</b> עם מדידה מצורפת</span>
                </div>
              </div>
              {group.layers.length ? (
                <div style={{ overflowX: "auto" }}>
                  <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ direction: "ltr", minWidth: 760, display: "block", fontFamily: "Heebo, Arial, sans-serif" }} role="img" aria-label={`מעקב שכבות – ${group.name}`}>
                    {ticks.map((tick) => (
                      <g key={tick}>
                        <line x1={x(tick)} y1={22} x2={x(tick)} y2={H - 38} stroke="#e8edf3" />
                        <text x={x(tick)} y={H - 22} fontSize={12} fill="#64748b" textAnchor="middle">{formatChainage(tick, usesPlus)}</text>
                      </g>
                    ))}
                    <text x={(left + right) / 2} y={H - 5} fontSize={12} fill="#64748b" textAnchor="middle">חתך</text>
                    {separators.map((sy) => (
                      <line key={sy} x1={20} y1={sy} x2={right} y2={sy} stroke="#94a3b8" strokeDasharray="5 4" />
                    ))}
                    {group.layers.map((layer) => {
                      const top = positions.get(layer.key) ?? 0;
                      const height = layer.lanes * (barH + laneGap) - laneGap;
                      return (
                        <g key={layer.key}>
                          <text x={left - 12} y={top + height / 2 + 5} fontSize={13} fontWeight={700} fill={NAVY} textAnchor="end">
                            {layer.label.length > 26 ? `${layer.label.slice(0, 25)}…` : layer.label}
                          </text>
                          <rect x={left} y={top} width={right - left} height={height} rx={4} fill="#f4f6f9" />
                          {layer.segments.map((segment) => {
                            const x1 = x(segment.from);
                            const width = Math.max(6, x(segment.to) - x1);
                            const by = top + segment.lane * (barH + laneGap);
                            const hasMeasurement = segment.measurements.length > 0;
                            const text = labelFor(segment);
                            const available = width - (hasMeasurement ? 24 : 8);
                            let shown = text;
                            if (shown.length * 6.6 > available) shown = labelMode === "certs" && segment.certs.length > 1 ? `${segment.certs.length} תעודות` : shown;
                            if (shown.length * 6.6 > available) shown = "";
                            const textColor = labelMode === "certs" && !segment.certs.length ? "#fde68a" : "#fff";
                            return (
                              <g
                                key={segment.row.id}
                                style={{ cursor: "pointer" }}
                                onClick={() => onOpen(segment.row.record)}
                                onMouseEnter={(event) => {
                                  const box = containerRef.current?.getBoundingClientRect();
                                  setHover({ segment, x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) });
                                }}
                                onMouseLeave={() => setHover(null)}
                              >
                                <title>{`רשימת תיוג ${segment.row.number} · ${formatChainage(segment.from, usesPlus)}–${formatChainage(segment.to, usesPlus)}`}</title>
                                <rect
                                  x={x1}
                                  y={by}
                                  width={width}
                                  height={barH}
                                  rx={4}
                                  fill={segment.approved ? TEAL : GOLD}
                                  stroke={segment.failed ? RED : "#ffffff"}
                                  strokeWidth={segment.failed ? 3 : 1}
                                />
                                {shown ? (
                                  <text x={x1 + (width - (hasMeasurement ? 18 : 0)) / 2} y={by + 16} fontSize={11.5} fontWeight={700} fill={textColor} textAnchor="middle">
                                    {shown}
                                  </text>
                                ) : null}
                                {hasMeasurement && width >= 22 ? <RulerIcon x={x1 + width - 20} y={by + 4} /> : null}
                                {segment.overlaps.length ? (
                                  <rect x={x1 + 3} y={by - 3} width={7} height={7} fill={RED} transform={`rotate(45 ${x1 + 6.5} ${by + 0.5})`} />
                                ) : null}
                              </g>
                            );
                          })}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              ) : null}
              {group.unplaced.length ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
                  <span style={{ fontSize: 12, color: "#92400e", fontWeight: 700 }}>ללא חתכים – לא ממוקמים בתרשים:</span>
                  {group.unplaced.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => onOpen(row.record)}
                      style={{ border: "1px dashed #b45309", color: "#92400e", background: "#fffbeb", borderRadius: 12, padding: "2px 10px", fontSize: 12, cursor: "pointer" }}
                    >
                      רש״ת {row.number}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        {hover ? (
          <div
            style={{
              position: "absolute",
              top: hover.y + 14,
              left: Math.max(0, hover.x - 150),
              width: 300,
              background: NAVY,
              color: "#fff",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 13,
              lineHeight: 1.6,
              pointerEvents: "none",
              boxShadow: "0 10px 30px rgba(0,0,0,.25)",
              zIndex: 5,
            }}
          >
            <div style={{ color: GOLD, fontWeight: 900 }}>רשימת תיוג {hover.segment.row.number} · {hover.segment.row.element || hover.segment.row.title}</div>
            <div>{hover.segment.row.layer ? `שכבה ${hover.segment.row.layer} · ` : ""}חתכים {formatChainage(hover.segment.from, usesPlus)}–{formatChainage(hover.segment.to, usesPlus)} · {hover.segment.row.date}</div>
            <div>סטטוס: <b style={{ color: hover.segment.approved ? "#5eead4" : "#fde68a" }}>{hover.segment.row.status}</b></div>
            <div>
              תעודות:{" "}
              {hover.segment.certs.length
                ? hover.segment.certs.map((cert, index) => (
                    <span key={`${cert.no}-${index}`} style={{ color: cert.failed ? "#fca5a5" : "#fff", fontWeight: 700 }}>
                      {index ? ", " : ""}{cert.no}{cert.no === "ללא מס׳" && cert.label ? ` (${cert.label})` : ""}{cert.failed ? " ✗" : ""}
                    </span>
                  ))
                : certificatesLoading ? "בטעינה…" : "לא שויכו"}
            </div>
            {hover.segment.measurements.length ? <div>מדידה: <b>{hover.segment.measurements.map((m) => m.name).join(", ")}</b></div> : null}
            {hover.segment.overlaps.length ? (
              <div style={{ color: "#fca5a5", fontWeight: 700 }}>
                חפיפה עם {hover.segment.overlaps.map((o) => `רש״ת ${o.number} (${formatChainage(o.from, usesPlus)}–${formatChainage(o.to, usesPlus)})`).join(", ")}
              </div>
            ) : null}
            <div style={{ color: "#fde68a", fontWeight: 700 }}>לחיצה פותחת את רשימת התיוג ←</div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
