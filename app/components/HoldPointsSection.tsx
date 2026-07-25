"use client";

import { useMemo, useState } from "react";

export type HoldPointRecord = {
  id: string;
  projectId: string;
  serialNo: number;
  referenceNo: string;
  name: string;
  structureNodeId: string;
  element: string;
  checklistIds: string[];
  nonconformanceIds: string[];
  trialSectionIds: string[];
  documents: Array<{
    id: string;
    name: string;
    type: string;
    dataUrl: string;
    uploadedAt: string;
  }>;
  qcCompany: string;
  qaCompany: string;
  notes: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  releasedAt: string;
};

type LinkedRecord = {
  id: string;
  title?: string;
  checklistNo?: number;
  location?: string;
  status?: string;
  approval?: { status?: string };
  [key: string]: any;
};

type StructureNode = {
  id: string;
  name: string;
  code?: string;
  nodeType?: string;
  parentId?: string;
};

type Props = {
  records: HoldPointRecord[];
  checklists: LinkedRecord[];
  nonconformances: LinkedRecord[];
  trialSections: LinkedRecord[];
  structureNodes: StructureNode[];
  currentUserName: string;
  canWrite: boolean;
  onSave: (record: HoldPointRecord) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  projectId: string;
};

const card: React.CSSProperties = {
  border: "1px solid #dbe3ef",
  borderRadius: 16,
  background: "#fff",
  padding: 16,
};

const input: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "10px 12px",
  background: "#fff",
  minHeight: 42,
  boxSizing: "border-box",
};

const primary: React.CSSProperties = {
  border: 0,
  borderRadius: 10,
  background: "#0f172a",
  color: "#fff",
  padding: "10px 16px",
  fontWeight: 900,
  cursor: "pointer",
};

const secondary: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  background: "#fff",
  color: "#0f172a",
  padding: "9px 14px",
  fontWeight: 850,
  cursor: "pointer",
};

const emptyDraft = (projectId: string, serialNo: number, userName: string): HoldPointRecord => ({
  id: "",
  projectId,
  serialNo,
  referenceNo: "",
  name: "",
  structureNodeId: "",
  element: "",
  checklistIds: [],
  nonconformanceIds: [],
  trialSectionIds: [],
  documents: [],
  qcCompany: "",
  qaCompany: "",
  notes: "",
  status: "נוצרה, לא הושלמה",
  createdBy: userName,
  createdAt: "",
  updatedAt: "",
  releasedAt: "",
});

const recordLabel = (record: LinkedRecord, kind: "checklist" | "ncr" | "trial") => {
  const prefix =
    kind === "checklist" && record.checklistNo
      ? `רשימה ${record.checklistNo} · `
      : "";
  return `${prefix}${record.title || record.name || record.location || record.id}`;
};

const checklistComplete = (record?: LinkedRecord) =>
  String(record?.approval?.status || record?.status || "").toLowerCase().includes("approved") ||
  ["מאושר", "הושלם", "סגור"].some((value) =>
    String(record?.status || "").includes(value),
  );

const ncrClosed = (record?: LinkedRecord) =>
  ["נסגר", "סגור", "closed"].some((value) =>
    String(record?.status || "").toLowerCase().includes(value.toLowerCase()),
  );

