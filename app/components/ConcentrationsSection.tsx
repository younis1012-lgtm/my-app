"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import JSZip from "jszip";

type ProjectConcentrationMeta = {
  projectName?: string;
  projectManager?: string;
  projectManagement?: string;
  contractor?: string;
  contractorName?: string;
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

type SourceType =
  | "checklists"
  | "nonconformances"
  | "trialSections"
  | "preliminary";

type ConcentrationTemplate = {
  id: string;
  title: string;
  fileName: string;
  description: string;
  source: SourceType;
  preliminarySubtype?: "suppliers" | "subcontractors" | "materials";
  keywords?: string[];
};

type ProjectMetaResolved = Required<
  Pick<
    ProjectConcentrationMeta,
    "projectName" | "contractor" | "qualityAssurance" | "qualityControl"
  >
> & {
  projectManager: string;
};

type ExportRow = {
  id: string;
  raw?: any;
  source: SourceType;
  values: Record<string, string | number>;
};

type ColumnDef = {
  key: string;
  label: string;
  width?: number;
};

type ExportDataset = {
  template: ConcentrationTemplate;
  columns: ColumnDef[];
  rows: ExportRow[];
};

const templates: ConcentrationTemplate[] = [
  {
    id: "nonconformances",
    title: "דוח ריכוז אי התאמות",
    fileName: "non-conformance.xlsx",
    description: "ריכוז אי התאמות לפי הטופס המקורי",
    source: "nonconformances",
  },
  {
    id: "suppliers",
    title: "ריכוז ספקים",
    fileName: "suppliers.xlsx",
    description: "ריכוז ספקים לפי הטופס המקורי",
    source: "preliminary",
    preliminarySubtype: "suppliers",
  },
  {
    id: "contractors",
    title: "ריכוז קבלנים",
    fileName: "contractors.xlsx",
    description: "ריכוז קבלנים לפי הטופס המקורי",
    source: "preliminary",
    preliminarySubtype: "subcontractors",
  },
  {
    id: "asphalt",
    title: "ריכוז בדיקות אספלט",
    fileName: "asphalt.xlsx",
    description: "בדיקות אספלט / FWD / מישוריות",
    source: "checklists",
    keywords: ["אספלט", "fwd", "מישוריות", "שכבה סופית"],
  },
  {
    id: "density",
    title: "ריכוז בדיקות צפיפות",
    fileName: "density.xlsx",
    description: "צפיפות / הידוק / רטיבות / מצעים",
    source: "checklists",
    keywords: ["צפיפות", "הידוק", "רטיבות", "מצע", "מצעים"],
  },
  {
    id: "concrete",
    title: "ריכוז בטון",
    fileName: "concrete.xlsx",
    description: "בדיקות בטון",
    source: "checklists",
    keywords: ["בטון", "יציקה", "קוביות", "חוזק"],
  },
  {
    id: "supervision",
    title: "ריכוז דוחות פיקוח עליון",
    fileName: "supervision.xlsx",
    description: "דוחות פיקוח עליון",
    source: "trialSections",
    keywords: ["פיקוח עליון", "דוח פיקוח"],
  },
  {
    id: "materials",
    title: "ריכוז חומרים",
    fileName: "materials.xlsx",
    description: "אישורי חומרים",
    source: "preliminary",
    preliminarySubtype: "materials",
  },
  {
    id: "trial-sections",
    title: "ריכוז קטעי ניסוי",
    fileName: "trial-sections.xlsx",
    description: "קטעי ניסוי",
    source: "trialSections",
  },
  {
    id: "subbase-a",
    title: "ריכוז אפיון מצע א׳",
    fileName: "subbase-a.xlsx",
    description: "אפיון מצע א׳ מתוך תעודות ייחוס/בדיקות",
    source: "checklists",
    keywords: ["מצע א", "מצע א׳", "אפיון", "cbr", "גרדציה", "24403"],
  },
  {
    id: "selected-material",
    title: "ריכוז אפיון נברר",
    fileName: "selected-material.xlsx",
    description: "אפיון חומר נברר",
    source: "checklists",
    keywords: ["נברר", "חומר נברר", "אפיון", "cbr", "גרדציה"],
  },
];

const normalize = (value: unknown) =>
  String(value ?? "")
    .replace(/[׳`’']/g, "")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/[:：]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const text = (value: unknown) => String(value ?? "").trim();

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    const candidate = text(value);
    if (candidate) return candidate;
  }
  return "";
};

const shortDate = (value: unknown) => {
  const raw = text(value);
  if (!raw) return "";
  const datePart = raw.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return datePart || raw;
};

const normalizeProjectKey = (value: unknown) =>
  String(value ?? "")
    .replace(/[׳`’']/g, "")
    .replace(/\s+/g, " ")
    .trim();

const buildProjectMeta = (
  currentProjectName = "",
  projectMeta?: ProjectConcentrationMeta,
): ProjectMetaResolved => {
  const projectName = firstText(projectMeta?.projectName, currentProjectName);
  const meta: ProjectMetaResolved = {
    projectName,
    projectManager: firstText(
      projectMeta?.projectManager,
      projectMeta?.projectManagement,
    ),
    contractor: firstText(projectMeta?.contractor, projectMeta?.contractorName),
    qualityAssurance: firstText(projectMeta?.qualityAssurance),
    qualityControl: firstText(projectMeta?.qualityControl),
  };

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(
        "yk-quality-stage4-multifile-project-teams",
      );
      const teams = raw ? JSON.parse(raw) : {};
      const team = teams?.[normalizeProjectKey(projectName)];
      if (team && typeof team === "object") {
        meta.projectManager = firstText(
          meta.projectManager,
          team.managementCompany,
          team.projectManager,
        );
        meta.contractor = firstText(meta.contractor, team.contractor);
        meta.qualityAssurance = firstText(
          meta.qualityAssurance,
          team.qualityAssurance,
        );
        meta.qualityControl = firstText(
          meta.qualityControl,
          team.qualityControl,
        );
      }
    } catch {}
  }

  return meta;
};

const includesAny = (haystack: unknown, keywords: string[] = []) => {
  if (!keywords.length) return true;
  const normalized = normalize(haystack);
  return keywords.some((keyword) => normalized.includes(normalize(keyword)));
};

const flattenText = (value: any, depth = 0): string => {
  if (value === null || value === undefined || depth > 5) return "";
  if (["string", "number", "boolean"].includes(typeof value))
    return String(value);
  if (Array.isArray(value))
    return value.map((item) => flattenText(item, depth + 1)).join(" ");
  if (typeof value === "object")
    return Object.entries(value)
      .map(([key, nested]) => `${key} ${flattenText(nested, depth + 1)}`)
      .join(" ");
  return "";
};

const keyNorm = (value: unknown) => normalize(value).replace(/[\s_\-\/]/g, "");

const deepFind = (value: any, aliases: string[], depth = 0): string => {
  if (value === null || value === undefined || depth > 7) return "";
  if (typeof value !== "object") return "";
  const normalizedAliases = aliases.map(keyNorm);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFind(item, aliases, depth + 1);
      if (found) return found;
    }
    return "";
  }

  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = keyNorm(key);
    if (
      normalizedAliases.some(
        (alias) => normalizedKey === alias || normalizedKey.includes(alias),
      )
    ) {
      const raw = text(nested);
      if (raw && raw !== "[object Object]") return raw;
      const nestedText = deepFind(nested, aliases, depth + 1);
      if (nestedText) return nestedText;
    }
  }

  for (const nested of Object.values(value)) {
    const found = deepFind(nested, aliases, depth + 1);
    if (found) return found;
  }
  return "";
};

