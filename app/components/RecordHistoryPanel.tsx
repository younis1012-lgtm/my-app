"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// היסטוריית שינויים של רשומה – נקראת מטבלת audit_log שנרשמת אוטומטית בבסיס הנתונים.

type AuditEntry = {
  id: number;
  action: string;
  actor_name: string | null;
  changes: Array<{ field: string; from: string; to: string }> | null;
  reason: string | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create: { label: "נוצרה", color: "#8592a6" },
  update: { label: "עודכנה", color: "#2f5d93" },
  approve: { label: "אושרה", color: "#15803d" },
  reopen: { label: "בוטל האישור", color: "#9a5b00" },
  unlock: { label: "נפתחה לעריכה", color: "#9a5b00" },
  delete: { label: "נמחקה", color: "#b42318" },
  email: { label: "נשלחה במייל", color: "#2f5d93" },
};

const FIELD_LABELS: Record<string, string> = {
  status: "סטטוס",
  notes: "הערות",
  remarks: "הערות",
  executionDate: "תאריך ביצוע",
  responsible: "אחראי",
  inspector: "בודק",
  title: "כותרת",
  location: "מיקום",
  date: "תאריך",
  description: "תיאור",
  contractor: "קבלן",
  structure_node_id: "שיוך לעץ הפרויקט",
  structureNodeId: "שיוך לעץ הפרויקט",
  approved: "מאושר",
  draft: "טיוטה",
  rejected: "נדחה",
};

const label = (value: string) =>
  String(value || "")
    .split(" – ")
    .map((part) => FIELD_LABELS[part] ?? part)
    .join(" – ");

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
};

export function RecordHistoryPanel({ recordId, refreshKey }: { recordId: string; refreshKey?: unknown }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error" | "local">("loading");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!supabase) {
      setState("local");
      return;
    }
    setState("loading");
    void supabase
      .from("audit_log")
      .select("id,action,actor_name,changes,reason,created_at")
      .eq("record_id", recordId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setState(/audit_log|does not exist|schema cache|PGRST205|42P01/i.test(`${error.message} ${(error as any).code ?? ""}`) ? "missing" : "error");
          return;
        }
        setEntries((data ?? []) as AuditEntry[]);
        setState("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [recordId, refreshKey]);

  const visible = open ? entries : entries.slice(0, 5);

  return (
    <section
      dir="rtl"
      data-record-history=""
      style={{ border: "1px solid #dde3ec", borderRadius: 14, background: "#fff", padding: 18, marginTop: 14, display: "grid", gap: 6, scrollMarginTop: 110 }}
    >
      <div style={{ fontSize: 18, fontWeight: 800, color: "#0b1f3a" }}>
        היסטוריית שינויים {state === "ready" ? <span style={{ color: "#55657d", fontWeight: 600 }}>({entries.length})</span> : null}
      </div>
      {state === "loading" ? <div style={{ fontSize: 13, color: "#55657d" }}>טוען…</div> : null}
      {state === "local" ? <div style={{ fontSize: 13, color: "#55657d" }}>ההיסטוריה זמינה בעבודה מול השרת בלבד.</div> : null}
      {state === "missing" ? (
        <div style={{ fontSize: 13, color: "#9a5b00", background: "#fff5e0", borderRadius: 10, padding: "8px 12px" }}>
          כדי להפעיל תיעוד שינויים יש להריץ פעם אחת ב-Supabase את הקובץ app/supabase/17_audit_log.sql
        </div>
      ) : null}
      {state === "error" ? <div style={{ fontSize: 13, color: "#b42318" }}>טעינת ההיסטוריה נכשלה.</div> : null}
      {state === "ready" && !entries.length ? (
        <div style={{ fontSize: 13, color: "#55657d" }}>עדיין לא נרשמו שינויים ברשומה זו (התיעוד מתחיל מרגע הפעלתו).</div>
      ) : null}
      {visible.map((entry) => {
        const meta = ACTION_LABELS[entry.action] ?? { label: entry.action, color: "#8592a6" };
        const changes = Array.isArray(entry.changes) ? entry.changes : [];
        return (
          <div key={entry.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid #eef1f5" }}>
            <span style={{ width: 12, height: 12, borderRadius: 999, background: meta.color, flex: "0 0 auto", marginTop: 5 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: "#0f1b2d" }}>{meta.label}</div>
              <div style={{ fontSize: 12, color: "#55657d" }}>
                {entry.actor_name || "מערכת"} · {formatDateTime(entry.created_at)}
              </div>
              {entry.reason ? (
                <div style={{ fontSize: 13, background: "#f8fafc", borderRadius: 8, padding: "6px 10px", marginTop: 6 }}>סיבה: {entry.reason}</div>
              ) : null}
              {changes.slice(0, 12).map((change, index) => (
                <div key={index} style={{ fontSize: 13, background: "#f8fafc", borderRadius: 8, padding: "6px 10px", marginTop: 6, overflowWrap: "anywhere" }}>
                  {label(change.field)}:{" "}
                  {change.from ? <span style={{ color: "#b42318", textDecoration: "line-through" }}>{label(change.from)}</span> : null}
                  {change.from ? " ← " : ""}
                  <span style={{ color: "#15803d", fontWeight: 700 }}>{label(change.to) || "—"}</span>
                </div>
              ))}
              {changes.length > 12 ? <div style={{ fontSize: 12, color: "#55657d", marginTop: 4 }}>ועוד {changes.length - 12} שינויים</div> : null}
            </div>
          </div>
        );
      })}
      {entries.length > 5 ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          style={{ justifySelf: "start", border: 0, background: "transparent", color: "#13305a", fontWeight: 700, cursor: "pointer", padding: "6px 0" }}
        >
          {open ? "הצג פחות" : `הצג את כל ההיסטוריה (${entries.length})`}
        </button>
      ) : null}
      <div style={{ fontSize: 12, color: "#55657d", borderTop: "1px solid #eef1f5", paddingTop: 10 }}>
        ההיסטוריה נרשמת אוטומטית בבסיס הנתונים ולא ניתנת לעריכה או למחיקה.
      </div>
    </section>
  );
}
