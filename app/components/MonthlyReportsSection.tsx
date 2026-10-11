"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { hebrewMonthName, type MonthlyReportConfig } from "../lib/monthlyReport";

export type MonthlyReportSummary = {
  checklists: number;
  nonconformances: number;
  trialSections: number;
  supervision: number;
  preliminary: number;
  reportNo: number;
};

// תמונת שער: הקטנה ל-1400 פיקסלים ו-JPEG – כדי שלא תכביד על פרטי הפרויקט
const shrinkCoverImage = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("לא ניתן לקרוא את התמונה"));
    };
    image.src = url;
  });

// דוחות חודשיים: הגדרות הדוח לפרויקט + הפקת דוח Word לחודש נבחר מתוך מה שדווח במערכת.
export function MonthlyReportsSection({
  projectName,
  config,
  canEnable,
  canEdit,
  onEnable,
  onSaveConfig,
  summaryFor,
  onGenerate,
}: {
  projectName: string;
  config: MonthlyReportConfig | null;
  canEnable: boolean;
  canEdit: boolean;
  onEnable: () => void;
  onSaveConfig: (config: MonthlyReportConfig) => Promise<void> | void;
  summaryFor: (year: number, month: number, config: MonthlyReportConfig) => MonthlyReportSummary;
  onGenerate: (year: number, month: number, config: MonthlyReportConfig) => Promise<void>;
}) {
  const previousMonth = () => {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  };
  const [monthValue, setMonthValue] = useState(previousMonth);
  const [draft, setDraft] = useState<MonthlyReportConfig | null>(config);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    setDraft(config);
    setDirty(false);
  }, [config]);

  const [year, month] = monthValue.split("-").map(Number);
  const summary = useMemo(
    () => (draft && year && month ? summaryFor(year, month, draft) : null),
    [draft, year, month, summaryFor],
  );

  const card: CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, background: "#fff" };
  const label: CSSProperties = { display: "grid", gap: 4, fontSize: 13, fontWeight: 800, color: "#334155" };
  const input: CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 10, padding: "8px 10px", fontSize: 14, fontFamily: "inherit", background: canEdit ? "#fff" : "#f8fafc" };
  const btn: CSSProperties = { height: 40, padding: "0 16px", borderRadius: 10, border: "1px solid #c9d2df", background: "#fff", color: "#0b1f3a", fontWeight: 800, cursor: "pointer" };
  const primary: CSSProperties = { ...btn, border: 0, background: "#0b1f3a", color: "#fff" };

  if (!config || !draft) {
    return (
      <section style={{ display: "grid", gap: 16 }}>
        <h2 style={{ margin: 0 }}>דוחות חודשיים</h2>
        <div style={card}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>דוחות חודשיים אינם מופעלים בפרויקט {projectName}.</div>
          <div style={{ color: "#64748b", marginBottom: 12 }}>
            לאחר ההפעלה המערכת תפיק דוח בקרת איכות חודשי (Word) מתוך רשימות התיוג, אי ההתאמות, קטעי הניסוי, הבקרה המקדימה ודוחות הפיקוח העליון שדווחו בחודש.
          </div>
          {canEnable ? (
            <button type="button" style={primary} onClick={onEnable}>
              הפעלת דוחות חודשיים לפרויקט זה
            </button>
          ) : (
            <div style={{ color: "#64748b" }}>ההפעלה – למנהל המערכת.</div>
          )}
        </div>
      </section>
    );
  }

  const field = (key: keyof MonthlyReportConfig, title: string, options: { multiline?: boolean; rows?: number; placeholder?: string; ltr?: boolean } = {}) => (
    <label style={label}>
      {title}
      {options.multiline ? (
        <textarea
          style={{ ...input, minHeight: (options.rows ?? 3) * 22, resize: "vertical" }}
          disabled={!canEdit}
          placeholder={options.placeholder}
          value={String(draft[key] ?? "")}
          onChange={(event) => {
            setDraft({ ...draft, [key]: event.target.value });
            setDirty(true);
          }}
        />
      ) : (
        <input
          style={input}
          dir={options.ltr ? "ltr" : undefined}
          disabled={!canEdit}
          placeholder={options.placeholder}
          value={String(draft[key] ?? "")}
          onChange={(event) => {
            setDraft({ ...draft, [key]: event.target.value });
            setDirty(true);
          }}
        />
      )}
    </label>
  );

  const generate = async () => {
    if (!year || !month) return;
    setBusy(true);
    try {
      if (dirty && canEdit) {
        await onSaveConfig(draft);
        setDirty(false);
      }
      await onGenerate(year, month, draft);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div>
        <h2 style={{ margin: 0 }}>דוחות חודשיים</h2>
        <div style={{ color: "#64748b", marginTop: 4 }}>
          דוח בקרת איכות חודשי לפרויקט {projectName}, נבנה מהמידע שדווח במערכת בחודש הנבחר. הדוח יורד כקובץ Word להמשך עריכה והוספת תמונות.
        </div>
      </div>

      <div style={{ ...card, display: "grid", gap: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={label}>
            חודש הדוח
            <input type="month" style={{ ...input, background: "#fff" }} value={monthValue} onChange={(event) => setMonthValue(event.target.value)} />
          </label>
          <button type="button" style={primary} disabled={busy} onClick={() => void generate()}>
            {busy ? "מכין את הדוח…" : `הפקת דוח ${month ? hebrewMonthName(month) : ""} ${year || ""} (Word)`}
          </button>
        </div>
        {summary ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              ["דוח מס'", summary.reportNo],
              ["רשימות תיוג בחודש", summary.checklists],
              ["אי התאמות שנפתחו", summary.nonconformances],
              ["בקרה מקדימה", summary.preliminary],
              ["קטעי ניסוי", summary.trialSections],
              ["דוחות פיקוח עליון", summary.supervision],
            ].map(([title, value]) => (
              <div key={String(title)} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "8px 14px", minWidth: 110, background: "#f8fafc" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#0b1f3a" }}>{value}</div>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>{title}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div style={card}>
        <button type="button" style={{ ...btn, width: "100%", textAlign: "right" }} onClick={() => setSettingsOpen((value) => !value)}>
          {settingsOpen ? "▾" : "◂"} פרטי הדוח הקבועים (נמען, תיאור הפרויקט, העתקים, נספחים)
        </button>
        {settingsOpen ? (
          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              {field("recipientName", "לכבוד – שם")}
              {field("recipientCompany", "לכבוד – חברה")}
              {field("clientName", "מזמין העבודה")}
              {field("contractNo", "מס' חוזה / מכרז", { ltr: true })}
              {field("signerTitle", "תפקיד החותם")}
              {field("firstMonth", "חודש הדוח הראשון (למספור)", { placeholder: "2026-09", ltr: true })}
            </div>
            {field("projectDescription", "תיאור הפרויקט (שורה לכל סעיף)", { multiline: true, rows: 7 })}
            {field("copies", "העתקים (שורה לכל נמען)", { multiline: true, rows: 3 })}
            {field("appendices", "נספחים (שורה לכל נספח)", { multiline: true, rows: 4 })}
            <div style={label}>
              תמונת שער (מפת הפרויקט / תצ"א) – מופיעה בעמוד הראשון של הדוח
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ width: 220, height: 140, border: "1px dashed #cbd5e1", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", overflow: "hidden" }}>
                  {draft.coverImage ? <img src={draft.coverImage} alt="תמונת שער" style={{ maxWidth: "100%", maxHeight: "100%" }} /> : <span style={{ color: "#94a3b8", fontSize: 12 }}>אין תמונה</span>}
                </div>
                {canEdit ? (
                  <label style={{ ...btn, display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                    {draft.coverImage ? "החלפת תמונה" : "העלאת תמונה"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      style={{ display: "none" }}
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        const image = await shrinkCoverImage(file);
                        setDraft({ ...draft, coverImage: image });
                        setDirty(true);
                      }}
                    />
                  </label>
                ) : null}
                {canEdit && draft.coverImage ? (
                  <button type="button" style={btn} onClick={() => { setDraft({ ...draft, coverImage: "" }); setDirty(true); }}>הסרת תמונה</button>
                ) : null}
              </div>
            </div>
            <div style={{ color: "#64748b", fontSize: 12 }}>
              הבקרה השוטפת בדוח בנויה לפי סוגי העבודות שבתיאור הפרויקט – כל שורה שמתחילה ב־"-" היא טבלה. סוג שלא בוצעו בו עבודות בחודש יופיע עם "בחודש המדווח לא בוצעו עבודות".
            </div>
            {canEdit ? (
              <div>
                <button
                  type="button"
                  style={{ ...primary, opacity: dirty ? 1 : 0.5 }}
                  disabled={!dirty}
                  onClick={async () => {
                    await onSaveConfig(draft);
                    setDirty(false);
                  }}
                >
                  שמירת פרטי הדוח
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