const collectAttachments = (
  value: any,
  out: string[] = [],
  depth = 0,
): string[] => {
  if (!value || depth > 7) return out;
  if (Array.isArray(value)) {
    value.forEach((item) => collectAttachments(item, out, depth + 1));
    return out;
  }
  if (typeof value !== "object") return out;

  const name = firstText(
    value.name,
    value.fileName,
    value.attachmentName,
    value.originalName,
    value.title,
  );
  const looksLikeAttachment = Boolean(
    value.dataUrl ||
    value.url ||
    value.path ||
    value.uploadedAt ||
    value.attachedAt ||
    value.kind ||
    value.type ||
    value.fileName ||
    value.attachmentName,
  );
  if (name && looksLikeAttachment) out.push(name);

  Object.values(value).forEach((nested) =>
    collectAttachments(nested, out, depth + 1),
  );
  return out;
};

const unique = (items: string[]) =>
  Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
const attachmentNames = (record: any, item?: any, attachment?: any) =>
  unique([
    ...collectAttachments(record),
    ...collectAttachments(item),
    ...collectAttachments(attachment),
  ]).join(", ");
const splitDocs = (docs: string) =>
  docs
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const looksLikeIso = (value: unknown) => /\biso\b|איזו|9001/i.test(text(value));
const withoutExt = (value: string) =>
  value.replace(/\.[a-z0-9]{2,5}$/i, "").trim();
const isoDocs = (docs: string) =>
  splitDocs(docs).filter(looksLikeIso).join(", ");
const nonIsoDocs = (docs: string) =>
  splitDocs(docs)
    .filter((doc) => !looksLikeIso(doc))
    .join(", ");

const approvalNumber = (record: any, fallback = "") =>
  firstText(
    record?.approvalNo,
    record?.approvalNumber,
    record?.preliminaryNo,
    record?.number,
    record?.supplier?.approvalNo,
    record?.supplier?.approvalNumber,
    record?.supplier?.certificateNo,
    record?.subcontractor?.approvalNo,
    record?.subcontractor?.approvalNumber,
    record?.subcontractor?.licenseNo,
    record?.material?.certificateNo,
    deepFind(record, [
      "approvalNo",
      "approvalNumber",
      "preliminaryNo",
      "certificateNo",
      "licenseNo",
      "מספר אישור",
      "אישור מס",
      "מס תעודה",
      "מספר תעודה",
      "רישיון",
    ]),
    fallback,
  );

const recordId = (record: any, index: number) =>
  firstText(record?.id, record?.recordId, record?.uuid, index + 1);

const isSupplierRecord = (record: any) =>
  record?.subtype === "suppliers" ||
  Boolean(record?.supplier) ||
  includesAny(flattenText(record), ["ספק"]);
const isContractorRecord = (record: any) =>
  record?.subtype === "subcontractors" ||
  Boolean(record?.subcontractor) ||
  includesAny(flattenText(record), ["קבלן משנה", "קבלן"]);
const isMaterialRecord = (record: any) =>
  record?.subtype === "materials" ||
  Boolean(record?.material) ||
  includesAny(flattenText(record), ["חומר", "חומרים"]);

