"use client";

import { useMemo, useRef, useState } from "react";
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
  savedSupervisionReports?: any[];
  currentProjectName?: string;
  projectMeta?: ProjectConcentrationMeta;
  onImportSoilSurvey?: (file: File) => Promise<number> | number;
};

type ConcentrationId =
  | "nonconformances"
  | "suppliers"
  | "contractors"
  | "asphalt"
  | "density"
  | "concrete"
  | "piles"
  | "supervision"
  | "materials"
  | "trial-sections"
  | "subbase-a"
  | "selected-material"
  | "earthworks-material-results"
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

const ASPHALT_MIX_OPTIONS = ["תא״צ 19", "תא״צ 25", "תא״צ 12.5", "תא״צ 9.5", "SMA"] as const;

type BuildContext = {
  savedChecklists: any[];
  savedNonconformances: any[];
  savedTrialSections: any[];
  savedPreliminary: any[];
  savedRfis: any[];
  savedControlProcesses: any[];
  savedSupervisionReports: any[];
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

const checklistApprovalDisplayStatus = (checklist: any): string => {
  const status = normalize(checklist?.approval?.status);
  if (
    [
      "approved",
      "approve",
      "completed",
      "complete",
      "done",
      "closed",
      "signed",
      "מאושר",
      "מאושרת",
      "אושר",
      "אושרה",
      "חתום",
      "נחתם",
      "סגור",
      "הושלם",
    ].includes(status)
  ) return "מאושר";
  if (["rejected", "reject", "declined", "נדחה", "נדחתה", "לא מאושר"].includes(status)) return "לא מאושר";
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

const parseDateOrderTime = (value: unknown): number | null => {
  const raw = cleanText(value);
  if (!raw || looksLikeUuid(raw)) return null;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    const time = new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
      Number(iso[4] ?? 0),
      Number(iso[5] ?? 0),
      Number(iso[6] ?? 0),
    ).getTime();
    return Number.isFinite(time) ? time : null;
  }

  const local = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:,\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (local) {
    const year = Number(local[3].length === 2 ? `20${local[3]}` : local[3]);
    const time = new Date(
      year,
      Number(local[2]) - 1,
      Number(local[1]),
      Number(local[4] ?? 0),
      Number(local[5] ?? 0),
      Number(local[6] ?? 0),
    ).getTime();
    return Number.isFinite(time) ? time : null;
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const recordOrderTime = (record: any, fallbackIndex: number) => {
  const raw = cleanText(record?.savedAt ?? record?.saved_at ?? record?.createdAt ?? record?.created_at ?? record?.date);
  return parseDateOrderTime(raw) ?? fallbackIndex;
};

const sortRecordsOldestFirst = (records: any[]) =>
  records
    .map((record, index) => ({ record, index }))
    .sort((a, b) => recordOrderTime(a.record, a.index) - recordOrderTime(b.record, b.index) || a.index - b.index)
    .map(({ record }) => record);

const firstDateText = (...values: unknown[]) => {
  for (const value of values) {
    const text = dateText(value);
    if (text) return text;
  }
  return "";
};

const preliminaryApprovalDateText = (record: any) => {
  const nested = record?.supplier ?? record?.subcontractor ?? record?.material ?? {};
  const docs = getAttachments(record);
  return firstDateText(
    nested?.approvalDate,
    nested?.certificateApprovalDate,
    nested?.approvedDate,
    nested?.approvedAt,
    record?.approvalDate,
    record?.approvedDate,
    record?.date,
    record?.approval?.date,
    record?.approval?.approvalDate,
    docs.map((doc) => firstDateText(doc?.approvalDate, doc?.certificateApprovalDate, doc?.approvedDate, doc?.approvedAt, doc?.issueDate, doc?.date)).find(Boolean),
    valueByKeyOrLabel(record, ["approvalDate", "certificateApprovalDate", "approvedDate", "approvedAt", "issueDate"]),
    valueByLabel(record, ["תאריך אישור", "תאריך אישור תעודה", "תאריך אישור רישיון", "תאריך אישור רשיון"])
  );
};

const preliminaryOrderTime = (record: any, fallbackIndex: number) => {
  const raw = preliminaryApprovalDateText(record);
  return parseDateOrderTime(raw) ?? recordOrderTime(record, fallbackIndex);
};

const concentrationDateColumnPriority = [
  "תאריך ביצוע",
  "תאריך הבדיקה",
  "תאריך בדיקה",
  "תאריך אישור",
  "תאריך פתיחה",
  "תאריך פתיחת",
  "תאריך קדיחה",
  "תאריך יציקה",
  "תאריך",
];

const isConcentrationSerialColumn = (column: string, index: number) => {
  const normalized = normalize(column);
  if (normalized.includes("סידורי")) return true;
  if (index === 0 && /^(מס|מספר)$/.test(normalized)) return true;
  return false;
};

const normalizeConcentrationRows = (
  definition: { columns: string[]; id?: string },
  rows: Row[],
): Row[] => {
  if (!rows.length) return rows;
  const serialColumn = definition.columns.find(isConcentrationSerialColumn);
  const dateColumns = concentrationDateColumnPriority
    .map((label) =>
      definition.columns.find((column) => {
        const normalizedColumn = normalize(column);
        const normalizedLabel = normalize(label);
        return normalizedColumn === normalizedLabel || normalizedColumn.includes(normalizedLabel);
      }),
    )
    .filter(Boolean) as string[];

  if (!dateColumns.length && !serialColumn) return rows;

  const sorted = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const aTime =
        dateColumns
          .map((column) => parseDateOrderTime(a.row[column]))
          .find((value): value is number => typeof value === "number") ??
        Number.POSITIVE_INFINITY;
      const bTime =
        dateColumns
          .map((column) => parseDateOrderTime(b.row[column]))
          .find((value): value is number => typeof value === "number") ??
        Number.POSITIVE_INFINITY;
      return aTime - bTime || a.index - b.index;
    });

  return sorted.map(({ row }, index) =>
    serialColumn ? { ...row, [serialColumn]: index + 1 } : row,
  );
};

const attachmentName = (attachment: any) => firstText(attachment?.name, attachment?.fileName, attachment?.attachmentName);

const certificateNumberFromAttachment = (attachment: any): string => {
  // רשימת מדידה אינה תעודת מעבדה/בדיקה ולכן לא מחלצים ממנה מספר תעודה משם הקובץ.
  if (attachment?.kind === "measurement") return "";
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


const isRealAttachment = (attachment: any): boolean => {
  if (!attachment || typeof attachment !== "object") return false;
  if (attachment?.attached === false || attachment?.exists === false) return false;
  return Boolean(
    cleanText(attachment?.attachmentName) ||
      cleanText(attachment?.fileName) ||
      cleanText(attachment?.name) ||
      cleanText(attachment?.url) ||
      cleanText(attachment?.dataUrl) ||
      cleanText(attachment?.attachmentDataUrl) ||
      cleanText(attachment?.storagePath) ||
      cleanText(attachment?.path) ||
      cleanText(attachment?.certificateNo) ||
      cleanText(attachment?.certificateNumber) ||
      cleanText(attachment?.documentNo) ||
      cleanText(attachment?.documentNumber),
  );
};

const getAttachments = (record: any): any[] => {
  const result: any[] = [];
  const keys = ["attachments", "certificates", "images", "files", "documents", "requiredDocuments"];

  keys.forEach((key) => {
    if (Array.isArray(record?.[key])) {
      result.push(...record[key].filter(isRealAttachment));
    }
  });

  // חיבור PDF של רשימות תיוג לריכוזים
  if (Array.isArray(record?.items)) {
    record.items.forEach((item: any) => {
      keys.forEach((key) => {
        if (Array.isArray(item?.[key])) {
          result.push(...item[key].filter(isRealAttachment));
        }
      });

      if (Array.isArray(item?.attachments)) {
        item.attachments.forEach((attachment: any) => {
          if (
            attachment?.labResults ||
            attachment?.results ||
            attachment?.densityResults
          ) {
            result.push({
              ...attachment,
              parsedResults:
                attachment?.labResults ||
                attachment?.results ||
                attachment?.densityResults,
            });
          }
        });
      }
    });
  }

  if (record?.supplier) {
    keys.forEach((key) => {
      if (Array.isArray(record.supplier?.[key])) {
        result.push(...record.supplier[key].filter(isRealAttachment));
      }
    });
  }

  if (record?.subcontractor) {
    keys.forEach((key) => {
      if (Array.isArray(record.subcontractor?.[key])) {
        result.push(...record.subcontractor[key].filter(isRealAttachment));
      }
    });
  }

  if (record?.material) {
    keys.forEach((key) => {
      if (Array.isArray(record.material?.[key])) {
        result.push(...record.material[key].filter(isRealAttachment));
      }
    });
  }

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

const preliminaryBySubtype = (records: any[], subtype: string) =>
  records
    .filter((r) => normalize(r?.subtype) === normalize(subtype))
    .map((record, index) => ({ record, index }))
    .sort((a, b) => preliminaryOrderTime(a.record, a.index) - preliminaryOrderTime(b.record, b.index) || a.index - b.index)
    .map(({ record }) => record);

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
  const approvalDate = preliminaryApprovalDateText(record);
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
    "תאריך אישור": approvalDate,
    "הערות": firstText(contractor?.notes, record?.notes),
  };
};

const materialRow = (record: any, index: number): Row => {
  const material = record?.material ?? record;
  const docs = getAttachments(record);
  const approvalDate = preliminaryApprovalDateText(record);
  return {
    "מס׳": index + 1,
    "שם חומר": firstText(material?.materialName, material?.name, record?.title),
    "מקור/יצרן": firstText(material?.source, material?.manufacturer),
    "שימוש מיועד": firstText(material?.usage, record?.description),
    "מספר תעודה / אישור": firstText(docs.map((d) => attachmentCertificateNo(d)).find(Boolean), material?.certificateNo, material?.approvalNo, record?.certificateNo),
    "סטטוס": firstText(record?.status, record?.approval?.status),
    "תאריך אישור": approvalDate,
    "הערות": firstText(material?.notes, record?.notes),
  };
};

const extractNonconformanceNumber = (record: any, index: number): string => {
  const raw = firstText(record?.ncrNumber, record?.number, record?.title, record?.subject);
  const match = raw.match(/\d+/);
  if (match) return match[0];
  const id = cleanText(record?.id);
  return looksLikeUuid(id) ? String(index + 1) : firstText(id, index + 1);
};

const yesNoText = (value: unknown): string => {
  const text = cleanText(value);
  if (!text) return "";
  if (["true", "1", "yes", "כן"].includes(text.toLowerCase())) return "כן";
  if (["false", "0", "no", "לא"].includes(text.toLowerCase())) return "לא";
  return text;
};

const isClosedNonconformance = (record: any): boolean => {
  const status = normalize(record?.status);
  return Boolean(
    status.includes("סגור") ||
    status.includes("נסגר") ||
    status.includes("closed") ||
    cleanText(record?.closingDate) ||
    cleanText(record?.closedAt)
  );
};

const nonconformanceGrade = (record: any): string =>
  firstText(record?.grade, record?.severity, record?.severityLevel, valueByKeyOrLabel(record, ["grade", "severity", "דרגה", "חומרה"]));

const nonconformanceRow = (record: any, index: number): Row => {
  const ncrNumber = extractNonconformanceNumber(record, index);
  const grade = nonconformanceGrade(record);
  const closed = isClosedNonconformance(record);
  const closingBy = firstText(record?.closedBy, record?.closingRole, record?.closedName, record?.closedByName);
  return {
    "מס׳": index + 1,
    "מס'": index + 1,
    "מספר NCR": ncrNumber,
    "מס' אי התאמה": ncrNumber,
    "מסי אי התאמה בSAP": firstText(record?.sapNumber, record?.sapNo, record?.sapNcrNumber, record?.sap),
    "מס סעיף במפרט": firstText(record?.specSection, record?.specNo, record?.spec, record?.specificationSection),
    "תאריך פתיחת": firstDateText(record?.date, record?.openDate, record?.createdAt, record?.savedAt),
    "תאריך פתיחה": firstDateText(record?.date, record?.openDate, record?.createdAt, record?.savedAt),
    "נפתחה": firstText(record?.openedBy, record?.openedRole, record?.raisedBy, record?.reportedBy),
    "פותח/מדווח": firstText(record?.openedBy, record?.openedRole, record?.raisedBy, record?.reportedBy),
    "דרגת אי התאמה": grade,
    "חומרה": grade,
    "גורם אחראי לליקוי (תכנון, ביצוע, ספק)": firstText(record?.responsibleParty, record?.responsibleFactor, record?.responsible, record?.contractor),
    "קטע (כביש, רמפה, גשר...)": firstText(record?.location, record?.section, record?.roadSection),
    "מיקום": firstText(record?.fromSection, record?.stationSection, record?.location),
    "מיקום עד": firstText(record?.toSection, record?.toStationSection),
    "היסט": firstText(record?.offset, record?.side, record?.lane),
    "חלק": firstText(record?.building, record?.part, record?.structure),
    "אלמנט/ שכבה": firstText(record?.element, record?.layer),
    "תת אלמנט": firstText(record?.subElement, record?.subelement),
    "תאור אי התאמה": firstText(record?.description),
    "תיאור אי התאמה": firstText(record?.description),
    "טיפול הנדרש": firstText(record?.actionRequired, record?.requiredAction),
    "פעולה נדרשת": firstText(record?.actionRequired, record?.requiredAction),
    "גורם המטפל": firstText(record?.handler, record?.handledBy, record?.responsible),
    "תאריך  סגירת אי התאמה משוער-מסוכם": firstDateText(record?.expectedCloseDate, record?.plannedCloseDate),
    "תאריך  סגירה משוער על פי החלטת מנה״פ": firstDateText(record?.updatedExpectedCloseDate, record?.managerExpectedCloseDate),
    "שבר": yesNoText(record?.breakage),
    "השפעה על איכות": firstText(record?.qualityImpact),
    "פירוט ביצוע פעולה מתקנת": firstText(record?.correctiveActionDetails, record?.correctiveAction, record?.actionTaken),
    "נסגרה": firstText(closingBy, closed ? "כן" : ""),
    "תאריך  סגירה": firstDateText(record?.closingDate, record?.closedAt, record?.closeDate),
    "אישור מנהל ה״א לסגירת אי התאמה QC": closed ? "מאושר" : firstText(record?.qcManagerApproval, record?.closeApproval, record?.approval?.status),
    "סטטוס": firstText(record?.status, closed ? "סגור" : "פתוח"),
    "נושא": firstText(record?.title, record?.subject),
    "הערות": firstText(record?.notes),
  };
};

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

