"use client";

import { useMemo, useState } from "react";
import JSZip from "jszip";
import type { LabCertificateResults } from "../lib/labCertificateParser";

type ProjectConcentrationMeta = {
  projectName?: string;
  projectManager?: string;
  contractor?: string;
  qualityAssurance?: string;
  qualityControl?: string;
};

type Props = {
  savedChecklists?: any[];
  savedNonconformances?: any[];
  savedTrialSections?: any[];
  savedPreliminary?: any[];
  currentProjectName?: string;
  projectMeta?: ProjectConcentrationMeta;
};

type SourceType = "checklists" | "nonconformances" | "trialSections" | "preliminary";

type ConcentrationTemplate = {
  id: string;
  title: string;
  fileName: string;
  description: string;
  keywords: string[];
  source: SourceType;
  mode?: "subbaseA" | "generic";
  preliminarySubtype?: "suppliers" | "subcontractors" | "materials";
};

type ConcentrationRow = {
  sourceType: SourceType;
  recordId: string;
  checklistNo: string;
  title: string;
  category: string;
  location: string;
  contractor: string;
  date: string;
  itemDescription: string;
  responsible: string;
  inspector: string;
  status: string;
  executionDate: string;
  notes: string;
  attachmentKind: string;
  certificateNo: string;
  fileName: string;
  uploadedAt: string;
  labResults?: LabCertificateResults;
  rawRecord?: any;
  rawItem?: any;
  rawAttachment?: any;
};

const templates: ConcentrationTemplate[] = [
  { id: "nonconformances", title: "דוח ריכוז אי התאמות", fileName: "non-conformance.xlsx", description: "ריכוז אי התאמות לפי הטופס המקורי", keywords: ["אי התאמה", "אי תאמות"], source: "nonconformances" },
  { id: "suppliers", title: "ריכוז ספקים", fileName: "suppliers.xlsx", description: "ריכוז ספקים לפי הטופס המקורי", keywords: ["ספק", "ספקים"], source: "preliminary", preliminarySubtype: "suppliers" },
  { id: "contractors", title: "ריכוז קבלנים", fileName: "contractors.xlsx", description: "ריכוז קבלנים לפי הטופס המקורי", keywords: ["קבלן", "קבלנים", "קבלן משנה"], source: "preliminary", preliminarySubtype: "subcontractors" },
  { id: "asphalt", title: "ריכוז בדיקות אספלט", fileName: "asphalt.xlsx", description: "בדיקות אספלט / FWD / מישוריות", keywords: ["אספלט", "FWD", "שכבה סופית", "מישוריות"], source: "checklists" },
  { id: "density", title: "ריכוז בדיקות צפיפות", fileName: "density.xlsx", description: "צפיפות / הידוק / רטיבות / מצעים", keywords: ["צפיפות", "הידוק", "רטיבות", "דרגת", "תכולת", "מצע", "מצעים"], source: "checklists" },
  { id: "concrete", title: "ריכוז בטון", fileName: "concrete.xlsx", description: "בדיקות בטון", keywords: ["בטון", "יציקה", "קוביות", "חוזק"], source: "checklists" },
  { id: "supervision", title: "ריכוז דוחות פיקוח עליון", fileName: "supervision.xlsx", description: "דוחות פיקוח עליון", keywords: ["פיקוח עליון", "דוח פיקוח"], source: "trialSections" },
  { id: "materials", title: "ריכוז חומרים", fileName: "materials.xlsx", description: "אישורי חומרים", keywords: ["חומר", "חומרים", "תקן", "מפרט", "תעודת התאמה"], source: "preliminary", preliminarySubtype: "materials" },
  { id: "trial-sections", title: "ריכוז קטעי ניסוי", fileName: "trial-sections.xlsx", description: "קטעי ניסוי", keywords: ["קטע ניסוי", "קטעי ניסוי"], source: "trialSections" },
  { id: "subbase-a", title: "ריכוז אפיון מצע א׳", fileName: "subbase-a.xlsx", description: "מצע א׳ — שורות 10-14 נשמרות בדיוק, שורה 15 מתמלאת מהתעודה המצורפת", keywords: ["אפיון מצע", "מצע א", "מצע א׳", "CBR", "גרדציה", "מצע"], source: "checklists", mode: "subbaseA" },
  { id: "selected-material", title: "ריכוז אפיון נברר", fileName: "selected-material.xlsx", description: "אפיון חומר נברר", keywords: ["נברר", "חומר נברר", "אפיון נברר", "CBR", "גרדציה"], source: "checklists" },
];

const excelNs = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const STORAGE_KEY = "yk-quality-stage4-multifile";
const PROJECT_TEAMS_STORAGE_KEY = `${STORAGE_KEY}-project-teams`;

