"use client";

import type { ChecklistAutoLink } from "../lib/checklistAutoLinks";

// תיבה קטנה מתחת לתיאור הסעיף שמציגה את הרשומה שקושרה אוטומטית
// (בקרה מקדימה מאושרת / רשימת תיוג של השכבה הקודמת), עם אפשרות להחליף ולפתוח.
export function ChecklistAutoLinkBox({
  link,
  onChoose,
  onOpen,
}: {
  link: ChecklistAutoLink;
  onChoose: (id: string) => void;
  onOpen?: (link: ChecklistAutoLink) => void;
}) {
  const tone =
    link.state === "linked"
      ? { bg: "#f2f6fc", border: "#d7e2f2", color: "#13305a", badge: "#15803d", badgeBg: "#ecf8f0", badgeText: "קושר אוטומטית" }
      : link.state === "pending"
        ? { bg: "#fffaf0", border: "#f1d9a6", color: "#5c3d00", badge: "#9a5b00", badgeBg: "#fff5e0", badgeText: "טרם אושר" }
        : { bg: "#fdf4f3", border: "#f3c4be", color: "#7a1a12", badge: "#b42318", badgeBg: "#fdecea", badgeText: "לא נמצא" };
  const title = link.kind === "preliminary" ? "בקרה מקדימה" : "שכבה קודמת";

  return (
    <div
      style={{
        marginTop: 8,
        padding: "8px 10px",
        borderRadius: 10,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.color,
        fontSize: 12,
        lineHeight: 1.5,
        display: "grid",
        gap: 3,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
        </svg>
        <b>{title}</b>
        <span style={{ fontWeight: 700, color: tone.badge, background: tone.badgeBg, borderRadius: 999, padding: "1px 8px" }}>
          {link.manual && link.state !== "missing" ? "נבחר ידנית" : tone.badgeText}
        </span>
        {link.record && onOpen ? (
          <button
            type="button"
            onClick={() => onOpen(link)}
            style={{ marginInlineStart: "auto", border: 0, background: "transparent", color: "#13305a", fontWeight: 700, cursor: "pointer", padding: 0, textDecoration: "underline", fontSize: 12 }}
          >
            פתיחה
          </button>
        ) : null}
      </div>
      {link.lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
      {link.warning ? <span style={{ fontWeight: 700 }}>{link.warning}</span> : null}
      {link.candidates.length > 0 ? (
        <select
          value={link.manual ? link.selectedId ?? "" : ""}
          onChange={(event) => onChoose(event.target.value)}
          aria-label={`בחירת ${title} אחרת`}
          style={{ marginTop: 4, width: "100%", border: `1px solid ${tone.border}`, borderRadius: 8, padding: "5px 6px", background: "#fff", fontSize: 12, color: "#0f1b2d" }}
        >
          <option value="">{link.state === "missing" ? "בחירה ידנית…" : "בחירה אוטומטית (מומלץ)"}</option>
          {link.candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
