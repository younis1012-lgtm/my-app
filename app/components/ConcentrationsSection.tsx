"use client";

import { useMemo, useState } from "react";

type Props = {
  savedChecklists?: any[];
  savedNonconformances?: any[];
  savedTrialSections?: any[];
  savedPreliminary?: any[];
  currentProjectName?: string;
};

type SourceType = "checklists" | "nonconformances" | "trialSections" | "preliminary";

type ConcentrationTemplate = {
  id: string;
  title: string;
  fileName: string;
  description: string;
  keywords: string[];
  source: SourceType;
};

// ⚠️ חשוב:
// שמות הקבצים כאן חייבים להיות זהים 1:1 לשמות שבתיקייה:
// public/concentrations
// אין שינוי עיצוב, אין בנייה מחדש של Excel, אין XLSX.write.
// לכן הקובץ שיורד נשאר זהה לחלוטין לתבנית המקורית.
const templates: ConcentrationTemplate[] = [
  {
    id: "field-earthworks",
    title: "בדיקות שדה - עבודות עפר",
    fileName: "בדיקות  שדה - עבודות עפר.xlsx",
    description: "תבנית מקורית מתוך תיקיית ריכוזים מערכת",
    keywords: ["בדיקות שדה", "עבודות עפר", "עפר", "שדה"],
    source: "checklists",
  },
  {
    id: "nonconformances",
    title: "דוח ריכוז אי התאמות",
    fileName: "דוח ריכוז אי התאמות .xlsx",
    description: "תבנית מקורית מתוך תיקיית ריכוזים מערכת",
    keywords: ["אי התאמה", "אי תאמות"],
    source: "nonconformances",
  },
  {
    id: "suppliers",
    title: "ריכוז ספקים",
    fileName: "ריכוז  ספקים.xlsx",
    description: "תבנית מקורית מתוך תיקיית ריכוזים מערכת",
    keywords: ["ספק", "ספקים"],
    source: "preliminary",
  },
  {
    id: "contractors",
    title: "ריכוז קבלנים",
    fileName: "ריכוז  קבלנים.xlsx",
    description: "תבנית מקורית מתוך תיקיית ריכוזים מערכת",
    keywords: ["קבלן", "קבלנים", "קבלן משנה"],
    source: "preliminary",
  },
  {
    id: "asphalt",
    title: "ריכוז בדיקות אספלט",
    fileName: "ריכוז בדיקות אספלט.xlsx",
    description: "תבנית מקורית מתוך תיקיית ריכוזים מערכת",
    keywords: ["אספלט", "FWD", "שכבה סופית", "מישוריות"],
    source: "checklists",
  },
  {
    id: "density-subbase-a",
    title: "ריכוז בדיקות צפיפות מצע א׳",
    fileName: "ריכוז בדיקות צפיפות מצע א.xlsx",
    description: "תבנית מקורית מתוך תיקיית ריכוזים מערכת",
    keywords: ["צפיפות", "הידוק", "רטיבות", "דרגת", "תכולת", "מצע", "מצעים"],
    source: "checklists",
  },
  {
    id: "concrete",
    title: "ריכוז בטון",
    fileName: "ריכוז בטון .xlsx",
    description: "תבנית מקורית מתוך תיקיית ריכוזים מערכת",
    keywords: ["בטון", "יציקה", "קוביות", "חוזק"],
    source: "checklists",
  },
  {
    id: "supervision",
    title: "ריכוז דוחות פיקוח עליון",
    fileName: "ריכוז דוחות פיקוח עליון.xlsx",
    description: "תבנית מקורית מתוך תיקיית ריכוזים מערכת",
    keywords: ["פיקוח עליון", "דוח פיקוח"],
    source: "trialSections",
  },
  {
    id: "materials",
    title: "ריכוז חומרים",
    fileName: "ריכוז חומרים.xlsx",
    description: "תבנית מקורית מתוך תיקיית ריכוזים מערכת",
    keywords: ["חומר", "חומרים", "תקן", "מפרט", "תעודת התאמה"],
    source: "preliminary",
  },
  {
    id: "trial-sections",
    title: "ריכוז קטעי ניסוי",
    fileName: "ריכוז קטעי ניסוי.xlsx",
    description: "תבנית מקורית מתוך תיקיית ריכוזים מערכת",
    keywords: ["קטע ניסוי", "קטעי ניסוי"],
    source: "trialSections",
  },
  {
    id: "subbase-a-characterization",
    title: "רכוז אפיון מצע א׳",
    fileName: "רכוז אפיון מצע א.xlsx",
    description: "תבנית מקורית מתוך תיקיית ריכוזים מערכת",
    keywords: ["אפיון מצע", "מצע א", "מצע א׳", "CBR", "גרדציה", "מצע"],
    source: "checklists",
  },
  {
    id: "selected-material-characterization",
    title: "רכוז אפיון נברר",
    fileName: "רכוז אפיון נברר.xlsx",
    description: "תבנית מקורית מתוך תיקיית ריכוזים מערכת",
    keywords: ["נברר", "חומר נברר", "אפיון נברר", "CBR", "גרדציה"],
    source: "checklists",
  },
];

