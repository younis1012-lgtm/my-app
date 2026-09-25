"use client";

// המשימות שלי – מסך אישי שמרכז את מה שדורש את הטיפול של המשתמש עכשיו:
// חתימות ממתינות לפי תפקיד, פריטים באיחור, יעדים קרובים, רשומות שנדחו,
// תעודות מעבדה חדשות מהמייל ואישורים שעומד לפוג תוקפם.
// כל שורה פותחת ישירות את הרשומה.

import { useMemo, useState, type CSSProperties } from "react";
import {
  buildRows,
  fmt,
  isOverdue,
  MODULES,
  startOfDay,
  type ManagementDashboardProps,
  type ModuleKey,
  type Row,
} from "./ManagementDashboard";

type LabEmail = { id: string; from_email?: string; subject?: string; received_at?: string; seen?: boolean };

export type MyTasksProps = Omit<ManagementDashboardProps, "onOpenRecord" | "onNavigate"> & {
  userName: string;
  labEmails: LabEmail[];
  getPendingSignatureRoles: (record: Record<string, any>) => string[];
  onOpenRecord: (module: ModuleKey, id: string) => void;
  onOpenLabEmail: (id: string) => void;
  onNavigate: (section: string) => void;
};

type TaskKind = "sign" | "overdue" | "rejected" | "dueSoon" | "lab" | "expiring";

type Task = {
  key: string;
  kind: TaskKind;
  title: string;
  detail: string;
  location: string;
  date: Date | null;
  moduleShort: string;
  action: string;
  open: () => void;
  weight: number;
};

const NAVY = "#0b1f3a";
const DAY = 24 * 60 * 60 * 1000;
const ROLE_STORAGE_KEY = "yk-my-tasks-role";

const KIND_META: Record<TaskKind, { label: string; bg: string; fg: string }> = {
  overdue: { label: "באיחור", bg: "#fee2e2", fg: "#991b1b" },
  rejected: { label: "נדחה – לתיקון", bg: "#fee2e2", fg: "#991b1b" },
  sign: { label: "לחתימה", bg: "#fef3c7", fg: "#92400e" },
  dueSoon: { label: "יעד השבוע", bg: "#ffedd5", fg: "#9a3412" },
  lab: { label: "תעודה חדשה", bg: "#dbeafe", fg: "#1e3a8a" },
  expiring: { label: "תוקף פג בקרוב", bg: "#fef3c7", fg: "#92400e" },
};

const panel: CSSProperties = { background: "#fff", border: "1px solid #dbe3ee", borderRadius: 14, padding: 16, minWidth: 0 };

