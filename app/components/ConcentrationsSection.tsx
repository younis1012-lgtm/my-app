"use client";

import { useMemo, useState } from "react";

type ConcentrationColumn = {
  key: string;
  label: string;
  width?: number;
};

type ConcentrationTemplate = {
  id: string;
  name: string;
  description: string;
  sourceFile: string;
  match: string[];
  columns: ConcentrationColumn[];
};

type ConcentrationRow = Record<string, string | number | undefined>;

type Props = {
  savedChecklists?: any[];
  savedNonconformances?: any[];
  savedTrialSections?: any[];
  savedPreliminary?: any[];
  currentProjectName?: string;
};

const concentrationTemplates: ConcentrationTemplate[] = [
  {
    id: "asphalt-tests",
    name: "ריכוז בדיקות אספלט",
    description: "ריכוז תוצאות בדיקות אספלט מתוך תעודות מעבדה מצורפות",
    sourceFile: "ריכוז בדיקות אספלט.xlsx",
    match: ["אספלט", "FWD", "שכבה סופית", "מישוריות"],
    columns: [
      { key: "no", label: "מס׳" },
      { key: "date", label: "תאריך" },
      { key: "location", label: "מיקום / קטע" },
      { key: "layer", label: "שכבה" },
      { key: "testType", label: "סוג בדיקה" },
      { key: "certificateNo", label: "מס׳ תעודה" },
      { key: "certificateName", label: "שם תעודה מצורפת" },
      { key: "result", label: "תוצאה" },
      { key: "status", label: "סטטוס" },
      { key: "remarks", label: "הערות" },
    ],
  },
  {
    id: "density-tests",
    name: "ריכוז בדיקות צפיפות / הידוק",
    description: "ריכוז דרגת הידוק, צפיפות ותכולת רטיבות מתעודות מעבדה",
    sourceFile: "ריכוז בדיקות צפיפות.xlsx",
    match: ["צפיפות", "הידוק", "רטיבות", "דרגת", "תכולת", "מצעים", "מצע"],
    columns: [
      { key: "no", label: "מס׳" },
      { key: "date", label: "תאריך" },
      { key: "location", label: "מיקום" },
      { key: "material", label: "חומר / שכבה" },
      { key: "testType", label: "סוג בדיקה" },
      { key: "certificateNo", label: "מס׳ תעודה" },
      { key: "certificateName", label: "שם תעודה מצורפת" },
      { key: "compaction", label: "דרגת הידוק" },
      { key: "moisture", label: "תכולת רטיבות" },
      { key: "result", label: "תוצאה" },
      { key: "status", label: "סטטוס" },
      { key: "remarks", label: "הערות" },
    ],
  },
  {
    id: "concrete-tests",
    name: "ריכוז בדיקות בטון",
    description: "ריכוז תוצאות בדיקות בטון",
    sourceFile: "ריכוז בטון.xlsx",
    match: ["בטון", "יציקה", "קוביות", "חוזק"],
    columns: [
      { key: "no", label: "מס׳" },
      { key: "date", label: "תאריך" },
      { key: "location", label: "מיקום / אלמנט" },
      { key: "concreteType", label: "סוג בטון" },
      { key: "supplier", label: "ספק בטון" },
      { key: "certificateNo", label: "מס׳ תעודה" },
      { key: "certificateName", label: "שם תעודה מצורפת" },
      { key: "sampleNo", label: "מס׳ מדגם" },
      { key: "strength", label: "חוזק" },
      { key: "status", label: "סטטוס" },
      { key: "remarks", label: "הערות" },
    ],
  },
  {
    id: "materials",
    name: "ריכוז חומרים",
    description: "ריכוז אישורי חומרים ותעודות התאמה",
    sourceFile: "ריכוז חומרים.xlsx",
    match: ["חומר", "חומרים", "תעודת התאמה", "תקן", "מפרט"],
    columns: [
      { key: "no", label: "מס׳" },
      { key: "date", label: "תאריך" },
      { key: "materialName", label: "שם החומר" },
      { key: "supplier", label: "ספק / יצרן" },
      { key: "usage", label: "שימוש" },
      { key: "certificateNo", label: "מס׳ תעודה / אישור" },
      { key: "certificateName", label: "שם מסמך מצורף" },
      { key: "standard", label: "תקן / מפרט" },
      { key: "status", label: "סטטוס אישור" },
      { key: "remarks", label: "הערות" },
    ],
  },
  {
    id: "subcontractors",
    name: "ריכוז קבלנים",
    description: "ריכוז אישורי קבלני משנה",
    sourceFile: "ריכוז קבלנים.xlsx",
    match: ["קבלן", "קבלנים", "קבלן משנה"],
    columns: [
      { key: "no", label: "מס׳" },
      { key: "date", label: "תאריך" },
      { key: "subcontractor", label: "שם קבלן משנה" },
      { key: "field", label: "תחום עבודה" },
      { key: "contact", label: "איש קשר" },
      { key: "approvalNo", label: "מס׳ אישור" },
      { key: "status", label: "סטטוס" },
      { key: "remarks", label: "הערות" },
    ],
  },
  {
    id: "suppliers",
    name: "ריכוז ספקים",
    description: "ריכוז אישורי ספקים",
    sourceFile: "ריכוז ספקים.xlsx",
    match: ["ספק", "ספקים", "יצרן"],
    columns: [
      { key: "no", label: "מס׳" },
      { key: "date", label: "תאריך" },
      { key: "supplier", label: "שם ספק" },
      { key: "material", label: "חומר מסופק" },
      { key: "contact", label: "איש קשר" },
      { key: "approvalNo", label: "מס׳ אישור" },
      { key: "status", label: "סטטוס" },
      { key: "remarks", label: "הערות" },
    ],
  },
  {
    id: "supervision",
    name: "ריכוז דוחות פיקוח עליון",
    description: "ריכוז דוחות פיקוח עליון",
    sourceFile: "ריכוז דוחות פיקוח עליון.xlsx",
    match: ["פיקוח עליון", "דוח פיקוח"],
    columns: [
      { key: "no", label: "מס׳" },
      { key: "date", label: "תאריך" },
      { key: "reportNo", label: "מס׳ דוח" },
      { key: "subject", label: "נושא" },
      { key: "inspector", label: "גורם מבקר" },
      { key: "findings", label: "ממצאים" },
      { key: "status", label: "סטטוס" },
      { key: "remarks", label: "הערות" },
    ],
  },
  {
    id: "trial-sections",
    name: "ריכוז קטעי ניסוי",
    description: "ריכוז דוחות קטעי ניסוי",
    sourceFile: "ריכוז קטעי ניסוי.xlsx",
    match: ["קטע ניסוי", "קטעי ניסוי"],
    columns: [
      { key: "no", label: "מס׳" },
      { key: "date", label: "תאריך" },
      { key: "trialName", label: "שם קטע ניסוי" },
      { key: "location", label: "מיקום" },
      { key: "material", label: "חומר / שכבה" },
      { key: "method", label: "שיטת ביצוע" },
      { key: "result", label: "תוצאה" },
      { key: "status", label: "סטטוס" },
      { key: "remarks", label: "הערות" },
    ],
  },
  {
    id: "subbase-a-characterization",
    name: "ריכוז אפיון מצע א׳",
    description: "ריכוז תוצאות אפיון מצע א׳",
    sourceFile: "ריכוז אפיון מצע א.xlsx",
    match: ["אפיון מצע", "מצע א", "מצע א׳", "CBR", "גרדציה"],
    columns: [
      { key: "no", label: "מס׳" },
      { key: "date", label: "תאריך" },
      { key: "source", label: "מקור חומר" },
      { key: "sampleNo", label: "מס׳ מדגם" },
      { key: "certificateNo", label: "מס׳ תעודה" },
      { key: "certificateName", label: "שם תעודה מצורפת" },
      { key: "gradation", label: "דירוג / גרדציה" },
      { key: "plasticity", label: "פלסטיות" },
      { key: "cbr", label: "CBR" },
      { key: "status", label: "סטטוס" },
      { key: "remarks", label: "הערות" },
    ],
  },
  {
    id: "selected-material-characterization",
    name: "ריכוז אפיון נברר",
    description: "ריכוז תוצאות אפיון חומר נברר",
    sourceFile: "ריכוז אפיון נברר.xlsx",
    match: ["נברר", "חומר נברר", "אפיון נברר", "CBR", "גרדציה"],
    columns: [
      { key: "no", label: "מס׳" },
      { key: "date", label: "תאריך" },
      { key: "source", label: "מקור חומר" },
      { key: "sampleNo", label: "מס׳ מדגם" },
      { key: "certificateNo", label: "מס׳ תעודה" },
      { key: "certificateName", label: "שם תעודה מצורפת" },
      { key: "gradation", label: "דירוג / גרדציה" },
      { key: "plasticity", label: "פלסטיות" },
      { key: "cbr", label: "CBR" },
      { key: "status", label: "סטטוס" },
      { key: "remarks", label: "הערות" },
    ],
  },
  {
    id: "nonconformances-summary",
    name: "דוח ריכוז אי התאמות",
    description: "ריכוז אי התאמות ופעולות מתקנות",
    sourceFile: "דוח ריכוז אי התאמות.xlsx",
    match: ["אי התאמה", "אי תאמות"],
    columns: [
      { key: "no", label: "מס׳" },
      { key: "date", label: "תאריך פתיחה" },
      { key: "location", label: "מיקום" },
      { key: "description", label: "תיאור אי התאמה" },
      { key: "severity", label: "חומרה" },
      { key: "action", label: "פעולה מתקנת" },
      { key: "owner", label: "אחראי" },
      { key: "closeDate", label: "תאריך סגירה" },
      { key: "status", label: "סטטוס" },
      { key: "remarks", label: "הערות" },
    ],
  },
];

