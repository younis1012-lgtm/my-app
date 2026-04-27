"use client";

import { useMemo, useState } from "react";

type AttachmentKind = "lab" | "measurement" | "other";

type ChecklistAttachment = {
  id?: string;
  name?: string;
  type?: string;
  dataUrl?: string;
  uploadedAt?: string;
  kind?: AttachmentKind;
};

type Props = {
  savedChecklists?: any[];
  savedNonconformances?: any[];
  savedTrialSections?: any[];
  savedPreliminary?: any[];
  currentProjectName?: string;
};

type AutoRow = {
  sourceType: "checklist" | "nonconformance" | "trial" | "preliminary";
  serial: number;
  recordId?: string;
  checklistNo?: string | number;
  certificateNo?: string;
  date?: string;
  title?: string;
  category?: string;
  description?: string;
  location?: string;
  contractor?: string;
  responsible?: string;
  inspector?: string;
  status?: string;
  notes?: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentKind?: AttachmentKind;
  materialSource?: string;
};

type ConcentrationTemplate = {
  id: string;
  title: string;
  fileName: string;
  description: string;
  source: "checklists" | "nonconformances" | "trialSections" | "preliminary";
  keywords: string[];
  rowStart: number;
  clearUntilRow: number;
  columns: string[]; // A, B, C...
};

