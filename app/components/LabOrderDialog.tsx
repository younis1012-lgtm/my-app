"use client";

import { useState, type CSSProperties } from "react";
import { LAB_ORDER_KIND_LABEL, type LabOrder } from "../lib/labOrders";

type Party = { id: string; company: string; role: string; contactName: string; email: string; active: boolean };

// טופס הזמנת מעבדה / מודד מתוך סעיף ברשימת התיוג.
// שדות שמולאו מרשימת התיוג מסומנים בכחול בהיר – אפשר לשנות אותם בהזמנה בלבד.
export function LabOrderDialog({
  initial,
  prefilledKeys,
  parties,
  checklistLabel,
  readOnly,
  onSave,
  onSendEmail,
  onCancelOrder,
  onClose,
}: {
  initial: LabOrder;
  prefilledKeys: Array<keyof LabOrder>;
  parties: Party[];
  checklistLabel: string;
  readOnly?: boolean;
  onSave: (order: LabOrder) => void;
  onSendEmail: (order: LabOrder) => void;
  onCancelOrder?: (order: LabOrder) => void;
  onClose: () => void;
}) {
  const [order, setOrder] = useState<LabOrder>(initial);
  const isNew = !initial.sentVia;
  const role = order.kind === "measurement" ? "מודד" : "מעבדה";
  const candidates = parties.filter((party) => party.active && party.role === role);
  const set = <K extends keyof LabOrder>(key: K, value: LabOrder[K]) => setOrder((prev) => ({ ...prev, [key]: value }));
  const prefilled = new Set(prefilledKeys);
  const input = (key: keyof LabOrder): CSSProperties => ({
    width: "100%",
    boxSizing: "border-box",
    border: `1px solid ${prefilled.has(key) ? "#c8daf0" : "#cbd5e1"}`,
    background: prefilled.has(key) ? "#f2f7fd" : "#fff",
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 14,
  });
  const label: CSSProperties = { display: "grid", gap: 4, fontSize: 12, fontWeight: 700, color: "#55657d" };
  const btn: CSSProperties = { height: 36, padding: "0 14px", borderRadius: 10, border: "1px solid #c9d2df", background: "#fff", color: "#0b1f3a", fontWeight: 700, cursor: "pointer" };
  const primary: CSSProperties = { ...btn, border: 0, background: "#0b1f3a", color: "#fff" };
  const field = (key: keyof LabOrder, title: string, props: { dir?: "ltr"; type?: string; placeholder?: string } = {}) => (
    <label style={label}>
      {title}
      <input
        style={input(key)}
        type={props.type}
        dir={props.dir}
        placeholder={props.placeholder}
        disabled={readOnly}
        value={String(order[key] ?? "")}
        onChange={(e) => set(key, e.target.value as never)}
      />
    </label>
  );
  const missingParty = !order.partyName.trim();
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(11,31,58,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div dir="rtl" onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 20, width: "min(760px, 96vw)", maxHeight: "92vh", overflowY: "auto", display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#0b1f3a" }}>
            הזמנת {LAB_ORDER_KIND_LABEL[order.kind]} {order.orderNo}
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, background: "#eef3fa", color: "#2f5d93", borderRadius: 999, padding: "3px 10px" }}>{checklistLabel}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
          {field("testType", order.kind === "measurement" ? "סוג המדידה" : "סוג הבדיקה")}
          <label style={label}>
            {role} (מגורמי הפרויקט)
            <select
              style={input("partyId")}
              disabled={readOnly}
              value={order.partyId}
              onChange={(e) => {
                const party = parties.find((p) => p.id === e.target.value);
                setOrder((prev) => ({ ...prev, partyId: party?.id ?? "", partyName: party?.company ?? prev.partyName, partyEmail: party?.email ?? prev.partyEmail }));
              }}
            >
              <option value="">{candidates.length ? `בחירת ${role}…` : `לא נרשם ${role} בגורמי הפרויקט`}</option>
              {candidates.map((party) => (
                <option key={party.id} value={party.id}>{[party.company, party.contactName].filter(Boolean).join(" – ")}</option>
              ))}
            </select>
          </label>
          {!order.partyId ? field("partyName", `שם ה${role}`) : null}
          {field("partyEmail", `מייל ה${role}`, { dir: "ltr" })}
          {field("structure", "מבנה")}
          {field("element", "אלמנט / תת אלמנט")}
          {field("fromChainage", "מחתך")}
          {field("toChainage", "עד חתך")}
          {field("side", "צד / היסט")}
          {order.kind === "lab" ? field("materialSource", "מקור החומר") : null}
          {order.kind === "lab" ? field("materialType", "סוג החומר") : null}
          {field("quantity", "כמות")}
          {field("plannedAt", "מועד מבוקש לביצוע", { type: "datetime-local" })}
          {field("contactName", "איש קשר באתר")}
          {field("contactPhone", "טלפון איש הקשר", { dir: "ltr" })}
        </div>
        <label style={label}>
          הערות
          <textarea rows={3} disabled={readOnly} style={{ ...input("notes"), resize: "vertical" }} value={order.notes} onChange={(e) => set("notes", e.target.value)} />
        </label>
        <div style={{ fontSize: 12, color: "#55657d", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-block", width: 12, height: 12, background: "#f2f7fd", border: "1px solid #c8daf0", borderRadius: 3 }} />
          נלקח מרשימת התיוג – שינוי כאן משנה רק את ההזמנה. ההזמנה תיסגר אוטומטית כשתצורף תעודה לסעיף.
        </div>
        {missingParty && !readOnly ? <div style={{ fontSize: 13, color: "#9a5b00", background: "#fff5e0", borderRadius: 10, padding: "8px 12px" }}>יש לבחור או לרשום את ה{role}.</div> : null}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!readOnly ? (
            <>
              <button
                type="button"
                style={{ ...primary, opacity: missingParty || !order.partyEmail.trim() ? 0.5 : 1 }}
                disabled={missingParty || !order.partyEmail.trim()}
                title={!order.partyEmail.trim() ? `חסר מייל ה${role}` : undefined}
                onClick={() => onSendEmail({ ...order, sentVia: "email" })}
              >
                {isNew ? `שמירה ושליחה ל${role} במייל` : "שליחה שוב במייל"}
              </button>
              <button type="button" style={{ ...btn, opacity: missingParty ? 0.5 : 1 }} disabled={missingParty} onClick={() => onSave({ ...order, sentVia: order.sentVia || "external" })}>
                {isNew ? "נשלחה מחוץ למערכת – רק לרשום" : "שמירת שינויים"}
              </button>
              {!isNew && onCancelOrder && !order.cancelled ? (
                <button type="button" style={{ ...btn, color: "#b42318" }} onClick={() => onCancelOrder(order)}>ביטול ההזמנה</button>
              ) : null}
            </>
          ) : null}
          <span style={{ flex: 1 }} />
          <button type="button" style={btn} onClick={onClose}>סגירה</button>
        </div>
      </div>
    </div>
  );
}