const baseColumns: Record<string, ColumnDef[]> = {
  nonconformances: [
    { key: "serial", label: "מס׳" },
    { key: "ncrNo", label: "מס׳ אי התאמה" },
    { key: "date", label: "תאריך פתיחה" },
    { key: "openedBy", label: "נפתחה ע״י QA/QC" },
    { key: "status", label: "סטטוס" },
    { key: "location", label: "מיקום" },
    { key: "element", label: "אלמנט/שכבה" },
    { key: "description", label: "תיאור אי התאמה", width: 32 },
    { key: "requiredTreatment", label: "טיפול נדרש", width: 28 },
    { key: "closingDate", label: "תאריך סגירה משוער/בפועל" },
    { key: "notes", label: "הערות" },
    { key: "attachments", label: "קבצים מצורפים", width: 26 },
  ],
  suppliers: [
    { key: "serial", label: "אישור מס" },
    { key: "supplierName", label: "שם ספק" },
    { key: "suppliedMaterial", label: "חומר מסופק" },
    { key: "contact", label: "אנשי קשר וטלפון" },
    { key: "projectScope", label: "תת פרויקט" },
    { key: "standardCert", label: "מספר תעודה / רישיון / אישור" },
    { key: "standardDocs", label: "אישור ת״ת רלוונטי / הסמכות - קבצים" },
    { key: "standardExpiry", label: "תוקף" },
    { key: "isoNo", label: "מס תעודת ISO" },
    { key: "isoDocs", label: "תעודת ISO - קובץ" },
    { key: "approvalDate", label: "תאריך אישור ה״א" },
    { key: "approver", label: "שם המאשר ה״א" },
    { key: "notes", label: "הערות" },
  ],
  contractors: [
    { key: "serial", label: "אישור מס" },
    { key: "approvalNo", label: "שם קבלן משנה" },
    { key: "activity", label: "תחום פעילות" },
    { key: "contact", label: "אנשי קשר וטלפון" },
    { key: "projectScope", label: "תת פרויקט" },
    {
      key: "classificationNo",
      label: "סיווג ברשם הקבלנים / מספר תעודה / רישיון / אישור",
    },
    { key: "classificationDocs", label: "קבצים מצורפים" },
    { key: "classificationExpiry", label: "תוקף" },
    { key: "isoNo", label: "מס תעודת ISO" },
    { key: "isoDocs", label: "תעודת ISO - קובץ" },
    { key: "approvalDate", label: "תאריך אישור ה״א" },
    { key: "approver", label: "שם המאשר ה״א" },
    { key: "notes", label: "הערות" },
  ],
  materials: [
    { key: "serial", label: "מס׳" },
    { key: "materialName", label: "שם החומר" },
    { key: "source", label: "מקור/יצרן" },
    { key: "usage", label: "שימוש" },
    { key: "certificateNo", label: "מספר תעודה / אישור" },
    { key: "docs", label: "קבצים מצורפים" },
    { key: "approvalDate", label: "תאריך אישור" },
    { key: "approver", label: "שם המאשר" },
    { key: "notes", label: "הערות" },
  ],
  "trial-sections": [
    { key: "serial", label: "מס׳ אישור" },
    { key: "project", label: "כביש" },
    { key: "from", label: "מחתך" },
    { key: "to", label: "עד חתך" },
    { key: "side", label: "צד" },
    { key: "element", label: "אלמנט" },
    { key: "subElement", label: "תת אלמנט" },
    { key: "contractor", label: "הקבלן המבצע" },
    { key: "activity", label: "סוג החומר / פעילות" },
    { key: "startDate", label: "תאריך ביצוע" },
    { key: "endDate", label: "תאריך אישור" },
    { key: "workManager", label: "מנהל עבודה / ראש צוות" },
    { key: "process", label: "תהליך ביצוע", width: 36 },
    { key: "requirements", label: "דרישות/הנחיות", width: 36 },
    { key: "status", label: "סטטוס" },
    { key: "notes", label: "הערות" },
  ],
  generic: [
    { key: "serial", label: "מס׳" },
    { key: "record", label: "מס׳ רשומה / תעודה" },
    { key: "date", label: "תאריך" },
    { key: "title", label: "נושא / בדיקה" },
    { key: "category", label: "סוג" },
    { key: "location", label: "מיקום" },
    { key: "contractor", label: "קבלן" },
    { key: "item", label: "פריט / תיאור", width: 34 },
    { key: "result", label: "תוצאה / סטטוס" },
    { key: "certificate", label: "מספר תעודה" },
    { key: "attachments", label: "קבצים מצורפים", width: 28 },
    { key: "notes", label: "הערות", width: 30 },
  ],
  "subbase-a": [
    { key: "serial", label: "מס׳ סידורי" },
    { key: "certificate", label: "מס׳ תעודה / רשומה" },
    { key: "date", label: "תאריך" },
    { key: "source", label: "מקור החומר" },
    { key: "samplingLocation", label: "מקום הדגם לבדיקה" },
    { key: "spreadingLocation", label: "מקום הפיזור" },
    { key: "sieve3", label: '3"' },
    { key: "sieve15", label: '1.5"' },
    { key: "sieve34", label: '3/4"' },
    { key: "sieve4", label: "#4" },
    { key: "sieve10", label: "#10" },
    { key: "sieve40", label: "#40" },
    { key: "sieve200", label: "#200" },
    { key: "ll", label: "LL" },
    { key: "pl", label: "PL" },
    { key: "pi", label: "PI" },
    { key: "aashto", label: "AASHTO" },
    { key: "status", label: "מעמד" },
    { key: "attachments", label: "קבצים" },
  ],
};

