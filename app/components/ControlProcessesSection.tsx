"use client";

import { useMemo, useState } from "react";
import type React from "react";
import type { ControlProcess, ChecklistRecord } from "../types";
import { Field, styles } from "./common";

type Props = {
  guardedBody?: React.ReactNode;
  currentProjectId: string | null;
  processes: ControlProcess[];
  setProcesses: React.Dispatch<React.SetStateAction<ControlProcess[]>>;
  projectChecklists?: ChecklistRecord[];
  projectRFIs?: any[];
  projectNonconformances?: any[];
};

const defaultRequiredDocuments = [
  { type: "תעודת מעבדה", required: true },
  { type: "רשימת מדידה", required: false },
  { type: "צילום", required: false },
  { type: "תוכנית", required: false },
] as const;

type DensityReportColumn = { key: string; title: string; hint: string };

const densityReportColumns: DensityReportColumn[] = [
  { key: "performedBy", title: "ביצוע ע\"י", hint: "QC/QA" },
  { key: "serialNo", title: "מס' סדורי", hint: "מס'" },
  { key: "checklistNo", title: "רשימת תיוג", hint: "מס'" },
  { key: "testDate", title: "תאריך הבדיקה", hint: "תאריך" },
  { key: "roadAxis", title: "כביש\\ציר \\רמפה", hint: "מס'" },
  { key: "fromChainage", title: "מחתך", hint: "מס'" },
  { key: "toChainage", title: "עד חתך", hint: "מס'" },
  { key: "side", title: "צד", hint: "" },
  { key: "sampleLocation", title: "מקום נטילה", hint: "" },
  { key: "area", title: "שטח", hint: "מ\"ר" },
  { key: "layerNo", title: "שכבה מס'", hint: "מס'" },
  { key: "layerThickness", title: "עובי השכבה", hint: "ס\"מ" },
  { key: "workType", title: "סוג העבודה", hint: "קרקע יסוד, מילוי, חפירה" },
  { key: "materialDescription", title: "תאור החומר", hint: "" },
  { key: "materialClass", title: "מיון החומר", hint: "AASHTO" },
  { key: "materialSource", title: "מקור החומר", hint: "" },
  { key: "regularCompactionCertificate", title: "מס' תעודת בדיקההידוק רגיל", hint: "" },
  { key: "rollerPasses", title: "מעברי מכבש", hint: "כמות מעברי מכבש" },
  { key: "rollerStatus", title: "מעמד", hint: "OK / NC" },
  { key: "fieldDensityCertificate", title: "מס' תעודת בדיקה צפיפות/ רטיבות שדה", hint: "מס' תעודה" },
  { key: "nuclearGaugePoints", title: "הידוק מבוקר (צפיפות מד גרעיני)", hint: "כמות נקודות בדיקה" },
  { key: "nuclearGaugeStatus", title: "מעמד", hint: "OK / NC" },
  { key: "sandConeBatch", title: "מנת בדיקה (חרוט חול / שלבי)", hint: "כמות נקודות בדיקה" },
  { key: "sandConeStatus", title: "מעמד", hint: "OK / NC" },
  { key: "measurementCount", title: "מדידה", hint: "כמות (1,2,3...)" },
  { key: "measurementStatus", title: "מעמד", hint: "OK / NC" },
];

