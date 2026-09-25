// גרפים של לוח הבקרה הניהולי כ־SVG.
// אותן פונקציות משמשות את המסך, את דוח המנהלים (PDF) ואת גיליון הגרפים ב־Excel,
// כך שהמבקר רואה בדוח בדיוק את מה שמוצג במערכת.
// עיצוב מקורי של Y.K Quality: קווים מצטברים, פארטו אופקי, לוח פעילות יומי
// וציר תוקף – ללא גרפי טבעת, מחוגים או עמודות משולבות בקו.

import type { ModuleKey, Row, State } from "./ManagementDashboard";

const NAVY = "#0b1f3a";
const GOLD = "#d4a017";
const TEAL = "#0f766e";
const RED = "#b91c1c";
const AMBER = "#b45309";
const GRID = "#e2e8f0";
const MUTED = "#64748b";
const FONT = "Heebo, Arial, sans-serif";
const DAY = 24 * 60 * 60 * 1000;

const esc = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const svgOpen = (width: number, height: number, label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(label)}" direction="ltr" style="direction:ltr;max-width:100%;height:auto;font-family:${FONT}">` +
  `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"></rect>`;

const text = (x: number, y: number, value: unknown, opts: { size?: number; fill?: string; anchor?: "start" | "middle" | "end"; weight?: number } = {}) =>
  `<text x="${x}" y="${y}" font-size="${opts.size ?? 12}" fill="${opts.fill ?? MUTED}" text-anchor="${opts.anchor ?? "middle"}" font-weight="${opts.weight ?? 400}">${esc(value)}</text>`;

const monthStarts = (count: number, today: Date) => {
  const list: Date[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) list.push(new Date(today.getFullYear(), today.getMonth() - offset, 1));
  return list;
};
const monthLabel = (date: Date) => `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getFullYear()).slice(2)}`;

// ---------- 1. אי־התאמות: נפתחו מול נסגרו (מצטבר) ----------
export function ncrCumulativeSvg(rows: Row[], today: Date) {
  const W = 600;
  const H = 260;
  const left = 40;
  const right = 505;
  const top = 24;
  const bottom = 210;
  const ncr = rows.filter((row) => row.module === "nonconformances");
  const months = monthStarts(12, today);
  const ends = months.map((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1));
  const opened = ends.map((end) => ncr.filter((row) => row.opened && row.opened < end).length);
  const closed = ends.map((end) => ncr.filter((row) => row.state === "closed" && (row.closed ?? row.opened) && ((row.closed ?? row.opened) as Date) < end).length);
  const max = Math.max(4, ...opened);
  const step = (right - left) / (months.length - 1);
  const x = (i: number) => left + i * step;
  const y = (v: number) => bottom - (v / max) * (bottom - top);
  const line = (values: number[]) => values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const band = `${line(opened)} ${closed.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).reverse().join(" ")}`;
  let svg = svgOpen(W, H, "אי־התאמות מצטבר – נפתחו מול נסגרו");
  [0, 0.5, 1].forEach((f) => {
    const value = Math.round(max * f);
    svg += `<line x1="${left}" y1="${y(value)}" x2="${right}" y2="${y(value)}" stroke="${GRID}"></line>`;
    svg += text(left - 8, y(value) + 4, value, { anchor: "end", size: 11 });
  });
  svg += `<polygon points="${band}" fill="${AMBER}" opacity="0.14"></polygon>`;
  svg += `<polyline points="${line(opened)}" fill="none" stroke="${AMBER}" stroke-width="3" stroke-linejoin="round"></polyline>`;
  svg += `<polyline points="${line(closed)}" fill="none" stroke="${TEAL}" stroke-width="3" stroke-linejoin="round"></polyline>`;
  months.forEach((month, i) => {
    if (i % 2 === 0 || i === months.length - 1) svg += text(x(i), bottom + 18, monthLabel(month), { size: 11 });
  });
  const lastO = opened[opened.length - 1];
  const lastC = closed[closed.length - 1];
  svg += text(right + 4, y(lastO) - 6, `נפתחו ${lastO}`, { anchor: "start", fill: AMBER, weight: 700, size: 12 });
  svg += text(right + 4, y(lastC) + 14, `נסגרו ${lastC}`, { anchor: "start", fill: TEAL, weight: 700, size: 12 });
  svg += text(W / 2, H - 8, `השטח בין הקווים = אי־התאמות פתוחות (${lastO - lastC})`, { size: 11 });
  return `${svg}</svg>`;
}