const EMPTY_EXPORT_ROWS = 12;

const emptyRows = (template: ConcentrationTemplate, count = EMPTY_EXPORT_ROWS): ConcentrationRow[] =>
  Array.from({ length: count }, () =>
    template.columns.reduce<ConcentrationRow>((acc, column) => {
      acc[column.key] = "";
      return acc;
    }, {})
  );

const clean = (value: unknown) => String(value ?? "").trim();
const lower = (value: unknown) => clean(value).toLowerCase();
const getAttachments = (item: any) => Array.isArray(item?.attachments) ? item.attachments : [];
const includesAny = (value: unknown, keywords: string[]) => keywords.some((keyword) => clean(value).includes(keyword));
const extractCertificateNo = (attachmentName: unknown) => {
  const text = clean(attachmentName);
  const match = text.match(/(?:תעודה|בדיקה|מס)[^0-9]{0,10}(\d+[\d\-/]*)/) ?? text.match(/(\d{3,}[\d\-/]*)/);
  return match?.[1] ?? "";
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");

const buildChecklistRows = (template: ConcentrationTemplate, savedChecklists: any[]): ConcentrationRow[] => {
  const rows: ConcentrationRow[] = [];

  savedChecklists.forEach((checklist) => {
    const items = Array.isArray(checklist?.items) ? checklist.items : [];
    items.forEach((item: any) => {
      const text = [item?.description, item?.notes, checklist?.title, checklist?.category].map(clean).join(" ");
      const attachments = getAttachments(item);
      const matchedByText = includesAny(text, template.match);
      const matchedByAttachment = attachments.some((att: any) => includesAny(att?.name, template.match));
      if (!matchedByText && !matchedByAttachment) return;

      if (attachments.length) {
        attachments.forEach((attachment: any) => rows.push(buildGenericRow(template, checklist, item, attachment, rows.length + 1)));
      } else if (clean(item?.status) || clean(item?.notes)) {
        rows.push(buildGenericRow(template, checklist, item, null, rows.length + 1));
      }
    });
  });

  return rows;
};

const buildGenericRow = (template: ConcentrationTemplate, checklist: any, item: any, attachment: any, rowNo: number): ConcentrationRow => {
  const description = clean(item?.description);
  const attachmentName = clean(attachment?.name);
  const base: ConcentrationRow = {
    no: rowNo,
    date: clean(item?.executionDate) || clean(checklist?.date),
    location: clean(checklist?.location),
    layer: description,
    material: description,
    materialName: description,
    testType: description,
    certificateNo: extractCertificateNo(attachmentName),
    certificateName: attachmentName,
    result: clean(item?.status),
    status: clean(item?.status),
    remarks: clean(item?.notes),
    supplier: clean(checklist?.contractor),
    source: clean(checklist?.contractor),
  };

  return template.columns.reduce<ConcentrationRow>((acc, column) => {
    acc[column.key] = base[column.key] ?? "";
    return acc;
  }, {});
};

const buildRowsFromPreliminary = (template: ConcentrationTemplate, savedPreliminary: any[]): ConcentrationRow[] => {
  if (!["materials", "suppliers", "subcontractors"].includes(template.id)) return [];
  return savedPreliminary
    .filter((record) => {
      if (template.id === "materials") return record?.subtype === "materials";
      if (template.id === "suppliers") return record?.subtype === "suppliers";
      if (template.id === "subcontractors") return record?.subtype === "subcontractors";
      return false;
    })
    .map((record, index) => {
      const supplier = record?.supplier ?? {};
      const material = record?.material ?? {};
      const subcontractor = record?.subcontractor ?? {};
      const row: ConcentrationRow = {
        no: index + 1,
        date: clean(record?.date),
        supplier: clean(supplier?.supplierName),
        material: clean(supplier?.suppliedMaterial),
        contact: clean(supplier?.contactPhone),
        materialName: clean(material?.materialName),
        source: clean(material?.source),
        usage: clean(material?.usage),
        certificateNo: clean(material?.certificateNo) || clean(supplier?.approvalNo) || clean(subcontractor?.approvalNo),
        subcontractor: clean(subcontractor?.subcontractorName),
        field: clean(subcontractor?.field),
        approvalNo: clean(supplier?.approvalNo) || clean(subcontractor?.approvalNo),
        status: clean(record?.status),
        remarks: clean(supplier?.notes) || clean(material?.notes) || clean(subcontractor?.notes),
      };
      return template.columns.reduce<ConcentrationRow>((acc, column) => ({ ...acc, [column.key]: row[column.key] ?? "" }), {});
    });
};

const buildRowsFromTrialSections = (template: ConcentrationTemplate, savedTrialSections: any[]): ConcentrationRow[] => {
  if (template.id !== "trial-sections") return [];
  return savedTrialSections.map((record, index) => ({
    no: index + 1,
    date: clean(record?.date),
    trialName: clean(record?.title),
    location: clean(record?.location),
    material: clean(record?.spec),
    method: clean(record?.approvedBy),
    result: clean(record?.result),
    status: clean(record?.status),
    remarks: clean(record?.notes),
  }));
};

const buildRowsFromNonconformances = (template: ConcentrationTemplate, savedNonconformances: any[]): ConcentrationRow[] => {
  if (template.id !== "nonconformances-summary") return [];
  return savedNonconformances.map((record, index) => ({
    no: index + 1,
    date: clean(record?.date),
    location: clean(record?.location),
    description: clean(record?.description) || clean(record?.title),
    severity: clean(record?.severity),
    action: clean(record?.actionRequired),
    owner: clean(record?.raisedBy),
    closeDate: "",
    status: clean(record?.status),
    remarks: clean(record?.notes),
  }));
};

const normalizeRowsForTemplate = (template: ConcentrationTemplate, rows: ConcentrationRow[]) =>
  rows.map((row, index) =>
    template.columns.reduce<ConcentrationRow>((acc, column) => {
      acc[column.key] = column.key === "no" ? row[column.key] || index + 1 : row[column.key] ?? "";
      return acc;
    }, {})
  );

const buildRowsForTemplate = (template: ConcentrationTemplate, props: Props): ConcentrationRow[] => {
  const rows = [
    ...buildRowsFromPreliminary(template, props.savedPreliminary ?? []),
    ...buildRowsFromTrialSections(template, props.savedTrialSections ?? []),
    ...buildRowsFromNonconformances(template, props.savedNonconformances ?? []),
    ...buildChecklistRows(template, props.savedChecklists ?? []),
  ];

  return normalizeRowsForTemplate(template, rows);
};

const buildPrintableHtml = (template: ConcentrationTemplate, rows: ConcentrationRow[], projectName?: string) => `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(template.name)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; direction: rtl; color: #0f172a; margin: 0; }
  .page { width: 100%; }
  .brand-line { height: 5px; background: #80765a; margin-bottom: 8px; }
  .brand { display: grid; grid-template-columns: 1fr 1.2fr 1fr; align-items: center; gap: 10px; margin-bottom: 8px; }
  .brand-title { font-weight: 900; font-size: 16px; line-height: 1.05; text-align: left; direction: ltr; }
  .brand-sub { font-size: 11px; margin-top: 4px; text-align: left; }
  .brand-center { text-align: center; font-weight: 900; font-size: 18px; }
  .brand-contact { text-align: right; font-size: 11px; font-weight: 700; }
  .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; border: 1px solid #1f2937; margin: 8px 0 10px; }
  .meta div { border-left: 1px solid #1f2937; padding: 6px; font-size: 11px; text-align: center; min-height: 26px; }
  .meta div:last-child { border-left: 0; }
  h1 { text-align: center; font-size: 20px; margin: 8px 0 12px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid #1f2937; padding: 5px 3px; font-size: 9.5px; height: 24px; text-align: center; vertical-align: middle; word-break: break-word; }
  th { background: #f1f5f9; font-weight: 900; }
  .footer-line { height: 4px; background: #80765a; margin-top: 12px; }
  .footer { padding-top: 6px; display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; }
</style>
</head>
<body>
  <div class="page">
    <div class="brand-line"></div>
    <div class="brand">
      <div><div class="brand-title">CONTROLENG<br/>PRIME LTD</div><div class="brand-sub">שירותי הנדסה, פיקוח ובקרת איכות</div></div>
      <div class="brand-center">${escapeHtml(template.name)}</div>
      <div class="brand-contact">q.controling@gmail.com<br/>בית ג׳אן 249900</div>
    </div>
    <div class="brand-line"></div>
    <div class="meta"><div>שם הפרויקט: ${escapeHtml(projectName || "")}</div><div>מהדורה: א׳</div><div>תאריך מהדורה: 01.01.2026</div></div>
    <h1>${escapeHtml(template.name)}</h1>
    <table>
      <thead><tr>${template.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${template.columns.map((column) => `<td>${escapeHtml(row[column.key])}</td>`).join("")}</tr>`).join("\n")}</tbody>
    </table>
    <div class="footer-line"></div>
    <div class="footer"><span>שירותי הנדסה, פיקוח ובקרת איכות</span><span>q.controling@gmail.com | בית ג׳אן 249900</span></div>
  </div>
