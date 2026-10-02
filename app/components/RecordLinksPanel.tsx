"use client";

import { useMemo, useState } from "react";
import { NavIcon } from "./NavIcon";

// קישור בין רשומות – פאנל אחיד בתחתית כל טופס במערכת.
// הקישור דו-כיווני: קישור שנוצר מרשומה אחת מופיע גם ברשומה המקושרת.

export type LinkType =
  | "checklists"
  | "nonconformances"
  | "trialSections"
  | "rfi"
  | "supervisionReports"
  | "holdPoints"
  | "preliminary"
  | "controlProcesses"
  | "plans"
  | "structure";

export type RecordLink = {
  id: string;
  projectId: string;
  aType: LinkType;
  aId: string;
  bType: LinkType;
  bId: string;
  createdAt?: string;
  createdBy?: string;
};

export type LinkCatalogItem = {
  type: LinkType;
  id: string;
  label: string;
  sub?: string;
  status?: string;
  date?: string;
  structureNodeId?: string;
};

// קישור שנובע משיוך קיים במערכת (נקודת עצירה, תעודת ייחוס, דוח פיקוח, שיוך ראשי לעץ)
export type ImplicitLink = { type: LinkType; id: string; note: string };

export const LINK_TYPES: Array<{ type: LinkType; label: string; icon: string }> = [
  { type: "structure", label: "עץ פרויקט", icon: "projectStructure" },
  { type: "checklists", label: "רשימות תיוג", icon: "checklists" },
  { type: "nonconformances", label: "אי התאמות", icon: "nonconformances" },
  { type: "trialSections", label: "קטעי ניסוי", icon: "trialSections" },
  { type: "rfi", label: "RFI", icon: "rfi" },
  { type: "supervisionReports", label: "דוחות פיקוח עליון", icon: "supervisionReports" },
  { type: "holdPoints", label: "נקודות עצירה", icon: "holdPoints" },
  { type: "preliminary", label: "בקרה מקדימה", icon: "preliminary" },
  { type: "controlProcesses", label: "תעודות ייחוס", icon: "controlProcesses" },
  { type: "plans", label: "תוכניות", icon: "plans" },
];

const typeLabel = (type: LinkType) => LINK_TYPES.find((item) => item.type === type)?.label ?? type;
const typeIcon = (type: LinkType) => LINK_TYPES.find((item) => item.type === type)?.icon ?? "home";

const statusTone = (status?: string) => {
  const text = String(status ?? "");
  if (!text.trim()) return null;
  if (/לא תקין|נדח|חורג|נכשל/.test(text)) return { color: "#b42318", background: "#fdecea" };
  if (/מאושר|אושר|סגור|נסגר|הושלם|תקין|שוחרר|נעול|approved|closed/i.test(text)) return { color: "#15803d", background: "#ecf8f0" };
  return { color: "#9a5b00", background: "#fff5e0" };
};

export function linkPartner(link: RecordLink, type: LinkType, id: string) {
  if (link.aType === type && link.aId === id) return { type: link.bType, id: link.bId };
  if (link.bType === type && link.bId === id) return { type: link.aType, id: link.aId };
  return null;
}

