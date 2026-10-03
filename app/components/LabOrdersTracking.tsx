"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  LAB_ORDER_KIND_LABEL,
  LAB_ORDER_STATUS_LABEL,
  formatPlannedAt,
  refreshSummaryOverdue,
  summarizeChecklistLabOrders,
  type LabOrderSummary,
} from "../lib/labOrders";

type Row = LabOrderSummary & { checklistId: string; checklistNo: string; checklistTitle: string };

// מעקב הזמנות מעבדה ומודד בכל רשימות התיוג של הפרויקט.
// כשהרשימה נטענה במלואה – הסטטוס מחושב מהתעודות; אחרת – מהסיכום שנשמר עם הרשימה.
export function LabOrdersTracking({
  checklists,
  onOpen,
}: {
  checklists: any[];
  onOpen: (checklistId: string, itemId: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"active" | "overdue" | "closed" | "all">("active");
  const [kindFilter, setKindFilter] = useState<"all" | "lab" | "measurement">("all");
  const [partyFilter, setPartyFilter] = useState("");
  const now = useMemo(() => new Date(), []);

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    for (const record of checklists ?? []) {
      const items = Array.isArray(record?.items) ? record.items : null;
      const hasFullItems = Boolean(items?.some((item: any) => Array.isArray(item?.labOrders)));
      const summaries: LabOrderSummary[] = hasFullItems
        ? summarizeChecklistLabOrders(items!, now)
        : (Array.isArray(record?.labOrdersSummary) ? record.labOrdersSummary : Array.isArray(record?.details?.labOrdersSummary) ? record.details.labOrdersSummary : []).map(
            (summary: LabOrderSummary) => refreshSummaryOverdue(summary, now),
          );
      for (const summary of summaries) {
        list.push({
          ...summary,
          checklistId: String(record.id),
          checklistNo: String(record.checklistNo ?? record.checklist_no ?? ""),
          checklistTitle: String(record.title ?? ""),
        });
      }
    }
    return list.sort((a, b) => b.orderNo - a.orderNo);
  }, [checklists, now]);

  const parties = useMemo(() => Array.from(new Set(rows.map((row) => row.partyName).filter(Boolean))).sort(), [rows]);
  const isActive = (row: Row) => row.status === "open" || row.status === "partial";
  const visible = rows.filter(
    (row) =>
      (statusFilter === "all" ||
        (statusFilter === "active" && isActive(row)) ||
        (statusFilter === "overdue" && isActive(row) && row.overdueDays > 0) ||
        (statusFilter === "closed" && row.status === "closed")) &&
      (kindFilter === "all" || row.kind === kindFilter) &&
      (!partyFilter || row.partyName === partyFilter),
  );
  const kpis = [
    { label: "פתוחות", value: rows.filter((row) => row.status === "open").length, color: "#0b1f3a" },
    { label: "באיחור", value: rows.filter((row) => isActive(row) && row.overdueDays > 0).length, color: "#b42318" },
    { label: "התקבלו חלקית", value: rows.filter((row) => row.status === "partial").length, color: "#9a5b00" },
    { label: "נסגרו", value: rows.filter((row) => row.status === "closed").length, color: "#15803d" },
  ];

  const chip = (row: Row) => {
    const overdue = isActive(row) && row.overdueDays > 0;
    const tone = row.status === "closed" ? ["#ecf8f0", "#15803d"] : row.status === "cancelled" ? ["#eef1f5", "#55657d"] : overdue ? ["#fdecea", "#b42318"] : row.status === "partial" ? ["#fff5e0", "#9a5b00"] : ["#eef3fa", "#2f5d93"];
    const label = overdue ? `באיחור ${row.overdueDays} ימים` : row.status === "partial" ? `התקבלה חלקית (${row.received}/${row.required})` : LAB_ORDER_STATUS_LABEL[row.status];
    return <span style={{ display: "inline-block", borderRadius: 999, padding: "2px 9px", fontSize: 12, fontWeight: 700, background: tone[0], color: tone[1], whiteSpace: "nowrap" }}>{label}</span>;
  };

  const exportCsv = () => {
    const head = ["הזמנה", "סוג", "רשימת תיוג", "סעיף", "בדיקה / מדידה", "מבנה", "אלמנט", "מעבדה / מודד", "מועד ביצוע", "תעודות", "סטטוס"];
    const body = visible.map((row) => [
      row.orderNo,
      LAB_ORDER_KIND_LABEL[row.kind],
      `${row.checklistNo} ${row.checklistTitle}`.trim(),
      row.itemIndex + 1,
      row.testType,
      row.structure,
      row.element,
      row.partyName,
      formatPlannedAt(row.plannedAt),
      row.certificates.join(" | "),
      row.overdueDays > 0 && isActive(row) ? `באיחור ${row.overdueDays} ימים` : LAB_ORDER_STATUS_LABEL[row.status],
    ]);
    const csv = [head, ...body].map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "הזמנות-מעבדה-ומודד.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const select: CSSProperties = { height: 36, borderRadius: 10, border: "1px solid #c9d2df", padding: "0 10px", background: "#fff", fontWeight: 600 };
  const th: CSSProperties = { textAlign: "right", color: "#55657d", fontWeight: 700, background: "#f8fafc", padding: "9px 10px", borderBottom: "1px solid #dde3ec", whiteSpace: "nowrap" };
  const td: CSSProperties = { padding: 10, borderBottom: "1px solid #eef1f5", verticalAlign: "top" };

  return (
    <div dir="rtl" style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} style={{ background: "#fff", border: "1px solid #dde3ec", borderRadius: 14, padding: "12px 16px" }}>
            <div style={{ fontSize: 13, color: "#55657d" }}>{kpi.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select style={select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="active">פתוחות</option>
          <option value="overdue">באיחור</option>
          <option value="closed">נסגרו</option>
          <option value="all">הכל</option>
        </select>
        <select style={select} value={kindFilter} onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}>
          <option value="all">מעבדה ומודד</option>
          <option value="lab">מעבדה</option>
          <option value="measurement">מודד</option>
        </select>
        <select style={select} value={partyFilter} onChange={(e) => setPartyFilter(e.target.value)}>
          <option value="">כל המעבדות והמודדים</option>
          {parties.map((party) => <option key={party} value={party}>{party}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={exportCsv} disabled={!visible.length} style={{ ...select, cursor: "pointer", fontWeight: 700 }}>ייצוא לאקסל</button>
      </div>
      {!rows.length ? (
        <div style={{ background: "#fff", border: "1px solid #dde3ec", borderRadius: 14, padding: 18, color: "#55657d" }}>
          עדיין אין הזמנות. פותחים הזמנה מתוך סעיף הבדיקה ברשימת התיוג (כפתור "+ הזמנת מעבדה" / "+ הזמנת מודד").
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #dde3ec", borderRadius: 14, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
            <thead>
              <tr>
                {["הזמנה", "רשימת תיוג / סעיף", "בדיקה / מדידה", "מבנה › אלמנט", "מעבדה / מודד", "מועד ביצוע", "תעודה", "סטטוס"].map((head) => <th key={head} style={th}>{head}</th>)}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={`${row.checklistId}-${row.id}`} onClick={() => onOpen(row.checklistId, row.itemId)} style={{ cursor: "pointer" }} title="פתיחת רשימת התיוג בסעיף">
                  <td style={td}>
                    <b>{row.orderNo}</b>
                    <div style={{ fontSize: 12, color: "#55657d" }}>{LAB_ORDER_KIND_LABEL[row.kind]} · {row.sentVia === "email" ? "נשלחה מהמערכת" : "נרשמה – נשלחה מחוץ למערכת"}</div>
                  </td>
                  <td style={td}>{row.checklistNo || "—"} · סעיף {row.itemIndex + 1}<div style={{ fontSize: 12, color: "#55657d" }}>{row.checklistTitle}</div></td>
                  <td style={td}>{row.testType || "—"}</td>
                  <td style={td}>{[row.structure, row.element].filter(Boolean).join(" › ") || "—"}</td>
                  <td style={td}>{row.partyName || "—"}</td>
                  <td style={td}>{formatPlannedAt(row.plannedAt)}</td>
                  <td style={td}>{row.certificates.length ? row.certificates.join(", ") : "—"}</td>
                  <td style={td}>{chip(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length ? <div style={{ padding: 16, color: "#55657d" }}>אין הזמנות שמתאימות לסינון.</div> : null}
        </div>
      )}
      <div style={{ fontSize: 12, color: "#55657d" }}>
        "באיחור" = עברו 7 ימים ממועד הביצוע בלי תעודה (בבדיקת חוזק 7 ו-28 יום – 35 ימים לתעודה השנייה). לחיצה על שורה פותחת את רשימת התיוג בסעיף.
      </div>
    </div>
  );
}
