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
  savedRfis?: any[];
  savedControlProcesses?: any[];
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
  savedRfis: any[];
  savedControlProcesses: any[];
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

const looksLikeUuid = (text: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text.trim());

const dateText = (value: unknown) => {
  const text = cleanText(value);
  if (!text || looksLikeUuid(text)) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10).split("-").reverse().join("/");
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(text)) return text;
  // אל תחזיר טקסטים שאינם תאריך לשדות תאריך, כדי שלא יופיעו מזהי קבצים / UUID.
  return "";
};

const firstDateText = (...values: unknown[]) => {
  for (const value of values) {
    const text = dateText(value);
    if (text) return text;
  }
  return "";
};

const attachmentName = (attachment: any) => firstText(attachment?.name, attachment?.fileName, attachment?.attachmentName);

const certificateNumberFromAttachment = (attachment: any): string => {
  const direct = firstText(
    attachment?.certificateNo,
    attachment?.certificateNumber,
    attachment?.documentNo,
    attachment?.documentNumber,
    attachment?.approvalNo,
    attachment?.approvalNumber,
    attachment?.licenseNo,
    attachment?.licenseNumber,
    attachment?.registrationNo,
    attachment?.מספר_תעודה,
    attachment?.["מספר תעודה"],
    attachment?.["מספר תעודה / רישיון / אישור"],
    attachment?.results?.certificateNo,
    attachment?.results?.certificateNumber,
    attachment?.results?.documentNo,
    attachment?.labResults?.certificateNo,
    attachment?.labResults?.certificateNumber,
    attachment?.details?.certificateNo,
    attachment?.details?.certificateNumber,
    attachment?.details?.documentNo,
    attachment?.details?.documentNumber,
    attachment?.details?.approvalNo,
    attachment?.details?.approvalNumber,
    attachment?.details?.licenseNo,
    attachment?.details?.licenseNumber,
    attachment?.details?.["מספר תעודה"],
    attachment?.details?.["מס תעודה"],
    attachment?.details?.["מספר רישיון"],
    attachment?.details?.["מספר רשיון"],
    attachment?.details?.["מספר אישור"],
    attachment?.details?.["מספר תעודה / רישיון / אישור"],
    valueByKeyOrLabel(attachment, [
      "certificateNo",
      "certificateNumber",
      "documentNo",
      "documentNumber",
      "approvalNo",
      "approvalNumber",
      "licenseNo",
      "licenseNumber",
      "registrationNo",
      "מספר תעודה",
      "מס תעודה",
      "מספר רישיון",
      "מספר רשיון",
      "מספר אישור",
      "מספר תעודה / רישיון / אישור",
    ])
  );
  const text = cleanText(direct);
  if (text && !looksLikeUuid(text) && !["כן", "לא", "מאושר"].includes(text)) return text;

  const name = attachmentName(attachment);
  const match = name.match(/(?:^|[^0-9])(\d{3,})(?:[^0-9]|$)/);
  return match?.[1] ?? "";
};

const attachmentCertificateNo = (attachment: any, fallback = "") =>
  firstText(certificateNumberFromAttachment(attachment), fallback);

const normalizeCertificateType = (value: unknown, doc?: any): string => {
  const text = cleanText(value);
  const lower = text.toLowerCase();
  if (!text || lower === "application/pdf" || lower === "pdf" || lower.includes("octet-stream")) {
    const name = cleanText(attachmentName(doc));
    const all = `${name} ${cleanText(doc?.title)} ${cleanText(doc?.label)} ${cleanText(doc?.description)}`;
    if (includesAny(all, ["iso", "9001"])) return "ISO";
    if (includesAny(all, ["תת", 'ת"ת', "תו תקן", "תקן ישראלי"])) return 'ת"ת';
    if (includesAny(all, ["רישיון", "רשיון", "license"])) return "רישיון";
    if (includesAny(all, ["אישור", "approval"])) return "אישור";
    return "";
  }
  if (includesAny(text, ["iso", "9001"])) return "ISO";
  if (includesAny(text, ["תת", 'ת"ת', "תו תקן", "תקן ישראלי"])) return 'ת"ת';
  if (includesAny(text, ["רישיון", "רשיון", "license"])) return "רישיון";
  return text;
};

const inferDocumentType = (doc: any): string => {
  // סוג תעודה נלקח קודם כל מהשדה שהוזן במערכת. אם נשמר רק MIME כמו application/pdf,
  // לא מציגים אותו; מנסים להסיק ISO/ת"ת/רישיון משם המסמך כדי שלא יופיע application/pdf בריכוז.
  const explicit = firstText(
    doc?.certificateType,
    doc?.documentType,
    doc?.docType,
    doc?.approvalType,
    doc?.licenseType,
    doc?.["פרטים"],
    valueByKeyOrLabel(doc, ["certificateType", "documentType", "docType", "approvalType", "licenseType", "details", "פרטים", "סוג תעודה", "סוג מסמך"]),
    valueByLabel(doc, ["פרטים", "סוג תעודה", "סוג מסמך", "סוג אישור", "סוג רישיון", "סוג רשיון"]),
    doc?.details,
    doc?.פרטים,
    doc?.kind,
    doc?.category,
    doc?.details?.certificateType,
    doc?.details?.documentType,
    doc?.details?.type,
    doc?.details?.kind,
    doc?.details?.פרטים,
    doc?.results?.certificateType,
    doc?.results?.documentType
  );
  return normalizeCertificateType(explicit, doc);
};

const certificateDisplayName = (doc: any): string => {
  const explicit = firstText(
    doc?.details,
    doc?.description,
    doc?.certificateName,
    doc?.documentName,
    doc?.title,
    doc?.label,
    doc?.פרטים,
    doc?.["שם תעודה"],
    doc?.["שם מסמך"],
    valueByKeyOrLabel(doc, ["certificateName", "documentName", "details", "description", "title", "label", "פרטים", "שם תעודה", "שם מסמך"]),
    valueByLabel(doc, ["פרטים", "שם תעודה", "שם מסמך", "סוג תעודה", "סוג מסמך"])
  );
  const normalized = normalizeCertificateType(explicit, doc);
  if (normalized) return normalized;
  return firstText(inferDocumentType(doc), attachmentName(doc), "תעודה");
};

const certificateNameAndNumber = (doc: any): string => {
  const name = certificateDisplayName(doc);
  const number = attachmentCertificateNo(doc);
  if (name && number) return `${name} ${number}`;
  return firstText(number, name);
};

