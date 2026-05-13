"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import JSZip from "jszip";

type ProjectConcentrationMeta = {
  projectName?: string;
  projectManager?: string;
  projectManagement?: string;
  contractor?: string;
  qualityAssurance?: string;
  qualityControl?: string;
  workManager?: string;
  surveyor?: string;
  supervisor?: string;
};

type Props = {
  savedChecklists?: any[];
  savedNonconformances?: any[];
  savedTrialSections?: any[];
  savedPreliminary?: any[];
  currentProjectName?: string;
  projectMeta?: ProjectConcentrationMeta;
};

type ConcentrationId =
  | "nonconformances"
  | "suppliers"
  | "contractors"
  | "asphalt"
  | "density"
  | "concrete"
  | "supervision"
  | "materials"
  | "trial-sections"
  | "subbase-a"
  | "selected-material"
  | "earthworks"
  | "rfi";

type ConcentrationDefinition = {
  id: ConcentrationId;
  title: string;
  fileName: string;
  description: string;
  sourceLabel: string;
  columns: string[];
  buildRows: (ctx: BuildContext) => Row[];
};

type Row = Record<string, string | number | boolean | null | undefined>;

type BuildContext = {
  savedChecklists: any[];
  savedNonconformances: any[];
  savedTrialSections: any[];
  savedPreliminary: any[];
  projectMeta: Required<ProjectConcentrationMeta>;
};

const cleanText = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
};