export function MyTasks(props: MyTasksProps) {
  const [role, setRole] = useState(() => {
    try {
      return typeof window === "undefined" ? "" : window.localStorage.getItem(ROLE_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [filter, setFilter] = useState<"all" | TaskKind>("all");
  const chooseRole = (value: string) => {
    setRole(value);
    try {
      window.localStorage.setItem(ROLE_STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  };

  const rows = useMemo(
    () => buildRows({ ...props, onNavigate: props.onNavigate }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.checklists, props.nonconformances, props.trialSections, props.preliminary, props.rfis, props.supervisionReports, props.holdPoints, props.structureNodes],
  );
  const today = useMemo(() => startOfDay(new Date()), []);
  const short = (module: ModuleKey) => MODULES.find((mod) => mod.key === module)?.short ?? module;

  const pendingByRow = useMemo(() => {
    const map = new Map<string, string[]>();
    rows.forEach((row) => {
      if (row.state === "closed" || row.state === "rejected") return;
      const roles = props.getPendingSignatureRoles(row.raw).filter(Boolean);
      if (roles.length) map.set(`${row.module}:${row.id}`, roles);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const allRoles = useMemo(() => {
    const set = new Set<string>();
    pendingByRow.forEach((roles) => roles.forEach((value) => set.add(value)));
    return [...set].sort((a, b) => a.localeCompare(b, "he"));
  }, [pendingByRow]);

  const tasks = useMemo(() => {
    const list: Task[] = [];
    const openRow = (row: Row) => () => props.onOpenRecord(row.module, row.id);
    const base = (row: Row) => ({ title: row.title, location: row.location, moduleShort: short(row.module), open: openRow(row) });
    rows.forEach((row) => {
      const key = `${row.module}:${row.id}`;
      if (row.module !== "preliminary" && isOverdue(row, today)) {
        const late = Math.floor((today.getTime() - (row.due as Date).getTime()) / DAY);
        list.push({ ...base(row), key: `o-${key}`, kind: "overdue", detail: `עבר תאריך היעד לפני ${late} ימים · ${row.statusText}`, date: row.due, action: "טפל ←", weight: 100 + late });
      } else if (row.state === "rejected" && row.module !== "preliminary") {
        list.push({ ...base(row), key: `r-${key}`, kind: "rejected", detail: row.statusText, date: row.opened, action: "תקן ←", weight: 90 });
      } else if (row.state !== "closed" && row.due && row.module !== "preliminary") {
        const left = Math.floor((row.due.getTime() - today.getTime()) / DAY);
        if (left >= 0 && left <= 7) list.push({ ...base(row), key: `d-${key}`, kind: "dueSoon", detail: left === 0 ? "היעד היום" : `היעד בעוד ${left} ימים`, date: row.due, action: "פתח ←", weight: 70 - left });
      }
      if (row.module === "preliminary") {
        if (row.state === "rejected" && row.due) {
          list.push({ ...base(row), key: `x-${key}`, kind: "expiring", detail: `התוקף פג ב־${fmt(row.due)} – נדרש אישור מחודש`, date: row.due, action: "חדש אישור ←", weight: 85 });
        } else if (row.due) {
          const left = Math.floor((row.due.getTime() - today.getTime()) / DAY);
          if (left >= 0 && left <= 30) list.push({ ...base(row), key: `x-${key}`, kind: "expiring", detail: `התוקף פג בעוד ${left} ימים (${fmt(row.due)})`, date: row.due, action: "פתח ←", weight: 60 - left });
        }
      }
      const roles = pendingByRow.get(key);
      if (roles && (!role || roles.includes(role))) {
        list.push({ ...base(row), key: `s-${key}`, kind: "sign", detail: `ממתין לחתימת: ${roles.join(", ")}`, date: row.opened, action: "חתום ←", weight: 80 });
      }
    });
    props.labEmails
      .filter((mail) => !mail.seen)
      .forEach((mail) => {
        const received = mail.received_at ? new Date(mail.received_at) : null;
        list.push({
          key: `l-${mail.id}`,
          kind: "lab",
          title: mail.subject || "תעודת בדיקה ממעבדה",
          detail: `התקבל מ־${mail.from_email || "מעבדה"} – לשייך לרשימת התיוג המתאימה`,
          location: "",
          date: received && !Number.isNaN(received.getTime()) ? received : null,
          moduleShort: "מעבדה",
          action: "פתח ←",
          open: () => props.onOpenLabEmail(mail.id),
          weight: 75,
        });
      });
    return list.sort((a, b) => b.weight - a.weight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, pendingByRow, role, props.labEmails, today]);

  const counts = (kind: TaskKind) => tasks.filter((task) => task.kind === kind).length;
  const visible = filter === "all" ? tasks : tasks.filter((task) => task.kind === filter);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "בוקר טוב" : hour < 17 ? "צהריים טובים" : "ערב טוב";

  const tiles: Array<{ kind: TaskKind; label: string; color: string }> = [
    { kind: "overdue", label: "באיחור", color: "#b91c1c" },
    { kind: "sign", label: "ממתין לחתימה", color: "#b45309" },
    { kind: "dueSoon", label: "יעד השבוע", color: "#c2410c" },
    { kind: "lab", label: "תעודות מעבדה חדשות", color: NAVY },
    { kind: "expiring", label: "תוקף אישורים", color: "#b45309" },
    { kind: "rejected", label: "נדחו – לתיקון", color: "#b91c1c" },
  ];

  const chip = (key: "all" | TaskKind, label: string, count: number) => (
    <button
      key={key}
      type="button"
      onClick={() => setFilter(key)}
      aria-pressed={filter === key}
      style={{
        border: `1px solid ${filter === key ? NAVY : "#cbd5e1"}`,
        background: filter === key ? NAVY : "#fff",
        color: filter === key ? "#fff" : NAVY,
        borderRadius: 8,
        padding: "8px 14px",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {label} ({count})
    </button>
  );

  return (
    <section dir="rtl" style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#9a7410" }}>
            {greeting}{props.userName ? `, ${props.userName}` : ""} · {props.projectName}
          </div>
          <h2 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 900, color: NAVY }}>המשימות שלי</h2>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, color: NAVY }}>
          התפקיד שלי לחתימות:
          <select value={role} onChange={(event) => chooseRole(event.target.value)} style={{ font: "inherit", padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", minWidth: 180 }}>
            <option value="">כל התפקידים</option>
            {allRoles.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
            {role && !allRoles.includes(role) ? <option value={role}>{role}</option> : null}
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))", gap: 12 }}>
        {tiles.map((tile) => (
          <button
            key={tile.kind}
            type="button"
            onClick={() => setFilter(tile.kind)}
            style={{ ...panel, textAlign: "right", cursor: "pointer", borderTop: `4px solid ${tile.color}`, font: "inherit" }}
          >
            <div style={{ fontSize: 13, color: "#475569", fontWeight: 800 }}>{tile.label}</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: counts(tile.kind) ? tile.color : "#94a3b8" }}>{counts(tile.kind)}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {chip("all", "הכול", tasks.length)}
        {tiles.map((tile) => chip(tile.kind, tile.label, counts(tile.kind)))}
      </div>

      <div style={{ ...panel, padding: 0, overflow: "hidden" }}>
        {visible.length ? (
          visible.map((task) => {
            const meta = KIND_META[task.kind];
            return (
              <button
                key={task.key}
                type="button"
                onClick={task.open}
                style={{
                  display: "grid",
                  gridTemplateColumns: "118px minmax(0, 1fr) auto auto",
                  gap: 12,
                  alignItems: "center",
                  width: "100%",
                  padding: "14px 18px",
                  border: 0,
                  borderBottom: "1px solid #eef2f7",
                  background: task.kind === "overdue" || task.kind === "rejected" ? "#fef6f6" : "#fff",
                  textAlign: "right",
                  font: "inherit",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 900, background: meta.bg, color: meta.fg, borderRadius: 6, padding: "4px 8px", textAlign: "center" }}>{meta.label}</span>
                <span style={{ minWidth: 0 }}>
                  <b style={{ display: "block", color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ color: "#64748b", fontWeight: 800, fontSize: 12 }}>{task.moduleShort} · </span>
                    {task.title}
                  </b>
                  <small style={{ color: meta.fg, fontWeight: 700 }}>{task.detail}</small>
                  {task.location ? <small style={{ color: "#64748b" }}> · {task.location}</small> : null}
                </span>
                <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>{fmt(task.date)}</span>
                <span style={{ color: "#1d4ed8", fontWeight: 900, whiteSpace: "nowrap" }}>{task.action}</span>
              </button>
            );
          })
        ) : (
          <div style={{ padding: 24, color: "#0f766e", fontWeight: 800 }}>✓ אין משימות פתוחות בקטגוריה הזו</div>
        )}
      </div>
    </section>
  );
}