const normalize = (value: unknown) =>
  String(value ?? "")
    .replace(/[׳`’']/g, "")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/[:：]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const includesAny = (text: string, keywords: string[]) => {
  const n = normalize(text);
  return keywords.some((keyword) => n.includes(normalize(keyword)));
};

const isApproved = (record: any) =>
  record?.status === "מאושר" ||
  record?.status === "approved" ||
  record?.status === "נעול" ||
  record?.approval?.status === "approved";

const attachmentLabel = (kind: unknown) =>
  kind === "lab" ? "תעודת מעבדה" : kind === "measurement" ? "רשימת מדידה" : "מסמך";

const getTemplateUrl = (fileName: string) => `/concentrations/${encodeURIComponent(fileName)}`;

const normalizeProjectKey = (value: unknown) =>
  String(value ?? "")
    .replace(/[׳`’']/g, "")
    .replace(/\s+/g, " ")
    .trim();

const buildProjectConcentrationMeta = (currentProjectName: string, projectMeta?: ProjectConcentrationMeta): Required<ProjectConcentrationMeta> => {
  const name = String(projectMeta?.projectName || currentProjectName || "").trim();
  const metaFromProps: Required<ProjectConcentrationMeta> = {
    projectName: name,
    projectManager: String(projectMeta?.projectManager ?? "").trim(),
    contractor: String(projectMeta?.contractor ?? "").trim(),
    qualityAssurance: String(projectMeta?.qualityAssurance ?? "").trim(),
    qualityControl: String(projectMeta?.qualityControl ?? "").trim(),
  };

  // גיבוי בטוח לפרויקט 806: ממלא את ראשי הריכוזים גם אם פרטי הפרויקט עדיין לא נשמרו בלוקל/סופאבייס.
  const applyKnownProjectFallback = (meta: Required<ProjectConcentrationMeta>): Required<ProjectConcentrationMeta> => {
    const normalizedName = normalizeProjectKey(meta.projectName || currentProjectName);
    if (!normalizedName.includes("806") && !normalizedName.includes("צלמון")) return meta;
    return {
      projectName: meta.projectName || "כביש 806 צלמון שלב א׳",
      projectManager: meta.projectManager || "א.ש. רונן הנדסה אזרחית בע״מ",
      contractor: meta.contractor || "מפלסי הגליל סלילה עפר ופיתוח בע״מ",
      qualityAssurance: meta.qualityAssurance || "תיקו הנדסה בע״מ",
      qualityControl: meta.qualityControl || "יונס אברהים",
    };
  };

  if (typeof window === "undefined") return applyKnownProjectFallback(metaFromProps);

  try {
    const raw = window.localStorage.getItem(PROJECT_TEAMS_STORAGE_KEY);
    const teams = raw ? JSON.parse(raw) : {};
    const key = normalizeProjectKey(name);
    const team = teams?.[key];
    if (!team || typeof team !== "object") return applyKnownProjectFallback(metaFromProps);

    return applyKnownProjectFallback({
      projectName: name,
      projectManager: String(projectMeta?.projectManager || team.managementCompany || "").trim(),
      contractor: String(projectMeta?.contractor || team.contractor || metaFromProps.contractor || "").trim(),
      qualityAssurance: String(projectMeta?.qualityAssurance || team.qualityAssurance || "").trim(),
      qualityControl: String(projectMeta?.qualityControl || team.qualityControl || "").trim(),
    });
  } catch {
    return applyKnownProjectFallback(metaFromProps);
  }
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

const recordText = (record: any) => {
  const parts: unknown[] = [record?.title, record?.category, record?.location, record?.contractor, record?.status, record?.description, record?.notes, record?.subtype];
  if (Array.isArray(record?.items)) {
    record.items.forEach((item: any) => {
      parts.push(item?.description, item?.notes, item?.status, item?.inspector, item?.responsible);
      if (Array.isArray(item?.attachments)) item.attachments.forEach((a: any) => parts.push(a?.name, a?.kind));
    });
  }
  if (record?.supplier) parts.push(record.supplier.supplierName, record.supplier.suppliedMaterial, record.supplier.notes, record.supplier.approvalNo);
  if (record?.subcontractor) parts.push(record.subcontractor.subcontractorName, record.subcontractor.field, record.subcontractor.notes, record.subcontractor.approvalNo);
  if (record?.material) parts.push(record.material.materialName, record.material.source, record.material.usage, record.material.notes, record.material.certificateNo);
  return parts.filter(Boolean).join(" ");
};

const isRelevantPreliminaryRecord = (record: any, template: ConcentrationTemplate) => {
  if (template.preliminarySubtype) return record?.subtype === template.preliminarySubtype;
  return includesAny(recordText(record), template.keywords);
};

const extractCertificateNo = (name: unknown) => {
  const text = String(name ?? "");
  const pdfPrefix = text.match(/pdf[.\-_\s]*(\d{3,})/i);
  if (pdfPrefix) return pdfPrefix[1];
  const longNumber = text.match(/(?:^|[^0-9])(\d{3,})(?:[^0-9]|$)/);
  return longNumber?.[1] ?? "";
};

const rowsFromChecklists = (checklists: any[], template: ConcentrationTemplate): ConcentrationRow[] => {
  const rows: ConcentrationRow[] = [];
  checklists.filter(isApproved).forEach((checklist) => {
    (Array.isArray(checklist?.items) ? checklist.items : []).forEach((item: any) => {
      const attachments = Array.isArray(item?.attachments) ? item.attachments : [];
      attachments.forEach((attachment: any) => {
        const labResults = attachment?.labResults ?? attachment?.results ?? item?.labResults ?? item?.results;
        const fullText = [recordText(checklist), item?.description, item?.notes, attachment?.name, attachment?.kind, JSON.stringify(labResults ?? {})].join(" ");
        if (!includesAny(fullText, template.keywords)) return;
        rows.push({
          sourceType: "checklists",
          recordId: String(checklist?.id ?? ""),
          checklistNo: String(checklist?.checklistNo ?? ""),
          title: String(checklist?.title ?? ""),
          category: String(checklist?.category ?? ""),
          location: String(checklist?.location ?? ""),
          contractor: String(checklist?.contractor ?? ""),
          date: String(checklist?.date ?? ""),
          itemDescription: String(item?.description ?? ""),
          responsible: String(item?.responsible ?? ""),
          inspector: String(item?.inspector ?? ""),
          status: String(item?.status ?? ""),
          executionDate: String(item?.executionDate ?? ""),
          notes: String(item?.notes ?? ""),
          attachmentKind: attachmentLabel(attachment?.kind),
          certificateNo: String((labResults as any)?.certificateNo ?? extractCertificateNo(attachment?.name)),
          fileName: String(attachment?.name ?? ""),
          uploadedAt: String(attachment?.uploadedAt ?? ""),
          labResults,
          rawRecord: checklist,
          rawItem: item,
          rawAttachment: attachment,
        });
      });
    });
  });
  return rows;
};

const rowsFromSimpleRecords = (records: any[], template: ConcentrationTemplate, sourceType: SourceType): ConcentrationRow[] =>
  records
    .filter(isApproved)
    .filter((record) => sourceType === "preliminary" ? isRelevantPreliminaryRecord(record, template) : includesAny(recordText(record), template.keywords))
    .map((record) => ({
      sourceType,
      recordId: String(record?.id ?? ""),
      checklistNo: "",
      title: String(record?.title ?? record?.supplier?.supplierName ?? record?.subcontractor?.subcontractorName ?? record?.material?.materialName ?? ""),
      category: String(record?.subtype ?? ""),
      location: String(record?.location ?? ""),
      contractor: String(record?.contractor ?? record?.supplier?.supplierName ?? record?.subcontractor?.subcontractorName ?? ""),
      date: String(record?.date ?? ""),
      itemDescription: String(record?.description ?? record?.spec ?? record?.material?.usage ?? record?.supplier?.suppliedMaterial ?? record?.subcontractor?.field ?? ""),
      responsible: String(record?.approvedBy ?? record?.raisedBy ?? record?.approval?.signatures?.[0]?.signerName ?? ""),
      inspector: String(record?.approvedBy ?? record?.raisedBy ?? record?.approval?.signatures?.[0]?.signerName ?? ""),
      status: String(record?.status ?? record?.approval?.status ?? ""),
      executionDate: String(record?.date ?? ""),
      notes: String(record?.notes ?? record?.actionRequired ?? record?.supplier?.notes ?? record?.subcontractor?.notes ?? record?.material?.notes ?? ""),
      attachmentKind: "רשומה",
      certificateNo: String(record?.supplier?.approvalNo ?? record?.subcontractor?.approvalNo ?? record?.material?.certificateNo ?? ""),
      fileName: "",
      uploadedAt: String(record?.savedAt ?? ""),
      rawRecord: record,
    }));

type SubbaseAValues = {
  sieve3?: number;
  sieve15?: number;
  sieve34?: number;
  sieve4?: number;
  sieve10?: number;
  sieve40?: number;
  sieve200?: number;
  ll?: string | number;
  pl?: string | number;
  pi?: string | number;
  swelling?: number;
  density?: number;
  absorption?: number;
  losAngeles?: number | string;
  aashto?: string;
  maxDensity?: number;
  optimumMoisture?: number;
};

const numberFromResult = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const extractNumberByAliases = (text: string, aliases: string[]) => {
  const source = String(text ?? "");
  for (const alias of aliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`${escaped}\\s*[:=\\-]?\\s*([0-9]+(?:[.,][0-9]+)?)`, "i");
    const match = source.match(re);
    if (match) return Number(match[1].replace(",", "."));
  }
  return undefined;
};

const subbaseValuesFromLabResults = (results?: LabCertificateResults): SubbaseAValues | null => {
  if (!results) return null;
  const r = results as any;
  return {
    sieve3: numberFromResult(r.sieve3),
    sieve15: numberFromResult(r.sieve15),
    sieve34: numberFromResult(r.sieve34),
    sieve4: numberFromResult(r.sieve4),
    sieve10: numberFromResult(r.sieve10),
    sieve40: numberFromResult(r.sieve40),
    sieve200: numberFromResult(r.sieve200),
    ll: numberFromResult(r.ll),
    pl: numberFromResult(r.pl),
    pi: numberFromResult(r.pi),
    swelling: numberFromResult(r.sandEquivalent),
    density: numberFromResult(r.specificGravity),
    absorption: numberFromResult(r.absorption),
    losAngeles: numberFromResult(r.losAngeles),
    aashto: r.aashto ?? "",
    maxDensity: numberFromResult(r.maxDensity),
    optimumMoisture: numberFromResult(r.optimumMoisture),
  };
};

const parseSubbaseAValues = (row: ConcentrationRow): SubbaseAValues => {
  const fromSavedResults = subbaseValuesFromLabResults(row.labResults);
  if (fromSavedResults) return fromSavedResults;
  const text = [row.notes, row.itemDescription, row.fileName, row.title, row.category].join(" ");
  return {
    sieve3: extractNumberByAliases(text, ['3"', "3 in", "sieve3", "נפה 3"]),
    sieve15: extractNumberByAliases(text, ['1.5"', "1.5", "sieve15", "נפה 1.5"]),
    sieve34: extractNumberByAliases(text, ["3/4", '3/4"', "sieve34", "נפה 3/4"]),
    sieve4: extractNumberByAliases(text, ["#4", "נפה 4"]),
    sieve10: extractNumberByAliases(text, ["#10", "נפה 10"]),
    sieve40: extractNumberByAliases(text, ["#40", "נפה 40"]),
    sieve200: extractNumberByAliases(text, ["#200", "נפה 200"]),
    ll: extractNumberByAliases(text, ["LL", "גבול נזילות"]),
    pl: extractNumberByAliases(text, ["PL", "גבול פלסטיות"]),
    pi: extractNumberByAliases(text, ["PI", "אינדקס פלסטיות"]),
    swelling: extractNumberByAliases(text, ["שעמ", "שעח", "swelling"]),
    density: extractNumberByAliases(text, ["צפיפות ממשית", "density"]),
    absorption: extractNumberByAliases(text, ["ספיגות", "absorption"]),
    losAngeles: extractNumberByAliases(text, ["לוס אנגלס", "los angeles", "LA"]),
    aashto: (text.match(/A-\d-a?\s*\(?\d?\)?/i)?.[0] ?? "").trim(),
    maxDensity: extractNumberByAliases(text, ["צפיפות מעבדתית", "max density"]),
    optimumMoisture: extractNumberByAliases(text, ["רטיבות אופטימלית", "omc"]),
  };
};

const valueOrDefault = (value: unknown, fallback: string | number = ""): string | number => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "number" || typeof value === "string") return value;
  return String(value);
};

