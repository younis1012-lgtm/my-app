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
    { label: "שם פרויקט", value: meta.projectName, fallbacks: [["H4", "J4"], ["A4", "B4"]] },
    { label: "ניהול פרויקט", value: meta.projectManager, fallbacks: [["H5", "J5"], ["A5", "B5"]] },
    { label: "שם הקבלן", value: meta.contractor, fallbacks: [["H6", "J6"], ["A6", "B6"]] },
    { label: "הבטחת איכות", value: meta.qualityAssurance, fallbacks: [["L7", "M7"], ["A7", "B7"]] },
    { label: "בקרת איכות", value: meta.qualityControl, fallbacks: [["H7", "J7"], ["A8", "B8"]] },
  ];

  const allCells = Array.from(sheetData.getElementsByTagNameNS(excelNs, "c"));
  items.forEach((item) => {
    let filled = false;
    allCells.forEach((cell) => {
      const ref = cell.getAttribute("r") ?? "";
      const text = normalize(cellText(cell, sharedStrings)).replace(/[:：]/g, "");
      if (!ref || !text || !text.includes(normalize(item.label))) return;
      setCell(doc, sheetData, ref, `${item.label}:`);
      setCell(doc, sheetData, nextCellRef(ref), item.value);
      filled = true;
    });

    item.fallbacks.forEach(([labelCell, valueCell], index) => {
      if (index > 0 && filled) return;
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

const genericRowValues = (template: ConcentrationTemplate, row: ConcentrationRow, index: number): Array<string | number> => {
  if (template.id === "contractors") {
    return [index, row.contractor || row.title, row.itemDescription, row.certificateNo, row.date, row.status, row.inspector, row.notes];
  }
  if (template.id === "suppliers") {
    return [index, row.contractor || row.title, row.itemDescription, row.certificateNo, row.date, row.status, row.inspector, row.notes];
  }
  if (template.id === "materials") {
    return [index, row.title, row.itemDescription, row.contractor, row.certificateNo, row.date, row.status, row.inspector, row.notes];
  }
  if (template.id === "nonconformances") {
    return [index, row.title, row.location, row.date, row.responsible, row.status, row.itemDescription, row.notes];
  }
  if (template.id === "trial-sections" || template.id === "supervision") {
    return [index, row.title, row.location, row.date, row.itemDescription, row.status, row.inspector, row.notes];
  }

  return [
    index,
    row.checklistNo,
    row.date || row.executionDate,
    row.title,
    row.category,
    row.location,
    row.contractor,
    row.itemDescription,
    row.attachmentKind,
    row.certificateNo || labValue(row, "certificateNo"),
    labValue(row, "sampleDate" as keyof LabCertificateResults),
    labValue(row, "source" as keyof LabCertificateResults),
    labValue(row, "maxDensity" as keyof LabCertificateResults),
    labValue(row, "optimumMoisture" as keyof LabCertificateResults),
    labValue(row, "density" as keyof LabCertificateResults),
    labValue(row, "moisture" as keyof LabCertificateResults),
    labValue(row, "compaction" as keyof LabCertificateResults),
    labValue(row, "sandEquivalent" as keyof LabCertificateResults),
    labValue(row, "cbr" as keyof LabCertificateResults),
    labValue(row, "sieve3" as keyof LabCertificateResults),
    labValue(row, "sieve15" as keyof LabCertificateResults),
    labValue(row, "sieve34" as keyof LabCertificateResults),
    labValue(row, "sieve4" as keyof LabCertificateResults),
    labValue(row, "sieve10" as keyof LabCertificateResults),
    labValue(row, "sieve40" as keyof LabCertificateResults),
    labValue(row, "sieve200" as keyof LabCertificateResults),
    labValue(row, "ll" as keyof LabCertificateResults),
    labValue(row, "pl" as keyof LabCertificateResults),
    labValue(row, "pi" as keyof LabCertificateResults),
    labValue(row, "losAngeles" as keyof LabCertificateResults),
    labValue(row, "aashto" as keyof LabCertificateResults),
    row.status,
    row.inspector,
    row.notes,
    row.fileName,
  ];
};

const findFirstWritableRow = (sheetData: Element) => {
  const rows = Array.from(sheetData.getElementsByTagNameNS(excelNs, "row"));
  const occupied = rows
    .map((row) => Number(row.getAttribute("r") ?? 0))
    .filter((row) => Number.isFinite(row) && row > 0);
  const last = occupied.length ? Math.max(...occupied) : 14;
  return Math.max(15, last + 1);
};

const patchGenericWorkbook = async (buffer: ArrayBuffer, projectMeta: Required<ProjectConcentrationMeta>, rows: ConcentrationRow[] = [], template?: ConcentrationTemplate) => {
  const zip = await patchWorkbookProjectHeader(buffer, projectMeta);
  const sheetPath = "xl/worksheets/sheet1.xml";
  const worksheetFile = zip.file(sheetPath);
  if (worksheetFile && rows.length && template) {
    const xml = await worksheetFile.async("text");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const sheetData = doc.getElementsByTagNameNS(excelNs, "sheetData")[0];
    if (sheetData) {
      const startRow = findFirstWritableRow(sheetData);
      rows.forEach((row, rowIndex) => {
        genericRowValues(template, row, rowIndex + 1).forEach((value, colIndex) => {
          setCell(doc, sheetData, `${columnLetters(colIndex + 1)}${startRow + rowIndex}`, value);
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