export function RecordLinksPanel({
  selfType,
  selfId,
  selfStructureNodeId,
  catalog,
  links,
  implicit,
  canWrite,
  unavailableMessage,
  onAdd,
  onRemove,
  onOpen,
}: {
  selfType: LinkType;
  selfId: string;
  selfStructureNodeId?: string;
  catalog: LinkCatalogItem[];
  links: RecordLink[];
  implicit: ImplicitLink[];
  canWrite: boolean;
  unavailableMessage?: string;
  onAdd: (type: LinkType, id: string) => Promise<void> | void;
  onRemove: (linkId: string) => Promise<void> | void;
  onOpen: (type: LinkType, id: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [pickType, setPickType] = useState<LinkType>("structure");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);

  const catalogByKey = useMemo(() => {
    const map = new Map<string, LinkCatalogItem>();
    catalog.forEach((item) => map.set(`${item.type}:${item.id}`, item));
    return map;
  }, [catalog]);

  // קישורים מפורשים + קישורים שנובעים משיוכים קיימים, בלי כפילויות
  const entries = useMemo(() => {
    const result: Array<{ type: LinkType; id: string; linkId?: string; note?: string }> = [];
    const seen = new Set<string>();
    links.forEach((link) => {
      const partner = linkPartner(link, selfType, selfId);
      if (!partner) return;
      const key = `${partner.type}:${partner.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push({ ...partner, linkId: link.id });
    });
    implicit.forEach((item) => {
      const key = `${item.type}:${item.id}`;
      if (seen.has(key) || (item.type === selfType && item.id === selfId)) return;
      seen.add(key);
      result.push({ type: item.type, id: item.id, note: item.note });
    });
    return result.filter((entry) => catalogByKey.has(`${entry.type}:${entry.id}`));
  }, [links, implicit, selfType, selfId, catalogByKey]);

  const linkedKeys = new Set(entries.map((entry) => `${entry.type}:${entry.id}`));
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog
      .filter((item) => item.type === pickType && !(item.type === selfType && item.id === selfId))
      .filter((item) => !linkedKeys.has(`${item.type}:${item.id}`))
      .filter((item) => !q || `${item.label} ${item.sub ?? ""} ${item.date ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const sameA = selfStructureNodeId && (a.structureNodeId === selfStructureNodeId || a.id === selfStructureNodeId) ? 0 : 1;
        const sameB = selfStructureNodeId && (b.structureNodeId === selfStructureNodeId || b.id === selfStructureNodeId) ? 0 : 1;
        if (sameA !== sameB) return sameA - sameB;
        return String(b.date ?? "").localeCompare(String(a.date ?? ""));
      })
      .slice(0, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, pickType, query, selfType, selfId, selfStructureNodeId, entries]);

  const grouped = LINK_TYPES.map((group) => ({
    ...group,
    items: entries.filter((entry) => entry.type === group.type),
  })).filter((group) => group.items.length);

  const submit = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await onAdd(pickType, selectedId);
      setSelectedId("");
      setQuery("");
      setPicking(false);
    } finally {
      setBusy(false);
    }
  };

  const chipStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #dde3ec",
    background: "#fff",
    borderRadius: 10,
    padding: "6px 10px",
    fontSize: 13,
    fontWeight: 600,
    color: "#0b1f3a",
    maxWidth: "100%",
  };

  return (
    <section
      dir="rtl"
      data-record-links=""
      style={{ border: "1px solid #dde3ec", borderRadius: 14, background: "#fff", padding: 18, marginTop: 18, display: "grid", gap: 14 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#0b1f3a" }}>
          רשומות מקושרות <span style={{ color: "#55657d", fontWeight: 600 }}>({entries.length})</span>
        </div>
        {canWrite && !unavailableMessage ? (
          <button
            type="button"
            onClick={() => setPicking((value) => !value)}
            style={{ height: 36, padding: "0 14px", borderRadius: 10, border: 0, background: "#0b1f3a", color: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            {picking ? "סגירה" : "+ קישור רשומה"}
          </button>
        ) : null}
      </div>

      {unavailableMessage ? (
        <div style={{ fontSize: 13, color: "#9a5b00", background: "#fff5e0", borderRadius: 10, padding: "8px 12px" }}>{unavailableMessage}</div>
      ) : null}

      {picking ? (
        <div style={{ border: "1px solid #dde3ec", borderRadius: 12, padding: 14, display: "grid", gap: 10, background: "#f8fafc" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {LINK_TYPES.map((group) => (
              <button
                key={group.type}
                type="button"
                onClick={() => {
                  setPickType(group.type);
                  setSelectedId("");
                }}
                style={{
                  ...chipStyle,
                  cursor: "pointer",
                  background: pickType === group.type ? "#0b1f3a" : "#fff",
                  color: pickType === group.type ? "#fff" : "#0b1f3a",
                  borderColor: pickType === group.type ? "#0b1f3a" : "#dde3ec",
                }}
              >
                {group.label}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש לפי מספר, שם, אלמנט או תאריך…"
            style={{ height: 38, border: "1px solid #c9d2df", borderRadius: 10, padding: "0 12px", fontSize: 14, background: "#fff" }}
          />
          <div style={{ border: "1px solid #eef1f5", borderRadius: 10, background: "#fff", maxHeight: 280, overflowY: "auto" }}>
            {candidates.length ? (
              candidates.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  onDoubleClick={() => {
                    setSelectedId(item.id);
                    void (async () => {
                      setBusy(true);
                      try {
                        await onAdd(pickType, item.id);
                        setPicking(false);
                        setQuery("");
                        setSelectedId("");
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    width: "100%",
                    textAlign: "right",
                    border: 0,
                    borderBottom: "1px solid #eef1f5",
                    padding: "9px 12px",
                    cursor: "pointer",
                    background: selectedId === item.id ? "#e8eef7" : "#fff",
                    color: "#0b1f3a",
                    fontSize: 14,
                  }}
                >
                  <span>
                    <b>{item.label}</b>
                    {item.sub ? <span style={{ color: "#55657d" }}> · {item.sub}</span> : null}
                  </span>
                  <span style={{ fontSize: 12, color: "#55657d", whiteSpace: "nowrap" }}>{item.date ?? ""}</span>
                </button>
              ))
            ) : (
              <div style={{ padding: 12, color: "#55657d", fontSize: 13 }}>אין רשומות זמינות לקישור מסוג זה.</div>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#55657d" }}>רשומות מאותו אלמנט בעץ הפרויקט מופיעות ראשונות. לחיצה כפולה מקשרת מיד.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={!selectedId || busy}
              onClick={() => void submit()}
              style={{ height: 36, padding: "0 16px", borderRadius: 10, border: 0, background: "#0b1f3a", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: !selectedId || busy ? 0.5 : 1 }}
            >
              {busy ? "מקשר…" : "קשר"}
            </button>
            <button
              type="button"
              onClick={() => setPicking(false)}
              style={{ height: 36, padding: "0 14px", borderRadius: 10, border: "1px solid #c9d2df", background: "#fff", color: "#0b1f3a", fontWeight: 700, cursor: "pointer" }}
            >
              ביטול
            </button>
          </div>
        </div>
      ) : null}

      {grouped.length ? (
        grouped.map((group) => (
          <div key={group.type} style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#55657d" }}>{group.label}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {group.items.map((entry) => {
                const item = catalogByKey.get(`${entry.type}:${entry.id}`)!;
                const tone = statusTone(item.status);
                return (
                  <span key={`${entry.type}:${entry.id}`} style={chipStyle}>
                    <button
                      type="button"
                      onClick={() => onOpen(entry.type, entry.id)}
                      title="פתיחת הרשומה"
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, border: 0, background: "transparent", padding: 0, cursor: "pointer", color: "inherit", font: "inherit", textAlign: "right" }}
                    >
                      <span style={{ width: 26, height: 26, borderRadius: 8, background: "#e8eef7", color: "#13305a", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                        <NavIcon name={typeIcon(entry.type)} size={15} />
                      </span>
                      <span>
                        {item.label}
                        {item.sub ? <span style={{ color: "#55657d" }}> · {item.sub}</span> : null}
                      </span>
                    </button>
                    {tone ? <span style={{ ...tone, fontSize: 11, fontWeight: 800, borderRadius: 999, padding: "2px 8px" }}>{item.status}</span> : null}
                    {entry.note ? <span style={{ fontSize: 11, color: "#55657d" }}>({entry.note})</span> : null}
                    {entry.linkId && canWrite ? (
                      <button
                        type="button"
                        aria-label="הסרת הקישור"
                        title="הסרת הקישור"
                        onClick={() => {
                          if (window.confirm(`להסיר את הקישור ל"${item.label}"?`)) void onRemove(entry.linkId!);
                        }}
                        style={{ border: 0, background: "transparent", color: "#8592a6", cursor: "pointer", fontSize: 13, padding: 0 }}
                      >
                        ✕
                      </button>
                    ) : null}
                  </span>
                );
              })}
            </div>
          </div>
        ))
      ) : (
        <div style={{ fontSize: 13, color: "#55657d" }}>אין עדיין רשומות מקושרות. אפשר לקשר לעץ הפרויקט ולכל סוג רשומה במערכת.</div>
      )}
      {grouped.length ? (
        <div style={{ fontSize: 12, color: "#55657d", borderTop: "1px solid #eef1f5", paddingTop: 10 }}>
          לחיצה על רשומה פותחת אותה. ✕ מסיר את הקישור משני הצדדים.
        </div>
      ) : null}
    </section>
  );
}