// ---------- 2. פארטו אי־התאמות לפי אלמנט ----------
export function ncrParetoSvg(rows: Row[]) {
  const ncr = rows.filter((row) => row.module === "nonconformances");
  const counts = new Map<string, number>();
  ncr.forEach((row) => {
    const key = String(row.raw?.element || row.raw?.subElement || row.raw?.workType || "").trim() || "לא סווג";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  let items = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (items.length > 7) {
    const rest = items.slice(6).reduce((sum, [, v]) => sum + v, 0);
    items = [...items.slice(0, 6), ["אחר", rest]];
  }
  const W = 600;
  const rowH = 30;
  const H = Math.max(120, 40 + items.length * rowH + 24);
  const labelRight = 590;
  const barRight = 440;
  const barLeft = 90;
  const total = Math.max(1, ncr.length);
  const max = Math.max(1, ...items.map(([, v]) => v));
  let svg = svgOpen(W, H, "אי־התאמות לפי אלמנט");
  if (!items.length) return `${svg}${text(W / 2, H / 2, "אין אי־התאמות להצגה", { size: 14 })}</svg>`;
  let cumulative = 0;
  items.forEach(([label, value], i) => {
    cumulative += value;
    const yTop = 20 + i * rowH;
    const width = ((barRight - barLeft) * value) / max;
    const shade = cumulative / total <= 0.8 ? NAVY : "#94a3b8";
    svg += text(labelRight, yTop + 16, label.length > 20 ? `${label.slice(0, 19)}…` : label, { anchor: "end", fill: NAVY, weight: 700, size: 13 });
    svg += `<rect x="${barLeft}" y="${yTop + 4}" width="${barRight - barLeft}" height="18" rx="3" fill="#eef2f7"></rect>`;
    svg += `<rect x="${(barRight - width).toFixed(1)}" y="${yTop + 4}" width="${width.toFixed(1)}" height="18" rx="3" fill="${shade}"></rect>`;
    svg += text(barLeft - 8, yTop + 17, `${value} · ${Math.round((cumulative / total) * 100)}%`, { anchor: "end", size: 12, fill: NAVY });
  });
  svg += text(W / 2, H - 8, "כהה = האלמנטים שאחראים לכ־80% מאי־ההתאמות · המספר = כמות · האחוז = מצטבר", { size: 11 });
  return `${svg}</svg>`;
}

// ---------- 3. רצף פעילות בקרה יומית (26 שבועות, א׳–ו׳) ----------
export function activityCalendarSvg(rows: Row[], today: Date) {
  const weeks = 26;
  const cell = 16;
  const gap = 4;
  const W = 600;
  const H = 200;
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    [row.opened, row.state === "closed" ? row.closed : null].forEach((date) => {
      if (!date) return;
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
  });
  const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  const shades = ["#eef2f7", "#c7ddd9", "#8fbfb7", "#4c9a8f", TEAL];
  const gridRight = 560;
  let svg = svgOpen(W, H, "רצף פעילות בקרה יומית");
  const dayNames = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳"];
  dayNames.forEach((name, d) => {
    svg += text(gridRight + 22, 30 + d * (cell + gap), name, { size: 11, anchor: "middle" });
  });
  let active = 0;
  let totalDays = 0;
  for (let w = 0; w < weeks; w += 1) {
    const weekStart = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() - (weeks - 1 - w) * 7);
    for (let d = 0; d < 6; d += 1) {
      const day = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + d);
      if (day > today) continue;
      totalDays += 1;
      const value = counts.get(`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`) ?? 0;
      if (value) active += 1;
      const level = value === 0 ? 0 : value === 1 ? 1 : value <= 3 ? 2 : value <= 6 ? 3 : 4;
      // RTL: השבוע הוותיק מימין, האחרון משמאל
      const x = gridRight - (w + 1) * (cell + gap) + gap;
      const y = 18 + d * (cell + gap);
      svg += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" fill="${shades[level]}"><title>${esc(day.toLocaleDateString("he-IL"))}: ${value}</title></rect>`;
    }
  }
  const legendY = 18 + 6 * (cell + gap) + 18;
  svg += text(gridRight, legendY, "יותר", { anchor: "end", size: 11 });
  shades.forEach((shade, i) => {
    svg += `<rect x="${gridRight - 40 - i * 16}" y="${legendY - 11}" width="12" height="12" rx="2" fill="${shade}"></rect>`;
  });
  svg += text(gridRight - 40 - shades.length * 16 - 4, legendY, "פחות", { anchor: "end", size: 11 });
  svg += text(W / 2, H - 8, `ימי עבודה עם תיעוד: ${active} מתוך ${totalDays} · כל ריבוע = יום (פתיחה או סגירה של רשומה)`, { size: 11 });
  return `${svg}</svg>`;
}

