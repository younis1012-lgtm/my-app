"use client";

import { useMemo, useState } from "react";

type Props = {
  savedChecklists?: any[];
  savedNonconformances?: any[];
  savedTrialSections?: any[];
  savedPreliminary?: any[];
  currentProjectName?: string;
};

type ConcentrationTemplate = {
  id: string;
  title: string;
  fileName: string;
  description: string;
  keywords: string[];
  source: "checklists" | "nonconformances" | "trialSections" | "preliminary";
};

const templateFiles: ConcentrationTemplate[] = [
  { id: "nonconformances", title: "דוח ריכוז אי התאמות", fileName: "דוח ריכוז אי התאמות.xlsx", description: "תבנית מקורית של ריכוז אי התאמות, ללא ערכי פרויקט קודם", keywords: ["אי התאמה", "אי תאמות"], source: "nonconformances" },
  { id: "suppliers", title: "ריכוז ספקים", fileName: "ריכוז ספקים.xlsx", description: "תבנית מקורית של ריכוז ספקים", keywords: ["ספק", "ספקים"], source: "preliminary" },
  { id: "contractors", title: "ריכוז קבלנים", fileName: "ריכוז קבלנים.xlsx", description: "תבנית מקורית של ריכוז קבלנים", keywords: ["קבלן", "קבלנים", "קבלן משנה"], source: "preliminary" },
  { id: "asphalt", title: "ריכוז בדיקות אספלט", fileName: "ריכוז בדיקות אספלט.xlsx", description: "תבנית מקורית של ריכוז בדיקות אספלט", keywords: ["אספלט", "FWD", "שכבה סופית", "מישוריות"], source: "checklists" },
  { id: "density", title: "ריכוז בדיקות צפיפות", fileName: "ריכוז בדיקות צפיפות.xlsx", description: "תבנית מקורית של ריכוז צפיפות / הידוק / רטיבות", keywords: ["צפיפות", "הידוק", "רטיבות", "דרגת", "תכולת", "מצע", "מצעים"], source: "checklists" },
  { id: "concrete", title: "ריכוז בטון", fileName: "ריכוז בטון.xlsx", description: "תבנית מקורית של ריכוז בטון", keywords: ["בטון", "יציקה", "קוביות", "חוזק"], source: "checklists" },
  { id: "supervision", title: "ריכוז דוחות פיקוח עליון", fileName: "ריכוז דוחות פיקוח עליון.xlsx", description: "תבנית מקורית של דוחות פיקוח עליון", keywords: ["פיקוח עליון", "דוח פיקוח"], source: "trialSections" },
  { id: "materials", title: "ריכוז חומרים", fileName: "ריכוז חומרים.xlsx", description: "תבנית מקורית של ריכוז חומרים", keywords: ["חומר", "חומרים", "תקן", "מפרט", "תעודת התאמה"], source: "preliminary" },
  { id: "trial-sections", title: "ריכוז קטעי ניסוי", fileName: "ריכוז קטעי ניסוי.xlsx", description: "תבנית מקורית של קטעי ניסוי", keywords: ["קטע ניסוי", "קטעי ניסוי"], source: "trialSections" },
  { id: "subbase-a", title: "ריכוז אפיון מצע א׳", fileName: "ריכוז אפיון מצע א.xlsx", description: "תבנית מקורית של אפיון מצע א׳", keywords: ["אפיון מצע", "מצע א", "מצע א׳", "CBR", "גרדציה"], source: "checklists" },
  { id: "selected-material", title: "ריכוז אפיון נברר", fileName: "ריכוז אפיון נברר.xlsx", description: "תבנית מקורית של אפיון חומר נברר", keywords: ["נברר", "חומר נברר", "אפיון נברר", "CBR", "גרדציה"], source: "checklists" },
];

const normalize = (value: unknown) => String(value ?? "").toLowerCase();