const valueByAliases = (record: any, aliases: string[]) =>
  firstText(...aliases.map((alias) => deepFind(record, [alias])));

const buildNonconformanceRows = (records: any[]): ExportRow[] =>
  records.map((record, index) => ({
    id: recordId(record, index),
    source: "nonconformances",
    raw: record,
    values: {
      serial: index + 1,
      ncrNo: firstText(
        record?.ncrNo,
        record?.number,
        record?.serial,
        record?.id,
      ),
      date: shortDate(
        firstText(
          record?.date,
          record?.openedAt,
          record?.createdAt,
          record?.savedAt,
        ),
      ),
      openedBy: firstText(
        record?.openedBy,
        record?.raisedBy,
        record?.inspector,
        record?.responsible,
      ),
      status: firstText(record?.status, record?.approval?.status),
      location: firstText(record?.location, record?.area, record?.section),
      element: firstText(
        record?.element,
        record?.subElement,
        record?.category,
        record?.component,
      ),
      description: firstText(
        record?.description,
        record?.nonconformanceDescription,
        record?.details,
        record?.title,
      ),
      requiredTreatment: firstText(
        record?.requiredTreatment,
        record?.treatment,
        record?.actionRequired,
        record?.correctiveAction,
      ),
      closingDate: shortDate(
        firstText(
          record?.closingDate,
          record?.targetCloseDate,
          record?.closedAt,
          record?.dueDate,
        ),
      ),
      notes: firstText(record?.notes, record?.comments),
      attachments: attachmentNames(record),
    },
  }));

const buildSupplierRows = (records: any[]): ExportRow[] =>
  records.filter(isSupplierRecord).map((record, index) => {
    const supplier = record?.supplier ?? record;
    const docs = attachmentNames(record);
    const iso = isoDocs(docs);
    const nonIso = nonIsoDocs(docs);
    return {
      id: recordId(record, index),
      source: "preliminary" as SourceType,
      raw: record,
      values: {
        serial: approvalNumber(record, String(index + 1)),
        supplierName: firstText(
          supplier?.supplierName,
          supplier?.name,
          record?.title,
        ),
        suppliedMaterial: firstText(
          supplier?.suppliedMaterial,
          supplier?.material,
          supplier?.materialName,
          record?.description,
        ),
        contact: firstText(
          supplier?.contact,
          supplier?.contactPerson,
          supplier?.phone,
          supplier?.contactPhone,
          valueByAliases(record, ["contact", "phone", "טלפון", "איש קשר"]),
        ),
        projectScope: firstText(
          record?.projectScope,
          record?.subProject,
          record?.location,
        ),
        standardCert: firstText(
          supplier?.standardCertificateNo,
          supplier?.tiCertificateNo,
          supplier?.licenseNo,
          supplier?.approvalNo,
          supplier?.certificateNo,
          valueByAliases(record, [
            "standardCertificateNo",
            "tiCertificateNo",
            "licenseNo",
            "approvalNo",
            "certificateNo",
            "מספר תעודה",
            "רישיון",
            "אישור",
          ]),
        ),
        standardDocs: nonIso,
        standardExpiry: shortDate(
          firstText(
            supplier?.standardValidUntil,
            supplier?.licenseValidUntil,
            supplier?.validUntil,
            valueByAliases(record, ["validUntil", "expiry", "תוקף"]),
          ),
        ),
        isoNo: firstText(
          supplier?.isoCertificateNo,
          supplier?.isoNo,
          supplier?.isoNumber,
          valueByAliases(record, [
            "isoCertificateNo",
            "isoNo",
            "isoNumber",
            "מס iso",
          ]),
        ),
        isoDocs: iso,
        approvalDate: shortDate(
          firstText(record?.approvalDate, record?.date, record?.savedAt),
        ),
        approver: firstText(
          record?.approvedBy,
          record?.approval?.signatures?.[0]?.signerName,
        ),
        notes: firstText(supplier?.notes, record?.notes),
      },
    };
  });

const buildContractorRows = (records: any[]): ExportRow[] =>
  records.filter(isContractorRecord).map((record, index) => {
    const subcontractor = record?.subcontractor ?? record;
    const docs = attachmentNames(record);
    const iso = isoDocs(docs);
    const nonIso = nonIsoDocs(docs);
    return {
      id: recordId(record, index),
      source: "preliminary" as SourceType,
      raw: record,
      values: {
        serial: approvalNumber(record, String(index + 1)),
        approvalNo: firstText(
          subcontractor?.subcontractorName,
          subcontractor?.contractorName,
          subcontractor?.name,
          record?.title,
        ),
        activity: firstText(
          subcontractor?.field,
          subcontractor?.activity,
          subcontractor?.scope,
          record?.description,
        ),
        contact: firstText(
          subcontractor?.contact,
          subcontractor?.contactPerson,
          subcontractor?.phone,
          valueByAliases(record, ["contact", "phone", "טלפון", "איש קשר"]),
        ),
        projectScope: firstText(
          record?.projectScope,
          record?.subProject,
          record?.location,
        ),
        classificationNo: firstText(
          subcontractor?.classificationNo,
          subcontractor?.licenseNo,
          subcontractor?.approvalNo,
          subcontractor?.certificateNo,
          valueByAliases(record, [
            "classificationNo",
            "licenseNo",
            "approvalNo",
            "certificateNo",
            "סיווג",
            "רישיון",
            "מספר תעודה",
            "אישור",
          ]),
        ),
        classificationDocs: nonIso,
        classificationExpiry: shortDate(
          firstText(
            subcontractor?.validUntil,
            subcontractor?.licenseValidUntil,
            valueByAliases(record, ["validUntil", "expiry", "תוקף"]),
          ),
        ),
        isoNo: firstText(
          subcontractor?.isoCertificateNo,
          subcontractor?.isoNo,
          valueByAliases(record, ["isoCertificateNo", "isoNo", "מס iso"]),
        ),
        isoDocs: iso,
        approvalDate: shortDate(
          firstText(record?.approvalDate, record?.date, record?.savedAt),
        ),
        approver: firstText(
          record?.approvedBy,
          record?.approval?.signatures?.[0]?.signerName,
        ),
        notes: firstText(subcontractor?.notes, record?.notes),
      },
    };
  });