// ---------- 4. ציר תוקף אישורי ספקים, קבלנים וחומרים ----------
export function approvalValiditySvg(rows: Row[], today: Date) {
  const items = rows
    .filter((row) => row.module === "preliminary" && row.due)
    .sort((a, b) => (a.due as Date).getTime() - (b.due as Date).getTime())
    .slice(0, 10);
  const W = 600;
  const rowH = 26;
  const H = Math.max(120, 50 + items.length * rowH + 30);
  const from = new Date(today.getTime() - 120 * DAY);
  const to = new Date(today.getTime() + 365 * DAY);
  const barRight = 420;
  const barLeft = 20;
  // RTL: הזמן זורם מימין לשמאל
  const xOf = (date: Date) => {
    const t = Math.min(Math.max(date.getTime(), from.getTime()), to.getTime());
    return barRight - ((t - from.getTime()) / (to.getTime() - from.getTime())) * (barRight - barLeft);
  };
  let svg = svgOpen(W, H, "תוקף אישורים");
  if (!items.length) return `${svg}${text(W / 2, H / 2, "אין אישורים עם תאריך תוקף", { size: 14 })}</svg>`;
  items.forEach((row, i) => {
    const yTop = 26 + i * rowH;
    const start = row.opened ?? from;
    const end = row.due as Date;
    const daysLeft = Math.floor((end.getTime() - today.getTime()) / DAY);
    const color = daysLeft < 0 ? RED : daysLeft <= 30 ? GOLD : TEAL;
    svg += text(590, yTop + 14, row.title.length > 22 ? `${row.title.slice(0, 21)}…` : row.title, { anchor: "end", fill: NAVY, weight: 700, size: 12 });
    svg += `<rect x="${barLeft}" y="${yTop + 3}" width="${barRight - barLeft}" height="14" rx="3" fill="#f1f5f9"></rect>`;
    const x1 = xOf(start);
    const x2 = xOf(end);
    svg += `<rect x="${Math.min(x1, x2).toFixed(1)}" y="${yTop + 3}" width="${Math.max(3, Math.abs(x1 - x2)).toFixed(1)}" height="14" rx="3" fill="${color}"><title>${esc(row.title)} – תוקף עד ${esc(end.toLocaleDateString("he-IL"))}</title></rect>`;
  });
  const todayX = xOf(today);
  svg += `<line x1="${todayX}" y1="18" x2="${todayX}" y2="${26 + items.length * rowH + 4}" stroke="${NAVY}" stroke-width="2" stroke-dasharray="4 3"></line>`;
  svg += text(todayX, 14, "היום", { size: 11, fill: NAVY, weight: 700 });
  const legendY = H - 8;
  svg += `<rect x="560" y="${legendY - 10}" width="12" height="12" rx="2" fill="${TEAL}"></rect>` + text(555, legendY, "בתוקף", { anchor: "end", size: 11 });
  svg += `<rect x="480" y="${legendY - 10}" width="12" height="12" rx="2" fill="${GOLD}"></rect>` + text(475, legendY, "פג תוך 30 יום", { anchor: "end", size: 11 });
  svg += `<rect x="370" y="${legendY - 10}" width="12" height="12" rx="2" fill="${RED}"></rect>` + text(365, legendY, "פג תוקף", { anchor: "end", size: 11 });
  return `${svg}</svg>`;
}

// ---------- 5. מצב רשומות לפי מודול (לדוח ול־Excel) ----------
const STATE_COLORS: Record<State, string> = { closed: TEAL, progress: GOLD, draft: "#94a3b8", rejected: RED };
const STATE_LABELS: Record<State, string> = { closed: "סגור / מאושר", progress: "בטיפול", draft: "טיוטה", rejected: "נדחה / לא תקין" };

