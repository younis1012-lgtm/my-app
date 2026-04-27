"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

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
  { id: "nonconformances", title: "דוח ריכוז אי התאמות", fileName: "דוח ריכוז אי התאמות.xlsx", description: "ריכוז אי התאמות לפי הטופס המקורי", keywords: ["אי התאמה", "אי תאמות"], source: "nonconformances" },
  { id: "suppliers", title: "ריכוז ספקים", fileName: "ריכוז ספקים.xlsx", description: "ריכוז ספקים לפי הטופס המקורי", keywords: ["ספק", "ספקים"], source: "preliminary" },
  { id: "contractors", title: "ריכוז קבלנים", fileName: "ריכוז קבלנים.xlsx", description: "ריכוז קבלנים לפי הטופס המקורי", keywords: ["קבלן", "קבלנים", "קבלן משנה"], source: "preliminary" },
  { id: "asphalt", title: "ריכוז בדיקות אספלט", fileName: "ריכוז בדיקות אספלט.xlsx", description: "בדיקות אספלט / FWD / מישוריות", keywords: ["אספלט", "FWD", "שכבה סופית", "מישוריות"], source: "checklists" },
  { id: "density", title: "ריכוז בדיקות צפיפות", fileName: "ריכוז בדיקות צפיפות.xlsx", description: "צפיפות / הידוק / רטיבות / מצעים", keywords: ["צפיפות", "הידוק", "רטיבות", "דרגת", "תכולת", "מצע", "מצעים"], source: "checklists" },
  { id: "concrete", title: "ריכוז בטון", fileName: "ריכוז בטון.xlsx", description: "בדיקות בטון", keywords: ["בטון", "יציקה", "קוביות", "חוזק"], source: "checklists" },
  { id: "supervision", title: "ריכוז דוחות פיקוח עליון", fileName: "ריכוז דוחות פיקוח עליון.xlsx", description: "דוחות פיקוח עליון", keywords: ["פיקוח עליון", "דוח פיקוח"], source: "trialSections" },
  { id: "materials", title: "ריכוז חומרים", fileName: "ריכוז חומרים.xlsx", description: "אישורי חומרים", keywords: ["חומר", "חומרים", "תקן", "מפרט", "תעודת התאמה"], source: "preliminary" },
  { id: "trial-sections", title: "ריכוז קטעי ניסוי", fileName: "ריכוז קטעי ניסוי.xlsx", description: "קטעי ניסוי", keywords: ["קטע ניסוי", "קטעי ניסוי"], source: "trialSections" },
  // שים לב: אצלך שם הקובץ בתיקיית concentrations הוא בלי האות י' במילה רכוז.
  { id: "subbase-a", title: "ריכוז אפיון מצע א׳", fileName: "רכוז אפיון מצע א.xlsx", description: "אפיון מצע א׳ / CBR / גרדציה", keywords: ["אפיון מצע", "מצע א", "מצע א׳", "CBR", "גרדציה", "מצע"], source: "checklists" },
  { id: "selected-material", title: "ריכוז אפיון נברר", fileName: "רכוז אפיון נברר.xlsx", description: "אפיון חומר נברר", keywords: ["נברר", "חומר נברר", "אפיון נברר", "CBR", "גרדציה"], source: "checklists" },
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

const cellText = (cell: XLSX.CellObject | undefined) => normalize(cell?.v ?? "");

const getRange = (ws: XLSX.WorkSheet) => XLSX.utils.decode_range(ws["!ref"] || "A1:A1");

const setCellValueKeepStyle = (ws: XLSX.WorkSheet, row: number, col: number, value: unknown, styleFromRow?: number) => {
  const ref = XLSX.utils.encode_cell({ r: row, c: col });
  const oldCell: any = ws[ref] || {};
  const styleCell: any = typeof styleFromRow === "number" ? ws[XLSX.utils.encode_cell({ r: styleFromRow, c: col })] : undefined;
  const next: any = { ...oldCell, v: value ?? "", t: typeof value === "number" ? "n" : "s" };
  if (!next.s && styleCell?.s) next.s = styleCell.s;
  ws[ref] = next;
};

const clearCellKeepStyle = (ws: XLSX.WorkSheet, row: number, col: number) => {
  const ref = XLSX.utils.encode_cell({ r: row, c: col });
  const oldCell: any = ws[ref];
  ws[ref] = oldCell?.s ? { t: "s", v: "", s: oldCell.s } : { t: "s", v: "" };
};

const updateSheetRef = (ws: XLSX.WorkSheet, row: number, col: number) => {
  const range = getRange(ws);
  range.e.r = Math.max(range.e.r, row);
  range.e.c = Math.max(range.e.c, col);
  ws["!ref"] = XLSX.utils.encode_range(range);
};

const findHeaderRow = (ws: XLSX.WorkSheet) => {
  const range = getRange(ws);
  let best = { row: Math.min(range.e.r, 10), score: 0 };
  for (let r = range.s.r; r <= Math.min(range.e.r, 60); r += 1) {
    let score = 0;
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const text = cellText(ws[XLSX.utils.encode_cell({ r, c })]);
      if (!text) continue;
      if (text.includes("מס סדורי") || text.includes("מס")) score += 1;
      if (text.includes("תאריך")) score += 1;
      if (text.includes("תעודה")) score += 2;
      if (text.includes("מקור החומר") || text.includes("מקום") || text.includes("מיקום")) score += 1;
      if (text.includes("הערות")) score += 1;
      if (text.includes("qc") || text.includes("qa")) score += 1;
    }
    if (score > best.score) best = { row: r, score };
  }
  return best.row;
};