const templateFiles: ConcentrationTemplate[] = [
  {
    id: "nonconformances",
    title: "דוח ריכוז אי התאמות",
    fileName: "דוח ריכוז אי התאמות.xlsx",
    description: "ריכוז אי התאמות לפי הטופס המקורי",
    source: "nonconformances",
    keywords: ["אי התאמה", "אי תאמות", "ליקוי"],
    rowStart: 9,
    clearUntilRow: 180,
    columns: ["serial", "title", "notes", "date", "inspector", "status", "responsible", "location", "description"],
  },
  {
    id: "suppliers",
    title: "ריכוז ספקים",
    fileName: "ריכוז ספקים.xlsx",
    description: "ריכוז ספקים לפי הטופס המקורי",
    source: "preliminary",
    keywords: ["ספק", "ספקים"],
    rowStart: 12,
    clearUntilRow: 120,
    columns: ["serial", "supplierName", "suppliedMaterial", "contactPhone", "projectName", "status", "certificateNo", "date", "notes"],
  },
  {
    id: "contractors",
    title: "ריכוז קבלנים",
    fileName: "ריכוז קבלנים.xlsx",
    description: "ריכוז קבלנים לפי הטופס המקורי",
    source: "preliminary",
    keywords: ["קבלן", "קבלנים", "קבלן משנה"],
    rowStart: 12,
    clearUntilRow: 120,
    columns: ["serial", "subcontractorName", "field", "contactPhone", "projectName", "status", "certificateNo", "date", "notes"],
  },
  {
    id: "asphalt",
    title: "ריכוז בדיקות אספלט",
    fileName: "ריכוז בדיקות אספלט.xlsx",
    description: "ריכוז בדיקות אספלט / FWD / מישוריות",
    source: "checklists",
    keywords: ["אספלט", "fwd", "שכבה סופית", "מישוריות", "מרשל", "תערובת"],
    rowStart: 14,
    clearUntilRow: 220,
    columns: ["qc", "serial", "certificateNo", "date", "description", "from", "to", "quantity", "location", "notes"],
  },
  {
    id: "density",
    title: "ריכוז בדיקות צפיפות",
    fileName: "ריכוז בדיקות צפיפות.xlsx",
    description: "ריכוז צפיפות / הידוק / רטיבות",
    source: "checklists",
    keywords: ["צפיפות", "הידוק", "רטיבות", "דרגת", "תכולת", "בדיקת הידוק", "בדיקת צפיפות"],
    rowStart: 10,
    clearUntilRow: 240,
    columns: ["qc", "serial", "certificateNo", "date", "location", "from", "to", "side", "description", "notes"],
  },
  {
    id: "concrete",
    title: "ריכוז בטון",
    fileName: "ריכוז בטון.xlsx",
    description: "ריכוז בדיקות בטון",
    source: "checklists",
    keywords: ["בטון", "יציקה", "קוביות", "חוזק"],
    rowStart: 11,
    clearUntilRow: 160,
    columns: ["qc", "serial", "date", "location", "description", "samplingPlace", "from", "to", "certificateNo", "notes"],
  },
  {
    id: "supervision",
    title: "ריכוז דוחות פיקוח עליון",
    fileName: "ריכוז דוחות פיקוח עליון.xlsx",
    description: "ריכוז דוחות פיקוח עליון",
    source: "trialSections",
    keywords: ["פיקוח עליון", "דוח פיקוח", "מתכנן"],
    rowStart: 9,
    clearUntilRow: 160,
    columns: ["serial", "projectName", "category", "inspector", "date", "savedAt", "status", "description", "notes"],
  },
  {
    id: "materials",
    title: "ריכוז חומרים",
    fileName: "ריכוז חומרים.xlsx",
    description: "ריכוז אישורי חומרים",
    source: "preliminary",
    keywords: ["חומר", "חומרים", "תקן", "מפרט", "תעודת התאמה", "מקור"],
    rowStart: 12,
    clearUntilRow: 160,
    columns: ["serial", "materialName", "source", "usage", "source", "projectName", "status", "certificateNo", "notes"],
  },
  {
    id: "trial-sections",
    title: "ריכוז קטעי ניסוי",
    fileName: "ריכוז קטעי ניסוי.xlsx",
    description: "ריכוז קטעי ניסוי",
    source: "trialSections",
    keywords: ["קטע ניסוי", "קטעי ניסוי"],
    rowStart: 11,
    clearUntilRow: 180,
    columns: ["serial", "road", "from", "to", "side", "title", "description", "contractor", "date", "status", "notes"],
  },
  {
    id: "subbase-a",
    title: "ריכוז אפיון מצע א׳",
    fileName: "ריכוז אפיון מצע א.xlsx",
    description: "ריכוז בדיקות אפיון למצע סוג א׳",
    source: "checklists",
    keywords: ["אפיון מצע", "מצע א", "מצע א׳", "מצע א'", "cbr", "גרדציה", "מצע"],
    rowStart: 15,
    clearUntilRow: 220,
    columns: ["serial", "qc", "certificateNo", "date", "materialSource", "samplePlace", "location", "from", "to", "notes"],
  },
  {
    id: "selected-material",
    title: "ריכוז אפיון נברר",
    fileName: "ריכוז אפיון נברר.xlsx",
    description: "ריכוז בדיקות אפיון חומר נברר",
    source: "checklists",
    keywords: ["נברר", "חומר נברר", "אפיון נברר", "cbr", "גרדציה"],
    rowStart: 13,
    clearUntilRow: 220,
    columns: ["qc", "serial", "materialSource", "date", "certificateNo", "location", "from", "to", "side", "notes"],
  },
];

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[׳’`']/g, "")
    .replace(/\s+/g, " ")
    .trim();

const clean = (value: unknown) => String(value ?? "").trim();

const getFileUrl = (fileName: string) => `/concentrations/${encodeURIComponent(fileName)}`;

const getAttachments = (item: any): ChecklistAttachment[] =>
  Array.isArray(item?.attachments)
    ? item.attachments.filter((attachment: any) => attachment && typeof attachment === "object")
    : [];

const extractCertificateNo = (...values: unknown[]) => {
  const text = values.map((value) => String(value ?? "")).join(" ");
  const matches = text.match(/\d{3,}/g);
  return matches?.[matches.length - 1] ?? "";
};

const first = (...values: unknown[]) => values.map(clean).find(Boolean) ?? "";

const textOfRecord = (record: any) => {
  const parts = [
    record?.title,
    record?.category,
    record?.location,
    record?.contractor,
    record?.status,
    record?.description,
    record?.notes,
    record?.subtype,
  ];

  if (Array.isArray(record?.items)) {
    record.items.forEach((item: any) =>
      parts.push(item?.description, item?.notes, item?.status, item?.inspector, item?.responsible)
    );
  }

  if (record?.supplier) parts.push(record.supplier.supplierName, record.supplier.suppliedMaterial, record.supplier.notes);
  if (record?.subcontractor) parts.push(record.subcontractor.subcontractorName, record.subcontractor.field, record.subcontractor.notes);
  if (record?.material) parts.push(record.material.materialName, record.material.source, record.material.usage, record.material.notes);

  return normalize(parts.filter(Boolean).join(" "));
};

const matchesTemplate = (template: ConcentrationTemplate, text: string) =>
  template.keywords.some((keyword) => text.includes(normalize(keyword)));

const parseChainage = (text: unknown) => {
  const value = String(text ?? "");
  const pair = value.match(/(\d{2,4})\s*[-–]\s*(\d{2,4})/);
  if (pair) return { from: pair[1], to: pair[2] };
  const from = value.match(/מחתך\s*[:\-]?\s*(\d{2,4})/);
  const to = value.match(/עד\s*חתך\s*[:\-]?\s*(\d{2,4})/);
  return { from: from?.[1] ?? "", to: to?.[1] ?? "" };
};

const inferMaterialSource = (text: unknown) => {
  const normalized = normalize(text);
  if (normalized.includes("גולני") || normalized.includes("אבן וסיד")) return "גולני";
  if (normalized.includes("בועיינה")) return "בועיינה";
  if (normalized.includes("רדימיקס") || normalized.includes("רדימקס")) return "רדימיקס";
  return "";
};

const createChecklistRows = (template: ConcentrationTemplate, savedChecklists: any[]): AutoRow[] => {
  const rows: AutoRow[] = [];

  savedChecklists.forEach((record) => {
    const recordText = textOfRecord(record);
    const items = Array.isArray(record?.items) ? record.items : [];

    items.forEach((item: any) => {
      const attachments = getAttachments(item).filter((attachment) => attachment.kind === "lab" || attachment.kind === "measurement" || !attachment.kind);
      if (!attachments.length) return;

      const itemText = normalize([recordText, item?.description, item?.notes, item?.status, item?.responsible, item?.inspector].join(" "));
      if (!matchesTemplate(template, itemText)) return;

      attachments.forEach((attachment) => {
        const chainage = parseChainage([record?.location, item?.description, item?.notes].join(" "));
        rows.push({
          sourceType: "checklist",
          serial: rows.length + 1,
          recordId: record?.id,
          checklistNo: record?.checklistNo,
          certificateNo: extractCertificateNo(attachment?.name, item?.notes, record?.notes),
          date: first(item?.executionDate, record?.date, attachment?.uploadedAt),
          title: record?.title,
          category: record?.category,
          description: item?.description,
          location: first(record?.location, item?.notes),
          contractor: record?.contractor,
          responsible: item?.responsible,
          inspector: item?.inspector,
          status: item?.status,
          notes: item?.notes,
          attachmentName: attachment?.name,
          attachmentType: attachment?.type,
          attachmentKind: attachment?.kind,
          materialSource: inferMaterialSource([item?.description, item?.notes, record?.notes, attachment?.name].join(" ")),
          ...chainage,
        } as AutoRow);
      });
    });
  });

  return rows;
};

const createNonconformanceRows = (records: any[]): AutoRow[] =>
  records.map((record, index) => ({
    sourceType: "nonconformance",
    serial: index + 1,
    recordId: record?.id,
    title: record?.title,
    date: record?.date,
    description: record?.description,
    location: record?.location,
    responsible: record?.raisedBy,
    inspector: record?.raisedBy,
    status: record?.status,
    notes: first(record?.actionRequired, record?.notes),
  }));

const createTrialRows = (records: any[]): AutoRow[] =>
  records.map((record, index) => ({
    sourceType: "trial",
    serial: index + 1,
    recordId: record?.id,
    title: record?.title,
    date: record?.date,
    description: record?.spec || record?.result,
    location: record?.location,
    contractor: "",
    inspector: record?.approvedBy,
    status: record?.status,
    notes: record?.notes,
  }));

const createPreliminaryRows = (template: ConcentrationTemplate, records: any[], currentProjectName: string): AutoRow[] =>
  records
    .filter((record) => matchesTemplate(template, textOfRecord(record)))
    .map((record, index) => {
      const supplier = record?.supplier ?? {};
      const subcontractor = record?.subcontractor ?? {};
      const material = record?.material ?? {};
      return {
        sourceType: "preliminary",
        serial: index + 1,
        recordId: record?.id,
        title: record?.title,
        date: record?.date,
        status: record?.status,
        notes: first(supplier.notes, subcontractor.notes, material.notes),
        certificateNo: first(supplier.approvalNo, subcontractor.approvalNo, material.certificateNo),
        projectName: currentProjectName,
        supplierName: supplier.supplierName,
        suppliedMaterial: supplier.suppliedMaterial,
        contactPhone: first(supplier.contactPhone, subcontractor.contactPhone),
        subcontractorName: subcontractor.subcontractorName,
        field: subcontractor.field,
        materialName: material.materialName,
        source: material.source,
        usage: material.usage,
      } as any;
    });

const formatDateForCell = (value: unknown) => {
  const text = clean(value);
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [y, m, d] = text.split("-");
    return `${d}/${m}/${y}`;
  }
  return text.split(",")[0];
};

const valueForColumn = (column: string, row: any, currentProjectName: string) => {
  switch (column) {
    case "serial": return row.serial;
    case "qc": return "QC";
    case "projectName": return currentProjectName;
    case "checklistNo": return row.checklistNo ?? "";
    case "certificateNo": return row.certificateNo ?? "";
    case "date": return formatDateForCell(row.date);
    case "title": return row.title ?? "";
    case "category": return row.category ?? "";
    case "description": return row.description ?? "";
    case "location": return row.location || currentProjectName;
    case "contractor": return row.contractor ?? "";
    case "responsible": return row.responsible ?? "";
    case "inspector": return row.inspector ?? "";
    case "status": return row.status ?? "";
    case "notes": return row.notes ?? "";
    case "attachmentName": return row.attachmentName ?? "";
    case "materialSource": return row.materialSource || row.source || "";
    case "samplePlace": return "מערום בשטח";
    case "samplingPlace": return "אתר";
    case "from": return row.from ?? "";
    case "to": return row.to ?? "";
    case "side": return row.side ?? "";
    case "road": return row.road ?? currentProjectName;
    case "quantity": return row.quantity ?? "";
    default: return row[column] ?? "";
  }
};

const isCellRef = (key: string) => /^[A-Z]+[0-9]+$/.test(key);

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ConcentrationsSection({
  savedChecklists = [],
  savedNonconformances = [],
  savedTrialSections = [],
  savedPreliminary = [],
  currentProjectName = "",
}: Props) {
  const [search, setSearch] = useState("");
  const [isGenerating, setIsGenerating] = useState<string | null>(null);

  const templates = useMemo(() => {
    const q = normalize(search);
    return templateFiles.filter((template) => !q || normalize(`${template.title} ${template.description}`).includes(q));
  }, [search]);

  const rowsByTemplate = useMemo(() => {
    const result: Record<string, AutoRow[]> = {};

    templateFiles.forEach((template) => {
      if (template.source === "checklists") result[template.id] = createChecklistRows(template, savedChecklists);
      if (template.source === "nonconformances") result[template.id] = createNonconformanceRows(savedNonconformances);
      if (template.source === "trialSections") result[template.id] = createTrialRows(savedTrialSections).filter((row) => matchesTemplate(template, normalize([row.title, row.description, row.notes].join(" "))));
      if (template.source === "preliminary") result[template.id] = createPreliminaryRows(template, savedPreliminary, currentProjectName);
    });

    return result;
  }, [savedChecklists, savedNonconformances, savedTrialSections, savedPreliminary, currentProjectName]);

  const downloadStaticTemplate = (template: ConcentrationTemplate) => {
    const link = document.createElement("a");
    link.href = getFileUrl(template.fileName);
    link.download = template.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const generateExcel = async (template: ConcentrationTemplate) => {
    setIsGenerating(template.id);
    try {
      const XLSX = await import("xlsx");
      const response = await fetch(getFileUrl(template.fileName));
      if (!response.ok) throw new Error(`לא נמצאה תבנית: ${template.fileName}`);

      const buffer = await response.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellStyles: true, cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) throw new Error("לא נמצא גיליון בתבנית");

      const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:Z200");
      const colCount = Math.max(range.e.c + 1, 26);

      // ניקוי ערכי פרויקט קודם ושורות נתונים בלבד — בלי למחוק כותרות/עיצוב.
      for (let r = template.rowStart - 1; r <= template.clearUntilRow - 1; r += 1) {
        for (let c = 0; c < colCount; c += 1) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (sheet[addr]) {
            delete sheet[addr].v;
            delete sheet[addr].w;
            delete sheet[addr].f;
          }
        }
      }

      // עדכון נתוני פרויקט בכותרות.
      Object.keys(sheet).filter(isCellRef).forEach((addr) => {
        const cell = sheet[addr];
        const text = normalize(cell?.v);
        if (!text) return;
        const decoded = XLSX.utils.decode_cell(addr);
        const write = (offset: number, value: string) => {
          if (!value) return;
          const target = XLSX.utils.encode_cell({ r: decoded.r, c: decoded.c + offset });
          sheet[target] = { ...(sheet[target] || {}), t: "s", v: value };
        };

        if (text.includes("שם פרויקט")) write(1, currentProjectName);
        if (text.includes("שם הקבלן")) {
          const contractor = first(savedChecklists[0]?.contractor, (savedTrialSections[0] as any)?.contractor);
          write(1, contractor);
        }
        if (text.includes("תאריך עדכון")) write(1, formatDateForCell(new Date().toISOString().slice(0, 10)));
      });

      const rows = rowsByTemplate[template.id] ?? [];
      rows.forEach((row, index) => {
        template.columns.forEach((column, c) => {
          const value = valueForColumn(column, { ...row, serial: index + 1 }, currentProjectName);
          if (value === undefined || value === null || value === "") return;

          const addr = XLSX.utils.encode_cell({ r: template.rowStart - 1 + index, c });
          const previous = sheet[addr] || {};
          sheet[addr] = {
            ...previous,
            t: typeof value === "number" ? "n" : "s",
            v: value,
          };
        });
      });

      const lastRow = Math.max(range.e.r, template.rowStart - 1 + Math.max(rows.length, 1));
      sheet["!ref"] = XLSX.utils.encode_range({
        s: range.s,
        e: { r: lastRow, c: Math.max(range.e.c, template.columns.length - 1) },
      });

      const output = XLSX.write(workbook, { bookType: "xlsx", type: "array", cellStyles: true });
      const suffix = rows.length ? "אוטומטי" : "ריק";
      saveBlob(new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${template.title} - ${suffix}.xlsx`);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "אירעה שגיאה ביצירת הריכוז");
    } finally {
      setIsGenerating(null);
    }
  };

  return (
    <section dir="rtl" style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>ריכוזים</h2>
          <div style={{ color: "#64748b", marginTop: 6, lineHeight: 1.6 }}>
            הורדת ריכוז אוטומטי פותחת את תבנית האקסל המקורית, מנקה ערכים קודמים, ומכניסה תעודות/בדיקות ששויכו לרשימות התיוג של הפרויקט.
          </div>
          {currentProjectName ? <div style={{ color: "#0f172a", fontWeight: 800, marginTop: 6 }}>פרויקט נוכחי: {currentProjectName}</div> : null}
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="חיפוש ריכוז..."
          style={{ width: 260, border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 14px", fontWeight: 700 }}
        />
      </div>

      <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 16, padding: 14, color: "#1e3a8a", fontWeight: 800, lineHeight: 1.7 }}>
        חשוב: כדי שהורדה אוטומטית תעבוד יש להתקין פעם אחת את החבילה <span dir="ltr">xlsx</span>. הריכוז יורד גם אם אין עדיין תוצאות — במקרה כזה מתקבלת תבנית ריקה ונקייה.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 14 }}>
        {templates.map((template) => {
          const rows = rowsByTemplate[template.id] ?? [];
          return (
            <div key={template.id} style={{ border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#fff", boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{template.title}</div>
                  <div style={{ color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>{template.description}</div>
                </div>
                <span style={{ borderRadius: 999, background: rows.length ? "#dcfce7" : "#f1f5f9", color: rows.length ? "#166534" : "#475569", padding: "5px 10px", fontWeight: 900, whiteSpace: "nowrap" }}>
                  {rows.length} תוצאות
                </span>
              </div>

              {rows.length ? (
                <div style={{ marginTop: 12, border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>תעודה</th>
                        <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>רשימה</th>
                        <th style={{ padding: 8, borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>תהליך</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 4).map((row, index) => (
                        <tr key={`${row.recordId}-${row.certificateNo}-${index}`}>
                          <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>{row.certificateNo || "—"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>{row.checklistNo || row.title || "—"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>{row.description || row.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > 4 ? <div style={{ padding: 8, color: "#64748b", fontWeight: 800 }}>ועוד {rows.length - 4} רשומות...</div> : null}
                </div>
              ) : (
                <div style={{ marginTop: 12, color: "#64748b", fontWeight: 800 }}>אין עדיין תוצאות — ניתן להוריד ריכוז ריק.</div>
              )}

              <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => generateExcel(template)}
                  disabled={Boolean(isGenerating)}
                  style={{ border: "1px solid #0f172a", borderRadius: 12, padding: "10px 12px", fontWeight: 900, color: "#fff", background: "#0f172a", cursor: isGenerating ? "wait" : "pointer" }}
                >
                  {isGenerating === template.id ? "מכין קובץ..." : "הורד ריכוז אוטומטי Excel"}
                </button>
                <button
                  type="button"
                  onClick={() => downloadStaticTemplate(template)}
                  style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "9px 12px", fontWeight: 900, color: "#0f172a", background: "#fff", cursor: "pointer" }}
                >
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