export function moduleStatusSvg(rows: Row[], modules: Array<{ key: ModuleKey; label: string }>) {
  const W = 600;
  const rowH = 28;
  const H = 40 + modules.length * rowH + 30;
  const barRight = 470;
  const barLeft = 70;
  let svg = svgOpen(W, H, "מצב רשומות לפי מודול");
  modules.forEach((mod, i) => {
    const list = rows.filter((row) => row.module === mod.key);
    const yTop = 16 + i * rowH;
    svg += text(590, yTop + 15, mod.label, { anchor: "end", fill: NAVY, weight: 700, size: 13 });
    svg += `<rect x="${barLeft}" y="${yTop + 3}" width="${barRight - barLeft}" height="16" rx="3" fill="#eef2f7"></rect>`;
    let cursor = barRight;
    (Object.keys(STATE_COLORS) as State[]).forEach((state) => {
      const count = list.filter((row) => row.state === state).length;
      if (!count || !list.length) return;
      const width = ((barRight - barLeft) * count) / list.length;
      svg += `<rect x="${(cursor - width).toFixed(1)}" y="${yTop + 3}" width="${width.toFixed(1)}" height="16" fill="${STATE_COLORS[state]}"></rect>`;
      cursor -= width;
    });
    const open = list.filter((row) => row.state === "progress" || row.state === "rejected").length;
    svg += text(barLeft - 8, yTop + 15, `${open}/${list.length}`, { anchor: "end", size: 12, fill: NAVY });
  });
  const legendY = H - 10;
  (Object.keys(STATE_COLORS) as State[]).forEach((state, i) => {
    const x = 580 - i * 130;
    svg += `<rect x="${x}" y="${legendY - 10}" width="12" height="12" rx="2" fill="${STATE_COLORS[state]}"></rect>` + text(x - 5, legendY, STATE_LABELS[state], { anchor: "end", size: 11 });
  });
  return `${svg}</svg>`;
}

// ---------- 6. פעילות חודשית – רשומות חדשות לחודש (לדוח ול־Excel) ----------
export function monthlyActivitySvg(rows: Row[], today: Date) {
  const W = 600;
  const H = 240;
  const months = monthStarts(12, today);
  const values = months.map((month) => {
    const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const inMonth = rows.filter((row) => row.opened && row.opened >= month && row.opened < next);
    return { total: inMonth.length, ncr: inMonth.filter((row) => row.module === "nonconformances").length };
  });
  const max = Math.max(4, ...values.map((v) => v.total));
  const left = 50;
  const right = 580;
  const top = 20;
  const bottom = 190;
  const slot = (right - left) / months.length;
  let svg = svgOpen(W, H, "רשומות חדשות לפי חודש");
  [0, 0.5, 1].forEach((f) => {
    const value = Math.round(max * f);
    const y = bottom - (value / max) * (bottom - top);
    svg += `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="${GRID}"></line>` + text(left - 8, y + 4, value, { anchor: "end", size: 11 });
  });
  values.forEach((v, i) => {
    // RTL: החודש הוותיק מימין
    const x = right - (i + 1) * slot + slot * 0.2;
    const w = slot * 0.6;
    const hTotal = (v.total / max) * (bottom - top);
    const hNcr = (v.ncr / max) * (bottom - top);
    svg += `<rect x="${x.toFixed(1)}" y="${(bottom - hTotal).toFixed(1)}" width="${w.toFixed(1)}" height="${hTotal.toFixed(1)}" rx="2" fill="${NAVY}"></rect>`;
    if (hNcr) svg += `<rect x="${x.toFixed(1)}" y="${(bottom - hNcr).toFixed(1)}" width="${w.toFixed(1)}" height="${hNcr.toFixed(1)}" fill="${RED}"></rect>`;
    if (v.total) svg += text(x + w / 2, bottom - hTotal - 5, v.total, { size: 10, fill: NAVY });
    svg += text(x + w / 2, bottom + 16, monthLabel(months[i]), { size: 10 });
  });
  svg += `<rect x="560" y="${H - 20}" width="12" height="12" rx="2" fill="${NAVY}"></rect>` + text(555, H - 10, "כל הרשומות החדשות", { anchor: "end", size: 11 });
  svg += `<rect x="420" y="${H - 20}" width="12" height="12" rx="2" fill="${RED}"></rect>` + text(415, H - 10, "מתוכן אי־התאמות", { anchor: "end", size: 11 });
  return `${svg}</svg>`;
}

// SVG → PNG (לגיליון הגרפים ב־Excel)
export async function svgToPngBase64(svg: string, width: number, height: number, scale = 2): Promise<string> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas unavailable");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png").split(",")[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const svgSize = (svg: string) => {
  const match = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : { width: 600, height: 260 };
};
