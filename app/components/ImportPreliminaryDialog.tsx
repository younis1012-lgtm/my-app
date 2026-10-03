"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

type Tab = "suppliers" | "subcontractors" | "materials";
type Rec = Record<string, any>;

const TAB_LABEL: Record<Tab, string> = { subcontractors: "קבלני משנה", suppliers: "ספקים", materials: "חומרים" };
const NAME_LABEL: Record<Tab, string> = { subcontractors: "קבלן משנה", suppliers: "ספק", materials: "חומר" };
const DETAIL_LABEL: Record<Tab, string> = { subcontractors: "תחום", suppliers: "מוצר / חומר", materials: "מקור / שימוש" };

export const preliminaryNested = (record: Rec): Rec => {
  const key = record?.subtype === "suppliers" ? "supplier" : record?.subtype === "subcontractors" ? "subcontractor" : "material";
  return (record?.[key] && typeof record[key] === "object" ? record[key] : {}) as Rec;
};
export const preliminaryName = (record: Rec) => {
  const data = preliminaryNested(record);
  return String(data.supplierName ?? data.subcontractorName ?? data.materialName ?? "").trim();
};
const preliminaryDetail = (record: Rec) => {
  const data = preliminaryNested(record);
  if (record.subtype === "suppliers") return String(data.suppliedMaterial ?? "").trim();
  if (record.subtype === "subcontractors") return String(data.field ?? "").trim();
  return [data.source, data.usage].map((x) => String(x ?? "").trim()).filter(Boolean).join(" · ");
};
const normalizeName = (value: string) => value.replace(/["'׳״`]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const isApproved = (record: Rec) => {
  const status = String(record?.approval?.status ?? "").toLowerCase();
  return status === "approved" || String(record?.status ?? "").includes("מאושר");
};
const approvedAt = (record: Rec) => {
  const signatures: any[] = Array.isArray(record?.approval?.signatures) ? record.approval.signatures : [];
  const dates = signatures.map((s) => String(s?.signedAt ?? "")).filter(Boolean).sort();
  return dates[dates.length - 1] ?? "";
};
const formatDate = (value: string) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("he-IL");
};
const certificateRows = (record: Rec): any[] => {
  const data = preliminaryNested(record);
  if (Array.isArray(data.certificates)) return data.certificates;
  if (Array.isArray(record.certificates)) return record.certificates;
  return [];
};
const expiryState = (record: Rec) => {
  const now = Date.now();
  let expired = 0;
  let soon = 0;
  let firstExpiry = "";
  for (const row of certificateRows(record)) {
    const value = String(row?.expiryDate ?? row?.validUntil ?? "").trim();
    if (!value) continue;
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) continue;
    if (time < now) {
      expired += 1;
      firstExpiry = firstExpiry || value;
    } else if (time - now < 30 * 86400000) {
      soon += 1;
      firstExpiry = firstExpiry || value;
    }
  }
  return { expired, soon, firstExpiry };
};