const uniqueJoin = (values: unknown[], separator = ", "): string => {
  const seen = new Set<string>();
  const result: string[] = [];
  values.map(cleanText).filter(Boolean).forEach((value) => {
    if (seen.has(value)) return;
    seen.add(value);
    result.push(value);
  });
  return result.join(separator);
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
  if (Array.isArray(record?.referenceResults)) {
    record.referenceResults.forEach((r: any) =>
      parts.push(r?.metric, r?.resultValue, r?.qualityStatus, r?.minValue, r?.maxValue),
    );
  }
  return parts.filter(Boolean).join(" ");
};

const buildProjectMeta = (currentProjectName = "", meta?: ProjectConcentrationMeta): Required<ProjectConcentrationMeta> => ({
  projectName: firstText(meta?.projectName, currentProjectName),
  projectManager: firstText(meta?.projectManager, meta?.projectManagement),
  projectManagement: firstText(meta?.projectManagement, meta?.projectManager),
  contractor: firstText(meta?.contractor),
  qualityAssurance: "תיקו הנדסה אזרחית",
  qualityControl: firstText(meta?.qualityControl),
  workManager: firstText(meta?.workManager),
  surveyor: firstText(meta?.surveyor),
  supervisor: firstText(meta?.supervisor),
});

const preliminaryBySubtype = (records: any[], subtype: string) => records.filter((r) => normalize(r?.subtype) === normalize(subtype));

const supplierRow = (record: any, index: number): Row => {
  const supplier = record?.supplier ?? record;
  const docs = getAttachments(record);
  const firstDoc = docs[0] ?? {};

  const suppliedMaterial = firstText(
    supplier?.suppliedMaterial,
    supplier?.suppliedProduct,
    supplier?.materialSupplied,
    supplier?.productSupplied,
    supplier?.materialName,
    supplier?.material,
    supplier?.product,
    record?.suppliedMaterial,
    record?.suppliedProduct,
    record?.materialSupplied,
    record?.productSupplied,
    record?.material?.materialName,
    valueByKeyOrLabel(record, ["suppliedMaterial", "supplied_material", "materialSupplied", "suppliedProduct", "productSupplied", "suppliedGood", "providedMaterial"]),
    valueByLabel(record, ["חומר מסופק", "מוצר מסופק", "חומר/מוצר מסופק"])
  );

  const docNo = firstText(
    docs.map((d) => attachmentCertificateNo(d)).find(Boolean),
    supplier?.certificateNo,
    supplier?.certificateNumber,
    supplier?.licenseNo,
    supplier?.licenseNumber,
    supplier?.documentNo,
    supplier?.documentNumber,
    record?.certificateNo,
    record?.certificateNumber,
    record?.licenseNo,
    record?.licenseNumber,
    record?.documentNo,
    record?.documentNumber,
    valueByKeyOrLabel(record, ["certificateNo", "certificateNumber", "licenseNo", "licenseNumber", "documentNo", "documentNumber", "מספר תעודה", "מספר רישיון", "מספר רשיון", "מספר אישור"]),
    valueByLabel(record, ["מספר תעודה", "מס תעודה", "מספר רישיון", "מס רישיון", "מספר רשיון", "מס רשיון", "מספר אישור", "מס אישור"]),
    supplier?.approvalNo,
    supplier?.approvalNumber,
    record?.approvalNo,
    record?.approvalNumber
  );

  const docType = firstText(
    docs.map(inferDocumentType).find(Boolean),
    supplier?.certificateType,
    supplier?.documentType,
    supplier?.approvalType,
    supplier?.licenseType,
    supplier?.details,
    supplier?.פרטים,
    record?.certificateType,
    record?.documentType,
    record?.approvalType,
    record?.licenseType,
    record?.details,
    record?.פרטים,
    valueByKeyOrLabel(record, ["certificateType", "documentType", "approvalType", "licenseType", "docType", "details", "פרטים"]),
    valueByLabel(record, ["פרטים", "סוג תעודה", "סוג מסמך", "סוג אישור", "סוג רישיון", "סוג רשיון"])
  );

  const approvalDate = firstDateText(
    supplier?.approvalDate,
    supplier?.certificateApprovalDate,
    supplier?.approvedAt,
    record?.approvalDate,
    record?.approval?.date,
    firstDoc?.approvalDate,
    firstDoc?.certificateApprovalDate,
    firstDoc?.approvedAt,
    firstDoc?.date,
    valueByKeyOrLabel(record, ["approvalDate", "certificateApprovalDate", "approvedAt"]),
    valueByLabel(record, ["תאריך אישור", "תאריך אישור תעודה", "תאריך אישור רישיון", "תאריך אישור רשיון"])
  );

  const expiryDate = firstDateText(
    supplier?.expiryDate,
    supplier?.validUntil,
    supplier?.certificateExpiryDate,
    supplier?.licenseExpiryDate,
    supplier?.expirationDate,
    record?.expiryDate,
    record?.validUntil,
    record?.certificateExpiryDate,
    record?.licenseExpiryDate,
    firstDoc?.expiryDate,
    firstDoc?.validUntil,
    firstDoc?.certificateExpiryDate,
    firstDoc?.licenseExpiryDate,
    firstDoc?.expirationDate,
    valueByKeyOrLabel(record, ["expiryDate", "validUntil", "certificateExpiryDate", "licenseExpiryDate", "expirationDate"]),
    valueByLabel(record, ["תוקף", "בתוקף עד", "תאריך תוקף", "תוקף תעודה", "תוקף רישיון", "תוקף רשיון", "תאריך פג תוקף"])
  );

  return {
    "מס׳": index + 1,
    "שם ספק": firstText(supplier?.supplierName, supplier?.name, record?.title),
    "חומר/מוצר מסופק": suppliedMaterial,
    "תאריך אישור": approvalDate,
    "מספר תעודה / רישיון / אישור": docNo,
    "סוג תעודה /ISO/ת״ת/רישיון": normalizeCertificateType(docType, firstDoc),
    "סטטוס": firstText(record?.status, record?.approval?.status, supplier?.status),
    "תוקף": expiryDate,
    "הערות": firstText(supplier?.notes, record?.notes),
  };
};