const evaluateSubbaseA = (v: SubbaseAValues) => {
  const checks: Array<boolean | null> = [
    v.sieve3 === undefined ? null : v.sieve3 >= 100,
    v.sieve15 === undefined ? null : v.sieve15 >= 80,
    v.sieve34 === undefined ? null : v.sieve34 >= 60 && v.sieve34 <= 85,
    v.sieve4 === undefined ? null : v.sieve4 >= 30 && v.sieve4 <= 55,
    v.sieve10 === undefined ? null : v.sieve10 >= 20 && v.sieve10 <= 40,
    v.sieve200 === undefined ? null : v.sieve200 >= 5 && v.sieve200 <= 15,
    typeof v.ll !== "number" ? null : v.ll <= 25,
    typeof v.pi !== "number" ? null : v.pi <= 6,
    typeof v.losAngeles !== "number" ? null : v.losAngeles <= 35,
  ];
  const populated = checks.filter((item) => item !== null) as boolean[];
  if (!populated.length) return "OK";
  return populated.every(Boolean) ? "OK" : "NC";
};

const SUBBASE_A_FIXED_CELLS: Record<string, string | number> = {
  H2: " דו\"ח ריכוז בדיקות  איפיון למצע סוג א' ",
  H4: "שם פרויקט:", H5: "ניהול פרויקט:", H6: "שם הקבלן:", H7: "בקרת איכות:", L7: "הבטחת איכות:",
  A10: "מס' סידורי", B10: "ביצוע ע\"י ", C10: "מס' ר.ת.", D10: "תאריך ", E10: "מקור החומר", F10: "מקום נטילת מדגם לבדיקה", G10: "מקום הפיזור", J10: "דירוג (  % עובר )", Q10: "גבולות פלסטיות וסומך (%)", T10: "שע\"ח (%)", U10: "אגרגט גס", W10: " לוס אנג'לס (%)", X10: " מיון AASHTO", Y10: "צפיפות מעבדתית מקסימלית", Z10: "רטיבות אופטימלית", AA10: "מספר תעודה", AB10: "מעמד החומר", AC10: "הערות",
  J11: '3"', K11: '"1.5', L11: '"3/4 ', M11: "#4", N11: "#10", O11: "#40", P11: "#200", Q11: "LL", R11: "PL", S11: "PI", U11: "צפיפות ממשית (ט/מ\"ק) ", V11: "ספיגות (%)",
  J12: "דרישות המפרט", B13: "QC/QA", G13: "מבנה", H13: "חתכים", K13: 100, L13: 85, M13: 55, N13: 40, P13: 15, Q13: 25, S13: 6, T13: 27, U13: 2.3, W13: "35 max", H14: "התחלה", I14: "סוף", J14: 100, K14: 80, L14: 60, M14: 30, N14: 20, P14: 5,
};

const buildSubbaseARow15 = (row: ConcentrationRow | undefined, projectMeta: Required<ProjectConcentrationMeta>): Record<string, string | number> => {
  const values = row ? parseSubbaseAValues(row) : {};
  const certificateNo = row?.certificateNo || "";
  const result = evaluateSubbaseA(values);
  return {
    J4: projectMeta.projectName || row?.title || "", J5: projectMeta.projectManager || "", J6: projectMeta.contractor || row?.contractor || "", J7: projectMeta.qualityControl || "", M7: projectMeta.qualityAssurance || "",
    A15: 1, B15: row?.inspector || row?.responsible || "QC", C15: row?.checklistNo || 1, D15: row?.executionDate || row?.date || "", E15: row?.notes || "", F15: row?.location || "", G15: projectMeta.projectName || row?.itemDescription || "", H15: "", I15: "",
    J15: String(valueOrDefault(values.sieve3, "")), K15: String(valueOrDefault(values.sieve15, "")), L15: String(valueOrDefault(values.sieve34, "")), M15: String(valueOrDefault(values.sieve4, "")), N15: String(valueOrDefault(values.sieve10, "")), O15: String(valueOrDefault(values.sieve40, "")), P15: String(valueOrDefault(values.sieve200, "")), Q15: String(valueOrDefault(values.ll, "")), R15: String(valueOrDefault(values.pl, "")), S15: String(valueOrDefault(values.pi, "")), T15: valueOrDefault(values.swelling, ""), U15: valueOrDefault(values.density, ""), V15: valueOrDefault(values.absorption, ""), W15: valueOrDefault(values.losAngeles, ""), X15: valueOrDefault(values.aashto, ""), Y15: valueOrDefault(values.maxDensity, ""), Z15: valueOrDefault(values.optimumMoisture, ""), AA15: certificateNo, AB15: result, AC15: row?.notes || "",
  };
};