const checklistRows = (records: any[], keywords: string[], label: string, excludeKeywords: string[] = []): Row[] => {
  const rows: Row[] = [];
  records.forEach((checklist) => {
    const checklistMatches = includesAny(recordText(checklist), keywords);
    const items = Array.isArray(checklist?.items) ? checklist.items : [];
    const checklistApprovalStatus = checklistApprovalDisplayStatus(checklist);

    // ריכוזים המבוססים על רשימות תיוג יכללו רק סעיפים שאליהם צורף קובץ בפועל.
    // לא נכניס סעיפים ריקים רק בגלל שהכותרת או התיאור שלהם מתאימים למילות החיפוש.
    items.forEach((item: any) => {
      const attachments = (Array.isArray(item?.attachments) ? item.attachments : []).filter(isRealAttachment);
      if (!attachments.length) return;

      const itemText = [recordText(checklist), item?.description, item?.notes, JSON.stringify(item?.results ?? item?.labResults ?? {})].join(" ");
      // אם לפריט/לרשימה יש עדות לחומר ממשפחה אחרת (למשל A-2-4 בריכוז מצע א'),
      // לא נאפשר לו להיכנס גם אם מילת מפתח כללית ("אפיון מצע", CBR וכו') תואמת במקרה.
      if (excludeKeywords.length > 0 && includesAny(itemText, excludeKeywords)) return;
      const relevant = checklistMatches || includesAny(itemText, keywords) || attachments.some((a: any) => includesAny([attachmentName(a), JSON.stringify(a?.results ?? a?.labResults ?? {})].join(" "), keywords));
      if (!relevant) return;

      attachments.forEach((attachment: any) => {
        const attachmentText = [attachmentName(attachment), JSON.stringify(attachment?.results ?? attachment?.labResults ?? {})].join(" ");
        if (excludeKeywords.length > 0 && includesAny(attachmentText, excludeKeywords)) return;
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
          "סטטוס": firstText(checklistApprovalStatus, item?.status, checklist?.status),
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

const concreteOutputColumns = [
  'ביצוע ע"י QC/QA',
  "מס׳ סדורי",
  "תאריך יציקה",
  "מבנה",
  "אלמנט",
  "מקום נטילה",
  "מחתך",
  "עד חתך",
  "צד",
  "תעודה מס׳",
  "מקור בטון",
  "סוג בטון",
  'כמות בטון ביציקה (מ"ק)',
  "סומך - דרישה",
  "סומך - תוצאה",
  "סוג אשפרה",
  "חוזק לחיצה - 7 ימים",
  "חוזק לחיצה - 28 ימים",
  "מעמד הבטון",
  "גלילים - תאריך נטילה",
  "גלילים - מס׳ תעודה",
  "גלילים - חוזק הבטון",
  "גלילים - מעמד הבטון",
  "הערות",
];

const pileOutputColumns = [
  'ביצוע בדיקות ע"י QC/QA',
  "מס׳ סדורי",
  "מס׳ רשימת תיוג",
  "מבנה",
  "תת אלמנט / מס׳ כלונס",
  "תאריך קדיחה",
  "קוטר כלונס ס״מ",
  "עומק הכלונס המתוכנן",
  "עומק הכלונס בפועל",
  "נפח יציקה מתוכנן",
  "נפח יציקה בפועל",
  "מספר מנה בבדיקת בנטוניט",
  "צפיפות במיכל",
  "הפרשת מים",
  "PH",
  "צמיגות",
  "צפיפות בתחתית הבור",
  "אחוז חול במיכל",
  "אחוז חול בתחתית הבור",
  "מס׳ תעודת בדיקת בנטוניט",
  "תאריך יציקה",
  "מקור בטון",
  "סוג בטון",
  "סומך - דרישה",
  "סומך - תוצאה",
  "מס׳ תעודת בדיקת סומך",
  "מס׳ תעודת בדיקת חוזק לחיצה",
  "חוזק 7 ימים",
  "חוזק 28 ימים",
  "מעמד הבטון",
  "בדיקה סונית - תאריך",
  "בדיקה סונית - מס׳ תעודה",
  "בדיקה סונית - מעמד",
  "בדיקה אולטרה־סונית - תאריך",
  "בדיקה אולטרה־סונית - מס׳ תעודה",
  "בדיקה אולטרה־סונית - מעמד",
  "תאריך As-Made",
  "הערות",
  "סטטוס",
  "מספר יומן כלונסאות",
];

const buildPileConcentrationRows = (savedChecklists: any[]): Row[] =>
  savedChecklists
    .filter(
      (checklist) =>
        String(checklist?.templateKey ?? "") === "dryMethodPiles" ||
        /כלונס/.test(
          `${cleanText(checklist?.title)} ${cleanText(checklist?.category)}`,
        ),
    )
    .map((checklist, index) => {
      const details =
        checklist?.pileDetails && typeof checklist.pileDetails === "object"
          ? checklist.pileDetails
          : {};
      const approvalStatus = checklistApprovalDisplayStatus(checklist);
      const status = firstText(
        approvalStatus,
        details.pileStatus,
        checklist?.status,
        "בתהליך",
      );
      return {
        'ביצוע בדיקות ע"י QC/QA': /QA|הבטחת איכות/i.test(
          firstText(checklist?.qualityRole, checklist?.approval?.approvedBy),
        )
          ? "QA"
          : "QC",
        "מס׳ סדורי": index + 1,
        "מס׳ רשימת תיוג": firstText(checklist?.checklistNo, checklist?.id),
        "מבנה": firstText(checklist?.roadStructure, checklist?.structure),
        "תת אלמנט / מס׳ כלונס": firstText(
          details.pileNumber,
          checklist?.element,
          checklist?.location,
        ),
        "תאריך קדיחה": dateText(details.drillingDate ?? checklist?.date),
        "קוטר כלונס ס״מ": firstText(details.diameterCm),
        "עומק הכלונס המתוכנן": firstText(details.plannedDepth),
        "עומק הכלונס בפועל": firstText(details.actualDepth),
        "נפח יציקה מתוכנן": firstText(details.plannedVolume),
        "נפח יציקה בפועל": firstText(details.actualVolume),
        "מספר מנה בבדיקת בנטוניט": firstText(details.bentoniteBatchNo),
        "צפיפות במיכל": firstText(details.tankDensity),
        "הפרשת מים": firstText(details.waterSeparation),
        PH: firstText(details.ph),
        "צמיגות": firstText(details.viscosity),
        "צפיפות בתחתית הבור": firstText(details.bottomDensity),
        "אחוז חול במיכל": firstText(details.tankSandPercent),
        "אחוז חול בתחתית הבור": firstText(details.bottomSandPercent),
        "מס׳ תעודת בדיקת בנטוניט": firstText(details.bentoniteCertificateNo),
        "תאריך יציקה": dateText(details.castDate),
        "מקור בטון": firstText(details.concreteSource),
        "סוג בטון": firstText(details.concreteType),
        "סומך - דרישה": firstText(details.slumpRequirement),
        "סומך - תוצאה": firstText(details.slumpResult),
        "מס׳ תעודת בדיקת סומך": firstText(details.slumpCertificateNo),
        "מס׳ תעודת בדיקת חוזק לחיצה": firstText(details.strengthCertificateNo),
        "חוזק 7 ימים": firstText(details.strength7Days),
        "חוזק 28 ימים": firstText(details.strength28Days),
        "מעמד הבטון": firstText(
          details.concreteStatus,
          concreteStrengthStatusForConcentration(
            details.concreteType,
            details.strength28Days,
          ),
        ),
        "בדיקה סונית - תאריך": dateText(details.sonicDate),
        "בדיקה סונית - מס׳ תעודה": firstText(details.sonicCertificateNo),
        "בדיקה סונית - מעמד": firstText(details.sonicStatus),
        "בדיקה אולטרה־סונית - תאריך": dateText(details.ultrasonicDate),
        "בדיקה אולטרה־סונית - מס׳ תעודה": firstText(
          details.ultrasonicCertificateNo,
        ),
        "בדיקה אולטרה־סונית - מעמד": firstText(details.ultrasonicStatus),
        "תאריך As-Made": dateText(details.asMadeDate),
        "הערות": firstText(checklist?.notes),
        "סטטוס": status,
        "מספר יומן כלונסאות": firstText(details.pileLogNo),
      };
    });

const normalizeConcreteTypeForConcentration = (value: unknown) => {
  const match = cleanText(value).match(/(?:ב\s*[-–]?\s*)?(30|40|50|60)/);
  return match ? `ב-${match[1]}` : cleanText(value);
};

const concreteStrengthStatusForConcentration = (
  concreteType: unknown,
  strength28Days: unknown,
) => {
  const type = normalizeConcreteTypeForConcentration(concreteType);
  const minByType: Record<string, number> = {
    "ב-30": 33,
    "ב-40": 43,
    "ב-50": 53,
    "ב-60": 63,
  };
  const value = Number(cleanText(strength28Days).replace(",", "."));
  if (!minByType[type] || !Number.isFinite(value)) return "";
  return value >= minByType[type] ? "תקין" : "לא תקין";
};

const buildConcreteConcentrationRows = (savedChecklists: any[]): Row[] => {
  const rows: Row[] = [];
  savedChecklists.forEach((checklist) => {
    const checklistText = recordText(checklist);
    const isConcreteChecklist =
      String(checklist?.templateKey ?? "") === "siteConcrete" ||
      includesAny(checklistText, ["בטון יצוק", "יציקה", "חוזק בטון", "קוביות בטון"]);
    if (!isConcreteChecklist) return;

    const items = Array.isArray(checklist?.items) ? checklist.items : [];
    items.forEach((item: any) => {
      const attachments = (Array.isArray(item?.attachments) ? item.attachments : [])
        .filter(isRealAttachment);
      const concreteAttachments = attachments.filter(
        (attachment: any) =>
          attachment?.concreteResults ||
          item?.concreteResults ||
          includesAny(
            `${attachmentName(attachment)} ${JSON.stringify(attachment?.labResults ?? {})}`,
            ["בטון", "קוביות", "חוזק", "7 ימים", "28 ימים"],
          ),
      );
      const sources = concreteAttachments.length
        ? concreteAttachments
        : item?.concreteResults
          ? [null]
          : [];

      sources.forEach((attachment: any) => {
        const result = {
          ...(attachment?.concreteResults ?? {}),
          ...(item?.concreteResults ?? {}),
        };
        const concreteType = normalizeConcreteTypeForConcentration(
          result.concreteType,
        );
        const strength28 = firstText(result.strength28Days);
        rows.push({
          'ביצוע ע"י QC/QA': /QA|הבטחת איכות/i.test(firstText(item?.responsible))
            ? "QA"
            : "QC",
          "מס׳ סדורי": rows.length + 1,
          "תאריך יציקה": dateText(
            result.castDate ??
              item?.executionDate ??
              checklist?.date ??
              result.testDate ??
              attachment?.uploadedAt,
          ),
          "מבנה": firstText(
            result.structure,
            checklist?.roadStructure,
            checklist?.structure,
            checklist?.location,
          ),
          "אלמנט": firstText(result.element, item?.description),
          "מקום נטילה": firstText(result.sampleLocation, "אתר"),
          "מחתך": firstText(result.fromSection, checklist?.stationSection, checklist?.fromSection),
          "עד חתך": firstText(result.toSection, checklist?.toStationSection, checklist?.toSection),
          "צד": firstText(result.side, checklist?.side, checklist?.offset),
          "תעודה מס׳": firstText(
            result.certificateNo,
            attachmentCertificateNo(attachment, item?.certificateNo),
          ),
          "מקור בטון": firstText(result.concreteSource, checklist?.concreteSource),
          "סוג בטון": concreteType,
          'כמות בטון ביציקה (מ"ק)': firstText(result.quantity, checklist?.concreteQuantity),
          "סומך - דרישה": firstText(result.slumpRequirement),
          "סומך - תוצאה": firstText(result.slumpResult),
          "סוג אשפרה": firstText(result.curingType),
          "חוזק לחיצה - 7 ימים": firstText(result.strength7Days),
          "חוזק לחיצה - 28 ימים": strength28,
          "מעמד הבטון": concreteStrengthStatusForConcentration(
            concreteType,
            strength28,
          ),
          "גלילים - תאריך נטילה": firstText(result.cylinderSampleDate),
          "גלילים - מס׳ תעודה": firstText(result.cylinderCertificateNo),
          "גלילים - חוזק הבטון": firstText(result.cylinderStrength),
          "גלילים - מעמד הבטון": firstText(result.cylinderStatus),
          "הערות": firstText(item?.notes),
        });
      });
    });
  });
  return rows;
};

const asphaltSieveColumns = ['1.5"', '1"', '3/4"', '14 mm', '1/2"', '3/8"', '8 mm', '4#', '10#', '20#', '40#', '80#', '200#'];
const asphaltOutputColumns = [
  'ביצוע ע"י QC/QA',
  "מס' רשימת תיוג",
  "מספר מדגם",
  "תאריך",
  "סוג תערובת",
  "מחתך",
  "עד חתך",
  "מס' מנה",
  "כמות פיזור יומית",
  ...asphaltSieveColumns,
  "תכולת ביטומן",
  "יחס מלאן -ביטומן",
  "צפיפות ריפ",
  "צפיפות ואקום",
  "יציבות",
  "נזילות",
  "חוזק משתייר",
  "אחוז חלל",
  "V.M.A",
  "צפיפות אפקטיבית",
  "התנקזות",
  "שחיקת קנתברו",
  "מבדקה מבצעת",
  "מעמד החומר",
  "מס' תעודה",
  "הערות",
];

const approvedAsphaltJmfValuesByMix: Record<string, Partial<Row>> = {
  "תא״צ 25": {
    '1.5"': "",
    '1"': "100",
    '3/4"': "90",
    "14 mm": "",
    '1/2"': "73",
    '3/8"': "63",
    "8 mm": "",
    "4#": "49",
    "10#": "32",
    "20#": "20",
    "40#": "14",
    "80#": "9",
    "200#": "5.5",
    "תכולת ביטומן": "4.4",
    "יחס מלאן -ביטומן": "1.25",
    "צפיפות ריפ": "2638",
    "צפיפות ואקום": "2320",
    "יציבות": "2810",
    "נזילות": "12.0",
    "חוזק משתייר": "90%",
    "אחוז חלל": "4.5",
    "V.M.A": "15.8",
    "צפיפות אפקטיבית": "2591",
  },
  "תא״צ 19": {
    '1.5"': "",
    '1"': "",
    '3/4"': "100",
    "14 mm": "",
    '1/2"': "86",
    '3/8"': "73",
    "8 mm": "",
    "4#": "51",
    "10#": "33",
    "20#": "20",
    "40#": "15",
    "80#": "9",
    "200#": "5.5",
    "תכולת ביטומן": "4.9",
    "יחס מלאן -ביטומן": "1.12",
    "צפיפות ריפ": "2658",
    "צפיפות ואקום": "2320",
    "יציבות": "3100",
    "נזילות": "13.0",
    "חוזק משתייר": "91%",
    "אחוז חלל": "4.5",
    "V.M.A": "16.9",
    "צפיפות אפקטיבית": "2611",
  },
};

const normalizeAsphaltMix = (value: unknown): string => {
  const text = normalize(value).replace(/תא\s*צ/g, "תאצ").replace(/תא״צ/g, "תאצ").replace(/תאצ\s+/g, "תאצ ");
  if (text.includes("sma") || text.includes("סמא")) return "SMA";
  if (text.includes("12.5") || text.includes("12,5")) return "תא״צ 12.5";
  if (text.includes("9.5") || text.includes("9,5")) return "תא״צ 9.5";
  if (text.includes("19")) return "תא״צ 19";
  if (text.includes("25")) return "תא״צ 25";
  return "";
};

const asphaltMixLabel = (record: any): string =>
  firstText(
    normalizeAsphaltMix(record?.asphaltMixType),
    normalizeAsphaltMix(metricValue(record, ["סוג תערובת"])),
    normalizeAsphaltMix(record?.workType),
    normalizeAsphaltMix(record?.title),
    normalizeAsphaltMix(recordText(record)),
  );

const asphaltFullMixDescription = (record: any, fallbackMix = ""): string =>
  firstText(
    metricValue(record, ["שם דגימה"]),
    record?.asphaltMixType,
    fallbackMix,
    record?.workType,
    record?.title,
  );

const asphaltMetric = (record: any, aliases: string[]): string => metricValue(record, aliases);

const asphaltMetricOrApproved = (record: any, approvedValues: Partial<Row>, column: string, aliases: string[]): string =>
  firstText(asphaltMetric(record, aliases), approvedValues[column]);

const referenceRowsFromValue = (value: unknown): any[] => {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (item && typeof item === "object" && firstText((item as any)?.metric, (item as any)?.label, (item as any)?.name, (item as any)?.measure)) {
        return [item];
      }
      return referenceRowsFromValue(item);
    });
  }
  return flattenRecord(value)
    .map(({ key, value: resultValue }) => {
      const metric = cleanText(key.split(".").pop() ?? key);
      const result = compactValue(resultValue);
      if (!metric || !result || looksLikeUuid(result)) return null;
      return { metric, resultValue: result };
    })
    .filter(Boolean) as any[];
};

const asphaltChecklistAttachmentRecords = (checklists: any[] = []): any[] => {
  const records: any[] = [];
  checklists.forEach((checklist: any) => {
    const checklistText = recordText(checklist);
    const items = Array.isArray(checklist?.items) ? checklist.items : [];
    items.forEach((item: any) => {
      const attachments = itemAttachments(item);
      attachments.forEach((attachment: any) => {
        const attachmentBatches = Array.isArray(attachment?.asphaltBatches)
          ? attachment.asphaltBatches
          : [];
        if (attachmentBatches.length) {
          attachmentBatches.forEach((batch: any, batchIndex: number) => {
            const batchResults = batch?.referenceResults ?? batch?.rows ?? batch?.results ?? [];
            const referenceResults = referenceRowsFromValue(batchResults);
            if (!referenceResults.length) return;
            records.push({
              title: firstText(item?.description, checklist?.title, attachmentName(attachment)),
              category: checklist?.category,
              location: firstText(item?.location, checklist?.location),
              contractor: firstText(item?.contractor, checklist?.contractor),
              status: firstText(checklistApprovalDisplayStatus(checklist), item?.status, checklist?.status, "מאושר"),
              checklistNo: firstText(checklist?.checklistNo, checklist?.checklistNumber, checklist?.number, checklist?.id),
              date: firstDateText(batch?.testDate, item?.executionDate, checklist?.date, attachment?.uploadedAt, checklist?.savedAt),
              batchNo: firstText(batch?.batchNo, batch?.batchNumber, batchIndex + 1),
              sampleNo: firstText(batch?.sampleNo),
              asphaltMixType: firstText(
                batch?.asphaltMixType,
                attachment?.asphaltMixType,
                aliasesValue(batchResults, ["סוג תערובת", "תערובת", "asphaltMixType"]),
                item?.asphaltMixType,
                checklist?.asphaltMixType,
                item?.description,
                checklist?.title,
              ),
              requiredDocuments: [attachment],
              referenceResults,
              notes: firstText(item?.notes, attachment?.description),
            });
          });
          return;
        }
        const parsedResults =
          attachment?.referenceResults ??
          attachment?.parsedResults ??
          attachment?.labResults ??
          attachment?.results ??
          attachment?.details;
        const referenceResults = referenceRowsFromValue(parsedResults);
        const text = [
          checklistText,
          item?.description,
          item?.title,
          item?.notes,
          attachmentName(attachment),
          safeStringify(parsedResults),
        ].join(" ");
        if (!referenceResults.length || !includesAny(text, ["אספלט", "מרשל", "JMF", "תאצ", "תא״צ", "ביטומן"])) return;

        records.push({
          title: firstText(item?.description, checklist?.title, attachmentName(attachment)),
          category: checklist?.category,
          location: firstText(item?.location, checklist?.location),
          contractor: firstText(item?.contractor, checklist?.contractor),
          status: firstText(checklistApprovalDisplayStatus(checklist), item?.status, checklist?.status, "מאושר"),
          checklistNo: firstText(checklist?.checklistNo, checklist?.checklistNumber, checklist?.number, checklist?.id),
          date: firstDateText(item?.executionDate, checklist?.date, attachment?.uploadedAt, checklist?.savedAt),
          asphaltMixType: firstText(
            aliasesValue(parsedResults, ["סוג תערובת", "תערובת", "asphaltMixType"]),
            attachment?.asphaltMixType,
            item?.asphaltMixType,
            checklist?.asphaltMixType,
            item?.description,
            checklist?.title,
          ),
          requiredDocuments: [attachment],
          referenceResults,
          notes: firstText(item?.notes, attachment?.description),
        });
      });
    });
  });
  return records;
};

const isAsphaltReferenceProcess = (record: any): boolean => {
  const text = recordText(record);
  return includesAny(text, ["אספלט", "מרשל", "JMF", "תאצ", "תא״צ", "PG68", "PG70"]) && Array.isArray(record?.referenceResults);
};

const asphaltJmfRow = (record: any, index: number): Row => {
  const mix = asphaltMixLabel(record);
  const approvedValues = approvedAsphaltJmfValuesByMix[mix] ?? {};
  return {
    'ביצוע ע"י QC/QA': "QC",
    "מס' רשימת תיוג": firstText(record?.checklistNo, record?.checklistNumber, record?.linkedChecklistNo),
    "מספר מדגם": firstText(asphaltMetric(record, ["מספר מדגם", "מספר דגימה", "מס מדגם", "קוד תערובת"]), record?.sampleNo, index + 1),
    "תאריך": firstText(asphaltMetric(record, ["תאריך בדיקה", "תאריך"]), record?.date, dateText(record?.savedAt ?? record?.updatedAt ?? record?.createdAt)),
    "סוג תערובת": asphaltFullMixDescription(record, mix),
    "מחתך": firstText(asphaltMetric(record, ["מחתך", "מחתך התחלה"]), record?.fromSection),
    "עד חתך": firstText(asphaltMetric(record, ["עד חתך", "מחתך סוף"]), record?.toSection),
    "מס' מנה": firstText(asphaltMetric(record, ["מס מנה", "מס' מנה", "מנה"]), record?.batchNo, "←     JMF"),
    "כמות פיזור יומית": firstText(asphaltMetric(record, ["כמות פיזור יומית", "כמות פיזור"]), "←     JMF"),
    '1.5"': asphaltMetricOrApproved(record, approvedValues, '1.5"', ['1.5"', "1.5"]),
    '1"': asphaltMetricOrApproved(record, approvedValues, '1"', ['1"', "1 אינץ"]),
    '3/4"': asphaltMetricOrApproved(record, approvedValues, '3/4"', ['3/4"', "3/4"]),
    "14 mm": asphaltMetricOrApproved(record, approvedValues, "14 mm", ["14 mm", "mm 14"]),
    '1/2"': asphaltMetricOrApproved(record, approvedValues, '1/2"', ['1/2"', "1/2"]),
    '3/8"': asphaltMetricOrApproved(record, approvedValues, '3/8"', ['3/8"', "3/8"]),
    "8 mm": asphaltMetricOrApproved(record, approvedValues, "8 mm", ["8 mm", "mm 8"]),
    "4#": asphaltMetricOrApproved(record, approvedValues, "4#", ["#4", "4#"]),
    "10#": asphaltMetricOrApproved(record, approvedValues, "10#", ["#10", "10#"]),
    "20#": asphaltMetricOrApproved(record, approvedValues, "20#", ["#20", "20#"]),
    "40#": asphaltMetricOrApproved(record, approvedValues, "40#", ["#40", "40#"]),
    "80#": asphaltMetricOrApproved(record, approvedValues, "80#", ["#80", "80#"]),
    "200#": asphaltMetricOrApproved(record, approvedValues, "200#", ["#200", "200#"]),
    "תכולת ביטומן": asphaltMetricOrApproved(record, approvedValues, "תכולת ביטומן", ["תכולת ביטומן"]),
    "יחס מלאן -ביטומן": asphaltMetricOrApproved(record, approvedValues, "יחס מלאן -ביטומן", ["יחס מלאן - ביטומן", "F/B"]),
    "צפיפות ריפ": asphaltMetricOrApproved(record, approvedValues, "צפיפות ריפ", ["צפיפות בשיטת ריפ", "ריפ"]),
    "צפיפות ואקום": asphaltMetricOrApproved(record, approvedValues, "צפיפות ואקום", ["צפיפות בשיטת וואקום", "צפיפות וואקום", "צפיפות"]),
    "יציבות": asphaltMetricOrApproved(record, approvedValues, "יציבות", ["יציבות"]),
    "נזילות": asphaltMetricOrApproved(record, approvedValues, "נזילות", ["נזילות"]),
    "חוזק משתייר": asphaltMetricOrApproved(record, approvedValues, "חוזק משתייר", ["חוזק משתייר"]),
    "אחוז חלל": asphaltMetricOrApproved(record, approvedValues, "אחוז חלל", ["אחוז חלל"]),
    "V.M.A": asphaltMetricOrApproved(record, approvedValues, "V.M.A", ["V.M.A", "VMA"]),
    "צפיפות אפקטיבית": asphaltMetricOrApproved(record, approvedValues, "צפיפות אפקטיבית", ["צפיפות אפקטיבית"]),
    "התנקזות": asphaltMetricOrApproved(record, approvedValues, "התנקזות", ["התנקזות", "התנגדות"]),
    "שחיקת קנתברו": asphaltMetricOrApproved(record, approvedValues, "שחיקת קנתברו", ["שחיקה קנטברו", "שחיקת קנתברו"]),
    "מבדקה מבצעת": firstText(asphaltMetric(record, ["מבדקה מבצעת", "מעבדה"]), record?.labName),
    "מעמד החומר": firstText(record?.status, record?.approval?.status, "OK"),
    "מס' תעודה": referenceDocNo(record),
    "הערות": firstText(record?.notes, record?.description),
  };
};

const buildAsphaltConcentrationRows = (ctx: BuildContext, selectedMix = ""): Row[] => {
  const selected = normalizeAsphaltMix(selectedMix);
  return [
    ...ctx.savedControlProcesses,
    ...asphaltChecklistAttachmentRecords(ctx.savedChecklists),
  ]
    .filter(isAsphaltReferenceProcess)
    .filter((record) => !selected || asphaltMixLabel(record) === selected)
    .map(asphaltJmfRow);
};


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
  "IP",
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

const preliminaryReferenceRecords = (preliminary: any[] = []): any[] =>
  preliminary
    .filter((record) => record?.subtype === "materials" && record?.material)
    .flatMap((record) => {
      const material = record.material ?? {};
      const certificates = Array.isArray(material.certificates)
        ? material.certificates
        : material.certificates
          ? [material.certificates]
          : [];
      const sources = certificates.length ? certificates : [{ certificateNo: material.certificateNo }];
      return sources.map((certificate: any) => {
        const attachments = Array.isArray(certificate?.attachments)
          ? certificate.attachments
          : certificate?.attachments
            ? [certificate.attachments]
            : [];
        const referenceResults = attachments.flatMap((attachment: any) =>
          referenceRowsFromValue(
            attachment?.referenceResults ?? attachment?.results ?? attachment?.labResults ?? attachment?.densityResults,
          ),
        );
        return {
          ...record,
          title: firstText(material.materialName, record.title),
          workType: firstText(material.usage, material.materialName),
          location: firstText(material.usage),
          fromSection: firstText(material.source),
          status: firstText(record.status, record.approval?.status),
          notes: firstText(material.notes, certificate?.details, record.notes),
          processNo: firstText(certificate?.certificateNo, material.certificateNo),
          referenceNo: firstText(certificate?.certificateNo, material.certificateNo),
          requiredDocuments: [certificate, ...attachments],
          referenceResults,
        };
      });
    });

const isMatzeaAProcess = (record: any): boolean => {
  const text = recordText(record);
  const mentionsMatzeaA = includesAny(text, ["מצע א", "מצע א׳", "מצע א'", "מצע סוג א", "מצע סוג א׳", "מצע סוג א'", "24403"]);
  const hasCharacterizationEvidence = includesAny(text, [
    "אפיון מצע",
    "תעודת ייחוס",
    "גרדציה",
    "CBR",
    "cbr",
    "AASHTO",
    "100%",
    "פרוקטור",
    "צפיפות מעבדתית",
    "רטיבות אופטימלית",
    "LL",
    "PL",
    "PI",
  ]);
  return mentionsMatzeaA && hasCharacterizationEvidence;
};

const matzeaAProcessRow = (record: any, index: number): Row => ({
  "מס׳ סדורי": index + 1,
  "ביצוע ע״י": firstText(metricValue(record, ["ביצוע עי", 'ביצוע ע"י']), "QC"),
  "מס׳ תעודה": referenceDocNo(record),
  "תאריך": firstText(metricValue(record, ["תאריך בדיקה", "תאריך הבדיקה", "תאריך", "תאריך הפצה"]), dateText(record?.date), dateText(record?.savedAt ?? record?.updatedAt ?? record?.createdAt)),
  "מקור החומר": firstText(metricValue(record, ["מקור החומר", "מקור", "ספק / מפעל", "ספק", "מחצבה"]), record?.fromSection),
  "מקום נטילת מדגם לבדיקה": firstText(metricValue(record, ["מקום הדגם לבדיקה", "מקום נטילת מדגם לבדיקה", "מקום הדיגום", "מקום הבדיקה", "מיקום הבדיקה"]), record?.location),
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
  "IP": metricValue(record, ["IP", "I.P", "PI", "אינדקס פלסטיות"]),
  "שע״ח (%)": metricValue(record, ["שווה ערך חול", "שעח"]),
  "צפיפות ממשית (ט/מ״ק)": metricValue(record, ["צפיפות מכשירית", "צפיפות ממשית"]),
  "ספיגות (%)": metricValue(record, ["ספיגות", "ספיגות (G)"]),
  "לוס אנג׳לס (%)": metricValue(record, ["לוס אנגלס", "לוס אנג'לס", "לוס אנג׳לס"]),
  "מיון AASHTO": firstText(metricValue(record, ["דירוג AASHTO מיין", "מיין AASHTO", "מיון AASHTO", "AASHTO"])),
  "צפיפות מעבדתית מקסימלית": metricValue(record, ["צפיפות מעבדתית מקסימלית", "צפיפות מקסימלית", "100% מעבדתי", "צפיפות מקסימלית מחושבת", "100% מחושב"]),
  "רטיבות אופטימלית": metricValue(record, ["רטיבות אופטימלית", "רטיבות כוללת", "רטיבות מחושבת"]),
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
  "IP": "",
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

const buildMatzeaAConcentrationRows = (checklists: any[], _processes: any[], preliminary: any[] = []): Row[] => {
  // הערה: אין שילוב עוד של רשומות מתוך processes (בדיקות שדה/צפיפות) בריכוז האפיון.
  // רשומות אלה הן בדיקות שדה (לא בדיקות מעבדה/אפיון), ומכילות בתוכן טקסט חופשי
  // שמזכיר את מספר תעודת הייחוס (24403) ואת סיווג ה-AASHTO של מצע א' רק כמטא-דאטה,
  // מה שגרם להן להיכנס בטעות לריכוז כשורות "סלט" עם JSON גולמי בעמודת ההערות.
  // מקור הנתונים האמין היחיד לריכוז אפיון מצע א' הוא רשימות התיוג (checklists) עם
  // קובץ תעודת מעבדה מצורף בפועל.
  const checklist = checklistRows(
    checklists,
    ["מצע א", "מצע א׳", "אפיון מצע", "24403"],
    "אפיון מצע א׳",
    ["A-2-4", "a-2-4", "נברר", "חומר נברר", "מילוי נברר", "אפיון נברר"],
  ).map((row, index) => matzeaAChecklistRow(row, index));
  const references = preliminaryReferenceRecords(preliminary)
    .filter(isMatzeaAProcess)
    .map((record, index) => matzeaAProcessRow(record, checklist.length + index));
  return [...checklist, ...references].map((row, index) => ({ ...row, "מס׳ סדורי": index + 1 }));
};

const selectedMaterialColumns = matzeaAColumns;

const isSelectedMaterialProcess = (record: any): boolean => {
  const text = recordText(record);
  return includesAny(text, ["נברר", "חומר נברר", "מילוי נברר", "אפיון נברר", "A-1-b", "A-2-4", "a-1-b", "a-2-4"]);
};

const selectedMaterialProcessRow = (record: any, index: number): Row => ({
  "מס׳ סדורי": index + 1,
  "ביצוע ע״י": firstText(metricValue(record, ["ביצוע עי", 'ביצוע ע"י']), "QC"),
  "מס׳ תעודה": referenceDocNo(record),
  "תאריך": firstText(metricValue(record, ["תאריך בדיקה", "תאריך הבדיקה", "תאריך", "תאריך הפצה"]), dateText(record?.date), dateText(record?.savedAt ?? record?.updatedAt ?? record?.createdAt)),
  "מקור החומר": firstText(metricValue(record, ["מקור החומר", "מקור", "ספק / מפעל", "ספק", "מחצבה"]), record?.fromSection),
  "מקום נטילת מדגם לבדיקה": firstText(metricValue(record, ["מקום הדגם לבדיקה", "מקום נטילת מדגם לבדיקה", "מקום הדיגום", "מקום הבדיקה", "מיקום הבדיקה"]), record?.location),
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
  "IP": metricValue(record, ["IP", "I.P", "PI", "אינדקס פלסטיות"]),
  "שע״ח (%)": metricValue(record, ["שווה ערך חול", "שעח"]),
  "צפיפות ממשית (ט/מ״ק)": metricValue(record, ["צפיפות מכשירית", "צפיפות ממשית"]),
  "ספיגות (%)": metricValue(record, ["ספיגות", "ספיגות (G)"]),
  "לוס אנג׳לס (%)": metricValue(record, ["לוס אנגלס", "לוס אנג'לס", "לוס אנג׳לס"]),
  "מיון AASHTO": firstText(metricValue(record, ["דירוג AASHTO מיין", "מיין AASHTO", "מיון AASHTO", "AASHTO"])),
  "צפיפות מעבדתית מקסימלית": metricValue(record, ["צפיפות מעבדתית מקסימלית", "צפיפות מקסימלית", "100% מעבדתי", "צפיפות מקסימלית מחושבת", "100% מחושב"]),
  "רטיבות אופטימלית": metricValue(record, ["רטיבות אופטימלית", "רטיבות כוללת", "רטיבות מחושבת"]),
  "מספר תעודה": referenceDocNo(record),
  "מעמד החומר": firstText(metricValue(record, ["מעמד החומר"]), record?.status, record?.approval?.status),
  "הערות": firstText(metricValue(record, ["מיון אחיד"]), metricValue(record, ["תפיחה חופשית"]), record?.notes, record?.description),
});

const buildSelectedMaterialConcentrationRows = (checklists: any[], _processes: any[], preliminary: any[] = []): Row[] => {
  // כמו בריכוז מצע א' - רשומות processes/preliminary הן בדיקות שדה, לא בדיקות אפיון,
  // וגרמו לאותה תופעת "סלט" (JSON גולמי בעמודת הערות). מקור הנתונים האמין הוא רק
  // רשימות תיוג עם תעודת מעבדה מצורפת בפועל.
  const checklist = checklistRows(
    checklists,
    ["נברר", "חומר נברר", "מילוי נברר", "אפיון נברר", "A-1-b", "A-2-4", "a-1-b", "a-2-4", "cbr", "גרדציה"],
    "אפיון נברר",
  ).map((row, index) => matzeaAChecklistRow(row, index));
  const references = preliminaryReferenceRecords(preliminary)
    .filter(isSelectedMaterialProcess)
    .map((record, index) => selectedMaterialProcessRow(record, checklist.length + index));
  return [...checklist, ...references].map((row, index) => ({ ...row, "מס׳ סדורי": index + 1 }));
};


const earthworksFieldColumns = [
  'ביצוע ע"י ',
  "מס' סדורי",
  'רשימת תיוג',
  'תאריך הבדיקה',
  'כביש\\ציר \\רמפה',
  'מחתך',
  'עד חתך',
  'צד',
  'מקום נטילה',
  'שטח ',
  "שכבה מס'",
  'עובי השכבה',
  'סוג העבודה ',
  'תאור החומר ',
  'מיון החומר ',
  'מקור החומר',
  "מס' תעודת בדיקההידוק רגיל",
  'מעברי מכבש',
  'מעמד הידוק רגיל',
  "מס' תעודת בדיקה צפיפות/ רטיבות שדה",
  'הידוק מבוקר (צפיפות מד גרעיני)',
  'מעמד צפיפות/רטיבות',
  ' מנת בדיקה (חרוט חול / שלבי)',
  'מעמד מנת בדיקה',
  'מדידה',
  'מעמד מדידה',
  'מספר תעודת בדיקה אפיון - 100%',
  'HWD',
  'מעמד HWD',
  'תוצאות בדיקה',
  'צפיפות סטטיסטיקה גבול תחתון',
  'צפיפות סטטיסטיקה גבול עליון',
  'צפיפות סטטיסטיקה ממוצע',
  'מעמד תוצאות',
  'בדיקה חוזרת לתעודה ',
  'מתאריך',
  'מספר אי התאמה',
  'הערות',
];

const earthworksIncludeKeywords = [
  "רשימת תיוג לעבודות עפר",
  "רשימת תיוג עבודות עפר",
  "רשימות תיוג לעבודות עפר",
  "עבודות עפר",
  "חפירה",
  "מילוי רגיל",
  "מילוי מבוקר",
  "הידוק מבוקר",
  "הידוק רגיל",
  "קרקע יסוד",
  "שתית",
  "החלפת קרקע",
];

const earthworksWorkTypeKeywords = [
  "חפירה",
  "מילוי",
  "מילוי רגיל",
  "מילוי מבוקר",
  "הידוק רגיל",
  "הידוק מבוקר",
  "קרקע יסוד",
  "שתית",
  "החלפת קרקע",
];

const earthworksExcludeKeywords = [
  "מצע א",
  "מצע א׳",
  "מצע א'",
  "מצעים",
  "בדיקת שדה למצעים",
  "אפיון מצע",
  "מצע סוג א",
  "מצע סוג א׳",
  "מצע סוג א'",
  "אגו״ם",
  "אגום",
];

const subbaseFieldKeywords = [
  "רשימת תיוג פיזור מצעים",
  "פיזור מצעים",
  "בדיקת שדה למצעים",
  "מצע א",
  "מצע א׳",
  "מצע א'",
  "מצעים",
  "מצע סוג א",
  "מצע סוג א׳",
  "מצע סוג א'",
  "אגו״ם",
  "אגום",
];

const subbaseFieldStrongKeywords = [
  "רשימת תיוג פיזור מצעים",
  "פיזור מצעים",
  "בדיקת שדה למצעים",
  "צפיפות",
  "רטיבות",
  "מד גרעיני",
  "הידוק",
  "מנת בדיקה",
  "מעביר מכבש",
];

const subbaseCharacterizationKeywords = [
  "אפיון מצע",
  "תעודת ייחוס",
  "גרדציה",
  "CBR",
  "cbr",
  "פרוקטור",
  "צפיפות מעבדתית",
  "רטיבות אופטימלית",
  "AASHTO",
  "24403",
];

const earthworksLabCertificateKeywords = [
  "תעודת מעבדה",
  "מעבדה",
  "דוח בדיקה",
  "דו״ח בדיקה",
  "דו״ח בדיקה",
  "תעודת בדיקה",
  "בדיקת צפיפות",
  "צפיפות",
  "רטיבות",
  "מד גרעיני",
  "חרוט חול",
  "פרוקטור",
  "הידוק",
  "בדיקת שדה",
  "lab",
  "laboratory",
  "density",
  "moisture",
  "test report",
];

const earthworksNonLabAttachmentKeywords = [
  "תמונה",
  "צילום",
  "חתימה",
  "sign",
  "signature",
  "image/",
  "jpeg",
  "jpg",
  "png",
  "iso",
  "9001",
  "תו תקן",
  "רישיון",
  "רשיון",
  "אישור ספק",
  "ספק",
  "rfi",
];


const normalizeFieldKey = (value: unknown): string =>
  normalize(value).replace(/[\s_\-./\\]+/g, "");

const unsafeFuzzyAliases = new Set(["id", "type", "to", "from", "date", "status", "side"]);

const fieldKeyMatchesAlias = (key: string, alias: string): boolean => {
  const nk = normalizeFieldKey(key.split(".").pop() ?? key);
  const na = normalizeFieldKey(alias);
  if (!nk || !na) return false;
  if (nk === na) return true;
  // מונעים התאמות שגויות כמו id בתוך side, type שמחזיר application/pdf,
  // או to מתוך contractor. התאמה חלקית נשמרת רק לשמות שדה משמעותיים.
  if (nk.length <= 3 || na.length <= 3) return false;
  if (unsafeFuzzyAliases.has(nk) || unsafeFuzzyAliases.has(na)) return false;
  return nk.includes(na) || na.includes(nk);
};

const strictValueByKeyOrLabel = (record: any, aliases: string[]): string => {
  const flat = flattenRecord(record);
  const normalizedAliases = aliases.map(normalizeFieldKey).filter(Boolean);

  for (const { key, value } of flat) {
    const terminal = normalizeFieldKey(key.split(".").pop() ?? key);
    if (normalizedAliases.some((alias) => terminal === alias)) {
      const text = compactValue(value);
      if (text && text !== "application/pdf" && !looksLikeUuid(text)) return text;
    }
  }

  for (const { key, value } of flat) {
    if (aliases.some((alias) => fieldKeyMatchesAlias(key, alias))) {
      const text = compactValue(value);
      if (text && text !== "application/pdf" && !looksLikeUuid(text)) return text;
    }
  }

  return "";
};

const aliasesValue = (record: any, aliases: string[]): string =>
  firstText(valueByKeyOrLabel(record, aliases), valueByLabel(record, aliases));

const firstFromRecords = (records: any[], aliases: string[]): string => {
  for (const record of records) {
    const value = aliasesValue(record, aliases);
    if (value) return value;
  }
  return "";
};

const firstDateFromRecords = (records: any[], aliases: string[], ...fallbacks: unknown[]): string =>
  firstDateText(...records.map((record) => aliasesValue(record, aliases)), ...fallbacks);

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? "");
  } catch {
    return "";
  }
};

const numericLike = (value: unknown): string => {
  const text = cleanText(value);
  if (!text) return "";
  const match = text.match(/-?\d+(?:[.,]\d+)?/);
  return match?.[0] ?? text;
};

const normalizeDensityNumber = (value: unknown): string => {
  const text = cleanText(value).replace(/,/g, ".");
  if (!text) return "";
  const dotPrefix = text.match(/(^|[^0-9])(\.\d{1,3})(?=\D|$)/);
  if (dotPrefix?.[2]) return String(Number(dotPrefix[2]) * 100).replace(/\.0$/, "");
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match?.[0] ?? "";
};

const firstRegexGroup = (text: string, patterns: RegExp[]): string => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1] ?? match?.[2] ?? "";
    if (value) return normalizeDensityNumber(value);
  }
  return "";
};