const buildMaterialRows = (records: any[]): ExportRow[] =>
  records.filter(isMaterialRecord).map((record, index) => {
    const material = record?.material ?? record;
    return {
      id: recordId(record, index),
      source: "preliminary" as SourceType,
      raw: record,
      values: {
        serial: index + 1,
        materialName: firstText(
          material?.materialName,
          material?.name,
          record?.title,
        ),
        source: firstText(
          material?.source,
          material?.manufacturer,
          material?.supplierName,
        ),
        usage: firstText(
          material?.usage,
          material?.description,
          record?.description,
        ),
        certificateNo: firstText(
          material?.certificateNo,
          material?.approvalNo,
          approvalNumber(record, ""),
        ),
        docs: attachmentNames(record),
        approvalDate: shortDate(
          firstText(record?.approvalDate, record?.date, record?.savedAt),
        ),
        approver: firstText(
          record?.approvedBy,
          record?.approval?.signatures?.[0]?.signerName,
        ),
        notes: firstText(material?.notes, record?.notes),
      },
    };
  });

const buildTrialRows = (records: any[], templateId: string): ExportRow[] => {
  const filtered =
    templateId === "supervision"
      ? records.filter((r) =>
          includesAny(flattenText(r), ["פיקוח עליון", "דוח פיקוח"]),
        )
      : records;
  return filtered.map((record, index) => ({
    id: recordId(record, index),
    source: "trialSections",
    raw: record,
    values: {
      serial: index + 1,
      project: firstText(
        record?.road,
        record?.roadName,
        record?.projectName,
        record?.title,
      ),
      from: firstText(
        record?.fromSection,
        record?.from,
        record?.startSection,
        record?.startKm,
      ),
      to: firstText(
        record?.toSection,
        record?.to,
        record?.endSection,
        record?.endKm,
      ),
      side: firstText(record?.side),
      element: firstText(record?.element, record?.layer, record?.component),
      subElement: firstText(record?.subElement, record?.subLayer),
      contractor: firstText(record?.contractor, record?.performer),
      activity: firstText(
        record?.activity,
        record?.materialType,
        record?.description,
        record?.trialName,
      ),
      startDate: shortDate(
        firstText(record?.executionDate, record?.startDate, record?.date),
      ),
      endDate: shortDate(
        firstText(record?.approvalDate, record?.endDate, record?.approvedAt),
      ),
      workManager: firstText(
        record?.workManager,
        record?.foreman,
        record?.teamLeader,
      ),
      process: firstText(
        record?.process,
        record?.executionProcess,
        record?.workProcess,
        record?.method,
      ),
      requirements: firstText(
        record?.requirements,
        record?.recommendations,
        record?.approvalConditions,
        record?.notes,
      ),
      status: firstText(record?.status, record?.approval?.status),
      notes: firstText(record?.notes, record?.comments),
    },
  }));
};

const resultValue = (result: any, ...keys: string[]) =>
  firstText(...keys.map((key) => result?.[key]), deepFind(result, keys));
const buildChecklistRows = (
  records: any[],
  template: ConcentrationTemplate,
): ExportRow[] => {
  const rows: ExportRow[] = [];
  records.forEach((checklist, checklistIndex) => {
    const items = Array.isArray(checklist?.items) ? checklist.items : [];
    if (
      !items.length &&
      includesAny(flattenText(checklist), template.keywords)
    ) {
      rows.push({
        id: recordId(checklist, checklistIndex),
        source: "checklists",
        raw: checklist,
        values: genericChecklistValues(
          checklist,
          undefined,
          undefined,
          template,
          rows.length,
        ),
      });
    }
    items.forEach((item: any, itemIndex: number) => {
      const attachments = Array.isArray(item?.attachments)
        ? item.attachments
        : [];
      if (
        !attachments.length &&
        includesAny(
          `${flattenText(checklist)} ${flattenText(item)}`,
          template.keywords,
        )
      ) {
        rows.push({
          id: `${recordId(checklist, checklistIndex)}-${itemIndex}`,
          source: "checklists",
          raw: checklist,
          values: genericChecklistValues(
            checklist,
            item,
            undefined,
            template,
            rows.length,
          ),
        });
      }
      attachments.forEach((attachment: any, attIndex: number) => {
        const combined = `${flattenText(checklist)} ${flattenText(item)} ${flattenText(attachment)} ${flattenText(attachment?.labResults)} ${flattenText(attachment?.results)}`;
        if (!includesAny(combined, template.keywords)) return;
        rows.push({
          id: `${recordId(checklist, checklistIndex)}-${itemIndex}-${attIndex}`,
          source: "checklists",
          raw: checklist,
          values: genericChecklistValues(
            checklist,
            item,
            attachment,
            template,
            rows.length,
          ),
        });
      });
    });
  });
  return rows;
};