const normalize = (value: unknown): string =>
  cleanText(value)
    .replace(/[׳`’']/g, "")
    .replace(/[:：]/g, "")
    .toLowerCase();

const firstText = (...values: unknown[]): string => {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
};



const compactValue = (value: unknown): string => {
  const text = cleanText(value);
  if (!text) return "";
  if (text === "[object Object]") return "";
  return text;
};

const flattenRecord = (value: any, prefix = "", out: Array<{ key: string; value: unknown }> = [], seen = new WeakSet<object>()) => {
  if (value === null || value === undefined) return out;
  if (typeof value !== "object") {
    out.push({ key: prefix, value });
    return out;
  }
  if (seen.has(value)) return out;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenRecord(item, `${prefix}.${index}`, out, seen));
    return out;
  }
  Object.entries(value).forEach(([key, child]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === "object") flattenRecord(child, fullKey, out, seen);
    else out.push({ key: fullKey, value: child });
  });
  return out;
};

const valueByKeyOrLabel = (record: any, aliases: string[]): string => {
  const normalizedAliases = aliases.map(normalize).filter(Boolean);
  const flat = flattenRecord(record);
  for (const { key, value } of flat) {
    const nk = normalize(key.split(".").pop() ?? key);
    if (normalizedAliases.some((alias) => nk === alias || nk.includes(alias) || alias.includes(nk))) {
      const text = compactValue(value);
      if (text) return text;
    }
  }
  for (const { key, value } of flat) {
    const nk = normalize(key);
    if (normalizedAliases.some((alias) => nk.includes(alias))) {
      const text = compactValue(value);
      if (text) return text;
    }
  }
  return "";
};

const valueByLabel = (record: any, labels: string[]): string => {
  const flat = flattenRecord(record);
  const normalizedLabels = labels.map(normalize).filter(Boolean);
  for (const { key, value } of flat) {
    const nk = normalize(key);
    if (normalizedLabels.some((label) => nk.includes(label))) {
      const text = compactValue(value);
      if (text) return text;
    }
  }
  return "";
};

const documentType = (doc: any): string =>
  firstText(doc?.documentType, doc?.docType, doc?.type, doc?.kind, doc?.category, doc?.title, doc?.label);

const documentSummary = (record: any): string => {
  const docs = getAttachments(record);
  if (!docs.length) return "";
  const types = Array.from(new Set(docs.map(documentType).map(cleanText).filter(Boolean)));
  const count = docs.length;
  return types.length ? `${count} מסמכים: ${types.join(", ")}` : `${count} מסמכים`;
};

const includesAny = (text: unknown, keywords: string[]) => {
  const n = normalize(text);
  return keywords.some((keyword) => n.includes(normalize(keyword)));
};

const dateText = (value: unknown) => {
  const text = cleanText(value);
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10).split("-").reverse().join("/");
  return text;
};

const attachmentName = (attachment: any) => firstText(attachment?.name, attachment?.fileName, attachment?.attachmentName);
const attachmentCertificateNo = (attachment: any, fallback = "") => {
  const direct = firstText(attachment?.certificateNo, attachment?.approvalNo, attachment?.licenseNo, attachment?.results?.certificateNo, attachment?.labResults?.certificateNo, fallback);
  if (direct) return direct;
  const name = attachmentName(attachment);
  const match = name.match(/(?:^|[^0-9])(\d{3,})(?:[^0-9]|$)/);
  return match?.[1] ?? "";
};

const getAttachments = (record: any): any[] => {
  const result: any[] = [];
  const keys = ["attachments", "certificates", "images", "files", "documents", "requiredDocuments"];
  keys.forEach((key) => {
    if (Array.isArray(record?.[key])) result.push(...record[key]);
  });
  if (record?.supplier) keys.forEach((key) => Array.isArray(record.supplier?.[key]) && result.push(...record.supplier[key]));
  if (record?.subcontractor) keys.forEach((key) => Array.isArray(record.subcontractor?.[key]) && result.push(...record.subcontractor[key]));
  if (record?.material) keys.forEach((key) => Array.isArray(record.material?.[key]) && result.push(...record.material[key]));
  return result;
};

const recordText = (record: any): string => {
  const parts: unknown[] = [
    record?.title,
    record?.category,
    record?.location,
    record?.contractor,
    record?.status,
    record?.description,
    record?.notes,
    record?.subtype,
    record?.spec,
    record?.result,
    record?.approvedBy,
  ];
  if (record?.supplier) parts.push(...Object.values(record.supplier));
  if (record?.subcontractor) parts.push(...Object.values(record.subcontractor));
  if (record?.material) parts.push(...Object.values(record.material));
  if (Array.isArray(record?.items)) {
    record.items.forEach((item: any) => {
      parts.push(item?.description, item?.notes, item?.status, item?.inspector, item?.responsible, item?.executionDate);
      if (Array.isArray(item?.attachments)) item.attachments.forEach((a: any) => parts.push(attachmentName(a), a?.kind, JSON.stringify(a?.results ?? a?.labResults ?? {})));
    });
  }
  getAttachments(record).forEach((a) => parts.push(attachmentName(a), a?.description, a?.documentType, a?.type));
  return parts.filter(Boolean).join(" ");
};

const buildProjectMeta = (currentProjectName = "", meta?: ProjectConcentrationMeta): Required<ProjectConcentrationMeta> => ({
  projectName: firstText(meta?.projectName, currentProjectName),
  projectManager: firstText(meta?.projectManager, meta?.projectManagement),
  projectManagement: firstText(meta?.projectManagement, meta?.projectManager),
  contractor: firstText(meta?.contractor),
  qualityAssurance: firstText(meta?.qualityAssurance),
  qualityControl: firstText(meta?.qualityControl),
  workManager: firstText(meta?.workManager),
  surveyor: firstText(meta?.surveyor),
  supervisor: firstText(meta?.supervisor),
});

const preliminaryBySubtype = (records: any[], subtype: string) => records.filter((r) => normalize(r?.subtype) === normalize(subtype));

const supplierRow = (record: any, index: number): Row => {
  const supplier = record?.supplier ?? record;
  const docs = getAttachments(record);
  const suppliedMaterial = firstText(
    valueByKeyOrLabel(record, ["suppliedMaterial", "supplied_material", "materialSupplied", "suppliedProduct", "productSupplied", "material", "product"]),
    valueByLabel(record, ["חומר מסופק", "מוצר מסופק", "חומר/מוצר מסופק", "חומר", "מוצר"]),
    supplier?.suppliedMaterial,
    supplier?.material,
    supplier?.product,
    supplier?.materialName,
    record?.material?.materialName
  );
  const docNo = firstText(
    valueByKeyOrLabel(record, ["certificateNo", "certificateNumber", "approvalNo", "approvalNumber", "licenseNo", "licenseNumber", "isoCertificateNo", "documentNo", "documentNumber"]),
    valueByLabel(record, ["מספר תעודה", "מס תעודה", "מספר אישור", "מס אישור", "מספר רישיון", "מס רישיון", "מספר רישיון / אישור"]),
    supplier?.approvalNo,
    supplier?.certificateNo,
    supplier?.licenseNo,
    supplier?.isoCertificateNo,
    record?.approvalNo,
    record?.certificateNo,
    docs.map((d) => attachmentCertificateNo(d)).find(Boolean)
  );
  const docTypes = Array.from(new Set(docs.map(documentType).map(cleanText).filter(Boolean)));
  const docSummary = firstText(valueByLabel(record, ["מסמכים", "תעודות", "רישיונות", "סוג תעודה"]), documentSummary(record));
  return {
    "מס׳": index + 1,
    "שם ספק": firstText(supplier?.supplierName, supplier?.name, record?.title),
    "חומר/מוצר מסופק": suppliedMaterial,
    "יצרן/מקור": firstText(supplier?.manufacturer, supplier?.source, record?.material?.source),
    "מספר תעודה / רישיון / אישור": docNo,
    "סוג תעודה": docTypes.join(", "),
    "מס׳ מסמכים / תעודות / רישיונות": docSummary,
    "סטטוס": firstText(record?.status, record?.approval?.status),
    "תאריך": dateText(record?.date ?? record?.savedAt),
    "הערות": firstText(supplier?.notes, record?.notes),
  };
};

const contractorRow = (record: any, index: number): Row => {
  const contractor = record?.subcontractor ?? record;
  const docs = getAttachments(record);
  const certNo = firstText(
    contractor?.approvalNo,
    contractor?.certificateNo,
    contractor?.licenseNo,
    contractor?.registrationNo,
    contractor?.classificationNo,
    record?.approvalNo,
    record?.certificateNo,
    docs.map((d) => attachmentCertificateNo(d)).find(Boolean)
  );
  return {
    "מס׳": index + 1,
    "שם קבלן / קבלן משנה": firstText(contractor?.subcontractorName, contractor?.contractorName, contractor?.name, record?.title),
    "תחום ביצוע": firstText(contractor?.field, contractor?.workType, record?.workType),
    "סיווג ברשם הקבלנים / מספר תעודה / רישיון / אישור": firstText(contractor?.classification, contractor?.contractorClassification, certNo),
    "מספר תעודה / רישיון / אישור": certNo,
    "סטטוס": firstText(record?.status, record?.approval?.status),
    "תאריך": dateText(record?.date ?? record?.savedAt),
    "הערות": firstText(contractor?.notes, record?.notes),
  };
};

const materialRow = (record: any, index: number): Row => {
  const material = record?.material ?? record;
  const docs = getAttachments(record);
  return {
    "מס׳": index + 1,
    "שם חומר": firstText(material?.materialName, material?.name, record?.title),
    "מקור/יצרן": firstText(material?.source, material?.manufacturer),
    "שימוש מיועד": firstText(material?.usage, record?.description),
    "מספר תעודה / אישור": firstText(material?.certificateNo, material?.approvalNo, record?.certificateNo, docs.map((d) => attachmentCertificateNo(d)).find(Boolean)),
    "סטטוס": firstText(record?.status, record?.approval?.status),
    "תאריך": dateText(record?.date ?? record?.savedAt),
    "הערות": firstText(material?.notes, record?.notes),
  };
};

const nonconformanceRow = (record: any, index: number): Row => ({
  "מס׳": index + 1,
  "מספר NCR": firstText(record?.ncrNumber, record?.number, record?.id),
  "נושא": firstText(record?.title, record?.subject),
  "מיקום": firstText(record?.location),
  "תאריך פתיחה": dateText(record?.date ?? record?.createdAt ?? record?.savedAt),
  "פותח/מדווח": firstText(record?.raisedBy, record?.reportedBy),
  "חומרה": firstText(record?.severity),
  "סטטוס": firstText(record?.status),
  "תיאור אי התאמה": firstText(record?.description),
  "פעולה נדרשת": firstText(record?.actionRequired),
  "הערות": firstText(record?.notes),
});

const trialRow = (record: any, index: number): Row => ({
  "מס׳": index + 1,
  "שם קטע ניסוי": firstText(record?.title),
  "מיקום": firstText(record?.location),
  "תאריך": dateText(record?.date ?? record?.savedAt),
  "סעיף מפרט": firstText(record?.specSection, record?.spec),
  "סוג עבודה": firstText(record?.workType),
  "תוצאה": firstText(record?.result),
  "מאושר ע״י": firstText(record?.approvedBy),
  "סטטוס": firstText(record?.status),
  "הערות": firstText(record?.notes),
});

const checklistRows = (records: any[], keywords: string[], label: string): Row[] => {
  const rows: Row[] = [];
  records.forEach((checklist) => {
    const checklistMatches = includesAny(recordText(checklist), keywords);
    const items = Array.isArray(checklist?.items) ? checklist.items : [];
    if (!items.length && checklistMatches) {
      rows.push({
        "מס׳": rows.length + 1,
        "מספר רשימה": firstText(checklist?.checklistNo, checklist?.id),
        "שם בדיקה/רשימה": firstText(checklist?.title, label),
        "קטגוריה": firstText(checklist?.category),
        "מיקום": firstText(checklist?.location),
        "קבלן": firstText(checklist?.contractor),
        "תאריך": dateText(checklist?.date ?? checklist?.savedAt),
        "תיאור סעיף": firstText(checklist?.description),
        "מבצע/אחראי": firstText(checklist?.responsible),
        "בודק": firstText(checklist?.inspector),
        "סטטוס": firstText(checklist?.status),
        "מספר תעודה": "",
        "שם קובץ": "",
        "תוצאות/הערות": firstText(checklist?.notes),
      });
    }
    items.forEach((item: any) => {
      const attachments = Array.isArray(item?.attachments) ? item.attachments : [];
      const itemText = [recordText(checklist), item?.description, item?.notes, JSON.stringify(item?.results ?? item?.labResults ?? {})].join(" ");
      const relevant = checklistMatches || includesAny(itemText, keywords) || attachments.some((a: any) => includesAny([attachmentName(a), JSON.stringify(a?.results ?? a?.labResults ?? {})].join(" "), keywords));
      if (!relevant) return;
      if (!attachments.length) {
        rows.push({
          "מס׳": rows.length + 1,
          "מספר רשימה": firstText(checklist?.checklistNo, checklist?.id),
          "שם בדיקה/רשימה": firstText(checklist?.title, label),
          "קטגוריה": firstText(checklist?.category),
          "מיקום": firstText(checklist?.location),
          "קבלן": firstText(checklist?.contractor),
          "תאריך": dateText(item?.executionDate ?? checklist?.date ?? checklist?.savedAt),
          "תיאור סעיף": firstText(item?.description),
          "מבצע/אחראי": firstText(item?.responsible),
          "בודק": firstText(item?.inspector),
          "סטטוס": firstText(item?.status),
          "מספר תעודה": firstText(item?.certificateNo, item?.results?.certificateNo, item?.labResults?.certificateNo),
          "שם קובץ": "",
          "תוצאות/הערות": firstText(item?.notes, JSON.stringify(item?.results ?? item?.labResults ?? {})),
        });
      }
      attachments.forEach((attachment: any) => {
        rows.push({
          "מס׳": rows.length + 1,
          "מספר רשימה": firstText(checklist?.checklistNo, checklist?.id),
          "שם בדיקה/רשימה": firstText(checklist?.title, label),
          "קטגוריה": firstText(checklist?.category),
          "מיקום": firstText(checklist?.location),
          "קבלן": firstText(checklist?.contractor),
          "תאריך": dateText(item?.executionDate ?? checklist?.date ?? attachment?.uploadedAt ?? checklist?.savedAt),
          "תיאור סעיף": firstText(item?.description),
          "מבצע/אחראי": firstText(item?.responsible),
          "בודק": firstText(item?.inspector),
          "סטטוס": firstText(item?.status),
          "מספר תעודה": attachmentCertificateNo(attachment, firstText(item?.certificateNo)),
          "שם קובץ": attachmentName(attachment),
          "תוצאות/הערות": firstText(item?.notes, JSON.stringify(attachment?.results ?? attachment?.labResults ?? item?.results ?? item?.labResults ?? {})),
        });
      });
    });
  });
  return rows.map((row, index) => ({ ...row, "מס׳": index + 1 }));
};

const commonChecklistColumns = ["מס׳", "מספר רשימה", "שם בדיקה/רשימה", "קטגוריה", "מיקום", "קבלן", "תאריך", "תיאור סעיף", "מבצע/אחראי", "בודק", "סטטוס", "מספר תעודה", "שם קובץ", "תוצאות/הערות"];

const definitions: ConcentrationDefinition[] = [
  {
    id: "nonconformances",
    title: "דוח ריכוז אי התאמות",
    fileName: "דוח ריכוז אי התאמות.xlsx",
    description: "ריכוז מתוך טפסי אי־התאמות שנשמרו במערכת",
    sourceLabel: "אי התאמות",
    columns: ["מס׳", "מספר NCR", "נושא", "מיקום", "תאריך פתיחה", "פותח/מדווח", "חומרה", "סטטוס", "תיאור אי התאמה", "פעולה נדרשת", "הערות"],
    buildRows: ({ savedNonconformances }) => savedNonconformances.map(nonconformanceRow),
  },
  {
    id: "suppliers",
    title: "ריכוז ספקים",
    fileName: "ריכוז ספקים.xlsx",
    description: "ריכוז מתוך אישורי ספקים בבקרה מקדימה",
    sourceLabel: "בקרה מקדימה / ספקים",
    columns: ["מס׳", "שם ספק", "חומר/מוצר מסופק", "יצרן/מקור", "מספר תעודה / רישיון / אישור", "סוג תעודה", "מס׳ מסמכים / תעודות / רישיונות", "סטטוס", "תאריך", "הערות"],
    buildRows: ({ savedPreliminary }) => preliminaryBySubtype(savedPreliminary, "suppliers").map(supplierRow),
  },
  {
    id: "contractors",
    title: "ריכוז קבלנים",
    fileName: "ריכוז קבלנים.xlsx",
    description: "ריכוז מתוך אישורי קבלנים/קבלני משנה בבקרה מקדימה",
    sourceLabel: "בקרה מקדימה / קבלנים",
    columns: ["מס׳", "שם קבלן / קבלן משנה", "תחום ביצוע", "סיווג ברשם הקבלנים / מספר תעודה / רישיון / אישור", "מספר תעודה / רישיון / אישור", "סטטוס", "תאריך", "הערות"],
    buildRows: ({ savedPreliminary }) => preliminaryBySubtype(savedPreliminary, "subcontractors").map(contractorRow),
  },
  {
    id: "asphalt",
    title: "ריכוז בדיקות אספלט",
    fileName: "ריכוז בדיקות אספלט.xlsx",
    description: "בדיקות אספלט מתוך רשימות תיוג ותעודות מצורפות",
    sourceLabel: "רשימות תיוג",
    columns: commonChecklistColumns,
    buildRows: ({ savedChecklists }) => checklistRows(savedChecklists, ["אספלט", "fwd", "מישוריות", "שכבה סופית"], "בדיקות אספלט"),
  },
  {
    id: "density",
    title: "ריכוז בדיקות צפיפות",
    fileName: "ריכוז בדיקות צפיפות.xlsx",
    description: "צפיפות / הידוק / רטיבות / מצעים מתוך רשימות תיוג",
    sourceLabel: "רשימות תיוג",
    columns: commonChecklistColumns,
    buildRows: ({ savedChecklists }) => checklistRows(savedChecklists, ["צפיפות", "הידוק", "רטיבות", "מצע", "מצעים", "דרגת הידוק"], "בדיקות צפיפות"),
  },
  {
    id: "concrete",
    title: "ריכוז בטון",
    fileName: "ריכוז בטון.xlsx",
    description: "בדיקות בטון מתוך רשימות תיוג ותעודות מצורפות",
    sourceLabel: "רשימות תיוג",
    columns: commonChecklistColumns,
    buildRows: ({ savedChecklists }) => checklistRows(savedChecklists, ["בטון", "יציקה", "קוביות", "חוזק"], "בדיקות בטון"),
  },
  {
    id: "supervision",
    title: "ריכוז דוחות פיקוח עליון",
    fileName: "ריכוז דוחות פיקוח עליון.xlsx",
    description: "ריכוז דוחות/רשומות פיקוח עליון מתוך המערכת",
    sourceLabel: "דוחות / קטעי ניסוי",
    columns: ["מס׳", "נושא", "מיקום", "תאריך", "מאשר/בודק", "סטטוס", "תיאור", "הערות"],
    buildRows: ({ savedTrialSections }) => savedTrialSections.filter((r) => includesAny(recordText(r), ["פיקוח עליון", "דוח פיקוח", "פיקוח"])).map((r, i) => ({ "מס׳": i + 1, "נושא": firstText(r?.title), "מיקום": firstText(r?.location), "תאריך": dateText(r?.date ?? r?.savedAt), "מאשר/בודק": firstText(r?.approvedBy), "סטטוס": firstText(r?.status), "תיאור": firstText(r?.description, r?.spec), "הערות": firstText(r?.notes) })),
  },
  {
    id: "materials",
    title: "ריכוז חומרים",
    fileName: "ריכוז חומרים.xlsx",
    description: "ריכוז אישורי חומרים מתוך בקרה מקדימה",
    sourceLabel: "בקרה מקדימה / חומרים",
    columns: ["מס׳", "שם חומר", "מקור/יצרן", "שימוש מיועד", "מספר תעודה / אישור", "סטטוס", "תאריך", "הערות"],
    buildRows: ({ savedPreliminary }) => preliminaryBySubtype(savedPreliminary, "materials").map(materialRow),
  },
  {
    id: "trial-sections",
    title: "ריכוז קטעי ניסוי",
    fileName: "ריכוז קטעי ניסוי.xlsx",
    description: "ריכוז מתוך טפסי קטעי ניסוי שנשמרו במערכת",
    sourceLabel: "קטעי ניסוי",
    columns: ["מס׳", "שם קטע ניסוי", "מיקום", "תאריך", "סעיף מפרט", "סוג עבודה", "תוצאה", "מאושר ע״י", "סטטוס", "הערות"],
    buildRows: ({ savedTrialSections }) => savedTrialSections.map(trialRow),
  },
  {
    id: "subbase-a",
    title: "ריכוז אפיון מצע א׳",
    fileName: "ריכוז אפיון מצע א.xlsx",
    description: "אפיון מצע א׳ מתוך תעודות/רשימות תיוג רלוונטיות",
    sourceLabel: "רשימות תיוג / תעודות",
    columns: commonChecklistColumns,
    buildRows: ({ savedChecklists }) => checklistRows(savedChecklists, ["מצע א", "מצע א׳", "אפיון מצע", "cbr", "גרדציה"], "אפיון מצע א׳"),
  },
  {
    id: "selected-material",
    title: "ריכוז אפיון נברר",
    fileName: "ריכוז אפיון נברר.xlsx",
    description: "אפיון חומר נברר מתוך תעודות/רשימות תיוג רלוונטיות",
    sourceLabel: "רשימות תיוג / תעודות",
    columns: commonChecklistColumns,
    buildRows: ({ savedChecklists }) => checklistRows(savedChecklists, ["נברר", "חומר נברר", "אפיון נברר", "cbr", "גרדציה"], "אפיון נברר"),
  },
  {
    id: "earthworks",
    title: "בדיקות שדה / עבודות עפר",
    fileName: "בדיקות שדה - עבודות עפר.xlsx",
    description: "עבודות עפר / בדיקות שדה מתוך רשימות תיוג",
    sourceLabel: "רשימות תיוג",
    columns: commonChecklistColumns,
    buildRows: ({ savedChecklists }) => checklistRows(savedChecklists, ["עבודות עפר", "עפר", "חפירה", "מילוי", "שדה", "הידוק מבוקר"], "בדיקות שדה / עבודות עפר"),
  },
  {
    id: "rfi",
    title: "RFI",
    fileName: "RFI.xlsx",
    description: "ריכוז RFI — יוצג אם רשומות RFI מועברות לרכיב בעתיד",
    sourceLabel: "RFI",
    columns: ["מס׳", "נושא", "מיקום", "תאריך", "סטטוס", "תיאור", "הערות"],
    buildRows: () => [],
  },
];

const xmlEscape = (value: unknown): string =>
  cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const colName = (n: number) => {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
};

const cell = (r: number, c: number, v: unknown, style = 0) => {
  const ref = `${colName(c)}${r}`;
  if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`;
};

const rowXml = (r: number, values: unknown[], style = 0) => `<row r="${r}">${values.map((v, i) => cell(r, i + 1, v, style)).join("")}</row>`;

const buildWorksheetXml = (definition: ConcentrationDefinition, rows: Row[], meta: Required<ProjectConcentrationMeta>) => {
  let r = 1;
  const sheetRows: string[] = [];
  const widthCount = Math.max(definition.columns.length, 8);
  sheetRows.push(rowXml(r++, [definition.title], 1));
  sheetRows.push(rowXml(r++, ["שם פרויקט", meta.projectName, "ניהול פרויקט", meta.projectManager || meta.projectManagement, "שם הקבלן", meta.contractor], 2));
  sheetRows.push(rowXml(r++, ["בקרת איכות", meta.qualityControl, "הבטחת איכות", meta.qualityAssurance, "תאריך יצוא", new Date().toLocaleDateString("he-IL")], 2));
  sheetRows.push(rowXml(r++, ["מקור נתונים", definition.sourceLabel, "מספר רשומות", rows.length], 2));
  sheetRows.push(rowXml(r++, Array.from({ length: widthCount }, () => "")));
  sheetRows.push(rowXml(r++, definition.columns, 3));

  if (rows.length) {
    rows.forEach((item) => sheetRows.push(rowXml(r++, definition.columns.map((column) => item[column] ?? ""), 0)));
  } else {
    sheetRows.push(rowXml(r++, ["אין נתונים שמורים לריכוז זה בפרויקט הנוכחי"], 4));
  }

  const cols = Array.from({ length: widthCount }, (_, i) => `<col min="${i + 1}" max="${i + 1}" width="22" customWidth="1"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${sheetRows.join("")}</sheetData>
</worksheet>`;
};

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="11"/><name val="Arial"/></font>
    <font><b/><sz val="16"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
  </fonts>
  <fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/></patternFill></fill></fills>
  <borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
</styleSheet>`;

const buildWorkbookBlob = async (definition: ConcentrationDefinition, rows: Row[], meta: Required<ProjectConcentrationMeta>) => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
  zip.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
  zip.folder("docProps")?.file("core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(definition.title)}</dc:title><dc:creator>מערכת בקרת איכות</dc:creator></cp:coreProperties>`);
  zip.folder("docProps")?.file("app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>ControlEng Prime</Application></Properties>`);
  zip.folder("xl")?.file("workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="${xmlEscape(definition.title).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets><calcPr calcMode="auto"/></workbook>`);
  zip.folder("xl")?.folder("_rels")?.file("workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.folder("xl")?.folder("worksheets")?.file("sheet1.xml", buildWorksheetXml(definition, rows, meta));
  zip.folder("xl")?.file("styles.xml", stylesXml);
  return await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const cardStyle: CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#fff", boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)" };
const btnStyle: CSSProperties = { border: 0, borderRadius: 12, padding: "12px 14px", fontWeight: 900, color: "#fff", background: "#0f172a", cursor: "pointer" };

export function ConcentrationsSection({ savedChecklists = [], savedNonconformances = [], savedTrialSections = [], savedPreliminary = [], currentProjectName = "", projectMeta }: Props) {
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<ConcentrationId | null>(null);

  const meta = useMemo(() => buildProjectMeta(currentProjectName, projectMeta), [currentProjectName, projectMeta]);
  const ctx: BuildContext = useMemo(() => ({ savedChecklists, savedNonconformances, savedTrialSections, savedPreliminary, projectMeta: meta }), [savedChecklists, savedNonconformances, savedTrialSections, savedPreliminary, meta]);

  const rowsById = useMemo(() => {
    const result: Record<string, Row[]> = {};
    definitions.forEach((definition) => {
      try {
        result[definition.id] = definition.buildRows(ctx);
      } catch (error) {
        console.error(`Failed building concentration ${definition.id}`, error);
        result[definition.id] = [];
      }
    });
    return result;
  }, [ctx]);

  const visibleDefinitions = useMemo(() => {
    const q = normalize(search);
    return definitions.filter((definition) => !q || normalize(`${definition.title} ${definition.description}`).includes(q));
  }, [search]);

  const exportOne = async (definition: ConcentrationDefinition) => {
    setBusyId(definition.id);
    try {
      const rows = rowsById[definition.id] ?? [];
      const blob = await buildWorkbookBlob(definition, rows, meta);
      downloadBlob(blob, definition.fileName);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "אירעה שגיאה ביצוא הריכוז");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section dir="rtl" style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>ריכוזים</h2>
          <div style={{ color: "#64748b", marginTop: 6, lineHeight: 1.6 }}>
            מנוע ריכוזים חדש: הקבצים נוצרים ישירות מהנתונים השמורים במערכת, ללא תבניות Excel חיצוניות וללא XML Patch.
          </div>
          <div style={{ color: "#0f172a", fontWeight: 800, marginTop: 6 }}>פרויקט נוכחי: {meta.projectName || "-"}</div>
        </div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש ריכוז..." style={{ width: 260, border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 14px", fontWeight: 700 }} />
      </div>

      <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 16, padding: 14, color: "#1e3a8a", fontWeight: 800, lineHeight: 1.7 }}>
        לפני הורדה אפשר לפתוח תצוגה מקדימה. מה שמופיע בטבלה הוא מה שייכנס לאקסל.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        {visibleDefinitions.map((definition) => {
          const rows = rowsById[definition.id] ?? [];
          const isOpen = openId === definition.id;
          return (
            <div key={definition.id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{definition.title}</div>
                  <div style={{ color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>{definition.description}</div>
                </div>
                <span style={{ borderRadius: 999, background: rows.length ? "#dcfce7" : "#f1f5f9", color: rows.length ? "#166534" : "#475569", padding: "5px 10px", fontWeight: 900, whiteSpace: "nowrap" }}>{rows.length} רשומות</span>
              </div>

              <div style={{ marginTop: 12, color: rows.length ? "#166534" : "#64748b", fontWeight: 800 }}>
                {rows.length ? `נמצאו ${rows.length} רשומות ליצוא.` : "אין נתונים שמורים לריכוז זה בפרויקט הנוכחי."}
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                <button type="button" disabled={busyId === definition.id} onClick={() => exportOne(definition)} style={{ ...btnStyle, cursor: busyId === definition.id ? "wait" : "pointer" }}>
                  {busyId === definition.id ? "מפיק Excel..." : "הורד Excel חדש"}
                </button>
                <button type="button" onClick={() => setOpenId(isOpen ? null : definition.id)} style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 12px", fontWeight: 900, color: "#0f172a", background: "#fff", cursor: "pointer" }}>
                  {isOpen ? "סגור תצוגה מקדימה" : "פתח תצוגה מקדימה"}
                </button>
              </div>

              {isOpen && (
                <div style={{ marginTop: 14, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 12, maxHeight: 260 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>
                        {definition.columns.slice(0, 8).map((column) => (
                          <th key={column} style={{ position: "sticky", top: 0, background: "#0f172a", color: "#fff", padding: 8, border: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length ? rows.slice(0, 20).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {definition.columns.slice(0, 8).map((column) => (
                            <td key={column} style={{ padding: 8, border: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{cleanText(row[column])}</td>
                          ))}
                        </tr>
                      )) : (
                        <tr><td colSpan={Math.min(definition.columns.length, 8)} style={{ padding: 12, textAlign: "center", color: "#64748b", fontWeight: 800 }}>אין נתונים להצגה</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default ConcentrationsSection;
