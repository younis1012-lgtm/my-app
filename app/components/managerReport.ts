// דוח מנהלים להדפסה / שמירה כ־PDF (A4), מתוך לוח הבקרה הניהולי.
// נפתח בחלון חדש עם חלון ההדפסה של הדפדפן – שם בוחרים "שמור כ־PDF".
// הגרפים הם אותם גרפים שמוצגים במערכת (dashboardCharts).

import {
  activityCalendarSvg,
  approvalValiditySvg,
  moduleStatusSvg,
  monthlyActivitySvg,
  ncrCumulativeSvg,
  ncrParetoSvg,
} from "./dashboardCharts";
import type { Exception, ModuleKey, Period, Row } from "./ManagementDashboard";

const esc = (value: unknown) =>
  String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmt = (date: Date | null) =>
  date ? new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date) : "";

export type ManagerReportInput = {
  projectName: string;
  period: Period;
  rows: Row[];
  exceptions: Exception[];
  modules: Array<{ key: ModuleKey; label: string; short: string }>;
  kpis: Array<{ label: string; value: string | number; note?: string }>;
  activity: Array<{ label: string; opened: number; closed: number; open: number; overdue: number }>;
  today: Date;
};

export function buildManagerReportHtml(input: ManagerReportInput) {
  const { projectName, period, rows, exceptions, modules, kpis, activity, today } = input;
  const moduleLabel = (key: ModuleKey) => modules.find((mod) => mod.key === key)?.short ?? key;
  const chart = (title: string, svg: string) =>
    `<section class="chart"><h3>${esc(title)}</h3>${svg}</section>`;

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>דוח מנהלים – ${esc(projectName)} – ${esc(fmt(period.to))}</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;900&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 14mm 12mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Heebo, Arial, sans-serif; color: #0b1f3a; font-size: 12px; background: #fff; }
.page { max-width: 186mm; margin: 0 auto; }
header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #d4a017; padding-bottom: 8px; margin-bottom: 12px; }
header .kicker { font-size: 11px; font-weight: 700; color: #9a7410; }
header h1 { margin: 2px 0; font-size: 20px; font-weight: 900; }
header .meta { font-size: 11px; color: #475569; }
header .brand { font-weight: 900; font-size: 14px; }
.kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 12px; }
.kpi { border: 1px solid #dbe3ee; border-radius: 6px; padding: 6px 8px; }
.kpi .l { font-size: 10px; color: #475569; font-weight: 700; }
.kpi .v { font-size: 20px; font-weight: 900; }
.kpi .n { font-size: 9px; color: #64748b; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.chart { border: 1px solid #dbe3ee; border-radius: 6px; padding: 8px; margin-bottom: 10px; break-inside: avoid; }
.chart h3 { margin: 0 0 4px; font-size: 13px; font-weight: 900; }
.chart svg { width: 100%; height: auto; display: block; }
table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
th { background: #0b1f3a; color: #fff; font-weight: 700; font-size: 11px; padding: 5px 6px; text-align: right; }
td { border-bottom: 1px solid #e2e8f0; padding: 4px 6px; font-size: 11px; vertical-align: top; }
tr { break-inside: avoid; }
h2 { font-size: 15px; font-weight: 900; margin: 12px 0 6px; border-inline-start: 4px solid #d4a017; padding-inline-start: 8px; }
.late { color: #b91c1c; font-weight: 700; }
.signs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 26px; break-inside: avoid; }
.signs div { border-top: 1px solid #94a3b8; padding-top: 4px; font-size: 11px; color: #475569; }
.foot { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 12px; }
.noprint { position: sticky; top: 0; background: #fffbeb; border: 1px solid #fcd34d; padding: 8px 12px; margin-bottom: 10px; font-weight: 700; display: flex; gap: 10px; align-items: center; }
.noprint button { font: inherit; font-weight: 900; border: 0; border-radius: 6px; padding: 6px 14px; background: #0b1f3a; color: #fff; cursor: pointer; }
@media print { .noprint { display: none; } }
</style>
</head>
<body>
<div class="page">
<div class="noprint">לשמירה כ־PDF: בחלון ההדפסה בחר "שמור כ־PDF" / "Microsoft Print to PDF". <button onclick="window.print()">הדפס / שמור PDF</button></div>
<header>
<div>
<div class="kicker">דוח מנהלים · בקרת איכות · מפרט נתיבי ישראל 00.02.04.08</div>
<h1>${esc(projectName)}</h1>
<div class="meta">תקופה: ${esc(period.label)} · ${esc(fmt(period.from))} – ${esc(fmt(period.to))} · הופק ${esc(fmt(today))}</div>
</div>
<div class="brand">Y.K QUALITY</div>
</header>

<div class="kpis">
${kpis.map((k) => `<div class="kpi"><div class="l">${esc(k.label)}</div><div class="v">${esc(k.value)}</div>${k.note ? `<div class="n">${esc(k.note)}</div>` : ""}</div>`).join("")}
</div>

<div class="grid2">
${chart("מצב רשומות לפי מודול", moduleStatusSvg(rows, modules))}
${chart("אי־התאמות – נפתחו מול נסגרו (מצטבר)", ncrCumulativeSvg(rows, today))}
</div>
<div class="grid2">
${chart("רשומות חדשות לפי חודש", monthlyActivitySvg(rows, today))}
${chart("אי־התאמות לפי אלמנט (פארטו)", ncrParetoSvg(rows))}
</div>

<h2>פעילות בתקופה</h2>
<table>
<thead><tr><th>מודול</th><th>נפתחו</th><th>נסגרו / אושרו</th><th>פתוחים בסוף התקופה</th><th>באיחור</th></tr></thead>
<tbody>
${activity.map((a) => `<tr><td><b>${esc(a.label)}</b></td><td>${a.opened}</td><td>${a.closed}</td><td>${a.open}</td><td class="${a.overdue ? "late" : ""}">${a.overdue || "–"}</td></tr>`).join("")}
</tbody>
</table>

<h2>חריגים לטיפול (${exceptions.length})</h2>
<table>
<thead><tr><th>מודול</th><th>רשומה</th><th>מיקום / רכיב</th><th>סיבת החריגה</th><th>נפתח</th></tr></thead>
<tbody>
${exceptions.length
    ? exceptions.slice(0, 40).map((e) => `<tr><td>${esc(moduleLabel(e.row.module))}</td><td>${esc(e.row.title)}</td><td>${esc(e.row.location)}</td><td class="${e.weight >= 70 ? "late" : ""}">${esc(e.reason)}</td><td>${esc(fmt(e.row.opened))}</td></tr>`).join("")
    : `<tr><td colspan="5">לא נמצאו חריגים פתוחים</td></tr>`}
</tbody>
</table>
${exceptions.length > 40 ? `<div class="meta">מוצגים 40 החריגים הדחופים מתוך ${exceptions.length}. הרשימה המלאה בדוח התקופתי (Excel).</div>` : ""}

<div class="grid2">
${chart("תוקף אישורי ספקים, קבלנים וחומרים", approvalValiditySvg(rows, today))}
${chart("רצף פעילות בקרה יומית", activityCalendarSvg(rows, today))}
</div>

<div class="signs">
<div>מנהל בקרת איכות – שם, חתימה ותאריך</div>
<div>מנהל הבטחת איכות – שם, חתימה ותאריך</div>
<div>מנהל הפרויקט – שם, חתימה ותאריך</div>
</div>
<div class="foot">הופק אוטומטית ממערכת Y.K Quality · ${esc(fmt(today))}</div>
</div>
<script>
window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 600); });
</script>
</body>
</html>`;
}

export function openManagerReport(input: ManagerReportInput, target?: Window | null) {
  const win = target ?? window.open("", "_blank");
  if (!win) {
    window.alert("הדפדפן חסם את פתיחת הדוח. אפשר חלונות קופצים לאתר זה ונסה שוב.");
    return;
  }
  win.document.open();
  win.document.write(buildManagerReportHtml(input));
  win.document.close();
}