const recordText = (record: any) => {
  if (!record) return "";
  const parts: string[] = [record.title, record.category, record.location, record.contractor, record.status, record.description, record.notes, record.subtype];
  if (Array.isArray(record.items)) {
    record.items.forEach((item: any) => parts.push(item.description, item.notes, item.status, item.inspector, item.responsible));
  }
  if (record.supplier) parts.push(record.supplier.supplierName, record.supplier.suppliedMaterial, record.supplier.notes);
  if (record.subcontractor) parts.push(record.subcontractor.subcontractorName, record.subcontractor.field, record.subcontractor.notes);
  if (record.material) parts.push(record.material.materialName, record.material.source, record.material.usage, record.material.notes);
  return normalize(parts.filter(Boolean).join(" "));
};

const getFileUrl = (fileName: string) => `/concentrations/${encodeURIComponent(fileName)}`;

export function ConcentrationsSection({
  savedChecklists = [],
  savedNonconformances = [],
  savedTrialSections = [],
  savedPreliminary = [],
  currentProjectName = "",
}: Props) {
  const [search, setSearch] = useState("");

  const sourceMap = useMemo(() => ({
    checklists: savedChecklists,
    nonconformances: savedNonconformances,
    trialSections: savedTrialSections,
    preliminary: savedPreliminary,
  }), [savedChecklists, savedNonconformances, savedTrialSections, savedPreliminary]);

  const templates = useMemo(() => {
    const q = normalize(search).trim();
    return templateFiles
      .map((template) => {
        const rows = sourceMap[template.source] ?? [];
        const matches = rows.filter((record: any) => {
          const text = recordText(record);
          return template.keywords.some((keyword) => text.includes(normalize(keyword)));
        });
        return { ...template, matchesCount: matches.length };
      })
      .filter((template) => !q || normalize(`${template.title} ${template.description}`).includes(q));
  }, [search, sourceMap]);

  return (
    <section dir="rtl" style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>ריכוזים</h2>
          <div style={{ color: "#64748b", marginTop: 6, lineHeight: 1.6 }}>
            התבניות כאן מבוססות על קבצי האקסל המקוריים שצורפו. הערכים הישנים נמחקו, הכותרות והמבנה נשמרו, וניתן להוריד ריכוז גם כשהוא ריק.
          </div>
          {currentProjectName ? <div style={{ color: "#0f172a", fontWeight: 800, marginTop: 6 }}>פרויקט נוכחי: {currentProjectName}</div> : null}
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="חיפוש ריכוז..."
          style={{ width: 260, border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 14px", fontWeight: 700 }}
        />
      </div>

      <div style={{ border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 16, padding: 14, color: "#713f12", fontWeight: 800, lineHeight: 1.7 }}>
        בשלב זה ההורדה מחזירה את אותה תבנית אקסל בדיוק, לאחר ניקוי הערכים מפרויקט קודם. בהמשך, כאשר יוזנו תוצאות מתעודות בדיקה, הריכוז יוכל להתמלא אוטומטית לפי סוג התעודה והרשימה.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        {templates.map((template) => (
          <div key={template.id} style={{ border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#fff", boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{template.title}</div>
                <div style={{ color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>{template.description}</div>
              </div>
              <span style={{ borderRadius: 999, background: "#eef2ff", color: "#3730a3", padding: "5px 10px", fontWeight: 900, whiteSpace: "nowrap" }}>
                {template.matchesCount} תוצאות
              </span>
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              <a
                href={getFileUrl(template.fileName)}
                download={template.fileName}
                style={{ display: "inline-flex", justifyContent: "center", alignItems: "center", textDecoration: "none", border: "1px solid #0f172a", borderRadius: 12, padding: "10px 12px", fontWeight: 900, color: "#0f172a", background: "#fff" }}
              >
                הורד תבנית ריקה מקורית Excel
              </a>
              <div style={{ fontSize: 12, color: "#64748b", direction: "ltr", textAlign: "right" }}>{template.fileName}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