const contractorRow = (record: any, index: number): Row => {
  const contractor = record?.subcontractor ?? record;
  const docs = getAttachments(record);
  const certNumbers = uniqueJoin([
    contractor?.approvalNo,
    contractor?.certificateNo,
    contractor?.licenseNo,
    contractor?.registrationNo,
    contractor?.classificationNo,
    record?.approvalNo,
    record?.certificateNo,
    ...docs.map((d) => attachmentCertificateNo(d)),
  ]);
  const certificateDetails = uniqueJoin(docs.map(certificateNameAndNumber), " | ");
  const docTypes = uniqueJoin(docs.map(certificateDisplayName));
  const certificatesSummary = firstText(certificateDetails, certNumbers);
  return {
    "מס׳": index + 1,
    "שם קבלן / קבלן משנה": firstText(contractor?.subcontractorName, contractor?.contractorName, contractor?.name, record?.title),
    "תחום ביצוע": firstText(contractor?.field, contractor?.workType, record?.workType),
    "סיווג ברשם הקבלנים / מספר תעודה / רישיון / אישור": firstText(contractor?.classification, contractor?.contractorClassification, certNumbers),
    "מספר תעודה / רישיון / אישור": certificatesSummary,
    "שם / סוג תעודה": docTypes,
    "מס׳ מסמכים": docs.length || "",
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
    "מספר תעודה / אישור": firstText(docs.map((d) => attachmentCertificateNo(d)).find(Boolean), material?.certificateNo, material?.approvalNo, record?.certificateNo),
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


const controlProcessRow = (record: any, index: number): Row => {
  const docs = Array.isArray(record?.requiredDocuments) ? record.requiredDocuments : [];
  const referenceResults = Array.isArray(record?.referenceResults) ? record.referenceResults : [];
  const certNo = firstText(
    docs.map((d: any) => firstText(d?.certificateNo, d?.certificateNumber, d?.documentNo, d?.documentNumber, d?.approvalNo, d?.referenceNo, d?.fileName, d?.name)).find(Boolean),
    referenceResults.map((r: any) => firstText(r?.certificateNo, r?.certificateNumber, r?.documentNo, r?.documentNumber, r?.referenceNo, r?.labCertificateNo)).find(Boolean)
  );
  const docTypes = Array.from(new Set(docs.map((d: any) => firstText(d?.type, d?.documentType, d?.title, d?.name)).filter(Boolean)));
  return {
    "מס׳": index + 1,
    "שם/כותרת": firstText(record?.title, record?.processNo, record?.workType),
    "מיקום": firstText(record?.location, record?.fromSection, record?.toSection),
    "תאריך": dateText(record?.savedAt ?? record?.updatedAt ?? record?.createdAt),
    "סעיף מפרט": firstText(record?.specSection),
    "סוג עבודה": firstText(record?.workType),
    "מספר תעודה / רישיון / אישור": certNo,
    "סוג תעודה": docTypes.join(", "),
    "מס׳ מסמכים": docs.length || "",
    "סטטוס": firstText(record?.status, record?.approval?.status),
    "הערות": firstText(record?.notes, record?.description),
  };
};

const rfiRow = (record: any, index: number): Row => ({
  "מס׳": index + 1,
  "מספר RFI": firstText(record?.rfiNumber, record?.referenceNo, record?.title),
  "נושא": firstText(record?.title, record?.planName),
  "מיקום": firstText(record?.location, record?.building, record?.fromSection, record?.toSection),
  "תאריך פתיחה": dateText(record?.openDate ?? record?.savedAt),
  "סטטוס": firstText(record?.status),
  "תיאור הבקשה": firstText(record?.requestDescription),
  "תשובה/טיפול": firstText(record?.response),
  "נספחים": Array.isArray(record?.documents) ? record.documents.length : "",
  "הערות": firstText(record?.notes),
});


const matzeaAColumns = [
  "מס׳ סדורי",
  "ביצוע ע״י",
  "מס׳ תעודה",
  "תאריך",
  "מקור החומר",
  "מקום נטילת מדגם לבדיקה",
  "מקום הפיזור / מבנה",
  "חתך התחלה",
  "חתך סוף",
  "3\"",
  "1.5\"",
  "3/4\"",
  "#4",
  "#10",
  "#40",
  "#200",
  "LL",
  "PL",
  "PI",
  "שע״ח (%)",
  "צפיפות ממשית (ט/מ״ק)",
  "ספיגות (%)",
  "לוס אנג׳לס (%)",
  "מיון AASHTO",
  "צפיפות מעבדתית מקסימלית",
  "רטיבות אופטימלית",
  "מספר תעודה",
  "מעמד החומר",
  "הערות",
];

const metricValue = (record: any, aliases: string[]): string => {
  const normalizedAliases = aliases.map(normalize).filter(Boolean);
  const rows = Array.isArray(record?.referenceResults) ? record.referenceResults : [];
  for (const row of rows) {
    const metric = normalize(firstText(row?.metric, row?.name, row?.label, row?.measure));
    if (normalizedAliases.some((alias) => metric === alias || metric.includes(alias) || alias.includes(metric))) {
      const value = firstText(row?.resultValue, row?.value, row?.result);
      if (value) return value;
    }
  }
  return "";
};

const referenceDocNo = (record: any): string => {
  const docs = Array.isArray(record?.requiredDocuments) ? record.requiredDocuments : [];
  return firstText(
    metricValue(record, ["מספר תעודת מעבדה", "מס תעודת מעבדה", "מספר תעודה", "תעודה"]),
    docs.map((d: any) => certificateNumberFromAttachment(d)).find(Boolean),
    docs.map((d: any) => firstText(d?.certificateNo, d?.certificateNumber, d?.documentNo, d?.documentNumber, d?.referenceNo, d?.attachmentName, d?.name)).find(Boolean),
  );
};

const isMatzeaAProcess = (record: any): boolean => {
  const text = recordText(record);
  return includesAny(text, ["מצע א", "מצע א׳", "אפיון מצע", "תעודת ייחוס", "24403"]);
};

const matzeaAProcessRow = (record: any, index: number): Row => ({
  "מס׳ סדורי": index + 1,
  "ביצוע ע״י": firstText(metricValue(record, ["ביצוע עי", 'ביצוע ע"י']), "QC"),
  "מס׳ תעודה": referenceDocNo(record),
  "תאריך": firstText(metricValue(record, ["תאריך"]), dateText(record?.savedAt ?? record?.updatedAt ?? record?.createdAt)),
  "מקור החומר": firstText(metricValue(record, ["מקור החומר", "מקור"]), record?.fromSection),
  "מקום נטילת מדגם לבדיקה": firstText(metricValue(record, ["מקום הדגם לבדיקה", "מקום נטילת מדגם לבדיקה", "מקום הדיגום"]), record?.location),
  "מקום הפיזור / מבנה": firstText(metricValue(record, ["מבנה"]), metricValue(record, ["מקום הפיזור", "מיקום שימוש מיועד"]), record?.toSection),
  "חתך התחלה": firstText(metricValue(record, ["חתך התחלה", "מחתך"]), record?.fromSection),
  "חתך סוף": firstText(metricValue(record, ["חתך סוף", "עד חתך"]), record?.toSection),
  "3\"": metricValue(record, ["3\"", "3'", "3 אינץ", "3”"]),
  "1.5\"": metricValue(record, ["1.5\"", "1.5'", "1.5 אינץ", "1.5”"]),
  "3/4\"": metricValue(record, ["3/4\"", "3/4'", "3/4", "מקטע 3/4"]),
  "#4": metricValue(record, ["#4", "נפה 4"]),
  "#10": metricValue(record, ["#10", "נפה 10"]),
  "#40": metricValue(record, ["#40", "נפה 40"]),
  "#200": metricValue(record, ["#200", "נפה 200"]),
  "LL": metricValue(record, ["LL", "גבול נזילות"]),
  "PL": metricValue(record, ["PL", "גבול פלסטיות"]),
  "PI": metricValue(record, ["PI", "אינדקס פלסטיות"]),
  "שע״ח (%)": metricValue(record, ["שווה ערך חול", "שעח"]),
  "צפיפות ממשית (ט/מ״ק)": metricValue(record, ["צפיפות מכשירית", "צפיפות ממשית"]),
  "ספיגות (%)": metricValue(record, ["ספיגות", "ספיגות (G)"]),
  "לוס אנג׳לס (%)": metricValue(record, ["לוס אנגלס", "לוס אנג'לס", "לוס אנג׳לס"]),
  "מיון AASHTO": firstText(metricValue(record, ["דירוג AASHTO מיין", "מיין AASHTO", "AASHTO"])),
  "צפיפות מעבדתית מקסימלית": metricValue(record, ["צפיפות מעבדתית מקסימלית"]),
  "רטיבות אופטימלית": metricValue(record, ["רטיבות אופטימלית"]),
  "מספר תעודה": referenceDocNo(record),
  "מעמד החומר": firstText(metricValue(record, ["מעמד החומר"]), record?.status, record?.approval?.status),
  "הערות": firstText(record?.notes, record?.description),
});

const matzeaAChecklistRow = (row: Row, index: number): Row => ({
  "מס׳ סדורי": index + 1,
  "ביצוע ע״י": firstText(row["מבצע/אחראי"], "QC"),
  "מס׳ תעודה": firstText(row["מספר תעודה"]),
  "תאריך": firstText(row["תאריך"]),
  "מקור החומר": "",
  "מקום נטילת מדגם לבדיקה": firstText(row["מיקום"]),
  "מקום הפיזור / מבנה": "",
  "חתך התחלה": "",
  "חתך סוף": "",
  "3\"": "",
  "1.5\"": "",
  "3/4\"": "",
  "#4": "",
  "#10": "",
  "#40": "",
  "#200": "",
  "LL": "",
  "PL": "",
  "PI": "",
  "שע״ח (%)": "",
  "צפיפות ממשית (ט/מ״ק)": "",
  "ספיגות (%)": "",
  "לוס אנג׳לס (%)": "",
  "מיון AASHTO": "",
  "צפיפות מעבדתית מקסימלית": "",
  "רטיבות אופטימלית": "",
  "מספר תעודה": firstText(row["מספר תעודה"]),
  "מעמד החומר": firstText(row["סטטוס"]),
  "הערות": firstText(row["תוצאות/הערות"]),
});

const buildMatzeaAConcentrationRows = (checklists: any[], processes: any[]): Row[] => {
  const checklist = checklistRows(checklists, ["מצע א", "מצע א׳", "אפיון מצע", "cbr", "גרדציה", "תעודת ייחוס", "24403"], "אפיון מצע א׳")
    .map((row, index) => matzeaAChecklistRow(row, index));
  const process = processes
    .filter(isMatzeaAProcess)
    .map((record, index) => matzeaAProcessRow(record, checklist.length + index));
  return [...checklist, ...process].map((row, index) => ({ ...row, "מס׳ סדורי": index + 1 }));
};

const selectedMaterialColumns = matzeaAColumns;

const isSelectedMaterialProcess = (record: any): boolean => {
  const text = recordText(record);
  return includesAny(text, ["נברר", "חומר נברר", "מילוי נברר", "אפיון נברר", "A-2-4", "a-2-4"]);
};

const selectedMaterialProcessRow = (record: any, index: number): Row => ({
  "מס׳ סדורי": index + 1,
  "ביצוע ע״י": firstText(metricValue(record, ["ביצוע עי", 'ביצוע ע"י']), "QC"),
  "מס׳ תעודה": referenceDocNo(record),
  "תאריך": firstText(metricValue(record, ["תאריך"]), dateText(record?.savedAt ?? record?.updatedAt ?? record?.createdAt)),
  "מקור החומר": firstText(metricValue(record, ["מקור החומר", "מקור"]), record?.fromSection),
  "מקום נטילת מדגם לבדיקה": firstText(metricValue(record, ["מקום הדגם לבדיקה", "מקום נטילת מדגם לבדיקה", "מקום הדיגום"]), record?.location),
  "מקום הפיזור / מבנה": firstText(metricValue(record, ["מבנה"]), metricValue(record, ["מקום הפיזור", "מיקום שימוש מיועד"]), record?.toSection),
  "חתך התחלה": firstText(metricValue(record, ["חתך התחלה", "מחתך"]), record?.fromSection),
  "חתך סוף": firstText(metricValue(record, ["חתך סוף", "עד חתך"]), record?.toSection),
  '3"': metricValue(record, ['3"', "3'", "3 אינץ", "3”"]),
  '1.5"': metricValue(record, ['1.5"', "1.5'", "1.5 אינץ", "1.5”"]),
  '3/4"': metricValue(record, ['3/4"', "3/4'", "3/4", "מקטע 3/4"]),
  "#4": metricValue(record, ["#4", "נפה 4"]),
  "#10": metricValue(record, ["#10", "נפה 10"]),
  "#40": metricValue(record, ["#40", "נפה 40"]),
  "#200": metricValue(record, ["#200", "נפה 200"]),
  "LL": metricValue(record, ["LL", "גבול נזילות"]),
  "PL": metricValue(record, ["PL", "גבול פלסטיות"]),
  "PI": metricValue(record, ["PI", "אינדקס פלסטיות"]),
  "שע״ח (%)": metricValue(record, ["שווה ערך חול", "שעח"]),
  "צפיפות ממשית (ט/מ״ק)": metricValue(record, ["צפיפות מכשירית", "צפיפות ממשית"]),
  "ספיגות (%)": metricValue(record, ["ספיגות", "ספיגות (G)"]),
  "לוס אנג׳לס (%)": metricValue(record, ["לוס אנגלס", "לוס אנג'לס", "לוס אנג׳לס"]),
  "מיון AASHTO": firstText(metricValue(record, ["דירוג AASHTO מיין", "מיין AASHTO", "AASHTO"])),
  "צפיפות מעבדתית מקסימלית": metricValue(record, ["צפיפות מעבדתית מקסימלית"]),
  "רטיבות אופטימלית": metricValue(record, ["רטיבות אופטימלית"]),
  "מספר תעודה": referenceDocNo(record),
  "מעמד החומר": firstText(metricValue(record, ["מעמד החומר"]), record?.status, record?.approval?.status),
  "הערות": firstText(metricValue(record, ["מיון אחיד"]), record?.notes, record?.description),
});

const buildSelectedMaterialConcentrationRows = (checklists: any[], processes: any[]): Row[] => {
  const checklist = checklistRows(checklists, ["נברר", "חומר נברר", "מילוי נברר", "אפיון נברר", "A-2-4", "a-2-4", "cbr", "גרדציה"], "אפיון נברר")
    .map((row, index) => matzeaAChecklistRow(row, index));
  const process = processes
    .filter(isSelectedMaterialProcess)
    .map((record, index) => selectedMaterialProcessRow(record, checklist.length + index));
  return [...checklist, ...process].map((row, index) => ({ ...row, "מס׳ סדורי": index + 1 }));
};

const commonProcessColumns = ["מס׳", "שם/כותרת", "מיקום", "תאריך", "סעיף מפרט", "סוג עבודה", "מספר תעודה / רישיון / אישור", "סוג תעודה", "מס׳ מסמכים", "סטטוס", "הערות"];
const combinedChecklistAndProcesses = (checklists: any[], processes: any[], keywords: string[], label: string): Row[] => {
  const checklist = checklistRows(checklists, keywords, label);
  const process = processes
    .filter((r) => includesAny(recordText(r), keywords))
    .map((r, i) => controlProcessRow(r, checklist.length + i));
  return [...checklist, ...process];
};

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
    columns: ["מס׳", "שם ספק", "חומר/מוצר מסופק", "תאריך אישור", "מספר תעודה / רישיון / אישור", "סוג תעודה /ISO/ת״ת/רישיון", "סטטוס", "תוקף", "הערות"],
    buildRows: ({ savedPreliminary }) => preliminaryBySubtype(savedPreliminary, "suppliers").map(supplierRow),
  },
  {
    id: "contractors",
    title: "ריכוז קבלנים",
    fileName: "ריכוז קבלנים.xlsx",
    description: "ריכוז מתוך אישורי קבלנים/קבלני משנה בבקרה מקדימה",
    sourceLabel: "בקרה מקדימה / קבלנים",
    columns: ["מס׳", "שם קבלן / קבלן משנה", "תחום ביצוע", "סיווג ברשם הקבלנים / מספר תעודה / רישיון / אישור", "מספר תעודה / רישיון / אישור", "שם / סוג תעודה", "מס׳ מסמכים", "סטטוס", "תאריך", "הערות"],
    buildRows: ({ savedPreliminary }) => preliminaryBySubtype(savedPreliminary, "subcontractors").map(contractorRow),
  },
  {
    id: "asphalt",
    title: "ריכוז בדיקות אספלט",
    fileName: "ריכוז בדיקות אספלט.xlsx",
    description: "בדיקות אספלט מתוך רשימות תיוג ותעודות מצורפות",
    sourceLabel: "רשימות תיוג",
    columns: commonChecklistColumns,
    buildRows: ({ savedChecklists, savedControlProcesses }) => combinedChecklistAndProcesses(savedChecklists, savedControlProcesses, ["אספלט", "fwd", "מישוריות", "שכבה סופית", "מרשל"], "בדיקות אספלט"),
  },
  {
    id: "density",
    title: "ריכוז בדיקות צפיפות",
    fileName: "ריכוז בדיקות צפיפות.xlsx",
    description: "צפיפות / הידוק / רטיבות / מצעים מתוך רשימות תיוג",
    sourceLabel: "רשימות תיוג",
    columns: commonChecklistColumns,
    buildRows: ({ savedChecklists, savedControlProcesses }) => combinedChecklistAndProcesses(savedChecklists, savedControlProcesses, ["צפיפות", "הידוק", "רטיבות", "מצע", "מצעים", "דרגת הידוק"], "בדיקות צפיפות"),
  },
  {
    id: "concrete",
    title: "ריכוז בטון",
    fileName: "ריכוז בטון.xlsx",
    description: "בדיקות בטון מתוך רשימות תיוג ותעודות מצורפות",
    sourceLabel: "רשימות תיוג",
    columns: commonChecklistColumns,
    buildRows: ({ savedChecklists, savedControlProcesses }) => combinedChecklistAndProcesses(savedChecklists, savedControlProcesses, ["בטון", "יציקה", "קוביות", "חוזק", "ב-30", "ב-40", "ב-50", "ב-60"], "בדיקות בטון"),
  },
  {
    id: "supervision",
    title: "ריכוז דוחות פיקוח עליון",
    fileName: "ריכוז דוחות פיקוח עליון.xlsx",
    description: "ריכוז דוחות/רשומות פיקוח עליון מתוך המערכת",
    sourceLabel: "דוחות / קטעי ניסוי",
    columns: ["מס׳", "נושא", "מיקום", "תאריך", "מאשר/בודק", "סטטוס", "תיאור", "הערות"],
    buildRows: ({ savedChecklists, savedTrialSections, savedControlProcesses }) => [
      ...savedChecklists.filter((r) => includesAny(recordText(r), ["פיקוח עליון", "דוח פיקוח", "פיקוח"])).map((r, i) => ({ "מס׳": i + 1, "נושא": firstText(r?.title, r?.checklistName), "מיקום": firstText(r?.location), "תאריך": dateText(r?.date ?? r?.savedAt), "מאשר/בודק": firstText(r?.approvedBy, r?.inspector), "סטטוס": firstText(r?.status), "תיאור": firstText(r?.description, r?.spec), "הערות": firstText(r?.notes) })),
      ...savedTrialSections.filter((r) => includesAny(recordText(r), ["פיקוח עליון", "דוח פיקוח", "פיקוח"])).map((r, i) => ({ "מס׳": savedChecklists.length + i + 1, "נושא": firstText(r?.title), "מיקום": firstText(r?.location), "תאריך": dateText(r?.date ?? r?.savedAt), "מאשר/בודק": firstText(r?.approvedBy), "סטטוס": firstText(r?.status), "תיאור": firstText(r?.description, r?.spec), "הערות": firstText(r?.notes) })),
      ...savedControlProcesses.filter((r) => includesAny(recordText(r), ["פיקוח עליון", "דוח פיקוח", "פיקוח"])).map((r, i) => ({ "מס׳": savedChecklists.length + savedTrialSections.length + i + 1, "נושא": firstText(r?.title, r?.workType), "מיקום": firstText(r?.location), "תאריך": dateText(r?.savedAt), "מאשר/בודק": firstText(r?.approval?.approvedBy), "סטטוס": firstText(r?.status), "תיאור": firstText(r?.description, r?.specSection), "הערות": firstText(r?.notes) })),
    ],
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
    sourceLabel: "בקרה מקדימה / תעודות ייחוס",
    columns: matzeaAColumns,
    buildRows: ({ savedChecklists, savedControlProcesses }) => buildMatzeaAConcentrationRows(savedChecklists, savedControlProcesses),
  },
  {
    id: "selected-material",
    title: "ריכוז אפיון נברר",
    fileName: "ריכוז אפיון נברר.xlsx",
    description: "אפיון חומר נברר מתוך תעודות/רשימות תיוג רלוונטיות",
    sourceLabel: "רשימות תיוג / תעודות",
    columns: selectedMaterialColumns,
    buildRows: ({ savedChecklists, savedControlProcesses }) => buildSelectedMaterialConcentrationRows(savedChecklists, savedControlProcesses),
  },
  {
    id: "earthworks",
    title: "בדיקות שדה / עבודות עפר",
    fileName: "בדיקות שדה - עבודות עפר.xlsx",
    description: "עבודות עפר / בדיקות שדה מתוך רשימות תיוג",
    sourceLabel: "רשימות תיוג",
    columns: commonChecklistColumns,
    buildRows: ({ savedChecklists, savedControlProcesses }) => combinedChecklistAndProcesses(savedChecklists, savedControlProcesses, ["עבודות עפר", "עפר", "חפירה", "מילוי", "שדה", "הידוק מבוקר"], "בדיקות שדה / עבודות עפר"),
  },
  {
    id: "rfi",
    title: "RFI",
    fileName: "RFI.xlsx",
    description: "ריכוז RFI מתוך הרשומות שנשמרו במערכת",
    sourceLabel: "RFI",
    columns: ["מס׳", "מספר RFI", "נושא", "מיקום", "תאריך פתיחה", "סטטוס", "תיאור הבקשה", "תשובה/טיפול", "נספחים", "הערות"],
    buildRows: ({ savedRfis }) => savedRfis.map(rfiRow),
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

const rowXml = (r: number, values: unknown[], style = 0, height?: number) => `<row r="${r}"${height ? ` ht="${height}" customHeight="1"` : ""}>${values.map((v, i) => cell(r, i + 1, v, style)).join("")}</row>`;

const emptyRowXml = (r: number, height?: number) =>
  `<row r="${r}"${height ? ` ht="${height}" customHeight="1"` : ""}/>`;

const rowXmlFromColumn = (r: number, startCol: number, values: unknown[], style = 0, height?: number) =>
  `<row r="${r}"${height ? ` ht="${height}" customHeight="1"` : ""}>${values.map((v, i) => cell(r, startCol + i, v, style)).join("")}</row>`;


const matzeaASpecHeaderRows = [
  ["מס׳ סדורי", "ביצוע ע״י", "מס׳ תעודה", "תאריך", "מקור החומר", "מקום נטילת מדגם לבדיקה", "מקום הפיזור", "", "", "דירוג ( % עובר )", "", "", "", "", "", "", "גבולות פלסטיות וסומך (%)", "", "", "שע״ח (%)", "אגרגט גס", "", "לוס אנג׳לס (%)", "מיון AASHTO", "צפיפות מעבדתית מקסימלית", "רטיבות אופטימלית", "מספר תעודה", "מעמד החומר", "הערות"],
  ["", "", "", "", "", "", "", "", "", "3\"", "1.5\"", "3/4\"", "#4", "#10", "#40", "#200", "LL", "PL", "PI", "", "צפיפות ממשית (ט/מ״ק)", "ספיגות (%)", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", "", "", "דרישות המפרט", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["", "QC/QA", "", "", "", "", "מבנה", "חתכים", "", "", "100", "85", "55", "40", "", "15", "25", "", "6", "27", "2.3", "", "35 max", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", "התחלה", "סוף", "100", "80", "60", "30", "20", "", "5", "", "", "", "", "", "", "", "", "", "", "", "", ""],
];

const matzeaAExportColumns = [
  "מס׳ סדורי",
  "ביצוע ע״י",
  "מס׳ תעודה",
  "תאריך",
  "מקור החומר",
  "מקום נטילת מדגם לבדיקה",
  "מקום הפיזור / מבנה",
  "חתך התחלה",
  "חתך סוף",
  "3\"",
  "1.5\"",
  "3/4\"",
  "#4",
  "#10",
  "#40",
  "#200",
  "LL",
  "PL",
  "PI",
  "שע״ח (%)",
  "צפיפות ממשית (ט/מ״ק)",
  "ספיגות (%)",
  "לוס אנג׳לס (%)",
  "מיון AASHTO",
  "צפיפות מעבדתית מקסימלית",
  "רטיבות אופטימלית",
  "מספר תעודה",
  "מעמד החומר",
  "הערות",
];

const buildMatzeaAWorksheetXml = (definition: ConcentrationDefinition, rows: Row[], meta: Required<ProjectConcentrationMeta>) => {
  let r = 1;
  const sheetRows: string[] = [];
  const widthCount = 29;

  sheetRows.push(emptyRowXml(r++, 14));
  sheetRows.push(rowXmlFromColumn(r++, 8, ["דו״ח ריכוז בדיקות איפיון למצע סוג א׳", "", "", "", "", "", "", ""], 1, 20));
  sheetRows.push(emptyRowXml(r++, 18));
  sheetRows.push(rowXmlFromColumn(r++, 8, ["שם פרויקט:", "", meta.projectName, "", "", "", "", ""], 2, 20));
  sheetRows.push(rowXmlFromColumn(r++, 8, ["ניהול פרויקט", "", meta.projectManager || meta.projectManagement, "", "", "", "", ""], 2, 20));
  sheetRows.push(rowXmlFromColumn(r++, 8, ["שם הקבלן", "", meta.contractor, "", "", "", "", ""], 2, 20));
  sheetRows.push(rowXmlFromColumn(r++, 8, [`בקרת איכות - ${meta.qualityControl || ""}`, "", "", "", `הבטחת איכות - ${meta.qualityAssurance || ""}`, "", "", ""], 2, 20));
  sheetRows.push(emptyRowXml(r++, 16));
  sheetRows.push(emptyRowXml(r++, 16));

  matzeaASpecHeaderRows.forEach((values, index) => sheetRows.push(rowXml(r++, values, index <= 1 ? 3 : 2, index <= 1 ? 32 : 24)));

  if (rows.length) {
    rows.forEach((item) => sheetRows.push(rowXml(r++, matzeaAExportColumns.map((column) => item[column] ?? ""), 6, 24)));
  } else {
    sheetRows.push(rowXml(r++, ["אין נתונים שמורים לריכוז זה בפרויקט הנוכחי", ...Array.from({ length: widthCount - 1 }, () => "")], 4, 24));
  }

  const cols = Array.from({ length: widthCount }, (_, i) => `<col min="${i + 1}" max="${i + 1}" width="${i >= 9 && i <= 22 ? 11 : 18}" customWidth="1"/>`).join("");
  const mergeRefs = [
    "H2:O2",
    "H4:I4", "J4:O4",
    "H5:I5", "J5:O5",
    "H6:I6", "J6:O6",
    "H7:K7", "L7:O7",
    "A10:A14", "B10:B12", "B13:B14", "C10:C14", "D10:D14", "E10:E14", "F10:F14",
    "G10:I12", "G13:G14", "H13:I13",
    "J10:P10", "Q10:S10", "T10:T11", "U10:V10", "W10:W11",
    "J12:W12", "Q13:Q14", "R13:R14", "S13:S14", "T13:T14", "U13:U14", "V13:V14", "W13:W14",
    "X10:X14", "Y10:Y14", "Z10:Z14", "AA10:AA14", "AB10:AB14", "AC10:AC14",
  ];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${sheetRows.join("")}</sheetData>
  <mergeCells count="${mergeRefs.length}">${mergeRefs.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>
</worksheet>`;
};

const selectedMaterialSpecHeaderRows = [
  ["מס׳ סדורי", "ביצוע ע״י", "מס׳ תעודה", "תאריך", "מקור החומר", "מקום נטילת מדגם לבדיקה", "מקום הפיזור", "", "", "דירוג ( % עובר )", "", "", "", "", "", "", "גבולות פלסטיות וסומך (%)", "", "", "שע״ח (%)", "אגרגט גס", "", "לוס אנג׳לס (%)", "מיון AASHTO", "צפיפות מעבדתית מקסימלית", "רטיבות אופטימלית", "מספר תעודה", "מעמד החומר", "הערות"],
  ["", "QC/QA", "", "", "", "", "", "", "", '3"', '1.5"', '3/4"', "#4", "#10", "#40", "#200", "LL", "PL", "PI", "", "צפיפות ממשית (ט/מ״ק)", "ספיגות (%)", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", "", "", "דרישות המפרט", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "מבנה", "חתכים", "", "100", "100", "100", "", "", "", "35", "40", "", "10", "", "", "", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", "התחלה", "סוף", "", "", "", "", "", "", "0", "0", "", "0", "", "", "", "", "", "", "", "", "", ""],
];

const selectedMaterialExportColumns = selectedMaterialColumns;

const buildSelectedMaterialWorksheetXml = (definition: ConcentrationDefinition, rows: Row[], meta: Required<ProjectConcentrationMeta>) => {
  let r = 1;
  const sheetRows: string[] = [];
  const widthCount = 29;

  sheetRows.push(emptyRowXml(r++, 14));
  sheetRows.push(rowXmlFromColumn(r++, 8, ["דו״ח ריכוז בדיקות איפיון לחומר נברר", "", "", "", "", "", "", ""], 1, 20));
  sheetRows.push(emptyRowXml(r++, 18));
  sheetRows.push(rowXmlFromColumn(r++, 8, ["שם פרויקט:", "", meta.projectName, "", "", "", "", ""], 2, 20));
  sheetRows.push(rowXmlFromColumn(r++, 8, ["ניהול פרויקט", "", meta.projectManager || meta.projectManagement, "", "", "", "", ""], 2, 20));
  sheetRows.push(rowXmlFromColumn(r++, 8, ["שם הקבלן", "", meta.contractor, "", "", "", "", ""], 2, 20));
  sheetRows.push(rowXmlFromColumn(r++, 8, [`בקרת איכות - ${meta.qualityControl || ""}`, "", "", "", `הבטחת איכות - ${meta.qualityAssurance || ""}`, "", "", ""], 2, 20));
  sheetRows.push(emptyRowXml(r++, 16));
  sheetRows.push(emptyRowXml(r++, 16));

  selectedMaterialSpecHeaderRows.forEach((values, index) => sheetRows.push(rowXml(r++, values, index <= 1 ? 3 : 2, index <= 1 ? 32 : 24)));

  if (rows.length) {
    rows.forEach((item) => sheetRows.push(rowXml(r++, selectedMaterialExportColumns.map((column) => item[column] ?? ""), 6, 24)));
  } else {
    sheetRows.push(rowXml(r++, ["אין נתונים שמורים לריכוז זה בפרויקט הנוכחי", ...Array.from({ length: widthCount - 1 }, () => "")], 4, 24));
  }

  const cols = Array.from({ length: widthCount }, (_, i) => `<col min="${i + 1}" max="${i + 1}" width="${i >= 9 && i <= 22 ? 11 : 18}" customWidth="1"/>`).join("");
  const mergeRefs = [
    "H2:O2",
    "H4:I4", "J4:O4",
    "H5:I5", "J5:O5",
    "H6:I6", "J6:O6",
    "H7:K7", "L7:O7",
    "A10:A14", "B10:B12", "B13:B14", "C10:C14", "D10:D14", "E10:E14", "F10:F14",
    "G10:I12", "G13:G14", "H13:I13",
    "J10:P10", "Q10:S10", "T10:T11", "U10:V10", "W10:W11",
    "J12:W12", "Q13:Q14", "R13:R14", "S13:S14", "T13:T14", "U13:U14", "V13:V14", "W13:W14",
    "X10:X14", "Y10:Y14", "Z10:Z14", "AA10:AA14", "AB10:AB14", "AC10:AC14",
  ];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${sheetRows.join("")}</sheetData>
  <mergeCells count="${mergeRefs.length}">${mergeRefs.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>
</worksheet>`;
};


const buildStandardHeaderRows = (
  definition: ConcentrationDefinition,
  meta: Required<ProjectConcentrationMeta>,
): { rows: string[]; nextRow: number; merges: string[] } => {
  let r = 1;
  const rows: string[] = [];
  const merges: string[] = [];

  // כותרת עליונה אחידה לכל הריכוזים — זהה לפריסת ריכוז איפיון מצע א׳.
  // מתחילה בעמודה H ומסתיימת בעמודה O כדי שלא תימתח לפי מספר עמודות הריכוז.
  rows.push(emptyRowXml(r++, 14));
  rows.push(rowXmlFromColumn(r++, 8, [definition.title, "", "", "", "", "", "", ""], 1, 20));
  rows.push(emptyRowXml(r++, 18));
  rows.push(rowXmlFromColumn(r++, 8, ["שם פרויקט:", "", meta.projectName, "", "", "", "", ""], 2, 20));
  rows.push(rowXmlFromColumn(r++, 8, ["ניהול פרויקט", "", meta.projectManager || meta.projectManagement, "", "", "", "", ""], 2, 20));
  rows.push(rowXmlFromColumn(r++, 8, ["שם הקבלן", "", meta.contractor, "", "", "", "", ""], 2, 20));
  rows.push(rowXmlFromColumn(r++, 8, [`בקרת איכות - ${meta.qualityControl || ""}`, "", "", "", `הבטחת איכות - ${meta.qualityAssurance || ""}`, "", "", ""], 2, 20));
  rows.push(emptyRowXml(r++, 16));
  rows.push(emptyRowXml(r++, 16));

  merges.push("H2:O2");
  merges.push("H4:I4", "J4:O4");
  merges.push("H5:I5", "J5:O5");
  merges.push("H6:I6", "J6:O6");
  merges.push("H7:K7", "L7:O7");

  return { rows, nextRow: r, merges };
};

const buildStandardWorksheetXml = (
  definition: ConcentrationDefinition,
  rows: Row[],
  meta: Required<ProjectConcentrationMeta>,
) => {
  // רק טבלת פרטי הפרויקט זהה לריכוז איפיון מצע א׳.
  // טבלת הריכוז עצמה נשארת לפי מספר העמודות האמיתי שלה, בלי למתוח אותה ל-A:AC.
  const tableStartCol = 8; // H — מיושר מתחת לטבלת פרטי הפרויקט.
  const header = buildStandardHeaderRows(definition, meta);
  let r = header.nextRow;
  const sheetRows: string[] = [...header.rows];
  const visibleColumns = definition.columns;
  const maxCol = Math.max(15, tableStartCol + visibleColumns.length - 1);

  sheetRows.push(rowXmlFromColumn(r++, tableStartCol, visibleColumns, 3, 30));

  if (rows.length) {
    rows.forEach((item) =>
      sheetRows.push(rowXmlFromColumn(
        r++,
        tableStartCol,
        visibleColumns.map((column) => item[column] ?? ""),
        6,
        24,
      )),
    );
  } else {
    sheetRows.push(rowXmlFromColumn(r++, tableStartCol, ["אין נתונים שמורים לריכוז זה בפרויקט הנוכחי"], 4, 24));
  }

  const cols = Array.from({ length: maxCol }, (_, i) =>
    `<col min="${i + 1}" max="${i + 1}" width="18" customWidth="1"/>`,
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${sheetRows.join("")}</sheetData>
  <mergeCells count="${header.merges.length}">${header.merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>
</worksheet>`;
};

const buildWorksheetXml = (
  definition: ConcentrationDefinition,
  rows: Row[],
  meta: Required<ProjectConcentrationMeta>,
) => {
  if (definition.id === "subbase-a") return buildMatzeaAWorksheetXml(definition, rows, meta);
  if (definition.id === "selected-material") return buildSelectedMaterialWorksheetXml(definition, rows, meta);
  return buildStandardWorksheetXml(definition, rows, meta);
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
  <borders count="3"><border/><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom></border><border><left style="medium"><color rgb="FF000000"/></left><right style="medium"><color rgb="FF000000"/></right><top style="medium"><color rgb="FF000000"/></top><bottom style="medium"><color rgb="FF000000"/></bottom></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
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

export function ConcentrationsSection({ savedChecklists = [], savedNonconformances = [], savedTrialSections = [], savedPreliminary = [], savedRfis = [], savedControlProcesses = [], currentProjectName = "", projectMeta }: Props) {
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<ConcentrationId | null>(null);

  const meta = useMemo(() => buildProjectMeta(currentProjectName, projectMeta), [currentProjectName, projectMeta]);
  const ctx: BuildContext = useMemo(() => ({ savedChecklists, savedNonconformances, savedTrialSections, savedPreliminary, savedRfis, savedControlProcesses, projectMeta: meta }), [savedChecklists, savedNonconformances, savedTrialSections, savedPreliminary, savedRfis, savedControlProcesses, meta]);

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
                          <th key={column} style={{ position: "sticky", top: 0, background: "#0f172a", color: "#fff", padding: 8, border: "1px solid #e2e8f0", whiteSpace: "normal", textAlign: "center", verticalAlign: "middle" }}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length ? rows.slice(0, 20).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {definition.columns.slice(0, 8).map((column) => (
                            <td key={column} style={{ padding: 8, border: "1px solid #e2e8f0", whiteSpace: "normal", textAlign: "center", verticalAlign: "middle" }}>{cleanText(row[column])}</td>
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