</body>
</html>`;

const downloadBlob = (filename: string, content: BlobPart, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const downloadHtmlFile = (filename: string, html: string, type: string) => downloadBlob(filename, html, type);

export function ConcentrationsSection(props: Props) {
  const [selectedId, setSelectedId] = useState(concentrationTemplates[0]?.id ?? "");
  const selectedTemplate = useMemo(
    () => concentrationTemplates.find((template) => template.id === selectedId) ?? concentrationTemplates[0],
    [selectedId]
  );

  const autoRows = useMemo(() => buildRowsForTemplate(selectedTemplate, props), [selectedTemplate, props.savedChecklists, props.savedNonconformances, props.savedTrialSections, props.savedPreliminary]);
  const displayRows = autoRows.length ? autoRows : emptyRows(selectedTemplate);
  const hasData = autoRows.length > 0;

  const downloadWord = () => downloadHtmlFile(`${selectedTemplate.name}.doc`, buildPrintableHtml(selectedTemplate, displayRows, props.currentProjectName), "application/msword;charset=utf-8");
  const downloadExcel = () => downloadHtmlFile(`${selectedTemplate.name}.xls`, buildPrintableHtml(selectedTemplate, displayRows, props.currentProjectName), "application/vnd.ms-excel;charset=utf-8");
  const downloadPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return alert("הדפדפן חסם פתיחת חלון. יש לאפשר popups ולהריץ שוב.");
    printWindow.document.open();
    printWindow.document.write(buildPrintableHtml(selectedTemplate, displayRows, props.currentProjectName));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <section style={{ display: "grid", gap: 18 }} dir="rtl">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>📊 ריכוזים</h2>
          <div style={{ color: "#64748b", marginTop: 6, lineHeight: 1.6 }}>
            תבניות ריכוז נקיות מערכים ישנים. ניתן להוריד כל ריכוז גם כשהוא ריק. לאחר שמירת רשימות/תעודות מתאימות, הריכוז יתמלא אוטומטית לפי התעודות המצורפות והנתונים שהוזנו.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={downloadWord} style={buttonStyle}>הורד Word</button>
          <button type="button" onClick={downloadExcel} style={buttonStyle}>הורד Excel</button>
          <button type="button" onClick={downloadPdf} style={primaryButtonStyle}>הורד PDF</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" }}>
        <aside style={sideStyle}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>📁 תיקיית ריכוזים</div>
          <div style={{ display: "grid", gap: 8 }}>
            {concentrationTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedId(template.id)}
                style={{
                  border: selectedTemplate.id === template.id ? "2px solid #0f172a" : "1px solid #cbd5e1",
                  background: selectedTemplate.id === template.id ? "#f8fafc" : "#fff",
                  borderRadius: 12,
                  padding: "10px 12px",
                  textAlign: "right",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                {template.name}
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginTop: 4 }}>{template.sourceFile}</div>
              </button>
            ))}
          </div>
        </aside>

        <main style={mainStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>{selectedTemplate.name}</h3>
              <div style={{ color: "#64748b", marginTop: 4 }}>{selectedTemplate.description}</div>
            </div>
            <span style={{ background: hasData ? "#ecfdf5" : "#f8fafc", border: hasData ? "1px solid #bbf7d0" : "1px solid #cbd5e1", color: hasData ? "#166534" : "#475569", borderRadius: 999, padding: "6px 10px", fontWeight: 900 }}>
              {hasData ? `${autoRows.length} שורות מולאו אוטומטית` : "ריק ומוכן להורדה"}
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: Math.max(900, selectedTemplate.columns.length * 120) }}>
              <thead>
                <tr>{selectedTemplate.columns.map((column) => <th key={column.key} style={thStyle}>{column.label}</th>)}</tr>
              </thead>
              <tbody>
                {displayRows.map((row, rowIndex) => (
                  <tr key={rowIndex}>{selectedTemplate.columns.map((column) => <td key={column.key} style={tdStyle}>{row[column.key]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </section>
  );
}

const buttonStyle: React.CSSProperties = { border: "1px solid #cbd5e1", background: "#fff", borderRadius: 12, padding: "10px 14px", fontWeight: 900, cursor: "pointer" };
const primaryButtonStyle: React.CSSProperties = { ...buttonStyle, background: "#0f172a", color: "#fff", borderColor: "#0f172a" };
const sideStyle: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 18, padding: 12, background: "#fff", boxShadow: "0 10px 24px rgba(15,23,42,0.06)" };
const mainStyle: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 18, padding: 14, background: "#fff", boxShadow: "0 10px 24px rgba(15,23,42,0.06)", overflow: "hidden" };
const thStyle: React.CSSProperties = { border: "1px solid #334155", padding: 8, background: "#f1f5f9", fontWeight: 900, textAlign: "center", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { border: "1px solid #64748b", padding: 8, minHeight: 34, textAlign: "center", height: 34 };

export default ConcentrationsSection;