const parseEarthworksDensityText = (value: unknown): Record<string, string> => {
  const text = cleanText(value)
    .replace(/\u200f|\u200e/g, " ")
    .replace(/\s+/g, " ");
  if (!text) return {};
  const parsed: Record<string, string> = {};
  parsed.certificateNo = firstRegexGroup(text, [
    /(?:דו[״\"']?ח|דוח|מספר תעודה|תעודת בדיקה|דוח מספר|בדיקה מספר)\s*(?:בדיקה)?\s*(?:מספר|מס׳|:)?\s*([0-9]{3,}(?:[_\/-][0-9]+)?)/i,
    /(?:pdf\.|pdf|תעודה\s*)\s*([0-9]{3,}(?:[_\/-][0-9]+)?)/i,
    /(?:^|[^0-9])([0-9]{4,}(?:[_\/-][0-9]+)?)(?:[^0-9]|$)/i,
  ]);
  parsed.testDate = firstText(
    firstRegexGroup(text, [/(?:תאריך הבדיקה|תאריך הדגימה|תאריך ביצוע|תאריך)\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i]),
    firstRegexGroup(text, [/(\d{1,2}[./-]\d{1,2}[./-]\d{4})/])
  );
  parsed.status = includesAny(text, ["הבדיקה עוברת", "מסקנה מתאים", "מתאים", "OK", "תקין"]) ? "OK" : includesAny(text, ["לא מתאים", "לא תקין", "נכשל", "NC"]) ? "NC" : "";
  parsed.density = firstRegexGroup(text, [
    /(?:צפיפות\s*מחושבת|צפיפות\s*יבשה|צפיפות)\s*:?\s*(\d+(?:[.,]\d+)?)/i,
    /(?:קג\/מ["״]?ק|kg\/m3)\s*:?\s*(\d+(?:[.,]\d+)?)/i,
  ]);
  return parsed;
};

const parsedDensityFromSources = (sources: any[]): Record<string, string> => {
  const text = sources
    .map((source) => [
      source?.extractedText,
      source?.pdfText,
      source?.text,
      source?.summary,
      source?.notes,
      source?.remarks,
      source?.attachmentName,
      source?.name,
      source?.fileName,
      source?.certificateText,
      source?.densitySummary,
      source?.densityExtractionSummary,
      source?.description,
      safeStringify(source?.densityResults ?? source?.labResults ?? source?.results ?? source),
    ].map(cleanText).filter(Boolean).join(" "))
    .filter(Boolean)
    .join(" ");
  return parseEarthworksDensityText(text);
};

const attachmentOrMetricCertificate = (records: any[], attachment: any, aliases: string[] = []): string =>
  firstText(
    attachmentCertificateNo(attachment),
    firstFromRecords(records, [
      ...aliases,
      "certificateNo",
      "certificateNumber",
      "documentNo",
      "documentNumber",
      "מספר תעודה",
      "מספר תעודת בדיקה",
      "מס תעודת בדיקה",
      "מספר תעודת מעבדה",
    ]),
  );

const isEarthworksRecord = (record: any): boolean => {
  const text = recordText(record);
  if (includesAny(text, earthworksExcludeKeywords)) return false;
  return includesAny(text, earthworksIncludeKeywords) || includesAny(text, earthworksWorkTypeKeywords);
};

const earthworksChecklistKindText = (record: any): string =>
  [
    record?.templateKey,
    record?.template,
    record?.checklistTemplate,
    record?.checklistTemplateKey,
    record?.checklistType,
    record?.type,
    record?.category,
    record?.subtype,
    record?.workType,
    record?.title,
    record?.name,
    valueByKeyOrLabel(record, [
      "סוג רשימת תיוג",
      "רשימת תיוג לעבודות",
      "סוג העבודה",
      "workType",
      "checklistType",
      "templateKey",
    ]),
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(" ");

const isEarthworksChecklist = (record: any): boolean => {
  const kindText = earthworksChecklistKindText(record);
  const recordAllText = `${kindText} ${recordText(record)}`;
  if (includesAny(recordAllText, earthworksExcludeKeywords)) return false;
  return includesAny(recordAllText, earthworksIncludeKeywords) || includesAny(recordAllText, earthworksWorkTypeKeywords);
};

const isSubbaseFieldChecklist = (record: any): boolean => {
  const kindText = earthworksChecklistKindText(record);
  const text = `${kindText} ${recordText(record)}`;
  // רשימת תיוג שמזוהה (לפי הקטגוריה/כותרת/תבנית שלה עצמה) כרשימת עבודות עפר טהורה
  // (קרקע יסוד/שתית/חפירה/מילוי) ולא מזכירה שם גם "מצע/מצעים" - לא תיכנס לריכוז
  // המצעים, גם אם יש בה מונחי בדיקת שדה גנריים (צפיפות/רטיבות/מד גרעיני/הידוק)
  // שמשותפים לשני סוגי הבדיקות. זה מונע ערבוב של קרקע יסוד/שתית בריכוז המצעים.
  if (includesAny(kindText, earthworksIncludeKeywords) && !includesAny(kindText, subbaseFieldKeywords)) {
    return false;
  }
  if (includesAny(text, subbaseCharacterizationKeywords) && !includesAny(text, subbaseFieldStrongKeywords)) return false;
  return includesAny(text, subbaseFieldStrongKeywords) ||
    (includesAny(text, subbaseFieldKeywords) && !includesAny(text, subbaseCharacterizationKeywords));
};

const subbaseFieldItemText = (checklist: any, item: any, attachment?: any): string =>
  [
    earthworksChecklistKindText(checklist),
    checklist?.title,
    checklist?.name,
    checklist?.category,
    checklist?.workType,
    item?.description,
    item?.title,
    item?.label,
    attachmentName(attachment),
    attachment?.description,
    attachment?.title,
    safeStringify(item?.results ?? item?.labResults ?? item?.densityResults ?? {}),
    safeStringify(attachment?.results ?? attachment?.labResults ?? attachment?.densityResults ?? {}),
  ].map(cleanText).filter(Boolean).join(" ");

const isSubbaseFieldItem = (checklist: any, item: any, attachment?: any): boolean =>
  isSubbaseFieldChecklist(checklist) || includesAny(subbaseFieldItemText(checklist, item, attachment), subbaseFieldKeywords);

const earthworksStatus = (...values: unknown[]): string => {
  const text = firstText(...values);
  if (!text) return "";
  if (includesAny(text, ["לא תקין", "נכשל", "NC", "נדחה", "פסול"])) return "NC";
  if (includesAny(text, ["תקין", "מאושר", "OK", "עבר"])) return "OK";
  return text;
};

const earthworksChecklistNumber = (checklist: any, index: number): string => {
  const value = firstText(
    checklist?.displayNumber,
    checklist?.checklistDisplayNumber,
    checklist?.checklistNo,
    checklist?.checklistNumber,
    checklist?.number,
    checklist?.serialNo,
    checklist?.formNo,
    checklist?.reportNo,
    valueByKeyOrLabel(checklist, ["מספר רשימה", "מס רשימה", "מספר רשימת תיוג", "מספר טופס", "checklistNo", "checklistNumber"]),
  );
  if (!value || looksLikeUuid(value)) return String(index + 1);
  return value;
};

const itemAttachments = (item: any): any[] => [
  ...(Array.isArray(item?.attachments) ? item.attachments : []),
  ...(Array.isArray(item?.certificates) ? item.certificates : []),
  ...(Array.isArray(item?.documents) ? item.documents : []),
  ...(Array.isArray(item?.files) ? item.files : []),
].filter(isRealAttachment);

const hasStoredEarthworksLabData = (item: any): boolean => {
  const storedResults = [
    item?.labResults,
    item?.densityResults,
    item?.results,
  ].find((value) => value && typeof value === "object" && Object.keys(value).length);
  return Boolean(
    storedResults ||
    cleanText(item?.certificateNo) ||
    cleanText(item?.certificateNumber) ||
    cleanText(item?.documentNo),
  );
};

const directRecordAttachments = (record: any): any[] => [
  ...(Array.isArray(record?.attachments) ? record.attachments : []),
  ...(Array.isArray(record?.certificates) ? record.certificates : []),
  ...(Array.isArray(record?.documents) ? record.documents : []),
  ...(Array.isArray(record?.files) ? record.files : []),
].filter(isRealAttachment);

const attachmentIdentity = (attachment: any): string =>
  firstText(
    attachment?.id,
    attachment?.attachmentId,
    attachment?.path,
    attachment?.url,
    attachment?.dataUrl,
    `${attachmentName(attachment)}|${attachment?.uploadedAt ?? ""}|${attachment?.size ?? ""}`,
  );

const attachmentTextForLabCheck = (attachment: any, item: any): string => [
  attachmentName(attachment),
  attachment?.documentType,
  attachment?.docType,
  attachment?.certificateType,
  attachment?.type,
  attachment?.kind,
  attachment?.category,
  attachment?.title,
  attachment?.label,
  attachment?.description,
  attachment?.details,
  item?.description,
  item?.title,
  item?.label,
  safeStringify(attachment?.results ?? attachment?.labResults ?? attachment?.densityResults ?? attachment?.details ?? {}),
].map(cleanText).filter(Boolean).join(" ");

const earthworksAttachmentOnlyText = (attachment: any): string => [
  attachmentName(attachment),
  attachment?.documentType,
  attachment?.docType,
  attachment?.certificateType,
  attachment?.type,
  attachment?.kind,
  attachment?.category,
  attachment?.title,
  attachment?.label,
  attachment?.description,
  attachment?.details,
  safeStringify(attachment?.results ?? attachment?.labResults ?? attachment?.densityResults ?? attachment?.details ?? {}),
].map(cleanText).filter(Boolean).join(" ");

const earthworksAttachmentMetaText = (attachment: any): string => [
  attachmentName(attachment),
  attachment?.documentType,
  attachment?.docType,
  attachment?.certificateType,
  attachment?.type,
  attachment?.kind,
  attachment?.category,
  attachment?.title,
  attachment?.label,
  attachment?.description,
].map(cleanText).filter(Boolean).join(" ");

const earthworksAttachmentSampleRows = (attachment: any): any[] => {
  const candidates = [
    attachment?.labResults?.sampleRows,
    attachment?.labResults?.rows,
    attachment?.densityResults?.sampleRows,
    attachment?.densityResults?.rows,
    attachment?.results?.sampleRows,
    attachment?.results?.rows,
  ];
  const rows = candidates.find((value) => Array.isArray(value) && value.length);
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => row && typeof row === "object");
};

const isControlledDensitySampleRows = (attachment: any, rows: any[]): boolean => {
  const text = [
    earthworksAttachmentOnlyText(attachment),
    safeStringify(rows.slice(0, 3)),
  ].join(" ");
  return includesAny(text, [
    "הידוק מבוקר",
    "מד גרעיני",
    "צפיפות רטובה",
    "דרגת הידוק",
    "רטיבות",
    "wetDensity",
    "compaction",
    "densityCertificateNo",
  ]);
};

const expandEarthworksAttachmentRows = (attachment: any): any[] => {
  const rows = earthworksAttachmentSampleRows(attachment);
  if (!rows.length) return [attachment];
  if (isControlledDensitySampleRows(attachment, rows)) return [attachment];
  return rows.map((row, index) => ({
    ...attachment,
    id: `${attachment?.id ?? attachmentName(attachment) ?? "attachment"}-sample-${index + 1}`,
    labResults: {
      ...(attachment?.labResults ?? {}),
      ...row,
      sampleRows: undefined,
      rows: undefined,
    },
    densityResults: {
      ...(attachment?.densityResults ?? {}),
      ...row,
      sampleRows: undefined,
      rows: undefined,
    },
    results: {
      ...(attachment?.results ?? {}),
      ...row,
      sampleRows: undefined,
      rows: undefined,
    },
  }));
};

const isEarthworksMeasurementAttachment = (attachment: any, item: any): boolean => {
  if (!isRealAttachment(attachment)) return false;
  const text = earthworksAttachmentMetaText(attachment);
  // לא משתמשים בתיאור סעיף רשימת התיוג לזיהוי מדידה, כי סעיף כמו
  // "בדיקת עומק ומפלסי חפירה" גרם לסיווג שגוי של תעודות מעבדה כמדידה.
  return attachment?.kind === "measurement" || includesAny(text, ["רשימת מדידה", "מדידה", "measurement", "survey"]);
};

const isEarthworksLabCertificateAttachment = (attachment: any, item: any): boolean => {
  if (!isRealAttachment(attachment)) return false;
  const text = attachmentTextForLabCheck(attachment, item);

  // חסימה מוחלטת: קובץ מדידה לא ייכנס לעמודות תעודות/צפיפות/מעברי מכבש,
  // גם אם שם סעיף רשימת התיוג כולל את המילה חפירה.
  if (isEarthworksMeasurementAttachment(attachment, item)) return false;
  if (includesAny(text, earthworksNonLabAttachmentKeywords)) return false;

  const hasParsedLabData = Boolean(
    attachment?.labResults ||
    attachment?.densityResults ||
    attachment?.results?.labResults ||
    attachment?.results?.densityResults
  );
  const hasExplicitCertificateNo = Boolean(
    attachment?.certificateNo ||
    attachment?.certificateNumber ||
    attachment?.documentNo ||
    attachment?.documentNumber
  );

  // לא מסיקים תעודת מעבדה רק ממספר בשם קובץ PDF, כי זה גרם למספרי מדידה כמו 9944
  // להופיע בעמודת Q. חייב להיות labResults או סימון ברור של kind=lab/תעודת מעבדה.
  return Boolean(
    attachment?.kind === "lab" ||
    hasParsedLabData ||
    (hasExplicitCertificateNo && includesAny(text, earthworksLabCertificateKeywords)) ||
    includesAny(text, ["תעודת מעבדה", "דוח בדיקה", "דו״ח בדיקה", "דו״ח בדיקה", "תעודת בדיקה"])
  );
};

type EarthworksTestKind = "regular" | "density" | "controlled" | "sand" | "survey" | "characterization" | "hwd";

const earthworksTestKind = (sources: any[]): EarthworksTestKind => {
  const text = sources.map((source) => [
    source?.testType,
    source?.documentType,
    source?.docType,
    source?.certificateType,
    source?.type,
    source?.kind,
    source?.category,
    source?.title,
    source?.label,
    source?.description,
    source?.name,
    source?.fileName,
    source?.attachmentName,
    safeStringify(source?.results ?? source?.labResults ?? source?.densityResults ?? source),
  ].map(cleanText).filter(Boolean).join(" ")).join(" ");
  if (includesAny(text, ["hwd"])) return "hwd";
  if (includesAny(text, ["אפיון", "100%", "100 אחוז", "פרוקטור", "proctor", "classification"])) return "characterization";
  if (includesAny(text, ["מדידה", "survey"])) return "survey";
  if (includesAny(text, ["חרוט חול", "מנה", "מנת בדיקה", "שלבי", "sand cone"])) return "sand";
  if (includesAny(text, ["הידוק מבוקר", "מד גרעיני", "גרעיני", "nuclear", "מבוקר"])) return "controlled";
  if (includesAny(text, ["צפיפות", "רטיבות", "density", "moisture"])) return "density";
  return "regular";
};


const earthworksDirectValue = (sources: any[], aliases: string[]): string => {
  // מחזירים רק ערך שהוזן בשדה ייעודי במערכת, בלי ניחוש מתוך הערות/שם קובץ.
  // כאן משתמשים בהתאמה קשיחה כדי שריכוז נת״י לא יקבל ערכים שגויים משדות כלליים
  // כגון id/type/to/from/date/status שנמצאים באובייקטים של קובץ או משתמש.
  for (const source of sources) {
    const value = strictValueByKeyOrLabel(source, aliases);
    if (value) return value;
  }
  return "";
};

const earthworksDirectDate = (sources: any[], aliases: string[], ...fallbacks: unknown[]): string =>
  firstDateText(...sources.map((source) => strictValueByKeyOrLabel(source, aliases)), ...fallbacks);

const normalizeEarthworksStatus = (value: unknown): string => {
  const text = cleanText(value);
  if (!text || includesAny(text, ["לא נבדק", "not tested", "לא בוצע"])) return "";
  if (includesAny(text, ["לא תקין", "נכשל", "NC", "נדחה", "פסול"])) return "NC";
  if (includesAny(text, ["תקין", "מאושר", "OK", "עבר"])) return "OK";
  return text;
};

const normalizeSubbaseStatus = (...values: unknown[]): string => {
  const status = normalizeEarthworksStatus(firstText(...values));
  if (!status) return "";
  if (status === "OK" || status === "NC") return status;
  return "";
};

const earthworksChecklistSortValue = (value: unknown, fallback: number): number => {
  const text = cleanText(value);
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : fallback;
};

const earthworksRowDateSortValue = (row: Row, fallback: number): number =>
  parseDateOrderTime(
    firstText(
      row["תאריך הבדיקה"],
      row["תאריך ביצוע"],
      row["תאריך אישור"],
      row["תאריך"],
      row["מתאריך"],
    ),
  ) ?? fallback;

const earthworksRowLayerSortValue = (row: Row, fallback: number): number =>
  earthworksChecklistSortValue(
    firstText(
      row["שכבה מס'"],
      row["מס' שכבה"],
      row["מס׳ שכבה"],
      row["מספר שכבה"],
      row["שכבה"],
    ),
    fallback,
  );

const compareEarthworksRowsByDateLayer = (a: Row, b: Row): number =>
  earthworksRowDateSortValue(a, Number.POSITIVE_INFINITY) -
    earthworksRowDateSortValue(b, Number.POSITIVE_INFINITY) ||
  earthworksRowLayerSortValue(a, Number.POSITIVE_INFINITY) -
    earthworksRowLayerSortValue(b, Number.POSITIVE_INFINITY) ||
  earthworksChecklistSortValue(a["מחתך"], Number.POSITIVE_INFINITY) -
    earthworksChecklistSortValue(b["מחתך"], Number.POSITIVE_INFINITY) ||
  earthworksChecklistSortValue(a["עד חתך"], Number.POSITIVE_INFINITY) -
    earthworksChecklistSortValue(b["עד חתך"], Number.POSITIVE_INFINITY) ||
  earthworksChecklistSortValue(a["רשימת תיוג"], Number.POSITIVE_INFINITY) -
    earthworksChecklistSortValue(b["רשימת תיוג"], Number.POSITIVE_INFINITY) ||
  earthworksChecklistSortValue(a["מס' סדורי"], Number.POSITIVE_INFINITY) -
    earthworksChecklistSortValue(b["מס' סדורי"], Number.POSITIVE_INFINITY);


const earthworksDuplicateRowKey = (row: Row): string => {
  const checklistNo = cleanText(row[earthworksFieldColumns[2]]);
  const date = cleanText(row[earthworksFieldColumns[3]]);
  const layer = cleanText(row[earthworksFieldColumns[10]]);
  if (!checklistNo || !date || !layer) return "";
  return [checklistNo, date, layer]
    .map((value) => value.replace(/\s+/g, " ").trim().toLowerCase())
    .join("|");
};

const dedupeEarthworksRows = (rows: Row[]): Row[] => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = earthworksDuplicateRowKey(row);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const ensureUniqueEarthworksChecklistNumbers = (rows: Row[]): Row[] => {
  const checklistColumn = earthworksFieldColumns[2];
  const used = new Set<number>();
  const maxExisting = rows.reduce((max, row) => {
    const value = earthworksChecklistSortValue(row[checklistColumn], Number.NaN);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  let next = maxExisting + 1;

  return rows.map((row) => {
    const raw = earthworksChecklistSortValue(row[checklistColumn], Number.NaN);
    if (Number.isFinite(raw) && raw > 0 && !used.has(raw)) {
      used.add(raw);
      return row;
    }
    while (used.has(next)) next += 1;
    used.add(next);
    const updated = { ...row, [checklistColumn]: next };
    next += 1;
    return updated;
  });
};

const cleanEarthworksMaterial = (value: unknown): string => {
  const text = cleanText(value);
  if (!text) return "";
  if (
    includesAny(text, [
      "בדיקת",
      "רשימת תיוג",
      "עבודות הידוק",
      "גובה שכבה",
      "עומק ומפלסי",
    ])
  )
    return "";
  return text;
};

const earthworksRowHasCertificateEvidence = (row: Row): boolean =>
  [
    earthworksFieldColumns[16],
    earthworksFieldColumns[19],
    earthworksFieldColumns[26],
    earthworksFieldColumns[27],
  ].some((column) => cleanText(row[column]));

const enrichEarthworksRowsByReferenceCertificate = (rows: Row[]): Row[] => {
  const referenceColumn = earthworksFieldColumns[26];
  const reusableColumns = [
    earthworksFieldColumns[13],
    earthworksFieldColumns[14],
    earthworksFieldColumns[15],
  ];
  const byReference = new Map<string, Row>();

  rows.forEach((row) => {
    const reference = cleanText(row[referenceColumn]);
    if (!reference) return;
    const existing = byReference.get(reference) ?? {};
    const updated = { ...existing };
    reusableColumns.forEach((column) => {
      if (!cleanText(updated[column]) && cleanText(row[column])) updated[column] = row[column];
    });
    byReference.set(reference, updated);
  });

  return rows.map((row) => {
    const reference = cleanText(row[referenceColumn]);
    const reusable = reference ? byReference.get(reference) : null;
    if (!reusable) return row;
    const updated = { ...row };
    reusableColumns.forEach((column) => {
      if (!cleanText(updated[column]) && cleanText(reusable[column])) updated[column] = reusable[column];
    });
    return updated;
  });
};

const exactResultValue = (source: any, aliases: string[]): string => {
  if (!source || typeof source !== "object") return "";
  for (const alias of aliases) {
    const direct = source?.[alias];
    const text = compactValue(direct);
    if (text && text !== "application/pdf" && !looksLikeUuid(text)) return text;
  }
  return strictValueByKeyOrLabel(source, aliases);
};

const exactFirstFromSources = (sources: any[], aliases: string[]): string => {
  for (const source of sources) {
    const value = exactResultValue(source, aliases);
    if (value) return value;
  }
  return "";
};

const earthworksAllText = (sources: any[]): string =>
  sources.map((source) => [
    source?.testType,
    source?.documentType,
    source?.docType,
    source?.certificateType,
    source?.type,
    source?.kind,
    source?.category,
    source?.title,
    source?.label,
    source?.description,
    source?.name,
    source?.fileName,
    source?.attachmentName,
    source?.notes,
    source?.remarks,
    source?.extractedText,
    source?.pdfText,
    source?.ocrText,
    source?.rawText,
    source?.text,
    source?.summary,
    source?.details?.extractedText,
    source?.details?.pdfText,
    source?.details?.ocrText,
    source?.details?.rawText,
    source?.details?.text,
    source?.results?.extractedText,
    source?.results?.pdfText,
    source?.results?.ocrText,
    source?.labResults?.extractedText,
    source?.labResults?.pdfText,
    source?.labResults?.ocrText,
    source?.densityResults?.extractedText,
    source?.densityResults?.pdfText,
    source?.densityResults?.ocrText,
    safeStringify(source?.results ?? source?.labResults ?? source?.densityResults ?? source?.parsedResults ?? source),
  ].map(cleanText).filter(Boolean).join(" ")).join(" ");

const firstRegexText = (text: string, patterns: RegExp[]): string => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1] ?? match?.[2] ?? "";
    if (value) return cleanText(value);
  }
  return "";
};

const earthworksParsedLocation = (sources: any[]) => {
  const text = earthworksAllText(sources)
    .replace(/\u200f|\u200e/g, " ")
    .replace(/\s+/g, " ");
  const fromTo = text.match(/(?:מחתך|חתך)\s*(\d{1,5})\s*(?:[-–]\s*|\s+)(\d{1,5})\s*-?/i);
  const normalizedFrom = fromTo?.[1] ?? "";
  const normalizedTo = fromTo?.[2] ?? "";
  const side = firstRegexText(text, [
    /(?:צד|נתיב)\s*[:\-]?\s*(R|L|ימין|שמאל|שני\s*צדדים|ימני|שמאלי)\b/i,
    /\b(R|L)\b(?=\s*(?:שתית|שכבה|קרקע|$))/i,
  ]);
  const layer = firstRegexText(text, [
    /שכבה\s*(?:מס(?:פר)?['׳]?)?\s*[:\-]?\s*([0-9]{1,3})/i,
    /([0-9]{1,3})\s*שכבה\s*מספר/i,
    /(שתית|קרקע\s*יסוד)(?=\s*(?:שכבה|חתך|מקום|$))/i,
  ]);
  const aashto = firstRegexText(text, [/\b(A-\d-[A-Za-z](?:\(\d+\))?)\b/i]);
  const points = firstRegexText(text, [
    /(?:כמות|מספר)\s*נקודות\s*בדיקה\s*[:\-]?\s*(\d{1,3})/i,
    /(\d{1,3})\s*נקודות\s*בדיקה/i,
  ]);
  const location = firstRegexText(text, [
    /(חתך\s*\d{1,5}\s*(?:[-–]\s*|\s+)\d{1,5}\s*-?(?:\s+[^.\n\r]{0,80}?)?(?:צד\s*(?:R\+L|R|L|ימין|שמאל))?)/i,
  ]);
  const normalizedSide = side.replace("ימין", "R").replace("ימני", "R").replace("שמאל", "L").replace("שמאלי", "L");
  return {
    from: normalizedFrom,
    to: normalizedTo,
    side: normalizedSide,
    layer,
    aashto,
    points,
    location: firstText(location, normalizedFrom && normalizedTo ? `חתך ${normalizedFrom}-${normalizedTo}${normalizedSide ? ` צד ${normalizedSide}` : ""}` : ""),
  };
};

const hasAnyExactField = (source: any, aliases: string[]): boolean => Boolean(exactResultValue(source, aliases));

const normalizeEarthworksDocKind = (sources: any[]): EarthworksTestKind => {
  const text = earthworksAllText(sources);
  const resultSource = sources.find((source) => source && typeof source === "object") ?? {};
  const hasDensityResult = sources.some((source) => hasAnyExactField(source, [
    "מס' תעודת בדיקה צפיפות/ רטיבות שדה",
    "מס׳ תעודת בדיקה צפיפות/ רטיבות שדה",
    "מס׳ תעודת בדיקה צפיפות/ רטיבות שדה",
    "הידוק מבוקר (צפיפות מד גרעיני)",
    "מעמד צפיפות/רטיבות",
    "צפיפות מחושבת",
    "רטיבות ממוצעת",
    "ממוצע",
    "גבול תחתון",
    "גבול עליון",
    "מספר תעודת בדיקה",
    "כמות נקודות בדיקה",
    "צפיפות סטטיסטיקה ממוצע",
    "צפיפות סטטיסטיקה גבול תחתון",
    "צפיפות סטטיסטיקה גבול עליון",
  ]));
  const hasMeasurement = includesAny(text, ["רשימת מדידה", "מדידה", "measurement", "survey"]);
  const hasHwd = includesAny(text, ["HWD", "FWD", "hwd", "fwd"]);
  const hasDensityWords = includesAny(text, ["צפיפות", "רטיבות", "מד גרעיני", "density", "moisture", "nuclear"]);
  const hasRegularResult = sources.some((source) => hasAnyExactField(source, [
    "מס' תעודת בדיקההידוק רגיל",
    "מס׳ תעודת בדיקההידוק רגיל",
    "מספר תעודת בדיקה הידוק רגיל",
    "מעברי מכבש",
    "מעמד הידוק רגיל",
  ]));
  const hasRegularWords = hasRegularResult || includesAny(text, ["מעברי מכבש", "מכבש", "הידוק רגיל", "roller", "passes"]);
  const hasCharacterization = includesAny(text, ["אפיון", "100%", "100 אחוז", "פרוקטור", "proctor", "classification"]);
  const hasSand = includesAny(text, ["חרוט חול", "מנת בדיקה", "שלבי", "sand cone"]);

  if (hasMeasurement && !hasDensityResult) return "survey";
  if (hasDensityResult || (hasDensityWords && !hasMeasurement)) {
    if (includesAny(text, ["הידוק מבוקר", "מד גרעיני", "גרעיני", "nuclear", "מבוקר"]) || hasAnyExactField(resultSource, ["הידוק מבוקר (צפיפות מד גרעיני)"])) return "controlled";
    return "density";
  }
  if (hasSand) return "sand";
  if (hasCharacterization) return "characterization";
  if (hasHwd) return "hwd";
  if (hasRegularWords || includesAny(text, ["הידוק רגיל", "חפירה"])) return "regular";
  return "regular";
};

const normalizeSurveyCount = (value: unknown): string => {
  const text = numericLike(value);
  if (!text || looksLikeUuid(text) || text === "application/pdf") return "1";
  return text;
};

const normalizeRollerPasses = (value: unknown): string => {
  const text = numericLike(value);
  if (!text || looksLikeUuid(text) || text === "application/pdf") return "8";
  const numeric = Number(String(text).replace(",", "."));
  if (!Number.isFinite(numeric) || numeric < 8) return "8";
  return String(Math.round(numeric));
};

const normalizeDensityPointCount = (value: unknown): string => {
  const text = numericLike(value);
  if (!text || looksLikeUuid(text) || text === "application/pdf") return "6";
  const numeric = Number(String(text).replace(",", "."));
  if (!Number.isFinite(numeric) || numeric < 6) return "6";
  return String(Math.round(numeric));
};

const normalizeEarthworksAashto = (...values: unknown[]): string => {
  for (const value of values) {
    const text = cleanText(value).replace(/\s+/g, "");
    const match = text.match(/\bA-\d-[A-Za-z0-9](?:\(\d+\))?\b/i);
    if (match) return match[0];
  }
  return "";
};

const usefulEarthworksLocation = (value: unknown): string => {
  const text = cleanText(value);
  if (!text || looksLikeUuid(text)) return "";
  if (/^\d{1,3}$/.test(text)) return "";
  if (/^כביש\s*\d+$/i.test(text)) return "";
  if (!includesAny(text, ["חתך", "מחתך", "צד", "R", "L"])) return "";
  return text;
};

const earthworksLocationFromChainage = (from: unknown, to: unknown, side: unknown): string => {
  const fromText = numericLike(from);
  const toText = numericLike(to);
  if (!fromText || !toText) return "";
  const sideText = cleanText(side);
  return `חתך ${fromText}-${toText}${sideText ? ` צד ${sideText}` : ""}`;
};

const normalizeEarthworksThickness = (value: unknown): string => {
  const text = cleanText(value);
  if (!text || looksLikeUuid(text)) return "";
  if (includesAny(text, ["קרקע", "חפירה", "מילוי", "רשימת", "אישור", "AASHTO"])) return "";
  const numeric = numericLike(text);
  if (!numeric) return "";
  const numberValue = Number(numeric.replace(",", "."));
  if (!Number.isFinite(numberValue) || numberValue <= 0 || numberValue > 200) return "";
  return numeric;
};

const inferEarthworksWorkType = (rawWorkType: unknown, sources: any[]): string => {
  const raw = cleanText(rawWorkType);
  if (raw && includesAny(raw, earthworksWorkTypeKeywords)) return raw;
  const text = `${raw} ${earthworksAllText(sources)}`;
  if (includesAny(text, ["הידוק מבוקר", "מד גרעיני", "גרעיני"])) return "הידוק מבוקר";
  if (includesAny(text, ["מעברי מכבש", "מעביר מכבש", "תחום החפירה", "חפירה"])) return "חפירה";
  if (includesAny(text, ["קרקע יסוד", "שתית"])) return "קרקע יסוד";
  if (includesAny(text, ["מילוי נברר"])) return "מילוי נברר";
  if (includesAny(text, ["מילוי"])) return "מילוי";
  if (includesAny(raw, ["חפירה", "קרקע יסוד", "מילוי", "הידוק"])) return raw;
  return "";
};

const earthworksWorkTypeFromChecklist = (checklist: any): string => {
  const templateKey = cleanText(checklist?.templateKey);
  const text = `${templateKey} ${cleanText(checklist?.title)} ${cleanText(checklist?.category)} ${cleanText(checklist?.workType)}`;
  if (templateKey === "excavation" || includesAny(text, ["חפירה"])) return "חפירה";
  if (templateKey === "baseCourseSpreading" || includesAny(text, ["פיזור מצעים", "עבודות מצע", "מצע א", "מצעים"])) return "מצע";
  if (templateKey === "asphaltSite" || templateKey === "asphaltWorks" || includesAny(text, ["אספלט"])) return "אספלט";
  if (includesAny(text, ["קרקע יסוד", "שתית"])) return "קרקע יסוד";
  if (
    templateKey === "controlledCompaction" ||
    templateKey === "standardCompaction" ||
    includesAny(text, ["מילוי", "הידוק מבוקר", "הידוק רגיל"])
  ) return "מילוי";
  return "";
};

const normalizeEarthworksMaterialDescription = (
  rawMaterial: unknown,
  checklist: any,
  sources: any[],
): string => {
  const raw = cleanText(rawMaterial);
  const text = `${raw} ${earthworksAllText(sources)} ${cleanText(checklist?.title)} ${cleanText(checklist?.category)}`;
  if (includesAny(text, ["חומר נברר", "מילוי נברר", "נברר"])) return "חומר נברר";
  if (includesAny(text, ["קרקע יסוד"])) return "קרקע יסוד";
  if (includesAny(text, ["שתית"])) return "שתית";
  if (cleanText(checklist?.templateKey) === "controlledCompaction" && !includesAny(raw, ["מצע", "אספלט"])) {
    return "חומר נברר";
  }
  return raw;
};

const earthworksRowFromSources = (sources: any[], attachment: any, serial: number, checklistIndex = 0): Row => {
  const checklist = sources[0] ?? {};
  const item = sources[1] ?? {};
  const checklistSource = { ...(checklist?.details ?? {}), ...checklist };
  const itemSource = { ...(item?.details ?? {}), ...item };
  const resultsSource = {
    ...(itemSource?.results ?? {}),
    ...(itemSource?.labResults ?? {}),
    ...(itemSource?.densityResults ?? {}),
    ...(attachment?.results ?? {}),
    ...(attachment?.labResults ?? {}),
    ...(attachment?.densityResults ?? {}),
    ...(attachment?.details ?? {}),
  };

  // סדר עדיפות: נתוני תוצאה/מעבדה -> שורת רשימת התיוג -> כותרת הרשימה.
  // לא מושכים נתונים מהערות כלליות או משם קובץ, כדי למנוע ערבוב שדות בריכוז נת״י.
  const certificateFieldSources = [resultsSource, attachment].filter(Boolean);
  const checklistFieldSources = [itemSource, checklistSource].filter(Boolean);
  const fieldSources = [resultsSource, itemSource, checklistSource].filter(Boolean);
  const certificateSources = [resultsSource, attachment, itemSource].filter(Boolean);
  const parsedDensity = parsedDensityFromSources([resultsSource, attachment]);
  const parsedLocation = earthworksParsedLocation([resultsSource, attachment, itemSource, checklistSource]);

  const checklistNo = earthworksChecklistNumber(checklist, checklistIndex);
  const rawWorkType = firstText(
    earthworksDirectValue(fieldSources, ["סוג העבודה", "סוג עבודה", "workType", "work_type", "activity", "פעילות", "workActivity"]),
    includesAny(itemSource?.description, earthworksWorkTypeKeywords) ? cleanText(itemSource?.description) : "",
    includesAny(checklistSource?.title, earthworksWorkTypeKeywords) ? cleanText(checklistSource?.title) : "",
  );
  const workType = firstText(
    earthworksWorkTypeFromChecklist(checklistSource),
    inferEarthworksWorkType(rawWorkType, [resultsSource, attachment, itemSource, checklistSource]),
  );
  const certificate = firstText(parsedDensity.certificateNo, attachmentOrMetricCertificate(certificateSources, attachment));

  const status = normalizeEarthworksStatus(
    firstText(
      earthworksDirectValue(fieldSources, ["מעמד תוצאות", "מעמד", "סטטוס", "qualityStatus", "status"]),
      parsedDensity.status,
    ),
  );
  const isNc = status === "NC" || includesAny(status, ["לא תקין", "נכשל", "נדחה", "פסול"]);

  // סוג המסמך נקבע לפי הקובץ ותוצאות ה-PDF בלבד, לא לפי כותרת/תיאור סעיף הרשימה.
  // כך רשימות מדידה לא "צובעות" תעודות מעבדה מצורפות כמדידה.
  const kind = normalizeEarthworksDocKind([resultsSource, attachment]);
  const isRegularCompaction =
    kind === "regular" ||
    includesAny(workType, ["חפירה", "הידוק רגיל", "מילוי רגיל"]) ||
    includesAny(`${itemSource?.description ?? ""} ${checklistSource?.title ?? ""}`, ["חפירה", "הידוק רגיל", "מילוי רגיל"]);
  const isControlledCompaction = kind === "controlled" || includesAny(`${workType} ${earthworksAllText([resultsSource, attachment])}`, ["הידוק מבוקר", "מד גרעיני", "גרעיני"]);
  const isDensityChecklistItem = includesAny(
    `${itemSource?.description ?? ""} ${itemSource?.title ?? ""} ${itemSource?.label ?? ""}`,
    ["בדיקות דרגת הידוק", "תכולת רטיבות", "צפיפות", "רטיבות", "density", "moisture"],
  );
  const isDensityMoisture = kind === "density" || isControlledCompaction || isDensityChecklistItem;
  const isSurvey = kind === "survey";
  const isHwd = kind === "hwd";

  const exactDate = firstText(
    exactFirstFromSources(fieldSources, ["תאריך הבדיקה", "תאריך בדיקה", "testDate"]),
    parsedDensity.testDate,
  );
  const exactFrom = firstText(
    exactFirstFromSources(checklistFieldSources, ["מחתך", "חתך התחלה", "stationSection", "fromSection", "stationFrom", "chainageFrom", "fromChainage"]),
    parsedLocation.from,
    exactFirstFromSources(certificateFieldSources, ["מחתך", "חתך התחלה", "stationSection", "fromSection", "stationFrom", "chainageFrom", "fromChainage"]),
  );
  const exactTo = firstText(
    exactFirstFromSources(checklistFieldSources, ["עד חתך", "לחתך", "חתך סוף", "toStationSection", "toSection", "stationTo", "chainageTo", "toChainage"]),
    parsedLocation.to,
    exactFirstFromSources(certificateFieldSources, ["עד חתך", "לחתך", "חתך סוף", "toStationSection", "toSection", "stationTo", "chainageTo", "toChainage"]),
  );
  const exactSide = firstText(
    exactFirstFromSources(checklistFieldSources, ["צד", "offset", "side", "roadSide", "lane"]),
    parsedLocation.side,
    exactFirstFromSources(certificateFieldSources, ["צד", "offset", "side", "roadSide", "lane"]),
  );
  const exactRoadStructure = firstText(
    exactFirstFromSources(checklistFieldSources, ["כביש/מבנה", "כביש\\מבנה", "כביש / מבנה", "roadStructure", "כביש", "מבנה", "road", "structure"]),
    checklistSource?.roadStructure,
    checklistSource?.road,
    checklistSource?.structure,
    checklistSource?.building,
  );
  const exactLocation = firstText(
    exactRoadStructure,
    exactFirstFromSources(checklistFieldSources, ["מקום נטילה", "מקום הדגימה", "מקום דיגום", "מקום נטילת מדגם", "samplingLocation"]),
    usefulEarthworksLocation(exactFirstFromSources(certificateFieldSources, ["מקום נטילה", "מקום הדגימה", "מקום דיגום", "מקום נטילת מדגם", "samplingLocation"])),
    parsedLocation.location,
  );
  const exactLayer = firstText(
    checklistSource?.layerNo,
    checklistSource?.layerNumber,
    checklistSource?.layer,
    numericLike(checklistSource?.location),
    exactFirstFromSources([checklistSource], ["שכבה מס׳", "שכבה מס'", "שכבה מס", "מספר שכבה", "קוד השכבה", "שכבה", "layer", "layerNo", "layerCode", "layerNumber"]),
    exactFirstFromSources([itemSource], ["שכבה מס׳", "שכבה מס'", "שכבה מס", "מספר שכבה", "קוד השכבה", "שכבה", "layer", "layerNo", "layerCode", "layerNumber"]),
    parsedLocation.layer,
    exactFirstFromSources(certificateFieldSources, ["שכבה מס׳", "שכבה מס'", "שכבה מס", "מספר שכבה", "קוד השכבה", "שכבה", "layer", "layerNo", "layerCode", "layerNumber"]),
  );
  const exactMaterial = normalizeEarthworksMaterialDescription(firstText(
    cleanEarthworksMaterial(exactFirstFromSources(certificateFieldSources, ["שכבת המבנה", "structureLayer"])),
    cleanEarthworksMaterial(exactFirstFromSources(certificateFieldSources, ["תאור החומר", "תיאור החומר", "חומר", "materialDescription", "material"])),
    cleanEarthworksMaterial(exactFirstFromSources(checklistFieldSources, ["שכבת המבנה", "תאור החומר", "תיאור החומר", "חומר", "materialDescription", "structureLayer", "material"])),
  ), checklistSource, [resultsSource, attachment, itemSource]);
  const exactAashto = normalizeEarthworksAashto(
    exactFirstFromSources(certificateFieldSources, ["מיון החומר", "מיון", "מיון AASHTO", "AASHTO", "aashto", "classification", "סיווג AASHTO"]),
  );
  const hasDensityPayload = Boolean(exactFirstFromSources(certificateSources, ["צפיפות מחושבת", "תוצאות בדיקה", "דרגת הידוק", "רטיבות ממוצעת", "צפיפות מקס מעבדתית", "צפיפות מעבדתית מקסימלית", "כמות נקודות בדיקה", "ממוצע", "גבול תחתון", "גבול עליון", "צפיפות סטטיסטיקה ממוצע", "צפיפות סטטיסטיקה גבול תחתון", "צפיפות סטטיסטיקה גבול עליון"]));
  const exactDensityCert = exactFirstFromSources(certificateSources, ["מס' תעודת בדיקה צפיפות/ רטיבות שדה", "מס׳ תעודת בדיקה צפיפות/ רטיבות שדה", "מספר תעודת בדיקה צפיפות/ רטיבות שדה", "מספר תעודת צפיפות", "מספר תעודת בדיקת צפיפות", "מספר תעודת בדיקה", "תעודת בדיקה", "certificateNo", "certificateNumber", "densityCertificateNo"]);
  const exactRegularCert = exactFirstFromSources(certificateSources, ["מס' תעודת בדיקההידוק רגיל", "מס׳ תעודת בדיקההידוק רגיל", "מספר תעודת בדיקה הידוק רגיל"]);
  const exactReferenceCert = exactFirstFromSources(fieldSources, ["מספר תעודת בדיקה אפיון - 100%", "מספר תעודת ייחוס", "מספר תעודת ייחוס-100%", "מספר תעודת ייחוס 100%", "תעודת ייחוס", "מדוח מספר", "מדו״ח מספר", "referenceCertificate", "referenceCertificateNo", "proctorCertificate"]);
  const densityCertificate = (isDensityMoisture || hasDensityPayload) && kind !== "characterization" ? firstText(exactDensityCert, certificate) : "";
  const regularCertificate = isRegularCompaction && !isDensityMoisture && !isSurvey && !isHwd ? firstText(exactRegularCert, certificate) : "";
  const densitySampleCount = firstText(
    ...[
      resultsSource?.sampleRows,
      resultsSource?.rows,
      attachment?.labResults?.sampleRows,
      attachment?.labResults?.rows,
      attachment?.densityResults?.sampleRows,
      attachment?.densityResults?.rows,
      attachment?.results?.sampleRows,
      attachment?.results?.rows,
    ].map((value) => (Array.isArray(value) && value.length ? String(value.length) : "")),
  );

  const densityPoints = firstText(
    earthworksDirectValue(fieldSources, ["כמות נקודות בדיקה", "מספר נקודות בדיקה", "נקודות בדיקה", "מספר בדיקות באתר", "testPoints", "testPointCount", "points"]),
    densitySampleCount,
    numericLike(earthworksDirectValue(fieldSources, ["נקודות", "quantity"])),
    parsedLocation.points,
  );
  const layerThickness = normalizeEarthworksThickness(firstText(
    earthworksDirectValue(checklistFieldSources, [
      "עובי השכבה",
      "עובי שכבה",
      "עובי שכבות",
      "עובי השכבות",
      "עובי שכבה בסמ",
      "עובי שכבה בס\"מ",
      "עובי בסמ",
      "עובי",
      "layerThickness",
      "layerThicknessCm",
      "thickness",
      "thicknessCm",
    ]),
    earthworksDirectValue(certificateFieldSources, ["עובי השכבה", "עובי שכבה", "layerThickness", "layerThicknessCm", "thickness", "thicknessCm"]),
  ));
  const rollerPasses = firstText(
    earthworksDirectValue(fieldSources, ["מעברי מכבש", "כמות מעברי מכבש", "rollerPasses", "passes"]),
    numericLike(earthworksDirectValue(fieldSources, ["מעברים"])),
  );
  const surveyDocument = isSurvey ? firstText(
    exactFirstFromSources(certificateFieldSources, ["מספר רשימת מדידה", "מספר מדידה", "measurementNo", "surveyNo", "documentNo", "documentNumber"]),
    attachmentName(attachment),
  ) : "";
  const densityRowsForStats = [
    resultsSource?.sampleRows,
    resultsSource?.rows,
    attachment?.labResults?.sampleRows,
    attachment?.labResults?.rows,
    attachment?.densityResults?.sampleRows,
    attachment?.densityResults?.rows,
    attachment?.results?.sampleRows,
    attachment?.results?.rows,
  ].find((value) => Array.isArray(value) && value.length) as any[] | undefined;
  const densityAverageFromRows = (aliases: string[]) => {
    if (!Array.isArray(densityRowsForStats)) return "";
    const values = densityRowsForStats
      .map((row) => Number(exactResultValue(row, aliases).replace(",", ".")))
      .filter((value) => Number.isFinite(value));
    if (!values.length) return "";
    return (values.reduce((sum, value) => sum + value, 0) / values.length)
      .toFixed(1)
      .replace(/\.0$/, "");
  };
  const densityResultValue = firstText(
    parsedDensity.density,
    exactFirstFromSources(certificateSources, ["צפיפות מחושבת", "תוצאות בדיקה", "תוצאה", "דרגת הידוק", "result", "resultValue", "density", "compaction", "compactionAverage"]),
    densityAverageFromRows(["צפיפות מחושבת", "תוצאות בדיקה", "דרגת הידוק", "compaction", "compactionAverage"]),
  );
  const densityLowerLimit = firstText(exactFirstFromSources(certificateSources, ["צפיפות סטטיסטיקה גבול תחתון", "גבול תחתון", "La", "la", "statisticalLower", "lowerLimit", "lowerDensity", "צפיפות גבול תחתון"]));
  const densityAverage = firstText(
    exactFirstFromSources(certificateSources, ["צפיפות סטטיסטיקה ממוצע", "ממוצע", "Xn", "xn", "statisticalAverage", "average", "avg", "צפיפות ממוצע"]),
    densityAverageFromRows(["צפיפות סטטיסטיקה ממוצע", "ממוצע", "Xn", "xn", "דרגת הידוק", "compaction", "compactionAverage"]),
    densityResultValue,
  );
  const densityUpperLimit = firstText(exactFirstFromSources(certificateSources, ["צפיפות סטטיסטיקה גבול עליון", "גבול עליון", "La'", "laPrime", "statisticalUpper", "upperLimit", "upperDensity", "צפיפות גבול עליון"]));
  const hasDensityStatistics = Boolean(densityLowerLimit || densityAverage || densityResultValue);
  const hasRollerPassText = includesAny(
    `${workType} ${itemSource?.description ?? ""} ${itemSource?.title ?? ""} ${checklistSource?.title ?? ""}`,
    ["מעברי מכבש", "מעביר מכבש", "מכבש", "roller", "passes"],
  );
  const hasRegularCompactionEvidence = Boolean(regularCertificate || rollerPasses || hasRollerPassText);
  const isRollerPassOnlyRow = Boolean(
    hasRegularCompactionEvidence &&
      !densityCertificate &&
      !exactReferenceCert &&
      !hasDensityPayload &&
      kind !== "characterization" &&
      kind !== "survey" &&
      kind !== "hwd",
  );

  const row: Row = {
    'ביצוע ע"י ': firstText(earthworksDirectValue(fieldSources, ["ביצוע עי", 'ביצוע ע"י', "performedBy", "מבצע"]), "QC"),
    "מס' סדורי": serial,
    'רשימת תיוג': checklistNo,
    'תאריך הבדיקה': firstText(
      exactDate,
      earthworksDirectDate([itemSource, attachment, checklistSource], ["תאריך הבדיקה", "תאריך ביצוע", "executionDate", "testDate", "date"], itemSource?.executionDate, checklistSource?.date, checklistSource?.savedAt),
    ),
    'כביש\\ציר \\רמפה': firstText(exactRoadStructure, earthworksDirectValue(fieldSources, ["כביש", "ציר", "רמפה", "roadStructure", "road", "roadNo", "roadNumber", "axis"]), checklistSource?.axis),
    'מחתך': firstText(exactFrom, checklistSource?.fromSection, checklistSource?.from_chainage, checklistSource?.stationSection),
    'עד חתך': firstText(exactTo, checklistSource?.toSection, checklistSource?.to_chainage, checklistSource?.toStationSection),
    'צד': exactSide,
    'מקום נטילה': exactLocation,
    'שטח ': firstText(
      checklistSource?.areaSquareMeters,
      checklistSource?.area_square_meters,
      earthworksDirectValue(checklistFieldSources, ["שטח מ\"ר", "שטח מ״ר", "שטח", "areaSquareMeters", "area_square_meters", "area"]),
      earthworksDirectValue(certificateFieldSources, ["שטח מ\"ר", "שטח מ״ר", "שטח", "areaSquareMeters", "area"]),
    ),
    "שכבה מס'": exactLayer,
    'עובי השכבה': layerThickness,
    'סוג העבודה ': workType,
    'תאור החומר ': exactMaterial,
    'מיון החומר ': isRollerPassOnlyRow ? "" : exactAashto,
    'מקור החומר': firstText(earthworksDirectValue(certificateFieldSources, ["מקור החומר", "מקור", "source", "materialSource"])),
    "מס' תעודת בדיקההידוק רגיל": regularCertificate,
    'מעברי מכבש': hasRegularCompactionEvidence ? normalizeRollerPasses(rollerPasses) : "",
    'מעמד הידוק רגיל': hasRegularCompactionEvidence ? firstText(status, "OK") : "",
    "מס' תעודת בדיקה צפיפות/ רטיבות שדה": densityCertificate,
    'הידוק מבוקר (צפיפות מד גרעיני)': densityCertificate ? normalizeDensityPointCount(firstText(densityPoints, exactFirstFromSources(fieldSources, ["הידוק מבוקר (צפיפות מד גרעיני)", "כמות נקודות בדיקה", "נקודות בדיקה"]), densitySampleCount)) : "",
    'מעמד צפיפות/רטיבות': densityCertificate ? firstText(status, "OK") : "",
    ' מנת בדיקה (חרוט חול / שלבי)': kind === "sand" ? firstText(densityPoints, certificate) : "",
    'מעמד מנת בדיקה': kind === "sand" ? status : "",
    'מדידה': surveyDocument,
    'מעמד מדידה': surveyDocument ? firstText(status, "OK") : "",
    'מספר תעודת בדיקה אפיון - 100%': firstText(exactReferenceCert, kind === "characterization" ? certificate : ""),
    'HWD': isHwd ? firstText(certificate, attachmentName(attachment)) : "",
    'מעמד HWD': isHwd ? firstText(status, "OK") : "",
    'תוצאות בדיקה': densityCertificate ? densityResultValue : "",
    'צפיפות סטטיסטיקה גבול תחתון': densityCertificate ? densityLowerLimit : "",
    'צפיפות סטטיסטיקה גבול עליון': densityCertificate && hasDensityStatistics ? densityUpperLimit : "",
    'צפיפות סטטיסטיקה ממוצע': densityCertificate ? densityAverage : "",
    'מעמד תוצאות': densityCertificate ? firstText(status, "OK") : "",
    'בדיקה חוזרת לתעודה ': isNc ? earthworksDirectValue(fieldSources, ["בדיקה חוזרת לתעודה", "retestCertificate", "repeatCertificate"]) : "",
    'מתאריך': isNc ? earthworksDirectDate(fieldSources, ["מתאריך", "תאריך תעודה NC", "retestDate", "repeatDate"]) : "",
    'מספר אי התאמה': isNc ? earthworksDirectValue(fieldSources, ["מספר אי התאמה", "מספר NC", "ncrNumber", "nonconformanceNumber"]) : "",
    'הערות': "",
  };
  return row;
};

const mergeEarthworksRows = (base: Row, next: Row): Row => {
  const merged: Row = { ...base };
  earthworksFieldColumns.forEach((column) => {
    const current = cleanText(merged[column]);
    const incoming = cleanText(next[column]);
    if (!incoming) return;

    if (!current) {
      merged[column] = next[column];
      return;
    }

    if ([
      "מס' תעודת בדיקההידוק רגיל",
      "מעברי מכבש",
      "מעמד הידוק רגיל",
      "מס' תעודת בדיקה צפיפות/ רטיבות שדה",
      "הידוק מבוקר (צפיפות מד גרעיני)",
      "מעמד צפיפות/רטיבות",
      "מדידה",
      "מעמד מדידה",
      "תוצאות בדיקה",
      "צפיפות סטטיסטיקה גבול תחתון",
      "צפיפות סטטיסטיקה גבול עליון",
      "צפיפות סטטיסטיקה ממוצע",
      "מעמד תוצאות",
    ].some((label) => normalizeFieldKey(column) === normalizeFieldKey(label))) {
      if (current !== incoming) merged[column] = uniqueJoin([current, incoming]);
    }
  });
  return merged;
};

const isGradingLineReferenceProcess = (process: any): boolean => {
  if (
    process?.subtype === "materials" &&
    includesAny(recordText(process), ["מצע", "נברר", "עבודות עפר", "מילוי", "שתית", "קרקע יסוד"])
  ) return true;
  if (Array.isArray(process?.sampleRows) && process.sampleRows.length) return true;
  const text = [
    process?.workType,
    process?.title,
    process?.specSection,
    process?.location,
    ...(Array.isArray(process?.requiredDocuments)
      ? process.requiredDocuments.flatMap((doc: any) => [
          doc?.type,
          doc?.description,
          doc?.attachmentName,
        ])
      : []),
    safeStringify(process?.referenceResults ?? []),
  ].join(" ");
  const isExplicitGrading = includesAny(text, ["קו דירוג", "גרדציה"]);
  const isEarthworksReference =
    includesAny(text, ["ייחוס", "בדיקת ייחוס", "תעודת ייחוס"]) &&
    includesAny(text, ["שתית", "קרקע יסוד", "עבודות עפר", "חפירה", "מילוי", "הידוק"]);
  return (isExplicitGrading || isEarthworksReference) && Array.isArray(process?.referenceResults);
};

const gradingLineResultValue = (process: any, aliases: string[]): string => {
  const rows = Array.isArray(process?.referenceResults) ? process.referenceResults : [];
  const match = rows.find((row: any) => aliases.some((alias) => fieldKeyMatchesAlias(firstText(row?.metric, row?.label, row?.name), alias)));
  return firstText(match?.resultValue, match?.value, match?.result);
};

const sampleRowReferenceResults = (row: any): ReferenceResultRow[] =>
  Object.entries(row ?? {})
    .filter(([, value]) => cleanText(value))
    .map(([metric, value], index) => ({
      id: `sample-${index + 1}-${metric}`,
      metric,
      resultValue: String(value ?? ""),
      qualityStatus: "",
      minValue: "",
      maxValue: "",
    }));

const gradingLineSummary = (process: any): string => {
  const metrics = [
    '3"',
    '1.5"',
    '1"',
    '3/4"',
    "#4",
    "#10",
    "#40",
    "#200",
    "IP",
    "PL",
    "LL",
    "100% מעבדתי",
    "רטיבות אופטימלית",
  ];
  return metrics
    .map((metric) => {
      const value = gradingLineResultValue(process, [metric]);
      return value ? `${metric}: ${value}` : "";
    })
    .filter(Boolean)
    .join(" | ");
};

const earthworksRowFromGradingLineProcess = (process: any, serial: number): Row => {
  const certificateNo = firstText(
    gradingLineResultValue(process, ["תעודה מס׳", "מספר תעודה", "מספר תעודת בדיקה"]),
    process?.processNo,
    process?.referenceNo,
  );
  const testDate = firstText(
    gradingLineResultValue(process, ["תאריך בדיקה", "תאריך"]),
    process?.date,
    process?.savedAt,
  );
  const fromSection = firstText(gradingLineResultValue(process, ["מחתך"]), process?.fromSection);
  const toSection = firstText(gradingLineResultValue(process, ["עד חתך"]), process?.toSection);
  const workType = firstText(gradingLineResultValue(process, ["מהות העבודה", "סוג העבודה"]), process?.location, process?.workType);
  const notes = gradingLineSummary(process);

  return {
    'ביצוע ע"י ': firstText(gradingLineResultValue(process, ['ביצוע ע"י QC/QA', "ביצוע עי", "QC/QA"]), "QC"),
    "מס' סדורי": serial,
    'רשימת תיוג': "",
    'תאריך הבדיקה': testDate,
    'כביש\\ציר \\רמפה': firstText(process?.axis, process?.road, process?.structureNodeName),
    'מחתך': fromSection,
    'עד חתך': toSection,
    'צד': gradingLineResultValue(process, ["צד"]),
    'מקום נטילה': firstText(gradingLineResultValue(process, ["מקום נטילה", "מיקום"]), process?.samplingLocation),
    'שטח ': "",
    "שכבה מס'": firstText(process?.layerNo, process?.layer),
    'עובי השכבה': "",
    'סוג העבודה ': workType,
    'תאור החומר ': firstText(gradingLineResultValue(process, ["תיאור החומר", "תאור החומר", "חומר"]), "קו דירוג"),
    'מיון החומר ': gradingLineResultValue(process, ["מיון AASHTO", "מיון", "AASHTO"]),
    'מקור החומר': gradingLineResultValue(process, ["מקור החומר", "מקור"]),
    "מס' תעודת בדיקההידוק רגיל": "",
    'מעברי מכבש': "",
    'מעמד הידוק רגיל': "",
    "מס' תעודת בדיקה צפיפות/ רטיבות שדה": "",
    'הידוק מבוקר (צפיפות מד גרעיני)': "",
    'מעמד צפיפות/רטיבות': "",
    ' מנת בדיקה (חרוט חול / שלבי)': "",
    'מעמד מנת בדיקה': "",
    'מדידה': "",
    'מעמד מדידה': "",
    'מספר תעודת בדיקה אפיון - 100%': certificateNo,
    'HWD': "",
    'מעמד HWD': "",
    'תוצאות בדיקה': "",
    'צפיפות סטטיסטיקה גבול תחתון': "",
    'צפיפות סטטיסטיקה גבול עליון': "",
    'צפיפות סטטיסטיקה ממוצע': "",
    'מעמד תוצאות': firstText(process?.status, "מאושר"),
    'בדיקה חוזרת לתעודה ': "",
    'מתאריך': "",
    'מספר אי התאמה': "",
    'הערות': notes,
  };
};

const buildEarthworksFieldRows = (checklists: any[], processes: any[] = []): Row[] => {
  const rows: Row[] = [];

  const orderedChecklists = [...checklists]
    .filter((checklist: any) => isEarthworksChecklist(checklist) || isEarthworksRecord(checklist))
    .sort((a: any, b: any) => {
      const aNo = earthworksChecklistSortValue(
        earthworksChecklistNumber(a, 0),
        0
      );
      const bNo = earthworksChecklistSortValue(
        earthworksChecklistNumber(b, 0),
        0
      );
      return aNo - bNo;
    });

  orderedChecklists.forEach((checklist: any, checklistIndex: number) => {
    const items = Array.isArray(checklist?.items) ? checklist.items : [];
    const usedAttachmentKeys = new Set<string>();
    const rememberAttachment = (attachment: any) => {
      const key = attachmentIdentity(attachment);
      if (!key) return true;
      if (usedAttachmentKeys.has(key)) return false;
      usedAttachmentKeys.add(key);
      return true;
    };

    items.forEach((item: any) => {
      const itemText = [
        earthworksChecklistKindText(checklist),
        item?.description,
        item?.title,
        safeStringify(item?.results ?? item?.labResults ?? item?.densityResults ?? {}),
      ].join(" ");

      if (includesAny(itemText, earthworksExcludeKeywords)) return;
      if (
        !includesAny(itemText, earthworksIncludeKeywords) &&
        !includesAny(itemText, earthworksWorkTypeKeywords) &&
        !isEarthworksChecklist(checklist)
      ) {
        return;
      }

      const earthworksAttachments = itemAttachments(item).filter((attachment: any) =>
        isEarthworksLabCertificateAttachment(attachment, item) || isEarthworksMeasurementAttachment(attachment, item)
      ).filter(rememberAttachment);

      if (!earthworksAttachments.length) {
        if (hasStoredEarthworksLabData(item)) {
          rows.push(
            earthworksRowFromSources(
              [checklist, item],
              {},
              rows.length + 1,
              checklistIndex,
            ),
          );
        }
        return;
      }

      const mergeEarthworksRows = (base: Row, next: Row): Row => {
        const merged: Row = { ...base };
        earthworksFieldColumns.forEach((column) => {
          const current = cleanText(merged[column]);
          const incoming = cleanText(next[column]);
          if (!incoming) return;

          // עמודות מסמך/תוצאה מקבלות נתונים מהקובץ הרלוונטי בלבד.
          // כך רשימת מדידה תישאר רק במדידה/מעמד מדידה ולא תדרוס תעודות מעבדה.
          if (!current) {
            merged[column] = next[column];
            return;
          }

          if ([
            "מס' תעודת בדיקההידוק רגיל",
            "מעברי מכבש",
            "מעמד הידוק רגיל",
            "מס' תעודת בדיקה צפיפות/ רטיבות שדה",
            "הידוק מבוקר (צפיפות מד גרעיני)",
            "מעמד צפיפות/רטיבות",
            "מדידה",
            "מעמד מדידה",
            "תוצאות בדיקה",
            "צפיפות סטטיסטיקה גבול תחתון",
            "צפיפות סטטיסטיקה גבול עליון",
            "צפיפות סטטיסטיקה ממוצע",
            "מעמד תוצאות",
          ].includes(column)) {
            if (current !== incoming) merged[column] = uniqueJoin([current, incoming]);
          }
        });
        return merged;
      };

      const expandedAttachments = earthworksAttachments.flatMap((attachment: any) => expandEarthworksAttachmentRows(attachment));
      const hasSampleRows = expandedAttachments.length > earthworksAttachments.length;

      if (hasSampleRows) {
        expandedAttachments.forEach((attachment: any) => {
          rows.push(earthworksRowFromSources([checklist, item], attachment, rows.length + 1, checklistIndex));
        });
      } else {
        const combinedRow = expandedAttachments
          .map((attachment: any) => earthworksRowFromSources([checklist, item], attachment, rows.length + 1, checklistIndex))
          .reduce((base: Row | null, next: Row) => (base ? mergeEarthworksRows(base, next) : next), null as Row | null);

        if (combinedRow) rows.push(combinedRow);
      }
    });

    const checklistAttachments = directRecordAttachments(checklist).filter((attachment: any) =>
      isEarthworksLabCertificateAttachment(attachment, checklist) ||
      isEarthworksMeasurementAttachment(attachment, checklist)
    ).filter(rememberAttachment);

    if (checklistAttachments.length) {
      const expandedAttachments = checklistAttachments.flatMap((attachment: any) => expandEarthworksAttachmentRows(attachment));
      const hasSampleRows = expandedAttachments.length > checklistAttachments.length;

      if (hasSampleRows) {
        expandedAttachments.forEach((attachment: any) => {
          rows.push(earthworksRowFromSources([checklist, {}], attachment, rows.length + 1, checklistIndex));
        });
      } else {
        const combinedRow = expandedAttachments
          .map((attachment: any) => earthworksRowFromSources([checklist, {}], attachment, rows.length + 1, checklistIndex))
          .reduce((base: Row | null, next: Row) => (base ? mergeEarthworksRows(base, next) : next), null as Row | null);

        if (combinedRow) rows.push(combinedRow);
      }
    }
  });

  const completeRows = enrichEarthworksRowsByReferenceCertificate(rows);

  return ensureUniqueEarthworksChecklistNumbers(
    dedupeEarthworksRows(completeRows.filter(earthworksRowHasCertificateEvidence)),
  )
    .sort(compareEarthworksRowsByDateLayer)
    .map((row, index) => ({ ...row, "מס' סדורי": index + 1 }));
};

const subbaseFieldColumns = [
  'ביצוע ע"י ',
  "מס' סדורי",
  'רשימת תיוג',
  'תאריך הבדיקה',
  'כביש\\ציר \\רמפה',
  'מחתך',
  'עד חתך',
  'צד',
  'מקום נטילה',
  'שטח ',
  "שכבה מס'",
  'עובי השכבה',
  'סוג העבודה ',
  'תאור החומר ',
  'מיון החומר ',
  'מקור החומר',
  'הידוק רגיל ',
  'מעמד הידוק רגיל',
  "מס' תעודת בדיקה צפיפות/ רטיבות שדה",
  'הידוק מבוקר (צפיפות מד גרעיני)',
  'מעמד צפיפות/רטיבות',
  ' מנת בדיקה (חרוט חול / שלבי)',
  'מעמד מנת בדיקה',
  'מדידה',
  'מעמד מדידה',
  'מספר תעודת בדיקה אפיון - 100%',
  'HWD',
  'מעמד HWD',
  'צפיפות מחושבת',
  'צפיפות סטטיסטיקה גבול תחתון',
  'צפיפות סטטיסטיקה גבול עליון',
  'צפיפות סטטיסטיקה ממוצע',
  'מעמד תוצאות',
  'בדיקה חוזרת לתעודה ',
  'מתאריך',
  'מספר אי התאמה',
  'הערות',
];

const isUsefulSubbaseText = (value: unknown): boolean => {
  const text = cleanText(value);
  if (!text) return false;
  if (text.length > 90) return false;
  if (includesAny(text, ["הפריט הנבדק", "מקום הבדיקה", "שכבה מספר", "סוג שכבה"])) return false;
  return true;
};

const subbaseWorkType = (value: unknown): string =>
  includesAny(value, subbaseFieldKeywords) && isUsefulSubbaseText(value) ? cleanText(value) : "מצעים";

const subbaseMaterialDescription = (value: unknown): string =>
  isUsefulSubbaseText(value) && !includesAny(value, ["צפיפות באתר", "מד גרעיני", "בדיקה לפי"])
    ? cleanText(value)
    : "מצע א׳";

const numberValue = (value: unknown): number | null => {
  const text = cleanText(value).replace(/,/g, ".");
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
};

const subbaseDensityResultValue = (row: Row): string => {
  const result = firstText(row['תוצאות בדיקה']);
  const avg = firstText(row['צפיפות סטטיסטיקה ממוצע']);
  const lower = firstText(row['צפיפות סטטיסטיקה גבול תחתון']);
  const resultNumber = numberValue(result);
  const avgNumber = numberValue(avg);
  if (result && avg && resultNumber !== null && avgNumber !== null && resultNumber === avgNumber) return "";
  if (resultNumber !== null && resultNumber > 130) return firstText(avg, lower, "");
  return firstText(result, avg);
};

const hasSubbaseOutputData = (row: Row): boolean =>
  Boolean(
    firstText(
      row["מס' תעודת בדיקה צפיפות/ רטיבות שדה"],
      row['הידוק מבוקר (צפיפות מד גרעיני)'],
      row['צפיפות מחושבת'],
      row['צפיפות סטטיסטיקה ממוצע'],
      row['רשימת תיוג'],
    )
  );

const subbaseReferenceSummary = (processes: any[]): Row => {
  const record = processes.find(isMatzeaAProcess);
  if (!record) return {};
  const row = matzeaAProcessRow(record, 0);
  const calculatedDensity = firstText(
    row["צפיפות מעבדתית מקסימלית"],
    metricValue(record, [
      "צפיפות מחושבת",
      "צפיפות מקסימלית מחושבת",
      "100% מחושב",
      "100% מעוקב",
      "100% מעבדתי",
      "צפיפות מעבדתית מקסימלית",
      "צפיפות מקסימלית",
      "maxDensity",
      "calculatedDensity",
      "calculatedMaxDensity",
      "maximumDensity",
    ]),
    exactFirstFromSources([record, record?.details ?? {}, record?.material ?? {}], [
      "צפיפות מחושבת",
      "צפיפות מקסימלית מחושבת",
      "100% מחושב",
      "100% מעבדתי",
      "maxDensity",
      "calculatedDensity",
      "calculatedMaxDensity",
      "maximumDensity",
    ]),
  );
  return {
    'מספר תעודת בדיקה אפיון - 100%': firstText(row["מספר תעודה"], row["מס׳ תעודה"]),
    'תאור החומר ': firstText(metricValue(record, ["תיאור החומר", "תאור החומר", "סוג החומר"]), "מצע א׳"),
    'מיון החומר ': row["מיון AASHTO"],
    'מקור החומר': row["מקור החומר"],
    'צפיפות מחושבת': calculatedDensity,
  };
};

const subbaseFieldRowFromEarthworks = (row: Row, reference: Row = {}): Row => ({
  'ביצוע ע"י ': row['ביצוע ע"י '] ?? '',
  "מס' סדורי": row["מס' סדורי"] ?? '',
  'רשימת תיוג': row['רשימת תיוג'] ?? '',
  'תאריך הבדיקה': row['תאריך הבדיקה'] ?? '',
  'כביש\\ציר \\רמפה': row['כביש\\ציר \\רמפה'] ?? '',
  'מחתך': row['מחתך'] ?? '',
  'עד חתך': row['עד חתך'] ?? '',
  'צד': row['צד'] ?? '',
  'מקום נטילה': row['מקום נטילה'] ?? '',
  'שטח ': row['שטח '] ?? '',
  "שכבה מס'": row["שכבה מס'"] ?? '',
  'עובי השכבה': row['עובי השכבה'] ?? '',
  'סוג העבודה ': subbaseWorkType(row['סוג העבודה ']),
  'תאור החומר ': subbaseMaterialDescription(row['תאור החומר ']),
  'מיון החומר ': firstText(row['מיון החומר '], reference['מיון החומר ']),
  'מקור החומר': row['מקור החומר'] ?? '',
  'הידוק רגיל ': '',
  'מעמד הידוק רגיל': '',
  "מס' תעודת בדיקה צפיפות/ רטיבות שדה": row["מס' תעודת בדיקה צפיפות/ רטיבות שדה"] ?? '',
  'הידוק מבוקר (צפיפות מד גרעיני)': row['הידוק מבוקר (צפיפות מד גרעיני)'] ?? '',
  'מעמד צפיפות/רטיבות': normalizeSubbaseStatus(row['מעמד צפיפות/רטיבות']),
  ' מנת בדיקה (חרוט חול / שלבי)': row[' מנת בדיקה (חרוט חול / שלבי)'] ?? '',
  'מעמד מנת בדיקה': normalizeSubbaseStatus(row['מעמד מנת בדיקה']),
  'מדידה': row['מדידה'] ?? '',
  'מעמד מדידה': normalizeSubbaseStatus(row['מעמד מדידה']),
  'מספר תעודת בדיקה אפיון - 100%': firstText(row['מספר תעודת בדיקה אפיון - 100%'], reference['מספר תעודת בדיקה אפיון - 100%']),
  'HWD': row['HWD'] ?? '',
  'מעמד HWD': normalizeSubbaseStatus(row['מעמד HWD']),
  'צפיפות מחושבת': firstText(subbaseDensityResultValue(row), reference['צפיפות מחושבת']),
  'צפיפות סטטיסטיקה גבול תחתון': row['צפיפות סטטיסטיקה גבול תחתון'] ?? '',
  'צפיפות סטטיסטיקה גבול עליון': row['צפיפות סטטיסטיקה גבול עליון'] ?? '',
  'צפיפות סטטיסטיקה ממוצע': row['צפיפות סטטיסטיקה ממוצע'] ?? '',
  'מעמד תוצאות': normalizeSubbaseStatus(row['מעמד תוצאות']),
  'בדיקה חוזרת לתעודה ': row['בדיקה חוזרת לתעודה '] ?? '',
  'מתאריך': row['מתאריך'] ?? '',
  'מספר אי התאמה': row['מספר אי התאמה'] ?? '',
  'הערות': row['הערות'] ?? '',
});

const buildSubbaseFieldRows = (checklists: any[], processes: any[] = []): Row[] => {
  const rawRows: Row[] = [];
  const reference = subbaseReferenceSummary(processes);

  const orderedChecklists = [...checklists]
    .filter((checklist: any) => isSubbaseFieldChecklist(checklist))
    .sort((a: any, b: any) => {
      const aNo = earthworksChecklistSortValue(earthworksChecklistNumber(a, 0), 0);
      const bNo = earthworksChecklistSortValue(earthworksChecklistNumber(b, 0), 0);
      return aNo - bNo;
    });

  orderedChecklists.forEach((checklist: any, checklistIndex: number) => {
    const items = Array.isArray(checklist?.items) ? checklist.items : [];
    const usedAttachmentKeys = new Set<string>();
    const rememberAttachment = (attachment: any) => {
      const key = attachmentIdentity(attachment);
      if (!key) return true;
      if (usedAttachmentKeys.has(key)) return false;
      usedAttachmentKeys.add(key);
      return true;
    };

    const checklistRows: Row[] = [];
    const measurementRows: Row[] = [];

    items.forEach((item: any) => {
      if (!isSubbaseFieldItem(checklist, item)) return;

      const attachments = itemAttachments(item)
        .filter((attachment: any) => isSubbaseFieldItem(checklist, item, attachment))
        .filter((attachment: any) =>
          isEarthworksLabCertificateAttachment(attachment, item) ||
          isEarthworksMeasurementAttachment(attachment, item)
        )
        .filter(rememberAttachment);

      attachments.forEach((attachment: any) => {
        const row = earthworksRowFromSources([checklist, item], attachment, rawRows.length + checklistRows.length + 1, checklistIndex);
        if (isEarthworksMeasurementAttachment(attachment, item)) {
          measurementRows.push(row);
          return;
        }
        checklistRows.push(row);
      });

      if (!attachments.length) return;
    });

    const checklistAttachments = directRecordAttachments(checklist)
      .filter((attachment: any) => isSubbaseFieldItem(checklist, {}, attachment))
      .filter((attachment: any) =>
        isEarthworksLabCertificateAttachment(attachment, checklist) ||
        isEarthworksMeasurementAttachment(attachment, checklist)
      )
      .filter(rememberAttachment);

    checklistAttachments.forEach((attachment: any) => {
      const row = earthworksRowFromSources([checklist, {}], attachment, rawRows.length + checklistRows.length + 1, checklistIndex);
      if (isEarthworksMeasurementAttachment(attachment, checklist)) {
        measurementRows.push(row);
        return;
      }
      checklistRows.push(row);
    });

    if (!checklistRows.length) {
      checklistRows.push(earthworksRowFromSources([checklist, {}], {}, rawRows.length + 1, checklistIndex));
    }

    checklistRows.forEach((row) => {
      rawRows.push(row);
    });
  });

  return dedupeEarthworksRows(rawRows)
    .map((row) => subbaseFieldRowFromEarthworks(row, reference))
    .filter((outputRow) => hasSubbaseOutputData(outputRow))
    .sort(compareEarthworksRowsByDateLayer)
    .map((row, index) => ({ ...row, "מס' סדורי": index + 1 }));
};

const commonProcessColumns = ["מס׳", "שם/כותרת", "מיקום", "תאריך", "סעיף מפרט", "סוג עבודה", "מספר תעודה / רישיון / אישור", "סוג תעודה", "מס׳ מסמכים", "סטטוס", "הערות"];
const combinedChecklistAndProcesses = (checklists: any[], processes: any[], keywords: string[], label: string): Row[] => {
  const checklist = checklistRows(checklists, keywords, label);
  const process = processes
    .filter((r) => includesAny(recordText(r), keywords))
    .map((r, i) => controlProcessRow(r, checklist.length + i));
  return [...checklist, ...process];
};


const supervisionReportAttachments = (record: any): any[] => {
  const direct = getAttachments(record);
  const legacy = record?.attachment ? [record.attachment].filter(isRealAttachment) : [];
  return [...direct, ...legacy].filter(isRealAttachment);
};

const supervisionReportRow = (record: any, index: number): Row => {
  const docs = supervisionReportAttachments(record);
  return {
    "מס׳": index + 1,
    "מספר דוח": firstText(record?.reportNo, record?.report_no, index + 1),
    "נושא הדוח": firstText(record?.title, record?.subject, record?.name),
    "מיקום": firstText(record?.location),
    "תאריך": firstDateText(record?.date, record?.savedAt, record?.createdAt),
    "מבצע / עורך": firstText(record?.author, record?.createdBy, record?.editor, record?.approvedBy),
    "סטטוס": firstText(record?.status),
    "תאריך טיפול": firstDateText(record?.treatmentDate, record?.treatment_date, record?.closedAt),
    "טיפול": firstText(record?.treatment, record?.response, record?.actionTaken),
    "מס׳ קבצים": docs.length || "",
    "שם קובץ": uniqueJoin(docs.map(attachmentName)),
    "הערות": firstText(record?.notes, record?.remarks),
  };
};

const earthworksMaterialResultsColumns = [
  'ביצוע ע"י QC/QA',
  "מס' סדורי",
  "רשימת תיוג מספר",
  "מקור החומר",
  "תאריך הבדיקה",
  "תעודה מס'",
  "מבנה",
  "מחתך",
  "עד חתך",
  "צד",
  "מהות העבודה",
  '3"',
  '1.5"',
  '1"',
  '3/4"',
  "#4",
  "#10",
  "#40",
  "#200",
  "LL",
  "PL",
  "IP",
  "מיון",
  'אגרגט גס צפיפות ממשית',
  'אגרגט גס ספיגות',
  "100% מעבדתי",
  "רטיבות אופטימלית",
  'מקטע "3/4+',
  "100% מחושב",
  "רטיבות מחושבת",
  "תפיחה חופשית",
  "תכולת קרבונטים",
  "מעמד החומר",
  "הערות",
];

const earthworksMaterialResultsSerialColumn = earthworksMaterialResultsColumns[1];
const earthworksMaterialResultsDateColumn = earthworksMaterialResultsColumns[4];

const earthworksMaterialResultRow = (process: any, serial: number): Row => {
  const certificateNo = firstText(
    gradingLineResultValue(process, ["תעודה מס׳", "תעודה מס'", "מספר תעודה", "מספר תעודת בדיקה"]),
    process?.processNo,
    process?.referenceNo,
  );
  const testDate = firstText(
    gradingLineResultValue(process, ["תאריך בדיקה", "תאריך הבדיקה", "תאריך"]),
    process?.date,
    process?.savedAt,
  );
  const materialSource = gradingLineResultValue(process, ["מקור החומר", "מקור"]);
  const workEssence = firstText(
    gradingLineResultValue(process, ["מהות העבודה", "סוג העבודה"]),
    process?.workType,
    process?.location,
  );
  const structure = firstText(
    gradingLineResultValue(process, ["מבנה", "כביש", "מקום / שימוש מיועד", "מיקום"]),
    process?.structureNodeName,
    process?.road,
    process?.axis,
    process?.location,
  );

  return {
    'ביצוע ע"י QC/QA': firstText(gradingLineResultValue(process, ['ביצוע ע"י QC/QA', 'ביצוע ע"י', "QC/QA"]), "QC"),
    "מס' סדורי": serial,
    "רשימת תיוג מספר": firstText(process?.checklistNo, process?.checklistNumber, process?.linkedChecklistNo),
    "מקור החומר": materialSource,
    "תאריך הבדיקה": testDate,
    "תעודה מס'": certificateNo,
    "מבנה": structure,
    "מחתך": firstText(gradingLineResultValue(process, ["מחתך"]), process?.fromSection),
    "עד חתך": firstText(gradingLineResultValue(process, ["עד חתך"]), process?.toSection),
    "צד": gradingLineResultValue(process, ["צד"]),
    "מהות העבודה": workEssence,
    '3"': gradingLineResultValue(process, ['3"', "3 אינץ"]),
    '1.5"': gradingLineResultValue(process, ['1.5"', '1.5', "37.5"]),
    '1"': gradingLineResultValue(process, ['1"', "1 אינץ", "25"]),
    '3/4"': gradingLineResultValue(process, ['3/4"', '3/4', "19"]),
    "#4": gradingLineResultValue(process, ["#4", "4.75"]),
    "#10": gradingLineResultValue(process, ["#10", "2.00", "2"]),
    "#40": gradingLineResultValue(process, ["#40", "0.425"]),
    "#200": gradingLineResultValue(process, ["#200", "0.075"]),
    "LL": gradingLineResultValue(process, ["LL", "גבול נזילות"]),
    "PL": gradingLineResultValue(process, ["PL", "גבול פלסטיות"]),
    "IP": gradingLineResultValue(process, ["IP", "PI", "אינדקס פלסטיות"]),
    "מיון": gradingLineResultValue(process, ["מיון AASHTO", "מיון", "AASHTO"]),
    'אגרגט גס צפיפות ממשית': gradingLineResultValue(process, ['אגרגט גס צפיפות ממשית', "צפיפות ממשית"]),
    'אגרגט גס ספיגות': gradingLineResultValue(process, ['אגרגט גס ספיגות', "ספיגות"]),
    "100% מעבדתי": gradingLineResultValue(process, ["100% מעבדתי", "צפיפות מקסימלית", "צפיפות יבשה מקסימלית"]),
    "רטיבות אופטימלית": gradingLineResultValue(process, ["רטיבות אופטימלית", "רטיבות אופטימלית"]),
    'מקטע "3/4+': gradingLineResultValue(process, ['מקטע "3/4+', 'אבן +3/4', 'מקטע 3/4']),
    "100% מחושב": gradingLineResultValue(process, ["100% מחושב", "100% מעוקב"]),
    "רטיבות מחושבת": gradingLineResultValue(process, ["רטיבות מחושבת", "רטיבות כוללת"]),
    "תפיחה חופשית": gradingLineResultValue(process, ["תפיחה חופשית"]),
    "תכולת קרבונטים": gradingLineResultValue(process, ["תכולת קרבונטים"]),
    "מעמד החומר": gradingLineResultValue(process, ["מעמד החומר"]),
    "הערות": firstText(gradingLineResultValue(process, ["הערות"]), process?.notes),
  };
};

const buildEarthworksMaterialResultsRows = (processes: any[] = []): Row[] =>
  processes
    .filter(isGradingLineReferenceProcess)
    .flatMap((process: any) => {
      const sampleRows = Array.isArray(process?.sampleRows)
        ? process.sampleRows.filter((row: any) => row && typeof row === "object")
        : [];
      if (!sampleRows.length) return [process];
      return sampleRows.map((sampleRow: any) => ({
        ...process,
        referenceResults: sampleRowReferenceResults(sampleRow),
        fromSection: firstText(sampleRow["מחתך"], process?.fromSection),
        toSection: firstText(sampleRow["עד חתך"], process?.toSection),
        date: firstText(sampleRow["תאריך הבדיקה"], process?.date),
      }));
    })
    .map((process: any, index: number) => ({ row: earthworksMaterialResultRow(process, 0), index }))
    .sort((a, b) => {
      const byDate =
        (parseDateOrderTime(a.row[earthworksMaterialResultsDateColumn]) ?? Number.POSITIVE_INFINITY) -
        (parseDateOrderTime(b.row[earthworksMaterialResultsDateColumn]) ?? Number.POSITIVE_INFINITY);
      return (
        byDate ||
        earthworksRowLayerSortValue(a.row, Number.POSITIVE_INFINITY) -
          earthworksRowLayerSortValue(b.row, Number.POSITIVE_INFINITY) ||
        a.index - b.index
      );
    })
    .map(({ row }, index) => ({
      ...row,
      [earthworksMaterialResultsSerialColumn]: index + 1,
    }));

const definitions: ConcentrationDefinition[] = [
  {
    id: "nonconformances",
    title: "דוח ריכוז אי התאמות",
    fileName: "דוח ריכוז אי התאמות.xlsx",
    description: "ריכוז מתוך טפסי אי־התאמות שנשמרו במערכת",
    sourceLabel: "אי התאמות",
    columns: [
      "מס'",
      "מס' אי התאמה",
      "מסי אי התאמה בSAP",
      "מס סעיף במפרט",
      "תאריך פתיחת",
      "נפתחה",
      "דרגת אי התאמה",
      "גורם אחראי לליקוי (תכנון, ביצוע, ספק)",
      "קטע (כביש, רמפה, גשר...)",
      "מיקום",
      "מיקום עד",
      "היסט",
      "חלק",
      "אלמנט/ שכבה",
      "תת אלמנט",
      "תאור אי התאמה",
      "טיפול הנדרש",
      "גורם המטפל",
      "תאריך  סגירת אי התאמה משוער-מסוכם",
      "תאריך  סגירה משוער על פי החלטת מנה״פ",
      "שבר",
      "השפעה על איכות",
      "פירוט ביצוע פעולה מתקנת",
      "נסגרה",
      "תאריך  סגירה",
      "אישור מנהל ה״א לסגירת אי התאמה QC",
    ],
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
    columns: ["מס׳", "שם קבלן / קבלן משנה", "תחום ביצוע", "סיווג ברשם הקבלנים / מספר תעודה / רישיון / אישור", "מספר תעודה / רישיון / אישור", "שם / סוג תעודה", "מס׳ מסמכים", "סטטוס", "תאריך אישור", "הערות"],
    buildRows: ({ savedPreliminary }) => preliminaryBySubtype(savedPreliminary, "subcontractors").map(contractorRow),
  },
  {
    id: "asphalt",
    title: "ריכוז בדיקות אספלט",
    fileName: "ריכוז בדיקות אספלט.xlsx",
    description: "בדיקות אספלט מתוך רשימות תיוג ותעודות מצורפות",
    sourceLabel: "רשימות תיוג",
    columns: asphaltOutputColumns,
    buildRows: (ctx) => buildAsphaltConcentrationRows(ctx),
  },
  {
    id: "density",
    title: "בדיקות צפיפות שדה מצעים",
    fileName: "בדיקת שדה למצעים.xlsx",
    description: "ריכוז נת״י לבדיקות צפיפות שדה של מצעים מתוך תעודות מעבדה המצורפות לרשימות תיוג פיזור מצעים.",
    sourceLabel: "רשימות תיוג / פיזור מצעים",
    columns: subbaseFieldColumns,
    buildRows: ({ savedChecklists, savedControlProcesses }) => buildSubbaseFieldRows(savedChecklists, savedControlProcesses),
  },
  {
    id: "concrete",
    title: "ריכוז בטון",
    fileName: "ריכוז בטון.xlsx",
    description: "בדיקות בטון מתוך רשימות תיוג ותעודות מצורפות",
    sourceLabel: "רשימות תיוג",
    columns: concreteOutputColumns,
    buildRows: ({ savedChecklists }) => buildConcreteConcentrationRows(savedChecklists),
  },
  {
    id: "piles",
    title: "ריכוז כלונסאות",
    fileName: "ריכוז כלונסאות.xlsx",
    description:
      "ריכוז אוטומטי בפורמט נתיבי ישראל מתוך רשימות תיוג כלונסאות שנשמרו במערכת",
    sourceLabel: "רשימות תיוג / כלונסאות",
    columns: pileOutputColumns,
    buildRows: ({ savedChecklists }) => buildPileConcentrationRows(savedChecklists),
  },
  {
    id: "supervision",
    title: "ריכוז דוחות פיקוח עליון",
    fileName: "ריכוז דוחות פיקוח עליון.xlsx",
    description: "",
    sourceLabel: "דוחות פיקוח עליון",
    columns: ["מס׳", "מספר דוח", "נושא הדוח", "מיקום", "תאריך", "מבצע / עורך", "סטטוס", "תאריך טיפול", "טיפול", "מס׳ קבצים", "שם קובץ", "הערות"],
    buildRows: ({ savedSupervisionReports }) => savedSupervisionReports.map(supervisionReportRow),
  },
  {
    id: "materials",
    title: "ריכוז חומרים",
    fileName: "ריכוז חומרים.xlsx",
    description: "ריכוז אישורי חומרים מתוך בקרה מקדימה",
    sourceLabel: "בקרה מקדימה / חומרים",
    columns: ["מס׳", "שם חומר", "מקור/יצרן", "שימוש מיועד", "מספר תעודה / אישור", "סטטוס", "תאריך אישור", "הערות"],
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
    buildRows: ({ savedChecklists, savedControlProcesses, savedPreliminary }) => buildMatzeaAConcentrationRows(savedChecklists, savedControlProcesses, savedPreliminary),
  },
  {
    id: "selected-material",
    title: "ריכוז אפיון נברר",
    fileName: "ריכוז אפיון נברר.xlsx",
    description: "אפיון חומר נברר מתוך תעודות/רשימות תיוג רלוונטיות",
    sourceLabel: "רשימות תיוג / תעודות",
    columns: selectedMaterialColumns,
    buildRows: ({ savedChecklists, savedControlProcesses, savedPreliminary }) => buildSelectedMaterialConcentrationRows(savedChecklists, savedControlProcesses, savedPreliminary),
  },
  {
    id: "earthworks-material-results",
    title: "ריכוז תוצאות בדיקות חומרים בעבודות עפר",
    fileName: "ריכוז תוצאות בדיקות חומרים בעבודות עפר.xlsx",
    description: "ריכוז תוצאות תעודות ייחוס לעבודות עפר, שתית וקרקע יסוד מתוך בקרה מקדימה",
    sourceLabel: "בקרה מקדימה / תעודות ייחוס",
    columns: earthworksMaterialResultsColumns,
    buildRows: ({ savedControlProcesses, savedPreliminary }) => buildEarthworksMaterialResultsRows([
      ...savedControlProcesses,
      ...preliminaryReferenceRecords(savedPreliminary),
    ]),
  },
  {
    id: "earthworks",
    title: "בדיקות שדה - עבודות עפר",
    fileName: "בדיקות שדה - עבודות עפר.xlsx",
    description: "ריכוז בדיקות צפיפות/רטיבות שדה לעבודות עפר בלבד: חפירה, קרקע יסוד, מילוי והידוק רגיל/מבוקר. לא כולל מצע א׳.",
    sourceLabel: "רשימות תיוג / עבודות עפר",
    columns: earthworksFieldColumns,
    buildRows: ({ savedChecklists, savedControlProcesses }) => buildEarthworksFieldRows(savedChecklists, savedControlProcesses),
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

const deferredPreviewConcentrationIds = new Set<ConcentrationId>([
  "nonconformances",
  "suppliers",
  "contractors",
  "asphalt",
  "concrete",
  "piles",
  "supervision",
  "materials",
  "trial-sections",
  "density",
  "subbase-a",
  "selected-material",
  "earthworks-material-results",
  "earthworks",
  "rfi",
]);

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

const sparseRowXml = (r: number, cells: Array<[number, unknown, number?]>, height?: number) =>
  `<row r="${r}"${height ? ` ht="${height}" customHeight="1"` : ""}>${cells.map(([c, v, style]) => cell(r, c, v, style ?? 0)).join("")}</row>`;

const rangeCells = (startCol: number, values: unknown[], style = 0): Array<[number, unknown, number]> =>
  values.map((value, index) => [startCol + index, value, style]);


const excelTextLength = (value: unknown) => String(value ?? "").replace(/<[^>]*>/g, "").length;

const excelColumnWidth = (values: unknown[], min = 12, max = 46) => {
  const longest = values.reduce<number>((current, value) => Math.max(current, excelTextLength(value)), 0);
  return Math.max(min, Math.min(max, Math.ceil(longest * 1.15) + 2));
};

const excelRowHeight = (values: unknown[], base = 24, max = 84) => {
  const longest = values.reduce<number>((current, value) => Math.max(current, excelTextLength(value)), 0);
  if (longest <= 22) return base;
  return Math.min(max, base + Math.ceil((longest - 22) / 24) * 14);
};

const colsXmlFromWidths = (widths: number[]) =>
  widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");


const matzeaASpecHeaderRows = [
  ["מס׳ סדורי", "ביצוע ע״י", "מס׳ תעודה", "תאריך", "מקור החומר", "מקום נטילת מדגם לבדיקה", "מקום הפיזור", "", "", "דירוג ( % עובר )", "", "", "", "", "", "", "גבולות פלסטיות וסומך (%)", "", "", "שע״ח (%)", "אגרגט גס", "", "לוס אנג׳לס (%)", "מיון AASHTO", "צפיפות מעבדתית מקסימלית", "רטיבות אופטימלית", "מספר תעודה", "מעמד החומר", "הערות"],
  ["", "", "", "", "", "", "", "", "", "3\"", "1.5\"", "3/4\"", "#4", "#10", "#40", "#200", "LL", "PL", "IP", "", "צפיפות ממשית (ט/מ״ק)", "ספיגות (%)", "", "", "", "", "", "", ""],
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
  "IP",
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
  ["", "QC/QA", "", "", "", "", "", "", "", '3"', '1.5"', '3/4"', "#4", "#10", "#40", "#200", "LL", "PL", "IP", "", "צפיפות ממשית (ט/מ״ק)", "ספיגות (%)", "", "", "", "", "", "", ""],
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
  startCol: number,
): { rows: string[]; nextRow: number; merges: string[] } => {
  let r = 1;
  const rows: string[] = [];
  const merges: string[] = [];
  const h = (offset: number) => colName(startCol + offset - 1);

  // כותרת עליונה אחידה לכל הריכוזים הסטנדרטיים, ממורכזת מעל טווח הטבלה.
  rows.push(emptyRowXml(r++, 14));
  rows.push(rowXmlFromColumn(r++, startCol, [definition.title, "", "", "", "", "", "", ""], 1, 20));
  rows.push(emptyRowXml(r++, 18));
  rows.push(rowXmlFromColumn(r++, startCol, ["שם פרויקט:", "", meta.projectName, "", "", "", "", ""], 2, 20));
  rows.push(rowXmlFromColumn(r++, startCol, ["ניהול פרויקט", "", meta.projectManager || meta.projectManagement, "", "", "", "", ""], 2, 20));
  rows.push(rowXmlFromColumn(r++, startCol, ["שם הקבלן", "", meta.contractor, "", "", "", "", ""], 2, 20));
  rows.push(rowXmlFromColumn(r++, startCol, [`בקרת איכות - ${meta.qualityControl || ""}`, "", "", "", `הבטחת איכות - ${meta.qualityAssurance || ""}`, "", "", ""], 2, 20));
  rows.push(emptyRowXml(r++, 16));
  rows.push(emptyRowXml(r++, 16));

  merges.push(`${h(1)}2:${h(8)}2`);
  merges.push(`${h(1)}4:${h(2)}4`, `${h(3)}4:${h(8)}4`);
  merges.push(`${h(1)}5:${h(2)}5`, `${h(3)}5:${h(8)}5`);
  merges.push(`${h(1)}6:${h(2)}6`, `${h(3)}6:${h(8)}6`);
  merges.push(`${h(1)}7:${h(4)}7`, `${h(5)}7:${h(8)}7`);

  return { rows, nextRow: r, merges };
};

const buildStandardWorksheetXml = (
  definition: ConcentrationDefinition,
  rows: Row[],
  meta: Required<ProjectConcentrationMeta>,
) => {
  // הריכוזים הסטנדרטיים מתחילים בעמודה A, שבגיליון RTL היא העמודה הימנית ביותר.
  const tableStartCol = 1;
  const visibleColumns = definition.columns;
  const maxCol = Math.max(8, visibleColumns.length);
  const headerStartCol = Math.max(1, Math.floor((maxCol - 8) / 2) + 1);
  const header = buildStandardHeaderRows(definition, meta, headerStartCol);
  let r = header.nextRow;
  const sheetRows: string[] = [...header.rows];

  sheetRows.push(rowXmlFromColumn(r++, tableStartCol, visibleColumns, 3, 34));

  if (rows.length) {
    rows.forEach((item) => {
      const values = visibleColumns.map((column) => item[column] ?? "");
      sheetRows.push(rowXmlFromColumn(r++, tableStartCol, values, 6, excelRowHeight(values, 28)));
    });
  } else {
    sheetRows.push(rowXmlFromColumn(r++, tableStartCol, ["אין נתונים שמורים לריכוז זה בפרויקט הנוכחי"], 4, 28));
  }

  const columnWidthValues = Array.from({ length: maxCol }, (_, index) => {
    if (index < visibleColumns.length) {
      const column = visibleColumns[index];
      return [
        column,
        ...rows.map((item) => item[column] ?? ""),
        index === 0 ? definition.title : "",
        index === 2 ? meta.projectName : "",
        index === 4 ? meta.qualityAssurance : "",
      ];
    }

    return [definition.title, meta.projectName, meta.contractor, meta.qualityControl, meta.qualityAssurance];
  });
  const cols = colsXmlFromWidths(columnWidthValues.map((values) => excelColumnWidth(values, 14, 48)));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${sheetRows.join("")}</sheetData>
  <mergeCells count="${header.merges.length}">${header.merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>
</worksheet>`;
};

const buildAsphaltWorksheetXml = (
  definition: ConcentrationDefinition,
  rows: Row[],
  meta: Required<ProjectConcentrationMeta>,
  selectedMix = "",
) => {
  const title = 'דו"ח ריכוז בקרת אספלטים';
  const mixForLayout = normalizeAsphaltMix(firstText(selectedMix, rows[0]?.["סוג תערובת"]));
  const activeSieveColumns =
    mixForLayout === "תא״צ 19" || mixForLayout === "תא״צ 12.5" || mixForLayout === "תא״צ 9.5" || mixForLayout === "SMA"
      ? asphaltSieveColumns.filter((column) => column !== "14 mm" && column !== "8 mm")
      : asphaltSieveColumns;
  const outputColumns = [
    ...asphaltOutputColumns.slice(0, 9),
    ...activeSieveColumns,
    ...asphaltOutputColumns.slice(22),
  ];
  const sieveDeviation = (column: string) => {
    if (['1.5"', '1"', '3/4"'].includes(column)) return "";
    if (['1/2"', '3/8"', "14 mm", "8 mm", "4#"].includes(column)) return "+_5";
    if (["10#", "20#"].includes(column)) return "+_4";
    if (["40#", "80#"].includes(column)) return "+_3";
    if (column === "200#") return "+_1.5";
    return "";
  };
  const topHeader = [
    'ביצוע ע"י QC/QA',
    "מס' רשימת תיוג",
    "מספר מדגם",
    "תאריך",
    "סוג תערובת",
    "קטע פיזור",
    "קטע פיזור",
    "מס' מנה",
    "כמות פיזור יומית",
    ...Array.from({ length: activeSieveColumns.length }, () => "קו דירוג     (% עובר)"),
    "תכולת ביטומן",
    "יחס מלאן -ביטומן",
    "צפיפות\nריפ",
    "צפיפות\nואקום",
    "יציבות",
    "נזילות",
    "חוזק משתייר",
    "אחוז חלל",
    "V.M.A",
    "צפיפות אפקטיבית",
    "התנקזות",
    "שחיקת קנתברו",
    "מבדקה מבצעת",
    "מעמד החומר",
    "מס' תעודה",
    "הערות",
  ];
  const secondHeader = [
    'ביצוע ע"י QC/QA',
    "מס' רשימת תיוג",
    "מספר מדגם",
    "תאריך",
    "סוג תערובת",
    "מחתך",
    "עד חתך",
    "מס' מנה",
    "כמות פיזור יומית",
    ...activeSieveColumns,
    "תכולת ביטומן",
    "יחס מלאן -ביטומן",
    "צפיפות\nריפ",
    "צפיפות\nואקום",
    "יציבות",
    "נזילות",
    "חוזק משתייר",
    "אחוז חלל",
    "(%)",
    "צפיפות אפקטיבית",
    "(%)",
    "(%)",
    "מבדקה מבצעת",
    "מעמד החומר",
    "מס' תעודה",
    "הערות",
  ];
  const deviationHeader = [
    'ביצוע ע"י QC/QA',
    "מס' רשימת תיוג",
    "מספר מדגם",
    "תאריך",
    "סוג תערובת",
    "מחתך",
    "עד חתך",
    "סטייה",
    "סטייה",
    ...activeSieveColumns.map(sieveDeviation),
    "+_0.2/0.3%",
    "+_0.3",
    "",
    "+_50",
    "1800  min",
    "8-16",
    "75% min",
    "+_1%",
    "",
    "",
    "",
    "",
    "מבדקה מבצעת",
    "OK/NC",
    "מס' תעודה",
    "הערות",
  ];
  const headerPad = (values: string[]) => [...values, ...Array.from({ length: Math.max(0, outputColumns.length - values.length) }, () => "")];
  const sheetRows: string[] = [
    emptyRowXml(1, outputColumns.length),
    rowXmlFromColumn(2, 8, [title, "", "", "", "", "", "", ""], 1, 22),
    emptyRowXml(3, outputColumns.length),
    rowXmlFromColumn(4, 8, ["שם פרויקט:", "", meta.projectName, "", "", "", "", ""], 2, 20),
    rowXmlFromColumn(5, 8, ["ניהול פרויקט", "", meta.projectManager || meta.projectManagement, "", "", "", "", ""], 2, 20),
    rowXmlFromColumn(6, 8, ["שם הקבלן", "", meta.contractor, "", "", "", "", ""], 2, 20),
    rowXmlFromColumn(7, 8, [`בקרת איכות- ${meta.qualityControl || ""}`, "", "", "", `הבטחת איכות -${meta.qualityAssurance || ""}`, "", "", ""], 2, 20),
    emptyRowXml(8, outputColumns.length),
    emptyRowXml(9, outputColumns.length),
    rowXml(10, topHeader, 3, 34),
    rowXml(11, secondHeader, 3, 34),
    rowXml(12, deviationHeader, 2, 30),
  ];

  let rowIndex = 13;
  if (rows.length) {
    rows.forEach((item) => {
      sheetRows.push(rowXml(rowIndex++, outputColumns.map((column) => item[column] ?? ""), 6, 26));
    });
  } else {
    sheetRows.push(rowXml(rowIndex++, ["QC", "", "", "", firstText(selectedMix, "תערובת אספלט"), "", "", "←     JMF", "←     JMF", ...Array.from({ length: outputColumns.length - 9 }, () => "")], 6, 26));
  }

  const widths = outputColumns.map((column, index) => index === 4 ? 34 : column === "הערות" ? 22 : activeSieveColumns.includes(column) ? 10 : 12);
  const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const sieveEndCol = colName(9 + activeSieveColumns.length);
  const postStart = 10 + activeSieveColumns.length;
  const merges = [
    "H2:O2",
    "H4:I4", "J4:O4",
    "H5:I5", "J5:O5",
    "H6:I6", "J6:O6",
    "H7:K7", "L7:O7",
    "A10:A12", "B10:B12", "C10:C12", "D10:D12", "E10:E12",
    "F10:G10", "H10:H11", "I10:I11", `J10:${sieveEndCol}10`,
    ...Array.from({ length: outputColumns.length - postStart + 1 }, (_, index) => `${colName(postStart + index)}10:${colName(postStart + index)}12`),
  ];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${sheetRows.join("")}</sheetData>
  <mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>
</worksheet>`;
};

const buildNonconformanceWorksheetXml = (
  definition: ConcentrationDefinition,
  rows: Row[],
  meta: Required<ProjectConcentrationMeta>,
) => {
  const openRows = rows.filter((row) => !includesAny(row["סטטוס"], ["סגור", "נסגר", "closed"]));
  const closedRows = rows.filter((row) => includesAny(row["סטטוס"], ["סגור", "נסגר", "closed"]));
  const grade3Rows = rows.filter((row) => cleanText(row["דרגת אי התאמה"]).includes("3"));
  const grade3OpenRows = openRows.filter((row) => cleanText(row["דרגת אי התאמה"]).includes("3"));
  const grade3ClosedRows = closedRows.filter((row) => cleanText(row["דרגת אי התאמה"]).includes("3"));

  // פריסת כותרת עליונה לפי קובץ הדוגמה: רק בלוקים מוגדרים עם גבולות,
  // ללא צביעה/גבולות על כל העמודות הריקות של הגיליון.
  const sheetRows: string[] = [
    emptyRowXml(1, 16),
    sparseRowXml(2, [
      ...rangeCells(3, ["שם פרויקט:", "", meta.projectName, "", "", "", "", ""], 2),
      ...rangeCells(11, ["תאריך עדכון", "", "", new Date().toLocaleDateString("he-IL"), "", ""], 2),
    ], 20),
    sparseRowXml(3, [
      ...rangeCells(3, ["ניהול פרויקט", "", meta.projectManager || meta.projectManagement, "", "", "", "", ""], 2),
      ...rangeCells(11, ["סה״כ אי התאמות פתוחות", "", openRows.length, "מתוכם דרגה 3", "", grade3OpenRows.length], 2),
      ...rangeCells(18, [definition.title, "", "", "", ""], 1),
    ], 20),
    sparseRowXml(4, [
      ...rangeCells(3, ["שם הקבלן", "", meta.contractor, "", "", "", "", ""], 2),
      ...rangeCells(11, ["סה״כ אי התאמות סגורות", "", closedRows.length, "מתוכם דרגה 3", "", grade3ClosedRows.length], 2),
    ], 20),
    sparseRowXml(5, [
      ...rangeCells(3, ["בקרת איכות", "", meta.qualityControl, "", "", "", "", ""], 2),
      ...rangeCells(11, ["סה״כ אי התאמות", "", rows.length, "מתוכם דרגה 3", "", grade3Rows.length], 2),
    ], 20),
    emptyRowXml(6, 16),
    rowXml(7, [
      "מס'",
      "מס' אי התאמה",
      "מסי אי התאמה בSAP",
      "מס סעיף במפרט",
      "תאריך פתיחת",
      "נפתחה",
      "דרגת אי התאמה",
      "גורם אחראי לליקוי (תכנון, ביצוע, ספק)",
      "קטע (כביש, רמפה, גשר...)",
      "מיקום",
      "",
      "היסט",
      "חלק",
      "אלמנט/ שכבה",
      "תת אלמנט",
      "תאור אי התאמה",
      "טיפול הנדרש",
      "גורם המטפל",
      "תאריך  סגירת אי התאמה משוער-מסוכם",
      "תאריך  סגירה משוער על פי החלטת מנה״פ",
      "שבר",
      "השפעה על איכות",
      "פירוט ביצוע פעולה מתקנת",
      "נסגרה",
      "תאריך  סגירה",
      "אישור מנהל ה״א לסגירת אי התאמה QC",
    ], 3, 34),
    rowXml(8, ["", "", "", "", "", "על ידי QA/QC", "", "", "", "מחתך", "לחתך", "", "מבנה", "", "", "", "", "", "", "", "", "", "", "על ידי QA/QC", "", ""], 3, 24),
  ];

  let r = 9;
  if (rows.length) {
    rows.forEach((item) => {
      sheetRows.push(rowXml(r++, definition.columns.map((column) => item[column] ?? ""), 6, 36));
    });
  } else {
    sheetRows.push(rowXml(r++, ["אין נתונים שמורים לריכוז זה בפרויקט הנוכחי"], 4, 24));
  }

  const widths = [8, 14, 16, 14, 14, 14, 14, 28, 22, 12, 12, 12, 16, 20, 20, 38, 38, 18, 22, 24, 10, 16, 16, 14, 16, 14];
  const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const merges = [
    "C2:D2", "E2:J2", "K2:M2", "N2:P2",
    "C3:D3", "E3:J3", "K3:L3", "N3:O3", "R3:V3",
    "C4:D4", "E4:J4", "K4:L4", "N4:O4",
    "C5:D5", "E5:J5", "K5:L5", "N5:O5",
    "A7:A8", "B7:B8", "C7:C8", "D7:D8", "E7:E8", "G7:G8", "H7:H8", "I7:I8",
    "J7:K7", "L7:L8", "N7:N8", "O7:O8", "P7:P8", "Q7:Q8", "R7:R8", "S7:S8", "T7:T8", "U7:U8", "V7:V8", "W7:W8", "Y7:Y8", "Z7:Z8",
  ];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${sheetRows.join("")}</sheetData>
  <mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>
</worksheet>`;
};

const parseConcentrationDate = (value: unknown): Date | null => {
  const text = cleanText(value);
  if (!text) return null;
  let match = text.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  match = text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return null;
};

const nonconformanceOwner = (row: Row): "QA" | "QC" => {
  const text = normalize([row["נפתחה"], row["פותח/מדווח"], row["נסגרה"], row["אישור מנהל ה״א לסגירת אי התאמה QC"]].join(" "));
  return text.includes("qa") || text.includes("הבטחת") ? "QA" : "QC";
};

const nonconformanceStatusSummary = (rows: Row[]) => {
  const now = new Date();
  const reportMonth = now.getMonth();
  const reportYear = now.getFullYear();
  const ownerRows = (owner: "QA" | "QC") => rows.filter((row) => nonconformanceOwner(row) === owner);
  const isClosedRow = (row: Row) => includesAny(row["סטטוס"], ["סגור", "נסגר", "closed"]) || cleanText(row["תאריך  סגירה"]);
  const isOpenedThisMonth = (row: Row) => {
    const date = parseConcentrationDate(row["תאריך פתיחת"] ?? row["תאריך פתיחה"]);
    return Boolean(date && date.getMonth() === reportMonth && date.getFullYear() === reportYear);
  };
  const isGrade = (row: Row, grade: number) => cleanText(row["דרגת אי התאמה"]).includes(String(grade));
  const count = (items: Row[], predicate: (row: Row) => boolean) => items.filter(predicate).length;
  const byOwner = (items: Row[]) => ({
    QC: items.filter((row) => nonconformanceOwner(row) === "QC").length,
    QA: items.filter((row) => nonconformanceOwner(row) === "QA").length,
  });
  const openRows = rows.filter((row) => !isClosedRow(row));
  const closedRows = rows.filter(isClosedRow);
  const monthRows = rows.filter(isOpenedThisMonth);
  const gradeRows = (grade: number) => rows.filter((row) => isGrade(row, grade));
  return {
    openedProject: byOwner(rows),
    openedMonth: byOwner(monthRows),
    open: byOwner(openRows),
    grades: [1, 2, 3].map((grade) => ({
      grade,
      total: byOwner(gradeRows(grade)),
      open: byOwner(openRows.filter((row) => isGrade(row, grade))),
      closed: byOwner(closedRows.filter((row) => isGrade(row, grade))),
    })),
    totals: {
      QC: ownerRows("QC").length,
      QA: ownerRows("QA").length,
      openQC: count(ownerRows("QC"), (row) => !isClosedRow(row)),
      openQA: count(ownerRows("QA"), (row) => !isClosedRow(row)),
      closedQC: count(ownerRows("QC"), isClosedRow),
      closedQA: count(ownerRows("QA"), isClosedRow),
    },
  };
};

const buildNonconformanceStatusWorksheetXml = (
  rows: Row[],
  meta: Required<ProjectConcentrationMeta>,
) => {
  const summary = nonconformanceStatusSummary(rows);
  const totalPair = (pair: { QC: number; QA: number }) => pair.QC + pair.QA;
  const sheetRows: string[] = [
    emptyRowXml(1, 18),
    sparseRowXml(2, [
      ...rangeCells(3, ["סטטוס אי התאמות לפרויקט", "", "", "", "", "", ""], 1),
    ], 26),
    sparseRowXml(3, [
      ...rangeCells(3, ["שם פרויקט", meta.projectName, "", "תאריך עדכון", new Date().toLocaleDateString("he-IL")], 2),
    ], 22),
    emptyRowXml(4, 16),
    sparseRowXml(5, [
      ...rangeCells(3, ["נפתחו מתחילת הפרויקט", "", ""], 2),
      ...rangeCells(7, ["אי התאמות שנפתחו בחודש הדיווח", "", ""], 2),
      ...rangeCells(11, ["אי התאמות שטרם נסגרו", "", ""], 2),
      ...rangeCells(15, ["פירוט דרגה", "", "", ""], 2),
    ], 26),
    sparseRowXml(6, [
      ...rangeCells(3, ["QA", "QC", "סה״כ"], 3),
      ...rangeCells(7, ["QA", "QC", "סה״כ"], 3),
      ...rangeCells(11, ["QA", "QC", "סה״כ"], 3),
      ...rangeCells(15, ["דרגה", "QA", "QC", "סה״כ"], 3),
    ], 24),
    sparseRowXml(7, [
      ...rangeCells(3, [summary.openedProject.QA, summary.openedProject.QC, totalPair(summary.openedProject)], 6),
      ...rangeCells(7, [summary.openedMonth.QA, summary.openedMonth.QC, totalPair(summary.openedMonth)], 6),
      ...rangeCells(11, [summary.open.QA, summary.open.QC, totalPair(summary.open)], 6),
      ...rangeCells(15, ["סה״כ בקרה/הבטחה", summary.totals.QA, summary.totals.QC, summary.totals.QA + summary.totals.QC], 6),
    ], 24),
    emptyRowXml(8, 14),
    sparseRowXml(9, [
      ...rangeCells(3, ["דרגה", "QA", "QC", "סה״כ"], 3),
      ...rangeCells(7, ["דרגה", "QA", "QC", "סה״כ"], 3),
      ...rangeCells(11, ["דרגה", "QA", "QC", "סה״כ"], 3),
      ...rangeCells(15, ["סיכום", "QA", "QC", "סה״כ"], 3),
    ], 24),
    ...summary.grades.map((item, index) =>
      sparseRowXml(10 + index, [
        ...rangeCells(3, [`דרגה ${item.grade}`, item.open.QA, item.open.QC, totalPair(item.open)], 6),
        ...rangeCells(7, [`דרגה ${item.grade}`, item.closed.QA, item.closed.QC, totalPair(item.closed)], 6),
        ...rangeCells(11, [`דרגה ${item.grade}`, item.total.QA, item.total.QC, totalPair(item.total)], 6),
        ...rangeCells(15, [`סה״כ דרגה ${item.grade}`, item.total.QA, item.total.QC, totalPair(item.total)], 6),
      ], 24),
    ),
    sparseRowXml(13, [
      ...rangeCells(3, ["סה״כ פתוחות", summary.totals.openQA, summary.totals.openQC, summary.totals.openQA + summary.totals.openQC], 2),
      ...rangeCells(7, ["סה״כ סגורות", summary.totals.closedQA, summary.totals.closedQC, summary.totals.closedQA + summary.totals.closedQC], 2),
      ...rangeCells(11, ["סה״כ אי התאמות", summary.totals.QA, summary.totals.QC, summary.totals.QA + summary.totals.QC], 2),
      ...rangeCells(15, ["סה״כ דרגה 3 בקרה + הבטחה", summary.grades[2]?.total.QA ?? 0, summary.grades[2]?.total.QC ?? 0, totalPair(summary.grades[2]?.total ?? { QA: 0, QC: 0 })], 2),
    ], 30),
  ];
  const widths = [4, 4, 18, 10, 10, 10, 4, 22, 10, 10, 10, 4, 18, 10, 10, 10, 14, 10, 10, 10];
  const merges = ["C2:I2", "C5:E5", "G5:I5", "K5:M5", "O5:R5"];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>
  <cols>${colsXmlFromWidths(widths)}</cols>
  <sheetData>${sheetRows.join("")}</sheetData>
  <mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>
</worksheet>`;
};


const earthworksNetiveiTopHeader = [
  'ביצוע ע"י ',
  "מס' סדורי",
  'רשימת תיוג',
  'תאריך הבדיקה',
  'כביש\\ציר \\רמפה',
  'מחתך',
  'עד חתך',
  'צד',
  'מקום נטילה',
  'שטח ',
  "שכבה מס'",
  'עובי השכבה',
  'סוג העבודה ',
  'תאור החומר ',
  'מיון החומר ',
  'מקור החומר',
  "מס' תעודת בדיקההידוק רגיל",
  'מעברי מכבש',
  'מעמד',
  "מס' תעודת בדיקה צפיפות/ רטיבות שדה",
  'הידוק מבוקר (צפיפות מד גרעיני)',
  'מעמד',
  ' מנת בדיקה (חרוט חול / שלבי)',
  'מעמד',
  'מדידה',
  'מעמד',
  'מספר תעודת בדיקה אפיון - 100%',
  'HWD',
  'מעמד',
  'תוצאות בדיקה',
  '',
  '',
  '',
  '',
  'בדיקה חוזרת לתעודה ',
  'מתאריך',
  'מספר אי התאמה',
  'הערות',
];

const earthworksNetiveiSecondHeader = [
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
  'צפיפות מחושבת',
  'צפיפות סטטיסטיקה',
  '',
  '',
  'מעמד',
  '', '', '', '',
];

const earthworksNetiveiThirdHeader = [
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
  '',
  'גבול תחתון',
  'גבול עליון',
  'ממוצע',
  '',
  '', '', '', '',
];

const earthworksNetiveiUnitsHeader = [
  'QC/QA',
  "מס'",
  "מס'",
  'תאריך ',
  "מס'",
  "מס'",
  "מס'",
  '',
  '',
  'מ"ר',
  "מס'",
  'ס"מ',
  'קרקע יסוד, מילוי, חפירה',
  '',
  'AASHTO',
  '',
  '',
  'כמות  מעברי מכבש',
  'OK / NC',
  "מס' תעודה",
  'כמות נקודות בדיקה',
  'OK / NC',
  'כמות נקודות בדיקה ',
  'OK / NC',
  'כמות  (1,2,3...)',
  'OK / NC',
  "מס' תעודה",
  "מס' תעודה",
  'OK / NC',
  ' (קג/מ"ק)',
  ' (%)',
  ' (%)',
  ' (%)',
  'OK / NC',
  "מס' תעודה NC",
  'תאריך תעודה NC',
  '',
  '',
];

const earthworksNetiveiOutputColumns = earthworksFieldColumns;

const buildEarthworksWorksheetXml = (
  definition: ConcentrationDefinition,
  rows: Row[],
  meta: Required<ProjectConcentrationMeta>,
) => {
  const sheetRows: string[] = [
    emptyRowXml(1, 14),
    rowXmlFromColumn(2, 8, ['בדיקות  שדה - עבודות עפר', '', '', '', '', '', '', '', '', '', '', ''], 1, 22),
    rowXmlFromColumn(3, 8, ['שם פרויקט:', '', meta.projectName, '', '', '', 'שם הקבלן', '', meta.contractor, '', '', ''], 2, 20),
    rowXmlFromColumn(4, 8, ['ניהול פרויקט', '', meta.projectManager || meta.projectManagement, '', '', '', 'בקרת איכות', '', meta.qualityControl, '', '', ''], 2, 20),
    rowXmlFromColumn(5, 8, ['הבטחת איכות', '', meta.qualityAssurance, '', '', '', '', '', '', '', '', ''], 2, 20),
    rowXml(6, earthworksNetiveiTopHeader, 3, 42),
    rowXml(7, earthworksNetiveiSecondHeader, 4, 24),
    rowXml(8, earthworksNetiveiThirdHeader, 4, 24),
    rowXml(9, earthworksNetiveiUnitsHeader, 3, 34),
  ];

  let r = 10;
  if (rows.length) {
    rows.forEach((item) => {
      sheetRows.push(rowXml(r++, earthworksNetiveiOutputColumns.map((column) => item[column] ?? ''), 6, 26));
    });
  } else {
    sheetRows.push(rowXml(r++, ['אין שורות עם תעודות מעבדה מצורפות ברשימות התיוג לעבודות עפר', ...Array.from({ length: earthworksNetiveiOutputColumns.length - 1 }, () => '')], 4, 24));
  }

  const widths = [12, 10, 12, 14, 16, 10, 10, 9, 18, 10, 11, 12, 18, 18, 16, 16, 20, 13, 11, 22, 18, 11, 20, 11, 13, 11, 24, 12, 11, 16, 14, 14, 14, 11, 20, 14, 16, 30];
  const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('');
  const merges = [
    'H2:S2',
    'H3:I3', 'J3:M3', 'N3:O3', 'P3:S3',
    'H4:I4', 'J4:M4', 'N4:O4', 'P4:S4',
    'H5:I5', 'J5:M5',
    'A6:A8', 'B6:B8', 'C6:C8', 'D6:D8', 'E6:E8', 'F6:F8', 'G6:G8', 'H6:H8', 'I6:I8', 'J6:J8', 'K6:K8', 'L6:L8', 'M6:M8', 'N6:N8', 'O6:O8', 'P6:P8',
    'Q6:Q8', 'R6:R8', 'S6:S8', 'T6:T8', 'U6:U8', 'V6:V8', 'W6:W8', 'X6:X8', 'Y6:Y8', 'Z6:Z8', 'AA6:AA8', 'AB6:AB8', 'AC6:AC8',
    'AD6:AH6', 'AD7:AD8', 'AE7:AG7', 'AH7:AH8',
    'AI6:AI8', 'AJ6:AJ8', 'AK6:AK8', 'AL6:AL8',
  ];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${sheetRows.join('')}</sheetData>
  <mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>
</worksheet>`;
};

const subbaseFieldTopHeader = [
  'ביצוע ע"י ',
  "מס' סדורי",
  'רשימת תיוג',
  'תאריך הבדיקה',
  'כביש \\ ציר  \\ רמפה',
  'מחתך',
  'עד חתך',
  'צד',
  'מקום נטילה',
  'שטח ',
  "שכבה מס'",
  'עובי השכבה',
  'סוג העבודה ',
  'תאור החומר ',
  'מיון החומר ',
  'מקור החומר',
  'הידוק רגיל ',
  'מעמד',
  "מס' תעודת בדיקה צפיפות/ רטיבות שדה",
  'הידוק מבוקר (צפיפות מד גרעיני)',
  'מעמד',
  ' מנת בדיקה (חרוט חול / שלבי)',
  'מעמד',
  'מדידה',
  'מעמד',
  'מספר תעודת בדיקת אפיון - 100%',
  'HWD',
  'מעמד',
  'תוצאות בדיקה',
  'תוצאות בדיקה',
  'תוצאות בדיקה',
  'תוצאות בדיקה',
  'תוצאות בדיקה',
  "בדיקה חוזרת לתעודה מס'",
  'מתאריך',
  'מספר אי התאמה',
  '',
];

const subbaseFieldSecondHeader = [
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
  'צפיפות מחושבת',
  'צפיפות סטטיסטיקה',
  'צפיפות סטטיסטיקה',
  'צפיפות סטטיסטיקה',
  'מעמד',
  '', '', '', '',
];

const subbaseFieldThirdHeader = [
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
  'צפיפות מחושבת',
  'גבול תחתון',
  'גבול עליון ',
  'ממוצע',
  'מעמד',
  '', '', '', '',
];

const subbaseFieldUnitsHeader = [
  'QC/QA',
  "מס'",
  "מס'",
  'תאריך ',
  "מס'",
  "מס'",
  "מס'",
  '',
  '',
  "מס'",
  'ס"מ',
  'קרקע יסוד, מילוי, חפירה',
  '',
  'AASHTO',
  '',
  '',
  'כמות  מעברי מכבש',
  'OK / NC',
  "מס' תעודה",
  'כמות נקודות בדיקה',
  'OK / NC',
  'כמות נקודות בדיקה ',
  'OK / NC',
  'כמות  (1,2,3...)',
  'OK / NC',
  "מס' תעודה",
  "מס' תעודה",
  "מס' תעודה",
  'OK / NC',
  ' (%)',
  ' (%)',
  ' (%)',
  'OK/NC',
  "מס' תעודה",
  'תאריך תעודה NC',
  '',
  '',
];

const buildSubbaseFieldWorksheetXml = (
  definition: ConcentrationDefinition,
  rows: Row[],
  meta: Required<ProjectConcentrationMeta>,
) => {
  const sheetRows: string[] = [
    emptyRowXml(1, 14),
    sparseRowXml(2, [
      ...rangeCells(3, ['שם פרויקט:', '', meta.projectName, '', '', ''], 2),
    ], 20),
    sparseRowXml(3, [
      ...rangeCells(3, ['ניהול פרויקט', '', meta.projectManager || meta.projectManagement, '', '', ''], 2),
      ...rangeCells(12, ['בדיקות  מצע', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''], 1),
    ], 22),
    sparseRowXml(4, [
      ...rangeCells(3, ['שם הקבלן', '', meta.contractor, '', '', ''], 2),
      ...rangeCells(12, ['בדיקות  מצע', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''], 1),
    ], 20),
    sparseRowXml(5, [
      ...rangeCells(3, [`בקרת איכות- ${meta.qualityControl || ''}`, '', '', ''], 2),
      ...rangeCells(7, [`הבטחת איכות -${meta.qualityAssurance || ''}`, '', '', ''], 2),
    ], 20),
    rowXml(6, subbaseFieldTopHeader, 3, 42),
    rowXml(7, subbaseFieldSecondHeader, 4, 24),
    rowXml(8, subbaseFieldThirdHeader, 4, 24),
    rowXml(9, subbaseFieldUnitsHeader, 3, 34),
  ];

  let r = 10;
  if (rows.length) {
    rows.forEach((item) => {
      sheetRows.push(rowXml(r++, subbaseFieldColumns.map((column) => item[column] ?? ''), 6, 26));
    });
  } else {
    sheetRows.push(rowXml(r++, ['אין שורות עם תעודות מעבדה מצורפות ברשימות התיוג לפיזור מצעים', ...Array.from({ length: subbaseFieldColumns.length - 1 }, () => '')], 4, 24));
  }

  const widths = [12, 10, 12, 14, 16, 10, 10, 9, 18, 10, 11, 12, 18, 18, 16, 16, 14, 11, 22, 18, 11, 20, 11, 13, 11, 24, 12, 11, 16, 14, 14, 14, 11, 20, 14, 16, 24];
  const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('');
  const merges = [
    'C2:D2', 'E2:J2',
    'C3:D3', 'E3:J3', 'L3:AA4',
    'C4:D4', 'E4:J4',
    'C5:F5', 'G5:J5',
    'A6:A8', 'B6:B8', 'C6:C8', 'D6:D8', 'E6:E8', 'F6:F8', 'G6:G8', 'H6:H8', 'I6:I8', 'J6:J8', 'K6:K8', 'L6:L8', 'M6:M8', 'N6:N8', 'O6:O8', 'P6:P8',
    'Q6:Q8', 'R6:R8', 'S6:S8', 'T6:T8', 'U6:U8', 'V6:V8', 'W6:W8', 'X6:X8', 'Y6:Y8', 'Z6:Z8', 'AA6:AA8', 'AB6:AB8',
    'AC6:AG6', 'AC7:AC8', 'AD7:AF7', 'AG7:AG8',
    'AH6:AH8', 'AI6:AI8', 'AJ6:AJ8', 'AK6:AK8',
  ];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${sheetRows.join('')}</sheetData>
  <mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>
</worksheet>`;
};

const buildEarthworksMaterialResultsWorksheetXml = (
  definition: ConcentrationDefinition,
  rows: Row[],
  meta: Required<ProjectConcentrationMeta>,
) => {
  const topHeader = earthworksMaterialResultsColumns;
  const sizeHeader = [
    "", "", "", "", "", "", "", "", "", "", "",
    "75.0mm", "37.0mm", "25.0mm", "19.0mm", "4.75mm", "2.00mm", "0.425mm", "0.075mm",
    "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
  ];
  const unitsHeader = [
    "", "", "", "", "", "", "", "", "", "", "",
    "%", "%", "%", "%", "%", "%", "%", "%", "%", "%", "%", "AASHTO",
    'קג/מ"ק', "%", 'קג/מ"ק', "%", "%", 'קג/מ"ק', "%", "%", "%", "OK/NC", "",
  ];
  const sheetRows: string[] = [
    emptyRowXml(1, 14),
    rowXmlFromColumn(2, 8, [definition.title, "", "", "", "", "", "", "", "", "", "", ""], 1, 22),
    emptyRowXml(3, 18),
    rowXmlFromColumn(4, 8, ["שם הקבלן", "", "", meta.contractor, "", "", "שם פרויקט", "", "", meta.projectName, "", ""], 2, 20),
    rowXmlFromColumn(5, 8, ["חברת ניהול", "", "", meta.projectManager || meta.projectManagement, "", "", "חוזה מס'", "", "", "", "", ""], 2, 20),
    rowXmlFromColumn(6, 8, ["חברת בקרת איכות", "", "", meta.qualityControl, "", "", "חברת הבטחת איכות", "", "", meta.qualityAssurance, "", ""], 2, 20),
    emptyRowXml(7, 16),
    rowXml(8, topHeader, 3, 38),
    rowXml(9, sizeHeader, 4, 22),
    rowXml(10, unitsHeader, 3, 24),
  ];

  const dataRows = rows.length
    ? rows.map((item) => earthworksMaterialResultsColumns.map((column) => item[column] ?? ""))
    : Array.from({ length: 20 }, () => Array.from({ length: earthworksMaterialResultsColumns.length }, () => ""));

  dataRows.forEach((values, index) => {
    sheetRows.push(rowXml(11 + index, values, 6, 24));
  });

  const widths = [14, 12, 16, 22, 14, 14, 18, 10, 10, 10, 18, 10, 10, 10, 10, 10, 10, 10, 10, 9, 9, 9, 14, 18, 16, 15, 15, 14, 15, 15, 14, 14, 14, 24];
  const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const merges = [
    "H2:S2",
    "H4:J4", "K4:M4", "N4:P4", "Q4:S4",
    "H5:J5", "K5:M5", "N5:P5", "Q5:S5",
    "H6:J6", "K6:M6", "N6:P6", "Q6:S6",
    "A8:A10", "B8:B10", "C8:C10", "D8:D10", "E8:E10", "F8:F10", "G8:G10", "H8:H10", "I8:I10", "J8:J10", "K8:K10",
    "T8:T9", "U8:U9", "V8:V9", "W8:W9", "X8:X9", "Y8:Y9", "Z8:Z9", "AA8:AA9", "AB8:AB9", "AC8:AC9", "AD8:AD9", "AE8:AE9", "AF8:AF9", "AG8:AG9",
    "AH8:AH10",
  ];

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${sheetRows.join("")}</sheetData>
  <mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>
</worksheet>`;
};

const buildConcreteWorksheetXml = (
  definition: ConcentrationDefinition,
  rows: Row[],
  meta: Required<ProjectConcentrationMeta>,
) => {
  let r = 1;
  const sheetRows: string[] = [];
  const widthCount = concreteOutputColumns.length;
  const headerRows = [
    [
      'ביצוע ע"י QC/QA',
      "מס׳ סדורי",
      "תאריך יציקה",
      "מבנה",
      "אלמנט",
      "מקום נטילה",
      "מיקום",
      "",
      "",
      "תעודה מס׳",
      "מקור בטון",
      "סוג בטון",
      'כמות בטון ביציקה (מ"ק)',
      "סומך",
      "",
      "סוג אשפרה",
      "חוזק לחיצה",
      "",
      "",
      "גלילים מבטון קשוי",
      "",
      "",
      "",
      "הערות",
    ],
    [
      "",
      "",
      "",
      "",
      "",
      "",
      "מחתך",
      "עד חתך",
      "צד",
      "",
      "",
      "",
      "",
      "דרישה",
      "תוצאה",
      "",
      "7 ימים",
      "28 ימים",
      "מעמד הבטון",
      "תאריך נטילה",
      "מס׳ תעודה",
      "חוזק הבטון",
      "מעמד הבטון",
      "",
    ],
  ];

  sheetRows.push(
    rowXmlFromColumn(
      r++,
      8,
      ["ריכוז בטון", "", "", "", "", "", "", "", "", "", ""],
      1,
      24,
    ),
  );
  sheetRows.push(
    rowXmlFromColumn(
      r++,
      10,
      ["שם פרויקט:", "", meta.projectName, "", "", "", "", "", ""],
      2,
      20,
    ),
  );
  sheetRows.push(
    rowXmlFromColumn(
      r++,
      10,
      ["ניהול פרויקט", "", meta.projectManager || meta.projectManagement, "", "", "", "", "", ""],
      2,
      20,
    ),
  );
  sheetRows.push(
    rowXmlFromColumn(
      r++,
      10,
      ["שם הקבלן", "", meta.contractor, "", "", "", "", "", ""],
      2,
      20,
    ),
  );
  sheetRows.push(
    rowXmlFromColumn(
      r++,
      10,
      [
        `בקרת איכות - ${meta.qualityControl || ""}`,
        "",
        "",
        "",
        `הבטחת איכות - ${meta.qualityAssurance || ""}`,
        "",
        "",
        "",
        "",
      ],
      2,
      20,
    ),
  );
  sheetRows.push(emptyRowXml(r++, 18));
  sheetRows.push(emptyRowXml(r++, 18));
  headerRows.forEach((values) => sheetRows.push(rowXml(r++, values, 3, 30)));
  sheetRows.push(emptyRowXml(r++, 8));

  if (rows.length) {
    rows.forEach((item) =>
      sheetRows.push(
        rowXml(
          r++,
          concreteOutputColumns.map((column) => item[column] ?? ""),
          6,
          24,
        ),
      ),
    );
  } else {
    sheetRows.push(
      rowXml(
        r++,
        [
          "אין נתונים שמורים לריכוז זה בפרויקט הנוכחי",
          ...Array.from({ length: widthCount - 1 }, () => ""),
        ],
        4,
        24,
      ),
    );
  }

  const cols = Array.from(
    { length: widthCount },
    (_, index) =>
      `<col min="${index + 1}" max="${index + 1}" width="${
        index === 4 ? 28 : index === 23 ? 24 : index >= 6 && index <= 8 ? 12 : 16
      }" customWidth="1"/>`,
  ).join("");
  const mergeRefs = [
    "H1:R1",
    "J2:K2",
    "L2:R2",
    "J3:K3",
    "L3:R3",
    "J4:K4",
    "L4:R4",
    "J5:M5",
    "N5:R5",
    "A8:A9",
    "B8:B9",
    "C8:C9",
    "D8:D9",
    "E8:E9",
    "F8:F9",
    "G8:I8",
    "J8:J9",
    "K8:K9",
    "L8:L9",
    "M8:M9",
    "N8:O8",
    "P8:P9",
    "Q8:S8",
    "T8:W8",
    "X8:X9",
  ];

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${sheetRows.join("")}</sheetData>
  <mergeCells count="${mergeRefs.length}">${mergeRefs.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>
</worksheet>`;
};

const buildPileWorksheetXml = (
  definition: ConcentrationDefinition,
  rows: Row[],
  meta: Required<ProjectConcentrationMeta>,
) => {
  let r = 1;
  const sheetRows: string[] = [];
  const widthCount = pileOutputColumns.length;
  const headerRows = [
    [
      'ביצוע בדיקות ע"י QC/QA',
      "מס׳ סדורי",
      "מס׳ רשימת תיוג",
      "מבנה",
      "תת אלמנט / מס׳ כלונס",
      "תאריך קדיחה",
      "קוטר כלונס ס״מ",
      "עומק הכלונס המתוכנן",
      "עומק הכלונס בפועל",
      "נפח יציקה מתוכנן",
      "נפח יציקה בפועל",
      "בדיקת בנטוניט",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "תאריך יציקה",
      "מקור בטון",
      "סוג בטון",
      "בדיקת סומך",
      "",
      "",
      "בדיקת חוזק לחיצה",
      "",
      "",
      "",
      "בדיקות אל־הרס – סוניות",
      "",
      "",
      "בדיקות אל־הרס – אולטרה־סוניות",
      "",
      "",
      "תאריך As-Made",
      "הערות",
      "סטטוס",
      "מספר יומן כלונסאות",
    ],
    [
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "מספר מנה בבדיקה",
      "צפיפות במיכל",
      "הפרשת מים",
      "PH",
      "צמיגות",
      "צפיפות בתחתית הבור",
      "אחוז חול במיכל",
      "אחוז חול בתחתית הבור",
      "מס׳ תעודת בדיקת בנטוניט",
      "",
      "",
      "",
      "דרישה",
      "תוצאה",
      "מס׳ תעודת בדיקת סומך",
      "מס׳ תעודת בדיקת חוזק לחיצה",
      "7 ימים",
      "28 ימים",
      "מעמד הבטון",
      "תאריך בדיקה",
      "מס׳ תעודה",
      "מעמד",
      "תאריך בדיקה",
      "מס׳ תעודה",
      "מעמד",
      "",
      "",
      "",
      "",
    ],
  ];

  sheetRows.push(
    rowXmlFromColumn(
      r++,
      16,
      ["ריכוז כלונסאות", "", "", "", "", "", "", "", ""],
      1,
      24,
    ),
  );
  sheetRows.push(emptyRowXml(r++, 10));
  sheetRows.push(
    rowXmlFromColumn(
      r++,
      16,
      ["שם הקבלן", "", meta.contractor, "", "שם פרויקט", "", meta.projectName],
      2,
      22,
    ),
  );
  sheetRows.push(
    rowXmlFromColumn(
      r++,
      16,
      [
        "חברת ניהול",
        "",
        meta.projectManager || meta.projectManagement,
        "",
        "חוזה מס׳",
        "",
        "",
      ],
      2,
      22,
    ),
  );
  sheetRows.push(
    rowXmlFromColumn(
      r++,
      16,
      [
        "חברת בקרת איכות",
        "",
        meta.qualityControl,
        "",
        "חברת הבטחת איכות",
        "",
        meta.qualityAssurance,
      ],
      2,
      22,
    ),
  );
  sheetRows.push(emptyRowXml(r++, 10));
  headerRows.forEach((values) => sheetRows.push(rowXml(r++, values, 3, 34)));

  if (rows.length) {
    rows.forEach((item) =>
      sheetRows.push(
        rowXml(
          r++,
          pileOutputColumns.map((column) => item[column] ?? ""),
          6,
          28,
        ),
      ),
    );
  } else {
    sheetRows.push(
      rowXml(
        r++,
        [
          "אין עדיין רשימות תיוג כלונסאות שמורות בפרויקט הנוכחי",
          ...Array.from({ length: widthCount - 1 }, () => ""),
        ],
        4,
        28,
      ),
    );
  }

  const cols = Array.from(
    { length: widthCount },
    (_, index) =>
      `<col min="${index + 1}" max="${index + 1}" width="${
        [3, 4, 21, 22, 37].includes(index)
          ? 24
          : index === 38
            ? 16
            : 13
      }" customWidth="1"/>`,
  ).join("");
  const mergeRefs = [
    "P1:X1",
    "P3:Q3",
    "R3:S3",
    "T3:U3",
    "V3:W3",
    "P4:Q4",
    "R4:S4",
    "T4:U4",
    "V4:W4",
    "P5:Q5",
    "R5:S5",
    "T5:U5",
    "V5:W5",
    "A7:A8",
    "B7:B8",
    "C7:C8",
    "D7:D8",
    "E7:E8",
    "F7:F8",
    "G7:G8",
    "H7:H8",
    "I7:I8",
    "J7:J8",
    "K7:K8",
    "L7:T7",
    "U7:U8",
    "V7:V8",
    "W7:W8",
    "X7:Z7",
    "AA7:AD7",
    "AE7:AG7",
    "AH7:AJ7",
    "AK7:AK8",
    "AL7:AL8",
    "AM7:AM8",
    "AN7:AN8",
  ];

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0" rightToLeft="1"><pane ySplit="8" topLeftCell="A9" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${sheetRows.join("")}</sheetData>
  <autoFilter ref="A7:AN${Math.max(8, r - 1)}"/>
  <mergeCells count="${mergeRefs.length}">${mergeRefs.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>
</worksheet>`;
};

const buildWorksheetXml = (
  definition: ConcentrationDefinition,
  rows: Row[],
  meta: Required<ProjectConcentrationMeta>,
  selectedMix = "",
) => {
  if (definition.id === "asphalt") return buildAsphaltWorksheetXml(definition, rows, meta, selectedMix);
  if (definition.id === "nonconformances") return buildNonconformanceWorksheetXml(definition, rows, meta);
  if (definition.id === "subbase-a") return buildMatzeaAWorksheetXml(definition, rows, meta);
  if (definition.id === "selected-material") return buildSelectedMaterialWorksheetXml(definition, rows, meta);
  if (definition.id === "earthworks-material-results") return buildEarthworksMaterialResultsWorksheetXml(definition, rows, meta);
  if (definition.id === "density") return buildSubbaseFieldWorksheetXml(definition, rows, meta);
  if (definition.id === "concrete") return buildConcreteWorksheetXml(definition, rows, meta);
  if (definition.id === "piles") return buildPileWorksheetXml(definition, rows, meta);
  if (definition.id === "earthworks") return buildEarthworksWorksheetXml(definition, rows, meta);
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

const buildWorkbookBlob = async (definition: ConcentrationDefinition, rows: Row[], meta: Required<ProjectConcentrationMeta>, selectedMix = "") => {
  const zip = new JSZip();
  const addNonconformanceStatusSheet = definition.id === "nonconformances";
  const sheet2ContentType = addNonconformanceStatusSheet
    ? `<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    : "";
  const sheet2WorkbookEntry = addNonconformanceStatusSheet
    ? `<sheet name="סטטוס אי התאמות" sheetId="2" r:id="rId2"/>`
    : "";
  const workbookRelationships = addNonconformanceStatusSheet
    ? `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
    : `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>${sheet2ContentType}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
  zip.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
  zip.folder("docProps")?.file("core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(definition.title)}</dc:title><dc:creator>מערכת בקרת איכות</dc:creator></cp:coreProperties>`);
  zip.folder("docProps")?.file("app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>ControlEng Prime</Application></Properties>`);
  zip.folder("xl")?.file("workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="${xmlEscape(definition.title).slice(0, 31)}" sheetId="1" r:id="rId1"/>${sheet2WorkbookEntry}</sheets><calcPr calcMode="auto"/></workbook>`);
  zip.folder("xl")?.folder("_rels")?.file("workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRelationships}</Relationships>`);
  zip.folder("xl")?.folder("worksheets")?.file("sheet1.xml", buildWorksheetXml(definition, rows, meta, selectedMix));
  if (addNonconformanceStatusSheet) {
    zip.folder("xl")?.folder("worksheets")?.file("sheet2.xml", buildNonconformanceStatusWorksheetXml(rows, meta));
  }
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

export function ConcentrationsSection({ savedChecklists = [], savedNonconformances = [], savedTrialSections = [], savedPreliminary = [], savedRfis = [], savedControlProcesses = [], savedSupervisionReports = [], currentProjectName = "", projectMeta, onImportSoilSurvey }: Props) {
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<ConcentrationId[]>([]);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [openId, setOpenId] = useState<ConcentrationId | null>(null);
  const [soilSurveyImporting, setSoilSurveyImporting] = useState(false);
  const [asphaltMixPicker, setAsphaltMixPicker] = useState<{
    selectedMixes: string[];
    onSelect: (mixes: string[]) => void;
  } | null>(null);
  const soilSurveyInputRef = useRef<HTMLInputElement | null>(null);

  const meta = useMemo(() => buildProjectMeta(currentProjectName, projectMeta), [currentProjectName, projectMeta]);
  const ctx: BuildContext = useMemo(() => ({ savedChecklists, savedNonconformances, savedTrialSections, savedPreliminary, savedRfis, savedControlProcesses, savedSupervisionReports, projectMeta: meta }), [savedChecklists, savedNonconformances, savedTrialSections, savedPreliminary, savedRfis, savedControlProcesses, savedSupervisionReports, meta]);

  const rowsById = useMemo(() => {
    const result: Record<string, Row[]> = {};
    definitions.forEach((definition) => {
      if (deferredPreviewConcentrationIds.has(definition.id)) return;
      try {
        result[definition.id] = normalizeConcentrationRows(definition, definition.buildRows(ctx));
      } catch (error) {
        console.error(`Failed building concentration ${definition.id}`, error);
        result[definition.id] = [];
      }
    });
    return result;
  }, [ctx]);

  const buildRowsForDefinition = (definition: ConcentrationDefinition, selectedMix = ""): Row[] => {
    const rows =
      definition.id === "asphalt"
        ? buildAsphaltConcentrationRows(ctx, selectedMix)
        : definition.buildRows(ctx);
    return normalizeConcentrationRows(definition, rows);
  };

  const visibleDefinitions = useMemo(() => {
    const q = normalize(search);
    return definitions.filter((definition) => !q || normalize(`${definition.title} ${definition.description}`).includes(q));
  }, [search]);
  const visibleIds = visibleDefinitions.map((definition) => definition.id);
  const allVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) => selectedIds.includes(id));
  const toggleSelected = (id: ConcentrationId) =>
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  const toggleAllVisible = () =>
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    );

  const pickAsphaltMix = () =>
    new Promise<string[]>((resolve) => {
      setAsphaltMixPicker({ selectedMixes: ["תא״צ 19"], onSelect: resolve });
    });

  const exportOne = async (definition: ConcentrationDefinition) => {
    setBusyId(definition.id);
    try {
      let selectedMix = "";
      let rows: Row[] = [];
      let fileName = definition.fileName;
      if (definition.id === "asphalt") {
        const selectedMixes = (await pickAsphaltMix())
          .map((mix) => normalizeAsphaltMix(mix) || mix)
          .filter(Boolean);
        if (!selectedMixes.length) return;
        selectedMix = selectedMixes.join(" + ");
        rows = selectedMixes.flatMap((mix) => buildRowsForDefinition(definition, mix));
        fileName = `ריכוז בדיקות אספלט - ${selectedMix}.xlsx`;
      } else {
        rows = buildRowsForDefinition(definition);
      }
      const blob = await buildWorkbookBlob(definition, rows, meta, selectedMix);
      downloadBlob(blob, fileName);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "אירעה שגיאה ביצוא הריכוז");
    } finally {
      setBusyId(null);
    }
  };

  const exportSelected = async () => {
    const selectedDefinitions = definitions.filter((definition) =>
      selectedIds.includes(definition.id),
    );
    if (!selectedDefinitions.length) {
      alert("יש לבחור לפחות ריכוז אחד להורדה");
      return;
    }
    setBulkDownloading(true);
    try {
      let asphaltMix = "";
      let asphaltMixes: string[] = [];
      if (selectedDefinitions.some((definition) => definition.id === "asphalt")) {
        asphaltMixes = (await pickAsphaltMix())
          .map((mix) => normalizeAsphaltMix(mix) || mix)
          .filter(Boolean);
        if (!asphaltMixes.length) return;
        asphaltMix = asphaltMixes.join(" + ");
      }

      const zip = new JSZip();
      for (const definition of selectedDefinitions) {
        const selectedMix = definition.id === "asphalt" ? asphaltMix : "";
        const rows = definition.id === "asphalt"
          ? asphaltMixes.flatMap((mix) => buildRowsForDefinition(definition, mix))
          : buildRowsForDefinition(definition, selectedMix);
        const fileName =
          definition.id === "asphalt"
            ? `ריכוז בדיקות אספלט - ${selectedMix}.xlsx`
            : definition.fileName;
        const blob = await buildWorkbookBlob(
          definition,
          rows,
          meta,
          selectedMix,
        );
        zip.file(fileName, blob);
      }

      const archive = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      const projectSegment =
        cleanText(meta.projectName).replace(/[\\/:*?"<>|]/g, "-") || "פרויקט";
      downloadBlob(archive, `ריכוזים - ${projectSegment}.zip`);
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "אירעה שגיאה בהורדת הריכוזים שנבחרו",
      );
    } finally {
      setBulkDownloading(false);
    }
  };

  const importSoilSurvey = async (file: File | null | undefined) => {
    if (!file || !onImportSoilSurvey) return;
    setSoilSurveyImporting(true);
    try {
      const count = await onImportSoilSurvey(file);
      alert(count ? `נקלטו ${count} שורות סקר קרקע לריכוז עבודות עפר.` : "לא נמצאו שורות סקר קרקע לקליטה בקובץ.");
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "אירעה שגיאה בקליטת סקר הקרקע");
    } finally {
      setSoilSurveyImporting(false);
      if (soilSurveyInputRef.current) soilSurveyInputRef.current.value = "";
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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          padding: 12,
          border: "1px solid #cbd5e1",
          borderRadius: 14,
          background: "#f8fafc",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleAllVisible}
            style={{ width: 19, height: 19, accentColor: "#0f172a" }}
          />
          בחר את כל הריכוזים המוצגים
        </label>
        <button
          type="button"
          disabled={!selectedIds.length || bulkDownloading}
          onClick={exportSelected}
          style={{
            ...btnStyle,
            opacity: !selectedIds.length || bulkDownloading ? 0.55 : 1,
            cursor: !selectedIds.length || bulkDownloading ? "not-allowed" : "pointer",
          }}
        >
          {bulkDownloading
            ? "מכין חבילת ZIP..."
            : `הורד ריכוזים שנבחרו (${selectedIds.length})`}
        </button>
        {selectedIds.length ? (
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 14px", fontWeight: 900, background: "#fff", cursor: "pointer" }}
          >
            נקה בחירה
          </button>
        ) : null}
        <span style={{ color: "#64748b", fontWeight: 750 }}>
          הקבצים שנבחרו יורדו יחד בקובץ ZIP אחד.
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        {visibleDefinitions.map((definition) => {
          const isOpen = openId === definition.id;
          const isDeferredPreview = deferredPreviewConcentrationIds.has(definition.id);
          const rows = isDeferredPreview && isOpen ? buildRowsForDefinition(definition) : rowsById[definition.id] ?? [];
          const isTemplateConcentration = definition.id === "earthworks-material-results";
          const isSelected = selectedIds.includes(definition.id);
          const hasRowsOrDeferred = rows.length || isTemplateConcentration || isDeferredPreview;
          return (
            <div
              key={definition.id}
              style={{
                ...cardStyle,
                border: isSelected ? "2px solid #2563eb" : cardStyle.border,
                background: isSelected ? "#eff6ff" : "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelected(definition.id)}
                    aria-label={`בחר ${definition.title} להורדה`}
                    style={{ width: 20, height: 20, marginTop: 2, accentColor: "#2563eb", cursor: "pointer" }}
                  />
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{definition.title}</div>
                </div>
                <span style={{ borderRadius: 999, background: hasRowsOrDeferred ? "#dcfce7" : "#f1f5f9", color: hasRowsOrDeferred ? "#166534" : "#475569", padding: "5px 10px", fontWeight: 900, whiteSpace: "nowrap" }}>{rows.length ? `${rows.length} רשומות` : isDeferredPreview ? "מהתעודות השמורות" : isTemplateConcentration ? "תבנית ריקה" : `${rows.length} רשומות`}</span>
              </div>

              <div style={{ marginTop: 12, color: rows.length || isDeferredPreview ? "#166534" : "#64748b", fontWeight: 800 }}>
                {rows.length ? `נמצאו ${rows.length} רשומות ליצוא.` : isDeferredPreview && !isOpen ? "הריכוז ייבנה אוטומטית מהתעודות שכבר שמורות בתוך רשימות התיוג בזמן פתיחה או הורדה." : isTemplateConcentration ? "אין עדיין תעודות ייחוס מתאימות; יורדת תבנית ריקה בפורמט הדוגמה." : "אין נתונים שמורים לריכוז זה בפרויקט הנוכחי."}
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                <button type="button" disabled={busyId === definition.id} onClick={() => exportOne(definition)} style={{ ...btnStyle, cursor: busyId === definition.id ? "wait" : "pointer" }}>
                  {busyId === definition.id ? "מפיק Excel..." : "הורד Excel חדש"}
                </button>
                {definition.id === "earthworks-material-results" && onImportSoilSurvey && (
                  <>
                    <input
                      ref={soilSurveyInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      style={{ display: "none" }}
                      onChange={(event) => importSoilSurvey(event.target.files?.[0])}
                    />
                    <button
                      type="button"
                      disabled={soilSurveyImporting}
                      onClick={() => soilSurveyInputRef.current?.click()}
                      style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 12px", fontWeight: 900, color: "#0f172a", background: "#fff", cursor: soilSurveyImporting ? "wait" : "pointer" }}
                    >
                      {soilSurveyImporting ? "קולט סקר קרקע..." : "קליטת סקר קרקע PDF"}
                    </button>
                  </>
                )}
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
      {asphaltMixPicker ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="asphalt-mix-picker-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: 20,
            background: "rgba(15, 23, 42, 0.55)",
          }}
        >
          <div style={{ width: "min(620px, 100%)", borderRadius: 18, padding: 22, background: "#fff", boxShadow: "0 25px 60px rgba(15, 23, 42, 0.25)" }}>
            <h3 id="asphalt-mix-picker-title" style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>
              בחירת סוג תערובת אספלט
            </h3>
            <p style={{ margin: "8px 0 16px", color: "#475569", fontWeight: 700 }}>
              בחר סוג תערובת אחד או יותר להפקת הריכוז.
            </p>
            <div style={{ overflow: "hidden", border: "1px solid #cbd5e1", borderRadius: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    <th style={{ padding: 11, textAlign: "right" }}>סוג תערובת</th>
                    <th style={{ padding: 11, textAlign: "center", width: 100 }}>בחירה</th>
                  </tr>
                </thead>
                <tbody>
                  {ASPHALT_MIX_OPTIONS.map((mix) => (
                    <tr key={mix} style={{ borderTop: "1px solid #e2e8f0", background: asphaltMixPicker.selectedMixes.includes(mix) ? "#eff6ff" : "#fff" }}>
                      <td style={{ padding: 11, fontWeight: 800 }}>{mix}</td>
                      <td style={{ padding: 11, textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={asphaltMixPicker.selectedMixes.includes(mix)}
                          onChange={() => setAsphaltMixPicker((current) => current ? {
                            ...current,
                            selectedMixes: current.selectedMixes.includes(mix)
                              ? current.selectedMixes.filter((selected) => selected !== mix)
                              : [...current.selectedMixes, mix],
                          } : current)}
                          aria-label={`בחר ${mix}`}
                          style={{ width: 18, height: 18, accentColor: "#0f172a", cursor: "pointer" }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button type="button" onClick={() => setAsphaltMixPicker((current) => current ? { ...current, selectedMixes: [...ASPHALT_MIX_OPTIONS] } : current)} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "8px 12px", fontWeight: 800, background: "#fff", cursor: "pointer" }}>
                בחר הכול
              </button>
              <button type="button" onClick={() => setAsphaltMixPicker((current) => current ? { ...current, selectedMixes: [] } : current)} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "8px 12px", fontWeight: 800, background: "#fff", cursor: "pointer" }}>
                נקה בחירה
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-start", gap: 10, marginTop: 18 }}>
              <button
                type="button"
                onClick={() => {
                  asphaltMixPicker.onSelect(asphaltMixPicker.selectedMixes);
                  setAsphaltMixPicker(null);
                }}
                disabled={!asphaltMixPicker.selectedMixes.length}
                style={{ ...btnStyle, opacity: asphaltMixPicker.selectedMixes.length ? 1 : 0.5, cursor: asphaltMixPicker.selectedMixes.length ? "pointer" : "not-allowed" }}
              >
                אישור
              </button>
              <button
                type="button"
                onClick={() => {
                  asphaltMixPicker.onSelect([]);
                  setAsphaltMixPicker(null);
                }}
                style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "12px 14px", fontWeight: 900, color: "#0f172a", background: "#fff", cursor: "pointer" }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default ConcentrationsSection;