const columnNumber = (letters: string) => {
  let number = 0;
  for (const letter of letters.toUpperCase()) number = number * 26 + letter.charCodeAt(0) - 64;
  return number;
};

const columnLetters = (index: number) => {
  let n = index;
  let letters = "";
  while (n > 0) {
    const mod = (n - 1) % 26;
    letters = String.fromCharCode(65 + mod) + letters;
    n = Math.floor((n - mod) / 26);
  }
  return letters;
};

const cellColumnIndex = (cellRef: string) => columnNumber(cellRef.replace(/\d+/g, ""));
const cellRowIndex = (cellRef: string) => Number(cellRef.replace(/\D+/g, ""));
const cellRef = (col: number, row: number) => `${columnLetters(col)}${row}`;

const getOrCreateRow = (doc: Document, sheetData: Element, rowNumber: number) => {
  const rows = Array.from(sheetData.getElementsByTagNameNS(excelNs, "row"));
  let row = rows.find((candidate) => candidate.getAttribute("r") === String(rowNumber));
  if (row) return row;
  row = doc.createElementNS(excelNs, "row");
  row.setAttribute("r", String(rowNumber));
  const nextRow = rows.find((candidate) => Number(candidate.getAttribute("r")) > rowNumber);
  sheetData.insertBefore(row, nextRow ?? null);
  return row;
};

const getOrCreateCell = (doc: Document, row: Element, ref: string) => {
  const cells = Array.from(row.getElementsByTagNameNS(excelNs, "c"));
  let cell = cells.find((candidate) => candidate.getAttribute("r") === ref);
  if (cell) return cell;
  cell = doc.createElementNS(excelNs, "c");
  cell.setAttribute("r", ref);
  const nextCell = cells.find((candidate) => cellColumnIndex(candidate.getAttribute("r") ?? "A1") > cellColumnIndex(ref));
  row.insertBefore(cell, nextCell ?? null);
  return cell;
};

const setCell = (doc: Document, sheetData: Element, ref: string, value: string | number, styleId?: string) => {
  const row = getOrCreateRow(doc, sheetData, cellRowIndex(ref));
  const cell = getOrCreateCell(doc, row, ref);
  Array.from(cell.childNodes).forEach((child) => cell.removeChild(child));
  if (styleId) cell.setAttribute("s", styleId);

  if (typeof value === "number") {
    cell.setAttribute("t", "n");
    const v = doc.createElementNS(excelNs, "v");
    v.textContent = String(value);
    cell.appendChild(v);
  } else {
    cell.setAttribute("t", "inlineStr");
    const is = doc.createElementNS(excelNs, "is");
    const t = doc.createElementNS(excelNs, "t");
    t.setAttribute("xml:space", "preserve");
    t.textContent = value;
    is.appendChild(t);
    cell.appendChild(is);
  }
};

const nextCellRef = (ref: string) => `${columnLetters(cellColumnIndex(ref) + 1)}${cellRowIndex(ref)}`;

const readSharedStrings = async (zip: JSZip) => {
  const file = zip.file("xl/sharedStrings.xml");
  if (!file) return [] as string[];
  const xml = await file.async("text");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(doc.getElementsByTagNameNS(excelNs, "si")).map((si) =>
    Array.from(si.getElementsByTagNameNS(excelNs, "t")).map((t) => t.textContent ?? "").join("")
  );
};

const cellText = (cell: Element, sharedStrings: string[]) => {
  const type = cell.getAttribute("t");
  if (type === "s") {
    const index = Number(cell.getElementsByTagNameNS(excelNs, "v")[0]?.textContent ?? -1);
    return sharedStrings[index] ?? "";
  }
  if (type === "inlineStr") {
    return Array.from(cell.getElementsByTagNameNS(excelNs, "t")).map((t) => t.textContent ?? "").join("");
  }
  return cell.getElementsByTagNameNS(excelNs, "v")[0]?.textContent ?? "";
};

const collectAttachmentNames = (value: any, names: string[], depth = 0) => {
  if (!value || depth > 6) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectAttachmentNames(item, names, depth + 1));
    return;
  }
  if (typeof value !== "object") return;

  const name = String(value.name ?? value.fileName ?? value.attachmentName ?? value.originalName ?? value.title ?? "").trim();
  const looksLikeFile = Boolean(value.dataUrl || value.url || value.path || value.type || value.uploadedAt || value.attachedAt || value.attachmentName);
  if (name && looksLikeFile) names.push(name);

  Object.entries(value).forEach(([key, nested]) => {
    if (["approval", "signature", "signatures"].includes(key)) return;
    collectAttachmentNames(nested, names, depth + 1);
  });
};

const attachedFilesText = (record: any, row?: ConcentrationRow) => {
  const names: string[] = [];
  collectAttachmentNames(record, names);
  if (row?.fileName) names.push(row.fileName);
  if (row?.rawAttachment?.name) names.push(row.rawAttachment.name);
  if (row?.rawItem?.attachments) {
    row.rawItem.attachments.forEach((att: any) => {
      if (att?.name) names.push(att.name);
    });
  }
  return Array.from(new Set(names.map((name) => name.trim()).filter(Boolean))).join(", ");
};

const looksLikeIso = (text: unknown) => /\biso\b|איזו|ISO|9001/i.test(String(text ?? ""));

const splitDocumentNames = (docs: string) =>
  docs
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

const withoutExtension = (name: string) => name.replace(/\.[a-z0-9]{2,5}$/i, "").trim();

const isoCertificateLabel = (docs: string) => {
  const iso = splitDocumentNames(docs).find(looksLikeIso);
  return iso ? withoutExtension(iso) : "";
};

const nonIsoDocumentsText = (docs: string) => splitDocumentNames(docs).filter((name) => !looksLikeIso(name)).join(", ");
const isoDocumentsText = (docs: string) => splitDocumentNames(docs).filter(looksLikeIso).join(", ");

