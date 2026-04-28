"use client";

import { useMemo, useState } from "react";
import JSZip from "jszip";

type Props = {
  savedChecklists?: any[];
  savedNonconformances?: any[];
  savedTrialSections?: any[];
  savedPreliminary?: any[];
  currentProjectName?: string;
};

type SourceType = "checklists" | "nonconformances" | "trialSections" | "preliminary";

type ConcentrationTemplate = {
  id: string;
  title: string;
  fileName: string;
  description: string;
  keywords: string[];
  source: SourceType;
  mode?: "subbaseA" | "generic";
};

type ConcentrationRow = {
  sourceType: SourceType;
  recordId: string;
  checklistNo: string;
  title: string;
  category: string;
  location: string;
  contractor: string;
  date: string;
  itemDescription: string;
  responsible: string;
  inspector: string;
  status: string;
  executionDate: string;
  notes: string;
  attachmentKind: string;
  certificateNo: string;
  fileName: string;
  uploadedAt: string;
};

const templates: ConcentrationTemplate[] = [
  { id: "nonconformances", title: "דוח ריכוז אי התאמות", fileName: "non-conformance.xlsx", description: "ריכוז אי התאמות לפי הטופס המקורי", keywords: ["אי התאמה", "אי תאמות"], source: "nonconformances" },
  { id: "suppliers", title: "ריכוז ספקים", fileName: "suppliers.xlsx", description: "ריכוז ספקים לפי הטופס המקורי", keywords: ["ספק", "ספקים"], source: "preliminary" },
  { id: "contractors", title: "ריכוז קבלנים", fileName: "contractors.xlsx", description: "ריכוז קבלנים לפי הטופס המקורי", keywords: ["קבלן", "קבלנים", "קבלן משנה"], source: "preliminary" },
  { id: "asphalt", title: "ריכוז בדיקות אספלט", fileName: "asphalt.xlsx", description: "בדיקות אספלט / FWD / מישוריות", keywords: ["אספלט", "FWD", "שכבה סופית", "מישוריות"], source: "checklists" },
  { id: "density", title: "ריכוז בדיקות צפיפות", fileName: "density.xlsx", description: "צפיפות / הידוק / רטיבות / מצעים", keywords: ["צפיפות", "הידוק", "רטיבות", "דרגת", "תכולת", "מצע", "מצעים"], source: "checklists" },
  { id: "concrete", title: "ריכוז בטון", fileName: "concrete.xlsx", description: "בדיקות בטון", keywords: ["בטון", "יציקה", "קוביות", "חוזק"], source: "checklists" },
  { id: "supervision", title: "ריכוז דוחות פיקוח עליון", fileName: "supervision.xlsx", description: "דוחות פיקוח עליון", keywords: ["פיקוח עליון", "דוח פיקוח"], source: "trialSections" },
  { id: "materials", title: "ריכוז חומרים", fileName: "materials.xlsx", description: "אישורי חומרים", keywords: ["חומר", "חומרים", "תקן", "מפרט", "תעודת התאמה"], source: "preliminary" },
  { id: "trial-sections", title: "ריכוז קטעי ניסוי", fileName: "trial-sections.xlsx", description: "קטעי ניסוי", keywords: ["קטע ניסוי", "קטעי ניסוי"], source: "trialSections" },
  { id: "subbase-a", title: "ריכוז אפיון מצע א׳", fileName: "subbase-a.xlsx", description: "מצע א׳ — שורות 10-14 נשמרות בדיוק, שורה 15 מתמלאת מהתעודה המצורפת", keywords: ["אפיון מצע", "מצע א", "מצע א׳", "CBR", "גרדציה", "מצע"], source: "checklists", mode: "subbaseA" },
  { id: "selected-material", title: "ריכוז אפיון נברר", fileName: "selected-material.xlsx", description: "אפיון חומר נברר", keywords: ["נברר", "חומר נברר", "אפיון נברר", "CBR", "גרדציה"], source: "checklists" },
];