const genericChecklistValues = (
  checklist: any,
  item: any,
  attachment: any,
  template: ConcentrationTemplate,
  index: number,
): Record<string, string | number> => {
  const result =
    attachment?.labResults ??
    attachment?.results ??
    item?.labResults ??
    item?.results ??
    {};
  const cert = firstText(
    result?.certificateNo,
    attachment?.certificateNo,
    extractNumberFromText(attachment?.name),
    attachment?.name,
  );
  const common = {
    serial: index + 1,
    record: firstText(checklist?.checklistNo, checklist?.id, index + 1),
    date: shortDate(
      firstText(
        item?.executionDate,
        checklist?.date,
        attachment?.uploadedAt,
        checklist?.savedAt,
      ),
    ),
    title: firstText(checklist?.title, checklist?.category),
    category: firstText(checklist?.category, item?.category),
    location: firstText(item?.location, checklist?.location),
    contractor: firstText(item?.contractor, checklist?.contractor),
    item: firstText(
      item?.description,
      checklist?.description,
      attachment?.name,
    ),
    result: firstText(item?.status, result?.status, result?.result),
    certificate: cert,
    attachments: attachmentNames(checklist, item, attachment),
    notes: firstText(item?.notes, checklist?.notes),
  };

  if (template.id === "subbase-a" || template.id === "selected-material") {
    return {
      serial: common.serial,
      certificate: cert,
      date: common.date,
      source: firstText(
        result?.source,
        result?.materialSource,
        deepFind(result, ["מקור החומר"]),
        common.location,
      ),
      samplingLocation: firstText(
        result?.samplingLocation,
        deepFind(result, ["מקום נטילת", "מקום הדגם"]),
        common.location,
      ),
      spreadingLocation: firstText(
        result?.spreadingLocation,
        deepFind(result, ["מקום הפיזור"]),
        common.location,
      ),
      sieve3: resultValue(result, "sieve3", "3", "3inch"),
      sieve15: resultValue(result, "sieve15", "1.5", "1_5"),
      sieve34: resultValue(result, "sieve34", "3/4"),
      sieve4: resultValue(result, "sieve4", "#4"),
      sieve10: resultValue(result, "sieve10", "#10"),
      sieve40: resultValue(result, "sieve40", "#40"),
      sieve200: resultValue(result, "sieve200", "#200"),
      ll: resultValue(result, "ll", "LL"),
      pl: resultValue(result, "pl", "PL"),
      pi: resultValue(result, "pi", "PI"),
      aashto: resultValue(result, "aashto", "AASHTO"),
      status: firstText(result?.status, common.result),
      attachments: common.attachments,
    };
  }
  return common;
};

const extractNumberFromText = (value: unknown) => {
  const match = text(value).match(/(?:^|[^0-9])(\d{2,})(?:[^0-9]|$)/);
  return match?.[1] ?? "";
};

const columnsForTemplate = (template: ConcentrationTemplate): ColumnDef[] =>
  baseColumns[template.id] ?? baseColumns.generic;

const rowsForTemplate = (
  template: ConcentrationTemplate,
  data: Pick<
    Props,
    | "savedChecklists"
    | "savedNonconformances"
    | "savedTrialSections"
    | "savedPreliminary"
  >,
): ExportRow[] => {
  if (template.id === "nonconformances")
    return buildNonconformanceRows(data.savedNonconformances ?? []);
  if (template.id === "suppliers")
    return buildSupplierRows(data.savedPreliminary ?? []);
  if (template.id === "contractors")
    return buildContractorRows(data.savedPreliminary ?? []);
  if (template.id === "materials")
    return buildMaterialRows(data.savedPreliminary ?? []);
  if (template.source === "trialSections")
    return buildTrialRows(data.savedTrialSections ?? [], template.id);
  if (template.source === "checklists")
    return buildChecklistRows(data.savedChecklists ?? [], template);
  return [];
};

const makeDataset = (
  template: ConcentrationTemplate,
  props: Pick<
    Props,
    | "savedChecklists"
    | "savedNonconformances"
    | "savedTrialSections"
    | "savedPreliminary"
  >,
): ExportDataset => ({
  template,
  columns: columnsForTemplate(template),
  rows: rowsForTemplate(template, props),
});

const xmlEscape = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const columnLetter = (index: number) => {
  let n = index;
  let result = "";
  while (n > 0) {
    const mod = (n - 1) % 26;
    result = String.fromCharCode(65 + mod) + result;
    n = Math.floor((n - mod) / 26);
  }
  return result;
};