const buildHeaderMap = (ws: XLSX.WorkSheet, headerRow: number) => {
  const range = getRange(ws);
  const map = new Map<number, string>();
  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const direct = cellText(ws[XLSX.utils.encode_cell({ r: headerRow, c })]);
    const above = cellText(ws[XLSX.utils.encode_cell({ r: headerRow - 1, c })]);
    const below = cellText(ws[XLSX.utils.encode_cell({ r: headerRow + 1, c })]);
    const label = [above, direct, below].filter(Boolean).join(" ");
    if (label) map.set(c, label);
  }
  return map;
};

const rowValueForHeader = (header: string, row: ConcentrationRow, index: number, projectName: string) => {
  const h = normalize(header);
  if (h.includes("מס סדורי") || h === "מס" || h.startsWith("מס ")) return index + 1;
  if (h.includes("שם פרויקט") || h.includes("פרויקט")) return projectName;
  if (h.includes("ניהול פרויקט")) return "";
  if (h.includes("שם הקבלן") || h.includes("קבלן") || h.includes("שם מבצע")) return row.contractor;
  if (h.includes("רשימת תיוג")) return row.checklistNo;
  if (h.includes("מס תעודה") || h.includes("תעודה")) return row.certificateNo || row.fileName;
  if (h.includes("מקור החומר")) return row.notes || row.contractor;
  if (h.includes("מיקום נטילה") || h.includes("מקום נטילה")) return row.location;
  if (h.includes("מקום הפיזור") || h.includes("מקום ביצוע") || h.includes("מיקום")) return row.location || row.itemDescription;
  if (h.includes("תאריך")) return row.executionDate || row.date;
  if (h.includes("בוצע") || h.includes("qc") || h.includes("qa")) return row.inspector || row.responsible || "QC";
  if (h.includes("סוג העבודה") || h.includes("תיאור") || h.includes("בדיקה")) return row.itemDescription;
  if (h.includes("אחראי")) return row.responsible;
  if (h.includes("בודק") || h.includes("שם")) return row.inspector;
  if (h.includes("ok") || h.includes("nc") || h.includes("תקין") || h.includes("סטטוס")) return row.status;
  if (h.includes("הערות")) return row.notes;
  return "";
};

const clearTemplateDataArea = (ws: XLSX.WorkSheet, headerRow: number, headerMap: Map<number, string>, rowsToClear = 80) => {
  const dataStart = headerRow + 1;
  const columns = Array.from(headerMap.keys());
  for (let r = dataStart; r < dataStart + rowsToClear; r += 1) {
    columns.forEach((c) => clearCellKeepStyle(ws, r, c));
  }
};

const fillWorksheetKeepingTemplate = (ws: XLSX.WorkSheet, rows: ConcentrationRow[], projectName: string) => {
  const headerRow = findHeaderRow(ws);
  const headerMap = buildHeaderMap(ws, headerRow);
  const dataStart = headerRow + 1;
  const styleRow = dataStart;

  clearTemplateDataArea(ws, headerRow, headerMap);

  rows.forEach((row, rIndex) => {
    const sheetRow = dataStart + rIndex;
    headerMap.forEach((header, col) => {
      const value = rowValueForHeader(header, row, rIndex, projectName);
      if (value !== "") setCellValueKeepStyle(ws, sheetRow, col, value, styleRow);
      updateSheetRef(ws, sheetRow, col);
    });
  });
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
      const workbook = XLSX.read(buffer, { type: "array", cellStyles: true, cellDates: true, bookVBA: true });
      const sheetName = workbook.SheetNames.find((name) => !normalize(name).includes("סטטיסט")) || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) throw new Error("לא נמצאה לשונית עבודה בקובץ הריכוז");

      const rows = rowsByTemplate[template.id] ?? [];
      if (rows.length) fillWorksheetKeepingTemplate(worksheet, rows, currentProjectName);

      const out = XLSX.write(workbook, { bookType: "xlsx", type: "array", cellStyles: true });
      downloadBlob(
        new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        template.fileName.replace(/\.xlsx$/i, "") + " - ריכוז אוטומטי.xlsx"
      );
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
            הריכוז האוטומטי מוריד את אותו קובץ Excel מתוך <span dir="ltr">public/concentrations</span> ומשבץ נתונים בתוך התבנית המקורית, בלי לבנות טבלה חדשה ובלי לשנות את מבנה הקובץ.
          </div>
          {currentProjectName ? <div style={{ color: "#0f172a", fontWeight: 800, marginTop: 6 }}>פרויקט נוכחי: {currentProjectName}</div> : null}
        </div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש ריכוז..." style={{ width: 260, border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 14px", fontWeight: 700 }} />
      </div>

      <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 16, padding: 14, color: "#1e3a8a", fontWeight: 800, lineHeight: 1.7 }}>
        חשוב: קבצי האקסל המקוריים חייבים להיות בתיקייה <span dir="ltr">public/concentrations</span>. אם אין תוצאות עדיין — כפתור הריכוז האוטומטי יוריד את אותה תבנית מקורית ללא מילוי.
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
