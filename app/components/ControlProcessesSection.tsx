"use client";

import { useMemo, useState } from "react";
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

export function ControlProcessesSection({ guardedBody, currentProjectId, processes, setProcesses, projectChecklists = [], projectRFIs = [], projectNonconformances = [] }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ processNo: "", workType: "", specSection: "", location: "", fromChainage: "", toChainage: "", status: "טיוטה" });

  const projectProcesses = useMemo(() => processes.filter((p) => !currentProjectId || p.projectId === currentProjectId), [processes, currentProjectId]);
  const setField = (key: string, value: string) => setForm((prev: any) => ({ ...prev, [key]: value }));

  const reset = () => { setEditingId(null); setForm({ processNo: "", workType: "", specSection: "", location: "", fromChainage: "", toChainage: "", status: "טיוטה" }); };

  const save = () => {
    if (!currentProjectId) { alert("יש לבחור פרויקט לפני פתיחת תהליך בקרה."); return; }
    if (!String(form.workType || "").trim() || !String(form.location || "").trim()) { alert("יש למלא לפחות סוג עבודה ומיקום."); return; }
    const now = new Date().toISOString();
    const next: ControlProcess = {
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
    };
    setProcesses((prev) => editingId ? prev.map((p) => p.id === editingId ? next : p) : [next, ...prev]);
    reset();
  };

  const approve = (process: ControlProcess) => {
    const missing = (process.requiredDocuments || []).filter((doc: any) => doc.required && !doc.attached);
    if (missing.length) { alert(`לא ניתן לאשר. חסרים מסמכי חובה: ${missing.map((d: any) => d.type).join(", ")}`); return; }
    setProcesses((prev) => prev.map((p) => p.id === process.id ? { ...p, status: "מאושר", updatedAt: new Date().toISOString() } : p));
  };

  const lock = (process: ControlProcess) => {
    if (process.status !== "מאושר") { alert("ניתן לנעול רק תהליך שאושר."); return; }
    setProcesses((prev) => prev.map((p) => p.id === process.id ? { ...p, status: "נעול", updatedAt: new Date().toISOString() } : p));
  };

  if (guardedBody) return <>{guardedBody}</>;

  return <div>
    <h2 style={styles.sectionTitle}>תהליכי בקרה</h2>
    <div style={{ ...styles.rowCard, background: "#eff6ff", borderColor: "#bfdbfe" }}>
      <div style={{ fontWeight: 900, color: "#1e3a8a" }}>מרכז ניהול תהליך בקרה לפי דרישות נת״י</div>
      <div style={{ color: "#334155", marginTop: 6 }}>כאן מחברים מיקום, סוג עבודה, סעיף מפרט, רשימות תיוג, RFI, אי־התאמות ומסמכי חובה לתהליך אחד.</div>
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
      {projectProcesses.length === 0 ? <div style={styles.emptyBox}>אין עדיין תהליכי בקרה בפרויקט.</div> : projectProcesses.map((p) => {
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