function Selector({
  title,
  records,
  selectedIds,
  kind,
  onChange,
}: {
  title: string;
  records: LinkedRecord[];
  selectedIds: string[];
  kind: "checklist" | "ncr" | "trial";
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = records.filter((record) =>
    recordLabel(record, kind).toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div style={{ ...card, padding: 12, background: "#f8fafc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <strong>{title}</strong>
        <span style={{ color: "#475569", fontWeight: 800 }}>{selectedIds.length} נבחרו</span>
      </div>
      <input
        style={{ ...input, marginTop: 8 }}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="חיפוש..."
      />
      <div style={{ maxHeight: 190, overflow: "auto", marginTop: 8, display: "grid", gap: 6 }}>
        {filtered.length ? filtered.map((record) => {
          const checked = selectedIds.includes(record.id);
          return (
            <label
              key={record.id}
              style={{
                display: "flex",
                gap: 8,
                padding: 9,
                border: "1px solid #dbe3ef",
                borderRadius: 9,
                background: checked ? "#eef6ff" : "#fff",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) =>
                  onChange(
                    event.currentTarget.checked
                      ? Array.from(new Set([...selectedIds, record.id]))
                      : selectedIds.filter((id) => id !== record.id),
                  )
                }
              />
              <span>
                <strong>{recordLabel(record, kind)}</strong>
                <small style={{ display: "block", color: "#64748b", marginTop: 2 }}>
                  {record.location || "ללא מיקום"} · {record.status || record.approval?.status || "ללא סטטוס"}
                </small>
              </span>
            </label>
          );
        }) : <div style={{ color: "#64748b", padding: 8 }}>לא נמצאו רשומות בפרויקט.</div>}
      </div>
    </div>
  );
}

export function HoldPointsSection({
  records,
  checklists,
  nonconformances,
  trialSections,
  structureNodes,
  currentUserName,
  canWrite,
  onSave,
  onDelete,
  projectId,
}: Props) {
  const nextSerial = Math.max(0, ...records.map((record) => Number(record.serialNo) || 0)) + 1;
  const [draft, setDraft] = useState<HoldPointRecord>(() => emptyDraft(projectId, nextSerial, currentUserName));
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState("");
  const [filter, setFilter] = useState("");

  const update = <K extends keyof HoldPointRecord>(key: K, value: HoldPointRecord[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const selectedChecklists = checklists.filter((record) => draft.checklistIds.includes(record.id));
  const selectedNcrs = nonconformances.filter((record) => draft.nonconformanceIds.includes(record.id));
  const readiness = {
    checklists: selectedChecklists.length > 0 && selectedChecklists.every(checklistComplete),
    ncrs: selectedNcrs.every(ncrClosed),
  };
  const readyToRelease = readiness.checklists && readiness.ncrs;
  const recordsForElement = (items: LinkedRecord[]) => {
    if (!draft.structureNodeId && !draft.element.trim()) return items;
    const elementName = draft.element.trim().toLowerCase();
    const related = items.filter((record) => {
      if (
        draft.structureNodeId &&
        [record.structureNodeId, record.structure_node_id].includes(draft.structureNodeId)
      )
        return true;
      if (!elementName) return false;
      return [record.location, record.element, record.roadStructure, record.title]
        .some((value) => String(value || "").toLowerCase().includes(elementName));
    });
    const relatedIds = new Set(related.map((record) => record.id));
    return [...related, ...items.filter((record) => !relatedIds.has(record.id))];
  };

  const filteredRecords = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) =>
      [
        record.serialNo,
        record.referenceNo,
        record.name,
        record.element,
        record.status,
        record.createdBy,
      ].some((value) => String(value || "").toLowerCase().includes(query)),
    );
  }, [filter, records]);

  const reset = () => {
    setDraft(emptyDraft(projectId, nextSerial, currentUserName));
    setShowForm(false);
  };

  const save = async () => {
    if (!draft.name.trim()) return alert("יש להזין שם לנקודת העצירה.");
    if (!draft.structureNodeId && !draft.element.trim())
      return alert("יש לבחור אלמנט מעץ הפרויקט או להזין תיאור אלמנט.");
    if (!draft.checklistIds.length)
      return alert("יש לשייך לפחות רשימת תיוג אחת לנקודת העצירה.");
    const now = new Date().toISOString();
    await onSave({
      ...draft,
      id: draft.id || crypto.randomUUID(),
      projectId,
      serialNo: draft.serialNo || nextSerial,
      createdBy: draft.createdBy || currentUserName,
      createdAt: draft.createdAt || now,
      updatedAt: now,
    });
    reset();
  };

  const release = async () => {
    if (!readyToRelease)
      return alert("לא ניתן לשחרר: יש להשלים ולאשר את רשימות התיוג ולסגור את אי־ההתאמות המקושרות.");
    const now = new Date().toISOString();
    await onSave({ ...draft, status: "שוחררה", releasedAt: now, updatedAt: now });
    reset();
  };

  return (
    <div dir="rtl" style={{ display: "grid", gap: 14 }}>
      <section style={{ ...card, background: "linear-gradient(135deg,#0f172a,#1e3a5f)", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0 }}>⛔ נקודות עצירה</h2>
            <p style={{ margin: "6px 0 0", color: "#cbd5e1" }}>
              יצירה, שיוך ומעקב אחר רשימות תיוג, אי־התאמות, קטעי ניסוי ומסמכים לפי אלמנט בפרויקט.
            </p>
          </div>
          <button
            type="button"
            style={{ ...primary, background: "#fff", color: "#0f172a" }}
            disabled={!canWrite}
            onClick={() => {
              setDraft(emptyDraft(projectId, nextSerial, currentUserName));
              setShowForm(true);
            }}
          >
            + נקודת עצירה חדשה
          </button>
        </div>
      </section>

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0 }}>מעקב נקודות עצירה</h3>
            <span style={{ color: "#64748b" }}>{records.length} נקודות בפרויקט</span>
          </div>
          <input style={{ ...input, width: 300 }} value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="חיפוש לפי שם, אלמנט או סטטוס" />
        </div>
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1150 }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                {["מס׳", "שם", "אלמנט", "רשימות תיוג", "אי־התאמות", "קטעי ניסוי", "מסמכים", "סטטוס", "נוצר/עודכן", "פעולות"].map((label) => (
                  <th key={label} style={{ padding: 10, textAlign: "right", borderBottom: "1px solid #cbd5e1", whiteSpace: "nowrap" }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => {
                const linkedChecks = checklists.filter((item) => record.checklistIds.includes(item.id));
                const linkedNcrs = nonconformances.filter((item) => record.nonconformanceIds.includes(item.id));
                const completeChecks = linkedChecks.filter(checklistComplete).length;
                const closedNcrs = linkedNcrs.filter(ncrClosed).length;
                const expanded = expandedId === record.id;
                return [
                  <tr key={record.id}>
                    <td style={{ padding: 10, borderBottom: "1px solid #e2e8f0", fontWeight: 900 }}>{record.serialNo}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}><strong>{record.name}</strong><small style={{ display: "block", color: "#64748b" }}>{record.referenceNo}</small></td>
                    <td style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>{record.element || structureNodes.find((node) => node.id === record.structureNodeId)?.name || "—"}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>{completeChecks}/{linkedChecks.length}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>{closedNcrs}/{linkedNcrs.length}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>{record.trialSectionIds.length}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>{record.documents.length}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}><span style={{ borderRadius: 999, padding: "4px 9px", fontWeight: 900, background: record.status === "שוחררה" ? "#dcfce7" : "#fff7ed", color: record.status === "שוחררה" ? "#166534" : "#9a3412" }}>{record.status}</span></td>
                    <td style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}><small>{record.createdBy || "—"}<br />{record.updatedAt ? new Date(record.updatedAt).toLocaleDateString("he-IL") : "—"}</small></td>
                    <td style={{ padding: 10, borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
                      <button style={secondary} onClick={() => setExpandedId(expanded ? "" : record.id)}>{expanded ? "סגור" : "פתח"}</button>{" "}
                      <button style={secondary} disabled={!canWrite} onClick={() => { setDraft(record); setShowForm(true); }}>ערוך</button>{" "}
                      <button style={{ ...secondary, color: "#b91c1c" }} disabled={!canWrite} onClick={() => { if (confirm("למחוק את נקודת העצירה?")) void onDelete(record.id); }}>מחק</button>
                    </td>
                  </tr>,
                  expanded ? (
                    <tr key={`${record.id}-details`}>
                      <td colSpan={10} style={{ padding: 14, background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 12 }}>
                          <div><strong>רשימות תיוג מקושרות</strong>{linkedChecks.map((item) => <div key={item.id}>• {recordLabel(item, "checklist")} — {checklistComplete(item) ? "✅ הושלמה" : "⏳ ממתינה"}</div>)}</div>
                          <div><strong>אי־התאמות מקושרות</strong>{linkedNcrs.length ? linkedNcrs.map((item) => <div key={item.id}>• {recordLabel(item, "ncr")} — {ncrClosed(item) ? "✅ נסגרה" : "⚠️ פתוחה"}</div>) : <div>אין אי־התאמות מקושרות</div>}</div>
                          <div><strong>הערות ומסמכים</strong><div>{record.notes || "אין הערות"}</div>{record.documents.map((document) => <div key={document.id}><a href={document.dataUrl} download={document.name}>{document.name}</a></div>)}</div>
                        </div>
                      </td>
                    </tr>
                  ) : null,
                ];
              })}
              {!filteredRecords.length && <tr><td colSpan={10} style={{ textAlign: "center", padding: 24, color: "#64748b" }}>עדיין לא נוצרו נקודות עצירה בפרויקט.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && (
        <section style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div><h3 style={{ margin: 0 }}>{draft.id ? "עריכת נקודת עצירה" : "יצירת נקודת עצירה"}</h3><p style={{ margin: "5px 0", color: "#64748b" }}>בחר אלמנט ושייך אליו את הרשומות הרלוונטיות.</p></div>
            <button style={secondary} onClick={reset}>סגור</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 12 }}>
            <label><strong>מספר ייחוס</strong><input style={input} value={draft.referenceNo} onChange={(event) => update("referenceNo", event.target.value)} /></label>
            <label><strong>שם נקודת העצירה *</strong><input style={input} value={draft.name} onChange={(event) => update("name", event.target.value)} /></label>
            <label><strong>אלמנט מעץ הפרויקט *</strong><select style={input} value={draft.structureNodeId} onChange={(event) => { const node = structureNodes.find((item) => item.id === event.target.value); setDraft((current) => ({ ...current, structureNodeId: event.target.value, element: node?.name || current.element })); }}><option value="">בחר אלמנט</option>{structureNodes.map((node) => <option key={node.id} value={node.id}>{node.code ? `${node.code} · ` : ""}{node.name}</option>)}</select></label>
            <label><strong>תיאור אלמנט / מבנה</strong><input style={input} value={draft.element} onChange={(event) => update("element", event.target.value)} /></label>
            <label><strong>חברת בקרת איכות</strong><input style={input} value={draft.qcCompany} onChange={(event) => update("qcCompany", event.target.value)} /></label>
            <label><strong>חברת הבטחת איכות</strong><input style={input} value={draft.qaCompany} onChange={(event) => update("qaCompany", event.target.value)} /></label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12, marginTop: 14 }}>
            <Selector title="רשימות תיוג *" records={recordsForElement(checklists)} selectedIds={draft.checklistIds} kind="checklist" onChange={(ids) => update("checklistIds", ids)} />
            <Selector title="אי־התאמות הקשורות לאלמנט" records={recordsForElement(nonconformances)} selectedIds={draft.nonconformanceIds} kind="ncr" onChange={(ids) => update("nonconformanceIds", ids)} />
            <Selector title="קטעי ניסוי" records={recordsForElement(trialSections)} selectedIds={draft.trialSectionIds} kind="trial" onChange={(ids) => update("trialSectionIds", ids)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12, marginTop: 14 }}>
            <label><strong>מסמכים נוספים</strong><input style={input} type="file" multiple onChange={(event) => { const files = Array.from(event.currentTarget.files || []); files.forEach((file) => { const reader = new FileReader(); reader.onload = () => setDraft((current) => ({ ...current, documents: [...current.documents, { id: crypto.randomUUID(), name: file.name, type: file.type, dataUrl: String(reader.result || ""), uploadedAt: new Date().toISOString() }] })); reader.readAsDataURL(file); }); event.currentTarget.value = ""; }} />{draft.documents.map((document) => <div key={document.id} style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}><span>{document.name}</span><button type="button" style={{ border: 0, background: "transparent", color: "#b91c1c", cursor: "pointer" }} onClick={() => update("documents", draft.documents.filter((item) => item.id !== document.id))}>הסר</button></div>)}</label>
            <label><strong>הערות</strong><textarea style={{ ...input, minHeight: 105 }} value={draft.notes} onChange={(event) => update("notes", event.target.value)} /></label>
          </div>
          <div style={{ ...card, marginTop: 14, background: readyToRelease ? "#f0fdf4" : "#fff7ed", borderColor: readyToRelease ? "#86efac" : "#fdba74" }}>
            <strong>{readyToRelease ? "✅ נקודת העצירה מוכנה לשחרור" : "⏳ נקודת העצירה עדיין אינה מוכנה לשחרור"}</strong>
            <div style={{ marginTop: 5 }}>רשימות תיוג: {readiness.checklists ? "הושלמו ואושרו" : "נדרש להשלים ולאשר לפחות רשימה אחת"} · אי־התאמות: {readiness.ncrs ? "כולן סגורות" : "קיימות אי־התאמות פתוחות"}</div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button style={primary} disabled={!canWrite} onClick={() => void save()}>{draft.id ? "עדכן נקודת עצירה" : "שמור נקודת עצירה"}</button>
            {draft.id && draft.status !== "שוחררה" && <button style={{ ...primary, background: "#15803d" }} disabled={!canWrite || !readyToRelease} onClick={() => void release()}>שחרר נקודת עצירה</button>}
            <button style={secondary} onClick={reset}>בטל</button>
          </div>
        </section>
      )}
    </div>
  );
}