const normalizeText = (value: unknown) => String(value ?? "").trim();
const normalizeLoose = (value: unknown) => normalizeText(value).replace(/[׳`’']/g, "").replace(/\s+/g, " ");
const firstFilled = (...values: unknown[]) => values.map(normalizeText).find(Boolean) || "";
const valueFrom = (source: any, keys: string[]) => {
  if (!source || typeof source !== "object") return "";
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && normalizeText(source[key]) !== "") return source[key];
  }
  return "";
};

const findChecklistAnswer = (checklist: any, labels: string[]) => {
  const items = Array.isArray(checklist?.items) ? checklist.items : [];
  const normalizedLabels = labels.map(normalizeLoose);
  for (const item of items) {
    const itemText = normalizeLoose([item?.title, item?.label, item?.description, item?.name, item?.question].filter(Boolean).join(" "));
    if (!normalizedLabels.some((label) => itemText.includes(label))) continue;
    const value = firstFilled(item?.value, item?.answer, item?.result, item?.notes, item?.comment, item?.status);
    if (value) return value;
  }
  return "";
};

const formatChecklistDate = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("he-IL");
  }
  const text = normalizeText(value);
  if (!text) return "";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toLocaleDateString("he-IL");
};

const resolveOkNc = (...values: unknown[]) => {
  const text = normalizeLoose(values.filter(Boolean).join(" ")).toUpperCase();
  if (!text) return "";
  if (text.includes("NC") || text.includes("לא תקין") || text.includes("נדחה") || text.includes("נכשל")) return "NC";
  if (text.includes("OK") || text.includes("תקין") || text.includes("מאושר") || text.includes("הושלם")) return "OK";
  return "";
};

const isDensityChecklist = (checklist: any) => {
  const text = normalizeLoose([
    checklist?.title,
    checklist?.category,
    checklist?.workType,
    checklist?.type,
    checklist?.location,
    checklist?.notes,
    checklist?.description,
    ...(Array.isArray(checklist?.items) ? checklist.items.map((item: any) => [item?.title, item?.label, item?.description, item?.question].join(" ")) : []),
  ].filter(Boolean).join(" "));
  return ["צפיפות", "הידוק", "עבודות עפר", "מצע", "שתית", "מילוי", "חפירה", "חרוט חול", "מד גרעיני"].some((keyword) => text.includes(keyword));
};

const buildDensityReportRow = (checklist: any, index: number, relatedProcess?: any) => {
  const location = firstFilled(valueFrom(checklist, ["sampleLocation", "takingPlace", "place", "location"]), relatedProcess?.location);
  const workType = firstFilled(valueFrom(checklist, ["workType", "category", "type", "title"]), relatedProcess?.workType);
  return {
    performedBy: firstFilled(valueFrom(checklist, ["performedBy", "executionBy", "qcQa", "responsibleRole"]), "QC"),
    serialNo: index + 1,
    checklistNo: firstFilled(valueFrom(checklist, ["checklistNo", "checklistNumber", "number", "serialNo"]), index + 1),
    testDate: formatChecklistDate(firstFilled(valueFrom(checklist, ["testDate", "inspectionDate", "date", "createdAt", "savedAt"]))),
    roadAxis: firstFilled(valueFrom(checklist, ["roadAxis", "road", "axis", "route", "roadNo", "projectRoad"]), findChecklistAnswer(checklist, ["כביש", "ציר", "רמפה"])),
    fromChainage: firstFilled(valueFrom(checklist, ["fromChainage", "fromSection", "from", "startChainage"]), relatedProcess?.fromChainage, relatedProcess?.fromSection),
    toChainage: firstFilled(valueFrom(checklist, ["toChainage", "toSection", "to", "endChainage"]), relatedProcess?.toChainage, relatedProcess?.toSection),
    side: firstFilled(valueFrom(checklist, ["side"]), findChecklistAnswer(checklist, ["צד"])),
    sampleLocation: location,
    area: firstFilled(valueFrom(checklist, ["area", "quantity", "surfaceArea"]), findChecklistAnswer(checklist, ["שטח"])),
    layerNo: firstFilled(valueFrom(checklist, ["layerNo", "layer", "layerNumber"]), findChecklistAnswer(checklist, ["שכבה"])),
    layerThickness: firstFilled(valueFrom(checklist, ["layerThickness", "thickness"]), findChecklistAnswer(checklist, ["עובי"])),
    workType,
    materialDescription: firstFilled(valueFrom(checklist, ["materialDescription", "material", "materialType"]), findChecklistAnswer(checklist, ["תאור החומר", "תיאור החומר", "חומר"])),
    materialClass: firstFilled(valueFrom(checklist, ["materialClass", "materialClassification", "aashto"]), findChecklistAnswer(checklist, ["מיון", "AASHTO"])),
    materialSource: firstFilled(valueFrom(checklist, ["materialSource", "source"]), findChecklistAnswer(checklist, ["מקור"])),
    regularCompactionCertificate: firstFilled(valueFrom(checklist, ["regularCompactionCertificate", "regularCompactionCertificateNo"]), findChecklistAnswer(checklist, ["תעודת בדיקההידוק", "הידוק רגיל"])),
    rollerPasses: firstFilled(valueFrom(checklist, ["rollerPasses", "passes"]), findChecklistAnswer(checklist, ["מעברי מכבש"])),
    rollerStatus: resolveOkNc(findChecklistAnswer(checklist, ["מעברי מכבש", "הידוק רגיל"]), checklist?.status),
    fieldDensityCertificate: firstFilled(valueFrom(checklist, ["fieldDensityCertificate", "densityCertificate", "certificateNo", "labCertificateNo"]), findChecklistAnswer(checklist, ["תעודת בדיקה צפיפות", "רטיבות שדה", "מספר תעודה", "מס' תעודה"])),
    nuclearGaugePoints: firstFilled(valueFrom(checklist, ["nuclearGaugePoints", "densityPoints", "testPoints"]), findChecklistAnswer(checklist, ["מד גרעיני", "נקודות בדיקה", "צפיפות"])),
    nuclearGaugeStatus: resolveOkNc(findChecklistAnswer(checklist, ["צפיפות", "רטיבות", "מד גרעיני"]), checklist?.status),
    sandConeBatch: firstFilled(valueFrom(checklist, ["sandConeBatch", "sandConePoints"]), findChecklistAnswer(checklist, ["חרוט חול", "שלבי"])),
    sandConeStatus: resolveOkNc(findChecklistAnswer(checklist, ["חרוט חול", "שלבי"]), checklist?.status),
    measurementCount: firstFilled(valueFrom(checklist, ["measurementCount", "measurements"]), findChecklistAnswer(checklist, ["מדידה", "רשימת מדידה"])),
    measurementStatus: resolveOkNc(findChecklistAnswer(checklist, ["מדידה", "גבהים", "חתכים", "עובי"]), checklist?.status),
  };
};

const densityTableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", tableLayout: "fixed", direction: "rtl", fontSize: 12 };
const densityCellStyle: React.CSSProperties = { border: "1px solid #94a3b8", padding: "6px 8px", verticalAlign: "middle", textAlign: "center", minWidth: 96, overflowWrap: "break-word" };
const densityHeaderStyle: React.CSSProperties = { ...densityCellStyle, background: "#d9ead3", fontWeight: 900 };
const densityHintStyle: React.CSSProperties = { ...densityCellStyle, background: "#f8fafc", color: "#475569", fontWeight: 800 };

export function ControlProcessesSection({ guardedBody, currentProjectId, processes, setProcesses, projectChecklists = [], projectRFIs = [], projectNonconformances = [] }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ processNo: "", workType: "", specSection: "", location: "", fromChainage: "", toChainage: "", status: "טיוטה" });

  const projectProcesses = useMemo(() => processes.filter((p) => !currentProjectId || p.projectId === currentProjectId), [processes, currentProjectId]);
  const densityReportRows = useMemo(() => {
    const projectChecklistRows = projectChecklists.filter((checklist: any) => !currentProjectId || checklist.projectId === currentProjectId || checklist.project_id === currentProjectId);
    const densityChecklists = projectChecklistRows.filter(isDensityChecklist);
    const sourceRows = densityChecklists.length ? densityChecklists : projectChecklistRows;
    return sourceRows.map((checklist: any, index: number) => {
      const relatedProcess = projectProcesses.find((process: any) =>
        (Array.isArray(process.checklistIds) && process.checklistIds.includes(checklist.id)) ||
        (process.location && checklist.location && process.location === checklist.location) ||
        (process.workType && checklist.category && normalizeLoose(process.workType).includes(normalizeLoose(checklist.category)))
      );
      return buildDensityReportRow(checklist, index, relatedProcess);
    });
  }, [projectChecklists, currentProjectId, projectProcesses]);
  const setField = (key: string, value: string) => setForm((prev: any) => ({ ...prev, [key]: value }));

  const reset = () => { setEditingId(null); setForm({ processNo: "", workType: "", specSection: "", location: "", fromChainage: "", toChainage: "", status: "טיוטה" }); };

  const save = () => {
    if (!currentProjectId) { alert("יש לבחור פרויקט לפני פתיחת תהליך בקרה."); return; }
    if (!String(form.workType || "").trim() || !String(form.location || "").trim()) { alert("יש למלא לפחות סוג עבודה ומיקום."); return; }
    const now = new Date().toISOString();
    const next = {
      id: editingId || crypto.randomUUID(),
      projectId: currentProjectId,
      processNo: form.processNo || `CP-${projectProcesses.length + 1}`,
      workType: form.workType || "",
      specSection: form.specSection || "",
      location: form.location || "",
      fromChainage: form.fromChainage || "",
      toChainage: form.toChainage || "",
      checklistIds: form.checklistIds || [],
      rfiIds: form.rfiIds || [],
      nonconformanceIds: form.nonconformanceIds || [],
      requiredDocuments: form.requiredDocuments || defaultRequiredDocuments.map((doc, index) => ({ id: `${index + 1}`, type: doc.type, required: doc.required, attached: false })),
      status: form.status || "טיוטה",
      createdAt: form.createdAt || now,
      updatedAt: now,
    } as ControlProcess;
    setProcesses((prev) => editingId ? prev.map((p) => p.id === editingId ? next : p) : [next, ...prev]);
    reset();
  };

  const approve = (process: ControlProcess) => {
    const missing = ((process as any).requiredDocuments || []).filter((doc: any) => doc.required && !doc.attached);
    if (missing.length) { alert(`לא ניתן לאשר. חסרים מסמכי חובה: ${missing.map((d: any) => d.type).join(", ")}`); return; }
    setProcesses((prev) => prev.map((p) => p.id === process.id ? { ...p, status: "מאושר", updatedAt: new Date().toISOString() } : p));
  };

  const lock = (process: ControlProcess) => {
    if ((process as any).status !== "מאושר") { alert("ניתן לנעול רק תהליך שאושר."); return; }
    setProcesses((prev) => prev.map((p) => p.id === process.id ? { ...p, status: "נעול", updatedAt: new Date().toISOString() } : p));
  };

  if (guardedBody) return <>{guardedBody}</>;

  return <div>
    <h2 style={styles.sectionTitle}>תהליכי בקרה</h2>
    <div style={{ ...styles.rowCard, background: "#eff6ff", borderColor: "#bfdbfe" }}>
      <div style={{ fontWeight: 900, color: "#1e3a8a" }}>מרכז ניהול תהליך בקרה לפי דרישות נת״י</div>
      <div style={{ color: "#334155", marginTop: 6 }}>כאן מחברים מיקום, סוג עבודה, סעיף מפרט, רשימות תיוג, RFI, אי־התאמות ומסמכי חובה לתהליך אחד.</div>
    </div>

    <div style={{ ...styles.rowCard, marginTop: 14, overflowX: "auto", borderColor: "#86efac", background: "#f0fdf4" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 950, color: "#14532d" }}>ריכוז בדיקות שדה — עבודות עפר / מצעים</div>
          <div style={{ color: "#334155", marginTop: 4 }}>מבנה הכותרות נלקח משורות 6–9 בקובץ הדוגמה של כביש 807. הנתונים נאספים אוטומטית מרשימות התיוג של הפרויקט.</div>
        </div>
        <div style={{ color: "#166534", fontWeight: 900 }}>סה״כ רשומות: {densityReportRows.length}</div>
      </div>
      <table style={densityTableStyle}>
        <thead>
          <tr>{densityReportColumns.map((column) => <th key={column.key} style={densityHeaderStyle}>{column.title}</th>)}</tr>
          <tr>{densityReportColumns.map((column) => <th key={`${column.key}-hint`} style={densityHintStyle}>{column.hint || "—"}</th>)}</tr>
        </thead>
        <tbody>
          {densityReportRows.length === 0 ? <tr><td colSpan={densityReportColumns.length} style={{ ...densityCellStyle, background: "#fff" }}>אין עדיין רשימות תיוג מתאימות לריכוז צפיפות בפרויקט.</td></tr> : densityReportRows.map((row: any, rowIndex: number) => <tr key={`density-${rowIndex}`}>
            {densityReportColumns.map((column) => <td key={column.key} style={{ ...densityCellStyle, background: rowIndex % 2 ? "#f8fafc" : "#fff" }}>{normalizeText(row[column.key]) || ""}</td>)}
          </tr>)}
        </tbody>
      </table>
    </div>

    <div style={styles.formGrid}>
      <Field label="מספר תהליך"><input style={styles.input} value={form.processNo || ""} onChange={(e) => setField("processNo", e.target.value)} /></Field>
      <Field label="סוג עבודה"><input style={styles.input} value={form.workType || ""} onChange={(e) => setField("workType", e.target.value)} placeholder="לדוגמה: מצע א׳ / אספלט / ניקוז" /></Field>
      <Field label="סעיף מפרט"><input style={styles.input} value={form.specSection || ""} onChange={(e) => setField("specSection", e.target.value)} placeholder="לדוגמה: 51.04.02" /></Field>
      <Field label="מיקום / קטע"><input style={styles.input} value={form.location || ""} onChange={(e) => setField("location", e.target.value)} /></Field>
      <Field label="מחתך"><input style={styles.input} value={form.fromChainage || ""} onChange={(e) => setField("fromChainage", e.target.value)} /></Field>
      <Field label="עד חתך"><input style={styles.input} value={form.toChainage || ""} onChange={(e) => setField("toChainage", e.target.value)} /></Field>
      <Field label="סטטוס"><select style={styles.input} value={form.status || "טיוטה"} onChange={(e) => setField("status", e.target.value)}><option>טיוטה</option><option>בביצוע</option><option>ממתין לאישור</option><option>מאושר</option><option>נדחה</option><option>נעול</option></select></Field>
    </div>
    <div style={styles.buttonRow}><button style={styles.primaryBtn} onClick={save}>{editingId ? "עדכן תהליך" : "פתח תהליך בקרה"}</button><button style={styles.secondaryBtn} onClick={reset}>נקה</button></div>
    <div style={{ ...styles.cardGrid, marginTop: 18 }}>
      {projectProcesses.length === 0 ? <div style={styles.emptyBox}>אין עדיין תהליכי בקרה בפרויקט.</div> : projectProcesses.map((p: any) => {
        const linkedChecklists = projectChecklists.filter((c: any) => c.controlProcessId === p.id || c.location === p.location);
        const linkedRFIs = projectRFIs.filter((r: any) => r.controlProcessId === p.id || r.location === p.location);
        const linkedNcr = projectNonconformances.filter((n: any) => n.controlProcessId === p.id || n.location === p.location);
        return <div key={p.id} style={styles.recordCard}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div style={{ fontWeight: 900 }}>{p.processNo} · {p.workType}</div><span style={{ background: p.status === "נעול" ? "#e2e8f0" : "#dcfce7", color: "#166534", padding: "4px 10px", borderRadius: 999 }}>{p.status}</span></div>
          <div style={{ color: "#475569", marginTop: 8 }}>מיקום: {p.location || "-"} · סעיף מפרט: {p.specSection || "-"}</div>
          <div style={{ color: "#475569", marginTop: 4 }}>רשימות: {linkedChecklists.length} · RFI: {linkedRFIs.length} · אי־התאמות: {linkedNcr.length}</div>
          <div style={{ marginTop: 8, fontWeight: 800 }}>מסמכי חובה</div>
          <ul>{(p.requiredDocuments || []).map((doc: any) => <li key={doc.id}>{doc.attached ? "✅" : doc.required ? "❌" : "▫️"} {doc.type}{doc.required ? " — חובה" : ""}</li>)}</ul>
          <div style={styles.buttonRow}><button style={styles.secondaryBtn} onClick={() => { setEditingId(p.id); setForm(p); }}>פתח / ערוך</button><button style={styles.primaryBtn} onClick={() => approve(p)}>אשר</button><button style={styles.secondaryBtn} onClick={() => lock(p)}>נעל</button></div>
        </div>;
      })}
    </div>
  </div>;
}