const cellXml = (row: number, col: number, value: unknown, style = 0) => {
  const ref = `${columnLetter(col)}${row}`;
  if (typeof value === "number" && Number.isFinite(value))
    return `<c r="${ref}" s="${style}" t="n"><v>${value}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
};

const rowXml = (rowNumber: number, cells: unknown[], style = 0) =>
  `<row r="${rowNumber}">${cells.map((value, index) => cellXml(rowNumber, index + 1, value, style)).join("")}</row>`;

const buildSheetXml = (dataset: ExportDataset, meta: ProjectMetaResolved) => {
  const cols = dataset.columns
    .map(
      (col, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${col.width ?? 16}" customWidth="1"/>`,
    )
    .join("");
  const headerValues = dataset.columns.map((col) => col.label);
  const rows: string[] = [];
  rows.push(rowXml(1, [dataset.template.title], 1));
  rows.push(rowXml(2, ["שם פרויקט", meta.projectName], 2));
  rows.push(rowXml(3, ["ניהול פרויקט", meta.projectManager], 2));
  rows.push(rowXml(4, ["שם הקבלן", meta.contractor], 2));
  rows.push(rowXml(5, ["הבטחת איכות", meta.qualityAssurance], 2));
  rows.push(rowXml(6, ["בקרת איכות", meta.qualityControl], 2));
  rows.push(rowXml(8, headerValues, 3));
  dataset.rows.forEach((record, index) =>
    rows.push(
      rowXml(
        9 + index,
        dataset.columns.map((column) => record.values[column.key] ?? ""),
        4,
      ),
    ),
  );
  const lastRow = Math.max(9 + dataset.rows.length, 9);
  const lastCol = columnLetter(Math.max(dataset.columns.length, 2));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${rows.join("")}</sheetData>
  <mergeCells count="1"><mergeCell ref="A1:${lastCol}1"/></mergeCells>
  <autoFilter ref="A8:${lastCol}${lastRow}"/>
</worksheet>`;
};

const buildStylesXml =
  () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="16"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/><color rgb="FFFFFFFF"/></font></fonts>
  <fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9EAD3"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top" wrapText="1"/></xf></cellXfs>
</styleSheet>`;

const exportDatasetToXlsx = async (
  dataset: ExportDataset,
  meta: ProjectMetaResolved,
) => {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
  );
  zip
    .folder("_rels")
    ?.file(
      ".rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    );
  zip
    .folder("xl")
    ?.file(
      "workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(dataset.template.title).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets><calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`,
    );
  zip
    .folder("xl")
    ?.folder("_rels")
    ?.file(
      "workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    );
  zip
    .folder("xl")
    ?.folder("worksheets")
    ?.file("sheet1.xml", buildSheetXml(dataset, meta));
  zip.folder("xl")?.file("styles.xml", buildStylesXml());
  return zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
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

const cardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 18,
  background: "#fff",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
};
const buttonStyle: CSSProperties = {
  border: 0,
  borderRadius: 12,
  padding: "12px 14px",
  fontWeight: 900,
  color: "#fff",
  background: "#0f172a",
  cursor: "pointer",
};
const secondaryButtonStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "10px 12px",
  fontWeight: 900,
  color: "#0f172a",
  background: "#fff",
  cursor: "pointer",
};