// ייבוא רשומות בקרה מקדימה (קבלנים / ספקים / חומרים) מפרויקט אחר שהמשתמש משויך אליו.
// הרשומות נכנסות כטיוטה – אישור בפרויקט אחד אינו אישור בפרויקט אחר.
export function ImportPreliminaryDialog({
  projects,
  initialTab,
  currentProjectName,
  existingRecords,
  loadRecords,
  onImport,
  onClose,
}: {
  projects: Array<{ id: string; name: string }>;
  initialTab: Tab;
  currentProjectName: string;
  existingRecords: Rec[];
  loadRecords: (projectId: string) => Promise<Rec[]>;
  onImport: (records: Rec[], sourceProject: { id: string; name: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [records, setRecords] = useState<Rec[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error" | "importing">("idle");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setState("loading");
    setError("");
    setSelected(new Set());
    loadRecords(projectId)
      .then((rows) => {
        if (!active) return;
        setRecords(rows);
        setState("idle");
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "טעינת הרשומות נכשלה");
        setState("error");
      });
    return () => {
      active = false;
    };
  }, [projectId, loadRecords]);

  const existing = useMemo(() => {
    const map = new Map<string, Rec>();
    for (const record of existingRecords) {
      const name = normalizeName(preliminaryName(record));
      if (name) map.set(`${record.subtype}:${name}`, record);
    }
    return map;
  }, [existingRecords]);

  const counts = useMemo(() => {
    const result: Record<Tab, number> = { subcontractors: 0, suppliers: 0, materials: 0 };
    for (const record of records) if (record.subtype in result) result[record.subtype as Tab] += 1;
    return result;
  }, [records]);

  const term = normalizeName(search);
  const visible = records
    .filter((record) => record.subtype === tab)
    .filter((record) => !term || normalizeName(`${preliminaryName(record)} ${preliminaryDetail(record)} ${record.title ?? ""}`).includes(term));
  const chosen = records.filter((record) => selected.has(record.id));
  const source = projects.find((project) => project.id === projectId);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = async () => {
    if (!chosen.length || !source) return;
    setState("importing");
    try {
      await onImport(chosen, source);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "הייבוא נכשל");
      setState("idle");
    }
  };

  const chip = (text: string, tone: "ok" | "warn" | "bad" | "gray" | "blue") => {
    const colors = { ok: ["#ecf8f0", "#15803d"], warn: ["#fff5e0", "#9a5b00"], bad: ["#fdecea", "#b42318"], gray: ["#eef1f5", "#55657d"], blue: ["#eef3fa", "#2f5d93"] }[tone];
    return <span style={{ display: "inline-block", borderRadius: 999, padding: "2px 9px", fontSize: 12, fontWeight: 700, background: colors[0], color: colors[1], whiteSpace: "nowrap" }}>{text}</span>;
  };
  const input: CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #c9d2df", borderRadius: 10, padding: "8px 11px", fontSize: 14, background: "#fff" };
  const label: CSSProperties = { display: "grid", gap: 4, fontSize: 12, fontWeight: 700, color: "#55657d" };
  const th: CSSProperties = { textAlign: "right", color: "#55657d", fontWeight: 700, background: "#f8fafc", padding: "8px 10px", borderBottom: "1px solid #dde3ec", whiteSpace: "nowrap" };
  const td: CSSProperties = { padding: 10, borderBottom: "1px solid #eef1f5", verticalAlign: "top" };
  const btn: CSSProperties = { height: 36, padding: "0 14px", borderRadius: 10, border: "1px solid #c9d2df", background: "#fff", color: "#0b1f3a", fontWeight: 700, cursor: "pointer" };

  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(11,31,58,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div dir="rtl" onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 20, width: "min(920px, 96vw)", maxHeight: "92vh", overflowY: "auto", display: "grid", gap: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#0b1f3a" }}>ייבוא בקרה מקדימה לפרויקט: {currentProjectName}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label style={label}>
            מפרויקט
            <select style={input} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label style={label}>
            חיפוש
            <input style={input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`שם ${NAME_LABEL[tab]}…`} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 18, borderBottom: "1px solid #eef1f5" }}>
          {(["subcontractors", "suppliers", "materials"] as Tab[]).map((key) => (
            <button key={key} type="button" onClick={() => setTab(key)} style={{ border: 0, background: "transparent", padding: "8px 2px", cursor: "pointer", fontWeight: 700, fontSize: 14, color: tab === key ? "#0b1f3a" : "#55657d", borderBottom: tab === key ? "3px solid #0b1f3a" : "3px solid transparent" }}>
              {TAB_LABEL[key]} ({counts[key]})
            </button>
          ))}
        </div>
        {state === "loading" ? <div style={{ color: "#55657d" }}>טוען רשומות…</div> : null}
        {state === "error" ? <div style={{ color: "#b42318" }}>{error}</div> : null}
        {state !== "loading" && state !== "error" ? (
          visible.length ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 30 }} />
                    <th style={th}>{NAME_LABEL[tab]}</th>
                    <th style={th}>{DETAIL_LABEL[tab]}</th>
                    <th style={th}>סטטוס במקור</th>
                    <th style={th}>תעודות</th>
                    <th style={th}>בפרויקט הנוכחי</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((record) => {
                    const name = preliminaryName(record);
                    const duplicate = existing.get(`${record.subtype}:${normalizeName(name)}`);
                    const certs = certificateRows(record);
                    const expiry = expiryState(record);
                    const approved = isApproved(record);
                    const signedAt = approvedAt(record);
                    return (
                      <tr key={record.id} onClick={() => toggle(record.id)} style={{ cursor: "pointer", background: selected.has(record.id) ? "#f2f7fd" : undefined }}>
                        <td style={td}><input type="checkbox" checked={selected.has(record.id)} onChange={() => toggle(record.id)} onClick={(e) => e.stopPropagation()} /></td>
                        <td style={td}><b>{name || "—"}</b><div style={{ fontSize: 12, color: "#55657d" }}>{record.title}</div></td>
                        <td style={td}>{preliminaryDetail(record) || "—"}</td>
                        <td style={td}>{approved ? chip(signedAt ? `אושר ${formatDate(signedAt)}` : "אושר", "ok") : chip(String(record.status || "טיוטה"), "gray")}</td>
                        <td style={td}>
                          {certs.length || "—"}{" "}
                          {expiry.expired ? chip(`פג תוקף ${formatDate(expiry.firstExpiry)}`, "bad") : expiry.soon ? chip(`יפוג ${formatDate(expiry.firstExpiry)}`, "warn") : null}
                        </td>
                        <td style={td}>{duplicate ? chip(`כבר קיים – ${duplicate.title || ""}`, "blue") : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: "#55657d", background: "#f8fafc", borderRadius: 10, padding: "10px 12px" }}>אין {TAB_LABEL[tab]} בפרויקט הזה{term ? " שמתאימים לחיפוש" : ""}.</div>
          )
        ) : null}
        <div style={{ fontSize: 13, color: "#9a5b00", background: "#fff5e0", borderRadius: 10, padding: "9px 12px" }}>
          {chosen.length ? `${chosen.length} רשומות ייובאו` : "הרשומות ייובאו"} כ<b>טיוטה</b> עם כל הפרטים והתעודות. החתימות לא מועברות – יש לבדוק ולאשר בפרויקט הנוכחי. מקור הרשומה יתועד.
        </div>
        {error && state !== "error" ? <div style={{ color: "#b42318", fontSize: 13 }}>{error}</div> : null}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" disabled={!chosen.length || state === "importing"} onClick={() => void run()} style={{ ...btn, border: 0, background: "#0b1f3a", color: "#fff", opacity: !chosen.length || state === "importing" ? 0.5 : 1 }}>
            {state === "importing" ? "מייבא…" : `ייבוא ${chosen.length || ""} רשומות`}
          </button>
          <button type="button" style={btn} onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}