const normalize = (value: unknown) =>
  String(value ?? "")
    .replace(/[׳`’']/g, "")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const includesAny = (text: string, keywords: string[]) => {
  const n = normalize(text);
  return keywords.some((keyword) => n.includes(normalize(keyword)));
};

const getTemplateUrl = (fileName: string) => `/concentrations/${encodeURIComponent(fileName)}`;

const recordText = (record: any) => {
  const parts: unknown[] = [
    record?.title,
    record?.category,
    record?.location,
    record?.contractor,
    record?.status,
    record?.description,
    record?.notes,
    record?.subtype,
  ];

  if (Array.isArray(record?.items)) {
    record.items.forEach((item: any) => {
      parts.push(item?.description, item?.notes, item?.status, item?.inspector, item?.responsible);
      if (Array.isArray(item?.attachments)) {
        item.attachments.forEach((attachment: any) => parts.push(attachment?.name, attachment?.kind));
      }
    });
  }

  if (record?.supplier) parts.push(record.supplier.supplierName, record.supplier.suppliedMaterial, record.supplier.notes, record.supplier.approvalNo);
  if (record?.subcontractor) parts.push(record.subcontractor.subcontractorName, record.subcontractor.field, record.subcontractor.notes, record.subcontractor.approvalNo);
  if (record?.material) parts.push(record.material.materialName, record.material.source, record.material.usage, record.material.notes, record.material.certificateNo);

  return parts.filter(Boolean).join(" ");
};

const countMatches = (template: ConcentrationTemplate, sourceRows: any[]) => {
  if (!Array.isArray(sourceRows)) return 0;

  if (template.source === "checklists") {
    let count = 0;
    sourceRows.forEach((checklist) => {
      (Array.isArray(checklist?.items) ? checklist.items : []).forEach((item: any) => {
        const attachments = Array.isArray(item?.attachments) ? item.attachments : [];
        attachments.forEach((attachment: any) => {
          const text = [recordText(checklist), item?.description, item?.notes, attachment?.name, attachment?.kind].join(" ");
          if (includesAny(text, template.keywords)) count += 1;
        });
      });
    });
    return count;
  }

  return sourceRows.filter((record) => includesAny(recordText(record), template.keywords)).length;
};

const sourceRowsForTemplate = (
  template: ConcentrationTemplate,
  savedChecklists: any[],
  savedNonconformances: any[],
  savedTrialSections: any[],
  savedPreliminary: any[]
) => {
  if (template.source === "checklists") return savedChecklists;
  if (template.source === "nonconformances") return savedNonconformances;
  if (template.source === "trialSections") return savedTrialSections;
  return savedPreliminary;
};

function downloadOriginalTemplate(template: ConcentrationTemplate) {
  const link = document.createElement("a");
  link.href = getTemplateUrl(template.fileName);
  link.download = template.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function ConcentrationsSection({
  savedChecklists = [],
  savedNonconformances = [],
  savedTrialSections = [],
  savedPreliminary = [],
  currentProjectName = "",
}: Props) {
  const [search, setSearch] = useState("");

  const visibleTemplates = useMemo(() => {
    const q = normalize(search);
    return templates
      .map((template) => {
        const rows = sourceRowsForTemplate(template, savedChecklists, savedNonconformances, savedTrialSections, savedPreliminary);
        return { ...template, matchesCount: countMatches(template, rows) };
      })
      .filter((template) => !q || normalize(`${template.title} ${template.description} ${template.fileName}`).includes(q));
  }, [search, savedChecklists, savedNonconformances, savedTrialSections, savedPreliminary]);

  return (
    <section dir="rtl" style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>ריכוזים</h2>
          <div style={{ color: "#64748b", marginTop: 6, lineHeight: 1.6 }}>
            הריכוזים מחוברים עכשיו לקבצים המקוריים שבתיקייה <span dir="ltr">public/concentrations</span>. ההורדה לא בונה קובץ חדש ולא משנה עיצוב — היא מורידה את התבנית המקורית אחד לאחד.
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

      <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 16, padding: 14, color: "#1e3a8a", fontWeight: 800, lineHeight: 1.7 }}>
        חשוב: כדי שהקובץ ייראה בדיוק כמו המקור, כל הקבצים מתוך תיקיית "ריכוזים מערכת" צריכים להיות בתוך <span dir="ltr">public/concentrations</span>. בשלב הבא נעדכן מילוי אוטומטי לתוך התבניות בלי לפגוע בעיצוב.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        {visibleTemplates.map((template) => (
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

            <div style={{ marginTop: 12, minHeight: 38, color: template.matchesCount ? "#166534" : "#64748b", fontWeight: 800 }}>
              {template.matchesCount ? `נמצאו ${template.matchesCount} תעודות/רשומות שיתחברו בשלב המילוי הבא.` : "אין עדיין תוצאות — ניתן להוריד את התבנית המקורית ריקה."}
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              <button
                type="button"
                onClick={() => downloadOriginalTemplate(template)}
                style={{ border: 0, borderRadius: 12, padding: "12px 14px", fontWeight: 900, color: "#fff", background: "#0f172a", cursor: "pointer" }}
              >
                הורד ריכוז מקור Excel
              </button>
              <div style={{ fontSize: 12, color: "#64748b", direction: "ltr", textAlign: "right" }}>{template.fileName}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ConcentrationsSection;