const normalize = (value: unknown) =>
  String(value ?? "")
    .replace(/[׳`’']/g, "")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const includesAny = (text: string, keywords: string[]) => {
  const n = normalize(text);
  return keywords.some((keyword) => n.includes(normalize(keyword)));
};

const attachmentLabel = (kind: unknown) =>
  kind === "lab" ? "תעודת מעבדה" : kind === "measurement" ? "רשימת מדידה" : "מסמך";

const extractCertificateNo = (name: unknown) => {
  const text = String(name ?? "");
  const pdfPrefix = text.match(/pdf[.\-_\s]*(\d{3,})/i);
  if (pdfPrefix) return pdfPrefix[1];
  const longNumber = text.match(/(?:^|[^0-9])(\d{3,})(?:[^0-9]|$)/);
  return longNumber?.[1] ?? "";
};

const getTemplateUrl = (fileName: string) => `/concentrations/${encodeURIComponent(fileName)}`;

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const recordText = (record: any) => {
  const parts: unknown[] = [record?.title, record?.category, record?.location, record?.contractor, record?.status, record?.description, record?.notes, record?.subtype];
  if (Array.isArray(record?.items)) {
    record.items.forEach((item: any) => {
      parts.push(item?.description, item?.notes, item?.status, item?.inspector, item?.responsible);
      if (Array.isArray(item?.attachments)) item.attachments.forEach((a: any) => parts.push(a?.name, a?.kind));
    });
  }
  if (record?.supplier) parts.push(record.supplier.supplierName, record.supplier.suppliedMaterial, record.supplier.notes, record.supplier.approvalNo);
  if (record?.subcontractor) parts.push(record.subcontractor.subcontractorName, record.subcontractor.field, record.subcontractor.notes, record.subcontractor.approvalNo);
  if (record?.material) parts.push(record.material.materialName, record.material.source, record.material.usage, record.material.notes, record.material.certificateNo);
  return parts.filter(Boolean).join(" ");
};

const rowsFromChecklists = (checklists: any[], template: ConcentrationTemplate): ConcentrationRow[] => {
  const rows: ConcentrationRow[] = [];
  checklists.forEach((checklist) => {
    (Array.isArray(checklist?.items) ? checklist.items : []).forEach((item: any) => {
      const attachments = Array.isArray(item?.attachments) ? item.attachments : [];
      attachments.forEach((attachment: any) => {
        const fullText = [recordText(checklist), item?.description, item?.notes, attachment?.name, attachment?.kind].join(" ");
        if (!includesAny(fullText, template.keywords)) return;
        rows.push({
          sourceType: "checklists",
          recordId: String(checklist?.id ?? ""),
          checklistNo: String(checklist?.checklistNo ?? ""),
          title: String(checklist?.title ?? ""),
          category: String(checklist?.category ?? ""),
          location: String(checklist?.location ?? ""),
          contractor: String(checklist?.contractor ?? ""),
          date: String(checklist?.date ?? ""),
          itemDescription: String(item?.description ?? ""),
          responsible: String(item?.responsible ?? ""),
          inspector: String(item?.inspector ?? ""),
          status: String(item?.status ?? ""),
          executionDate: String(item?.executionDate ?? ""),
          notes: String(item?.notes ?? ""),
          attachmentKind: attachmentLabel(attachment?.kind),
          certificateNo: extractCertificateNo(attachment?.name),
          fileName: String(attachment?.name ?? ""),
          uploadedAt: String(attachment?.uploadedAt ?? ""),
        });
      });
    });
  });
  return rows;
};

const rowsFromSimpleRecords = (records: any[], template: ConcentrationTemplate, sourceType: SourceType): ConcentrationRow[] =>
  records
    .filter((record) => includesAny(recordText(record), template.keywords))
    .map((record) => ({
      sourceType,
      recordId: String(record?.id ?? ""),
      checklistNo: "",
      title: String(record?.title ?? record?.supplier?.supplierName ?? record?.subcontractor?.subcontractorName ?? record?.material?.materialName ?? ""),
      category: String(record?.subtype ?? ""),
      location: String(record?.location ?? ""),
      contractor: String(record?.contractor ?? record?.supplier?.supplierName ?? record?.subcontractor?.subcontractorName ?? ""),
      date: String(record?.date ?? ""),
      itemDescription: String(record?.description ?? record?.spec ?? record?.material?.usage ?? record?.supplier?.suppliedMaterial ?? record?.subcontractor?.field ?? ""),
      responsible: String(record?.approvedBy ?? record?.raisedBy ?? ""),
      inspector: String(record?.approvedBy ?? record?.raisedBy ?? ""),
      status: String(record?.status ?? ""),
      executionDate: String(record?.date ?? ""),
      notes: String(record?.notes ?? record?.actionRequired ?? ""),
      attachmentKind: "רשומה",
      certificateNo: String(record?.supplier?.approvalNo ?? record?.subcontractor?.approvalNo ?? record?.material?.certificateNo ?? ""),
      fileName: "",
      uploadedAt: String(record?.savedAt ?? ""),
    }));

type SubbaseAValues = {
  sieve3?: number;
  sieve15?: number;
  sieve34?: number;
  sieve4?: number;
  sieve10?: number;
  sieve40?: number;
  sieve200?: number;
  ll?: string | number;
  pl?: string | number;
  pi?: string | number;
  swelling?: number;
  density?: number;
  absorption?: number;
  losAngeles?: number | string;
  aashto?: string;
  maxDensity?: number;
  optimumMoisture?: number;
};

const extractNumberByAliases = (text: string, aliases: string[]) => {
  const source = String(text ?? "");
  for (const alias of aliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`${escaped}\\s*[:=\\-]?\\s*([0-9]+(?:[.,][0-9]+)?)`, "i");
    const match = source.match(re);
    if (match) return Number(match[1].replace(",", "."));
  }
  return undefined;
};

const parseSubbaseAValues = (row: ConcentrationRow): SubbaseAValues => {
  const text = [row.notes, row.itemDescription, row.fileName, row.title, row.category].join(" ");
  return {
    sieve3: extractNumberByAliases(text, ['3"', "3 in", "sieve3", "נפה 3"]),
    sieve15: extractNumberByAliases(text, ['1.5"', "1.5", "sieve15", "נפה 1.5"]),
    sieve34: extractNumberByAliases(text, ["3/4", '3/4"', "sieve34", "נפה 3/4"]),
    sieve4: extractNumberByAliases(text, ["#4", "נפה 4"]),
    sieve10: extractNumberByAliases(text, ["#10", "נפה 10"]),
    sieve40: extractNumberByAliases(text, ["#40", "נפה 40"]),
    sieve200: extractNumberByAliases(text, ["#200", "נפה 200"]),
    ll: extractNumberByAliases(text, ["LL", "גבול נזילות"]),
    pl: extractNumberByAliases(text, ["PL", "גבול פלסטיות"]),
    pi: extractNumberByAliases(text, ["PI", "אינדקס פלסטיות"]),
    swelling: extractNumberByAliases(text, ["שעמ", "שעח", "swelling"]),
    density: extractNumberByAliases(text, ["צפיפות ממשית", "density"]),
    absorption: extractNumberByAliases(text, ["ספיגות", "absorption"]),
    losAngeles: extractNumberByAliases(text, ["לוס אנגלס", "los angeles", "LA"]),
    aashto: (text.match(/A-\d-a?\s*\(?\d?\)?/i)?.[0] ?? "").trim(),
    maxDensity: extractNumberByAliases(text, ["צפיפות מעבדתית", "max density"]),
    optimumMoisture: extractNumberByAliases(text, ["רטיבות אופטימלית", "omc"]),
  };
};

const valueOrDefault = (value: unknown, fallback: string | number = ""): string | number => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number") return value;
  return String(value);
};

const evaluateSubbaseA = (v: SubbaseAValues) => {
  const checks: Array<boolean | null> = [
    v.sieve3 === undefined ? null : v.sieve3 >= 100,
    v.sieve15 === undefined ? null : v.sieve15 >= 80,
    v.sieve34 === undefined ? null : v.sieve34 >= 60 && v.sieve34 <= 85,
    v.sieve4 === undefined ? null : v.sieve4 >= 30 && v.sieve4 <= 55,
    v.sieve10 === undefined ? null : v.sieve10 >= 20 && v.sieve10 <= 40,
    v.sieve200 === undefined ? null : v.sieve200 >= 5 && v.sieve200 <= 15,
    typeof v.ll !== "number" ? null : v.ll <= 25,
    typeof v.pi !== "number" ? null : v.pi <= 6,
    typeof v.losAngeles !== "number" ? null : v.losAngeles <= 35,
  ];
  const populated = checks.filter((item) => item !== null) as boolean[];
  if (!populated.length) return "OK";
  return populated.every(Boolean) ? "OK" : "NC";
};

const SUBBASE_A_FIXED_CELLS: Record<string, string | number> = {
  H2: " דו\"ח ריכוז בדיקות  איפיון למצע סוג א' ",
  H4: "שם פרויקט:",
  H5: "ניהול פרויקט",
  H6: "שם הקבלן",
  H7: "קונטרולינג פריים בע\"מ",
  L7: "הבטחת איכות -א.ו.ג.ן. בע\"מ",
  A10: "מס' סדורי",
  B10: "ביצוע ע\"י ",
  C10: "מס' ר.ת.",
  D10: "תאריך ",
  E10: "מקור החומר",
  F10: "מקום נטילת מדגם לבדיקה",
  G10: "מקום הפיזור",
  J10: "דירוג (  % עובר )",
  Q10: "גבולות פלסטיות וסומך (%)",
  T10: "שע\"ח (%)",
  U10: "אגרגט גס",
  W10: " לוס אנג'לס (%)",
  X10: " מיון AASHTO",
  Y10: "צפיפות מעבדתית מקסימלית",
  Z10: "רטיבות אופטימלית",
  AA10: "מספר תעודה",
  AB10: "מעמד החומר",
  AC10: "הערות",
  J11: '3"',
  K11: '"1.5',
  L11: '"3/4 ',
  M11: "#4",
  N11: "#10",
  O11: "#40",
  P11: "#200",
  Q11: "LL",
  R11: "PL",
  S11: "PI",
  U11: "צפיפות ממשית (ט/מ\"ק) ",
  V11: "ספיגות (%)",
  J12: "דרישות המפרט",
  B13: "QC/QA",
  G13: "מבנה",
  H13: "חתכים",
  K13: 100,
  L13: 85,
  M13: 55,
  N13: 40,
  P13: 15,
  Q13: 25,
  S13: 6,
  T13: 27,
  U13: 2.3,
  W13: "35 max",
  H14: "התחלה",
  I14: "סוף",
  J14: 100,
  K14: 80,
  L14: 60,
  M14: 30,
  N14: 20,
  P14: 5,
};

const buildSubbaseARow15 = (row: ConcentrationRow | undefined, currentProjectName: string): Record<string, string | number> => {
  const values = row ? parseSubbaseAValues(row) : {};
  const certificateNo = row?.certificateNo || "24403";
  const result = evaluateSubbaseA(values);
  return {
    J4: currentProjectName || row?.title || "כביש 806 צלמון שלב א׳",
    J5: "א.ו.ג.ן. מהנדסים בע\"מ",
    J6: row?.contractor || "מפלסי הגליל סלילה עפר ופיתוח בע\"מ",
    A15: 1,
    B15: row?.inspector || row?.responsible || "QC",
    C15: row?.checklistNo || 1,
    D15: row?.executionDate || row?.date || "",
    E15: row?.notes || "גולני",
    F15: row?.location || "מערום בשטח",
    G15: currentProjectName || row?.itemDescription || "כביש 806 צלמון שלב א׳",
    H15: "",
    I15: "",
J15: String(valueOrDefault(values.sieve3, "")),
K15: String(valueOrDefault(values.sieve15, "")),
L15: String(valueOrDefault(values.sieve34, "")),
M15: String(valueOrDefault(values.sieve4, "")),
    N15: String(valueOrDefault(values.sieve10, "")),
O15: String(valueOrDefault(values.sieve40, "")),
P15: String(valueOrDefault(values.sieve200, "")),
Q15: String(valueOrDefault(values.ll, "")),
R15: String(valueOrDefault(values.pl, "")),
S15: String(valueOrDefault(values.pi, "")),
    T15: valueOrDefault(values.swelling, ""),
    U15: valueOrDefault(values.density, ""),
    V15: valueOrDefault(values.absorption, ""),
    W15: valueOrDefault(values.losAngeles, ""),
    X15: valueOrDefault(values.aashto, ""),
    Y15: valueOrDefault(values.maxDensity, ""),
    Z15: valueOrDefault(values.optimumMoisture, ""),
    AA15: certificateNo,
    AB15: result,
    AC15: row?.notes || "",
  };
};

const excelNs = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

const columnNumber = (letters: string) => {
  let number = 0;
  for (const letter of letters.toUpperCase()) number = number * 26 + letter.charCodeAt(0) - 64;
  return number;
};

const cellColumnIndex = (cellRef: string) => columnNumber(cellRef.replace(/\d+/g, ""));
const cellRowIndex = (cellRef: string) => Number(cellRef.replace(/\D+/g, ""));

const getOrCreateRow = (doc: Document, sheetData: Element, rowNumber: number) => {
  const rows = Array.from(sheetData.getElementsByTagNameNS(excelNs, "row"));
  let row = rows.find((candidate) => candidate.getAttribute("r") === String(rowNumber));
  if (row) return row;
  row = doc.createElementNS(excelNs, "row");
  row.setAttribute("r", String(rowNumber));
  const nextRow = rows.find((candidate) => Number(candidate.getAttribute("r")) > rowNumber);
  sheetData.insertBefore(row, nextRow ?? null);
  return row;
};

const getOrCreateCell = (doc: Document, row: Element, cellRef: string) => {
  const cells = Array.from(row.getElementsByTagNameNS(excelNs, "c"));
  let cell = cells.find((candidate) => candidate.getAttribute("r") === cellRef);
  if (cell) return cell;
  cell = doc.createElementNS(excelNs, "c");
  cell.setAttribute("r", cellRef);
  const nextCell = cells.find((candidate) => cellColumnIndex(candidate.getAttribute("r") ?? "A1") > cellColumnIndex(cellRef));
  row.insertBefore(cell, nextCell ?? null);
  return cell;
};

const setCell = (doc: Document, sheetData: Element, cellRef: string, value: string | number) => {
  const row = getOrCreateRow(doc, sheetData, cellRowIndex(cellRef));
  const cell = getOrCreateCell(doc, row, cellRef);
  Array.from(cell.childNodes).forEach((child) => cell.removeChild(child));

  if (typeof value === "number") {
    cell.setAttribute("t", "n");
    const v = doc.createElementNS(excelNs, "v");
    v.textContent = String(value);
    cell.appendChild(v);
  } else {
    cell.setAttribute("t", "inlineStr");
    const is = doc.createElementNS(excelNs, "is");
    const t = doc.createElementNS(excelNs, "t");
    t.setAttribute("xml:space", "preserve");
    t.textContent = value;
    is.appendChild(t);
    cell.appendChild(is);
  }
};

const patchSubbaseAWorkbook = async (buffer: ArrayBuffer, row: ConcentrationRow | undefined, currentProjectName: string) => {
  const zip = await JSZip.loadAsync(buffer);
  const sheetPath = "xl/worksheets/sheet1.xml";
  const worksheetFile = zip.file(sheetPath);
  if (!worksheetFile) throw new Error("לא נמצא sheet1.xml בתוך קובץ מצע א׳");
  const xml = await worksheetFile.async("text");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const sheetData = doc.getElementsByTagNameNS(excelNs, "sheetData")[0];
  if (!sheetData) throw new Error("מבנה Excel לא תקין — sheetData חסר");

  Object.entries(SUBBASE_A_FIXED_CELLS).forEach(([cell, value]) => setCell(doc, sheetData, cell, value));
  Object.entries(buildSubbaseARow15(row, currentProjectName)).forEach(([cell, value]) => setCell(doc, sheetData, cell, value));

  const serialized = new XMLSerializer().serializeToString(doc);
  zip.file(sheetPath, serialized);
  return await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
};

export function ConcentrationsSection({
  savedChecklists = [],
  savedNonconformances = [],
  savedTrialSections = [],
  savedPreliminary = [],
  currentProjectName = "",
}: Props) {
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const rowsByTemplate = useMemo(() => {
    const map: Record<string, ConcentrationRow[]> = {};
    templates.forEach((template) => {
      if (template.source === "checklists") map[template.id] = rowsFromChecklists(savedChecklists, template);
      if (template.source === "nonconformances") map[template.id] = rowsFromSimpleRecords(savedNonconformances, template, "nonconformances");
      if (template.source === "trialSections") map[template.id] = rowsFromSimpleRecords(savedTrialSections, template, "trialSections");
      if (template.source === "preliminary") map[template.id] = rowsFromSimpleRecords(savedPreliminary, template, "preliminary");
    });
    return map;
  }, [savedChecklists, savedNonconformances, savedTrialSections, savedPreliminary]);

  const visibleTemplates = useMemo(() => {
    const q = normalize(search);
    return templates.filter((template) => !q || normalize(`${template.title} ${template.description} ${template.fileName}`).includes(q));
  }, [search]);

  const downloadEmptyTemplate = (template: ConcentrationTemplate) => {
    const a = document.createElement("a");
    a.href = getTemplateUrl(template.fileName);
    a.download = template.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadAutomatic = async (template: ConcentrationTemplate) => {
    setBusyId(template.id);
    try {
      const response = await fetch(getTemplateUrl(template.fileName));
      if (!response.ok) throw new Error(`לא נמצא קובץ תבנית: ${template.fileName}`);
      const buffer = await response.arrayBuffer();
      const rows = rowsByTemplate[template.id] ?? [];

      if (template.mode === "subbaseA") {
        const preferred = rows.find((r) => r.certificateNo === "24403") ?? rows.find((r) => r.checklistNo === "1") ?? rows[0];
        const blob = await patchSubbaseAWorkbook(buffer, preferred, currentProjectName);
        downloadBlob(blob, "subbase-a - ריכוז אוטומטי.xlsx");
        return;
      }

      downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), template.fileName);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "אירעה שגיאה בהפקת הריכוז");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section dir="rtl" style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>ריכוזים</h2>
          <div style={{ color: "#64748b", marginTop: 6, lineHeight: 1.6 }}>
            ריכוז מצע א׳ נבנה מתבנית המקור: שורות 10-14 נשמרות עם אותה חלוקה, אותם צבעים ודרישות מפרט קבועות. שורה 15 מתמלאת מתעודה 24403 / רשימת תיוג מס׳ 1.
          </div>
          {currentProjectName ? <div style={{ color: "#0f172a", fontWeight: 800, marginTop: 6 }}>פרויקט נוכחי: {currentProjectName}</div> : null}
        </div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש ריכוז..." style={{ width: 260, border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 14px", fontWeight: 700 }} />
      </div>

      <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 16, padding: 14, color: "#1e3a8a", fontWeight: 800, lineHeight: 1.7 }}>
        חשוב: ריכוז מצע א׳ משתמש ב־XML Patch ולא בונה Excel מחדש — לכן העיצוב המקורי, המיזוגים והצבעים נשמרים ככל האפשר.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        {visibleTemplates.map((template) => {
          const count = rowsByTemplate[template.id]?.length ?? 0;
          return (
            <div key={template.id} style={{ border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#fff", boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{template.title}</div>
                  <div style={{ color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>{template.description}</div>
                </div>
                <span style={{ borderRadius: 999, background: "#eef2ff", color: "#3730a3", padding: "5px 10px", fontWeight: 900, whiteSpace: "nowrap" }}>{count} תוצאות</span>
              </div>

              <div style={{ marginTop: 12, minHeight: 40, color: count ? "#166534" : "#64748b", fontWeight: 800 }}>
                {count ? `נמצאו ${count} תעודות/רשומות לשיבוץ בריכוז.` : "אין עדיין תוצאות — ניתן להוריד ריכוז ריק."}
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                <button type="button" disabled={busyId === template.id} onClick={() => downloadAutomatic(template)} style={{ border: 0, borderRadius: 12, padding: "12px 14px", fontWeight: 900, color: "#fff", background: "#0f172a", cursor: busyId === template.id ? "wait" : "pointer" }}>
                  {busyId === template.id ? "מפיק ריכוז..." : "הורד ריכוז אוטומטי Excel"}
                </button>
                <button type="button" onClick={() => downloadEmptyTemplate(template)} style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 12px", fontWeight: 900, color: "#0f172a", background: "#fff", cursor: "pointer" }}>
                  הורד תבנית ריקה מקורית
                </button>
                <div style={{ fontSize: 12, color: "#64748b", direction: "ltr", textAlign: "right" }}>{template.fileName}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default ConcentrationsSection;