export function ConcentrationsSection({
  savedChecklists = [],
  savedNonconformances = [],
  savedTrialSections = [],
  savedPreliminary = [],
  currentProjectName = "",
  projectMeta,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("nonconformances");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const meta = useMemo(
    () => buildProjectMeta(currentProjectName, projectMeta),
    [currentProjectName, projectMeta],
  );

  const datasets = useMemo(() => {
    const props = {
      savedChecklists,
      savedNonconformances,
      savedTrialSections,
      savedPreliminary,
    };
    const result: Record<string, ExportDataset> = {};
    templates.forEach((template) => {
      result[template.id] = makeDataset(template, props);
    });
    return result;
  }, [
    savedChecklists,
    savedNonconformances,
    savedTrialSections,
    savedPreliminary,
  ]);

  const filteredTemplates = useMemo(() => {
    const q = normalize(query);
    if (!q) return templates;
    return templates.filter((template) =>
      normalize(
        `${template.title} ${template.description} ${template.fileName}`,
      ).includes(q),
    );
  }, [query]);

  const selected = datasets[selectedId] ?? datasets.nonconformances;

  const downloadDataset = async (dataset: ExportDataset) => {
    setBusyId(dataset.template.id);
    setMessage("");
    try {
      const blob = await exportDatasetToXlsx(dataset, meta);
      downloadBlob(blob, dataset.template.fileName);
      setMessage(
        `הופק ${dataset.template.title} עם ${dataset.rows.length} שורות לפי הטבלה שמוצגת במסך.`,
      );
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error ? error.message : "שגיאה בהפקת קובץ Excel",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section dir="rtl">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 950 }}>ריכוזים</h2>
          <div style={{ color: "#64748b", marginTop: 6, lineHeight: 1.7 }}>
            תצוגת בדיקה לפני Excel: מה שמופיע בטבלה כאן הוא בדיוק מה שיורד
            לקובץ. כך אין ניחוש לפי כותרות ואין ערבוב בין טופס, פריט וקובץ
            מצורף.
          </div>
          {currentProjectName ? (
            <div style={{ marginTop: 8, fontWeight: 900 }}>
              פרויקט נוכחי: {currentProjectName}
            </div>
          ) : null}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="חיפוש ריכוז..."
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: 14,
            padding: "12px 14px",
            minWidth: 260,
            fontWeight: 800,
          }}
        />
      </div>

      <div
        style={{
          border: "1px solid #bfdbfe",
          background: "#eff6ff",
          borderRadius: 16,
          padding: 14,
          marginBottom: 16,
          color: "#1e3a8a",
          fontWeight: 800,
          lineHeight: 1.7,
        }}
      >
        מנגנון חדש: קודם מציגים את נתוני הריכוז במסך, ורק לאחר שהנתונים נכונים
        מורידים Excel. הקובץ שיורד נבנה מהטבלה המוצגת כאן, לא מהתאמת כותרות
        אוטומטית.
      </div>

      {message ? (
        <div
          style={{
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            borderRadius: 14,
            padding: 12,
            marginBottom: 16,
            color: "#166534",
            fontWeight: 900,
          }}
        >
          {message}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: 14,
          marginBottom: 22,
        }}
      >
        {filteredTemplates.map((template) => {
          const dataset = datasets[template.id];
          const count = dataset?.rows.length ?? 0;
          const active = selectedId === template.id;
          return (
            <div
              key={template.id}
              style={{
                ...cardStyle,
                borderColor: active ? "#1d4ed8" : "#e2e8f0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 950 }}>
                  {template.title}
                </h3>
                <span
                  style={{
                    background: active ? "#dbeafe" : "#eef2ff",
                    color: "#3730a3",
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontWeight: 900,
                  }}
                >
                  {count} תוצאות
                </span>
              </div>
              <div
                style={{
                  marginTop: 8,
                  color: "#64748b",
                  minHeight: 48,
                  lineHeight: 1.6,
                }}
              >
                {template.description}
              </div>
              <div
                style={{
                  marginTop: 12,
                  minHeight: 36,
                  color: count ? "#166534" : "#64748b",
                  fontWeight: 800,
                }}
              >
                {count
                  ? `נמצאו ${count} שורות לשיבוץ בריכוז.`
                  : "אין עדיין שורות לריכוז זה."}
              </div>
              <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setSelectedId(template.id)}
                  style={secondaryButtonStyle}
                >
                  הצג לפני הורדה
                </button>
                <button
                  type="button"
                  disabled={busyId === template.id}
                  onClick={() => downloadDataset(dataset)}
                  style={{
                    ...buttonStyle,
                    cursor: busyId === template.id ? "wait" : "pointer",
                    opacity: busyId === template.id ? 0.75 : 1,
                  }}
                >
                  {busyId === template.id
                    ? "מפיק Excel..."
                    : "הורד Excel לפי התצוגה"}
                </button>
                <div
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    direction: "ltr",
                    textAlign: "right",
                  }}
                >
                  {template.fileName}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 950 }}>
              בדיקה לפני הורדה: {selected.template.title}
            </h3>
            <div style={{ color: "#64748b", marginTop: 4 }}>
              השורות הבאות הן המקור להורדת Excel.
            </div>
          </div>
          <button
            type="button"
            disabled={busyId === selected.template.id}
            onClick={() => downloadDataset(selected)}
            style={buttonStyle}
          >
            הורד Excel לריכוז המוצג
          </button>
        </div>

        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 14,
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
            }}
          >
            <tbody>
              <tr>
                <th style={metaCell(true)}>שם פרויקט</th>
                <td style={metaCell()}>{meta.projectName}</td>
                <th style={metaCell(true)}>ניהול פרויקט</th>
                <td style={metaCell()}>{meta.projectManager}</td>
              </tr>
              <tr>
                <th style={metaCell(true)}>שם הקבלן</th>
                <td style={metaCell()}>{meta.contractor}</td>
                <th style={metaCell(true)}>הבטחת איכות</th>
                <td style={metaCell()}>{meta.qualityAssurance}</td>
              </tr>
              <tr>
                <th style={metaCell(true)}>בקרת איכות</th>
                <td style={metaCell()}>{meta.qualityControl}</td>
                <th style={metaCell(true)}>מס׳ שורות</th>
                <td style={metaCell()}>{selected.rows.length}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          style={{
            overflowX: "auto",
            border: "1px solid #e2e8f0",
            borderRadius: 14,
          }}
        >
          <table
            style={{
              minWidth: Math.max(900, selected.columns.length * 150),
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                {selected.columns.map((column) => (
                  <th
                    key={column.key}
                    style={{
                      background: "#dbeafe",
                      border: "1px solid #bfdbfe",
                      padding: 10,
                      fontWeight: 950,
                      textAlign: "center",
                      whiteSpace: "normal",
                    }}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selected.rows.length ? (
                selected.rows.slice(0, 50).map((row) => (
                  <tr key={row.id}>
                    {selected.columns.map((column) => (
                      <td
                        key={column.key}
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: 9,
                          verticalAlign: "top",
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.45,
                        }}
                      >
                        {row.values[column.key] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={selected.columns.length}
                    style={{
                      padding: 24,
                      textAlign: "center",
                      color: "#64748b",
                      fontWeight: 800,
                    }}
                  >
                    אין נתונים להצגה בריכוז זה.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {selected.rows.length > 50 ? (
          <div style={{ marginTop: 10, color: "#64748b", fontWeight: 800 }}>
            מוצגות 50 שורות ראשונות מתוך {selected.rows.length}. קובץ Excel כולל
            את כולן.
          </div>
        ) : null}
      </div>
    </section>
  );
}

const metaCell = (head = false): CSSProperties => ({
  border: "1px solid #e2e8f0",
  padding: "8px 10px",
  background: head ? "#f8fafc" : "#fff",
  fontWeight: head ? 950 : 800,
  textAlign: "right",
});

export default ConcentrationsSection;
