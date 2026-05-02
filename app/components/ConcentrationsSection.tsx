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

const isApproved = (record: any) =>
  record?.status === "מאושר" ||
  record?.status === "approved" ||
  record?.status === "נעול" ||
  record?.approval?.status === "approved";

const isRelevantPreliminaryRecord = (record: any, template: ConcentrationTemplate) => {
  if (template.preliminarySubtype) return record?.subtype === template.preliminarySubtype;
  return includesAny(recordText(record), template.keywords);
};



const attachmentLabel = (kind: unknown) =>
  kind === "lab" ? "תעודת מעבדה" : kind === "measurement" ? "רשימת מדידה" : "מסמך";

const extractCertificateNo = (name: unknown) => {
  const text = String(name ?? "");
  const pdfPrefix = text.match(/pdf[.\-_\s]*(\d{3,})/i);
  if (pdfPrefix) return pdfPrefix[1];
  const longNumber = text.match(/(?:^|[^0-9])(\d{3,})(?:[^0-9]|$)/);
  return longNumber?.[1] ?? "";
};

const getTemplateUrl = (fileName: string) => `/concentrations/${encodeURIComponent(fileName)}`;
const STORAGE_KEY = "yk-quality-stage4-multifile";
const PROJECT_TEAMS_STORAGE_KEY = `${STORAGE_KEY}-project-teams`;

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

  if (typeof window === "undefined") return metaFromProps;

  try {
    const raw = window.localStorage.getItem(PROJECT_TEAMS_STORAGE_KEY);
    const teams = raw ? JSON.parse(raw) : {};
    const key = normalizeProjectKey(name);
    const team = teams?.[key];
    if (!team || typeof team !== "object") return metaFromProps;

    return {
      projectName: name,
      projectManager: String(projectMeta?.projectManager || team.managementCompany || "").trim(),
      contractor: String(projectMeta?.contractor || "").trim(),
      qualityAssurance: String(projectMeta?.qualityAssurance || team.qualityAssurance || "").trim(),
      qualityControl: String(projectMeta?.qualityControl || team.qualityControl || "").trim(),
    };
  } catch {
    return metaFromProps;
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
          certificateNo: String(labResults?.certificateNo ?? extractCertificateNo(attachment?.name)),
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


const numberFromResult = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const subbaseValuesFromLabResults = (results?: LabCertificateResults): SubbaseAValues | null => {
  if (!results) return null;
  return {
    sieve3: numberFromResult(results.sieve3),
    sieve15: numberFromResult(results.sieve15),
    sieve34: numberFromResult(results.sieve34),
    sieve4: numberFromResult(results.sieve4),
    sieve10: numberFromResult(results.sieve10),
    sieve40: numberFromResult(results.sieve40),
    sieve200: numberFromResult(results.sieve200),
    ll: numberFromResult(results.ll),
    pl: numberFromResult(results.pl),
    pi: numberFromResult(results.pi),
    swelling: numberFromResult(results.sandEquivalent),
    density: numberFromResult(results.specificGravity),
    absorption: numberFromResult(results.absorption),
    losAngeles: numberFromResult(results.losAngeles),
    aashto: results.aashto ?? "",
    maxDensity: numberFromResult(results.maxDensity),
    optimumMoisture: numberFromResult(results.optimumMoisture),
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
  H4: "שם פרויקט:",
  H5: "ניהול פרויקט:",
  H6: "שם הקבלן:",
  H7: "בקרת איכות:",
  L7: "הבטחת איכות:",
  A10: "מס' סדורי",
  B10: "ביצוע ע\"י ",
  C10: "מס' ר.ת.",
  D10: "תאריך ",
  E10: "מקור החומר",
  F10: "מקום נטילת מדגם לבדיקה",
  G10: "מקום הפיזור",
  J10: "דירוג (  % עובר )",
  Q10: "גבולות פלסטיות וסומך (%)",
  T10: "שע\"ח (%)",
  U10: "אגרגט גס",
  W10: " לוס אנג'לס (%)",
  X10: " מיון AASHTO",
  Y10: "צפיפות מעבדתית מקסימלית",
  Z10: "רטיבות אופטימלית",
  AA10: "מספר תעודה",
  AB10: "מעמד החומר",
  AC10: "הערות",
  J11: '3"',
  K11: '"1.5',
  L11: '"3/4 ',
  M11: "#4",
  N11: "#10",
  O11: "#40",
  P11: "#200",
  Q11: "LL",
  R11: "PL",
  S11: "PI",
  U11: "צפיפות ממשית (ט/מ\"ק) ",
  V11: "ספיגות (%)",
  J12: "דרישות המפרט",
  B13: "QC/QA",
  G13: "מבנה",
  H13: "חתכים",
  K13: 100,
  L13: 85,
  M13: 55,
  N13: 40,
  P13: 15,
  Q13: 25,
  S13: 6,
  T13: 27,
  U13: 2.3,
  W13: "35 max",
  H14: "התחלה",
  I14: "סוף",
  J14: 100,
  K14: 80,
  L14: 60,
  M14: 30,
  N14: 20,
  P14: 5,
};

const buildSubbaseARow15 = (row: ConcentrationRow | undefined, projectMeta: Required<ProjectConcentrationMeta>): Record<string, string | number> => {
  const values = row ? parseSubbaseAValues(row) : {};
  const certificateNo = row?.certificateNo || "24403";
  const result = evaluateSubbaseA(values);
  return {
    J4: projectMeta.projectName || row?.title || "",
    J5: projectMeta.projectManager || "",
    J6: projectMeta.contractor || row?.contractor || "",
    J7: projectMeta.qualityControl || "",
    M7: projectMeta.qualityAssurance || "",
    A15: 1,
    B15: row?.inspector || row?.responsible || "QC",
    C15: row?.checklistNo || 1,
    D15: row?.executionDate || row?.date || "",
    E15: row?.notes || "גולני",
    F15: row?.location || "מערום בשטח",
    G15: projectMeta.projectName || row?.itemDescription || "",
    H15: "",
    I15: "",
J15: String(valueOrDefault(values.sieve3, "")),
K15: String(valueOrDefault(values.sieve15, "")),
L15: String(valueOrDefault(values.sieve34, "")),
M15: String(valueOrDefault(values.sieve4, "")),
    N15: String(valueOrDefault(values.sieve10, "")),
O15: String(valueOrDefault(values.sieve40, "")),
P15: String(valueOrDefault(values.sieve200, "")),
Q15: String(valueOrDefault(values.ll, "")),
R15: String(valueOrDefault(values.pl, "")),
S15: String(valueOrDefault(values.pi, "")),
    T15: valueOrDefault(values.swelling, ""),
    U15: valueOrDefault(values.density, ""),
    V15: valueOrDefault(values.absorption, ""),
    W15: valueOrDefault(values.losAngeles, ""),
    X15: valueOrDefault(values.aashto, ""),
    Y15: valueOrDefault(values.maxDensity, ""),
    Z15: valueOrDefault(values.optimumMoisture, ""),
    AA15: certificateNo,
    AB15: result,
    AC15: row?.notes || "",
  };
};

const excelNs = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

const columnNumber = (letters: string) => {
  let number = 0;
  for (const letter of letters.toUpperCase()) number = number * 26 + letter.charCodeAt(0) - 64;
  return number;
};

const cellColumnIndex = (cellRef: string) => columnNumber(cellRef.replace(/\d+/g, ""));
const cellRowIndex = (cellRef: string) => Number(cellRef.replace(/\D+/g, ""));

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

const getOrCreateCell = (doc: Document, row: Element, cellRef: string) => {
  const cells = Array.from(row.getElementsByTagNameNS(excelNs, "c"));
  let cell = cells.find((candidate) => candidate.getAttribute("r") === cellRef);
  if (cell) return cell;
  cell = doc.createElementNS(excelNs, "c");
  cell.setAttribute("r", cellRef);
  const nextCell = cells.find((candidate) => cellColumnIndex(candidate.getAttribute("r") ?? "A1") > cellColumnIndex(cellRef));
  row.insertBefore(cell, nextCell ?? null);
  return cell;
};

const setCell = (doc: Document, sheetData: Element, cellRef: string, value: string | number) => {
  const row = getOrCreateRow(doc, sheetData, cellRowIndex(cellRef));
  const cell = getOrCreateCell(doc, row, cellRef);
  Array.from(cell.childNodes).forEach((child) => cell.removeChild(child));

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

const nextCellRef = (cellRef: string) => `${columnLetters(cellColumnIndex(cellRef) + 1)}${cellRowIndex(cellRef)}`;
const prevCellRef = (cellRef: string) => `${columnLetters(Math.max(1, cellColumnIndex(cellRef) - 1))}${cellRowIndex(cellRef)}`;

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

const applyProjectHeaderCells = (doc: Document, sheetData: Element, sharedStrings: string[], meta: Required<ProjectConcentrationMeta>) => {
  const items: Array<{ label: string; value: string; fallbacks: Array<[string, string]> }> = [
    { label: "שם פרויקט", value: meta.projectName, fallbacks: [["H4", "J4"], ["I4", "J4"], ["A4", "B4"]] },
    { label: "ניהול פרויקט", value: meta.projectManager, fallbacks: [["H5", "J5"], ["I5", "J5"], ["A5", "B5"]] },
    { label: "שם הקבלן", value: meta.contractor, fallbacks: [["H6", "J6"], ["I6", "J6"], ["A6", "B6"]] },
    { label: "הבטחת איכות", value: meta.qualityAssurance, fallbacks: [["H7", "J7"], ["L7", "M7"], ["A7", "B7"]] },
    { label: "בקרת איכות", value: meta.qualityControl, fallbacks: [["H8", "J8"], ["H7", "J7"], ["A8", "B8"]] },
  ];

  const readCell = (cellRef: string) => {
    const row = getOrCreateRow(doc, sheetData, cellRowIndex(cellRef));
    const cell = getOrCreateCell(doc, row, cellRef);
    return normalize(cellText(cell, sharedStrings));
  };

  const writeIfUseful = (cellRef: string, value: string) => {
    if (!value) return;
    const current = readCell(cellRef);
    // לא דורסים תא שכבר מכיל כותרת; כן ממלאים תא ריק/תא ערך.
    if (["שם פרויקט", "ניהול פרויקט", "שם הקבלן", "הבטחת איכות", "בקרת איכות"].some((label) => current.includes(normalize(label)))) return;
    setCell(doc, sheetData, cellRef, value);
  };

  const allCells = Array.from(sheetData.getElementsByTagNameNS(excelNs, "c"));
  items.forEach((item) => {
    let foundLabel = false;
    allCells.forEach((cell) => {
      const ref = cell.getAttribute("r") ?? "";
      const text = normalize(cellText(cell, sharedStrings)).replace(/[:：]/g, "");
      if (!ref || !text || !text.includes(normalize(item.label))) return;
      setCell(doc, sheetData, ref, `${item.label}:`);
      writeIfUseful(nextCellRef(ref), item.value);
      writeIfUseful(prevCellRef(ref), item.value);
      foundLabel = true;
    });

    // גיבוי לתבניות שבהן תא הערך רחוק יותר או הכותרות ממוזגות.
    item.fallbacks.forEach(([labelCell, valueCell], index) => {
      if (foundLabel && index > 0) return;
      setCell(doc, sheetData, labelCell, `${item.label}:`);
      writeIfUseful(valueCell, item.value);
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
  applyProjectHeaderCells(doc, sheetData, [], projectMeta);
  Object.entries(buildSubbaseARow15(row, projectMeta)).forEach(([cell, value]) => setCell(doc, sheetData, cell, value));

  const serialized = new XMLSerializer().serializeToString(doc);
  zip.file(sheetPath, serialized);
  return await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
};

const labValue = (row: ConcentrationRow, key: keyof LabCertificateResults) => {
  const value = row.labResults?.[key];
  return value === undefined || value === null ? "" : String(value);
};

const firstNonEmpty = (...values: unknown[]) => {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
};

const approvalSignerName = (record: any) => {
  const signatures = Array.isArray(record?.approval?.signatures) ? record.approval.signatures : [];
  const signed = signatures.find((signature: any) => String(signature?.signerName ?? "").trim());
  return String(signed?.signerName ?? "").trim();
};

const approvalSignedAt = (record: any) => {
  const signatures = Array.isArray(record?.approval?.signatures) ? record.approval.signatures : [];
  const signed = signatures.find((signature: any) => String(signature?.signedAt ?? "").trim());
  return String(signed?.signedAt ?? "").trim();
};

const collectAttachmentNames = (value: any, names: string[], depth = 0) => {
  if (!value || depth > 5) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectAttachmentNames(item, names, depth + 1));
    return;
  }
  if (typeof value !== "object") return;

  const name = String(
    value.name ??
    value.fileName ??
    value.attachmentName ??
    value.originalName ??
    value.title ??
    ""
  ).trim();

  const looksLikeFile = Boolean(
    value.dataUrl ||
    value.url ||
    value.path ||
    value.type ||
    value.uploadedAt ||
    value.attachedAt ||
    value.attachmentName
  );

  if (name && looksLikeFile) names.push(name);

  Object.entries(value).forEach(([key, nested]) => {
    if (["approval", "signature", "signatures"].includes(key)) return;
    collectAttachmentNames(nested, names, depth + 1);
  });
};

const attachmentNamesForRecord = (record: any, row?: ConcentrationRow) => {
  const names: string[] = [];
  collectAttachmentNames(record, names);
  if (row?.fileName) names.push(row.fileName);
  return Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
};

const attachedFilesText = (record: any, row: ConcentrationRow) => attachmentNamesForRecord(record, row).join(" | ");

const filterAttachmentText = (record: any, row: ConcentrationRow, keywords: string[]) => {
  const filtered = attachmentNamesForRecord(record, row).filter((name) => includesAny(name, keywords));
  return filtered.join(" | ");
};

const certificateNoFromText = (text: string) => extractCertificateNo(text) || "";

const rowValueMap = (template: ConcentrationTemplate, row: ConcentrationRow, index: number): Record<string, string | number> => {
  const record = row.rawRecord ?? {};
  const supplier = record?.supplier ?? {};
  const subcontractor = record?.subcontractor ?? {};
  const material = record?.material ?? {};
  const signedAt = approvalSignedAt(record) || row.date || row.executionDate;
  const signer = "בקרת איכות";
  const attached = attachedFilesText(record, row);

  if (template.id === "contractors") {
    const registryDocs = filterAttachmentText(record, row, ["רשם", "קבלן", "סיווג", "אישור", "תעודה"]) || attached;
    const isoDocs = filterAttachmentText(record, row, ["iso", "איזו", "איכות"]);
    return {
      // בתבנית זו "אישור מס" משמש כמספר סידורי — לכן הוא תמיד רץ 1,2,3 לפי השורות.
      serial: index,
      approvalNo: index,
      subcontractorName: firstNonEmpty(subcontractor.subcontractorName, row.contractor, row.title),
      activityField: firstNonEmpty(subcontractor.field, row.itemDescription),
      contactPhone: String(subcontractor.contactPhone ?? ""),
      subProject: firstNonEmpty(record?.subProject, record?.subproject, record?.location, row.location),
      registryExists: registryDocs || row.certificateNo ? "קיים" : "",
      registryCertificateNo: row.certificateNo || certificateNoFromText(registryDocs),
      registryExpiry: String(subcontractor.expiryDate ?? subcontractor.validUntil ?? ""),
      registryDocuments: registryDocs,
      isoExists: firstNonEmpty(subcontractor.isoExists, subcontractor.isoStatus, isoDocs ? "קיים" : ""),
      isoCertificateNo: firstNonEmpty(subcontractor.isoCertificateNo, certificateNoFromText(isoDocs)),
      isoExpiry: String(subcontractor.isoExpiry ?? subcontractor.isoValidUntil ?? ""),
      isoDocuments: firstNonEmpty(subcontractor.isoDocuments, isoDocs),
      qcApprovalDate: signedAt,
      qcApproverName: signer,
      qaApprovalDate: signedAt,
      qaApproverName: signer,
      status: row.status,
      notes: row.notes,
    };
  }

  if (template.id === "suppliers") {
    const isoDocs = filterAttachmentText(record, row, ["iso", "איזו", "איכות"]);
    const standardDocs = filterAttachmentText(record, row, ["תו תקן", "תקן", "הסמכה", "אישור", "תעודה"]) || attached;
    return {
      serial: index,
      approvalNo: index,
      supplierName: firstNonEmpty(supplier.supplierName, row.contractor, row.title),
      suppliedMaterial: firstNonEmpty(supplier.suppliedMaterial, row.itemDescription),
      contactPhone: String(supplier.contactPhone ?? ""),
      standardExists: standardDocs || row.certificateNo ? "קיים" : "",
      standardCertificateNo: row.certificateNo || certificateNoFromText(standardDocs),
      standardExpiry: String(supplier.standardExpiry ?? supplier.standardValidUntil ?? supplier.validUntil ?? ""),
      standardDocuments: standardDocs,
      isoExists: firstNonEmpty(supplier.isoExists, supplier.isoStatus, isoDocs ? "קיים" : ""),
      isoCertificateNo: firstNonEmpty(supplier.isoCertificateNo, certificateNoFromText(isoDocs)),
      isoExpiry: String(supplier.isoExpiry ?? supplier.isoValidUntil ?? ""),
      isoDocuments: firstNonEmpty(supplier.isoDocuments, isoDocs),
      qcApprovalDate: signedAt,
      qcApproverName: signer,
      qaApprovalDate: signedAt,
      qaApproverName: signer,
      status: row.status,
      notes: row.notes,
    };
  }

  if (template.id === "materials") {
    return {
      serial: index,
      approvalNo: row.certificateNo,
      materialName: firstNonEmpty(material.materialName, row.title),
      source: String(material.source ?? ""),
      usage: firstNonEmpty(material.usage, row.itemDescription),
      certificateNo: row.certificateNo,
      documents: attached,
      approvalDate: signedAt,
      approverName: signer,
      status: row.status,
      notes: row.notes,
    };
  }

  if (template.id === "nonconformances") {
    return {
      serial: index,
      title: row.title,
      location: row.location,
      date: row.date,
      responsible: row.responsible,
      status: row.status,
      description: row.itemDescription,
      notes: row.notes,
      documents: attached,
    };
  }

  if (template.id === "trial-sections" || template.id === "supervision") {
    return {
      serial: index,
      title: row.title,
      location: row.location,
      date: row.date,
      description: row.itemDescription,
      status: row.status,
      approverName: signer,
      notes: row.notes,
      documents: attached,
    };
  }

  return {
    serial: index,
    checklistNo: row.checklistNo,
    date: row.date || row.executionDate,
    title: row.title,
    category: row.category,
    location: row.location,
    contractor: row.contractor,
    description: row.itemDescription,
    attachmentKind: row.attachmentKind,
    certificateNo: row.certificateNo || labValue(row, "certificateNo"),
    sampleDate: labValue(row, "sampleDate" as keyof LabCertificateResults),
    source: labValue(row, "source" as keyof LabCertificateResults),
    maxDensity: labValue(row, "maxDensity" as keyof LabCertificateResults),
    optimumMoisture: labValue(row, "optimumMoisture" as keyof LabCertificateResults),
    density: labValue(row, "density" as keyof LabCertificateResults),
    moisture: labValue(row, "moisture" as keyof LabCertificateResults),
    compaction: labValue(row, "compaction" as keyof LabCertificateResults),
    sandEquivalent: labValue(row, "sandEquivalent" as keyof LabCertificateResults),
    cbr: labValue(row, "cbr" as keyof LabCertificateResults),
    sieve3: labValue(row, "sieve3" as keyof LabCertificateResults),
    sieve15: labValue(row, "sieve15" as keyof LabCertificateResults),
    sieve34: labValue(row, "sieve34" as keyof LabCertificateResults),
    sieve4: labValue(row, "sieve4" as keyof LabCertificateResults),
    sieve10: labValue(row, "sieve10" as keyof LabCertificateResults),
    sieve40: labValue(row, "sieve40" as keyof LabCertificateResults),
    sieve200: labValue(row, "sieve200" as keyof LabCertificateResults),
    ll: labValue(row, "ll" as keyof LabCertificateResults),
    pl: labValue(row, "pl" as keyof LabCertificateResults),
    pi: labValue(row, "pi" as keyof LabCertificateResults),
    losAngeles: labValue(row, "losAngeles" as keyof LabCertificateResults),
    aashto: labValue(row, "aashto" as keyof LabCertificateResults),
    status: row.status,
    inspector: row.inspector,
    notes: row.notes,
    documents: attached,
    fileName: row.fileName,
  };
};

type CellInfo = { ref: string; row: number; col: number; text: string };

const columnLettersToRange = (startCol: number, endCol: number) => {
  const cols: string[] = [];
  for (let col = startCol; col <= endCol; col += 1) cols.push(columnLetters(col));
  return cols;
};

const rangeParts = (range: string) => {
  const [start, end = start] = range.split(":");
  return {
    startCol: cellColumnIndex(start),
    startRow: cellRowIndex(start),
    endCol: cellColumnIndex(end),
    endRow: cellRowIndex(end),
  };
};

const mergedTextsByColumn = (sheetData: Element, sharedStrings: string[]) => {
  const doc = sheetData.ownerDocument;
  const worksheet = sheetData.parentElement;
  const merged: Record<string, string[]> = {};
  const mergeCells = worksheet?.getElementsByTagNameNS(excelNs, "mergeCell") ?? [];
  Array.from(mergeCells).forEach((mergeCell) => {
    const ref = mergeCell.getAttribute("ref") ?? "";
    if (!ref.includes(":")) return;
    const parts = rangeParts(ref);
    if (parts.startRow < 8 || parts.startRow > 14) return;
    const startCell = getOrCreateCell(doc, getOrCreateRow(doc, sheetData, parts.startRow), `${columnLetters(parts.startCol)}${parts.startRow}`);
    const text = cellText(startCell, sharedStrings);
    if (!text.trim()) return;
    columnLettersToRange(parts.startCol, parts.endCol).forEach((col) => {
      merged[col] = [...(merged[col] ?? []), text];
    });
  });
  return merged;
};

const getHeaderCells = (sheetData: Element, sharedStrings: string[]): CellInfo[] => {
  const merged = mergedTextsByColumn(sheetData, sharedStrings);
  const cells = Array.from(sheetData.getElementsByTagNameNS(excelNs, "c"));
  return cells
    .map((cell) => {
      const ref = cell.getAttribute("r") ?? "";
      const row = cellRowIndex(ref);
      const col = cellColumnIndex(ref);
      const colLetters = ref.replace(/\d+/g, "");
      const text = [cellText(cell, sharedStrings), ...(merged[colLetters] ?? [])].filter(Boolean).join(" ");
      return { ref, row, col, text };
    })
    .filter((cell) => cell.row >= 8 && cell.row <= 14 && normalize(cell.text));
};

const headerMatches = (text: string, aliases: string[]) => {
  const n = normalize(text).replace(/[:：]/g, "");
  return aliases.some((alias) => n.includes(normalize(alias).replace(/[:：]/g, "")));
};

const columnByHeader = (headers: CellInfo[], aliases: string[], preferRightMost = true) => {
  const matches = headers.filter((header) => headerMatches(header.text, aliases));
  if (!matches.length) return null;
  matches.sort((a, b) => preferRightMost ? a.col - b.col : b.col - a.col);
  return matches[0].col;
};

const columnsByHeader = (headers: CellInfo[], aliases: string[]) =>
  Array.from(new Set(headers.filter((header) => headerMatches(header.text, aliases)).map((header) => header.col))).sort((a, b) => a - b);

const getHeaderBottomRow = (headers: CellInfo[]) => {
  const relevant = headers.filter((header) => header.row >= 10 && header.row <= 13);
  if (!relevant.length) return 12;
  return Math.max(...relevant.map((header) => header.row));
};

const renameHeaderCell = (doc: Document, sheetData: Element, sharedStrings: string[], aliases: string[], newText: string) => {
  const cells = Array.from(sheetData.getElementsByTagNameNS(excelNs, "c"));
  let changed = false;

  // קודם מנסים לשנות את התא המקורי שבו כתובה הכותרת, לא תא משנה שמקבל טקסט ממיזוג.
  cells.forEach((cell) => {
    const ref = cell.getAttribute("r") ?? "";
    const text = cellText(cell, sharedStrings);
    if (!ref || !headerMatches(text, aliases)) return;
    setCell(doc, sheetData, ref, newText);
    changed = true;
  });

  if (changed) return;

  // גיבוי: אם הכותרת הגיעה מתא ממוזג, נאתר את תא הכותרת לפי headers.
  const headers = getHeaderCells(sheetData, sharedStrings);
  const target = headers.find((header) => headerMatches(header.text, aliases));
  if (!target) return;
  setCell(doc, sheetData, target.ref, newText);
};

const findFirstWritableRow = (sheetData: Element, sharedStrings: string[], template?: ConcentrationTemplate) => {
  if (template?.id === "subbase-a") return 15;
  const headers = getHeaderCells(sheetData, sharedStrings);
  return Math.max(13, getHeaderBottomRow(headers) + 1);
};

const buildColumnMapping = (sheetData: Element, sharedStrings: string[], template: ConcentrationTemplate): Record<string, number | number[]> => {
  const headers = getHeaderCells(sheetData, sharedStrings);
  const col = (aliases: string[], preferRightMost = true): number => columnByHeader(headers, aliases, preferRightMost) ?? 0;
  const cols = (aliases: string[]): number[] => columnsByHeader(headers, aliases);

  if (template.id === "contractors") {
    const certificateCols = cols(["מס תעודה", "מספר תעודה"]);
    const existingCols = cols(["קיים/לא קיים", "קיים לא קיים"]);
    const documentCols = cols(["מסמכים מצורפים", "מסמכים", "תעודות", "תעודות מצורפות"]);
    const expiryCols = cols(["תוקף", "תוקף תעודה"]);
    const approvalDateCols = cols(["תאריך אישור"]);
    const approverCols = cols(["שם המאשר"]);
    return {
      // בתבנית הקבלנים העמודה הימנית "אישור מס" משמשת כמספר סידורי.
      serial: col(["אישור מס", "מס אישור", "מס סידורי", "מס' סידורי"], true),
      approvalNo: 0,
      subcontractorName: col(["שם קבלן משנה", "שם קבלן"]),
      activityField: col(["תחום פעילות", "תחום"]),
      contactPhone: col(["אנשי קשר וטלפון", "טלפון", "איש קשר"]),
      subProject: col(["תת פרויקט", "תת-פרויקט"]),
      registryExists: (existingCols[0] ?? 0),
      registryCertificateNo: (certificateCols[0] ?? 0),
      registryExpiry: (expiryCols[0] ?? 0),
      registryDocuments: (documentCols[0] ?? 0),
      isoExists: (existingCols[1] ?? 0),
      isoCertificateNo: (certificateCols[1] ?? 0),
      isoExpiry: (expiryCols[1] ?? 0),
      isoDocuments: (documentCols[1] ?? 0),
      qcApprovalDate: (approvalDateCols[0] ?? 0),
      qcApproverName: (approverCols[0] ?? 0),
      qaApprovalDate: (approvalDateCols[1] ?? 0),
      qaApproverName: (approverCols[1] ?? 0),
      status: col(["סטטוס", "מעמד"]),
      notes: col(["הערות"]),
    };
  }

  if (template.id === "suppliers") {
    const certificateCols = cols(["מס תעודה", "מספר תעודה"]);
    const existingCols = cols(["קיים/לא קיים", "קיים לא קיים"]);
    const documentCols = cols(["מסמכים מצורפים", "מסמכים", "תעודות", "תעודות מצורפות"]);
    const expiryCols = cols(["תוקף", "תוקף תעודה"]);
    const approvalDateCols = cols(["תאריך אישור"]);
    const approverCols = cols(["שם המאשר"]);
    return {
      serial: col(["אישור מס", "מס סידורי", "מס' סידורי", "מס"]),
      approvalNo: 0,
      supplierName: col(["שם ספק", "ספק"]),
      suppliedMaterial: col(["חומר מסופק", "סוג חומר", "חומר"]),
      contactPhone: col(["אנשי קשר וטלפון", "טלפון", "איש קשר"]),
      standardExists: (existingCols[0] ?? 0),
      standardCertificateNo: (certificateCols[0] ?? 0),
      standardExpiry: (expiryCols[0] ?? 0),
      standardDocuments: (documentCols[0] ?? 0),
      isoExists: (existingCols[1] ?? 0),
      isoCertificateNo: (certificateCols[1] ?? 0),
      isoExpiry: (expiryCols[1] ?? 0),
      isoDocuments: (documentCols[1] ?? 0),
      qcApprovalDate: (approvalDateCols[0] ?? 0),
      qcApproverName: (approverCols[0] ?? 0),
      qaApprovalDate: (approvalDateCols[1] ?? 0),
      qaApproverName: (approverCols[1] ?? 0),
      status: col(["סטטוס", "מעמד"]),
      notes: col(["הערות"]),
    };
  }

  if (template.id === "materials") {
    return {
      serial: col(["מס סידורי", "אישור מס", "מס"]),
      materialName: col(["שם חומר", "חומר"]),
      source: col(["מקור", "מקור החומר"]),
      usage: col(["שימוש", "ייעוד", "תחום"]),
      certificateNo: col(["מס תעודה", "מספר תעודה", "מס אישור"]),
      documents: col(["מסמכים מצורפים", "מסמכים"]),
      approvalDate: col(["תאריך אישור", "תאריך"]),
      approverName: col(["שם המאשר", "מאשר"]),
      status: col(["סטטוס", "מעמד"]),
      notes: col(["הערות"]),
    };
  }

  return {
    serial: col(["מס סידורי", "מס' סידורי", "מס"]),
    checklistNo: col(["רשימת תיוג", "מס רשימה", "מס ר.ת"]),
    date: col(["תאריך"]),
    title: col(["שם", "כותרת", "נושא"]),
    category: col(["קטגוריה", "סוג"]),
    location: col(["מיקום", "קטע", "מבנה"]),
    contractor: col(["קבלן", "מבצע", "ביצוע"]),
    description: col(["תיאור", "פעילות", "תחום"]),
    attachmentKind: col(["סוג מסמך", "מסמך"]),
    certificateNo: col(["מס תעודה", "מספר תעודה", "תעודה"]),
    sampleDate: col(["תאריך דגימה", "תאריך נטילה"]),
    source: col(["מקור", "מקור החומר"]),
    maxDensity: col(["צפיפות מעבדתית", "צפיפות מקסימלית"]),
    optimumMoisture: col(["רטיבות אופטימלית"]),
    density: col(["צפיפות"]),
    moisture: col(["רטיבות"]),
    compaction: col(["הידוק", "דרגת הידוק"]),
    sandEquivalent: col(["שווה ערך חול", "שעח"]),
    cbr: col(["CBR"]),
    sieve3: col(["3\"", "נפה 3"]),
    sieve15: col(["1.5", "1.5\""]),
    sieve34: col(["3/4"]),
    sieve4: col(["#4"]),
    sieve10: col(["#10"]),
    sieve40: col(["#40"]),
    sieve200: col(["#200"]),
    ll: col(["LL", "גבול נזילות"]),
    pl: col(["PL", "גבול פלסטיות"]),
    pi: col(["PI", "אינדקס"]),
    losAngeles: col(["לוס", "אנג'לס"]),
    aashto: col(["AASHTO"]),
    status: col(["סטטוס", "מעמד", "תוצאה"]),
    inspector: col(["בודק", "מאשר"]),
    notes: col(["הערות"]),
    documents: col(["מסמכים מצורפים", "קובץ", "תעודה מצורפת"]),
  };
};

const genericFallbackColumns = (template: ConcentrationTemplate, startCol: number) => {
  const keys = template.id === "contractors"
    ? ["serial", "subcontractorName", "activityField", "contactPhone", "subProject", "registryExists", "registryCertificateNo", "registryExpiry", "registryDocuments", "isoExists", "isoCertificateNo", "isoExpiry", "isoDocuments", "qcApprovalDate", "qcApproverName", "qaApprovalDate", "qaApproverName"]
    : template.id === "suppliers"
      ? ["serial", "supplierName", "suppliedMaterial", "contactPhone", "standardExists", "standardCertificateNo", "standardExpiry", "standardDocuments", "isoExists", "isoCertificateNo", "isoExpiry", "isoDocuments", "qcApprovalDate", "qcApproverName", "qaApprovalDate", "qaApproverName", "status", "notes"]
      : template.id === "materials"
        ? ["serial", "materialName", "source", "usage", "certificateNo", "documents", "approvalDate", "approverName", "status", "notes"]
        : ["serial", "checklistNo", "date", "title", "category", "location", "contractor", "description", "attachmentKind", "certificateNo", "sampleDate", "source", "status", "inspector", "notes", "documents"];
  return Object.fromEntries(keys.map((key, index) => [key, startCol + index]));
};

const ensureBorderStyle = (zip: JSZip) => async () => {
  const stylesPath = "xl/styles.xml";
  const stylesFile = zip.file(stylesPath);
  if (!stylesFile) return "1";
  const xml = await stylesFile.async("text");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const styleNs = excelNs;
  const borders = doc.getElementsByTagNameNS(styleNs, "borders")[0];
  const cellXfs = doc.getElementsByTagNameNS(styleNs, "cellXfs")[0];
  if (!borders || !cellXfs) return "1";

  const borderId = Number(borders.getAttribute("count") ?? borders.children.length);
  const border = doc.createElementNS(styleNs, "border");
  ["left", "right", "top", "bottom"].forEach((side) => {
    const el = doc.createElementNS(styleNs, side);
    el.setAttribute("style", "thin");
    const color = doc.createElementNS(styleNs, "color");
    color.setAttribute("auto", "1");
    el.appendChild(color);
    border.appendChild(el);
  });
  border.appendChild(doc.createElementNS(styleNs, "diagonal"));
  borders.appendChild(border);
  borders.setAttribute("count", String(borderId + 1));

  const xfId = Number(cellXfs.getAttribute("count") ?? cellXfs.children.length);
  const xf = doc.createElementNS(styleNs, "xf");
  xf.setAttribute("numFmtId", "0");
  xf.setAttribute("fontId", "0");
  xf.setAttribute("fillId", "0");
  xf.setAttribute("borderId", String(borderId));
  xf.setAttribute("xfId", "0");
  xf.setAttribute("applyBorder", "1");
  xf.setAttribute("applyAlignment", "1");
  const alignment = doc.createElementNS(styleNs, "alignment");
  alignment.setAttribute("horizontal", "center");
  alignment.setAttribute("vertical", "center");
  alignment.setAttribute("wrapText", "1");
  xf.appendChild(alignment);
  cellXfs.appendChild(xf);
  cellXfs.setAttribute("count", String(xfId + 1));

  zip.file(stylesPath, new XMLSerializer().serializeToString(doc));
  return String(xfId);
};

const setCellWithStyle = (doc: Document, sheetData: Element, cellRef: string, value: string | number, styleId?: string) => {
  setCell(doc, sheetData, cellRef, value);
  const row = getOrCreateRow(doc, sheetData, cellRowIndex(cellRef));
  const cell = getOrCreateCell(doc, row, cellRef);
  if (styleId) cell.setAttribute("s", styleId);
};

const patchGenericWorkbook = async (buffer: ArrayBuffer, projectMeta: Required<ProjectConcentrationMeta>, rows: ConcentrationRow[] = [], template?: ConcentrationTemplate) => {
  const zip = await patchWorkbookProjectHeader(buffer, projectMeta);
  const sheetPath = "xl/worksheets/sheet1.xml";
  const worksheetFile = zip.file(sheetPath);
  if (worksheetFile && rows.length && template) {
    const sharedStrings = await readSharedStrings(zip);
    const borderStyleId = await ensureBorderStyle(zip)();
    const xml = await worksheetFile.async("text");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const sheetData = doc.getElementsByTagNameNS(excelNs, "sheetData")[0];
    if (sheetData) {
      if (template.id === "contractors") {
        renameHeaderCell(doc, sheetData, sharedStrings, ["סיווג ברשם הקבלנים"], "סיווג ברשם הקבלנים/תעודות");
      }
      if (template.id === "suppliers") {
        renameHeaderCell(doc, sheetData, sharedStrings, ["תעודת ISO", "תעודת איזו", "ISO"], "תעודת ISO/תעודות");
      }
      const startRow = findFirstWritableRow(sheetData, sharedStrings, template);
      const headers = getHeaderCells(sheetData, sharedStrings);
      const minHeaderCol = headers.length ? Math.min(...headers.map((h) => h.col)) : 1;
      const mapping = buildColumnMapping(sheetData, sharedStrings, template);
      const fallback = genericFallbackColumns(template, minHeaderCol);
      rows.forEach((row, rowIndex) => {
        const values = rowValueMap(template, row, rowIndex + 1);
        Object.entries(values).forEach(([key, value]) => {
          if (value === undefined || value === null || value === "") return;
          const mapped = mapping[key] ?? fallback[key];
          const colNumber = Array.isArray(mapped) ? mapped[0] : mapped;
          if (!colNumber) return;
          setCellWithStyle(doc, sheetData, `${columnLetters(colNumber)}${startRow + rowIndex}`, value, borderStyleId);
        });
      });
      zip.file(sheetPath, new XMLSerializer().serializeToString(doc));
    }
  }
  return await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
};

export function ConcentrationsSection({
  savedChecklists = [],
  savedNonconformances = [],
  savedTrialSections = [],
  savedPreliminary = [],
  currentProjectName = "",
  projectMeta,
}: Props) {
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const resolvedProjectMeta = useMemo(
    () => buildProjectConcentrationMeta(currentProjectName, projectMeta),
    [currentProjectName, projectMeta]
  );

  const rowsByTemplate = useMemo(() => {
    const map: Record<string, ConcentrationRow[]> = {};
    templates.forEach((template) => {
      if (template.source === "checklists") map[template.id] = rowsFromChecklists(savedChecklists, template);
      if (template.source === "nonconformances") map[template.id] = rowsFromSimpleRecords(savedNonconformances, template, "nonconformances");
      if (template.source === "trialSections") map[template.id] = rowsFromSimpleRecords(savedTrialSections, template, "trialSections");
      if (template.source === "preliminary") map[template.id] = rowsFromSimpleRecords(savedPreliminary, template, "preliminary");
    });
    return map;
  }, [savedChecklists, savedNonconformances, savedTrialSections, savedPreliminary]);

  const visibleTemplates = useMemo(() => {
    const q = normalize(search);
    return templates.filter((template) => !q || normalize(`${template.title} ${template.description} ${template.fileName}`).includes(q));
  }, [search]);

  const downloadEmptyTemplate = async (template: ConcentrationTemplate) => {
    setBusyId(`empty-${template.id}`);
    try {
      const response = await fetch(getTemplateUrl(template.fileName));
      if (!response.ok) throw new Error(`לא נמצא קובץ תבנית: ${template.fileName}`);
      const buffer = await response.arrayBuffer();
      const blob = template.mode === "subbaseA"
        ? await patchSubbaseAWorkbook(buffer, undefined, resolvedProjectMeta)
        : await patchGenericWorkbook(buffer, resolvedProjectMeta, [], template);
      downloadBlob(blob, template.fileName.replace(/\.xlsx$/i, " - תבנית עם פרטי פרויקט.xlsx"));
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "אירעה שגיאה בהורדת התבנית");
    } finally {
      setBusyId(null);
    }
  };

  const downloadAutomatic = async (template: ConcentrationTemplate) => {
    setBusyId(template.id);
    try {
      const response = await fetch(getTemplateUrl(template.fileName));
      if (!response.ok) throw new Error(`לא נמצא קובץ תבנית: ${template.fileName}`);
      const buffer = await response.arrayBuffer();
      const rows = rowsByTemplate[template.id] ?? [];

      if (template.mode === "subbaseA") {
        const preferred = rows.find((r) => r.certificateNo === "24403") ?? rows.find((r) => r.checklistNo === "1") ?? rows[0];
        const blob = await patchSubbaseAWorkbook(buffer, preferred, resolvedProjectMeta);
        downloadBlob(blob, "subbase-a - ריכוז אוטומטי.xlsx");
        return;
      }

      const blob = await patchGenericWorkbook(buffer, resolvedProjectMeta, rows, template);
      downloadBlob(blob, template.fileName.replace(/\.xlsx$/i, " - ריכוז אוטומטי.xlsx"));
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "אירעה שגיאה בהפקת הריכוז");
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
            כל הריכוזים נבנים אוטומטית מהרשומות המאושרות בפרויקט. תעודות מעבדה שנסרקות ברשימות התיוג נכנסות לריכוזים לפי סוג העבודה והתוצאות שנקלטו.
          </div>
          {resolvedProjectMeta.projectName ? <div style={{ color: "#0f172a", fontWeight: 800, marginTop: 6 }}>פרויקט נוכחי: {resolvedProjectMeta.projectName}</div> : null}
        </div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש ריכוז..." style={{ width: 260, border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 14px", fontWeight: 700 }} />
      </div>

      <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 16, padding: 14, color: "#1e3a8a", fontWeight: 800, lineHeight: 1.7 }}>
        חשוב: ההפקה שומרת על תבניות ה־Excel המקוריות ומכניסה לתוכן את נתוני הפרויקט, הרשומות המאושרות ותוצאות תעודות המעבדה שנקלטו במערכת.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        {visibleTemplates.map((template) => {
          const count = rowsByTemplate[template.id]?.length ?? 0;
          return (
            <div key={template.id} style={{ border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#fff", boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{template.title}</div>
                  <div style={{ color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>{template.description}</div>
                </div>
                <span style={{ borderRadius: 999, background: "#eef2ff", color: "#3730a3", padding: "5px 10px", fontWeight: 900, whiteSpace: "nowrap" }}>{count} תוצאות</span>
              </div>

              <div style={{ marginTop: 12, minHeight: 40, color: count ? "#166534" : "#64748b", fontWeight: 800 }}>
                {count ? `נמצאו ${count} תעודות/רשומות לשיבוץ בריכוז.` : "אין עדיין תוצאות — ניתן להוריד ריכוז ריק."}
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                <button type="button" disabled={busyId === template.id} onClick={() => downloadAutomatic(template)} style={{ border: 0, borderRadius: 12, padding: "12px 14px", fontWeight: 900, color: "#fff", background: "#0f172a", cursor: busyId === template.id ? "wait" : "pointer" }}>
                  {busyId === template.id ? "מפיק ריכוז..." : "הורד ריכוז אוטומטי Excel"}
                </button>
                <button type="button" disabled={busyId === `empty-${template.id}`} onClick={() => downloadEmptyTemplate(template)} style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 12px", fontWeight: 900, color: "#0f172a", background: "#fff", cursor: busyId === `empty-${template.id}` ? "wait" : "pointer" }}>
                  {busyId === `empty-${template.id}` ? "מכין תבנית..." : "הורד תבנית עם פרטי פרויקט"}
                </button>
                <div style={{ fontSize: 12, color: "#64748b", direction: "ltr", textAlign: "right" }}>{template.fileName}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default ConcentrationsSection;