const normalizeKey = (value: unknown) =>
  String(value ?? "")
    .replace(/[׳`’']/g, "")
    .replace(/[\s_\-]+/g, "")
    .trim()
    .toLowerCase();

const deepFindValue = (value: any, keys: string[], depth = 0): string => {
  if (!value || depth > 6) return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFindValue(item, keys, depth + 1);
      if (found) return found;
    }
    return "";
  }
  if (typeof value !== "object") return "";
  const normalizedKeys = keys.map(normalizeKey);
  for (const [key, nested] of Object.entries(value)) {
    const nk = normalizeKey(key);
    if (normalizedKeys.some((wanted) => nk === wanted || nk.includes(wanted))) {
      if (nested !== null && nested !== undefined && String(nested).trim() !== "") return String(nested).trim();
    }
  }
  for (const [key, nested] of Object.entries(value)) {
    if (["signature", "signatures"].includes(key)) continue;
    const found = deepFindValue(nested, keys, depth + 1);
    if (found) return found;
  }
  return "";
};

const firstNonEmpty = (...values: unknown[]) => {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
};

const approvalNumberFromRecord = (record: any, fallback: number) => {
  const fromFields = firstNonEmpty(
    record?.approvalNo,
    record?.approvalNumber,
    record?.preliminaryNo,
    record?.supplier?.approvalNo,
    record?.supplier?.approvalNumber,
    record?.subcontractor?.approvalNo,
    record?.subcontractor?.approvalNumber,
    record?.material?.certificateNo,
    deepFindValue(record, ["approvalNo", "approvalNumber", "preliminaryNo", "מספר אישור", "אישור מס"])
  );
  if (fromFields) return fromFields;
  const titleMatch = String(record?.title ?? "").match(/(?:מס[׳'’]?|#)?\s*(\d+)/);
  return titleMatch?.[1] ?? String(fallback);
};

const certificateNumberFromDocs = (docs: string) => {
  const first = splitDocumentNames(docs)[0] ?? "";
  return first ? withoutExtension(first) : "";
};

const clearCellValue = (cell: Element) => {
  Array.from(cell.childNodes).forEach((child) => cell.removeChild(child));
  cell.removeAttribute("t");
};

const clearRowsContent = (sheetData: Element, fromRow: number, toRow: number) => {
  Array.from(sheetData.getElementsByTagNameNS(excelNs, "c")).forEach((cell) => {
    const ref = cell.getAttribute("r") ?? "";
    if (!ref) return;
    const row = cellRowIndex(ref);
    if (row >= fromRow && row <= toRow) clearCellValue(cell);
  });
};

const applyProjectHeaderCells = (doc: Document, sheetData: Element, sharedStrings: string[], meta: Required<ProjectConcentrationMeta>) => {
  const items: Array<{ label: string; value: string; fallbacks: Array<[string, string]> }> = [
    { label: "שם פרויקט", value: meta.projectName, fallbacks: [["H5", "J5"], ["G5", "I5"], ["A5", "B5"]] },
    { label: "ניהול פרויקט", value: meta.projectManager, fallbacks: [["H6", "J6"], ["G6", "I6"], ["A6", "B6"]] },
    { label: "שם הקבלן", value: meta.contractor, fallbacks: [["H7", "J7"], ["G7", "I7"], ["A7", "B7"]] },
    { label: "הבטחת איכות", value: meta.qualityAssurance, fallbacks: [["H8", "J8"], ["G8", "I8"], ["A8", "B8"]] },
    { label: "בקרת איכות", value: meta.qualityControl, fallbacks: [["H9", "J9"], ["G9", "I9"], ["A9", "B9"]] },
  ];

  const allCells = Array.from(sheetData.getElementsByTagNameNS(excelNs, "c"));
  items.forEach((item) => {
    if (!item.value) return;
    allCells.forEach((cell) => {
      const ref = cell.getAttribute("r") ?? "";
      if (!ref) return;
      const row = cellRowIndex(ref);
      if (row < 5 || row > 9) return;
      const text = normalize(cellText(cell, sharedStrings)).replace(/[:：]/g, "");
      if (!text || !text.includes(normalize(item.label))) return;
      setCell(doc, sheetData, ref, `${item.label}:`, cell.getAttribute("s") ?? undefined);
      setCell(doc, sheetData, nextCellRef(ref), item.value);
    });

    // גיבוי קשיח לתבניות הקיימות: ממלא את שורות פרטי הפרויקט גם אם התא הממוזג/RTL לא זוהה.
    item.fallbacks.forEach(([labelCell, valueCell]) => {
      setCell(doc, sheetData, labelCell, `${item.label}:`);
      setCell(doc, sheetData, valueCell, item.value);
    });
  });
};

const patchWorkbookProjectHeader = async (buffer: ArrayBuffer, meta: Required<ProjectConcentrationMeta>) => {
  const zip = await JSZip.loadAsync(buffer);
  const sharedStrings = await readSharedStrings(zip);
  const worksheetPaths = Object.keys(zip.files).filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path));

  for (const sheetPath of worksheetPaths) {
    const worksheetFile = zip.file(sheetPath);
    if (!worksheetFile) continue;
    const xml = await worksheetFile.async("text");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const sheetData = doc.getElementsByTagNameNS(excelNs, "sheetData")[0];
    if (!sheetData) continue;
    applyProjectHeaderCells(doc, sheetData, sharedStrings, meta);
    zip.file(sheetPath, new XMLSerializer().serializeToString(doc));
  }

  return zip;
};

const patchSubbaseAWorkbook = async (buffer: ArrayBuffer, row: ConcentrationRow | undefined, projectMeta: Required<ProjectConcentrationMeta>) => {
  const zip = await patchWorkbookProjectHeader(buffer, projectMeta);
  const sheetPath = "xl/worksheets/sheet1.xml";
  const worksheetFile = zip.file(sheetPath);
  if (!worksheetFile) throw new Error("לא נמצא sheet1.xml בתוך קובץ מצע א׳");
  const xml = await worksheetFile.async("text");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const sheetData = doc.getElementsByTagNameNS(excelNs, "sheetData")[0];
  if (!sheetData) throw new Error("מבנה Excel לא תקין — sheetData חסר");

  Object.entries(SUBBASE_A_FIXED_CELLS).forEach(([cell, value]) => setCell(doc, sheetData, cell, value));
  Object.entries(buildSubbaseARow15(row, projectMeta)).forEach(([cell, value]) => setCell(doc, sheetData, cell, value));

  zip.file(sheetPath, new XMLSerializer().serializeToString(doc));
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
};

const parseMergeRef = (ref: string) => {
  const [start, end] = ref.split(":");
  return {
    startCol: cellColumnIndex(start),
    startRow: cellRowIndex(start),
    endCol: cellColumnIndex(end ?? start),
    endRow: cellRowIndex(end ?? start),
  };
};

const findGroupRange = (doc: Document, sheetData: Element, sharedStrings: string[], labels: string[]) => {
  const cells = Array.from(sheetData.getElementsByTagNameNS(excelNs, "c"));
  const target = cells.find((cell) => labels.some((label) => normalize(cellText(cell, sharedStrings)).includes(normalize(label))));
  if (!target) return null;
  const ref = target.getAttribute("r") ?? "";
  const targetCol = cellColumnIndex(ref);
  const targetRow = cellRowIndex(ref);
  const mergeCells = Array.from(doc.getElementsByTagNameNS(excelNs, "mergeCell"));
  const merge = mergeCells
    .map((m) => parseMergeRef(m.getAttribute("ref") ?? ""))
    .find((r) => targetCol >= r.startCol && targetCol <= r.endCol && targetRow >= r.startRow && targetRow <= r.endRow);
  return merge ?? { startCol: targetCol, startRow: targetRow, endCol: targetCol + 3, endRow: targetRow };
};

const renameHeader = (doc: Document, sheetData: Element, sharedStrings: string[], fromLabels: string[], toLabel: string) => {
  Array.from(sheetData.getElementsByTagNameNS(excelNs, "c")).forEach((cell) => {
    const ref = cell.getAttribute("r") ?? "";
    if (!ref) return;
    const current = cellText(cell, sharedStrings);
    if (fromLabels.some((label) => normalize(current).includes(normalize(label)))) setCell(doc, sheetData, ref, toLabel, cell.getAttribute("s") ?? undefined);
  });
};

const findColumn = (sheetData: Element, sharedStrings: string[], labels: string[], rowMin = 1, rowMax = 25, fromCol = 1, toCol = 200) => {
  const cells = Array.from(sheetData.getElementsByTagNameNS(excelNs, "c"));
  for (const cell of cells) {
    const ref = cell.getAttribute("r") ?? "";
    if (!ref) continue;
    const row = cellRowIndex(ref);
    const col = cellColumnIndex(ref);
    if (row < rowMin || row > rowMax || col < fromCol || col > toCol) continue;
    const text = normalize(cellText(cell, sharedStrings));
    if (labels.some((label) => text.includes(normalize(label)))) return col;
  }
  return 0;
};

const findColumnRightmost = (sheetData: Element, sharedStrings: string[], labels: string[], rowMin = 1, rowMax = 25) => {
  let best = 0;
  Array.from(sheetData.getElementsByTagNameNS(excelNs, "c")).forEach((cell) => {
    const ref = cell.getAttribute("r") ?? "";
    if (!ref) return;
    const row = cellRowIndex(ref);
    if (row < rowMin || row > rowMax) return;
    const text = normalize(cellText(cell, sharedStrings));
    if (labels.some((label) => text.includes(normalize(label)))) best = Math.max(best, cellColumnIndex(ref));
  });
  return best;
};

const findColumnInGroup = (sheetData: Element, sharedStrings: string[], group: ReturnType<typeof findGroupRange>, labels: string[]) => {
  if (!group) return 0;
  return findColumn(sheetData, sharedStrings, labels, group.startRow, group.startRow + 3, group.startCol, group.endCol);
};

const rowStyleMap = (sheetData: Element, rowNumber = 13) => {
  const styles: Record<number, string> = {};
  const row = Array.from(sheetData.getElementsByTagNameNS(excelNs, "row")).find((candidate) => candidate.getAttribute("r") === String(rowNumber));
  if (!row) return styles;
  Array.from(row.getElementsByTagNameNS(excelNs, "c")).forEach((cell) => {
    const ref = cell.getAttribute("r") ?? "";
    const s = cell.getAttribute("s") ?? "";
    if (ref && s) styles[cellColumnIndex(ref)] = s;
  });
  return styles;
};

const clearTableRows = (sheetData: Element, fromRow = 13, toRow = 500) => {
  Array.from(sheetData.getElementsByTagNameNS(excelNs, "row")).forEach((row) => {
    const n = Number(row.getAttribute("r") ?? 0);
    if (n >= fromRow && n <= toRow) row.parentNode?.removeChild(row);
  });
};

const setByColumn = (doc: Document, sheetData: Element, row: number, col: number, value: unknown, styles: Record<number, string>) => {
  if (!col) return;
  const v = value === null || value === undefined ? "" : value;
  if (v === "") return;
  setCell(doc, sheetData, cellRef(col, row), typeof v === "number" ? v : String(v), styles[col]);
};

const approvalSignerName = (record: any) =>
  String(record?.approval?.signatures?.find?.((s: any) => s?.signerName)?.signerName ?? record?.approvedBy ?? "יונס אברהים");

const approvalDate = (record: any) =>
  String(record?.approval?.signatures?.find?.((s: any) => s?.signedAt)?.signedAt ?? record?.date ?? "");

const patchPreliminaryWorkbook = async (buffer: ArrayBuffer, rows: ConcentrationRow[], template: ConcentrationTemplate, projectMeta: Required<ProjectConcentrationMeta>) => {
  const zip = await patchWorkbookProjectHeader(buffer, projectMeta);
  const sheetPath = "xl/worksheets/sheet1.xml";
  const worksheetFile = zip.file(sheetPath);
  if (!worksheetFile) throw new Error("לא נמצא sheet1.xml");
  const xml = await worksheetFile.async("text");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const sheetData = doc.getElementsByTagNameNS(excelNs, "sheetData")[0];
  if (!sheetData) throw new Error("מבנה Excel לא תקין — sheetData חסר");
  const sharedStrings = await readSharedStrings(zip);
  // לא מוחקים את הכותרת העליונה המקורית של התבנית. רק ממלאים את פרטי הפרויקט.
  applyProjectHeaderCells(doc, sheetData, sharedStrings, projectMeta);
  const styles = rowStyleMap(sheetData, 13);

  const isContractors = template.id === "contractors";
  const isSuppliers = template.id === "suppliers";

  if (isContractors) renameHeader(doc, sheetData, sharedStrings, ["סיווג ברשם הקבלנים"], "סיווג ברשם הקבלנים/תעודות");

  const registrationGroup = isContractors
    ? findGroupRange(doc, sheetData, sharedStrings, ["סיווג ברשם הקבלנים", "סיווג ברשם הקבלנים/תעודות"])
    : findGroupRange(doc, sheetData, sharedStrings, ["אישור תי", "רשיון", "הסמכות"]);
  const isoGroup = findGroupRange(doc, sheetData, sharedStrings, ["תעודת ISO", "ISO"]);

  const columns = {
    approval: findColumnRightmost(sheetData, sharedStrings, ["אישור מס"], 10, 13) || findColumnRightmost(sheetData, sharedStrings, ["מס סידורי", "מס' סידורי"], 10, 13) || 1,
    serial: findColumn(sheetData, sharedStrings, ["מס סידורי", "מס' סידורי"], 10, 13),
    contractorName: isContractors
      ? findColumn(sheetData, sharedStrings, ["שם קבלן משנה", "שם הקבלן"], 10, 13)
      : findColumn(sheetData, sharedStrings, ["שם ספק"], 10, 13),
    activity: isContractors
      ? findColumn(sheetData, sharedStrings, ["תחום פעילות"], 10, 13)
      : findColumn(sheetData, sharedStrings, ["חומר מסופק"], 10, 13),
    phone: findColumn(sheetData, sharedStrings, ["אנשי קשר וטלפון", "טלפון"], 10, 13),
    subProject: findColumn(sheetData, sharedStrings, ["תת פרויקט"], 10, 13),
    regExists: findColumnInGroup(sheetData, sharedStrings, registrationGroup, ["קיים/לא", "קיים"]),
    regNumber: findColumnInGroup(sheetData, sharedStrings, registrationGroup, ["מס תעודה", "מס' תעודה", "מספר"]),
    regExpiry: findColumnInGroup(sheetData, sharedStrings, registrationGroup, ["תוקף"]),
    regDocs: findColumnInGroup(sheetData, sharedStrings, registrationGroup, ["מסמכים מצורפים", "מסמכים"]),
    isoExists: findColumnInGroup(sheetData, sharedStrings, isoGroup, ["קיים/לא", "קיים"]),
    isoNumber: findColumnInGroup(sheetData, sharedStrings, isoGroup, ["מס תעודה", "מס' תעודה", "מספר"]),
    isoExpiry: findColumnInGroup(sheetData, sharedStrings, isoGroup, ["תוקף"]),
    isoDocs: findColumnInGroup(sheetData, sharedStrings, isoGroup, ["מסמכים מצורפים", "מסמכים"]),
    qaDate: findColumn(sheetData, sharedStrings, ["תאריך אישור ב\"א", "תאריך אישור בא"], 10, 13),
    qaName: findColumn(sheetData, sharedStrings, ["שם המאשר ב\"א", "שם המאשר בא"], 10, 13),
    assuranceDate: findColumn(sheetData, sharedStrings, ["תאריך אישור ה\"א", "תאריך אישור הא"], 10, 13),
    assuranceName: findColumn(sheetData, sharedStrings, ["שם המאשר ה\"א", "שם המאשר הא"], 10, 13),
  };

  clearTableRows(sheetData, 13, 500);

  const rowsToWrite = [...rows].sort((a, b) => {
    const aNo = Number(approvalNumberFromRecord(a.rawRecord ?? {}, 0));
    const bNo = Number(approvalNumberFromRecord(b.rawRecord ?? {}, 0));
    if (Number.isFinite(aNo) && Number.isFinite(bNo) && aNo !== bNo) return aNo - bNo;
    return String(a.rawRecord?.savedAt ?? a.uploadedAt ?? a.date ?? '').localeCompare(String(b.rawRecord?.savedAt ?? b.uploadedAt ?? b.date ?? ''));
  });

  rowsToWrite.forEach((row, index) => {
    const record = row.rawRecord ?? {};
    const supplier = record.supplier ?? {};
    const subcontractor = record.subcontractor ?? {};
    const material = record.material ?? {};
    const docs = attachedFilesText(record, row);
    const isoDocs = isoDocumentsText(docs);
    const nonIsoDocs = nonIsoDocumentsText(docs);
    const rowNumber = 13 + index;
    const approvalNo = approvalNumberFromRecord(record, index + 1);
    const supplierRegistrationNumber = firstNonEmpty(
      supplier.standardCertificateNo,
      supplier.tiCertificateNo,
      supplier.tavTekenCertificateNo,
      supplier.licenseNo,
      supplier.accreditationNo,
      deepFindValue(record, ["standardCertificateNo", "tiCertificateNo", "tavTekenCertificateNo", "licenseNo", "accreditationNo", "מס תעודת תי", "מספר תי", "מספר הסמכה", "מספר רשיון"]),
      certificateNumberFromDocs(nonIsoDocs)
    );
    const supplierRegistrationExpiry = firstNonEmpty(
      supplier.standardValidUntil,
      supplier.tiValidUntil,
      supplier.tavTekenValidUntil,
      supplier.licenseValidUntil,
      supplier.accreditationValidUntil,
      deepFindValue(record, ["standardValidUntil", "tiValidUntil", "tavTekenValidUntil", "licenseValidUntil", "accreditationValidUntil", "תוקף תי", "תוקף הסמכה", "תוקף רשיון"])
    );
    const contractorRegistrationNumber = firstNonEmpty(
      subcontractor.registrationNo,
      subcontractor.contractorRegistrationNo,
      subcontractor.certificateNo,
      isContractors ? approvalNo : "",
      deepFindValue(record, ["registrationNo", "contractorRegistrationNo", "מס תעודה", "מספר תעודה", "רשם הקבלנים"]),
      certificateNumberFromDocs(nonIsoDocs || docs)
    );
    const contractorRegistrationExpiry = firstNonEmpty(
      subcontractor.validUntil,
      subcontractor.registrationValidUntil,
      deepFindValue(record, ["registrationValidUntil", "validUntil", "expiry", "תוקף רשם", "תוקף"])
    );
    const registrationNumber = isSuppliers ? supplierRegistrationNumber : (isContractors ? contractorRegistrationNumber : firstNonEmpty(material.certificateNo, certificateNumberFromDocs(nonIsoDocs || docs)));
    const registrationExpiry = isSuppliers ? supplierRegistrationExpiry : (isContractors ? contractorRegistrationExpiry : firstNonEmpty(record.validUntil, deepFindValue(record, ["validUntil", "expiry", "תוקף"])));

    // עמודת "אישור מס" מקבלת את מספר האישור מתוך המערכת, לא מספור עיוור.
    setByColumn(doc, sheetData, rowNumber, columns.approval, approvalNo, styles);
    // אם קיימת עמודת מס׳ סידורי נפרדת — ממלאים אותה 1,2,3.
    setByColumn(doc, sheetData, rowNumber, columns.serial, index + 1, styles);
    setByColumn(doc, sheetData, rowNumber, columns.contractorName, isContractors ? subcontractor.subcontractorName : supplier.supplierName, styles);
    setByColumn(doc, sheetData, rowNumber, columns.activity, isContractors ? subcontractor.field : supplier.suppliedMaterial, styles);
    setByColumn(doc, sheetData, rowNumber, columns.phone, subcontractor.contactPhone ?? supplier.contactPhone, styles);
    setByColumn(doc, sheetData, rowNumber, columns.subProject, record.subProject ?? record.location ?? "", styles);

    // קבלנים: כל תעודה שלא שייכת ל-ISO נכנסת לסיווג ברשם הקבלנים/תעודות.
    // ספקים: ISO נכנס רק לקבוצת ISO ולא לקבוצת ת״י/הסמכות.
    const registrationDocs = isSuppliers ? nonIsoDocs : (nonIsoDocs || docs);
    if (registrationNumber || registrationExpiry || registrationDocs) setByColumn(doc, sheetData, rowNumber, columns.regExists, "קיים", styles);
    setByColumn(doc, sheetData, rowNumber, columns.regNumber, registrationNumber, styles);
    setByColumn(doc, sheetData, rowNumber, columns.regExpiry, registrationExpiry, styles);
    setByColumn(doc, sheetData, rowNumber, columns.regDocs, registrationDocs, styles);

    const isoNumber = firstNonEmpty(
      record.isoCertificateNo,
      supplier.isoCertificateNo,
      subcontractor.isoCertificateNo,
      deepFindValue(record, ["isoCertificateNo", "isoNo", "isoNumber", "מס תעודת iso"]),
      looksLikeIso(approvalNo) ? approvalNo : "",
      isoCertificateLabel(isoDocs)
    );
    const isoExpiry = firstNonEmpty(
      record.isoValidUntil,
      supplier.isoValidUntil,
      subcontractor.isoValidUntil,
      deepFindValue(record, ["isoValidUntil", "isoExpiry", "תוקף iso"])
    );
    if (isoDocs || isoNumber || isoExpiry) setByColumn(doc, sheetData, rowNumber, columns.isoExists, "קיים", styles);
    setByColumn(doc, sheetData, rowNumber, columns.isoNumber, isoNumber, styles);
    setByColumn(doc, sheetData, rowNumber, columns.isoExpiry, isoExpiry, styles);
    setByColumn(doc, sheetData, rowNumber, columns.isoDocs, isoDocs, styles);

    setByColumn(doc, sheetData, rowNumber, columns.qaDate, approvalDate(record), styles);
    setByColumn(doc, sheetData, rowNumber, columns.qaName, approvalSignerName(record), styles);
    setByColumn(doc, sheetData, rowNumber, columns.assuranceDate, record.assuranceDate ?? approvalDate(record), styles);
    setByColumn(doc, sheetData, rowNumber, columns.assuranceName, record.assuranceName ?? approvalSignerName(record), styles);
  });

  zip.file(sheetPath, new XMLSerializer().serializeToString(doc));
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
};

const patchGenericWorkbook = async (buffer: ArrayBuffer, rows: ConcentrationRow[], template: ConcentrationTemplate, projectMeta: Required<ProjectConcentrationMeta>) => {
  if (template.preliminarySubtype) return patchPreliminaryWorkbook(buffer, rows, template, projectMeta);

  const zip = await patchWorkbookProjectHeader(buffer, projectMeta);
  const sheetPath = "xl/worksheets/sheet1.xml";
  const worksheetFile = zip.file(sheetPath);
  if (!worksheetFile) throw new Error("לא נמצא sheet1.xml");
  const xml = await worksheetFile.async("text");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const sheetData = doc.getElementsByTagNameNS(excelNs, "sheetData")[0];
  if (!sheetData) throw new Error("מבנה Excel לא תקין — sheetData חסר");
  const sharedStrings = await readSharedStrings(zip);
  const styles = rowStyleMap(sheetData, 13);

  const columns = {
    serial: findColumn(sheetData, sharedStrings, ["אישור מס", "מס סידורי", "מס' סידורי"], 10, 13) || 1,
    title: findColumn(sheetData, sharedStrings, ["שם", "תיאור", "נושא"], 10, 13) || 2,
    location: findColumn(sheetData, sharedStrings, ["מיקום", "קטע"], 10, 13),
    date: findColumn(sheetData, sharedStrings, ["תאריך"], 10, 13),
    status: findColumn(sheetData, sharedStrings, ["סטטוס", "מעמד"], 10, 13),
    certificate: findColumn(sheetData, sharedStrings, ["מס תעודה", "תעודה"], 10, 13),
    docs: findColumn(sheetData, sharedStrings, ["מסמכים", "קבצים", "מצורפים"], 10, 13),
    notes: findColumn(sheetData, sharedStrings, ["הערות"], 10, 13),
  };

  clearTableRows(sheetData, 13, 500);
  rows.forEach((row, index) => {
    const rowNumber = 13 + index;
    setByColumn(doc, sheetData, rowNumber, columns.serial, index + 1, styles);
    setByColumn(doc, sheetData, rowNumber, columns.title, row.itemDescription || row.title, styles);
    setByColumn(doc, sheetData, rowNumber, columns.location, row.location, styles);
    setByColumn(doc, sheetData, rowNumber, columns.date, row.executionDate || row.date, styles);
    setByColumn(doc, sheetData, rowNumber, columns.status, row.status, styles);
    setByColumn(doc, sheetData, rowNumber, columns.certificate, row.certificateNo, styles);
    setByColumn(doc, sheetData, rowNumber, columns.docs, attachedFilesText(row.rawRecord, row), styles);
    setByColumn(doc, sheetData, rowNumber, columns.notes, row.notes, styles);
  });

  zip.file(sheetPath, new XMLSerializer().serializeToString(doc));
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const meta = useMemo(() => buildProjectConcentrationMeta(currentProjectName, projectMeta), [currentProjectName, projectMeta]);

  const rowsByTemplate = useMemo(() => {
    const result: Record<string, ConcentrationRow[]> = {};
    templates.forEach((template) => {
      if (template.source === "checklists") result[template.id] = rowsFromChecklists(savedChecklists, template);
      else if (template.source === "nonconformances") result[template.id] = rowsFromSimpleRecords(savedNonconformances, template, "nonconformances");
      else if (template.source === "trialSections") result[template.id] = rowsFromSimpleRecords(savedTrialSections, template, "trialSections");
      else result[template.id] = rowsFromSimpleRecords(savedPreliminary, template, "preliminary");
    });
    return result;
  }, [savedChecklists, savedNonconformances, savedTrialSections, savedPreliminary]);

  const filteredTemplates = useMemo(() => {
    const q = normalize(query);
    if (!q) return templates;
    return templates.filter((template) => normalize([template.title, template.description, template.fileName].join(" ")).includes(q));
  }, [query]);

  const downloadTemplate = async (template: ConcentrationTemplate, withProjectDetails = false) => {
    setBusyId(template.id + (withProjectDetails ? ":project" : ":auto"));
    setMessage("");
    try {
      const response = await fetch(getTemplateUrl(template.fileName));
      if (!response.ok) throw new Error(`לא ניתן לטעון את תבנית ${template.fileName}`);
      const buffer = await response.arrayBuffer();
      const rows = rowsByTemplate[template.id] ?? [];
      let blob: Blob;
      if (template.mode === "subbaseA") blob = await patchSubbaseAWorkbook(buffer, rows[0], meta);
      else blob = await patchGenericWorkbook(buffer, rows, template, meta);
      downloadBlob(blob, template.fileName);
      setMessage(`הופק קובץ ${template.title} עם ${rows.length} רשומות.`);
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "שגיאה בהורדת הריכוז");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section dir="rtl">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 950 }}>ריכוזים</h2>
          <div style={{ color: "#64748b", marginTop: 6, lineHeight: 1.7 }}>
            ריכוז מצטבר לפי רשומות מאושרות ותעודות מצורפות. הנתונים נכתבים ישירות לתבניות ה־Excel המקוריות.
          </div>
          {currentProjectName ? <div style={{ marginTop: 8, fontWeight: 900 }}>פרויקט נוכחי: {currentProjectName}</div> : null}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="חיפוש ריכוז..."
          style={{ border: "1px solid #cbd5e1", borderRadius: 14, padding: "12px 14px", minWidth: 260, fontWeight: 800 }}
        />
      </div>

      {message ? <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e3a8a", borderRadius: 14, padding: 12, marginBottom: 14, fontWeight: 900 }}>{message}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        {filteredTemplates.map((template) => {
          const rows = rowsByTemplate[template.id] ?? [];
          const busy = busyId?.startsWith(template.id);
          return (
            <div key={template.id} style={{ border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#fff", boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 950 }}>{template.title}</h3>
                <span style={{ background: "#eef2ff", color: "#3730a3", padding: "6px 10px", borderRadius: 999, fontWeight: 900 }}>{rows.length} תוצאות</span>
              </div>
              <div style={{ color: "#64748b", marginTop: 8, minHeight: 42, lineHeight: 1.6 }}>{template.description}</div>
              <div style={{ marginTop: 8, color: rows.length ? "#166534" : "#64748b", fontWeight: 900 }}>
                {rows.length ? `נמצאו ${rows.length} רשומות/תעודות לשיבוץ בריכוז.` : "אין עדיין תוצאות — ניתן להוריד ריכוז ריק."}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => downloadTemplate(template)}
                style={{ width: "100%", marginTop: 14, border: 0, borderRadius: 12, padding: "13px 14px", background: busy ? "#475569" : "#0f172a", color: "#fff", fontWeight: 950, cursor: busy ? "wait" : "pointer" }}
              >
                {busy ? "מכין Excel..." : "הורד ריכוז אוטומטי Excel"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => downloadTemplate(template, true)}
                style={{ width: "100%", marginTop: 8, border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 14px", background: "#fff", color: "#0f172a", fontWeight: 900, cursor: busy ? "wait" : "pointer" }}
              >
                הורד תבנית עם פרטי פרויקט
              </button>
              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 8, textAlign: "left" }}>{template.fileName}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
