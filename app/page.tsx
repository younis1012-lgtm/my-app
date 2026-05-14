"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ApprovalFlow,
  ChecklistItem,
  ChecklistRecord,
  ChecklistTemplateKey,
  NonconformanceRecord,
  PreliminaryRecord,
  PreliminaryTab,
  Project,
  Section,
  TrialSectionRecord,
  PersistedData,
} from "./types";
import {
  buildChecklistItemsFromTemplate,
  checklistTemplates,
  defaultProjects,
  normalizeChecklistTemplateKey,
} from "./checklistTemplates";
import { styles } from "./components/common";
import { HomeSection } from "./components/HomeSection";
import { ProjectsSection } from "./components/ProjectsSection";
import { TrialSectionsSection } from "./components/TrialSectionsSection";
import { PreliminarySection } from "./components/PreliminarySection";
import { ConcentrationsSection } from "./components/ConcentrationsSection";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
const STORAGE_KEY = "yk-quality-stage4-multifile";
const CURRENT_PROJECT_STORAGE_KEY = `${STORAGE_KEY}-current-project-id`;
const SUPABASE_HEADER_ERROR_FRAGMENT =
  "String contains non ISO-8859-1 code point";
const CONTROL_QUALITY_COMPANY_NAME = 'קונטרולינג פריים בע"מ';
const FIXED_EMAIL_RECIPIENT = "q.controling@gmail.com";
const NONCONFORMANCE_TABLE = "NCR";

const ROAD_806_SURVEYOR_SIGNATURE_URL = "/signatures/road-806-surveyor.png";
const ROAD_806_SURVEYOR_NAME = "באסל שקארה";

const isRoad806Value = (value: unknown) => {
  const text = String(value ?? "");
  return text.includes("806") || text.includes("צלמון");
};

const isSurveyorRole = (value: unknown) => String(value ?? "").includes("מודד");

const APP_VERSION = "2026-05-04-checklist-top-editable-cache-refresh-v2";
const APP_VERSION_STORAGE_KEY = `${STORAGE_KEY}-app-version`;

type AppSection =
  | Section
  | "concentrations"
  | "projectDetails"
  | "projectUsers"
  | "rfi"
  | "supervisionReports"
  | "controlProcesses";


type ProjectEmailUser = {
  id: string;
  projectId: string;
  name: string;
  role: string;
  company: string;
  email: string;
  phone?: string;
  active: boolean;
  createdAt: string;
};

const PROJECT_EMAIL_USERS_STORAGE_KEY = `${STORAGE_KEY}-project-email-users`;
const PROJECT_EMAIL_USERS_TABLE = "project_email_users";

const normalizeEmailList = (value: unknown) =>
  String(value ?? "")
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

const isValidEmailAddress = (value: unknown) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());

const readProjectEmailUsers = (): ProjectEmailUser[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROJECT_EMAIL_USERS_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: any) => ({
        id: String(item?.id || crypto.randomUUID()),
        projectId: normalizeStoredProjectId(item?.projectId),
        name: String(item?.name || ""),
        role: String(item?.role || ""),
        company: String(item?.company || ""),
        email: String(item?.email || "").trim(),
        phone: String(item?.phone || ""),
        active: item?.active !== false,
        createdAt: String(item?.createdAt || new Date().toISOString()),
      }))
      .filter((item: ProjectEmailUser) => item.projectId && item.email);
  } catch {
    return [];
  }
};

const writeProjectEmailUsers = (users: ProjectEmailUser[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROJECT_EMAIL_USERS_STORAGE_KEY, JSON.stringify(users));
};

const saveProjectEmailUsersToCloud = async (users: ProjectEmailUser[]) => {
  if (!isSupabaseConfigured || !supabase) return;
  const normalized = users.map((user) => ({
    id: user.id,
    project_id: normalizeStoredProjectId(user.projectId),
    name: user.name,
    role: user.role,
    company: user.company,
    email: user.email,
    phone: user.phone || "",
    active: user.active !== false,
    created_at: user.createdAt || new Date().toISOString(),
  }));
  const { error } = await supabase.from(PROJECT_EMAIL_USERS_TABLE).upsert(normalized, { onConflict: "id" });
  if (error) throw error;
};

const loadProjectEmailUsersFromCloud = async () => {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.from(PROJECT_EMAIL_USERS_TABLE).select("*");
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((item: any) => ({
    id: String(item?.id || crypto.randomUUID()),
    projectId: normalizeStoredProjectId(item?.project_id || item?.projectId),
    name: String(item?.name || ""),
    role: String(item?.role || ""),
    company: String(item?.company || ""),
    email: String(item?.email || "").trim(),
    phone: String(item?.phone || ""),
    active: item?.active !== false,
    createdAt: String(item?.created_at || item?.createdAt || new Date().toISOString()),
  })).filter((item: ProjectEmailUser) => item.projectId && item.email);
};

type ProjectProfile = {
  projectName: string;
  contractor: string;
  projectManager: string;
  qaCompany: string;
  qualityControl: string;
  workManager: string;
  surveyor: string;
};

const PROJECT_PROFILES: ProjectProfile[] = [
  {
    projectName: "כביש 806 צלמון שלב א׳",
    contractor: 'מפלסי הגליל סלילה עפר ופיתוח בע"מ',
    projectManager: 'א.ש. רונן הנדסה אזרחית בע"מ',
    qaCompany: 'תיקו הנדסה בע"מ',
    qualityControl: "יונס אברהים",
    workManager: "חוסיין מריסאת",
    surveyor: "באסל שקארה",
  },
];

const PROJECT_ID_ALIASES: Record<string, string> = {
  "project-806": "80600000-0000-0000-0000-000000000000",
  "project-909": "90900000-0000-0000-0000-000000000000",
};

const normalizeStoredProjectId = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/[\u2010-\u2015]/g, "-").trim();
  if (PROJECT_ID_ALIASES[cleaned]) return PROJECT_ID_ALIASES[cleaned];
  const lower = cleaned.toLowerCase();
  if (PROJECT_ID_ALIASES[lower]) return PROJECT_ID_ALIASES[lower];
  const codeMatch = lower.match(/^project[-_\s]*(\d+)$/);
  if (codeMatch?.[1] === "806") return PROJECT_ID_ALIASES["project-806"];
  if (codeMatch?.[1] === "909") return PROJECT_ID_ALIASES["project-909"];
  return cleaned;
};

const normalizeProjectIdValue = (value: unknown) =>
  normalizeStoredProjectId(value);

const sanitizeCloudPayload = <T,>(value: T): T => {
  if (Array.isArray(value))
    return value.map((item) => sanitizeCloudPayload(item)) as T;
  if (!value || typeof value !== "object") {
    return (
      typeof value === "string"
        ? normalizeStoredProjectId(value) || value
        : value
    ) as T;
  }
  const next: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    if (key === "project_id" || key === "projectId")
      next[key] = normalizeStoredProjectId(item);
    else next[key] = sanitizeCloudPayload(item);
  });
  return next as T;
};

const migrateProjectLegendMap = (
  value: unknown,
): Record<string, ProjectLegend> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, ProjectLegend> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, legend]) => {
    const normalizedKey = normalizeStoredProjectId(key);
    if (!normalizedKey) return;
    result[normalizedKey] = normalizeProjectLegend(legend);
  });
  return result;
};

const FALLBACK_PROJECTS: Project[] = [
  {
    id: "80600000-0000-0000-0000-000000000000",
    name: "כביש 806 צלמון שלב א׳",
    description: "פרויקט ברירת מחדל לפי הרשאת משתמש 806",
    manager: 'א.ש. רונן הנדסה אזרחית בע"מ',
    isActive: true,
    createdAt: "ברירת מחדל",
  },
  {
    id: "90900000-0000-0000-0000-000000000000",
    name: "פרויקט 909",
    description: "פרויקט ברירת מחדל לפי הרשאת משתמש 909",
    manager: "",
    isActive: false,
    createdAt: "ברירת מחדל",
  },
];

const getDefaultProjectList = (): Project[] => {
  const source =
    Array.isArray(defaultProjects) && defaultProjects.length
      ? defaultProjects
      : FALLBACK_PROJECTS;
  return source.map((project, index) => ({
    ...project,
    id: normalizeStoredProjectId(project.id),
    isActive: index === 0 ? true : Boolean(project.isActive),
  }));
};

const normalizeProjectRows = (rows: any[] | null | undefined): Project[] => {
  const mapped = (rows ?? [])
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: normalizeStoredProjectId(row.id ?? crypto.randomUUID()),
      name: String(row.name ?? "").trim(),
      description: String(row.description ?? ""),
      manager: String(row.manager ?? ""),
      isActive: Boolean(row.is_active ?? row.isActive),
      createdAt: row.created_at
        ? new Date(row.created_at).toLocaleString("he-IL")
        : String(row.createdAt ?? ""),
    }))
    .filter((project) => project.id && project.name);

  const source = mapped.length ? mapped : getDefaultProjectList();
  return source.map((project, index) => ({
    ...project,
    isActive: source.some((item) => item.isActive)
      ? Boolean(project.isActive)
      : index === 0,
  }));
};

const AUTH_STORAGE_KEY = `${STORAGE_KEY}-system-user`;
const AUTH_SESSION_TIMEOUT_MS = 10 * 60 * 1000;
const ACCESS_USERS_STORAGE_KEY = `${STORAGE_KEY}-access-users`;
const ACCESS_USERS_TABLE = "project_access_users";
const PROJECT_LEGEND_STORAGE_KEY = `${STORAGE_KEY}-project-legend`;
const PROJECT_LEGEND_TABLE = "project_legends";
const RFI_STORAGE_KEY = `${STORAGE_KEY}-rfi-records`;
const CONTROL_PROCESS_STORAGE_KEY = `${STORAGE_KEY}-control-processes`;
const CONTROL_PROCESS_TABLE = "control_processes";

type ControlProcessStatus =
  | "טיוטה"
  | "בביצוע"
  | "ממתין לאישור"
  | "מאושר"
  | "נדחה"
  | "נעול";
type RequiredDocumentType =
  | "תעודת מעבדה"
  | "רשימת מדידה"
  | "צילום"
  | "אישור ספק"
  | "תוכנית"
  | "RFI"
  | "אחר";

type RequiredDocument = {
  id: string;
  type: RequiredDocumentType;
  description: string;
  required: boolean;
  attached: boolean;
  attachmentName?: string;
  attachedAt?: string;
  attachmentDataUrl?: string;
  attachmentType?: string;
};

type ReferenceResultRow = {
  id: string;
  metric: string;
  resultValue: string;
  qualityStatus: string;
  minValue: string;
  maxValue: string;
};


type AuditEntry = {
  action: string;
  by: string;
  at: string;
  note?: string;
};

type ControlProcessRecord = {
  id: string;
  projectId: string;
  processNo: string;
  title: string;
  workType: string;
  specSection: string;
  location: string;
  fromSection: string;
  toSection: string;
  status: ControlProcessStatus;
  checklistIds: string[];
  rfiIds: string[];
  nonconformanceIds: string[];
  requiredDocuments: RequiredDocument[];
  referenceResults: ReferenceResultRow[];
  auditTrail: AuditEntry[];
  approval: ApprovalFlow;
  lockedAt: string;
  savedAt: string;
};

const CONTROL_PROCESS_STATUS_OPTIONS: ControlProcessStatus[] = [
  "טיוטה",
  "בביצוע",
  "ממתין לאישור",
  "מאושר",
  "נדחה",
  "נעול",
];
const REQUIRED_DOCUMENT_TYPES: RequiredDocumentType[] = [
  "תעודת מעבדה",
  "רשימת מדידה",
  "צילום",
  "אישור ספק",
  "תוכנית",
  "RFI",
  "אחר",
];

const REFERENCE_MATERIAL_OPTIONS = [
  "אישור חומר חצץ",
  "סוללות מילוי מיובא",
  "סוללות מילוי חומר מקומי",
  "שכבות אגו״ם לקביעת קו דירוג",
  "בטון יצוק באתר - כללי דריכה",
  "חול מיוצב צמנט",
  "עבודות אספלט באתר - קביעת מערכת מרשל",
  "הידוק קרקע יסוד",
  "בטון יצוק באתר - בדיקת ברזל",
  "מצע א׳ - דירוג ושווה ערך חול",
  "שכבות מצע ב׳",
  "אבקת בנטונייט",
  "חומר דיוס",
  "פלדה",
  "אבן לחיפוי",
  "חול לצינור / אבן שברי אבן",
  "ריצוף באבן טבעית",
  "סוללות עפר - מילוי מובקר מחומר אינרטי",
  "בטון יצוק באתר",
  "בטון מותז",
  "ייצור אלמנטים טרומיים לחומה",
  "בדיקה ובקרה פנימית של התכנון",
  "אגרגטים ת״י 3",
  "מצע ג׳",
  "מילוי נברר",
  "מילוי אינרטי",
  "שתית / קרקע יסוד",
  "אספלט - שכבה נושאת",
  "אספלט - שכבה מקשרת",
  "אספלט - שכבה עליונה",
  "בטון ב-30",
  "בטון ב-40",
  "בטון ב-50",
  "בטון ב-60",
  "אחר",
];

const isAsphaltReference = (value: unknown) =>
  String(value ?? "").includes("אספלט") || String(value ?? "").includes("מרשל");

const REFERENCE_RESULTS_AUDIT_ACTION = "__reference_results__";

const MATZEA_A_REFERENCE_RESULT_DEFS: Array<{
  metric: string;
  minValue: string;
  maxValue: string;
}> = [
  { metric: "דירוג AASHTO מיין", minValue: "", maxValue: "" },
  { metric: "רטיבות מחושבת", minValue: "", maxValue: "" },
  { metric: "תיאור החומר", minValue: "", maxValue: "" },
  { metric: 'מקטע 3/4"', minValue: "", maxValue: "" },
  { metric: "100% מחושב", minValue: "", maxValue: "" },
  { metric: '3"', minValue: "100", maxValue: "100" },
  { metric: '1.5"', minValue: "80", maxValue: "100" },
  { metric: '1"', minValue: "", maxValue: "" },
  { metric: '3/4"', minValue: "60", maxValue: "85" },
  { metric: "#4", minValue: "30", maxValue: "55" },
  { metric: "#10", minValue: "20", maxValue: "40" },
  { metric: "#40", minValue: "", maxValue: "" },
  { metric: "#200", minValue: "5", maxValue: "15" },
  { metric: "גבול נזילות (LL)", minValue: "0", maxValue: "25" },
  { metric: "גבול פלסטיות (PL)", minValue: "", maxValue: "" },
  { metric: "אינדקס פלסטיות (PI)", minValue: "0", maxValue: "6" },
  { metric: "שווה ערך חול", minValue: "27", maxValue: "100" },
  { metric: "צפיפות מכשירית", minValue: "2.3", maxValue: "10" },
  { metric: "ספיגות (G)", minValue: "", maxValue: "" },
  { metric: "לוס אנג'לס", minValue: "0", maxValue: "35" },
  { metric: "מיין AASHTO", minValue: "", maxValue: "" },
  { metric: "צפיפות מעבדתית מקסימלית", minValue: "", maxValue: "" },
  { metric: "רטיבות אופטימלית", minValue: "", maxValue: "" },
  { metric: "מספר תעודת מעבדה", minValue: "", maxValue: "" },
  { metric: "תאריך", minValue: "", maxValue: "" },
  { metric: "מקום הדגם לבדיקה", minValue: "", maxValue: "" },
  { metric: "מבנה", minValue: "", maxValue: "" },
];

const SELECTED_MATERIAL_REFERENCE_RESULT_DEFS: Array<{
  metric: string;
  minValue: string;
  maxValue: string;
}> = [
  { metric: "דירוג AASHTO מיין", minValue: "", maxValue: "" },
  { metric: "תיאור החומר", minValue: "", maxValue: "" },
  { metric: "#10", minValue: "", maxValue: "" },
  { metric: "#40", minValue: "", maxValue: "" },
  { metric: "#200", minValue: "0", maxValue: "35" },
  { metric: "גבול נזילות (LL)", minValue: "0", maxValue: "40" },
  { metric: "גבול פלסטיות (PL)", minValue: "", maxValue: "" },
  { metric: "אינדקס פלסטיות (PI)", minValue: "0", maxValue: "10" },
  { metric: "מיין AASHTO", minValue: "", maxValue: "" },
  { metric: "צפיפות מעבדתית מקסימלית", minValue: "", maxValue: "" },
  { metric: "רטיבות אופטימלית", minValue: "", maxValue: "" },
  { metric: "מספר תעודת מעבדה", minValue: "", maxValue: "" },
  { metric: "תאריך", minValue: "", maxValue: "" },
  { metric: "מקום הדגם לבדיקה", minValue: "", maxValue: "" },
  { metric: "מבנה", minValue: "", maxValue: "" },
];

const isMatzeaAReference = (value: unknown) => {
  const text = normalizeHebrewProjectName(value);
  return text.includes("מצע א") || text.includes("מצע א׳");
};

const isSelectedMaterialReference = (value: unknown) => {
  const text = normalizeHebrewProjectName(value);
  return text.includes("נברר") || text.includes("A-2-4") || text.includes("a-2-4");
};

const createMatzeaAReferenceResults = (): ReferenceResultRow[] =>
  MATZEA_A_REFERENCE_RESULT_DEFS.map((row) => ({
    id: `matzea-a-${row.metric}`.replace(/\s+/g, "-"),
    metric: row.metric,
    resultValue: "",
    qualityStatus: "",
    minValue: row.minValue,
    maxValue: row.maxValue,
  }));

const createSelectedMaterialReferenceResults = (): ReferenceResultRow[] =>
  SELECTED_MATERIAL_REFERENCE_RESULT_DEFS.map((row) => ({
    id: `selected-material-${row.metric}`.replace(/\s+/g, "-"),
    metric: row.metric,
    resultValue: "",
    qualityStatus: "",
    minValue: row.minValue,
    maxValue: row.maxValue,
  }));

const normalizeReferenceResults = (value: unknown): ReferenceResultRow[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((row: any, index) => ({
      id: String(row?.id ?? row?.metric ?? `reference-result-${index}`),
      metric: String(row?.metric ?? row?.resultMetric ?? row?.measure ?? ""),
      resultValue: String(row?.resultValue ?? row?.value ?? row?.result ?? ""),
      qualityStatus: String(row?.qualityStatus ?? row?.status ?? ""),
      minValue: String(row?.minValue ?? row?.minimum ?? row?.min ?? ""),
      maxValue: String(row?.maxValue ?? row?.maximum ?? row?.max ?? ""),
    }))
    .filter((row) => row.metric.trim());
};


const parseReferenceNumber = (value: unknown): number | null => {
  const normalized = String(value ?? "")
    .trim()
    .replace(/,/g, ".")
    .replace(/[^0-9.\-]/g, "");
  if (!normalized || normalized === "-" || normalized === ".") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const calculateReferenceQualityStatus = (
  resultValue: unknown,
  minValue: unknown,
  maxValue: unknown,
): string => {
  const result = parseReferenceNumber(resultValue);
  const min = parseReferenceNumber(minValue);
  const max = parseReferenceNumber(maxValue);
  if (result === null || (min === null && max === null)) return "";
  if (min !== null && result < min) return "לא תקין";
  if (max !== null && result > max) return "לא תקין";
  return "תקין";
};

const applyReferenceQualityStatus = (row: ReferenceResultRow): ReferenceResultRow => {
  const autoStatus = calculateReferenceQualityStatus(
    row.resultValue,
    row.minValue,
    row.maxValue,
  );
  return autoStatus ? { ...row, qualityStatus: autoStatus } : row;
};

const mergeReferenceResultsWithTemplate = (
  template: ReferenceResultRow[],
  current: ReferenceResultRow[],
): ReferenceResultRow[] => {
  const byMetric = new Map(
    current.map((row) => [normalizeHebrewProjectName(row.metric), row]),
  );
  return template.map((fixed) => {
    const existing = byMetric.get(normalizeHebrewProjectName(fixed.metric));
    return existing
      ? applyReferenceQualityStatus({
          ...fixed,
          id: existing.id || fixed.id,
          resultValue: existing.resultValue ?? "",
          qualityStatus: existing.qualityStatus ?? "",
        })
      : fixed;
  });
};

const ensureReferenceResultsForMaterial = (
  workType: unknown,
  current: unknown,
): ReferenceResultRow[] => {
  const normalized = normalizeReferenceResults(current);
  if (isMatzeaAReference(workType)) {
    return mergeReferenceResultsWithTemplate(
      createMatzeaAReferenceResults(),
      normalized,
    );
  }
  if (isSelectedMaterialReference(workType)) {
    return mergeReferenceResultsWithTemplate(
      createSelectedMaterialReferenceResults(),
      normalized,
    );
  }
  return normalized;
};

const extractReferenceResultsFromAudit = (value: any): ReferenceResultRow[] => {
  const audit = Array.isArray(value?.auditTrail ?? value?.audit_log)
    ? (value.auditTrail ?? value.audit_log)
    : [];
  const entry = [...audit]
    .reverse()
    .find((item: any) => item?.action === REFERENCE_RESULTS_AUDIT_ACTION);
  if (!entry?.note) return [];
  try {
    return normalizeReferenceResults(JSON.parse(String(entry.note)));
  } catch {
    return [];
  }
};

const auditWithoutReferenceResults = (value: unknown): AuditEntry[] =>
  Array.isArray(value)
    ? value
        .filter((entry: any) => entry?.action !== REFERENCE_RESULTS_AUDIT_ACTION)
        .map((entry: any) => ({
          action: String(entry?.action ?? ""),
          by: String(entry?.by ?? ""),
          at: String(entry?.at ?? ""),
          note: String(entry?.note ?? ""),
        }))
    : [];

const createDefaultRequiredDocuments = (): RequiredDocument[] => [
  {
    id: crypto.randomUUID(),
    type: "תעודת מעבדה",
    description: "תעודות בדיקה / מעבדה לפי סוג העבודה",
    required: true,
    attached: false,
  },
  {
    id: crypto.randomUUID(),
    type: "רשימת מדידה",
    description: "מדידה / חתכים / גבהים לפי הצורך",
    required: true,
    attached: false,
  },
  {
    id: crypto.randomUUID(),
    type: "צילום",
    description: "תיעוד חזותי מהשטח",
    required: false,
    attached: false,
  },
];

const createDefaultControlProcess = (
  processNo = "REF-1",
): Omit<ControlProcessRecord, "id" | "projectId" | "savedAt"> => ({
  processNo,
  title: "אישור חומר / תעודת ייחוס חדשה",
  workType: "אספלט - מרשל / JMF",
  specSection: "",
  location: "",
  fromSection: "",
  toSection: "",
  status: "טיוטה",
  checklistIds: [],
  rfiIds: [],
  nonconformanceIds: [],
  requiredDocuments: [],
  referenceResults: [],
  auditTrail: [],
  approval: createDefaultApproval(),
  lockedAt: "",
});

const normalizeRequiredDocuments = (value: unknown): RequiredDocument[] =>
  Array.isArray(value)
    ? value.map((item: any, index) => ({
        id: String(item?.id ?? `${Date.now()}-${index}`),
        type: REQUIRED_DOCUMENT_TYPES.includes(item?.type) ? item.type : "אחר",
        description: String(item?.description ?? item?.type ?? "מסמך"),
        required: item?.required !== false,
        attached: Boolean(item?.attached),
        attachmentName: String(item?.attachmentName ?? ""),
        attachedAt: String(item?.attachedAt ?? ""),
        attachmentDataUrl: String(
          item?.attachmentDataUrl ?? item?.dataUrl ?? item?.url ?? "",
        ),
        attachmentType: String(item?.attachmentType ?? item?.type ?? ""),
      }))
    : [];

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];

const normalizeControlProcess = (value: any): ControlProcessRecord | null => {
  if (!value || typeof value !== "object") return null;
  return {
    id: String(value.id ?? crypto.randomUUID()),
    projectId: String(value.projectId ?? value.project_id ?? ""),
    processNo: String(value.processNo ?? value.process_no ?? ""),
    title: String(value.title ?? "תהליך בקרה"),
    workType: String(value.workType ?? value.work_type ?? ""),
    specSection: String(value.specSection ?? value.spec_section ?? ""),
    location: String(value.location ?? ""),
    fromSection: String(value.fromSection ?? value.from_section ?? ""),
    toSection: String(value.toSection ?? value.to_section ?? ""),
    status: CONTROL_PROCESS_STATUS_OPTIONS.includes(value.status)
      ? value.status
      : "טיוטה",
    checklistIds: normalizeStringArray(
      value.checklistIds ?? value.checklist_ids,
    ),
    rfiIds: normalizeStringArray(value.rfiIds ?? value.rfi_ids),
    nonconformanceIds: normalizeStringArray(
      value.nonconformanceIds ?? value.nonconformance_ids,
    ),
    requiredDocuments: normalizeRequiredDocuments(
      value.requiredDocuments ?? value.required_documents,
    ),
    referenceResults: ensureReferenceResultsForMaterial(
      value.workType ?? value.work_type,
      value.referenceResults ?? value.reference_results ?? extractReferenceResultsFromAudit(value),
    ),
    auditTrail: auditWithoutReferenceResults(value.auditTrail ?? value.audit_log),
    approval: normalizeApproval(value.approval),
    lockedAt: String(value.lockedAt ?? value.locked_at ?? ""),
    savedAt: String(value.savedAt ?? value.saved_at ?? ""),
  };
};

const controlProcessToRow = (record: ControlProcessRecord) => ({
  id: record.id,
  project_id: normalizeStoredProjectId(record.projectId),
  process_no: record.processNo,
  title: record.title,
  work_type: record.workType,
  spec_section: record.specSection,
  location: record.location,
  from_section: record.fromSection,
  to_section: record.toSection,
  status: record.status,
  checklist_ids: record.checklistIds,
  rfi_ids: record.rfiIds,
  nonconformance_ids: record.nonconformanceIds,
  required_documents: record.requiredDocuments,
  audit_log: [
    ...auditWithoutReferenceResults(record.auditTrail),
    {
      action: REFERENCE_RESULTS_AUDIT_ACTION,
      by: "system",
      at: nowIso(),
      note: JSON.stringify(normalizeReferenceResults(record.referenceResults)),
    },
  ],
  approval: record.approval,
  locked_at: record.lockedAt || null,
  saved_at: nowIso(),
});

type RfiRecord = {
  id: string;
  projectId: string;
  title: string;
  referenceNo: string;
  rfiNumber: number | null;
  status: "פתוח" | "ממתין להתייחסות" | "בטיפול" | "נענה" | "סגור";
  planNo: string;
  revision: string;
  planName: string;
  buildingDetails: string;
  building: string;
  openDate: string;
  location: string;
  workActivity: string;
  relevantPlans: string;
  fromSection: string;
  toSection: string;
  requestDescription: string;
  budgetImpact: string;
  scheduleImpact: string;
  response: string;
  closeDate: string;
  closedAt: string;
  closedBy: string;
  createdBy: string;
  updatedBy: string;
  updatedAt: string;
  auditTrail: Array<{ action: string; by: string; at: string; note: string }>;
  documents: StoredAttachment[];
  savedAt: string;
};

const createDefaultRfi = (
  title = "RFI מס׳ 1",
): Omit<RfiRecord, "id" | "projectId" | "savedAt"> => ({
  title,
  referenceNo: "",
  rfiNumber: null,
  status: "פתוח",
  planNo: "",
  revision: "",
  planName: "",
  buildingDetails: "",
  building: "",
  openDate: new Date().toISOString().slice(0, 10),
  location: "",
  workActivity: "",
  relevantPlans: "",
  fromSection: "",
  toSection: "",
  requestDescription: "",
  budgetImpact: "",
  scheduleImpact: "",
  response: "",
  closeDate: "",
  closedAt: "",
  closedBy: "",
  createdBy: "",
  updatedBy: "",
  updatedAt: "",
  auditTrail: [],
  documents: [],
});

const normalizeRfiRecord = (value: any): RfiRecord | null => {
  if (!value || typeof value !== "object") return null;
  return {
    id: String(value.id ?? crypto.randomUUID()),
    projectId: String(value.projectId ?? ""),
    title: String(value.title ?? "RFI"),
    referenceNo: String(value.referenceNo ?? ""),
    rfiNumber:
      value.rfiNumber === null ||
      value.rfiNumber === undefined ||
      value.rfiNumber === ""
        ? null
        : Number(value.rfiNumber),
    status: ["פתוח", "ממתין להתייחסות", "בטיפול", "נענה", "סגור"].includes(
      value.status,
    )
      ? value.status
      : "פתוח",
    planNo: String(value.planNo ?? ""),
    revision: String(value.revision ?? ""),
    planName: String(value.planName ?? ""),
    buildingDetails: String(value.buildingDetails ?? ""),
    building: String(value.building ?? ""),
    openDate: String(value.openDate ?? ""),
    location: String(value.location ?? ""),
    workActivity: String(value.workActivity ?? ""),
    relevantPlans: String(value.relevantPlans ?? ""),
    fromSection: String(value.fromSection ?? ""),
    toSection: String(value.toSection ?? ""),
    requestDescription: String(value.requestDescription ?? ""),
    budgetImpact: String(value.budgetImpact ?? ""),
    scheduleImpact: String(value.scheduleImpact ?? ""),
    response: String(value.response ?? ""),
    closeDate: String(value.closeDate ?? ""),
    closedAt: String(value.closedAt ?? ""),
    closedBy: String(value.closedBy ?? ""),
    createdBy: String(value.createdBy ?? ""),
    updatedBy: String(value.updatedBy ?? ""),
    updatedAt: String(value.updatedAt ?? ""),
    auditTrail: Array.isArray(value.auditTrail)
      ? value.auditTrail
          .map((entry: any) => ({
            action: String(entry?.action ?? ""),
            by: String(entry?.by ?? ""),
            at: String(entry?.at ?? ""),
            note: String(entry?.note ?? ""),
          }))
          .filter((entry: any) => entry.action || entry.note)
      : [],
    documents: normalizeAttachments(value.documents),
    savedAt: String(value.savedAt ?? ""),
  };
};

const rfiRowToRecord = (row: any): RfiRecord => ({
  id: String(row?.id ?? crypto.randomUUID()),
  projectId: normalizeStoredProjectId(row?.project_id ?? ""),
  title: String(row?.title ?? "RFI"),
  referenceNo: String(row?.reference_no ?? ""),
  rfiNumber:
    row?.rfi_number === null || row?.rfi_number === undefined
      ? null
      : Number(row.rfi_number),
  status: ["פתוח", "ממתין להתייחסות", "בטיפול", "נענה", "סגור"].includes(
    row?.status,
  )
    ? row.status
    : "פתוח",
  planNo: String(row?.plan_no ?? ""),
  revision: String(row?.revision ?? ""),
  planName: String(row?.plan_name ?? ""),
  buildingDetails: String(row?.building_details ?? ""),
  building: String(row?.building ?? ""),
  openDate: String(row?.open_date ?? ""),
  location: String(row?.location ?? ""),
  workActivity: String(row?.work_activity ?? ""),
  relevantPlans: String(row?.relevant_plans ?? ""),
  fromSection: String(row?.from_section ?? ""),
  toSection: String(row?.to_section ?? ""),
  requestDescription: String(row?.request_description ?? ""),
  budgetImpact: String(row?.budget_impact ?? ""),
  scheduleImpact: String(row?.schedule_impact ?? ""),
  response: String(row?.response ?? ""),
  closeDate: String(row?.close_date ?? ""),
  closedAt: String(row?.closed_at ?? ""),
  closedBy: String(row?.closed_by ?? ""),
  createdBy: String(row?.created_by ?? ""),
  updatedBy: String(row?.updated_by ?? ""),
  updatedAt: row?.updated_at
    ? new Date(row.updated_at).toLocaleString("he-IL")
    : "",
  auditTrail: Array.isArray(row?.audit_log)
    ? row.audit_log.map((entry: any) => ({
        action: String(entry?.action ?? ""),
        by: String(entry?.by ?? ""),
        at: String(entry?.at ?? ""),
        note: String(entry?.note ?? ""),
      }))
    : [],
  documents: normalizeAttachments(row?.documents),
  savedAt: row?.created_at
    ? new Date(row.created_at).toLocaleString("he-IL")
    : "",
});

const rfiRecordToRow = (record: RfiRecord) => ({
  id: record.id,
  project_id: normalizeStoredProjectId(record.projectId),
  title: record.title,
  reference_no: record.referenceNo,
  ...(record.rfiNumber == null ? {} : { rfi_number: record.rfiNumber }),
  status: record.status,
  plan_no: record.planNo,
  revision: record.revision,
  plan_name: record.planName,
  building_details: record.buildingDetails,
  building: record.building,
  open_date: record.openDate || null,
  location: record.location,
  work_activity: record.workActivity,
  relevant_plans: record.relevantPlans,
  from_section: record.fromSection,
  to_section: record.toSection,
  request_description: record.requestDescription,
  budget_impact: record.budgetImpact,
  schedule_impact: record.scheduleImpact,
  response: record.response,
  close_date: record.closeDate || null,
  closed_at: record.closedAt || null,
  closed_by: record.closedBy,
  created_by: record.createdBy,
  updated_by: record.updatedBy,
  updated_at: record.updatedAt || null,
  audit_log: record.auditTrail ?? [],
  documents: normalizeAttachments(record.documents),
});

type ProjectLegend = {
  projectName: string;
  projectManagement: string;
  contractor: string;
  qualityAssurance: string;
  qualityControl: string;
  workManager: string;
  surveyor: string;
  supervisor: string;
  extraFactors: Array<{ id: string; label: string; value: string }>;
};

const normalizeProjectLegend = (
  value: unknown,
  fallbackProjectName = "",
): ProjectLegend => {
  const raw =
    value && typeof value === "object" ? (value as Partial<ProjectLegend>) : {};
  return {
    projectName: String(raw.projectName ?? fallbackProjectName ?? ""),
    projectManagement: String(raw.projectManagement ?? ""),
    contractor: String(raw.contractor ?? ""),
    qualityAssurance: String(raw.qualityAssurance ?? ""),
    qualityControl: String(raw.qualityControl ?? ""),
    workManager: String(raw.workManager ?? ""),
    surveyor: String(raw.surveyor ?? ""),
    supervisor: String(raw.supervisor ?? ""),
    extraFactors: Array.isArray((raw as any).extraFactors)
      ? (raw as any).extraFactors.map((item: any, index: number) => ({
          id: String(item?.id ?? `${Date.now()}-${index}`),
          label: String(item?.label ?? "גורם נוסף") || "גורם נוסף",
          value: String(item?.value ?? ""),
        }))
      : [],
  };
};

const isProjectLegendComplete = (legend: ProjectLegend | null | undefined) =>
  Boolean(
    String(legend?.projectName ?? "").trim() &&
    String(legend?.projectManagement ?? "").trim() &&
    String(legend?.contractor ?? "").trim() &&
    String(legend?.qualityAssurance ?? "").trim() &&
    String(legend?.qualityControl ?? "").trim(),
  );

const projectLegendToProfile = (legend: ProjectLegend): ProjectProfile => ({
  projectName: legend.projectName,
  contractor: legend.contractor,
  projectManager: legend.projectManagement,
  qaCompany: legend.qualityAssurance,
  qualityControl: legend.qualityControl,
  workManager: legend.workManager,
  surveyor: legend.surveyor,
});

const rowToProjectLegend = (
  row: any,
): { projectId: string; legend: ProjectLegend } | null => {
  if (!row || typeof row !== "object") return null;
  const projectId = normalizeStoredProjectId(
    row.project_id ?? row.projectId ?? "",
  );
  if (!projectId) return null;
  return {
    projectId,
    legend: normalizeProjectLegend({
      projectName: row.project_name ?? row.projectName ?? "",
      projectManagement: row.project_management ?? row.projectManagement ?? "",
      contractor: row.contractor ?? "",
      qualityAssurance: row.quality_assurance ?? row.qualityAssurance ?? "",
      qualityControl: row.quality_control ?? row.qualityControl ?? "",
      workManager: row.work_manager ?? row.workManager ?? "",
      surveyor: row.surveyor ?? "",
      supervisor: row.supervisor ?? "",
      extraFactors: row.extra_factors ?? row.extraFactors ?? [],
    }),
  };
};

const projectLegendToRow = (projectId: string, legend: ProjectLegend) => ({
  project_id: normalizeStoredProjectId(projectId),
  project_name: legend.projectName,
  project_management: legend.projectManagement,
  contractor: legend.contractor,
  quality_assurance: legend.qualityAssurance,
  quality_control: legend.qualityControl,
  work_manager: legend.workManager,
  surveyor: legend.surveyor,
  supervisor: legend.supervisor,
  extra_factors: legend.extraFactors ?? [],
  updated_at: nowIso(),
});

const loadProjectLegendsFromSupabase = async (): Promise<Record<
  string,
  ProjectLegend
> | null> => {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.from(PROJECT_LEGEND_TABLE).select("*");
  if (error) {
    if (!shouldIgnoreCloudError(error))
      console.warn("Failed to load project legends from Supabase", error);
    return null;
  }
  const result: Record<string, ProjectLegend> = {};
  (data ?? []).forEach((row: any) => {
    const parsed = rowToProjectLegend(row);
    if (parsed) result[parsed.projectId] = parsed.legend;
  });
  return result;
};

const saveProjectLegendToSupabase = async (
  projectId: string,
  legend: ProjectLegend,
) => {
  if (!isSupabaseConfigured || !supabase) return;
  const payload = projectLegendToRow(projectId, legend);
  const { error } = await supabase
    .from(PROJECT_LEGEND_TABLE)
    .upsert(payload, { onConflict: "project_id" });
  if (error) {
    if (shouldIgnoreCloudError(error)) return;
    throw new Error(errorText(error) || "שגיאה בשמירת פרטי הפרויקט ב-Supabase");
  }
};

type ProjectAccess = {
  username: string;
  password: string;
  displayName: string;
  role: "admin" | "user";
  code?: string;
  projectName?: string | null;
  signatureDataUrl?: string;
  signatureFileName?: string;
};

// כאן מגדירים משתמשים והרשאות.
// מנהל מערכת רואה את כל הפרויקטים.
// משתמש רגיל רואה רק את הפרויקט שהוגדר לו.
const DEFAULT_PROJECT_ACCESS_LIST: ProjectAccess[] = [
  {
    username: "admin",
    password: "admin123",
    displayName: "מנהל מערכת",
    role: "admin",
    code: "admin",
    projectName: null,
  },
  {
    username: "user806",
    password: "806",
    displayName: "משתמש פרויקט 806",
    role: "user",
    code: "806",
    projectName: "כביש 806 צלמון שלב א׳",
  },
  {
    username: "user909",
    password: "909",
    displayName: "משתמש פרויקט 909",
    role: "user",
    code: "909",
    projectName: "שם הפרויקט כפי שמופיע במערכת",
  },
];

const normalizeAccessValue = (value: unknown) =>
  String(value ?? "")
    .replace(/[׳`’']/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();

const accessLoginMatches = (access: ProjectAccess, value: string) => {
  const normalized = normalizeAccessValue(value);
  return (
    normalizeAccessValue(access.username) === normalized ||
    normalizeAccessValue(access.code) === normalized
  );
};

const findProjectAccessByCode = (users: ProjectAccess[], value: string) =>
  users.find((access) => accessLoginMatches(access, value));

const findProjectAccessByCredentials = (
  users: ProjectAccess[],
  usernameOrCode: string,
  password: string,
) =>
  users.find(
    (access) =>
      accessLoginMatches(access, usernameOrCode) &&
      String(access.password) === String(password),
  );

const normalizeProjectAccessList = (value: unknown): ProjectAccess[] => {
  if (!Array.isArray(value)) return DEFAULT_PROJECT_ACCESS_LIST;
  const normalized = value
    .filter((item) => item && typeof item === "object")
    .map(
      (item: any): ProjectAccess => ({
        username: String(item.username ?? "").trim(),
        password: String(item.password ?? ""),
        displayName: String(
          item.displayName ?? item.username ?? "משתמש",
        ).trim(),
        role: item.role === "admin" ? "admin" : "user",
        code: item.code ? String(item.code).trim() : undefined,
        projectName:
          item.role === "admin" ? null : String(item.projectName ?? "").trim(),
        signatureDataUrl: String(item.signatureDataUrl ?? ""),
        signatureFileName: String(item.signatureFileName ?? ""),
      }),
    )
    .filter((item) => item.username && item.password);

  return normalized.some((item) => item.role === "admin")
    ? normalized
    : DEFAULT_PROJECT_ACCESS_LIST;
};

const rowToProjectAccess = (row: any): ProjectAccess => ({
  username: String(row?.username ?? "").trim(),
  password: String(row?.password ?? ""),
  displayName: String(
    row?.display_name ?? row?.displayName ?? row?.username ?? "משתמש",
  ).trim(),
  role: row?.role === "admin" ? "admin" : "user",
  code: row?.code ? String(row.code).trim() : undefined,
  projectName:
    row?.role === "admin"
      ? null
      : String(row?.project_name ?? row?.projectName ?? "").trim(),
  signatureDataUrl: String(row?.signature ?? row?.signatureDataUrl ?? ""),
  signatureFileName: String(
    row?.signature_file_name ?? row?.signatureFileName ?? "",
  ),
});

const projectAccessToRow = (access: ProjectAccess) => ({
  username: access.username,
  password: access.password,
  display_name: access.displayName,
  role: access.role,
  code: access.code ?? null,
  project_name: access.role === "admin" ? null : (access.projectName ?? ""),
  signature: access.signatureDataUrl ?? "",
});

type StoredAuthSession = {
  username?: string;
  code?: string;
  role?: "admin" | "user";
  expiresAt?: number;
};

const readStoredAuthSession = (): StoredAuthSession | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuthSession;
    if (!parsed?.expiresAt || parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

const findUserForStoredSession = (
  users: ProjectAccess[],
  session: StoredAuthSession | null,
): ProjectAccess | null => {
  if (!session) return null;
  return (
    users.find(
      (user) =>
        (session.username && user.username === session.username) ||
        (session.code &&
          normalizeAccessValue(user.code ?? "") ===
            normalizeAccessValue(session.code)) ||
        (session.role === "admin" && user.role === "admin"),
    ) ?? null
  );
};

const writeAuthSession = (access: ProjectAccess) => {
  if (typeof window === "undefined") return;
  const session: StoredAuthSession = {
    username: access.username,
    code: access.code,
    role: access.role,
    expiresAt: Date.now() + AUTH_SESSION_TIMEOUT_MS,
  };
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

const refreshAuthSession = () => {
  if (typeof window === "undefined") return;
  const session = readStoredAuthSession();
  if (!session) return;
  window.localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      ...session,
      expiresAt: Date.now() + AUTH_SESSION_TIMEOUT_MS,
    }),
  );
};

const loadAccessUsersFromSupabase = async (): Promise<
  ProjectAccess[] | null
> => {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from(ACCESS_USERS_TABLE)
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Failed to load access users from Supabase", error);
    return null;
  }
  const users = normalizeProjectAccessList(
    (data ?? []).map(rowToProjectAccess),
  );
  return users.length ? users : null;
};

const saveAccessUsersToSupabase = async (users: ProjectAccess[]) => {
  if (!isSupabaseConfigured || !supabase) return;
  const normalized = normalizeProjectAccessList(users);
  const deleteResult = await supabase
    .from(ACCESS_USERS_TABLE)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (deleteResult.error)
    throw new Error(
      errorText(deleteResult.error) || "שגיאה במחיקת משתמשים ישנים מ-Supabase",
    );
  const insertResult = await supabase
    .from(ACCESS_USERS_TABLE)
    .insert(normalized.map(projectAccessToRow));
  if (insertResult.error)
    throw new Error(
      errorText(insertResult.error) || "שגיאה בשמירת משתמשים ל-Supabase",
    );
};

const isAdminAccess = (access: ProjectAccess | null) =>
  access?.role === "admin";

const projectMatchesAccess = (
  project: Project,
  access: ProjectAccess | null,
) => {
  if (!access) return false;
  if (isAdminAccess(access)) return true;

  const allowedName = normalizeHebrewProjectName(access.projectName ?? "");
  const code = normalizeAccessValue(access.code ?? access.username ?? "");
  const searchable = normalizeAccessValue(
    [project.id, project.name, project.description, project.manager].join(" "),
  );
  const projectName = normalizeHebrewProjectName(project.name);

  if (allowedName && projectName === allowedName) return true;
  if (allowedName && projectName.includes(allowedName)) return true;
  if (code && searchable.includes(code)) return true;

  return false;
};

const normalizeHebrewProjectName = (value: unknown) =>
  String(value ?? "")
    .replace(/[׳`’']/g, "")
    .replace(/\s+/g, " ")
    .trim();

const getProjectProfile = (
  projectName: unknown,
): ProjectProfile | undefined => {
  const normalized = normalizeHebrewProjectName(projectName);
  return PROJECT_PROFILES.find((profile) => {
    const profileName = normalizeHebrewProjectName(profile.projectName);
    return (
      normalized === profileName ||
      (normalized.includes("806") && normalized.includes("צלמון"))
    );
  });
};

const resolveResponsibleName = (responsible: unknown, projectName: unknown) => {
  const profile = getProjectProfile(projectName);
  if (!profile) return "";
  const role = String(responsible ?? "");

  if (role.includes("בקרת איכות") || role.includes("בקר איכות"))
    return profile.qualityControl;
  if (role.includes("מנהל עבודה")) return profile.workManager;
  if (role.includes("מודד")) return profile.surveyor;
  if (role.includes("הבטחת איכות")) return profile.qaCompany;
  if (role.includes("ניהול פרויקט") || role.includes("מנהל פרויקט"))
    return profile.projectManager;

  return "";
};

const nowLocal = () => new Date().toLocaleString("he-IL");
const nowIso = () => new Date().toISOString();

type StoredAttachment = {
  name: string;
  type: string;
  dataUrl: string;
  uploadedAt: string;
};

const normalizeAttachments = (value: unknown): StoredAttachment[] =>
  Array.isArray(value)
    ? value
        .filter((item) => item && typeof item === "object")
        .map((item: any) => ({
          name: String(item.name ?? "קובץ"),
          type: String(item.type ?? ""),
          dataUrl: String(item.dataUrl ?? ""),
          uploadedAt: String(item.uploadedAt ?? ""),
        }))
        .filter((item) => item.dataUrl)
    : [];

type ChecklistAttachmentKind = "lab" | "measurement" | "other";

type ChecklistAttachment = StoredAttachment & {
  id: string;
  kind: ChecklistAttachmentKind;
};

const normalizeChecklistAttachments = (
  value: unknown,
): ChecklistAttachment[] =>
  Array.isArray(value)
    ? value
        .filter((item) => item && typeof item === "object")
        .map((item: any, index: number) => ({
          id: String(item.id ?? `${Date.now()}-${index}`),
          name: String(item.name ?? "קובץ"),
          type: String(item.type ?? ""),
          dataUrl: String(item.dataUrl ?? ""),
          uploadedAt: String(item.uploadedAt ?? ""),
          kind:
            item.kind === "lab" || item.kind === "measurement"
              ? item.kind
              : "other",
        }))
        .filter((item) => item.dataUrl)
    : [];

const textIncludesAny = (text: string, keywords: string[]) =>
  keywords.some((keyword) => text.includes(keyword));

const getChecklistAttachmentRequirement = (
  description: unknown,
): ChecklistAttachmentKind | null => {
  const text = String(description ?? "");

  // בדיקות מעבדה — כולל מישוריות לפי התיקון המקצועי.
  if (
    textIncludesAny(text, [
      "בדיקה",
      "בדיקות",
      "מעבדה",
      "הידוק",
      "רטיבות",
      "מישוריות",
      "FWD",
      "אספלט",
      "מצעים",
      "מצע",
      "בטון",
      "צפיפות",
      "CBR",
      "תכולת",
      "דרגת",
    ])
  ) {
    return "lab";
  }

  // רשימות מדידה — רק פעולות מדידה/מודד אמיתיות.
  if (
    textIncludesAny(text, [
      "מדידה",
      "מדידות",
      "מודד",
      "גובה",
      "גבהים",
      "שיפוע",
      "שיפועים",
      "חתך",
      "חתכים",
      "קואורדינטות",
      "צירים",
      "ציר",
      "מיקום",
      "עובי",
    ])
  ) {
    return "measurement";
  }

  return null;
};

const checklistAttachmentLabel = (kind: ChecklistAttachmentKind | null) =>
  kind === "lab"
    ? "תעודת מעבדה"
    : kind === "measurement"
      ? "רשימת מדידה"
      : "מסמך מצורף";

const createApprovalByRoles = (
  roles: Array<{ role: string; required?: boolean }>,
): ApprovalFlow => ({
  status: "draft",
  remarks: "",
  signatures: roles.map((entry) => ({
    role: entry.role,
    signerName: "",
    signature: "",
    signedAt: "",
    required: entry.required !== false,
  })),
});

const createDefaultApproval = (): ApprovalFlow =>
  createApprovalByRoles([
    { role: "מנהל בקרת איכות", required: true },
    { role: "מנהל הבטחת איכות", required: true },
  ]);

const createQualityControlApproval = (): ApprovalFlow =>
  createApprovalByRoles([{ role: "בקר איכות", required: true }]);

const createNonconformanceApproval = (): ApprovalFlow =>
  createApprovalByRoles([
    { role: "בקר איכות - פתיחה / סגירה", required: true },
  ]);

const normalizeApproval = (value: unknown): ApprovalFlow => {
  const base = createDefaultApproval();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<ApprovalFlow>;
  const signatures = Array.isArray(raw.signatures) ? raw.signatures : [];
  return {
    status:
      raw.status === "approved" || raw.status === "rejected"
        ? raw.status
        : "draft",
    remarks: typeof raw.remarks === "string" ? raw.remarks : "",
    signatures: (signatures.length ? signatures : base.signatures).map(
      (entry: any) => {
        const fallback =
          base.signatures.find((s) => s.role === entry?.role) ??
          base.signatures[0];
        return {
          role: String(entry?.role ?? fallback?.role ?? "חתימה"),
          required:
            typeof entry?.required === "boolean"
              ? entry.required
              : Boolean(fallback?.required ?? true),
          signerName: entry?.signerName ?? "",
          signature: entry?.signature ?? "",
          signedAt: entry?.signedAt ?? "",
        };
      },
    ),
  };
};

const approvalRequiresSignatures = (approval: ApprovalFlow) =>
  approval.status === "approved";
const validateApproval = (approval: ApprovalFlow) => {
  if (!approvalRequiresSignatures(approval)) return null;
  const missing = approval.signatures.filter(
    (s) =>
      s.required &&
      (!s.signerName.trim() || !s.signature.trim() || !s.signedAt),
  );
  if (missing.length)
    return "לא ניתן לאשר בלי חתימה, שם ותאריך לכל החתימות החובה.";
  return null;
};

const emptyChecklistItem = (id: string): ChecklistItem => ({
  id,
  description: "",
  responsible: "",
  status: "לא נבדק",
  notes: "",
  inspector: "",
  executionDate: "",
});
const normalizeChecklistItems = (
  items: ChecklistItem[] | unknown,
): ChecklistItem[] =>
  Array.isArray(items)
    ? items.map(
        (item: any, index) =>
          ({
            id: item?.id ?? `${Date.now()}-${index}`,
            description: item?.description ?? "",
            responsible: item?.responsible ?? "",
            status: item?.status ?? "לא נבדק",
            notes: item?.notes ?? "",
            inspector: item?.inspector ?? "",
            executionDate: item?.executionDate ?? "",
            excludedFromPrint: Boolean(item?.excludedFromPrint),
            signature: item?.signature ? {
              role: String(item.signature?.role ?? item?.responsible ?? "גורם אחראי"),
              signerName: String(item.signature?.signerName ?? item?.inspector ?? ""),
              signature: String(item.signature?.signature ?? ""),
              signedAt: String(item.signature?.signedAt ?? ""),
            } : undefined,
            attachments: normalizeChecklistAttachments(item?.attachments),
          }) as ChecklistItem & { attachments?: ChecklistAttachment[] },
      )
    : [];

const CHECKLIST_DEFAULT_REVISION = "1";
const CHECKLIST_DEFAULT_REVISION_DATE = "2025-12-01";

const createDefaultChecklist = (
  templateKey: ChecklistTemplateKey = "general",
): Omit<ChecklistRecord, "id" | "projectId" | "savedAt"> => ({
  checklistNo: undefined,
  templateKey,
  title: checklistTemplates[templateKey].title,
  category: checklistTemplates[templateKey].category,
  location: "",
  date: "",
  contractor: "",
  notes: "",
  projectNameDisplay: "",
  roadStructure: "",
  stationSection: "",
  toStationSection: "",
  offset: "",
  revision: CHECKLIST_DEFAULT_REVISION,
  revisionDate: CHECKLIST_DEFAULT_REVISION_DATE,
  items: buildChecklistItemsFromTemplate(templateKey),
  approval: createDefaultApproval(),
} as any);
const createDefaultNonconformance = (): Omit<
  NonconformanceRecord,
  "id" | "projectId" | "savedAt"
> =>
  ({
    title: "",
    projectName: "",
    projectManagement: "",
    contractor: "",
    qualityAssurance: "",
    qualityControl: "",
    openedBy: "QA / QC",
    openedRole: "בקרת איכות",
    raisedBy: "",
    date: "",
    location: "",
    building: "",
    element: "",
    subElement: "",
    fromSection: "",
    toSection: "",
    offset: "",
    grade: "",
    expectedCloseDate: "",
    updatedExpectedCloseDate: "",
    delayDays: "",
    breakage: "",
    qualityImpact: "",
    description: "",
    responsibleParty: "",
    actionRequired: "",
    handler: "",
    correctiveActionDetails: "",
    notes: "",
    closedBy: "",
    closingRole: "",
    closedName: "",
    closingDate: "",
    severity: "בינונית",
    status: "פתוח",
    images: [] as StoredAttachment[],
    approval: createNonconformanceApproval(),
  }) as any;
const createDefaultTrialSection = (): Omit<
  TrialSectionRecord,
  "id" | "projectId" | "savedAt"
> =>
  ({
    title: "",
    projectName: "",
    projectManagement: "",
    managementCompany: "",
    contractor: "",
    mainContractor: "",
    qualityControl: "",
    qualityCompany: "",
    sectionNo: "",
    sectionNumber: "",
    proofOfCapability: "",
    elementName: "",
    element: "",
    subElement: "",
    fromTo: "",
    fromSection: "",
    toSection: "",
    participants: "",
    equipment: "",
    toolsUsed: "",
    executionDate: "",
    executionDescription: "",
    location: "",
    date: "",
    spec: "",
    result: "",
    approvedBy: "",
    status: "טיוטה",
    notes: "",
    images: [] as StoredAttachment[],
    approval: createQualityControlApproval(),
  }) as any;
const TRIAL_SECTION_DETAIL_KEYS = [
  "projectName",
  "projectManagement",
  "managementCompany",
  "contractor",
  "mainContractor",
  "qualityControl",
  "qualityCompany",
  "sectionNo",
  "sectionNumber",
  "proofOfCapability",
  "capabilityProof",
  "proof",
  "abilityProof",
  "classificationProof",
  "classifiedCapabilityProof",
  "elementName",
  "element",
  "subElement",
  "fromTo",
  "fromToSide",
  "sectionRange",
  "sectionRangeSide",
  "chainage",
  "chainageRange",
  "stationRange",
  "fromSection",
  "toSection",
  "fromChainage",
  "toChainage",
  "fromStation",
  "toStation",
  "side",
  "roadSide",
  "participants",
  "materials",
  "materialsForUse",
  "materialsToUse",
  "materialForUse",
  "equipment",
  "tools",
  "toolsInUse",
  "equipmentUsed",
  "usedTools",
  "toolsUsed",
  "toolsList",
  "workLocation",
  "workSegment",
  "workSection",
  "roadSection",
  "roadStructure",
  "area",
  "executionDate",
  "executionDescription",
  "executionStages",
  "workStages",
  "trialSteps",
  "description",
  "correctiveAction",
  "requiredAction",
  "actionRequired",
] as const;
const trialSectionDetails = (record: Record<string, any>) =>
  TRIAL_SECTION_DETAIL_KEYS.reduce((acc, key) => {
    const value = record?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") acc[key] = value;
    return acc;
  }, {} as Record<string, any>);
const mergeTrialSectionDetails = (record: Record<string, any>, details: Record<string, any> = {}) => ({
  ...record,
  ...details,
});


const normalizeLooseText = (value: unknown) =>
  String(value ?? "")
    .replace(/[\s\u200e\u200f]+/g, " ")
    .trim();

const firstFilled = (...values: unknown[]) => {
  for (const value of values) {
    const text = normalizeLooseText(value);
    if (text) return text;
  }
  return "";
};

const pickTrialValue = (source: Record<string, any>, ...keys: string[]) => {
  const details = source?.details && typeof source.details === "object" ? source.details : {};
  for (const key of keys) {
    const direct = normalizeLooseText(source?.[key]);
    if (direct) return direct;
    const detailed = normalizeLooseText((details as any)?.[key]);
    if (detailed) return detailed;
  }
  return "";
};

const normalizeFieldLabel = (value: unknown) =>
  normalizeLooseText(value).replace(/[＊*]/g, "").replace(/[:：]+$/g, "").trim();

const readExactVisibleFormValueByLabels = (labels: string[]) => {
  if (typeof document === "undefined") return "";
  const wanted = labels.map(normalizeFieldLabel).filter(Boolean);
  if (!wanted.length) return "";
  const controlsSelector = 'input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea, select';

  // Prefer a real <label> that owns/contains the control. This prevents values from nearby
  // fields (section number / participants) from being copied into unrelated PDF rows.
  const labelElements = Array.from(document.querySelectorAll<HTMLLabelElement>("label"));
  for (const label of labelElements) {
    const labelText = normalizeFieldLabel(label.textContent || "");
    if (!wanted.some((target) => labelText === target || labelText.startsWith(target + " "))) continue;

    const nested = label.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(controlsSelector);
    if (nested && normalizeLooseText(nested.value)) return normalizeLooseText(nested.value);

    const htmlFor = label.getAttribute("for");
    if (htmlFor) {
      const byFor = document.getElementById(htmlFor) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (byFor && "value" in byFor && normalizeLooseText(byFor.value)) return normalizeLooseText(byFor.value);
    }

    const labelRect = label.getBoundingClientRect();
    const controls = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(controlsSelector))
      .filter((control) => normalizeLooseText(control.value));
    let best: { control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; score: number } | null = null;
    for (const control of controls) {
      const rect = control.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 10) continue;
      const isBelow = rect.top >= labelRect.bottom - 8;
      const vertical = Math.abs(rect.top - labelRect.bottom);
      const centerDistance = Math.abs((rect.left + rect.right) / 2 - (labelRect.left + labelRect.right) / 2);
      const horizontalOverlap = Math.min(rect.right, labelRect.right) - Math.max(rect.left, labelRect.left);
      if (!isBelow || vertical > 90 || (horizontalOverlap < -20 && centerDistance > 340)) continue;
      const score = vertical + centerDistance / 10;
      if (!best || score < best.score) best = { control, score };
    }
    if (best) return normalizeLooseText(best.control.value);
  }

  // Last safe fallback: match by aria/placeholder/name/id only, not by visual proximity.
  const controls = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(controlsSelector));
  for (const control of controls) {
    const controlLabels = [
      control.getAttribute("aria-label"),
      control.getAttribute("placeholder"),
      control.getAttribute("name"),
      control.getAttribute("id"),
    ].map(normalizeFieldLabel).filter(Boolean);
    if (controlLabels.some((text) => wanted.some((target) => text === target || text.includes(target)))) {
      const value = normalizeLooseText(control.value);
      if (value) return value;
    }
  }
  return "";
};

const combineSectionRange = (...parts: unknown[]) =>
  parts.map(normalizeLooseText).filter(Boolean).join(" - ");

const readTrialFormVisibleValues = () => {
  const fromSection = readExactVisibleFormValueByLabels(["מחתך"]);
  const toSection = readExactVisibleFormValueByLabels(["עד חתך", "לחתך"]);
  const side = readExactVisibleFormValueByLabels(["צד"]);
  return {
    fromSection,
    toSection,
    side,
    fromTo: firstFilled(
      readExactVisibleFormValueByLabels(["מחתך עד חתך/צד", "מחתך / עד חתך"]),
      combineSectionRange(fromSection, toSection, side),
    ),
    materials: readExactVisibleFormValueByLabels(["חומרים לשימוש"]),
    tools: readExactVisibleFormValueByLabels(["כלים בהם משתמשים"]),
    proofOfCapability: readExactVisibleFormValueByLabels(["הוכחת היכולת לפעולה מסווג", "הוכחת היכולת לפעולה מסוג", "הוכחת יכולת"]),
  };
};

const readVisibleFormValueByLabels = (labels: string[]) => {
  if (typeof document === "undefined") return "";
  const wanted = labels.map(normalizeLooseText).filter(Boolean);
  if (!wanted.length) return "";
  const controls = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea, select',
    ),
  ).filter((control) => normalizeLooseText(control.value));

  const labelElements = Array.from(document.querySelectorAll<HTMLElement>("label, span, div, p, strong"))
    .map((element) => ({ element, text: normalizeLooseText(element.innerText || element.textContent) }))
    .filter(({ text }) => text && wanted.some((label) => text.includes(label)));

  for (const { element } of labelElements) {
    const labelRect = element.getBoundingClientRect();
    let best: { control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; score: number } | null = null;
    for (const control of controls) {
      const rect = control.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 10) continue;
      const vertical = Math.abs(rect.top - labelRect.bottom);
      const belowOrSame = rect.top >= labelRect.top - 8;
      const horizontalOverlap = Math.min(rect.right, labelRect.right) - Math.max(rect.left, labelRect.left);
      const sameColumn = horizontalOverlap > -40 || Math.abs(rect.left - labelRect.left) < 260 || Math.abs(rect.right - labelRect.right) < 260;
      if (!belowOrSame || !sameColumn || vertical > 180) continue;
      const score = vertical + Math.abs((rect.left + rect.right) / 2 - (labelRect.left + labelRect.right) / 2) / 8;
      if (!best || score < best.score) best = { control, score };
    }
    if (best) return normalizeLooseText(best.control.value);
  }

  for (const control of controls) {
    const texts = [
      control.getAttribute("aria-label"),
      control.getAttribute("placeholder"),
      control.getAttribute("name"),
      control.getAttribute("id"),
      control.closest("label")?.textContent,
      control.previousElementSibling?.textContent,
      control.parentElement?.querySelector("label")?.textContent,
      control.parentElement?.previousElementSibling?.textContent,
      control.parentElement?.parentElement?.previousElementSibling?.textContent,
      control.parentElement?.parentElement?.querySelector("label")?.textContent,
    ].map(normalizeLooseText).filter(Boolean);
    if (texts.some((text) => wanted.some((label) => text.includes(label)))) return normalizeLooseText(control.value);
  }
  return "";
};

const enrichTrialSectionRecord = (record: Record<string, any>) => {
  const visible = readTrialFormVisibleValues();
  const fromSection = firstFilled(visible.fromSection, pickTrialValue(record, "fromSection", "fromChainage", "fromStation", "מחתך"));
  const toSection = firstFilled(visible.toSection, pickTrialValue(record, "toSection", "toChainage", "toStation", "עד חתך", "לחתך"));
  const side = firstFilled(visible.side, pickTrialValue(record, "side", "roadSide", "צד"));
  const fromTo = firstFilled(
    visible.fromTo,
    pickTrialValue(record, "fromTo", "fromToSide", "sectionRange", "sectionRangeSide", "chainage", "chainageRange", "stationRange", "מחתך עד חתך/צד", "מחתך / עד חתך"),
    combineSectionRange(fromSection, toSection, side),
  );
  const materials = firstFilled(
    visible.materials,
    pickTrialValue(record, "materials", "materialsForUse", "materialsToUse", "materialForUse", "חומרים לשימוש"),
  );
  const tools = firstFilled(
    visible.tools,
    pickTrialValue(record, "tools", "toolsInUse", "toolsUsed", "equipment", "equipmentUsed", "usedTools", "machinery", "toolsList", "כלים בהם משתמשים"),
  );
  const proof = firstFilled(
    visible.proofOfCapability,
    pickTrialValue(record, "proofOfCapability", "capabilityProof", "proof", "abilityProof", "classificationProof", "classifiedCapabilityProof", "הוכחת היכולת לפעולה מסווג", "הוכחת היכולת לפעולה מסוג", "הוכחת יכולת"),
  );
  return {
    ...record,
    fromSection,
    toSection,
    side,
    fromTo,
    fromToSide: fromTo,
    sectionRange: fromTo,
    materials,
    materialsForUse: materials,
    materialsToUse: materials,
    tools,
    toolsUsed: tools,
    equipment: tools,
    proofOfCapability: proof,
    capabilityProof: proof,
  };
};

const createDefaultPreliminary = (
  subtype: PreliminaryTab,
): Omit<PreliminaryRecord, "id" | "projectId" | "savedAt"> => ({
  subtype,
  title:
    subtype === "suppliers"
      ? "בקרה מקדימה - ספקים"
      : subtype === "subcontractors"
        ? "בקרה מקדימה - קבלנים"
        : "בקרה מקדימה - חומרים",
  date: "",
  status: "טיוטה",
  supplier:
    subtype === "suppliers"
      ? {
          supplierName: "",
          suppliedMaterial: "",
          contactPhone: "",
          approvalNo: "",
          notes: "",
        }
      : undefined,
  subcontractor:
    subtype === "subcontractors"
      ? {
          subcontractorName: "",
          field: "",
          contactPhone: "",
          approvalNo: "",
          notes: "",
        }
      : undefined,
  material:
    subtype === "materials"
      ? {
          materialName: "",
          source: "",
          usage: "",
          certificateNo: "",
          notes: "",
        }
      : undefined,
  approval: createQualityControlApproval(),
});

const isSupabaseHeaderEncodingError = (error: unknown) =>
  String(error ?? "").includes(SUPABASE_HEADER_ERROR_FRAGMENT);
const errorText = (error: unknown) =>
  typeof error === "object" && error !== null
    ? `${String((error as any).message ?? "")} ${String((error as any).details ?? "")}`.trim()
    : String(error ?? "");
const isMissingColumnError = (error: unknown, columnName: string) =>
  errorText(error).toLowerCase().includes(columnName.toLowerCase()) &&
  errorText(error).toLowerCase().includes("does not exist");
const shouldIgnoreCloudError = (error: unknown) =>
  /relation .* does not exist/i.test(errorText(error));
const readLocalCurrentProjectId = () => {
  if (typeof window === "undefined") return null;
  const normalized = normalizeStoredProjectId(
    window.localStorage.getItem(CURRENT_PROJECT_STORAGE_KEY),
  );
  if (normalized)
    window.localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, normalized);
  return normalized || null;
};
const writeLocalCurrentProjectId = (projectId: string | null) => {
  if (typeof window === "undefined") return;
  const normalized = normalizeStoredProjectId(projectId);
  normalized
    ? window.localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, normalized)
    : window.localStorage.removeItem(CURRENT_PROJECT_STORAGE_KEY);
};

async function selectTable(table: string, orderColumn?: string) {
  const empty = { data: [], error: null } as any;
  const isMissingRelation = (error: unknown) =>
    /relation .* does not exist|could not find the table/i.test(
      errorText(error),
    );
  const baseQuery = supabase!.from(table).select("*");
  if (!orderColumn) {
    const result = await baseQuery;
    if (
      result.error &&
      isMissingRelation(result.error) &&
      table === CONTROL_PROCESS_TABLE
    )
      return empty;
    return result;
  }
  const ordered = await supabase!
    .from(table)
    .select("*")
    .order(orderColumn, { ascending: false });
  if (!ordered.error) return ordered;
  if (isMissingRelation(ordered.error) && table === CONTROL_PROCESS_TABLE)
    return empty;
  if (isMissingColumnError(ordered.error, orderColumn)) {
    const result = await baseQuery;
    if (
      result.error &&
      isMissingRelation(result.error) &&
      table === CONTROL_PROCESS_TABLE
    )
      return empty;
    return result;
  }
  return ordered;
}

async function saveWithApprovalFallback(
  table: string,
  payload: Record<string, any>,
  mode: "insert" | "update",
  id?: string,
) {
  payload = sanitizeCloudPayload(payload);
  let result =
    mode === "insert"
      ? await supabase!.from(table).insert(payload)
      : await supabase!.from(table).update(payload).eq("id", id);
  if (result.error && isMissingColumnError(result.error, "approval")) {
    const { approval, ...withoutApproval } = payload;
    result =
      mode === "insert"
        ? await supabase!.from(table).insert(withoutApproval)
        : await supabase!.from(table).update(withoutApproval).eq("id", id);
  }
  if (result.error && isMissingColumnError(result.error, "images")) {
    const { images, ...withoutImages } = payload;
    result =
      mode === "insert"
        ? await supabase!.from(table).insert(withoutImages)
        : await supabase!.from(table).update(withoutImages).eq("id", id);
  }
  if (result.error && isMissingColumnError(result.error, "details")) {
    const { details, ...withoutDetails } = payload;
    result =
      mode === "insert"
        ? await supabase!.from(table).insert(withoutDetails)
        : await supabase!.from(table).update(withoutDetails).eq("id", id);
  }
  if (result.error)
    throw new Error(errorText(result.error) || "שגיאה בשמירה מול Supabase");
}

type ChecklistAttachmentsPanelProps = {
  items: ChecklistItem[];
  onUpload: (itemId: string, kind: ChecklistAttachmentKind, file: File) => void;
  onRemove: (itemId: string, attachmentId: string) => void;
};

function ChecklistAttachmentsPanel({
  items,
  onUpload,
  onRemove,
}: ChecklistAttachmentsPanelProps) {
  const relevantItems = items
    .map((item) => ({
      item,
      kind: getChecklistAttachmentRequirement(item.description),
    }))
    .filter(
      (
        entry,
      ): entry is {
        item: ChecklistItem & { attachments?: ChecklistAttachment[] };
        kind: ChecklistAttachmentKind;
      } => Boolean(entry.kind),
    );

  if (!relevantItems.length) return null;

  return (
    <div
      style={{
        border: "1px solid #cbd5e1",
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
        background: "#f8fafc",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>
        צירוף בדיקות ומדידות לרשימת התיוג
      </div>
      <div style={{ color: "#475569", marginBottom: 12, lineHeight: 1.6 }}>
        כאן מצרפים מסמכים בזמן מילוי הרשימה. תעודות מעבדה ורשימות מדידה נשמרות
        עם שורת הבקרה ואינן מוסיפות שורות לטופס הייצוא.
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "#fff",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  border: "1px solid #cbd5e1",
                  padding: 8,
                  textAlign: "right",
                }}
              >
                תהליך בקרה
              </th>
              <th
                style={{ border: "1px solid #cbd5e1", padding: 8, width: 150 }}
              >
                סוג מסמך נדרש
              </th>
              <th
                style={{ border: "1px solid #cbd5e1", padding: 8, width: 210 }}
              >
                צירוף מסמך
              </th>
              <th
                style={{ border: "1px solid #cbd5e1", padding: 8, width: 260 }}
              >
                מסמכים שצורפו
              </th>
            </tr>
          </thead>
          <tbody>
            {relevantItems.map(({ item, kind }) => {
              const attachments = normalizeChecklistAttachments(
                (item as any).attachments,
              ).filter((attachment) => attachment.kind === kind);
              return (
                <tr key={item.id}>
                  <td
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: 8,
                      textAlign: "right",
                      verticalAlign: "top",
                    }}
                  >
                    {item.description}
                  </td>
                  <td
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: 8,
                      textAlign: "center",
                      fontWeight: 800,
                      verticalAlign: "top",
                    }}
                  >
                    {checklistAttachmentLabel(kind)}
                  </td>
                  <td
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: 8,
                      textAlign: "center",
                      verticalAlign: "top",
                    }}
                  >
                    <label
                      style={{
                        display: "inline-block",
                        cursor: "pointer",
                        border: "1px solid #0f172a",
                        borderRadius: 10,
                        padding: "7px 10px",
                        fontWeight: 800,
                        background: "#fff",
                      }}
                    >
                      📎 צרף {checklistAttachmentLabel(kind)}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                        style={{ display: "none" }}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) onUpload(item.id, kind, file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </td>
                  <td
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: 8,
                      verticalAlign: "top",
                    }}
                  >
                    {attachments.length ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        {attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 8,
                              alignItems: "center",
                              border: "1px solid #e2e8f0",
                              borderRadius: 8,
                              padding: "4px 6px",
                            }}
                          >
                            <span
                              title={attachment.name}
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              ✅ {attachment.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => onRemove(item.id, attachment.id)}
                              style={{
                                border: 0,
                                background: "transparent",
                                cursor: "pointer",
                                color: "#b91c1c",
                                fontWeight: 900,
                              }}
                            >
                              מחיקה
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: "#64748b" }}>טרם צורף מסמך</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const RESPONSIBLE_ROLE_OPTIONS = [
  "",
  "בקרת איכות",
  "מנהל עבודה",
  "מודד",
  "הבטחת איכות",
  "ניהול פרויקט",
];

type ChecklistResponsiblePanelProps = {
  items: ChecklistItem[];
  projectName: string;
  onChangeResponsible: (itemId: string, responsible: string) => void;
};

function ChecklistResponsiblePanel({
  items,
  projectName,
  onChangeResponsible,
}: ChecklistResponsiblePanelProps) {
  if (!items.length) return null;

  return (
    <div
      style={{
        border: "1px solid #cbd5e1",
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
        background: "#fff",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>
        בחירת גורם אחראי לתהליכי הבקרה
      </div>
      <div style={{ color: "#475569", marginBottom: 12, lineHeight: 1.6 }}>
        בחר גורם אחראי לכל תהליך. לאחר הבחירה, שם האדם המתאים מתעדכן אוטומטית
        לפי אנשי הקשר של הפרויקט.
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "#fff",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  border: "1px solid #cbd5e1",
                  padding: 8,
                  textAlign: "right",
                }}
              >
                תהליך בקרה
              </th>
              <th
                style={{ border: "1px solid #cbd5e1", padding: 8, width: 190 }}
              >
                גורם אחראי
              </th>
              <th
                style={{ border: "1px solid #cbd5e1", padding: 8, width: 190 }}
              >
                שם אוטומטי
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const autoName = resolveResponsibleName(
                item.responsible,
                projectName,
              );
              return (
                <tr key={item.id}>
                  <td
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: 8,
                      textAlign: "right",
                      verticalAlign: "middle",
                    }}
                  >
                    {item.description || "תהליך ללא שם"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: 8,
                      textAlign: "center",
                      verticalAlign: "middle",
                    }}
                  >
                    <select
                      value={item.responsible || ""}
                      onChange={(event) =>
                        onChangeResponsible(item.id, event.target.value)
                      }
                      style={{
                        width: "100%",
                        border: "1px solid #cbd5e1",
                        borderRadius: 10,
                        padding: "8px 10px",
                        fontWeight: 800,
                        background: "#fff",
                        textAlign: "center",
                      }}
                    >
                      {RESPONSIBLE_ROLE_OPTIONS.map((role) => (
                        <option key={role || "empty"} value={role}>
                          {role || "בחר גורם"}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: 8,
                      textAlign: "center",
                      verticalAlign: "middle",
                      fontWeight: 800,
                    }}
                  >
                    {autoName || item.inspector || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type InlineChecklistSectionProps = {
  guardedBody: React.ReactNode;
  editingChecklistId: string | null;
  checklistForm: any;
  setChecklistForm: React.Dispatch<React.SetStateAction<any>>;
  checklistTemplateLabel: (
    key: ChecklistTemplateKey | string | undefined,
  ) => string;
  applyChecklistTemplate: (templateKey: ChecklistTemplateKey) => void;
  updateChecklistItem: (
    id: string,
    field: keyof ChecklistItem,
    value: string,
  ) => void;
  toggleChecklistItemPrintExclusion: (id: string) => void;
  addChecklistItem: () => void;
  removeChecklistItem: (id: string) => void;
  saveChecklist: () => void;
  resetChecklistForm: (templateKey?: ChecklistTemplateKey) => void;
  projectName: string;
  onUploadAttachment: (
    itemId: string,
    kind: ChecklistAttachmentKind,
    file: File,
  ) => void;
  onRemoveAttachment: (itemId: string, attachmentId: string) => void;
  savedSignatureForSigner?: (signerName: string, role?: string) => string;
};

type ProcessSignature = {
  role: string;
  signerName: string;
  signature: string;
  signedAt: string;
};

const normalizeProcessSignature = (
  value: any,
  role: string,
  defaultSignerName = "",
): ProcessSignature => ({
  role: String(value?.role ?? role ?? "גורם אחראי"),
  signerName: String(value?.signerName ?? defaultSignerName ?? ""),
  signature: String(value?.signature ?? ""),
  signedAt: String(value?.signedAt ?? ""),
});


function DigitalSignaturePad({
  onSave,
  onCancel,
}: {
  onSave: (signatureDataUrl: string) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const prepareCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!canvas.dataset.ready) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      canvas.dataset.ready = "1";
    }
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    prepareCanvas();
    drawingRef.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const point = getPoint(event);
    ctx?.beginPath();
    ctx?.moveTo(point.x, point.y);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const point = getPoint(event);
    ctx?.lineTo(point.x, point.y);
    ctx?.stroke();
  };

  const end = () => {
    drawingRef.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL("image/png"));
  };

  return (
    <div style={{ border: "1px solid #94a3b8", borderRadius: 12, padding: 10, background: "#fff", display: "grid", gap: 8 }}>
      <div style={{ fontWeight: 900 }}>חתימה דיגיטלית - חתום בעזרת העכבר</div>
      <canvas
        ref={canvasRef}
        width={420}
        height={150}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        style={{ width: "100%", maxWidth: 520, height: 150, border: "1px solid #cbd5e1", borderRadius: 10, touchAction: "none", background: "#fff", cursor: "crosshair" }}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={styles.secondaryBtn} onClick={save}>שמור חתימה</button>
        <button type="button" style={styles.secondaryBtn} onClick={clear}>נקה</button>
        <button type="button" style={styles.secondaryBtn} onClick={onCancel}>ביטול</button>
      </div>
    </div>
  );
}

function ProcessSignatureFields({
  value,
  onChange,
  role,
  defaultSignerName,
  savedSignatureDataUrl,
}: {
  value: ProcessSignature;
  onChange: (next: ProcessSignature) => void;
  role: string;
  defaultSignerName: string;
  savedSignatureDataUrl?: string;
}) {
  const set = (patch: Partial<ProcessSignature>) =>
    onChange({ ...value, role, ...patch });
  const inputStyle: React.CSSProperties = {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "8px 10px",
    fontWeight: 800,
    minHeight: 40,
    background: "#fff",
  };
  const [showDigitalPad, setShowDigitalPad] = useState(false);
  const isImageSignature =
    String(value.signature || "").startsWith("data:image/") ||
    String(value.signature || "").startsWith("/signatures/");
  const uploadSignatureToThisForm = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      set({
        signerName: value.signerName || defaultSignerName,
        signature: String(reader.result ?? ""),
        signedAt: value.signedAt || new Date().toISOString().slice(0, 10),
      });
    reader.onerror = () => alert("לא ניתן לקרוא את קובץ החתימה");
    reader.readAsDataURL(file);
  };

  return (
    <div
      style={{
        border: "1px solid #bfdbfe",
        background: "#eff6ff",
        borderRadius: 14,
        padding: 12,
        marginTop: 12,
      }}
    >
      <div style={{ fontWeight: 950, color: "#1e3a8a", marginBottom: 8 }}>
        חתימת גורם אחראי לתהליך הבקרה
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
        }}
      >
        <label style={{ display: "grid", gap: 5, fontWeight: 900 }}>
          תפקיד
          <input
            readOnly
            value={role || "גורם אחראי"}
            style={{ ...inputStyle, background: "#f8fafc" }}
          />
        </label>
        <label style={{ display: "grid", gap: 5, fontWeight: 900 }}>
          שם חותם
          <input
            value={value.signerName || defaultSignerName}
            onChange={(event) => set({ signerName: event.target.value })}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 5, fontWeight: 900 }}>
          תאריך חתימה
          <input
            type="date"
            value={value.signedAt}
            onChange={(event) => set({ signedAt: event.target.value })}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 5, fontWeight: 900 }}>
          חתימה / חותמת
          <input
            value={
              isImageSignature ? "חתימה/חותמת מצורפת כתמונה" : value.signature
            }
            onChange={(event) => set({ signature: event.target.value })}
            placeholder="הקלד חתימה / שם מלא"
            style={inputStyle}
          />
          {isImageSignature ? (
            <img
              src={value.signature}
              alt="חתימה"
              style={{
                maxWidth: 150,
                maxHeight: 62,
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                background: "#fff",
                padding: 4,
              }}
            />
          ) : null}
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          style={styles.secondaryBtn}
          onClick={() =>
            set({
              signerName: value.signerName || defaultSignerName,
              signature: "מאושר",
              signedAt: new Date().toISOString().slice(0, 10),
            })
          }
        >
          חתום עכשיו
        </button>
        {savedSignatureDataUrl ? (
          <button
            type="button"
            style={styles.secondaryBtn}
            onClick={() =>
              set({
                signerName: value.signerName || defaultSignerName,
                signature: savedSignatureDataUrl,
                signedAt: new Date().toISOString().slice(0, 10),
              })
            }
          >
            השתמש בחתימה/חותמת שמורה
          </button>
        ) : null}
        <button
          type="button"
          style={styles.secondaryBtn}
          onClick={() => setShowDigitalPad((prev) => !prev)}
        >
          חתימה דיגיטלית
        </button>
        <button
          type="button"
          style={styles.secondaryBtn}
          onClick={() => set({ signature: "", signedAt: "" })}
        >
          נקה חתימה
        </button>
      </div>
      {showDigitalPad ? (
        <div style={{ marginTop: 10 }}>
          <DigitalSignaturePad
            onSave={(signatureDataUrl) => {
              set({
                signerName: value.signerName || defaultSignerName,
                signature: signatureDataUrl,
                signedAt: value.signedAt || new Date().toISOString().slice(0, 10),
              });
              setShowDigitalPad(false);
            }}
            onCancel={() => setShowDigitalPad(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

function ChecklistsSection({
  guardedBody,
  editingChecklistId,
  checklistForm,
  setChecklistForm,
  checklistTemplateLabel,
  applyChecklistTemplate,
  updateChecklistItem,
  toggleChecklistItemPrintExclusion,
  addChecklistItem,
  removeChecklistItem,
  saveChecklist,
  resetChecklistForm,
  projectName,
  onUploadAttachment,
  onRemoveAttachment,
  savedSignatureForSigner,
}: InlineChecklistSectionProps) {
  if (guardedBody) return <>{guardedBody}</>;
  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "10px 12px",
    background: "#fff",
    fontWeight: 700,
    minHeight: 44,
  };
  const labelStyle: React.CSSProperties = {
    fontWeight: 900,
    marginBottom: 6,
    display: "block",
    color: "#0f172a",
  };
  const cardStyle: React.CSSProperties = {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 16,
    background: "#f8fafc",
    marginBottom: 14,
  };
  const setField = (field: string, value: string) =>
    setChecklistForm((prev: any) => ({ ...prev, [field]: value }));
  const topTableInputStyle: React.CSSProperties = {
    width: "100%",
    minWidth: 0,
    border: 0,
    outline: "none",
    background: "transparent",
    fontWeight: 900,
    textAlign: "center",
    minHeight: 34,
    padding: "6px 8px",
    boxSizing: "border-box",
    whiteSpace: "normal",
  };
  const topTableCellStyle: React.CSSProperties = {
    border: "1px solid #0f172a",
    padding: 3,
    minWidth: 120,
    verticalAlign: "middle",
  };
  const topTableWideCellStyle: React.CSSProperties = {
    ...topTableCellStyle,
    minWidth: 240,
  };
  const topTableHeaderStyle: React.CSSProperties = {
    border: "1px solid #0f172a",
    padding: 7,
    background: "#f8fafc",
    fontWeight: 950,
    textAlign: "center",
    whiteSpace: "nowrap",
    minWidth: 105,
  };
  const renderTopInput = (
    field: string,
    value: unknown,
    placeholder = "",
    options?: { readOnly?: boolean; type?: string },
  ) => (
    <input
      type={options?.type ?? "text"}
      value={String(value ?? "")}
      readOnly={options?.readOnly}
      placeholder={placeholder}
      onChange={(event) => setField(field, event.target.value)}
      style={{
        ...topTableInputStyle,
        background: options?.readOnly ? "#f8fafc" : "transparent",
        cursor: options?.readOnly ? "default" : "text",
      }}
    />
  );
  const templateEntries = Object.entries(checklistTemplates) as Array<
    [ChecklistTemplateKey, any]
  >;
  const [digitalSignatureItemId, setDigitalSignatureItemId] = useState<string | null>(null);
  const isRoad806Checklist = isRoad806Value(projectName) || isRoad806Value(checklistForm.projectNameDisplay) || isRoad806Value(checklistForm.projectName) || isRoad806Value(checklistForm.location);
  const updateItemSignature = (itemId: string, signature: ProcessSignature) => {
    setChecklistForm((prev: any) => ({
      ...prev,
      items: prev.items.map((item: any) =>
        item.id === itemId ? { ...item, signature } : item,
      ),
    }));
  };

  const uploadChecklistItemSignature = (
    itemId: string,
    signatureValue: ProcessSignature,
    autoName: string,
    file?: File,
  ) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateItemSignature(itemId, {
        ...signatureValue,
        signerName: signatureValue.signerName || autoName,
        signature: String(reader.result ?? ""),
        signedAt:
          signatureValue.signedAt || new Date().toISOString().slice(0, 10),
      });
    };
    reader.onerror = () => alert("לא ניתן לקרוא את קובץ החתימה");
    reader.readAsDataURL(file);
  };

  const descriptionStartsWithTestKeyword = (description: unknown) => {
    const text = String(description ?? "").trim();
    return /^(בדיק|בדיקה|בדיקות|מעבדה|תעודת מעבדה|הידוק|צפיפות|רטיבות|מישוריות|FWD|CBR|אספלט|בטון|מצע|מצעים)/.test(
      text,
    );
  };

  const getChecklistAttachmentKindsForItem = (
    item: ChecklistItem,
  ): ChecklistAttachmentKind[] => {
    const kinds = new Set<ChecklistAttachmentKind>();
    const requiredKind = getChecklistAttachmentRequirement(item.description);
    if (requiredKind) kinds.add(requiredKind);
    if (String(item.responsible ?? "").includes("מודד"))
      kinds.add("measurement");
    if (descriptionStartsWithTestKeyword(item.description)) kinds.add("lab");
    return Array.from(kinds);
  };

  const checklistAttachmentActionLabel = (
    kind: ChecklistAttachmentKind,
    item: ChecklistItem,
  ) => {
    if (
      kind === "measurement" &&
      String(item.responsible ?? "").includes("מודד")
    ) {
      return "צרף מסמך מול מודד";
    }
    if (kind === "lab" && descriptionStartsWithTestKeyword(item.description)) {
      return "צרף מסמך בדיקה / מעבדה";
    }
    return `צרף ${checklistAttachmentLabel(kind)}`;
  };

  return (
    <section>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>
            רשימות תיוג
          </h2>
          <div style={{ color: "#64748b", marginTop: 4 }}>
            {editingChecklistId
              ? "עריכת רשימת תיוג קיימת"
              : "מילוי רשימת תיוג חדשה"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            style={styles.secondaryBtn}
            onClick={() => resetChecklistForm()}
          >
            נקה טופס
          </button>
          <button
            type="button"
            style={styles.primaryBtn}
            onClick={saveChecklist}
            title="שמירת רשימת תיוג חדשה או שמירת הרשימה הנוכחית"
          >
            שמור רשימה
          </button>
          <button
            type="button"
            style={
              editingChecklistId
                ? styles.primaryBtn
                : {
                    ...styles.secondaryBtn,
                    opacity: 0.65,
                    cursor: "not-allowed",
                  }
            }
            onClick={saveChecklist}
            disabled={!editingChecklistId}
            title={
              editingChecklistId
                ? "עדכון רשימת התיוג שנפתחה לעריכה"
                : "כדי לעדכן יש לפתוח רשימה קיימת לעריכה"
            }
          >
            עדכן רשימה
          </button>
        </div>
      </div>
      <div style={cardStyle}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <label>
            <span style={labelStyle}>סוג רשימת תיוג</span>
            <select
              value={checklistForm.templateKey}
              onChange={(event) =>
                applyChecklistTemplate(
                  event.target.value as ChecklistTemplateKey,
                )
              }
              style={inputStyle}
            >
              {templateEntries.map(([key]) => (
                <option key={key} value={key}>
                  {checklistTemplateLabel(key)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span style={labelStyle}>שם רשימת תיוג</span>
            <input
              value={checklistForm.title ?? ""}
              onChange={(event) => setField("title", event.target.value)}
              style={inputStyle}
            />
          </label>
          <label>
            <span style={labelStyle}>קטגוריה</span>
            <input
              value={checklistForm.category ?? ""}
              onChange={(event) => setField("category", event.target.value)}
              style={inputStyle}
            />
          </label>
          <label>
            <span style={labelStyle}>תאריך</span>
            <input
              type="date"
              value={checklistForm.date ?? ""}
              onChange={(event) => setField("date", event.target.value)}
              style={inputStyle}
            />
          </label>
          <label>
            <span style={labelStyle}>מס׳ שכבה</span>
            <input
              value={checklistForm.location ?? ""}
              onChange={(event) => setField("location", event.target.value)}
              style={inputStyle}
            />
          </label>
          <label>
            <span style={labelStyle}>קבלן</span>
            <input
              value={checklistForm.contractor ?? ""}
              onChange={(event) => setField("contractor", event.target.value)}
              style={inputStyle}
            />
          </label>
        </div>

        <div
          style={{
            marginTop: 18,
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: 14,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 950, fontSize: 18, marginBottom: 12 }}>
            פרטי רשימת התיוג
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 12,
            }}
          >
            <label>
              <span style={labelStyle}>שם הפרויקט</span>
              <input
                value={(checklistForm as any).projectNameDisplay || projectName || ""}
                onChange={(event) => setField("projectNameDisplay", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              <span style={labelStyle}>קבלן מבצע</span>
              <input
                value={checklistForm.contractor ?? ""}
                onChange={(event) => setField("contractor", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              <span style={labelStyle}>מס׳ שכבה</span>
              <input
                value={checklistForm.location ?? ""}
                onChange={(event) => setField("location", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              <span style={labelStyle}>כביש / מבנה</span>
              <input
                value={(checklistForm as any).roadStructure ?? ""}
                onChange={(event) => setField("roadStructure", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              <span style={labelStyle}>מספר רשימת תיוג</span>
              <input
                value={checklistForm.checklistNo ?? ""}
                onChange={(event) => setField("checklistNo", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              <span style={labelStyle}>מהדורה</span>
              <input
                value={(checklistForm as any).revision ?? CHECKLIST_DEFAULT_REVISION}
                onChange={(event) => setField("revision", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              <span style={labelStyle}>תאריך מהדורה</span>
              <input
                type="date"
                value={(checklistForm as any).revisionDate ?? CHECKLIST_DEFAULT_REVISION_DATE}
                onChange={(event) => setField("revisionDate", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              <span style={labelStyle}>מחתך</span>
              <input
                value={(checklistForm as any).stationSection ?? ""}
                onChange={(event) => setField("stationSection", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              <span style={labelStyle}>לחתך</span>
              <input
                value={(checklistForm as any).toStationSection ?? ""}
                onChange={(event) => setField("toStationSection", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              <span style={labelStyle}>היטס</span>
              <input
                value={(checklistForm as any).offset ?? ""}
                onChange={(event) => setField("offset", event.target.value)}
                style={inputStyle}
              />
            </label>
          </div>
          <label style={{ display: "block", marginTop: 12 }}>
            <span style={labelStyle}>הערות</span>
            <textarea
              value={checklistForm.notes ?? ""}
              onChange={(event) => setField("notes", event.target.value)}
              style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
            />
          </label>
        </div>
      </div>
      <div style={{ ...cardStyle, background: "#fff" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
              סעיפי בקרה
            </h3>
            <div style={{ color: "#64748b", marginTop: 4 }}>
              כל רשימות התיוג מוצגות במבנה טבלאי אחיד: תיאור פעולה, אחריות, שם,
              חתימה, תאריך ותעודת מעבדה / הערות. ניתן לשמור, לעדכן, לצרף
              מסמך מול מודד ולצרף מסמכי בדיקה/מעבדה לפי תיאור התהליך.
            </div>
          </div>
          <button
            type="button"
            style={styles.secondaryBtn}
            onClick={addChecklistItem}
          >
            הוסף שורה
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            dir="rtl"
            style={{
              width: "100%",
              minWidth: 980,
              borderCollapse: "collapse",
              background: "#fff",
              tableLayout: "fixed",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    border: "1px solid #94a3b8",
                    padding: 8,
                    width: "31%",
                    background: "#f8fafc",
                    fontWeight: 950,
                  }}
                >
                  תיאור פעולת הבקרה
                </th>
                <th
                  style={{
                    border: "1px solid #94a3b8",
                    padding: 8,
                    width: "12%",
                    background: "#f8fafc",
                    fontWeight: 950,
                  }}
                >
                  באחריות
                </th>
                <th
                  style={{
                    border: "1px solid #94a3b8",
                    padding: 8,
                    width: "11%",
                    background: "#f8fafc",
                    fontWeight: 950,
                  }}
                >
                  שם
                </th>
                <th
                  style={{
                    border: "1px solid #94a3b8",
                    padding: 8,
                    width: "12%",
                    background: "#f8fafc",
                    fontWeight: 950,
                  }}
                >
                  חתימה
                </th>
                <th
                  style={{
                    border: "1px solid #94a3b8",
                    padding: 8,
                    width: "9%",
                    background: "#f8fafc",
                    fontWeight: 950,
                  }}
                >
                  תאריך
                </th>
                <th
                  style={{
                    border: "1px solid #94a3b8",
                    padding: 8,
                    width: "16%",
                    background: "#f8fafc",
                    fontWeight: 950,
                  }}
                >
                  תעודת מעבדה / הערות
                </th>
                <th
                  style={{
                    border: "1px solid #94a3b8",
                    padding: 8,
                    width: 64,
                    background: "#f8fafc",
                    fontWeight: 950,
                  }}
                >
                  פעולות
                </th>
                <th
                  style={{
                    border: "1px solid #94a3b8",
                    padding: 4,
                    width: 38,
                    background: "#f8fafc",
                    fontWeight: 950,
                    fontSize: 12,
                  }}
                >
                  ל.ר
                </th>
              </tr>
            </thead>
            <tbody>
              {checklistForm.items.map(
                (
                  item: ChecklistItem & { attachments?: ChecklistAttachment[] },
                  index: number,
                ) => {
                  const attachmentKinds =
                    getChecklistAttachmentKindsForItem(item);
                  const attachments = normalizeChecklistAttachments(
                    item.attachments,
                  ).filter(
                    (attachment) =>
                      !attachmentKinds.length ||
                      attachmentKinds.includes(attachment.kind),
                  );
                  const autoName =
                    resolveResponsibleName(item.responsible, projectName) ||
                    item.inspector ||
                    "";
                  const signatureValue = normalizeProcessSignature(
                    (item as any).signature,
                    item.responsible || "גורם אחראי",
                    autoName,
                  );
                  const isImageSignature =
                    String(signatureValue.signature || "").startsWith("data:image/") ||
                    String(signatureValue.signature || "").startsWith("/signatures/");
                  const isExcludedFromPrint = Boolean(
                    (item as any).excludedFromPrint,
                  );
                  const cellStyle: React.CSSProperties = {
                    border: "1px solid #94a3b8",
                    padding: 6,
                    verticalAlign: "top",
                    background: isExcludedFromPrint
                      ? "#f1f5f9"
                      : index % 2
                        ? "#f8fafc"
                        : "#fff",
                    opacity: isExcludedFromPrint ? 0.72 : 1,
                  };
                  const compactInputStyle: React.CSSProperties = {
                    width: "100%",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "7px 8px",
                    background: "#fff",
                    fontWeight: 700,
                    minHeight: 36,
                    boxSizing: "border-box",
                  };
                  return (
                    <tr key={item.id}>
                      <td style={cellStyle}>
                        <textarea
                          value={item.description ?? ""}
                          onChange={(event) =>
                            updateChecklistItem(
                              item.id,
                              "description",
                              event.target.value,
                            )
                          }
                          placeholder="תיאור פעולת הבקרה"
                          style={{
                            ...compactInputStyle,
                            minHeight: 70,
                            resize: "vertical",
                          }}
                        />
                      </td>
                      <td style={cellStyle}>
                        <select
                          value={item.responsible || ""}
                          onChange={(event) =>
                            updateChecklistItem(
                              item.id,
                              "responsible",
                              event.target.value,
                            )
                          }
                          style={compactInputStyle}
                        >
                          {RESPONSIBLE_ROLE_OPTIONS.map((role) => (
                            <option key={role || "empty"} value={role}>
                              {role || "בחר"}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={cellStyle}>
                        <input
                          value={autoName}
                          readOnly
                          title={autoName}
                          style={{
                            ...compactInputStyle,
                            background: "#f1f5f9",
                          }}
                        />
                      </td>
                      <td style={cellStyle}>
                        {isImageSignature ? (
                          <div style={{ display: "grid", gap: 6 }}>
                            <img
                              src={signatureValue.signature}
                              alt="חתימה"
                              style={{
                                maxWidth: "100%",
                                maxHeight: 54,
                                border: "1px solid #cbd5e1",
                                borderRadius: 8,
                                background: "#fff",
                                padding: 3,
                              }}
                            />
                            <button
                              type="button"
                              style={{
                                ...styles.secondaryBtn,
                                padding: "6px 8px",
                              }}
                              onClick={() =>
                                updateItemSignature(item.id, {
                                  ...signatureValue,
                                  signature: "",
                                  signedAt:
                                    signatureValue.signedAt ||
                                    item.executionDate ||
                                    "",
                                })
                              }
                            >
                              נקה
                            </button>
                          </div>
                        ) : (
                          <input
                            value={signatureValue.signature}
                            onChange={(event) =>
                              updateItemSignature(item.id, {
                                ...signatureValue,
                                role: item.responsible || "גורם אחראי",
                                signerName:
                                  signatureValue.signerName || (isRoad806Checklist && isSurveyorRole(item.responsible) ? ROAD_806_SURVEYOR_NAME : autoName),
                                signature: event.target.value,
                                signedAt:
                                  signatureValue.signedAt ||
                                  item.executionDate ||
                                  "",
                              })
                            }
                            placeholder="חתימה"
                            style={compactInputStyle}
                          />
                        )}
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                            marginTop: 6,
                          }}
                        >
                          <button
                            type="button"
                            style={{
                              ...styles.secondaryBtn,
                              padding: "6px 8px",
                            }}
                            onClick={() =>
                              updateItemSignature(item.id, {
                                ...signatureValue,
                                role: item.responsible || "גורם אחראי",
                                signerName:
                                  signatureValue.signerName || autoName,
                                signature:
                                  isRoad806Checklist && isSurveyorRole(item.responsible)
                                    ? ROAD_806_SURVEYOR_SIGNATURE_URL
                                    : "מאושר",
                                signedAt:
                                  signatureValue.signedAt ||
                                  item.executionDate ||
                                  new Date().toISOString().slice(0, 10),
                              })
                            }
                          >
                            חתום
                          </button>
                          <button
                            type="button"
                            style={{
                              ...styles.secondaryBtn,
                              padding: "6px 8px",
                            }}
                            onClick={() =>
                              setDigitalSignatureItemId((current) =>
                                current === item.id ? null : item.id,
                              )
                            }
                          >
                            חתימה דיגיטלית
                          </button>
                          {savedSignatureForSigner?.(
                            autoName,
                            item.responsible,
                          ) ? (
                            <button
                              type="button"
                              style={{
                                ...styles.secondaryBtn,
                                padding: "6px 8px",
                              }}
                              onClick={() =>
                                updateItemSignature(item.id, {
                                  ...signatureValue,
                                  role: item.responsible || "גורם אחראי",
                                  signerName:
                                    signatureValue.signerName || autoName,
                                  signature:
                                    savedSignatureForSigner?.(
                                      autoName,
                                      item.responsible,
                                    ) || "",
                                  signedAt:
                                    signatureValue.signedAt ||
                                    item.executionDate ||
                                    new Date().toISOString().slice(0, 10),
                                })
                              }
                            >
                              חתימה שמורה
                            </button>
                          ) : null}
                        </div>
                        {digitalSignatureItemId === item.id ? (
                          <div style={{ marginTop: 8 }}>
                            <DigitalSignaturePad
                              onSave={(signatureDataUrl) => {
                                updateItemSignature(item.id, {
                                  ...signatureValue,
                                  role: item.responsible || "גורם אחראי",
                                  signerName: signatureValue.signerName || autoName,
                                  signature: signatureDataUrl,
                                  signedAt: signatureValue.signedAt || item.executionDate || new Date().toISOString().slice(0, 10),
                                });
                                setDigitalSignatureItemId(null);
                              }}
                              onCancel={() => setDigitalSignatureItemId(null)}
                            />
                          </div>
                        ) : null}
                      </td>
                      <td style={cellStyle}>
                        <input
                          type="date"
                          value={item.executionDate ?? ""}
                          onChange={(event) => {
                            updateChecklistItem(
                              item.id,
                              "executionDate",
                              event.target.value,
                            );
                            updateItemSignature(item.id, {
                              ...signatureValue,
                              signedAt: event.target.value,
                            });
                          }}
                          style={compactInputStyle}
                        />
                      </td>
                      <td style={cellStyle}>
                        <input
                          value={item.notes ?? ""}
                          onChange={(event) =>
                            updateChecklistItem(
                              item.id,
                              "notes",
                              event.target.value,
                            )
                          }
                          placeholder="תעודת מעבדה / הערות"
                          style={compactInputStyle}
                        />
                        {attachmentKinds.length ? (
                          <div
                            style={{ marginTop: 8, display: "grid", gap: 6 }}
                          >
                            {attachmentKinds.map((kind) => (
                              <label
                                key={kind}
                                style={{
                                  display: "inline-block",
                                  cursor: "pointer",
                                  border: "1px solid #0f172a",
                                  borderRadius: 8,
                                  padding: "6px 8px",
                                  fontWeight: 900,
                                  background: "#fff",
                                  textAlign: "center",
                                }}
                              >
                                📎 {checklistAttachmentActionLabel(kind, item)}
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                                  style={{ display: "none" }}
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file)
                                      onUploadAttachment(item.id, kind, file);
                                    event.currentTarget.value = "";
                                  }}
                                />
                              </label>
                            ))}
                            {attachments.length ? (
                              <div style={{ display: "grid", gap: 4 }}>
                                {attachments.map((attachment) => (
                                  <div
                                    key={attachment.id}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      gap: 6,
                                      fontSize: 12,
                                      border: "1px solid #e2e8f0",
                                      borderRadius: 8,
                                      padding: "4px 6px",
                                    }}
                                  >
                                    <span
                                      title={attachment.name}
                                      style={{
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      ✅ {attachment.name}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onRemoveAttachment(
                                          item.id,
                                          attachment.id,
                                        )
                                      }
                                      style={{
                                        border: 0,
                                        background: "transparent",
                                        cursor: "pointer",
                                        color: "#b91c1c",
                                        fontWeight: 900,
                                      }}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: "#64748b", fontSize: 12 }}>
                                טרם צורף מסמך
                              </span>
                            )}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ ...cellStyle, textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => removeChecklistItem(item.id)}
                          style={{ ...styles.dangerBtn, padding: "7px 10px" }}
                        >
                          מחק
                        </button>
                      </td>
                      <td
                        style={{
                          ...cellStyle,
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        <button
                          type="button"
                          title="סמן כדי להסתיר שורה זו בקובץ הסופי להדפסה"
                          onClick={() =>
                            toggleChecklistItemPrintExclusion(item.id)
                          }
                          style={{
                            width: 18,
                            height: 18,
                            border: "1.2px solid #334155",
                            borderRadius: 2,
                            background: "#fff",
                            cursor: "pointer",
                            fontWeight: 950,
                            fontSize: 13,
                            lineHeight: "13px",
                            padding: 0,
                          }}
                        >
                          {isExcludedFromPrint ? "*" : ""}
                        </button>
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ProjectLegendPanel({
  legend,
  missing,
  canEdit = true,
  isEditing,
  hasChanges,
  onChange,
  onStartEdit,
  onApprove,
  onCancel,
  onClear,
  onAddFactor,
  onRemoveFactor,
}: {
  legend: ProjectLegend;
  missing: boolean;
  canEdit?: boolean;
  isEditing: boolean;
  hasChanges: boolean;
  onChange: (field: keyof ProjectLegend, value: string) => void;
  onStartEdit: () => void;
  onApprove: () => void;
  onCancel: () => void;
  onClear: () => void;
  onAddFactor: () => void;
  onRemoveFactor: (id: string) => void;
}) {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px 12px",
    fontWeight: 800,
    background: "#fff",
  };
  const labelStyle: React.CSSProperties = {
    display: "grid",
    gap: 6,
    fontWeight: 900,
  };
  const fields: Array<{
    key: keyof ProjectLegend;
    label: string;
    required?: boolean;
  }> = [
    { key: "projectName", label: "שם פרויקט", required: true },
    { key: "projectManagement", label: "ניהול פרויקט", required: true },
    { key: "contractor", label: "שם הקבלן", required: true },
    { key: "qualityAssurance", label: "הבטחת איכות", required: true },
    { key: "qualityControl", label: "בקרת איכות", required: true },
    { key: "workManager", label: "מנהל עבודה" },
    { key: "surveyor", label: "מודד" },
    { key: "supervisor", label: "מפקח" },
  ];
  return (
    <section
      style={{
        border: missing ? "1px solid #fecaca" : "1px solid #cbd5e1",
        background: missing ? "#fff7ed" : "#f8fafc",
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "start",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 950 }}>פרטי הפרויקט</div>
          <div style={{ color: "#475569", marginTop: 4 }}>
            הנתונים כאן ימולאו אוטומטית בראש הריכוזים ובטפסים, לפי הפרויקט
            הפעיל.
          </div>
          {hasChanges ? (
            <div style={{ color: "#b45309", fontWeight: 950, marginTop: 6 }}>
              יש שינויים שעדיין לא אושרו
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onStartEdit}
            disabled={!canEdit}
            style={{ ...styles.secondaryBtn, opacity: canEdit ? 1 : 0.5 }}
          >
            עדכון
          </button>
          <button type="button" onClick={onApprove} style={styles.primaryBtn}>
            אישור שמירת שינויים
          </button>
          <button type="button" onClick={onCancel} style={styles.secondaryBtn}>
            בטל שינויים
          </button>
          <button
            type="button"
            onClick={onAddFactor}
            style={styles.secondaryBtn}
          >
            הוספת גורם
          </button>
          <button type="button" onClick={onClear} style={styles.dangerBtn}>
            מחיקה
          </button>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {fields.map((field) => (
          <label key={String(field.key)} style={labelStyle}>
            {field.label}
            {field.required ? " *" : ""}
            <input
              value={String(legend[field.key] ?? "")}
              onChange={(event) => onChange(field.key, event.target.value)}
              style={inputStyle}
            />
          </label>
        ))}
        {legend.extraFactors.map((factor) => (
          <div
            key={factor.id}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: 10,
              background: "#fff",
            }}
          >
            <label style={labelStyle}>
              שם גורם
              <input
                value={factor.label}
                onChange={(event) =>
                  onChange(
                    "extraFactors",
                    JSON.stringify(
                      legend.extraFactors.map((item) =>
                        item.id === factor.id
                          ? { ...item, label: event.target.value }
                          : item,
                      ),
                    ),
                  )
                }
                style={inputStyle}
              />
            </label>
            <label style={{ ...labelStyle, marginTop: 8 }}>
              פרטים
              <input
                value={factor.value}
                onChange={(event) =>
                  onChange(
                    "extraFactors",
                    JSON.stringify(
                      legend.extraFactors.map((item) =>
                        item.id === factor.id
                          ? { ...item, value: event.target.value }
                          : item,
                      ),
                    ),
                  )
                }
                style={inputStyle}
              />
            </label>
            <button
              type="button"
              onClick={() => onRemoveFactor(factor.id)}
              style={{ ...styles.dangerBtn, marginTop: 8 }}
            >
              מחיקת גורם
            </button>
          </div>
        ))}
      </div>
      {missing ? (
        <div style={{ marginTop: 12, color: "#991b1b", fontWeight: 900 }}>
          יש להשלים לפחות: שם פרויקט, ניהול פרויקט, שם הקבלן, הבטחת איכות ובקרת
          איכות לפני עבודה ברשימות / ריכוזים / טפסים.
        </div>
      ) : null}
    </section>
  );
}

function SimpleFolderSection({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 34 }}>{icon}</div>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 950 }}>{title}</h2>
          <div style={{ color: "#64748b", marginTop: 4 }}>{description}</div>
        </div>
      </div>
      <div style={styles.emptyBox}>
        התיקייה נוצרה. בשלב הבא ניתן להוסיף כאן טפסים, קבצים ורשומות ייעודיות.
      </div>
    </section>
  );
}


type FolderColumn = {
  label: string;
  value: (record: any, index: number) => React.ReactNode;
};

function getRecordTitle(record: any) {
  return (
    record?.title ||
    record?.name ||
    record?.checklistTitle ||
    record?.category ||
    record?.type ||
    record?.supplierName ||
    record?.materialName ||
    record?.contractorName ||
    record?.description ||
    "רשומה"
  );
}

function getRecordDate(record: any) {
  return record?.date || record?.executionDate || record?.savedAt || record?.createdAt || "";
}

function getRecordStatus(record: any) {
  return record?.status || record?.approval?.status || record?.result || "";
}

function normalizeApprovalDisplayStatus(status?: unknown) {
  const value = String(status ?? "").trim().toLowerCase();
  if (value === "מאושר" || value === "approved" || value === "נעול") return "מאושר";
  return "בטיפול";
}

function getApprovalDisplayStatus(record: any) {
  return normalizeApprovalDisplayStatus(record?.approval?.status || record?.status || record?.result);
}

function getChecklistDisplayNumber(record: any, index: number) {
  return record?.checklistNo ?? record?.serialNumber ?? record?.number ?? (index + 1);
}

function getChecklistDisplayLocation(record: any) {
  return (
    record?.roadStructure ||
    record?.road ||
    record?.structure ||
    record?.building ||
    record?.element ||
    record?.location ||
    ""
  );
}

function normalizeDateValue(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const iso = raw.match(/20\d{2}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const dmy = raw.match(/(\d{1,2})[./-](\d{1,2})[./-](20\d{2})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return raw;
}

function collectCertificateRows(record: any): any[] {
  const nested = record?.supplier || record?.subcontractor || record?.material || {};
  const candidates = [
    record?.requiredDocuments,
    record?.certificates,
    record?.documents,
    nested?.certificates,
    nested?.requiredDocuments,
    nested?.documents,
  ];
  return candidates.flatMap((value) => (Array.isArray(value) ? value : []));
}

function getPreliminaryExpiryDate(record: any) {
  const direct = normalizeDateValue(record?.expiryDate || record?.validUntil);
  if (direct) return direct;
  const rows = collectCertificateRows(record);
  const withExpiry = rows.find((row: any) => normalizeDateValue(row?.expiryDate || row?.expiry_date || row?.validUntil));
  return normalizeDateValue(withExpiry?.expiryDate || withExpiry?.expiry_date || withExpiry?.validUntil) || "";
}

function getPreliminaryApprovalDate(record: any) {
  const direct = normalizeDateValue(record?.approvalDate || record?.approvedDate || record?.date);
  if (direct) return direct;
  const rows = collectCertificateRows(record);
  const withDate = rows.find((row: any) => normalizeDateValue(row?.approvalDate || row?.approvedDate || row?.issueDate || row?.date));
  return normalizeDateValue(withDate?.approvalDate || withDate?.approvedDate || withDate?.issueDate || withDate?.date) || "";
}

function isExpiredDate(value: unknown) {
  const date = normalizeDateValue(value);
  if (!date) return false;
  const expiry = new Date(date);
  if (Number.isNaN(expiry.getTime())) return false;
  const today = new Date();
  expiry.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return expiry < today;
}

function ExpiryDateCell({ value }: { value?: unknown }) {
  const date = normalizeDateValue(value);
  const expired = isExpiredDate(date);
  return (
    <span style={{ color: expired ? "#dc2626" : undefined, fontWeight: expired ? 900 : 700 }}>
      {date || "-"}{expired ? " ✖" : ""}
    </span>
  );
}

function getPreliminaryNested(record: any) {
  return record?.supplier || record?.subcontractor || record?.material || {};
}

function getSupplierName(record: any) {
  const n = getPreliminaryNested(record);
  return n?.supplierName || n?.approvedSupplier || record?.supplierName || record?.approvedSupplier || "";
}

function getSuppliedMaterial(record: any) {
  const n = getPreliminaryNested(record);
  return n?.suppliedMaterial || n?.materialName || record?.suppliedMaterial || record?.materialName || "";
}

function getContractorName(record: any) {
  const n = getPreliminaryNested(record);
  return n?.subcontractorName || n?.contractorName || n?.approvedContractor || record?.subcontractorName || record?.contractorName || record?.approvedContractor || "";
}

function getContractorWorkField(record: any) {
  const n = getPreliminaryNested(record);
  return n?.field || n?.workField || n?.contractorField || record?.field || record?.workField || record?.contractorField || "";
}

function getMaterialSupplierName(record: any) {
  const n = getPreliminaryNested(record);
  return n?.supplierName || n?.supplier || n?.source || record?.supplierName || record?.supplier || record?.source || "";
}

function getMaterialType(record: any) {
  const n = getPreliminaryNested(record);
  return n?.materialType || n?.materialCategory || n?.materialName || n?.usage || record?.materialType || record?.materialCategory || record?.materialName || record?.usage || "";
}

function preliminaryFolderColumns(tab: PreliminaryTab): FolderColumn[] {
  if (tab === "suppliers") {
    return [
      { label: "ספק", value: (record) => getSupplierName(record) || "-" },
      { label: "חומר מסופק", value: (record) => getSuppliedMaterial(record) || "-" },
      { label: "תאריך אישור", value: (record) => getPreliminaryApprovalDate(record) || "-" },
      { label: "תאריך תפוגה", value: (record) => <ExpiryDateCell value={getPreliminaryExpiryDate(record)} /> },
      { label: "סטטוס", value: (record) => getApprovalDisplayStatus(record) },
    ];
  }
  if (tab === "subcontractors") {
    return [
      { label: "שם קבלן", value: (record) => getContractorName(record) || "-" },
      { label: "תחום עבודה", value: (record) => getContractorWorkField(record) || "-" },
      { label: "תאריך אישור", value: (record) => getPreliminaryApprovalDate(record) || "-" },
      { label: "תאריך תפוגה", value: (record) => <ExpiryDateCell value={getPreliminaryExpiryDate(record)} /> },
      { label: "סטטוס", value: (record) => getApprovalDisplayStatus(record) },
    ];
  }
  return [
    { label: "סוג", value: () => "חומרים" },
    { label: "שם ספק", value: (record) => getMaterialSupplierName(record) || "-" },
    { label: "סוג חומר מסופק", value: (record) => getMaterialType(record) || "-" },
    { label: "תאריך תפוגה", value: (record) => <ExpiryDateCell value={getPreliminaryExpiryDate(record)} /> },
    { label: "סטטוס", value: (record) => getApprovalDisplayStatus(record) },
  ];
}

function FolderRecordsTable({
  title,
  description,
  records,
  columns,
  onOpen,
  onDelete,
  onNew,
}: {
  title: string;
  description?: string;
  records: any[];
  columns: FolderColumn[];
  onOpen?: (id: string) => void;
  onDelete?: (id: string) => void;
  onNew?: () => void;
}) {
  const safeRecords = Array.isArray(records) ? records : [];
  return (
    <section
      style={{
        border: "1px solid #dbe3ef",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 18,
        background: "#fff",
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 950 }}>{title}</h2>
          {description ? (
            <div style={{ marginTop: 4, color: "#64748b", fontWeight: 700 }}>{description}</div>
          ) : null}
        </div>
        {onNew ? (
          <button type="button" style={styles.primaryBtn} onClick={onNew}>
            חדש
          </button>
        ) : null}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 760,
            fontSize: 14,
          }}
        >
          <thead>
            <tr style={{ background: "#eef2f7" }}>
              <th style={{ padding: "12px 10px", border: "1px solid #d7dee8", textAlign: "center" }}>#</th>
              {columns.map((column) => (
                <th
                  key={column.label}
                  style={{ padding: "12px 10px", border: "1px solid #d7dee8", textAlign: "center" }}
                >
                  {column.label}
                </th>
              ))}
              <th style={{ padding: "12px 10px", border: "1px solid #d7dee8", textAlign: "center" }}>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {safeRecords.length ? (
              safeRecords.map((record, index) => {
                const id = String(record?.id ?? index);
                return (
                  <tr key={id}>
                    <td style={{ padding: 10, border: "1px solid #e2e8f0", textAlign: "center", fontWeight: 900 }}>
                      {record?.checklistNo ?? record?.serialNumber ?? record?.number ?? index + 1}
                    </td>
                    {columns.map((column) => (
                      <td key={column.label} style={{ padding: 10, border: "1px solid #e2e8f0", textAlign: "center" }}>
                        {column.value(record, index) || "-"}
                      </td>
                    ))}
                    <td style={{ padding: 10, border: "1px solid #e2e8f0", textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                        {onOpen ? (
                          <button type="button" style={styles.secondaryBtn} onClick={() => onOpen(id)}>
                            פתח / ערוך
                          </button>
                        ) : null}
                        {onDelete ? (
                          <button type="button" style={styles.dangerBtn} onClick={() => onDelete(id)}>
                            מחק
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={columns.length + 2} style={{ padding: 22, textAlign: "center", color: "#64748b", fontWeight: 900 }}>
                  אין רשומות להצגה בתיקייה זו.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "date" | "textarea" | "select";
  options?: string[];
  required?: boolean;
};

function FormGrid({
  fields,
  form,
  setForm,
  readOnly = false,
}: {
  fields: FieldDef[];
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  readOnly?: boolean;
}) {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px 12px",
    fontWeight: 800,
    background: readOnly ? "#f1f5f9" : "#fff",
    minHeight: 44,
  };
  const labelStyle: React.CSSProperties = {
    display: "grid",
    gap: 6,
    fontWeight: 900,
  };
  const set = (key: string, value: string) =>
    setForm((prev: any) => ({ ...prev, [key]: value }));
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 12,
      }}
    >
      {fields.map((field) => (
        <label
          key={field.key}
          style={{
            ...labelStyle,
            gridColumn: field.type === "textarea" ? "1 / -1" : undefined,
          }}
        >
          {field.label}
          {field.required ? " *" : ""}
          {field.type === "textarea" ? (
            <textarea
              disabled={readOnly}
              value={form[field.key] ?? ""}
              onChange={(e) => set(field.key, e.target.value)}
              style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
            />
          ) : field.type === "select" ? (
            <select
              disabled={readOnly}
              value={form[field.key] ?? ""}
              onChange={(e) => set(field.key, e.target.value)}
              style={inputStyle}
            >
              {(field.options ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              disabled={readOnly}
              type={field.type === "date" ? "date" : "text"}
              value={form[field.key] ?? ""}
              onChange={(e) => set(field.key, e.target.value)}
              style={inputStyle}
            />
          )}
        </label>
      ))}
    </div>
  );
}

const RFI_FIELDS: FieldDef[] = [
  { key: "title", label: "מספר RFI", required: true },
  { key: "referenceNo", label: "מספר יחוס" },
  {
    key: "status",
    label: "סטטוס RFI",
    type: "select",
    options: ["פתוח", "ממתין להתייחסות", "בטיפול", "נענה", "סגור"],
  },
  { key: "planNo", label: "מס' תוכנית" },
  { key: "revision", label: "גרסה / מהדורה" },
  { key: "planName", label: "שם תוכנית" },
  { key: "buildingDetails", label: "פרטי המבנה" },
  { key: "building", label: "מבנה" },
  { key: "openDate", label: "תאריך פתיחה", type: "date" },
  { key: "location", label: "מיקום" },
  { key: "workActivity", label: "פעילות עבודה" },
  { key: "relevantPlans", label: "תוכניות רלוונטיות" },
  { key: "fromSection", label: "מחתך" },
  { key: "toSection", label: "עד חתך" },
  {
    key: "budgetImpact",
    label: "השפעה תקציבית",
    type: "select",
    options: ["", "כן", "לא", "נדרש בירור"],
  },
  {
    key: "scheduleImpact",
    label: "השפעה על לוח זמנים",
    type: "select",
    options: ["", "כן", "לא", "נדרש בירור"],
  },
  {
    key: "requestDescription",
    label: "תיאור הבקשה",
    type: "textarea",
    required: true,
  },
  { key: "response", label: "תשובת RFI / התייחסות שהתקבלה", type: "textarea" },
  { key: "closeDate", label: "תאריך סגירת RFI", type: "date" },
  { key: "closedAt", label: "נסגר בתאריך", type: "date" },
  { key: "closedBy", label: "נסגר ע״י" },
];

function RfiSection({
  guardedBody,
  rfiForm,
  setRfiForm,
  editingRfiId,
  savedRfis,
  saveRfi,
  resetRfiForm,
  closeRfi,
  deleteRfi,
  loadRfi,
  projectMeta,
}: {
  guardedBody: React.ReactNode;
  rfiForm: any;
  setRfiForm: React.Dispatch<React.SetStateAction<any>>;
  editingRfiId: string | null;
  savedRfis: RfiRecord[];
  saveRfi: () => void | Promise<void>;
  resetRfiForm: () => void;
  closeRfi: () => void;
  deleteRfi: (id: string) => void | Promise<void>;
  loadRfi: (record: RfiRecord) => void;
  projectMeta: ProjectLegend;
}) {
  if (guardedBody) return <>{guardedBody}</>;
  const metaStyle: React.CSSProperties = {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
    background: "#f8fafc",
    fontWeight: 800,
  };
  const rfiDocuments = normalizeAttachments(rfiForm.documents);
  const addRfiDocument = async (file?: File) => {
    if (!file) return;
    const maxSizeMb = 20;
    if (file.size > maxSizeMb * 1024 * 1024) {
      alert(`הקובץ גדול מדי. ניתן לצרף עד ${maxSizeMb}MB לקובץ.`);
      return;
    }

    const appendAttachment = (attachment: StoredAttachment) => {
      setRfiForm((prev: any) => ({
        ...prev,
        documents: [...normalizeAttachments(prev.documents), attachment],
      }));
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9.א-ת_-]/g, "_");
        const filePath = `rfi/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
        const uploadResult = await supabase.storage
          .from("rfi-documents")
          .upload(filePath, file, {
            upsert: false,
            contentType: file.type || undefined,
          });

        if (uploadResult.error) throw uploadResult.error;

        const { data } = supabase.storage
          .from("rfi-documents")
          .getPublicUrl(filePath);
        appendAttachment({
          name: file.name,
          type: file.type,
          dataUrl: data.publicUrl,
          uploadedAt: nowLocal(),
        });
        return;
      } catch (error) {
        console.error("RFI document upload failed", error);
        alert("העלאת הקובץ ל-Supabase נכשלה. הקובץ לא צורף.");
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = () => {
      appendAttachment({
        name: file.name,
        type: file.type,
        dataUrl: String(reader.result ?? ""),
        uploadedAt: nowLocal(),
      });
    };
    reader.onerror = () => alert("לא ניתן לקרוא את הקובץ שנבחר");
    reader.readAsDataURL(file);
  };
  const removeRfiDocument = (indexToRemove: number) => {
    setRfiForm((prev: any) => ({
      ...prev,
      documents: normalizeAttachments(prev.documents).filter(
        (_, index) => index !== indexToRemove,
      ),
    }));
  };
  return (
    <section>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 950 }}>בקשת RFI</h2>
          <div style={{ color: "#64748b", marginTop: 4 }}>
            טופס בקשה למידע לפי הקובץ המצורף. ניתן לסגור רק לאחר קבלת התייחסות.
          </div>
        </div>
        <div style={styles.buttonRow}>
          <button
            type="button"
            style={styles.secondaryBtn}
            onClick={resetRfiForm}
          >
            בקשה חדשה
          </button>
          <button type="button" style={styles.primaryBtn} onClick={saveRfi}>
            {editingRfiId ? "עדכון RFI" : "אישור פתיחת RFI"}
          </button>
          <button type="button" style={styles.dangerBtn} onClick={closeRfi}>
            אישור / סגירת RFI
          </button>
        </div>
      </div>
      <div
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 18,
          padding: 16,
          background: "#fff",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div style={metaStyle}>
            שם הפרויקט
            <br />
            {projectMeta.projectName || "—"}
          </div>
          <div style={metaStyle}>
            קבלן ראשי
            <br />
            {projectMeta.contractor || "—"}
          </div>
          <div style={metaStyle}>
            חברת ניהול
            <br />
            {projectMeta.projectManagement || "—"}
          </div>
          <div style={metaStyle}>
            חברת בקרת איכות
            <br />
            {projectMeta.qualityControl || "—"}
          </div>
          <div style={metaStyle}>
            חברת הבטחת איכות
            <br />
            {projectMeta.qualityAssurance || "—"}
          </div>
        </div>
        <FormGrid fields={RFI_FIELDS} form={rfiForm} setForm={setRfiForm} />
        <div
          style={{
            border: "1px dashed #94a3b8",
            borderRadius: 16,
            padding: 14,
            background: "#f8fafc",
            marginTop: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 950, fontSize: 18 }}>
                מסמכים מצורפים ל-RFI
              </div>
              <div style={{ color: "#64748b", marginTop: 4 }}>
                ניתן לצרף PDF, תמונות, Word או Excel. הקבצים נשמרים יחד עם רשומת
                ה-RFI.
              </div>
            </div>
            <label
              style={{
                ...styles.secondaryBtn,
                display: "inline-flex",
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              📎 צירוף קובץ
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                style={{ display: "none" }}
                onChange={(event) => {
                  Array.from(event.target.files ?? []).forEach((file) => {
                    void addRfiDocument(file);
                  });
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {rfiDocuments.length ? (
              rfiDocuments.map((doc, index) => (
                <div
                  key={`${doc.name}-${doc.uploadedAt}-${index}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: 10,
                    background: "#fff",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 900,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ✅ {doc.name}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      {doc.uploadedAt || "ללא תאריך"} · {doc.type || "קובץ"}
                    </div>
                  </div>
                  <div style={styles.buttonRow}>
                    <a
                      href={doc.dataUrl}
                      download={doc.name}
                      style={{ ...styles.secondaryBtn, textDecoration: "none" }}
                    >
                      הורדה
                    </a>
                    <button
                      type="button"
                      style={styles.dangerBtn}
                      onClick={() => removeRfiDocument(index)}
                    >
                      מחיקה
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div style={styles.emptyBox}>טרם צורפו מסמכים ל-RFI.</div>
            )}
          </div>
        </div>
      </div>
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 18,
          padding: 16,
          background: "#f8fafc",
        }}
      >
        <h3 style={{ marginTop: 0 }}>רשימת RFI שמורות</h3>
        {savedRfis.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {savedRfis.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "center",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 10,
                  background: "#fff",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <strong>{item.title}</strong>
                  <div style={{ color: "#64748b" }}>
                    {item.status} · {item.location || "ללא מיקום"} ·{" "}
                    {item.savedAt}
                  </div>
                  <div style={{ color: "#475569", fontSize: 13, marginTop: 3 }}>
                    נפתח ע״י: {item.createdBy || "—"} · עודכן ע״י:{" "}
                    {item.updatedBy || "—"} · עדכון אחרון:{" "}
                    {item.updatedAt || "—"}
                  </div>
                </div>
                <div style={styles.buttonRow}>
                  <button
                    type="button"
                    style={styles.secondaryBtn}
                    onClick={() => loadRfi(item)}
                  >
                    פתח
                  </button>
                  <button
                    type="button"
                    style={styles.dangerBtn}
                    onClick={() => deleteRfi(item.id)}
                  >
                    מחיקה
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.emptyBox}>אין בקשות RFI שמורות.</div>
        )}
      </div>
      {editingRfiId &&
      normalizeRfiRecord({
        ...rfiForm,
        id: editingRfiId,
        projectId: "",
        savedAt: "",
      })?.auditTrail?.length ? (
        <div
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: 18,
            padding: 16,
            background: "#fff",
            marginTop: 16,
          }}
        >
          <h3 style={{ marginTop: 0 }}>יומן שינויים RFI</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {normalizeRfiRecord({
              ...rfiForm,
              id: editingRfiId,
              projectId: "",
              savedAt: "",
            })!.auditTrail.map((entry, index) => (
              <div
                key={`${entry.at}-${index}`}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 10,
                  background: "#f8fafc",
                }}
              >
                <strong>{entry.action || "פעולה"}</strong> ·{" "}
                {entry.by || "משתמש"} · {entry.at || "—"}
                <div style={{ color: "#475569", marginTop: 4 }}>
                  {entry.note}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

const NCR_FIELDS: FieldDef[] = [
  { key: "title", label: "אי התאמה מס׳", required: true },
  {
    key: "openedBy",
    label: "נפתח QA / QC",
    type: "select",
    options: ["QA / QC", "QC", "QA"],
  },
  {
    key: "openedRole",
    label: "תפקיד",
    type: "select",
    options: ["בקרת איכות", "הבטחת איכות"],
  },
  { key: "raisedBy", label: "שם פותח" },
  { key: "date", label: "תאריך פתיחה", type: "date" },
  { key: "location", label: "קטע" },
  { key: "building", label: "מבנה" },
  { key: "element", label: "אלמנט" },
  { key: "subElement", label: "תת אלמנט" },
  { key: "fromSection", label: "מחתך" },
  { key: "toSection", label: "עד חתך" },
  { key: "offset", label: "הסט" },
  { key: "grade", label: "דרגה" },
  { key: "expectedCloseDate", label: "תאריך סגירה משוער", type: "date" },
  {
    key: "updatedExpectedCloseDate",
    label: "תאריך סגירה משוער מעודכן",
    type: "date",
  },
  { key: "delayDays", label: "מס׳ ימי עיכוב לסגירה" },
  { key: "breakage", label: "שבר" },
  {
    key: "qualityImpact",
    label: "השפעה על איכות",
    type: "select",
    options: ["", "נמוכה", "בינונית", "גבוהה", "קריטית"],
  },
  {
    key: "description",
    label: "תאור אי ההתאמה",
    type: "textarea",
    required: true,
  },
  {
    key: "responsibleParty",
    label: "גורם אחראי לליקוי תכנון, ביצוע, ספק",
    type: "textarea",
  },
  { key: "actionRequired", label: "טיפול נדרש", type: "textarea" },
  { key: "handler", label: "גורם המטפל" },
  {
    key: "correctiveActionDetails",
    label: "פירוט ביצוע פעולה מתקנת",
    type: "textarea",
  },
  { key: "notes", label: "הערות", type: "textarea" },
  { key: "closedBy", label: "נסגרה ע״י" },
  {
    key: "closingRole",
    label: "תפקיד סגירה",
    type: "select",
    options: ["", "QC", "QA"],
  },
  { key: "closedName", label: "שם סוגר" },
  { key: "closingDate", label: "תאריך סגירה", type: "date" },
  {
    key: "status",
    label: "סטטוס",
    type: "select",
    options: ["פתוח", "בטיפול", "סגור"],
  },
  {
    key: "severity",
    label: "חומרה",
    type: "select",
    options: ["נמוכה", "בינונית", "גבוהה", "קריטית"],
  },
];

function EnhancedNonconformancesSection({
  guardedBody,
  editingNonconformanceId,
  nonconformanceForm,
  setNonconformanceForm,
  saveNonconformance,
  resetNonconformanceEditor,
  closeNonconformance,
  uploadNonconformanceAttachment,
  removeNonconformanceAttachment,
}: {
  guardedBody: React.ReactNode;
  editingNonconformanceId: string | null;
  nonconformanceForm: any;
  setNonconformanceForm: React.Dispatch<React.SetStateAction<any>>;
  saveNonconformance: () => void;
  resetNonconformanceEditor: () => void;
  closeNonconformance: () => void;
  uploadNonconformanceAttachment: (file?: File) => void;
  removeNonconformanceAttachment: (index: number) => void;
}) {
  if (guardedBody) return <>{guardedBody}</>;
  return (
    <section>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 950 }}>
            טופס אי התאמה
          </h2>
          <div style={{ color: "#64748b", marginTop: 4 }}>
            פתיחה, טיפול, פעולה מתקנת וסגירה לפי טופס אי ההתאמה המצורף.
          </div>
        </div>
        <div style={styles.buttonRow}>
          <button
            type="button"
            style={styles.secondaryBtn}
            onClick={resetNonconformanceEditor}
          >
            אי התאמה חדשה
          </button>
          <button
            type="button"
            style={styles.primaryBtn}
            onClick={saveNonconformance}
          >
            {editingNonconformanceId
              ? "עדכון אי התאמה"
              : "אישור פתיחת אי התאמה"}
          </button>
          <button
            type="button"
            style={styles.dangerBtn}
            onClick={closeNonconformance}
          >
            אישור ביצוע / סגירה
          </button>
        </div>
      </div>
      <div
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 18,
          padding: 16,
          background: "#fff",
        }}
      >
        <FormGrid
          fields={NCR_FIELDS}
          form={nonconformanceForm}
          setForm={setNonconformanceForm}
        />
        <div
          style={{
            borderTop: "1px solid #e2e8f0",
            marginTop: 18,
            paddingTop: 16,
          }}
        >
          <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 900 }}>
            תמונות / קבצים מצורפים לאי התאמה
          </h3>
          <div style={{ color: "#64748b", marginBottom: 10 }}>
            ניתן לצרף תמונות, PDF וכל קובץ תומך. הקבצים נשמרים יחד עם רשומת ה־NCR.
          </div>
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
            onChange={(event) => {
              Array.from(event.target.files ?? []).forEach((file) =>
                uploadNonconformanceAttachment(file),
              );
              event.currentTarget.value = "";
            }}
          />
          {normalizeAttachments((nonconformanceForm as any).images).length ? (
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {normalizeAttachments((nonconformanceForm as any).images).map(
                (file, index) => {
                  const isImage =
                    String(file.type ?? "").startsWith("image/") ||
                    String(file.dataUrl ?? "").startsWith("data:image/");
                  return (
                    <div
                      key={`${file.name}-${file.uploadedAt}-${index}`}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        padding: 10,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        background: "#f8fafc",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {isImage ? (
                          <img
                            src={file.dataUrl}
                            alt={file.name}
                            style={{
                              width: 72,
                              height: 54,
                              objectFit: "cover",
                              borderRadius: 8,
                              border: "1px solid #cbd5e1",
                            }}
                          />
                        ) : null}
                        <div>
                          <div style={{ fontWeight: 800 }}>{file.name || "קובץ"}</div>
                          <div style={{ color: "#64748b", fontSize: 12 }}>
                            {file.type || "קובץ"} · {file.uploadedAt || "ללא תאריך"}
                          </div>
                        </div>
                      </div>
                      <div style={styles.buttonRow}>
                        {file.dataUrl ? (
                          <a
                            href={file.dataUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={styles.secondaryBtn as any}
                          >
                            פתח
                          </a>
                        ) : null}
                        <button
                          type="button"
                          style={styles.dangerBtn}
                          onClick={() => removeNonconformanceAttachment(index)}
                        >
                          מחק
                        </button>
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          ) : (
            <div style={{ color: "#94a3b8", marginTop: 8 }}>
              לא צורפו קבצים עדיין.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PasswordField({
  value,
  onChange,
  placeholder = "סיסמה",
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={{
          width: "100%",
          border: "1px solid #cbd5e1",
          borderRadius: 12,
          padding: "12px 44px 12px 14px",
          fontWeight: 800,
          fontSize: 16,
        }}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? "הסתר סיסמה" : "הצג סיסמה"}
        title={visible ? "הסתר סיסמה" : "הצג סיסמה"}
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          border: 0,
          background: "transparent",
          cursor: "pointer",
          fontSize: 20,
          padding: 4,
        }}
      >
        {visible ? "🙈" : "👁️"}
      </button>
    </div>
  );
}

function ProjectLoginScreen({
  username,
  password,
  error,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: {
  username: string;
  password: string;
  error: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f1f5f9",
        padding: 18,
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: "min(460px, 96vw)",
          background: "#fff",
          borderRadius: 22,
          padding: 24,
          boxShadow: "0 22px 70px rgba(15, 23, 42, 0.14)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 28, fontWeight: 950, color: "#0f172a" }}>
            Y.K QUALITY
          </div>
          <div style={{ color: "#475569", marginTop: 6, fontWeight: 700 }}>
            כניסה לפי שם משתמש וסיסמה
          </div>
        </div>

        <label
          style={{ display: "grid", gap: 7, marginBottom: 14, fontWeight: 900 }}
        >
          שם משתמש / קוד פרויקט
          <input
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
            placeholder="לדוגמה: admin או 806"
            autoFocus
            autoComplete="username"
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "12px 14px",
              fontWeight: 800,
              fontSize: 16,
            }}
          />
        </label>

        <label
          style={{ display: "grid", gap: 7, marginBottom: 16, fontWeight: 900 }}
        >
          סיסמה
          <PasswordField
            value={password}
            onChange={onPasswordChange}
            autoComplete="current-password"
          />
        </label>

        {error ? (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              borderRadius: 12,
              padding: 10,
              fontWeight: 900,
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          style={{
            width: "100%",
            border: 0,
            borderRadius: 14,
            padding: "13px 16px",
            background: "#0f172a",
            color: "#fff",
            fontWeight: 950,
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          כניסה למערכת
        </button>
      </form>
    </div>
  );
}

function UserAccessPanel({
  users,
  onChangeUser,
  onAddUser,
  onRemoveUser,
  onResetDefaults,
  onUploadSignature,
  onApproveChanges,
  onCancelChanges,
  hasUnsavedChanges,
}: {
  users: ProjectAccess[];
  onChangeUser: (
    index: number,
    field: keyof ProjectAccess,
    value: string,
  ) => void;
  onAddUser: () => void;
  onRemoveUser: (index: number) => void;
  onResetDefaults: () => void;
  onUploadSignature: (index: number, file?: File) => void;
  onApproveChanges: () => void;
  onCancelChanges: () => void;
  hasUnsavedChanges: boolean;
}) {
  return (
    <div
      style={{
        border: "1px solid #cbd5e1",
        background: "#fff",
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 950 }}>
            ניהול משתמשים והרשאות
          </div>
          <div style={{ color: "#64748b", marginTop: 4 }}>
            מנהל מערכת נשאר עם גישה לכל הפרויקטים. משתמש רגיל רואה רק את הפרויקט
            שהוגדר לו.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {hasUnsavedChanges ? (
            <span
              style={{ color: "#b45309", fontWeight: 950, alignSelf: "center" }}
            >
              יש שינויים שלא נשמרו
            </span>
          ) : null}
          <button
            type="button"
            onClick={onApproveChanges}
            disabled={!hasUnsavedChanges}
            style={{
              ...styles.primaryBtn,
              opacity: hasUnsavedChanges ? 1 : 0.5,
            }}
          >
            אישור שמירת שינויים
          </button>
          <button
            type="button"
            onClick={onCancelChanges}
            disabled={!hasUnsavedChanges}
            style={{
              ...styles.secondaryBtn,
              opacity: hasUnsavedChanges ? 1 : 0.5,
            }}
          >
            בטל שינויים
          </button>
          <button
            type="button"
            onClick={onAddUser}
            style={{ ...styles.secondaryBtn }}
          >
            הוסף משתמש
          </button>
          <button
            type="button"
            onClick={onResetDefaults}
            style={{ ...styles.secondaryBtn }}
          >
            איפוס ברירת מחדל
          </button>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}
        >
          <thead>
            <tr>
              <th style={{ border: "1px solid #e2e8f0", padding: 8 }}>
                שם לתצוגה
              </th>
              <th style={{ border: "1px solid #e2e8f0", padding: 8 }}>
                שם משתמש
              </th>
              <th style={{ border: "1px solid #e2e8f0", padding: 8 }}>סיסמה</th>
              <th style={{ border: "1px solid #e2e8f0", padding: 8 }}>
                סוג הרשאה
              </th>
              <th style={{ border: "1px solid #e2e8f0", padding: 8 }}>
                קוד / קישור
              </th>
              <th style={{ border: "1px solid #e2e8f0", padding: 8 }}>
                שם פרויקט למשתמש רגיל
              </th>
              <th style={{ border: "1px solid #e2e8f0", padding: 8 }}>
                חתימה / חותמת שמורה
              </th>
              <th style={{ border: "1px solid #e2e8f0", padding: 8 }}>
                פעולות
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => {
              const isAdmin = user.role === "admin";
              const projectLink =
                typeof window !== "undefined" && user.code
                  ? `${window.location.origin}/?project=${encodeURIComponent(user.code)}`
                  : (user.code ?? "");
              return (
                <tr key={`access-user-${index}`}>
                  <td style={{ border: "1px solid #e2e8f0", padding: 8 }}>
                    <input
                      value={user.displayName}
                      onChange={(e) =>
                        onChangeUser(index, "displayName", e.target.value)
                      }
                      style={{
                        width: "100%",
                        border: "1px solid #cbd5e1",
                        borderRadius: 10,
                        padding: 8,
                        fontWeight: 800,
                      }}
                    />
                  </td>
                  <td style={{ border: "1px solid #e2e8f0", padding: 8 }}>
                    <input
                      value={user.username}
                      onChange={(e) =>
                        onChangeUser(index, "username", e.target.value)
                      }
                      style={{
                        width: "100%",
                        border: "1px solid #cbd5e1",
                        borderRadius: 10,
                        padding: 8,
                        fontWeight: 800,
                        direction: "ltr",
                      }}
                    />
                  </td>
                  <td
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: 8,
                      minWidth: 190,
                    }}
                  >
                    <PasswordField
                      value={user.password}
                      onChange={(value) =>
                        onChangeUser(index, "password", value)
                      }
                      autoComplete="new-password"
                    />
                  </td>
                  <td style={{ border: "1px solid #e2e8f0", padding: 8 }}>
                    <select
                      value={user.role}
                      onChange={(e) =>
                        onChangeUser(index, "role", e.target.value)
                      }
                      style={{
                        width: "100%",
                        border: "1px solid #cbd5e1",
                        borderRadius: 10,
                        padding: 8,
                        fontWeight: 900,
                      }}
                    >
                      <option value="admin">מנהל מערכת</option>
                      <option value="user">משתמש פרויקט</option>
                    </select>
                  </td>
                  <td
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: 8,
                      minWidth: 210,
                    }}
                  >
                    <input
                      value={user.code ?? ""}
                      onChange={(e) =>
                        onChangeUser(index, "code", e.target.value)
                      }
                      style={{
                        width: "100%",
                        border: "1px solid #cbd5e1",
                        borderRadius: 10,
                        padding: 8,
                        fontWeight: 800,
                        direction: "ltr",
                      }}
                    />
                    {!isAdmin && projectLink ? (
                      <div
                        style={{
                          color: "#64748b",
                          marginTop: 6,
                          fontSize: 12,
                          direction: "ltr",
                          textAlign: "left",
                        }}
                      >
                        {projectLink}
                      </div>
                    ) : null}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: 8,
                      minWidth: 260,
                    }}
                  >
                    <input
                      disabled={isAdmin}
                      value={
                        isAdmin ? "כל הפרויקטים" : (user.projectName ?? "")
                      }
                      onChange={(e) =>
                        onChangeUser(index, "projectName", e.target.value)
                      }
                      style={{
                        width: "100%",
                        border: "1px solid #cbd5e1",
                        borderRadius: 10,
                        padding: 8,
                        fontWeight: 800,
                        background: isAdmin ? "#f1f5f9" : "#fff",
                      }}
                    />
                  </td>
                  <td
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: 8,
                      minWidth: 190,
                      textAlign: "center",
                    }}
                  >
                    {user.signatureDataUrl ? (
                      <img
                        src={user.signatureDataUrl}
                        alt="חתימה/חותמת"
                        style={{
                          maxWidth: 130,
                          maxHeight: 52,
                          display: "block",
                          margin: "0 auto 6px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 8,
                          background: "#fff",
                          padding: 4,
                        }}
                      />
                    ) : (
                      <div style={{ color: "#64748b", marginBottom: 6 }}>
                        לא הועלתה חתימה
                      </div>
                    )}
                    <label
                      style={{
                        ...styles.secondaryBtn,
                        display: "inline-flex",
                        cursor: "pointer",
                        padding: "6px 9px",
                      }}
                    >
                      העלה חתימה/חותמת
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(event) => {
                          onUploadSignature(index, event.target.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    {user.signatureDataUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          onChangeUser(index, "signatureDataUrl", "")
                        }
                        style={{
                          border: 0,
                          background: "transparent",
                          color: "#b91c1c",
                          fontWeight: 900,
                          cursor: "pointer",
                          display: "block",
                          margin: "6px auto 0",
                        }}
                      >
                        נקה
                      </button>
                    ) : null}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: 8,
                      textAlign: "center",
                    }}
                  >
                    <button
                      type="button"
                      disabled={users.length <= 1 || isAdmin}
                      onClick={() => onRemoveUser(index)}
                      style={{
                        ...styles.dangerBtn,
                        opacity: users.length <= 1 || isAdmin ? 0.45 : 1,
                      }}
                    >
                      מחיקה
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}



const REFERENCE_PDFJS_VERSION = "3.11.174";
const REFERENCE_PDFJS_SCRIPT = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${REFERENCE_PDFJS_VERSION}/pdf.min.js`;
const REFERENCE_PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${REFERENCE_PDFJS_VERSION}/pdf.worker.min.js`;

const loadReferencePdfJs = async (): Promise<any> => {
  if (typeof window === "undefined") throw new Error("PDF parsing is available in the browser only");
  const existing = (window as any).pdfjsLib;
  if (existing) return existing;
  await new Promise<void>((resolve, reject) => {
    const previous = document.querySelector(`script[data-reference-pdfjs="true"]`) as HTMLScriptElement | null;
    if (previous) {
      previous.addEventListener("load", () => resolve(), { once: true });
      previous.addEventListener("error", () => reject(new Error("טעינת קורא PDF נכשלה")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = REFERENCE_PDFJS_SCRIPT;
    script.async = true;
    script.dataset.referencePdfjs = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("טעינת קורא PDF נכשלה"));
    document.head.appendChild(script);
  });
  const pdfjs = (window as any).pdfjsLib;
  if (!pdfjs) throw new Error("קורא PDF לא זמין בדפדפן");
  pdfjs.GlobalWorkerOptions.workerSrc = REFERENCE_PDFJS_WORKER;
  return pdfjs;
};

const extractTextFromReferenceFile = async (file: File): Promise<string> => {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".txt") || file.type.includes("text")) return await file.text();
  if (!lowerName.endsWith(".pdf") && !file.type.includes("pdf")) return "";
  const pdfjs = await loadReferencePdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    pages.push((content.items || []).map((item: any) => String(item?.str ?? "")).join("\n"));
  }
  return pages.join("\n");
};

const normalizeReferencePdfText = (value: unknown) =>
  String(value ?? "").replace(/\u200f|\u200e/g, "").replace(/[׳`’]/g, "'").replace(/\s+/g, " ").trim();

const firstRegexGroup = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value;
  }
  return "";
};

const extractReferencePdfNumber = (text: string) =>
  firstRegexGroup(text, [
    /ריכוז\s+בדיקות\s+מעבדה\s+מס['׳]?\s*-?\s*(\d{3,})/i,
    /מס['׳]?\s*תעודה\s*-?\s*(\d{3,})/i,
    /(?:^|\s)(\d{4,6})(?=\s*(?:שם\s+האתר|כביש|תאריך))/,
  ]);

const extractReferencePdfDate = (text: string) =>
  normalizeDateValue(firstRegexGroup(text, [/תאריך\s+דגימה\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i, /תאריך\s+הוצאה\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i, /(\d{1,2}[./-]\d{1,2}[./-]20\d{2})/])) ;

const upsertParsedReferenceMetric = (
  rows: ReferenceResultRow[],
  aliases: string[],
  value: string,
): ReferenceResultRow[] => {
  const clean = String(value ?? "").trim();
  if (!clean) return rows;
  const normalizedAliases = aliases.map((alias) => normalizeHebrewProjectName(alias));
  let found = false;
  const next = rows.map((row) => {
    const metric = normalizeHebrewProjectName(row.metric);
    const match = normalizedAliases.some((alias) => metric === alias || metric.includes(alias) || alias.includes(metric));
    if (!match) return row;
    found = true;
    return applyReferenceQualityStatus({ ...row, resultValue: clean });
  });
  if (found) return next;
  return rows;
};

const parseReferenceCertificateResultsFromText = (workType: unknown, rawText: string): ReferenceResultRow[] => {
  const text = normalizeReferencePdfText(rawText);
  if (!text) return [];
  let rows = ensureReferenceResultsForMaterial(workType, []);
  const setMetric = (aliases: string[], value: string) => {
    rows = upsertParsedReferenceMetric(rows, aliases, value);
  };

  const certNo = extractReferencePdfNumber(text);
  const certDate = extractReferencePdfDate(text);
  const aashto = firstRegexGroup(text, [/\b(A-\d-[a-z]\s*\(\d+\))/i, /מיון\s+AASHTO\s*([A-Z0-9\-()\s]+)/i]);
  const unified = firstRegexGroup(text, [/מיון\s+אחיד\s+לפי\s+ת["׳']?י\s*254\s*([A-Z]{1,3})/i, /\b(SM|SC|SW|SP|GM|GC|GW|GP|CL|ML|CH|MH)\b/i]);
  const material = firstRegexGroup(text, [/סוג\s+החומר\s+([^\n]+?)(?:\s+תאור|\s+תיאור|\s+מקור|\s+הדוגם|$)/i, /(אבן\s+גרוסה\s*-\s*[^\n]+)/i]);
  const source = firstRegexGroup(text, [/מקור\s+החומר\s+([^\n]+?)(?:\s+הדוגם|\s+AASHTO|\s+מיון|$)/i, /(מחצבה\s+[^\n\s]+)/i]);
  const samplePlace = firstRegexGroup(text, [/קטע\s+נבדק\s+([^\n]+?)(?:\s+סוג\s+החומר|\s+תאור|$)/i, /(ערמה\s+באתר)/i]);

  setMetric(["מספר תעודת מעבדה", "מספר תעודה"], certNo);
  setMetric(["תאריך"], certDate);
  setMetric(["מיין AASHTO", "דירוג AASHTO מיין", "AASHTO"], aashto);
  setMetric(["מיון אחיד", "מיון לפי תי 254"], unified);
  setMetric(["תיאור החומר", "סוג החומר"], material);
  setMetric(["מקור החומר", "מקור"], source);
  setMetric(["מקום הדגם לבדיקה", "מקום נטילת מדגם לבדיקה", "מקום הדיגום"], samplePlace);

  const sieveHeaderMatch = text.match(/#200\s+#40\s+#10\s+#4[\s\S]{0,220}?((?:\d+(?:\.\d+)?\s+){5,}\d+(?:\.\d+)?)/i);
  const sampleLine = sieveHeaderMatch?.[1]?.trim() ?? "";
  const values = sampleLine.match(/\d+(?:\.\d+)?/g) ?? [];
  if (values.length >= 7) {
    const sieveAliases = [["#200"], ["#40"], ["#10"], ["#4"], ['3/8"', "3/8"], ['3/4"', "3/4"], ['1"', "1 אינץ"], ['1.5"', "1.5"], ['3"', "3 אינץ"]];
    const start = values.length === 9 ? 0 : 0;
    values.slice(start, start + sieveAliases.length).forEach((value, index) => setMetric(sieveAliases[index] ?? [], value));
  }

  const numericAfter = (label: string) => {
    const pattern = new RegExp(`${label}[\\s\\S]{0,90}?([0-9]+(?:\\.[0-9]+)?)`, "i");
    return text.match(pattern)?.[1] ?? "";
  };
  setMetric(["גבול נזילות", "LL"], numericAfter("גבול\\s+נזילות|L\\.?L"));
  setMetric(["גבול פלסטיות", "PL", "LP"], numericAfter("גבול\\s+ה?פלסטיות|L\\.?P"));
  setMetric(["אינדקס פלסטיות", "PI"], numericAfter("אינדקס\\s+פלסטיות|P\\.?I"));
  setMetric(["שווה ערך חול", "שעח"], numericAfter("שווה\\s+ערך\\s+חול"));
  setMetric(["צפיפות מעבדתית מקסימלית", "צפיפות מקסימלית"], numericAfter("צפיפות\\s+מקסימלית"));
  setMetric(["רטיבות אופטימלית"], numericAfter("רטיבות\\s+אופטימלית"));
  setMetric(["צפיפות מכשירית", "צפיפות ממשית"], numericAfter("משקל\\s+סגולי\\s+ממשי|צפיפות\\s+מחושבת"));
  setMetric(["ספיגות", "ספיגות (G)"], numericAfter("ספיגות"));
  setMetric(["לוס אנג'לס", "לוס אנגלס"], numericAfter("לוס\\s+אנג"));

  return rows;
};

function ControlProcessesSection({
  guardedBody,
  form,
  setForm,
  editingId,
  savedProcesses,
  checklists,
  rfis,
  nonconformances,
  onSave,
  onReset,
  onLoad,
  onDelete,
  onLock,
}: {
  guardedBody: React.ReactNode;
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  editingId: string | null;
  savedProcesses: ControlProcessRecord[];
  checklists: ChecklistRecord[];
  rfis: RfiRecord[];
  nonconformances: NonconformanceRecord[];
  onSave: () => void | Promise<void>;
  onReset: () => void;
  onLoad: (record: ControlProcessRecord) => void;
  onDelete: (id: string) => void | Promise<void>;
  onLock: () => void | Promise<void>;
}) {
  if (guardedBody) return <>{guardedBody}</>;

  const readOnly = form.status === "נעול";
  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px 12px",
    fontWeight: 800,
    background: readOnly ? "#f1f5f9" : "#fff",
    minHeight: 44,
  };
  const labelStyle: React.CSSProperties = {
    display: "grid",
    gap: 6,
    fontWeight: 900,
  };
  const cardStyle: React.CSSProperties = {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 16,
    background: "#fff",
    marginBottom: 14,
  };
  const setField = (key: string, value: string) =>
    setForm((prev: any) => ({ ...prev, [key]: value }));
  const selectedMaterial = String(form.workType ?? "");
  const showAsphaltForm = isAsphaltReference(selectedMaterial);
  const attachedDocs = normalizeRequiredDocuments(form.requiredDocuments);
  const referenceResults = ensureReferenceResultsForMaterial(
    selectedMaterial,
    form.referenceResults,
  );
  const showReferenceResultsTable = isMatzeaAReference(selectedMaterial) || isSelectedMaterialReference(selectedMaterial);

  const autoFillReferenceResultsFromFile = async (file: File) => {
    if (readOnly || !showReferenceResultsTable) return;
    try {
      const text = await extractTextFromReferenceFile(file);
      const parsedRows = parseReferenceCertificateResultsFromText(selectedMaterial, text);
      const filledRows = parsedRows.filter((row) => String(row.resultValue ?? "").trim());
      if (!filledRows.length) return;
      setForm((prev: any) => ({
        ...prev,
        referenceResults: ensureReferenceResultsForMaterial(prev.workType, prev.referenceResults).map((row) => {
          const parsed = parsedRows.find((item) => normalizeHebrewProjectName(item.metric) === normalizeHebrewProjectName(row.metric));
          return parsed?.resultValue ? applyReferenceQualityStatus({ ...row, resultValue: parsed.resultValue }) : row;
        }),
      }));
      alert(`נקלטו אוטומטית ${filledRows.length} ערכים מתוך התעודה. מומלץ לבדוק ולאשר לפני שמירה.`);
    } catch (error) {
      console.warn("Reference certificate auto parsing failed", error);
      alert("לא הצלחתי לקרוא אוטומטית את התעודה. ניתן להקליד את הערכים ידנית.");
    }
  };

  const updateReferenceResult = (id: string, patch: Partial<ReferenceResultRow>) => {
    if (readOnly) return;
    setForm((prev: any) => ({
      ...prev,
      referenceResults: ensureReferenceResultsForMaterial(
        prev.workType,
        prev.referenceResults,
      ).map((row) =>
        row.id === id ? applyReferenceQualityStatus({ ...row, ...patch }) : row,
      ),
    }));
  };

  const updateWorkType = (value: string) => {
    setForm((prev: any) => ({
      ...prev,
      workType: value,
      referenceResults: ensureReferenceResultsForMaterial(value, prev.referenceResults),
    }));
  };

  const updateDocument = (id: string, patch: Partial<RequiredDocument>) => {
    if (readOnly) return;
    setForm((prev: any) => ({
      ...prev,
      requiredDocuments: normalizeRequiredDocuments(prev.requiredDocuments).map(
        (doc) => (doc.id === id ? { ...doc, ...patch } : doc),
      ),
    }));
  };
  const attachDocument = async (id: string, file?: File) => {
    if (!file || readOnly) return;
    const maxSizeMb = 20;
    if (file.size > maxSizeMb * 1024 * 1024) {
      alert(`הקובץ גדול מדי. ניתן לצרף עד ${maxSizeMb}MB לקובץ.`);
      return;
    }

    const applyAttachment = (dataUrl: string) =>
      updateDocument(id, {
        attached: true,
        attachmentName: file.name,
        attachedAt: nowLocal(),
        attachmentDataUrl: dataUrl,
        attachmentType: file.type,
        required: false,
      });

    if (isSupabaseConfigured && supabase) {
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9.א-ת_-]/g, "_");
        const filePath = `control-processes/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
        const uploadResult = await supabase.storage
          .from("attachments")
          .upload(filePath, file, {
            upsert: false,
            contentType: file.type || undefined,
          });

        if (uploadResult.error) throw uploadResult.error;

        const { data } = supabase.storage
          .from("attachments")
          .getPublicUrl(filePath);
        applyAttachment(data.publicUrl);
        await autoFillReferenceResultsFromFile(file);
        return;
      } catch (error) {
        console.error("Control process document upload failed", error);
        alert("העלאת הקובץ ל-Supabase נכשלה. הקובץ יישמר מקומית בטופס.");
      }
    }

    const reader = new FileReader();
    reader.onload = async () => {
      applyAttachment(String(reader.result ?? ""));
      await autoFillReferenceResultsFromFile(file);
    };
    reader.onerror = () => alert("לא ניתן לקרוא את הקובץ שנבחר");
    reader.readAsDataURL(file);
  };
  const addDocument = (
    type: RequiredDocumentType = "אחר",
    description = "מסמך / צילום / תעודה",
  ) => {
    if (readOnly) return;
    setForm((prev: any) => ({
      ...prev,
      requiredDocuments: [
        ...normalizeRequiredDocuments(prev.requiredDocuments),
        {
          id: crypto.randomUUID(),
          type,
          description,
          required: false,
          attached: false,
        },
      ],
    }));
  };
  const removeDocument = (id: string) => {
    if (readOnly) return;
    setForm((prev: any) => ({
      ...prev,
      requiredDocuments: normalizeRequiredDocuments(
        prev.requiredDocuments,
      ).filter((doc) => doc.id !== id),
    }));
  };
  const toggleId = (
    field: "checklistIds" | "rfiIds" | "nonconformanceIds",
    id: string,
  ) => {
    if (readOnly) return;
    setForm((prev: any) => {
      const current = normalizeStringArray(prev[field]);
      return {
        ...prev,
        [field]: current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id],
      };
    });
  };

  const relevantChecklists = selectedMaterial
    ? checklists.filter((item) =>
        normalizeHebrewProjectName(
          [item.title, item.category, item.location, item.notes].join(" "),
        ).includes(normalizeHebrewProjectName(selectedMaterial).split(" ")[0]),
      )
    : checklists;

  return (
    <section>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 950 }}>
            בקרה מקדימה / תעודות ייחוס
          </h2>
          <div style={{ color: "#64748b", marginTop: 4 }}>
            בחר חומר או סוג עבודה, צרף תעודות/קבצים, וקשר את תעודת הייחוס
            לרשימות התיוג ובדיקות השטח הרלוונטיות.
          </div>
        </div>
        <div style={styles.buttonRow}>
          <button type="button" style={styles.secondaryBtn} onClick={onReset}>
            תעודת ייחוס חדשה
          </button>
          <button type="button" style={styles.primaryBtn} onClick={onSave}>
            {editingId ? "עדכון תעודה" : "שמירת תעודה"}
          </button>
          <button type="button" style={styles.dangerBtn} onClick={onLock}>
            אישור ונעילה
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, fontSize: 20, fontWeight: 950 }}>
          פרטי תעודת הייחוס
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <label style={labelStyle}>
            מס׳ תעודה / ר״ת
            <input
              disabled={readOnly}
              value={form.processNo ?? ""}
              onChange={(e) => setField("processNo", e.target.value)}
              placeholder="לדוגמה: REF-1"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            שם התעודה
            <input
              disabled={readOnly}
              value={form.title ?? ""}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="לדוגמה: אישור מצע א׳ / אישור תערובת אספלט"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            תחום / סוג עבודה
            <select
              disabled={readOnly}
              value={form.workType ?? ""}
              onChange={(e) => updateWorkType(e.target.value)}
              style={inputStyle}
            >
              <option value="">בחר חומר / סוג עבודה לאישור</option>
              {REFERENCE_MATERIAL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            סעיף מפרט / תקן
            <input
              disabled={readOnly}
              value={form.specSection ?? ""}
              onChange={(e) => setField("specSection", e.target.value)}
              placeholder="נת״י / משרד השיכון / ת״י / ASTM"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            מיקום / שימוש מיועד
            <input
              disabled={readOnly}
              value={form.location ?? ""}
              onChange={(e) => setField("location", e.target.value)}
              placeholder="כביש / קטע / שכבה / אלמנט"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            מחתך
            <input
              disabled={readOnly}
              value={form.fromSection ?? ""}
              onChange={(e) => setField("fromSection", e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            עד חתך
            <input
              disabled={readOnly}
              value={form.toSection ?? ""}
              onChange={(e) => setField("toSection", e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            סטטוס
            <select
              disabled={readOnly}
              value={form.status ?? "טיוטה"}
              onChange={(e) => setField("status", e.target.value)}
              style={inputStyle}
            >
              {CONTROL_PROCESS_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {showAsphaltForm ? (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, fontSize: 20, fontWeight: 950 }}>
            קביעת מערכת מרשל / תערובת אספלט
          </h3>
          <div style={{ color: "#475569", marginBottom: 12, lineHeight: 1.6 }}>
            חלק זה נפתח רק לאחר בחירת תחום אספלט. הנתונים ישמשו כייחוס לבדיקות
            דירוג, צפיפות, חללים ותכולת ביטומן.
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <label style={labelStyle}>
              סוג תערובת
              <input
                disabled={readOnly}
                value={form.asphaltMixType ?? ""}
                onChange={(e) => setField("asphaltMixType", e.target.value)}
                placeholder="לדוגמה: תא״מ 19 מ״מ"
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              שכבה
              <input
                disabled={readOnly}
                value={form.asphaltLayer ?? ""}
                onChange={(e) => setField("asphaltLayer", e.target.value)}
                placeholder="עליונה / מקשרת / תחתונה"
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              ספק / מפעל אספלט
              <input
                disabled={readOnly}
                value={form.supplier ?? ""}
                onChange={(e) => setField("supplier", e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              סוג ביטומן
              <input
                disabled={readOnly}
                value={form.bitumenGrade ?? ""}
                onChange={(e) => setField("bitumenGrade", e.target.value)}
                placeholder="PG70-10"
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              תכולת ביטומן אופטימלית %
              <input
                disabled={readOnly}
                value={form.optimumBitumen ?? ""}
                onChange={(e) => setField("optimumBitumen", e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              צפיפות מרשל / צפיפות ייחוס
              <input
                disabled={readOnly}
                value={form.referenceDensity ?? ""}
                onChange={(e) => setField("referenceDensity", e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              צפיפות תאורטית מקסימלית
              <input
                disabled={readOnly}
                value={form.maxTheoreticalDensity ?? ""}
                onChange={(e) =>
                  setField("maxTheoreticalDensity", e.target.value)
                }
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              אחוז חלל
              <input
                disabled={readOnly}
                value={form.airVoids ?? ""}
                onChange={(e) => setField("airVoids", e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              יציבות
              <input
                disabled={readOnly}
                value={form.stability ?? ""}
                onChange={(e) => setField("stability", e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              נזילות
              <input
                disabled={readOnly}
                value={form.flow ?? ""}
                onChange={(e) => setField("flow", e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              VMA
              <input
                disabled={readOnly}
                value={form.vma ?? ""}
                onChange={(e) => setField("vma", e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              מס׳ תעודת מעבדה
              <input
                disabled={readOnly}
                value={form.labCertificateNo ?? ""}
                onChange={(e) => setField("labCertificateNo", e.target.value)}
                style={inputStyle}
              />
            </label>
          </div>
        </div>
      ) : null}

      {showReferenceResultsTable ? (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, fontSize: 20, fontWeight: 950 }}>
            תוצאות הזמנה מפורטות - מצע א׳
          </h3>
          <div style={{ color: "#64748b", marginBottom: 12, lineHeight: 1.6 }}>
            מדד תוצאה, ערך מינימלי וערך מקסימלי קבועים. המשתמש מזין ערך
            תוצאה בלבד, וסטטוס האיכות מחושב אוטומטית לפי ערך מינימלי ומקסימלי.
          </div>
          <div style={{ ...styles.buttonRow, marginBottom: 12 }}>
            <button type="button" style={styles.primaryBtn} onClick={onSave} disabled={readOnly}>
              שמור תוצאות
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ border: "1px solid #cbd5e1", padding: 8 }}>מדד תוצאה</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: 8 }}>ערך תוצאה</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: 8 }}>סטטוס איכות</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: 8 }}>ערך מינימלי</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: 8 }}>ערך מקסימלי</th>
                </tr>
              </thead>
              <tbody>
                {referenceResults.map((row) => (
                  <tr key={row.id}>
                    <td style={{ border: "1px solid #cbd5e1", padding: 8, fontWeight: 900, background: "#f8fafc" }}>
                      {row.metric}
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>
                      <input
                        disabled={readOnly}
                        value={row.resultValue}
                        onChange={(e) => updateReferenceResult(row.id, { resultValue: e.target.value })}
                        style={inputStyle}
                      />
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>
                      <input
                        disabled
                        value={row.qualityStatus}
                        placeholder="מחושב אוטומטית"
                        style={{
                          ...inputStyle,
                          background: row.qualityStatus === "לא תקין" ? "#fee2e2" : row.qualityStatus === "תקין" ? "#dcfce7" : "#f8fafc",
                          color: row.qualityStatus === "לא תקין" ? "#991b1b" : "#166534",
                        }}
                      />
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 8, fontWeight: 900, background: "#f8fafc" }}>
                      {row.minValue}
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 8, fontWeight: 900, background: "#f8fafc" }}>
                      {row.maxValue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            marginBottom: 10,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 950 }}>
              קבצים, תעודות ותמונות לתעודת הייחוס
            </h3>
            <div style={{ color: "#64748b", marginTop: 4 }}>
              כאן מצרפים תעודות מעבדה, אישורי מתכנן, תמונות, PDF, Word, Excel
              וכל מסמך רלוונטי לחומר שנבחר.
            </div>
          </div>
          <div style={styles.buttonRow}>
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() =>
                addDocument("תעודת מעבדה", "תעודת מעבדה / בדיקת ייחוס")
              }
              disabled={readOnly}
            >
              הוסף תעודה
            </button>
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() =>
                addDocument("צילום", "צילום / תמונת שטח / סימון מקור חומר")
              }
              disabled={readOnly}
            >
              הוסף צילום
            </button>
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => addDocument("אחר", "מסמך נוסף")}
              disabled={readOnly}
            >
              הוסף מסמך
            </button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #cbd5e1", padding: 8 }}>סוג</th>
                <th style={{ border: "1px solid #cbd5e1", padding: 8 }}>
                  תיאור
                </th>
                <th style={{ border: "1px solid #cbd5e1", padding: 8 }}>
                  קובץ
                </th>
                <th style={{ border: "1px solid #cbd5e1", padding: 8 }}>
                  פעולה
                </th>
              </tr>
            </thead>
            <tbody>
              {attachedDocs.length ? (
                attachedDocs.map((doc) => (
                  <tr key={doc.id}>
                    <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>
                      <select
                        disabled={readOnly}
                        value={doc.type}
                        onChange={(e) =>
                          updateDocument(doc.id, {
                            type: e.target.value as RequiredDocumentType,
                          })
                        }
                        style={inputStyle}
                      >
                        {REQUIRED_DOCUMENT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>
                      <input
                        disabled={readOnly}
                        value={doc.description}
                        onChange={(e) =>
                          updateDocument(doc.id, {
                            description: e.target.value,
                          })
                        }
                        style={inputStyle}
                      />
                    </td>
                    <td
                      style={{
                        border: "1px solid #cbd5e1",
                        padding: 8,
                        fontWeight: 900,
                      }}
                    >
                      {doc.attached ? (
                        doc.attachmentDataUrl ? (
                          <a
                            href={doc.attachmentDataUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "#0369a1",
                              textDecoration: "underline",
                            }}
                          >
                            📎 {doc.attachmentName || "פתח קובץ"}
                          </a>
                        ) : (
                          `✅ ${doc.attachmentName || "צורף"}`
                        )
                      ) : (
                        "טרם צורף קובץ"
                      )}
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>
                      <label
                        style={{
                          ...styles.secondaryBtn,
                          display: "inline-flex",
                          cursor: readOnly ? "not-allowed" : "pointer",
                        }}
                      >
                        צרף / החלף
                        <input
                          disabled={readOnly}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            attachDocument(doc.id, e.target.files?.[0]);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        style={{ ...styles.dangerBtn, marginRight: 6 }}
                        onClick={() => removeDocument(doc.id)}
                        disabled={readOnly}
                      >
                        מחיקה
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: 18,
                      textAlign: "center",
                      color: "#64748b",
                    }}
                  >
                    טרם נוספו קבצים לתעודת הייחוס.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, fontSize: 20, fontWeight: 950 }}>
          קישור לרשימות תיוג ובדיקות שטח
        </h3>
        <div style={{ color: "#475569", marginBottom: 12 }}>
          בחר לאילו רשימות תיוג ובדיקות שטח תעודת הייחוס הזו שייכת. לדוגמה:
          תעודת ייחוס של מצע א׳ תקושר לרשימת תיוג פיזור/הידוק מצע א׳ ולבדיקות
          צפיפות־רטיבות המתייחסות אליה.
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>
              רשימות תיוג רלוונטיות
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {(relevantChecklists.length ? relevantChecklists : checklists)
                .length ? (
                (relevantChecklists.length
                  ? relevantChecklists
                  : checklists
                ).map((item) => (
                  <label
                    key={item.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: 8,
                    }}
                  >
                    <input
                      disabled={readOnly}
                      type="checkbox"
                      checked={normalizeStringArray(form.checklistIds).includes(
                        item.id,
                      )}
                      onChange={() => toggleId("checklistIds", item.id)}
                    />{" "}
                    {item.checklistNo ? `#${item.checklistNo} · ` : ""}
                    {item.title} · {item.location}
                  </label>
                ))
              ) : (
                <div style={styles.emptyBox}>אין עדיין רשימות תיוג בפרויקט</div>
              )}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>
              RFI / אישורי מתכנן
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {rfis.length ? (
                rfis.map((item) => (
                  <label
                    key={item.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: 8,
                    }}
                  >
                    <input
                      disabled={readOnly}
                      type="checkbox"
                      checked={normalizeStringArray(form.rfiIds).includes(
                        item.id,
                      )}
                      onChange={() => toggleId("rfiIds", item.id)}
                    />{" "}
                    {item.title} · {item.status}
                  </label>
                ))
              ) : (
                <div style={styles.emptyBox}>אין עדיין RFI בפרויקט</div>
              )}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>
              אי־התאמות / חריגות
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {nonconformances.length ? (
                nonconformances.map((item) => (
                  <label
                    key={item.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: 8,
                    }}
                  >
                    <input
                      disabled={readOnly}
                      type="checkbox"
                      checked={normalizeStringArray(
                        form.nonconformanceIds,
                      ).includes(item.id)}
                      onChange={() => toggleId("nonconformanceIds", item.id)}
                    />{" "}
                    {item.title} · {item.status}
                  </label>
                ))
              ) : (
                <div style={styles.emptyBox}>אין עדיין אי־התאמות בפרויקט</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, fontSize: 20, fontWeight: 950 }}>
          תעודות ייחוס שנשמרו
        </h3>
        <div style={{ display: "grid", gap: 8 }}>
          {savedProcesses.length ? (
            savedProcesses.map((process) => (
              <div
                key={process.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 14,
                  padding: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 950 }}>
                    {process.processNo} · {process.title}
                  </div>
                  <div style={{ color: "#64748b", marginTop: 4 }}>
                    {process.workType || "תחום לא הוזן"} ·{" "}
                    {process.location || "שימוש מיועד לא הוזן"} · סטטוס:{" "}
                    {process.status}
                  </div>
                </div>
                <div style={styles.buttonRow}>
                  <button
                    type="button"
                    style={styles.secondaryBtn}
                    onClick={() => onLoad(process)}
                  >
                    פתח
                  </button>
                  <button
                    type="button"
                    style={styles.dangerBtn}
                    onClick={() => onDelete(process.id)}
                  >
                    מחק
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={styles.emptyBox}>טרם נשמרו תעודות ייחוס בפרויקט.</div>
          )}
        </div>
      </div>
    </section>
  );
}


type ProjectUsersSectionProps = {
  guardedBody: React.ReactNode;
  projectName: string;
  users: ProjectEmailUser[];
  onAddUser: (user: Omit<ProjectEmailUser, "id" | "projectId" | "createdAt">) => void;
  onUpdateUser: (id: string, patch: Partial<ProjectEmailUser>) => void;
  onDeleteUser: (id: string) => void;
  onSaveUsers: () => void;
};

function ProjectUsersSection({ guardedBody, projectName, users, onAddUser, onUpdateUser, onDeleteUser, onSaveUsers }: ProjectUsersSectionProps) {
  const [draft, setDraft] = useState({ name: "", role: "", company: "", email: "", phone: "", active: true });
  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "9px 10px",
    font: "inherit",
    boxSizing: "border-box",
    background: "#fff",
  };

  const add = () => {
    const email = draft.email.trim();
    if (!draft.name.trim()) return alert("יש להזין שם משתמש / נמען");
    if (!isValidEmailAddress(email)) return alert("כתובת המייל אינה תקינה");
    onAddUser({ ...draft, email, active: true });
    setDraft({ name: "", role: "", company: "", email: "", phone: "", active: true });
  };

  return (
    <section style={styles.section}>
      {guardedBody ?? (
        <>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={{ margin: 0 }}>משתמשים / נמענים לפרויקט</h2>
              <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.6 }}>
                רשימה זו שייכת לפרויקט {projectName}. בעת שליחת מייל מהפרויקט ניתן לבחור מתוכה נמען אחד או כמה נמענים.
              </p>
            </div>
            <button type="button" onClick={onSaveUsers} style={styles.primaryBtn}>
              שמור משתמשים
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, border: "1px solid #e2e8f0", borderRadius: 16, padding: 14, background: "#fff", marginBottom: 16 }}>
            <input placeholder="שם" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} style={inputStyle} />
            <input placeholder="תפקיד" value={draft.role} onChange={(e) => setDraft((p) => ({ ...p, role: e.target.value }))} style={inputStyle} />
            <input placeholder="חברה" value={draft.company} onChange={(e) => setDraft((p) => ({ ...p, company: e.target.value }))} style={inputStyle} />
            <input placeholder="מייל" value={draft.email} onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))} style={inputStyle} />
            <input placeholder="טלפון" value={draft.phone} onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))} style={inputStyle} />
            <button type="button" onClick={add} style={styles.primaryBtn}>הוסף משתמש</button>
          </div>
          <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 850 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["פעיל", "שם", "תפקיד", "חברה", "מייל", "טלפון", "פעולות"].map((label) => (
                    <th key={label} style={{ borderBottom: "1px solid #e2e8f0", padding: 10, textAlign: "right" }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.length ? users.map((user) => (
                  <tr key={user.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}><input type="checkbox" checked={user.active} onChange={(e) => onUpdateUser(user.id, { active: e.target.checked })} /></td>
                    <td style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}><input value={user.name} onChange={(e) => onUpdateUser(user.id, { name: e.target.value })} style={inputStyle} /></td>
                    <td style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}><input value={user.role} onChange={(e) => onUpdateUser(user.id, { role: e.target.value })} style={inputStyle} /></td>
                    <td style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}><input value={user.company} onChange={(e) => onUpdateUser(user.id, { company: e.target.value })} style={inputStyle} /></td>
                    <td style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}><input value={user.email} onChange={(e) => onUpdateUser(user.id, { email: e.target.value.trim() })} style={inputStyle} /></td>
                    <td style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}><input value={user.phone || ""} onChange={(e) => onUpdateUser(user.id, { phone: e.target.value })} style={inputStyle} /></td>
                    <td style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}><button type="button" style={styles.dangerBtn} onClick={() => onDeleteUser(user.id)}>מחק</button></td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} style={{ padding: 18, textAlign: "center", color: "#64748b" }}>טרם הוגדרו משתמשים לפרויקט זה.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}



const getReferenceRowValue = (row: any, keys: string[]): string => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return "";
};


const MATZEA_A_EXCEL_RESULT_COLUMNS = [
  { metric: '3"', label: '3"' },
  { metric: '1.5"', label: '1.5"' },
  { metric: '1"', label: '1"' },
  { metric: '3/4"', label: '3/4"' },
  { metric: '#4', label: '#4' },
  { metric: '#10', label: '#10' },
  { metric: '#40', label: '#40' },
  { metric: '#200', label: '#200' },
  { metric: 'גבול נזילות (LL)', label: 'LL' },
  { metric: 'גבול פלסטיות (PL)', label: 'PL' },
  { metric: 'אינדקס פלסטיות (PI)', label: 'PI' },
  { metric: 'שווה ערך חול', label: 'שווה ערך חול' },
  { metric: 'צפיפות מכשירית', label: 'צפיפות מכשירית' },
  { metric: 'רטיבות מחושבת', label: 'רטיבות מחושבת' },
  { metric: 'ספיגות (G)', label: 'ספיגות' },
  { metric: 'לוס אנג\'לס', label: 'לוס אנג\'לס' },
];

const buildMatzeaAConcentrationRows = (processes: ControlProcessRecord[]) =>
  processes
    .filter((process) => isMatzeaAReference(process.workType))
    .map((process, index) => {
      const results = ensureReferenceResultsForMaterial(process.workType, process.referenceResults);
      const byMetric = new Map(results.map((row) => [String(row.metric), row]));
      const valueOf = (metric: string) => String(byMetric.get(metric)?.resultValue ?? '').trim();
      const statusOf = (metric: string) => {
        const row = byMetric.get(metric);
        return row ? (row.qualityStatus || calculateReferenceQualityStatus(row.resultValue, row.minValue, row.maxValue)) : '';
      };
      const anyValue = results.some((row) => String(row.resultValue ?? '').trim());
      if (!anyValue) return null;
      return {
        id: process.id,
        serial: index + 1,
        processNo: process.processNo,
        title: process.title,
        date: process.savedAt,
        workType: process.workType,
        source: valueOf('תיאור החומר') || process.location || '',
        sampleLocation: valueOf('מקום הדגם לבדיקה') || process.location || '',
        structure: valueOf('מבנה') || '',
        certificateNo: valueOf('מספר תעודת מעבדה') || process.processNo || '',
        certificateDate: valueOf('תאריך') || process.savedAt || '',
        aashto: valueOf('דירוג AASHTO מיין') || valueOf('מיין AASHTO'),
        materialDescription: valueOf('תיאור החומר'),
        rows: MATZEA_A_EXCEL_RESULT_COLUMNS.map((column) => ({
          ...column,
          value: valueOf(column.metric),
          status: statusOf(column.metric),
          minValue: String(byMetric.get(column.metric)?.minValue ?? ''),
          maxValue: String(byMetric.get(column.metric)?.maxValue ?? ''),
        })),
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      serial: number;
      processNo: string;
      title: string;
      date: string;
      workType: string;
      source: string;
      sampleLocation: string;
      structure: string;
      certificateNo: string;
      certificateDate: string;
      aashto: string;
      materialDescription: string;
      rows: Array<{ metric: string; label: string; value: string; status: string; minValue: string; maxValue: string }>;
    }>;

const escapeExcelHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function MatzeaAConcentrationFromReferences({
  processes,
}: {
  processes: ControlProcessRecord[];
}) {
  const rows = buildMatzeaAConcentrationRows(processes);
  if (!rows.length) return null;

  const downloadExcel = () => {
    const headerStyle = 'border:1px solid #1f2937;background:#fff59d;font-weight:bold;text-align:center;vertical-align:middle;mso-number-format:\"\\@\";';
    const greenStyle = 'border:1px solid #1f2937;background:#c6e0b4;font-weight:bold;text-align:center;vertical-align:middle;mso-number-format:\"\\@\";';
    const cellStyle = 'border:1px solid #1f2937;text-align:center;vertical-align:middle;mso-number-format:\"\\@\";';
    const htmlRows = rows.map((row) => `
      <tr>
        <td style="${cellStyle}">${escapeExcelHtml(row.serial)}</td>
        <td style="${cellStyle}">${escapeExcelHtml(row.processNo)}</td>
        <td style="${cellStyle}">${escapeExcelHtml(row.certificateDate)}</td>
        <td style="${cellStyle}">${escapeExcelHtml(row.source)}</td>
        <td style="${cellStyle}">${escapeExcelHtml(row.sampleLocation)}</td>
        <td style="${cellStyle}">${escapeExcelHtml(row.structure)}</td>
        <td style="${cellStyle}">${escapeExcelHtml(row.aashto)}</td>
        ${row.rows.map((item) => `<td style="${cellStyle}">${escapeExcelHtml(item.value)}</td>`).join('')}
        <td style="${cellStyle}">${escapeExcelHtml(row.materialDescription)}</td>
        <td style="${cellStyle}">${escapeExcelHtml(row.title)}</td>
      </tr>`).join('');
    const html = `﻿<!doctype html><html><head><meta charset="utf-8"></head><body dir="rtl"><table>
      <tr><th colspan="${10 + MATZEA_A_EXCEL_RESULT_COLUMNS.length}" style="border:1px solid #1f2937;background:#d9ead3;font-size:16px;font-weight:bold;text-align:center;">ריכוז אפיון מצע א׳</th></tr>
      <tr>
        <th style="${headerStyle}">מס׳ סידורי</th>
        <th style="${headerStyle}">מס׳ תעודה / רשומה</th>
        <th style="${headerStyle}">תאריך</th>
        <th style="${headerStyle}">מקור החומר</th>
        <th style="${headerStyle}">מקום הדגם לבדיקה</th>
        <th style="${headerStyle}">מבנה</th>
        <th style="${headerStyle}">מיין AASHTO</th>
        ${MATZEA_A_EXCEL_RESULT_COLUMNS.map((column) => `<th style="${greenStyle}">${escapeExcelHtml(column.label)}</th>`).join('')}
        <th style="${headerStyle}">תיאור החומר</th>
        <th style="${headerStyle}">כותרת</th>
      </tr>
      ${htmlRows}
    </table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'subbase-a-concentration.xls';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const tableHeaderStyle: React.CSSProperties = {
    border: '1px solid #1f2937',
    padding: '8px 6px',
    textAlign: 'center',
    background: '#fef3c7',
    fontWeight: 900,
    whiteSpace: 'nowrap',
  };
  const greenHeaderStyle: React.CSSProperties = {
    ...tableHeaderStyle,
    background: '#bbf7d0',
  };
  const cellStyle: React.CSSProperties = {
    border: '1px solid #334155',
    padding: '8px 6px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    background: '#fff',
  };

  return (
    <section style={{ ...styles.card, marginBottom: 24 }} dir="rtl">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>ריכוז אפיון מצע א׳</h2>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontWeight: 700 }}>
            ריכוז מובנה בפורמט Excel מתוך התוצאות שנשמרו בבקרה מקדימה / תעודות ייחוס.
          </p>
        </div>
        <button type="button" style={styles.primaryBtn} onClick={downloadExcel}>
          הורד ריכוז Excel
        </button>
      </div>

      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1500, direction: 'rtl' }}>
          <thead>
            <tr>
              <th colSpan={10 + MATZEA_A_EXCEL_RESULT_COLUMNS.length} style={{ border: '1px solid #1f2937', padding: 10, background: '#dcfce7', textAlign: 'center', fontWeight: 950 }}>
                דוח ריכוז בדיקות אפיון למצע סוג א׳
              </th>
            </tr>
            <tr>
              <th style={tableHeaderStyle}>מס׳ סידורי</th>
              <th style={tableHeaderStyle}>מס׳ תעודה / רשומה</th>
              <th style={tableHeaderStyle}>תאריך</th>
              <th style={tableHeaderStyle}>מקור החומר</th>
              <th style={tableHeaderStyle}>מקום הדגם לבדיקה</th>
              <th style={tableHeaderStyle}>מבנה</th>
              <th style={tableHeaderStyle}>מיין AASHTO</th>
              {MATZEA_A_EXCEL_RESULT_COLUMNS.map((column) => (
                <th key={column.metric} style={greenHeaderStyle}>{column.label}</th>
              ))}
              <th style={tableHeaderStyle}>תיאור החומר</th>
              <th style={tableHeaderStyle}>כותרת</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={cellStyle}>{row.serial}</td>
                <td style={cellStyle}>{row.processNo}</td>
                <td style={cellStyle}>{row.certificateDate}</td>
                <td style={cellStyle}>{row.source}</td>
                <td style={cellStyle}>{row.sampleLocation}</td>
                <td style={cellStyle}>{row.structure}</td>
                <td style={cellStyle}>{row.aashto}</td>
                {row.rows.map((item) => (
                  <td key={`${row.id}-${item.metric}`} style={{ ...cellStyle, fontWeight: item.status === 'לא תקין' ? 900 : 700, color: item.status === 'לא תקין' ? '#b91c1c' : '#111827' }}>
                    {item.value}
                  </td>
                ))}
                <td style={cellStyle}>{row.materialDescription}</td>
                <td style={cellStyle}>{row.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Page() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // אין רענון אוטומטי בזמן עבודה כדי לא למחוק נתונים שהוזנו בטופס.
    // בעת רענון ידני רגיל של הדף הדפדפן מתבקש למשוך את הגרסה העדכנית.
    [
      ["Cache-Control", "no-cache, no-store, must-revalidate"],
      ["Pragma", "no-cache"],
      ["Expires", "0"],
    ].forEach(([httpEquiv, content]) => {
      const selector = `meta[http-equiv="${httpEquiv}"]`;
      const existing = document.head.querySelector<HTMLMetaElement>(selector);
      const meta = existing ?? document.createElement("meta");
      meta.httpEquiv = httpEquiv;
      meta.content = content;
      if (!existing) document.head.appendChild(meta);
    });

    window.localStorage.setItem(APP_VERSION_STORAGE_KEY, APP_VERSION);
  }, []);
  const [section, setSection] = useState<AppSection>("home");
  const [selectedChecklistTemplateKey, setSelectedChecklistTemplateKey] =
    useState<ChecklistTemplateKey>(() => normalizeChecklistTemplateKey(undefined));
  const [preliminaryTab, setPreliminaryTab] =
    useState<PreliminaryTab>("suppliers");
  const [projects, setProjects] = useState<Project[]>(getDefaultProjectList());
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(
    readLocalCurrentProjectId() ?? getDefaultProjectList()[0]?.id ?? null,
  );
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectManager, setNewProjectManager] = useState("");
  const [checklistForm, setChecklistForm] = useState(createDefaultChecklist());
  const [nonconformanceForm, setNonconformanceForm] = useState(
    createDefaultNonconformance(),
  );
  const [trialSectionForm, setTrialSectionForm] = useState(
    createDefaultTrialSection(),
  );
  const [supplierPreliminaryForm, setSupplierPreliminaryForm] = useState(
    createDefaultPreliminary("suppliers"),
  );
  const [subcontractorPreliminaryForm, setSubcontractorPreliminaryForm] =
    useState(createDefaultPreliminary("subcontractors"));
  const [materialPreliminaryForm, setMaterialPreliminaryForm] = useState(
    createDefaultPreliminary("materials"),
  );
  const [savedChecklists, setSavedChecklists] = useState<ChecklistRecord[]>([]);
  const [savedNonconformances, setSavedNonconformances] = useState<
    NonconformanceRecord[]
  >([]);
  const [savedTrialSections, setSavedTrialSections] = useState<
    TrialSectionRecord[]
  >([]);
  const [savedPreliminary, setSavedPreliminary] = useState<PreliminaryRecord[]>(
    [],
  );
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(
    null,
  );
  const [editingNonconformanceId, setEditingNonconformanceId] = useState<
    string | null
  >(null);
  const [editingTrialSectionId, setEditingTrialSectionId] = useState<
    string | null
  >(null);
  const [editingPreliminaryId, setEditingPreliminaryId] = useState<
    string | null
  >(null);
  const [recordsSearchTerm, setRecordsSearchTerm] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cloudEnabled, setCloudEnabled] = useState(isSupabaseConfigured);
  const [authReady, setAuthReady] = useState(false);
  const [projectAccess, setProjectAccess] = useState<ProjectAccess | null>(
    null,
  );
  const [accessUsers, setAccessUsers] = useState<ProjectAccess[]>(
    DEFAULT_PROJECT_ACCESS_LIST,
  );
  const [draftAccessUsers, setDraftAccessUsers] = useState<ProjectAccess[]>(
    DEFAULT_PROJECT_ACCESS_LIST,
  );
  const [accessUsersDirty, setAccessUsersDirty] = useState(false);
  const [projectLegends, setProjectLegends] = useState<
    Record<string, ProjectLegend>
  >({});
  const [draftProjectLegends, setDraftProjectLegends] = useState<
    Record<string, ProjectLegend>
  >({});
  const [editingProjectLegend, setEditingProjectLegend] = useState(false);
  const [projectLegendDirty, setProjectLegendDirty] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [loginCode, setLoginCode] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [savedRfis, setSavedRfis] = useState<RfiRecord[]>([]);
  const [rfiForm, setRfiForm] = useState(createDefaultRfi());
  const [editingRfiId, setEditingRfiId] = useState<string | null>(null);
  const [savedControlProcesses, setSavedControlProcesses] = useState<
    ControlProcessRecord[]
  >([]);
  const [controlProcessForm, setControlProcessForm] = useState(
    createDefaultControlProcess(),
  );
  const [editingControlProcessId, setEditingControlProcessId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedLegends = window.localStorage.getItem(
        PROJECT_LEGEND_STORAGE_KEY,
      );
      const parsedLegends = migrateProjectLegendMap(
        storedLegends ? JSON.parse(storedLegends) : {},
      );
      setProjectLegends(parsedLegends);
      setDraftProjectLegends(parsedLegends);
      window.localStorage.setItem(
        PROJECT_LEGEND_STORAGE_KEY,
        JSON.stringify(parsedLegends),
      );
    } catch {
      setProjectLegends({});
      setDraftProjectLegends({});
    }

    // טעינת פרטי פרויקט מהענן. כך פרטי הפרויקט לא נעלמים בכניסה חוזרת/מחשב אחר.
    if (isSupabaseConfigured && supabase) {
      void loadProjectLegendsFromSupabase().then((cloudLegends) => {
        if (!cloudLegends || !Object.keys(cloudLegends).length) return;
        setProjectLegends((prev) => {
          const merged = migrateProjectLegendMap({ ...prev, ...cloudLegends });
          try {
            window.localStorage.setItem(
              PROJECT_LEGEND_STORAGE_KEY,
              JSON.stringify(merged),
            );
          } catch {}
          return merged;
        });
        setDraftProjectLegends((prev) =>
          migrateProjectLegendMap({ ...prev, ...cloudLegends }),
        );
      });
    }

    try {
      const storedRfis = window.localStorage.getItem(RFI_STORAGE_KEY);
      const parsedRfis = storedRfis ? JSON.parse(storedRfis) : [];
      setSavedRfis(
        Array.isArray(parsedRfis)
          ? (parsedRfis.map(normalizeRfiRecord).filter(Boolean) as RfiRecord[])
          : [],
      );
    } catch {
      setSavedRfis([]);
    }
    try {
      const storedProcesses = window.localStorage.getItem(
        CONTROL_PROCESS_STORAGE_KEY,
      );
      const parsedProcesses = storedProcesses
        ? JSON.parse(storedProcesses)
        : [];
      setSavedControlProcesses(
        Array.isArray(parsedProcesses)
          ? (parsedProcesses
              .map(normalizeControlProcess)
              .filter(Boolean) as ControlProcessRecord[])
          : [],
      );
    } catch {
      setSavedControlProcesses([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const projectCodeFromLink = params.get("project");
    let cancelled = false;

    const loadUsers = async () => {
      let users = DEFAULT_PROJECT_ACCESS_LIST;
      const cloudUsers = await loadAccessUsersFromSupabase();
      if (cloudUsers?.length) {
        users = cloudUsers;
      } else {
        try {
          const storedUsers = window.localStorage.getItem(
            ACCESS_USERS_STORAGE_KEY,
          );
          users = storedUsers
            ? normalizeProjectAccessList(JSON.parse(storedUsers))
            : DEFAULT_PROJECT_ACCESS_LIST;
        } catch {
          users = DEFAULT_PROJECT_ACCESS_LIST;
        }
      }

      if (cancelled) return;
      setAccessUsers(users);
      setDraftAccessUsers(users);

      // שומרים התחברות פעילה עד 10 דקות חוסר פעילות.
      // רענון דף בתוך הטווח לא מנתק את המשתמש.
      const storedSession = readStoredAuthSession();
      const storedUser = findUserForStoredSession(users, storedSession);
      if (storedUser) {
        setProjectAccess(storedUser);
        refreshAuthSession();
        setLoginPassword("");
        setLoginError("");
      } else {
        setProjectAccess(null);
        setLoginPassword("");
        setLoginError("");
      }

      if (projectCodeFromLink) setLoginCode(projectCodeFromLink);

      setAuthReady(true);
    };

    loadUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !projectAccess) return;

    const refresh = () => refreshAuthSession();
    const events: Array<keyof WindowEventMap> = [
      "click",
      "keydown",
      "mousemove",
      "scroll",
      "focus",
    ];
    events.forEach((eventName) => window.addEventListener(eventName, refresh));
    const timer = window.setInterval(refresh, 60 * 1000);

    refresh();

    return () => {
      events.forEach((eventName) =>
        window.removeEventListener(eventName, refresh),
      );
      window.clearInterval(timer);
    };
  }, [projectAccess]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RFI_STORAGE_KEY, JSON.stringify(savedRfis));
  }, [savedRfis]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      CONTROL_PROCESS_STORAGE_KEY,
      JSON.stringify(savedControlProcesses),
    );
  }, [savedControlProcesses]);

  const handleProjectLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const access = findProjectAccessByCredentials(
      accessUsers,
      loginCode,
      loginPassword,
    );
    if (!access) {
      setLoginError("שם משתמש או סיסמה אינם נכונים");
      return;
    }
    setLoginError("");
    setProjectAccess(access);
    writeAuthSession(access);
    setSection("home");
  };

  const logoutProject = () => {
    if (typeof window !== "undefined")
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setProjectAccess(null);
    setLoginPassword("");
    setLoginError("");
    setSection("home");
  };

  const persistAccessUsers = async (nextUsers: ProjectAccess[]) => {
    const normalized = normalizeProjectAccessList(nextUsers);

    if (isSupabaseConfigured) {
      await saveAccessUsersToSupabase(normalized);
    } else if (typeof window !== "undefined") {
      window.localStorage.setItem(
        ACCESS_USERS_STORAGE_KEY,
        JSON.stringify(normalized),
      );
    }

    setAccessUsers(normalized);
    setDraftAccessUsers(normalized);
    setAccessUsersDirty(false);

    if (projectAccess) {
      const updatedCurrentUser = normalized.find(
        (user) =>
          user.username === projectAccess.username ||
          user.code === projectAccess.code ||
          (projectAccess.role === "admin" && user.role === "admin"),
      );
      if (updatedCurrentUser) setProjectAccess(updatedCurrentUser);
    }
  };

  const updateAccessUser = (
    index: number,
    field: keyof ProjectAccess,
    value: string,
  ) => {
    setDraftAccessUsers((prevUsers) =>
      prevUsers.map((user, userIndex) => {
        if (userIndex !== index) return user;
        const updated: ProjectAccess = {
          ...user,
          [field]: value,
        } as ProjectAccess;
        if (field === "role" && value === "admin") updated.projectName = null;
        if (field === "role" && value === "user" && !updated.projectName)
          updated.projectName = projects[0]?.name ?? "";
        return updated;
      }),
    );
    setAccessUsersDirty(true);
  };

  const approveAccessUsersChanges = async () => {
    try {
      await persistAccessUsers(draftAccessUsers);
      alert(
        isSupabaseConfigured
          ? "השינויים נשמרו בהצלחה ב-Supabase"
          : "השינויים נשמרו בהצלחה בדפדפן",
      );
    } catch (error) {
      console.error("Failed to save access users", error);
      alert(`שגיאה בשמירת המשתמשים: ${errorText(error)}`);
    }
  };

  const cancelAccessUsersChanges = () => {
    setDraftAccessUsers(accessUsers);
    setAccessUsersDirty(false);
  };

  const addAccessUser = () => {
    setDraftAccessUsers((prevUsers) => [
      ...prevUsers,
      {
        username: `user${prevUsers.length + 1}`,
        password: "1234",
        displayName: `משתמש ${prevUsers.length + 1}`,
        role: "user",
        code: String(prevUsers.length + 1),
        projectName: projects[0]?.name ?? "",
        signatureDataUrl: "",
        signatureFileName: "",
      },
    ]);
    setAccessUsersDirty(true);
  };

  const removeAccessUser = (index: number) => {
    const user = draftAccessUsers[index];
    if (!user || user.role === "admin") return;
    if (!window.confirm(`למחוק את המשתמש "${user.displayName}"?`)) return;
    setDraftAccessUsers((prevUsers) =>
      prevUsers.filter((_, userIndex) => userIndex !== index),
    );
    setAccessUsersDirty(true);
  };

  const uploadUserSignature = (index: number, file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setDraftAccessUsers((prevUsers) =>
        prevUsers.map((user, userIndex) =>
          userIndex === index
            ? {
                ...user,
                signatureDataUrl: String(reader.result ?? ""),
                signatureFileName: file.name,
              }
            : user,
        ),
      );
      setAccessUsersDirty(true);
    };
    reader.onerror = () => alert("לא ניתן לקרוא את קובץ החתימה/חותמת");
    reader.readAsDataURL(file);
  };

  const savedSignatureForSigner = (signerName: string, role?: string) => {
    if ((isRoad806Value(currentProjectId) || isRoad806Value(projectName)) && (isSurveyorRole(role) || isSurveyorRole(signerName))) {
      return ROAD_806_SURVEYOR_SIGNATURE_URL;
    }
    const normalizedName = normalizeAccessValue(signerName);
    const normalizedRole = normalizeAccessValue(role);
    const found = accessUsers.find((user) => {
      const names = [user.displayName, user.username, user.code].map(
        normalizeAccessValue,
      );
      return (
        Boolean(user.signatureDataUrl) &&
        ((!!normalizedName && names.includes(normalizedName)) ||
          (!!normalizedRole &&
            names.some(
              (name) =>
                normalizedRole.includes(name) || name.includes(normalizedRole),
            )))
      );
    });
    return found?.signatureDataUrl ?? "";
  };

  const resetAccessUsersToDefaults = () => {
    if (!window.confirm("לאפס את רשימת המשתמשים לברירת המחדל?")) return;
    setDraftAccessUsers(DEFAULT_PROJECT_ACCESS_LIST);
    setAccessUsersDirty(true);
  };

  const loadPersistedData = (raw: string | null) => {
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as PersistedData;
      const fallbackProjects = getDefaultProjectList();
      const loadedProjects = parsed.projects?.length
        ? parsed.projects
        : fallbackProjects;
      setProjects(
        loadedProjects.map((project) => ({
          ...project,
          id: normalizeStoredProjectId(project.id),
        })),
      );
      setCurrentProjectId(
        normalizeStoredProjectId(
          parsed.currentProjectId ??
            loadedProjects[0]?.id ??
            fallbackProjects[0]?.id ??
            null,
        ),
      );
      setSavedChecklists(
        (parsed.savedChecklists ?? []).map((item) => ({
          ...item,
          projectId: normalizeStoredProjectId((item as any).projectId),
          templateKey: normalizeChecklistTemplateKey(item.templateKey),
          items: normalizeChecklistItems(item.items),
          approval: normalizeApproval((item as any).approval),
        })),
      );
      setSavedNonconformances(
        (parsed.savedNonconformances ?? []).map((item) => ({
          ...item,
          projectId: normalizeStoredProjectId((item as any).projectId),
          approval: normalizeApproval((item as any).approval),
        })),
      );
      setSavedTrialSections(
        (parsed.savedTrialSections ?? []).map((item) => ({
          ...item,
          projectId: normalizeStoredProjectId((item as any).projectId),
          approval: normalizeApproval((item as any).approval),
        })),
      );
      setSavedPreliminary(
        (parsed.savedPreliminary ?? []).map((item) => ({
          ...item,
          projectId: normalizeStoredProjectId((item as any).projectId),
          approval: normalizeApproval((item as any).approval),
        })),
      );
    } catch (error) {
      console.error("Failed to parse local saved data", error);
    }
  };

  const loadFromCloudResults = (
    projectsRows: any[] | null,
    checklistRows: any[] | null,
    nonconRows: any[] | null,
    trialRows: any[] | null,
    preliminaryRows: any[] | null,
    rfiRows: any[] | null = [],
    controlProcessRows: any[] | null = [],
  ) => {
    const availableProjects = normalizeProjectRows(projectsRows);
    setProjects(availableProjects);
    const storedProjectId = readLocalCurrentProjectId();
    const active =
      (storedProjectId
        ? availableProjects.find((p) => p.id === storedProjectId)
        : undefined) ??
      availableProjects.find((p) => p.isActive) ??
      availableProjects[0] ??
      getDefaultProjectList()[0];
    setCurrentProjectId(
      active?.id ? normalizeStoredProjectId(active.id) : null,
    );
    setSavedChecklists(
      (checklistRows ?? []).map((row) => {
        const details = row?.details && typeof row.details === "object" ? row.details : {};
        return {
          id: row.id,
          projectId: normalizeStoredProjectId(row.project_id),
          checklistNo: row.checklist_no ?? undefined,
          templateKey: normalizeChecklistTemplateKey(row.template_key),
          title: row.title ?? "",
          category: row.category ?? "",
          location: row.location ?? "",
          date: row.date ?? "",
          contractor: row.contractor ?? details.contractor ?? "",
          notes: row.notes ?? "",
          projectNameDisplay: details.projectNameDisplay ?? details.project_name_display ?? details.projectName ?? "",
          roadStructure: details.roadStructure ?? details.road_structure ?? "",
          stationSection: details.stationSection ?? details.station_section ?? "",
          toStationSection: details.toStationSection ?? details.to_station_section ?? "",
          offset: details.offset ?? "",
          revision: String(details.revision ?? CHECKLIST_DEFAULT_REVISION),
          revisionDate: String(details.revisionDate ?? details.revision_date ?? CHECKLIST_DEFAULT_REVISION_DATE),
          items: normalizeChecklistItems(row.items),
          approval: normalizeApproval(row.approval),
          savedAt: row.saved_at
            ? new Date(row.saved_at).toLocaleString("he-IL")
            : "",
        } as ChecklistRecord;
      }),
    );
    setSavedNonconformances(
      (nonconRows ?? []).map((row) => {
        const details = (row.details ?? {}) as Record<string, any>;
        return {
          id: row.id,
          projectId: normalizeStoredProjectId(row.project_id),
          title: row.title ?? details.title ?? "",
          openedBy: details.openedBy ?? details.opened_by ?? "QA / QC",
          openedRole: details.openedRole ?? details.opened_role ?? "בקרת איכות",
          raisedBy: row.raised_by ?? details.raisedBy ?? details.raised_by ?? "",
          date: row.date ?? details.date ?? "",
          location: row.location ?? details.location ?? "",
          building: details.building ?? "",
          element: details.element ?? "",
          subElement: details.subElement ?? details.sub_element ?? "",
          fromSection: details.fromSection ?? details.from_section ?? "",
          toSection: details.toSection ?? details.to_section ?? "",
          offset: details.offset ?? "",
          grade: details.grade ?? "",
          expectedCloseDate: details.expectedCloseDate ?? details.expected_close_date ?? "",
          updatedExpectedCloseDate: details.updatedExpectedCloseDate ?? details.updated_expected_close_date ?? "",
          delayDays: details.delayDays ?? details.delay_days ?? "",
          breakage: details.breakage ?? "",
          qualityImpact: details.qualityImpact ?? details.quality_impact ?? "",
          severity: row.severity ?? details.severity ?? "בינונית",
          status: row.status ?? details.status ?? "פתוח",
          description: row.description ?? details.description ?? "",
          responsibleParty: details.responsibleParty ?? details.responsible_party ?? "",
          actionRequired: row.action_required ?? details.actionRequired ?? details.action_required ?? "",
          handler: details.handler ?? "",
          correctiveActionDetails: details.correctiveActionDetails ?? details.corrective_action_details ?? "",
          notes: row.notes ?? details.notes ?? "",
          closedBy: details.closedBy ?? details.closed_by ?? "",
          closingRole: details.closingRole ?? details.closing_role ?? "",
          closedName: details.closedName ?? details.closed_name ?? "",
          closingDate: details.closingDate ?? details.closing_date ?? "",
          images: normalizeAttachments(row.images ?? details.images),
          approval: normalizeApproval(row.approval ?? details.approval),
          savedAt: row.saved_at
            ? new Date(row.saved_at).toLocaleString("he-IL")
            : "",
        };
      }),
    );
    setSavedTrialSections(
      (trialRows ?? []).map((row) => {
        const details = row.details ?? {};
        const pick = (...values: unknown[]) => {
          for (const value of values) {
            if (value !== undefined && value !== null && String(value).trim() !== "") return value;
          }
          return "";
        };
        return mergeTrialSectionDetails(enrichTrialSectionRecord({
          id: row.id,
          projectId: normalizeStoredProjectId(row.project_id),
          details,
          title: pick(details.title, row.title),
          location: pick(details.location, details.workLocation, details.workSegment, details.workSection, details.roadSection, details.roadStructure, row.location),
          date: pick(details.date, details.executionDate, row.date),
          spec: pick(details.spec, row.spec),
          result: pick(details.result, details.conclusions, row.result),
          approvedBy: pick(details.approvedBy, row.approved_by),
          status: pick(details.status, row.status) || "טיוטה",
          notes: pick(details.notes, row.notes),
          images: normalizeAttachments(details.images ?? row.images),
          approval: normalizeApproval(details.approval ?? row.approval),
          savedAt: row.saved_at
            ? new Date(row.saved_at).toLocaleString("he-IL")
            : "",
        }), details) as TrialSectionRecord;
      }),
    );
    setSavedPreliminary(
      (preliminaryRows ?? []).map((row) => ({
        id: row.id,
        projectId: normalizeStoredProjectId(row.project_id),
        subtype: row.subtype,
        title: row.title ?? "",
        date: row.date ?? "",
        status: row.status ?? "טיוטה",
        supplier: row.supplier ?? undefined,
        subcontractor: row.subcontractor ?? undefined,
        material: row.material ?? undefined,
        approval: normalizeApproval(row.approval),
        savedAt: row.saved_at
          ? new Date(row.saved_at).toLocaleString("he-IL")
          : "",
      })),
    );
    setSavedRfis((rfiRows ?? []).map(rfiRowToRecord));
    setSavedControlProcesses(
      (controlProcessRows ?? [])
        .map(normalizeControlProcess)
        .filter(Boolean) as ControlProcessRecord[],
    );
  };

  useEffect(() => {
    const loadAll = async () => {
      if (!cloudEnabled) {
        loadPersistedData(window.localStorage.getItem(STORAGE_KEY));
        setLoaded(true);
        return;
      }
      try {
        const [
          projectsRes,
          checklistsRes,
          nonconRes,
          trialsRes,
          prelimRes,
          rfiRes,
          controlRes,
        ] = await Promise.all([
          selectTable("projects", "created_at"),
          selectTable("checklists", "saved_at"),
          selectTable(NONCONFORMANCE_TABLE, "saved_at"),
          selectTable("trial_sections", "saved_at"),
          selectTable("preliminary_records", "saved_at"),
          selectTable("rfi_records", "created_at"),
          selectTable(CONTROL_PROCESS_TABLE, "saved_at"),
        ]);
        const fatal = [
          projectsRes.error,
          checklistsRes.error,
          nonconRes.error,
          trialsRes.error,
          prelimRes.error,
          rfiRes.error,
          controlRes.error,
        ].filter((item) => item && !shouldIgnoreCloudError(item));
        if (fatal.length) throw fatal[0];
        loadFromCloudResults(
          projectsRes.data,
          checklistsRes.data,
          nonconRes.data,
          trialsRes.data,
          prelimRes.data,
          rfiRes.data,
          controlRes.data,
        );
      } catch (error) {
        if (isSupabaseHeaderEncodingError(error)) setCloudEnabled(false);
        loadPersistedData(window.localStorage.getItem(STORAGE_KEY));
      } finally {
        setLoaded(true);
      }
    };
    void loadAll();
  }, [cloudEnabled]);

  useEffect(() => {
    if (!loaded || typeof window === "undefined") return;

    // כאשר Supabase פעיל, הנתונים נשמרים בענן. אין צורך לשמור את כל הרשומות
    // גם ב-localStorage, כי תמונות/קבצים עלולים לעבור את מגבלת הדפדפן ולגרום לקריסת הדף.
    if (cloudEnabled) {
      writeLocalCurrentProjectId(currentProjectId);
      return;
    }

    try {
      const payload: PersistedData = {
        projects,
        currentProjectId,
        savedChecklists,
        savedNonconformances,
        savedTrialSections,
        savedPreliminary,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn(
        "Local storage quota exceeded. Clearing local cache and continuing without crash.",
        error,
      );
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }, [
    projects,
    currentProjectId,
    savedChecklists,
    savedNonconformances,
    savedTrialSections,
    savedPreliminary,
    loaded,
    cloudEnabled,
  ]);
  useEffect(() => {
    if (loaded) writeLocalCurrentProjectId(currentProjectId);
  }, [currentProjectId, loaded]);

  const refreshCloudData = async () => {
    if (!cloudEnabled) return;
    const [
      projectsRes,
      checklistsRes,
      nonconRes,
      trialsRes,
      prelimRes,
      rfiRes,
      controlRes,
    ] = await Promise.all([
      selectTable("projects", "created_at"),
      selectTable("checklists", "saved_at"),
      selectTable(NONCONFORMANCE_TABLE, "saved_at"),
      selectTable("trial_sections", "saved_at"),
      selectTable("preliminary_records", "saved_at"),
      selectTable("rfi_records", "created_at"),
      selectTable(CONTROL_PROCESS_TABLE, "saved_at"),
    ]);
    const fatal = [
      projectsRes.error,
      checklistsRes.error,
      nonconRes.error,
      trialsRes.error,
      prelimRes.error,
      rfiRes.error,
      controlRes.error,
    ].filter((item) => item && !shouldIgnoreCloudError(item));
    if (fatal.length) throw fatal[0];
    loadFromCloudResults(
      projectsRes.data,
      checklistsRes.data,
      nonconRes.data,
      trialsRes.data,
      prelimRes.data,
      rfiRes.data,
      controlRes.data,
    );
  };

  const withSaving = async (action: () => Promise<void>) => {
    try {
      setIsSaving(true);
      await action();
    } catch (error) {
      console.error(error);
      alert(errorText(error) || "אירעה שגיאה בשמירה");
      if (cloudEnabled) {
        try {
          await refreshCloudData();
        } catch {}
      }
    } finally {
      setIsSaving(false);
    }
  };

  const effectiveProjects = useMemo(
    () => (projects.length ? projects : getDefaultProjectList()),
    [projects],
  );

  const accessibleProjects = useMemo(() => {
    if (!projectAccess) return [];
    const filtered = effectiveProjects.filter((project) =>
      projectMatchesAccess(project, projectAccess),
    );
    if (filtered.length) return filtered;
    if (isAdminAccess(projectAccess))
      return effectiveProjects.length
        ? effectiveProjects
        : getDefaultProjectList();

    const code =
      String(
        projectAccess.code ?? projectAccess.username ?? "project",
      ).trim() || "project";
    const fallbackName =
      String(projectAccess.projectName ?? "").trim() || "פרויקט " + code;
    return [
      {
        id: "project-" + code,
        name: fallbackName,
        description: "פרויקט עבודה לפי הרשאת משתמש " + code,
        manager: "",
        isActive: true,
        createdAt: "ברירת מחדל",
      } as Project,
    ];
  }, [effectiveProjects, projectAccess]);

  useEffect(() => {
    if (!loaded || !projectAccess) return;
    if (!projects.length) setProjects(getDefaultProjectList());
  }, [loaded, projectAccess, projects.length]);

  // תיקון בחירת פרויקט פעיל:
  // גם אם בדף מוצג פרויקט כברירת מחדל, כל הרשומות מסוננות לפי currentProjectId.
  // לכן חייבים להציב projectId אמיתי מיד לאחר טעינת הרשאות/פרויקטים.
  useEffect(() => {
    if (!loaded || !projectAccess || !accessibleProjects.length) return;
    const savedId = readLocalCurrentProjectId();
    const savedProject = savedId
      ? accessibleProjects.find((project) => project.id === savedId)
      : null;
    const activeProject = accessibleProjects.find(
      (project) => project.isActive,
    );
    const selectedProject = accessibleProjects.find(
      (project) => project.id === currentProjectId,
    );
    const nextProjectId =
      selectedProject?.id ??
      savedProject?.id ??
      activeProject?.id ??
      accessibleProjects[0]?.id ??
      null;
    if (nextProjectId && currentProjectId !== nextProjectId) {
      setCurrentProjectId(nextProjectId);
      writeLocalCurrentProjectId(nextProjectId);
    }
  }, [loaded, projectAccess, accessibleProjects, currentProjectId]);

  useEffect(() => {
    if (!loaded || !projectAccess || isAdminAccess(projectAccess)) return;
    const allowedProject = effectiveProjects.find((project) =>
      projectMatchesAccess(project, projectAccess),
    );
    if (allowedProject && currentProjectId !== allowedProject.id) {
      setCurrentProjectId(allowedProject.id);
      writeLocalCurrentProjectId(allowedProject.id);
    }
  }, [loaded, projectAccess, effectiveProjects, currentProjectId]);

  const currentProject = useMemo(
    () =>
      accessibleProjects.find((p) => p.id === currentProjectId) ??
      accessibleProjects[0] ??
      null,
    [accessibleProjects, currentProjectId],
  );

  const [projectEmailUsers, setProjectEmailUsers] = useState<ProjectEmailUser[]>(() => readProjectEmailUsers());
  const projectEmailUsersRef = useRef<ProjectEmailUser[]>(projectEmailUsers);

  useEffect(() => {
    let active = true;
    loadProjectEmailUsersFromCloud()
      .then((cloudUsers) => {
        if (!active || !cloudUsers?.length) return;
        projectEmailUsersRef.current = cloudUsers;
        setProjectEmailUsers(cloudUsers);
        writeProjectEmailUsers(cloudUsers);
      })
      .catch((error) => console.warn("טעינת משתמשי הפרויקט מהענן נכשלה", error));
    return () => { active = false; };
  }, []);

  const saveProjectEmailUsers = (updater: (prev: ProjectEmailUser[]) => ProjectEmailUser[]) => {
    const base = projectEmailUsersRef.current;
    const next = updater(base);
    projectEmailUsersRef.current = next;
    writeProjectEmailUsers(next);
    setProjectEmailUsers(next);
    return next;
  };

  useEffect(() => {
    projectEmailUsersRef.current = projectEmailUsers;
    writeProjectEmailUsers(projectEmailUsers);
  }, [projectEmailUsers]);

  const currentProjectEmailUsers = useMemo(
    () => projectEmailUsers.filter((user) => normalizeStoredProjectId(user.projectId) === normalizeStoredProjectId(currentProject?.id)),
    [projectEmailUsers, currentProject],
  );

  const addProjectEmailUser = (user: Omit<ProjectEmailUser, "id" | "projectId" | "createdAt">) => {
    if (!currentProject) return alert("יש לבחור פרויקט");
    saveProjectEmailUsers((prev) => [
      ...prev,
      { ...user, id: crypto.randomUUID(), projectId: normalizeStoredProjectId(currentProject.id), email: user.email.trim(), createdAt: nowLocal() },
    ]);
  };

  const updateProjectEmailUser = (id: string, patch: Partial<ProjectEmailUser>) => {
    saveProjectEmailUsers((prev) =>
      prev.map((user) => (user.id === id ? { ...user, ...patch, email: patch.email !== undefined ? String(patch.email).trim() : user.email } : user)),
    );
  };

  const deleteProjectEmailUser = (id: string) => {
    if (!window.confirm("למחוק משתמש מרשימת הנמענים של הפרויקט?")) return;
    saveProjectEmailUsers((prev) => prev.filter((user) => user.id !== id));
  };

  const saveCurrentProjectEmailUsers = async () => {
    const usersToSave = projectEmailUsersRef.current;
    try {
      writeProjectEmailUsers(usersToSave);
      await saveProjectEmailUsersToCloud(usersToSave);
      const cloudUsers = await loadProjectEmailUsersFromCloud();
      if (cloudUsers) {
        projectEmailUsersRef.current = cloudUsers;
        setProjectEmailUsers(cloudUsers);
        writeProjectEmailUsers(cloudUsers);
      }
      alert("משתמשי הפרויקט נשמרו בהצלחה בענן ובדפדפן");
    } catch (error) {
      console.error(error);
      alert("המשתמשים נשמרו בדפדפן, אך שמירה בענן נכשלה. ודא שהרצת את project_email_users.sql ב-Supabase.");
    }
  };


  useEffect(() => {
    const normalized = normalizeStoredProjectId(currentProjectId);
    if (normalized && currentProjectId !== normalized) {
      setCurrentProjectId(normalized);
      writeLocalCurrentProjectId(normalized);
    }
  }, [currentProjectId]);
  const savedCurrentProjectLegend = useMemo(
    () =>
      currentProject
        ? normalizeProjectLegend(
            projectLegends[normalizeStoredProjectId(currentProject.id)] ??
              projectLegends[currentProject.id],
            currentProject.name,
          )
        : normalizeProjectLegend(null, ""),
    [projectLegends, currentProject],
  );
  const currentProjectLegend = useMemo(
    () =>
      currentProject && (editingProjectLegend || projectLegendDirty)
        ? normalizeProjectLegend(
            draftProjectLegends[normalizeStoredProjectId(currentProject.id)] ??
              draftProjectLegends[
                normalizeStoredProjectId(currentProject.id)
              ] ??
              draftProjectLegends[currentProject.id] ??
              savedCurrentProjectLegend,
            currentProject.name,
          )
        : savedCurrentProjectLegend,
    [
      currentProject,
      editingProjectLegend,
      projectLegendDirty,
      draftProjectLegends,
      savedCurrentProjectLegend,
    ],
  );
  const currentProjectProfile = useMemo(
    () =>
      isProjectLegendComplete(currentProjectLegend)
        ? projectLegendToProfile(currentProjectLegend)
        : getProjectProfile(currentProject?.name),
    [currentProjectLegend, currentProject?.name],
  );

  const trialParticipantOptions = useMemo(() => {
    const profile = currentProjectProfile ?? getProjectProfile(currentProject?.name);
    const legend = normalizeProjectLegend(currentProjectLegend, currentProject?.name || "");
    const fromUsers = currentProjectEmailUsers
      .map((user) =>
        [user.name, user.role, user.company].filter(Boolean).join(" - ") || user.email,
      )
      .filter(Boolean);

    // גורמי פרויקט קבועים + גורמים נוספים שהוגדרו בפרטי הפרויקט.
    // כך גם "מפקח", "מפקח אתר" או כל גורם חדש שמוסיפים לפרטי הפרויקט יופיע לבחירה בקטע ניסוי.
    const fromProjectDetails = [
      legend.projectManagement || profile?.projectManager ? `מנהל פרויקט - ${legend.projectManagement || profile?.projectManager}` : "",
      legend.contractor || profile?.contractor ? `קבלן ראשי - ${legend.contractor || profile?.contractor}` : "",
      legend.qualityAssurance || profile?.qaCompany ? `הבטחת איכות - ${legend.qualityAssurance || profile?.qaCompany}` : "",
      legend.qualityControl || profile?.qualityControl ? `בקרת איכות - ${legend.qualityControl || profile?.qualityControl}` : "",
      legend.workManager || profile?.workManager ? `מנהל עבודה - ${legend.workManager || profile?.workManager}` : "",
      legend.surveyor || profile?.surveyor ? `מודד - ${legend.surveyor || profile?.surveyor}` : "",
      legend.supervisor ? `מפקח - ${legend.supervisor}` : "",
      ...legend.extraFactors.map((factor) => {
        const label = String(factor.label || "גורם נוסף").trim();
        const value = String(factor.value || "").trim();
        return value ? `${label} - ${value}` : label;
      }),
    ];

    return Array.from(
      new Set(
        [...fromUsers, ...fromProjectDetails]
          .map((item) => String(item || "").trim())
          .filter(Boolean),
      ),
    );
  }, [currentProjectEmailUsers, currentProjectLegend, currentProjectProfile, currentProject?.name]);
  const currentProjectDefaults = useMemo(() => {
    const profile = currentProjectProfile ?? getProjectProfile(currentProject?.name);
    const legend = currentProjectLegend;
    return {
      projectName: legend.projectName || profile?.projectName || currentProject?.name || "",
      contractor: legend.contractor || profile?.contractor || "",
      projectManagement: legend.projectManagement || profile?.projectManager || currentProject?.manager || "",
      qualityAssurance: legend.qualityAssurance || profile?.qaCompany || "",
      qualityControl: legend.qualityControl || profile?.qualityControl || CONTROL_QUALITY_COMPANY_NAME,
      workManager: legend.workManager || profile?.workManager || "",
      surveyor: legend.surveyor || profile?.surveyor || "",
      supervisor: legend.supervisor || "",
    };
  }, [currentProjectLegend, currentProjectProfile, currentProject?.name, currentProject?.manager]);

  const fillOnlyEmptyFields = <T extends Record<string, any>>(form: T, values: Record<string, any>): T => {
    let changed = false;
    const next: T = { ...form };
    Object.entries(values).forEach(([key, value]) => {
      if (value == null || String(value).trim() === "") return;
      if (String((next as any)[key] ?? "").trim() === "") {
        (next as any)[key] = value;
        changed = true;
      }
    });
    return changed ? next : form;
  };

  const projectDefaultFieldValues = () => ({
    projectName: currentProjectDefaults.projectName,
    titleProjectName: currentProjectDefaults.projectName,
    projectNameDisplay: currentProjectDefaults.projectName,
    project: currentProjectDefaults.projectName,
    projectTitle: currentProjectDefaults.projectName,
    managementCompany: currentProjectDefaults.projectManagement,
    projectManagement: currentProjectDefaults.projectManagement,
    projectManager: currentProjectDefaults.projectManagement,
    contractor: currentProjectDefaults.contractor,
    mainContractor: currentProjectDefaults.contractor,
    executionContractor: currentProjectDefaults.contractor,
    qualityAssurance: currentProjectDefaults.qualityAssurance,
    qaCompany: currentProjectDefaults.qualityAssurance,
    qualityControl: currentProjectDefaults.qualityControl,
    qualityCompany: currentProjectDefaults.qualityControl,
    qcCompany: currentProjectDefaults.qualityControl,
    workManager: currentProjectDefaults.workManager,
    surveyor: currentProjectDefaults.surveyor,
    supervisor: currentProjectDefaults.supervisor,
  });

  const applyProjectDefaultsToChecklist = (form: any) => ({
    ...fillOnlyEmptyFields(form, {
      ...projectDefaultFieldValues(),
      revision: CHECKLIST_DEFAULT_REVISION,
      revisionDate: CHECKLIST_DEFAULT_REVISION_DATE,
    }),
    contractor: form.contractor || currentProjectDefaults.contractor,
    revision: form.revision || CHECKLIST_DEFAULT_REVISION,
    revisionDate: form.revisionDate || CHECKLIST_DEFAULT_REVISION_DATE,
    items: applyProjectTeamToItems(form.items),
  });

  const applyProjectDefaultsToNonconformance = (form: any) => {
    const filled = fillOnlyEmptyFields(form, {
      ...projectDefaultFieldValues(),
      raisedBy: currentProjectDefaults.qualityControl,
      responsibleParty: currentProjectDefaults.contractor || currentProjectDefaults.projectManagement,
      handler: currentProjectDefaults.workManager || currentProjectDefaults.contractor,
      openedBy: form.openedBy || "QA / QC",
      openedRole: form.openedRole || "בקרת איכות",
    });

    // פרטי הפרויקט בטופס אי התאמה נמשכים תמיד ממסך "פרטי הפרויקט".
    // שדות טיפוליים קיימים לא נמחקים, ורק פרטי הפרויקט מתעדכנים אוטומטית.
    return {
      ...filled,
      projectName: currentProjectDefaults.projectName,
      titleProjectName: currentProjectDefaults.projectName,
      projectNameDisplay: currentProjectDefaults.projectName,
      projectManagement: currentProjectDefaults.projectManagement,
      managementCompany: currentProjectDefaults.projectManagement,
      projectManager: currentProjectDefaults.projectManagement,
      contractor: currentProjectDefaults.contractor,
      mainContractor: currentProjectDefaults.contractor,
      qualityAssurance: currentProjectDefaults.qualityAssurance,
      qaCompany: currentProjectDefaults.qualityAssurance,
      qualityControl: currentProjectDefaults.qualityControl,
      qualityCompany: currentProjectDefaults.qualityControl,
      qcCompany: currentProjectDefaults.qualityControl,
    };
  };

  const enrichNonconformanceRecordWithProjectDetails = (form: any) =>
    applyProjectDefaultsToNonconformance({
      ...form,
      projectDetails: {
        projectName: currentProjectDefaults.projectName,
        projectManagement: currentProjectDefaults.projectManagement,
        contractor: currentProjectDefaults.contractor,
        qualityAssurance: currentProjectDefaults.qualityAssurance,
        qualityControl: currentProjectDefaults.qualityControl,
        workManager: currentProjectDefaults.workManager,
        surveyor: currentProjectDefaults.surveyor,
        supervisor: currentProjectDefaults.supervisor,
      },
    });

  const nonconformanceProjectDetailRows = (record: any) => {
    const details = record?.projectDetails ?? {};
    return [
      ["שם פרויקט", record?.projectName || record?.projectNameDisplay || details.projectName || currentProjectDefaults.projectName],
      ["ניהול פרויקט", record?.projectManagement || record?.managementCompany || details.projectManagement || currentProjectDefaults.projectManagement],
      ["שם הקבלן", record?.contractor || record?.mainContractor || details.contractor || currentProjectDefaults.contractor],
      ["הבטחת איכות", record?.qualityAssurance || record?.qaCompany || details.qualityAssurance || currentProjectDefaults.qualityAssurance],
      ["בקרת איכות", record?.qualityControl || record?.qualityCompany || details.qualityControl || currentProjectDefaults.qualityControl],
    ];
  };

  const applyProjectDefaultsToTrialSection = (form: any) =>
    fillOnlyEmptyFields(form, {
      ...projectDefaultFieldValues(),
      projectName: currentProjectDefaults.projectName,
      projectManagement: currentProjectDefaults.projectManagement,
      managementCompany: currentProjectDefaults.projectManagement,
      contractor: currentProjectDefaults.contractor,
      mainContractor: currentProjectDefaults.contractor,
      qualityControl: currentProjectDefaults.qualityControl,
      qualityCompany: currentProjectDefaults.qualityControl,
      approvedBy: currentProjectDefaults.qualityControl,
      createdBy: currentProjectDefaults.qualityControl,
      checkedBy: currentProjectDefaults.qualityControl,
    });

  const applyProjectDefaultsToRfi = (form: any) =>
    fillOnlyEmptyFields(form, {
      ...projectDefaultFieldValues(),
      createdBy: currentProjectDefaults.qualityControl,
      updatedBy: currentProjectDefaults.qualityControl,
    });

  const applyProjectDefaultsToPreliminary = (form: any) =>
    fillOnlyEmptyFields(form, {
      ...projectDefaultFieldValues(),
      approvedBy: currentProjectDefaults.qualityControl,
      checkedBy: currentProjectDefaults.qualityControl,
    });

  const projectName = !loaded
    ? "טוען..."
    : currentProjectLegend.projectName ||
      currentProjectProfile?.projectName ||
      currentProject?.name ||
      "לא נבחר פרויקט";
  const projectLegendMissing = Boolean(
    currentProject && !isProjectLegendComplete(currentProjectLegend),
  );
  const startProjectLegendEdit = () => {
    if (!currentProject) return;
    setDraftProjectLegends((prev) =>
      migrateProjectLegendMap({
        ...prev,
        [normalizeStoredProjectId(currentProject.id)]:
          savedCurrentProjectLegend,
      }),
    );
    setEditingProjectLegend(true);
    setProjectLegendDirty(false);
  };

  const updateProjectLegendField = (
    field: keyof ProjectLegend,
    value: string,
  ) => {
    if (!currentProject) return;
    const projectId = normalizeStoredProjectId(currentProject.id);
    if (!editingProjectLegend) setEditingProjectLegend(true);
    setDraftProjectLegends((prev) => {
      const nextLegend = normalizeProjectLegend(
        prev[projectId] ?? prev[currentProject.id] ?? savedCurrentProjectLegend,
        currentProject.name,
      );
      let patched: ProjectLegend;
      if (field === "extraFactors") {
        try {
          patched = {
            ...nextLegend,
            extraFactors: normalizeProjectLegend({
              extraFactors: JSON.parse(value),
            }).extraFactors,
          };
        } catch {
          patched = nextLegend;
        }
      } else {
        patched = { ...nextLegend, [field]: value };
      }
      const nextDraft = migrateProjectLegendMap({
        ...prev,
        [projectId]: patched,
      });
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            PROJECT_LEGEND_STORAGE_KEY,
            JSON.stringify({ ...projectLegends, ...nextDraft }),
          );
        } catch {}
      }
      return nextDraft;
    });
    setProjectLegendDirty(true);
  };

  const approveProjectLegendChanges = async () => {
    if (!currentProject) return;
    const projectId = normalizeStoredProjectId(currentProject.id);
    const nextLegend = normalizeProjectLegend(
      draftProjectLegends[projectId] ??
        draftProjectLegends[normalizeStoredProjectId(currentProject.id)] ??
        draftProjectLegends[currentProject.id] ??
        savedCurrentProjectLegend,
      currentProject.name,
    );

    const nextLegends = migrateProjectLegendMap({
      ...projectLegends,
      [projectId]: nextLegend,
    });
    setProjectLegends(nextLegends);
    setDraftProjectLegends(nextLegends);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          PROJECT_LEGEND_STORAGE_KEY,
          JSON.stringify(nextLegends),
        );
      } catch {}
    }

    try {
      await saveProjectLegendToSupabase(projectId, nextLegend);
      setEditingProjectLegend(false);
      setProjectLegendDirty(false);
      alert(
        isSupabaseConfigured
          ? "פרטי הפרויקט נשמרו בהצלחה בענן"
          : "פרטי הפרויקט נשמרו בהצלחה",
      );
    } catch (error) {
      console.error("Failed to save project legend", error);
      alert(`שגיאה בשמירת פרטי הפרויקט: ${errorText(error)}`);
    }
  };

  const cancelProjectLegendChanges = () => {
    setEditingProjectLegend(false);
    setProjectLegendDirty(false);
  };

  const clearProjectLegend = () => {
    if (!currentProject || !window.confirm("למחוק את פרטי הפרויקט?")) return;
    const emptyLegend = normalizeProjectLegend(null, currentProject.name);
    setDraftProjectLegends((prev) =>
      migrateProjectLegendMap({
        ...prev,
        [normalizeStoredProjectId(currentProject.id)]: emptyLegend,
      }),
    );
    setEditingProjectLegend(true);
    setProjectLegendDirty(true);
  };

  const addProjectLegendFactor = () => {
    if (!currentProject) return;
    if (!editingProjectLegend) setEditingProjectLegend(true);
    const current = normalizeProjectLegend(
      draftProjectLegends[normalizeStoredProjectId(currentProject.id)] ??
        draftProjectLegends[currentProject.id] ??
        savedCurrentProjectLegend,
      currentProject.name,
    );
    updateProjectLegendField(
      "extraFactors",
      JSON.stringify([
        ...current.extraFactors,
        { id: `${Date.now()}`, label: "גורם נוסף", value: "" },
      ]),
    );
  };

  const removeProjectLegendFactor = (id: string) => {
    if (!currentProject) return;
    if (!editingProjectLegend) setEditingProjectLegend(true);
    const current = normalizeProjectLegend(
      draftProjectLegends[normalizeStoredProjectId(currentProject.id)] ??
        draftProjectLegends[currentProject.id] ??
        savedCurrentProjectLegend,
      currentProject.name,
    );
    updateProjectLegendField(
      "extraFactors",
      JSON.stringify(current.extraFactors.filter((factor) => factor.id !== id)),
    );
  };

  const checklistSequenceKey = (projectId: string) =>
    `${STORAGE_KEY}-checklist-sequence-${projectId}`;
  const getStoredChecklistSequence = (projectId: string) => {
    if (typeof window === "undefined") return 0;
    return (
      Number(
        window.localStorage.getItem(checklistSequenceKey(projectId)) ?? 0,
      ) || 0
    );
  };
  const setStoredChecklistSequence = (projectId: string, value: number) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(checklistSequenceKey(projectId), String(value));
  };
  const getMaxSavedChecklistNo = (projectId: string) =>
    savedChecklists
      .filter((item) => item.projectId === projectId)
      .reduce(
        (max, item) =>
          Math.max(max, Number((item as any).checklistNo ?? 0) || 0),
        0,
      );
  const allocateNextChecklistNo = (projectId: string) => {
    const next =
      Math.max(
        getStoredChecklistSequence(projectId),
        getMaxSavedChecklistNo(projectId),
      ) + 1;
    setStoredChecklistSequence(projectId, next);
    return next;
  };
  const getExistingEditingChecklistNo = () =>
    editingChecklistId
      ? savedChecklists.find((item) => item.id === editingChecklistId)
          ?.checklistNo
      : undefined;
  const ensureChecklistNo = () => {
    if (!currentProjectId) return undefined;
    const existing = getExistingEditingChecklistNo();
    if (existing) return existing;
    if ((checklistForm as any).checklistNo)
      return Number((checklistForm as any).checklistNo);
    const next = allocateNextChecklistNo(currentProjectId);
    setChecklistForm((prev) => ({ ...(prev as any), checklistNo: next }));
    return next;
  };

  const applyProjectTeamToItems = (items: ChecklistItem[]) =>
    items.map((item) => ({
      ...item,
      inspector:
        resolveResponsibleName(item.responsible, projectName) || item.inspector,
    }));
  const checklistTemplateLabel = (
    key: ChecklistTemplateKey | string | undefined,
  ) =>
    checklistTemplates[normalizeChecklistTemplateKey(key)]?.label ??
    "רשימת תיוג";
  const normalizedSearchTerm = recordsSearchTerm.trim().toLowerCase();
  const projectChecklists = useMemo(
    () =>
      savedChecklists
        .filter((item) => item.projectId === currentProjectId)
        .filter(
          (item) =>
            !normalizedSearchTerm ||
            [item.title, item.category, item.location, item.contractor]
              .join(" ")
              .toLowerCase()
              .includes(normalizedSearchTerm),
        ),
    [savedChecklists, currentProjectId, normalizedSearchTerm],
  );
  const selectedChecklistRecords = useMemo(
    () =>
      projectChecklists.filter(
        (record) =>
          normalizeChecklistTemplateKey(record.templateKey) ===
          normalizeChecklistTemplateKey(selectedChecklistTemplateKey),
      ),
    [projectChecklists, selectedChecklistTemplateKey],
  );
  const selectedChecklistLabel = checklistTemplateLabel(selectedChecklistTemplateKey);

  const projectNonconformances = useMemo(
    () =>
      savedNonconformances
        .filter((item) => item.projectId === currentProjectId)
        .filter(
          (item) =>
            !normalizedSearchTerm ||
            [item.title, item.location, item.description, item.status]
              .join(" ")
              .toLowerCase()
              .includes(normalizedSearchTerm),
        ),
    [savedNonconformances, currentProjectId, normalizedSearchTerm],
  );
  const projectRfis = useMemo(
    () =>
      savedRfis
        .filter((item) => item.projectId === currentProjectId)
        .filter(
          (item) =>
            !normalizedSearchTerm ||
            [
              item.title,
              item.location,
              item.requestDescription,
              item.status,
              item.response,
            ]
              .join(" ")
              .toLowerCase()
              .includes(normalizedSearchTerm),
        ),
    [savedRfis, currentProjectId, normalizedSearchTerm],
  );
  const projectControlProcesses = useMemo(
    () =>
      savedControlProcesses
        .filter((item) => item.projectId === currentProjectId)
        .filter(
          (item) =>
            !normalizedSearchTerm ||
            [
              item.processNo,
              item.title,
              item.workType,
              item.specSection,
              item.location,
              item.status,
            ]
              .join(" ")
              .toLowerCase()
              .includes(normalizedSearchTerm),
        ),
    [savedControlProcesses, currentProjectId, normalizedSearchTerm],
  );
  const projectTrialSections = useMemo(
    () =>
      savedTrialSections
        .filter((item) => item.projectId === currentProjectId)
        .filter(
          (item) =>
            !normalizedSearchTerm ||
            [item.title, item.location, item.spec, item.result]
              .join(" ")
              .toLowerCase()
              .includes(normalizedSearchTerm),
        ),
    [savedTrialSections, currentProjectId, normalizedSearchTerm],
  );
  const projectPreliminary = useMemo(
    () =>
      savedPreliminary
        .filter((item) => item.projectId === currentProjectId)
        .filter(
          (item) =>
            !normalizedSearchTerm ||
            [item.title, item.subtype, item.status]
              .join(" ")
              .toLowerCase()
              .includes(normalizedSearchTerm),
        ),
    [savedPreliminary, currentProjectId, normalizedSearchTerm],
  );

  const extractSequentialNo = (title: unknown) => {
    const text = String(title ?? "");
    const match =
      text.match(/מס[׳'’`]?\s*(\d+)/) ??
      text.match(/No[.\s:-]*(\d+)/i) ??
      text.match(/#\s*(\d+)/) ??
      text.match(/(?:^|\s)(\d+)(?:\s|$)/);
    return match ? Number(match[1]) || 0 : 0;
  };

  // מספור סידורי נפרד לכל סוג טופס ולכל פרויקט.
  // חשוב: רשימות תיוג לא משתמשות במנגנון הזה ולא שונו.
  type FormSequenceKind =
    | "rfi"
    | "nonconformances"
    | "trialSections"
    | "preliminary-suppliers"
    | "preliminary-subcontractors"
    | "preliminary-materials";

  const formSequenceStorageKey = (kind: FormSequenceKind) =>
    `${STORAGE_KEY}-form-sequence-${currentProjectId || "no-project"}-${kind}`;

  const getStoredFormSequence = (kind: FormSequenceKind) => {
    if (typeof window === "undefined") return 0;
    return (
      Number(window.localStorage.getItem(formSequenceStorageKey(kind)) ?? 0) ||
      0
    );
  };

  const setStoredFormSequence = (kind: FormSequenceKind, value: number) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(formSequenceStorageKey(kind), String(value));
  };

  const maxSavedSequentialNo = (
    records: Array<{ title?: string; projectId?: string; subtype?: string }>,
    subtype?: PreliminaryTab,
  ) =>
    records
      .filter((item) => item.projectId === currentProjectId)
      .filter((item) => !subtype || item.subtype === subtype)
      .reduce((max, item) => Math.max(max, extractSequentialNo(item.title)), 0);

  const nextSequentialNo = (
    kind: FormSequenceKind,
    records: Array<{ title?: string; projectId?: string; subtype?: string }>,
    subtype?: PreliminaryTab,
  ) =>
    Math.max(
      getStoredFormSequence(kind),
      maxSavedSequentialNo(records, subtype),
    ) + 1;

  const rememberSequentialNo = (kind: FormSequenceKind, title: unknown) => {
    const number = extractSequentialNo(title);
    if (!number) return;
    setStoredFormSequence(kind, Math.max(getStoredFormSequence(kind), number));
  };

  const numberedTitle = (base: string, number: number) =>
    `${base} מס׳ ${number}`;
  const titleHasNumber = (title: unknown) => extractSequentialNo(title) > 0;
  const nextRfiTitle = () => numberedTitle("RFI", nextSequentialNo("rfi", []));
  const nextNonconformanceTitle = () =>
    numberedTitle(
      "אי התאמה",
      nextSequentialNo("nonconformances", savedNonconformances as any),
    );
  const nextTrialSectionTitle = () =>
    numberedTitle(
      "קטע ניסוי",
      nextSequentialNo("trialSections", savedTrialSections as any),
    );
  const preliminaryBaseTitle = (subtype: PreliminaryTab) =>
    subtype === "suppliers"
      ? "אישור ספקים"
      : subtype === "subcontractors"
        ? "אישור קבלנים"
        : "אישור חומרים";
  const preliminarySequenceKind = (subtype: PreliminaryTab): FormSequenceKind =>
    `preliminary-${subtype}` as FormSequenceKind;
  const nextPreliminaryTitle = (subtype: PreliminaryTab) =>
    numberedTitle(
      preliminaryBaseTitle(subtype),
      nextSequentialNo(
        preliminarySequenceKind(subtype),
        savedPreliminary as any,
        subtype,
      ),
    );

  useEffect(() => {
    if (!loaded || section !== "checklists") return;
    const profile = currentProjectProfile ?? getProjectProfile(projectName);
    if (!profile) return;
    setChecklistForm((prev) => ({
      ...prev,
      contractor:
        !prev.contractor || prev.contractor.includes("פלסי הגליל")
          ? profile.contractor
          : prev.contractor,
      items: prev.items.map((item) => ({
        ...item,
        inspector:
          resolveResponsibleName(item.responsible, profile.projectName) ||
          item.inspector,
      })),
    }));
  }, [
    loaded,
    section,
    currentProjectId,
    currentProjectProfile?.projectName,
    projectName,
  ]);

  useEffect(() => {
    if (!loaded || !currentProjectId) return;

    if (section === "checklists" && !editingChecklistId) {
      setChecklistForm((prev: any) => applyProjectDefaultsToChecklist(prev));
    }
    if (section === "nonconformances" && !editingNonconformanceId) {
      setNonconformanceForm((prev: any) => applyProjectDefaultsToNonconformance(prev));
    }
    if (section === "trialSections" && !editingTrialSectionId) {
      setTrialSectionForm((prev: any) => applyProjectDefaultsToTrialSection(prev));
    }
    if (section === "rfi" && !editingRfiId) {
      setRfiForm((prev: any) => applyProjectDefaultsToRfi(prev));
    }
    if (section === "preliminary" && !editingPreliminaryId) {
      if (preliminaryTab === "suppliers") {
        setSupplierPreliminaryForm((prev: any) => applyProjectDefaultsToPreliminary(prev));
      }
      if (preliminaryTab === "subcontractors") {
        setSubcontractorPreliminaryForm((prev: any) => applyProjectDefaultsToPreliminary(prev));
      }
      if (preliminaryTab === "materials") {
        setMaterialPreliminaryForm((prev: any) => applyProjectDefaultsToPreliminary(prev));
      }
    }
  }, [
    loaded,
    section,
    preliminaryTab,
    currentProjectId,
    currentProjectDefaults.projectName,
    currentProjectDefaults.contractor,
    currentProjectDefaults.projectManagement,
    currentProjectDefaults.qualityAssurance,
    currentProjectDefaults.qualityControl,
    currentProjectDefaults.workManager,
    currentProjectDefaults.surveyor,
    currentProjectDefaults.supervisor,
    editingChecklistId,
    editingNonconformanceId,
    editingTrialSectionId,
    editingRfiId,
    editingPreliminaryId,
  ]);

  const resetChecklistForm = (
    templateKey: ChecklistTemplateKey = checklistForm.templateKey,
  ) => {
    setSelectedChecklistTemplateKey(normalizeChecklistTemplateKey(templateKey));
    setEditingChecklistId(null);
    const next = createDefaultChecklist(templateKey);
    setChecklistForm(applyProjectDefaultsToChecklist(next));
  };
  const nextControlProcessNo = () =>
    `REF-${Math.max(0, ...savedControlProcesses.filter((item) => item.projectId === currentProjectId).map((item) => Number(String(item.processNo).replace(/\D/g, "")) || 0)) + 1}`;
  const resetControlProcessForm = () => {
    setEditingControlProcessId(null);
    setControlProcessForm(createDefaultControlProcess(nextControlProcessNo()));
  };
  const resetRfiForm = () => {
    setEditingRfiId(null);
    setRfiForm(applyProjectDefaultsToRfi(createDefaultRfi(nextRfiTitle())));
  };
  const resetNonconformanceEditor = () => {
    setEditingNonconformanceId(null);
    setNonconformanceForm(applyProjectDefaultsToNonconformance({
      ...createDefaultNonconformance(),
      title: nextNonconformanceTitle(),
      openedBy: "QA / QC",
      openedRole: "בקרת איכות",
      status: "פתוח",
    } as any));
  };
  const resetTrialSectionEditor = () => {
    setEditingTrialSectionId(null);
    setTrialSectionForm(applyProjectDefaultsToTrialSection({
      ...createDefaultTrialSection(),
      title: nextTrialSectionTitle(),
    }));
  };
  const resetPreliminaryEditor = () => {
    setEditingPreliminaryId(null);
    if (preliminaryTab === "suppliers")
      setSupplierPreliminaryForm(applyProjectDefaultsToPreliminary({
        ...createDefaultPreliminary("suppliers"),
        title: nextPreliminaryTitle("suppliers"),
      }));
    if (preliminaryTab === "subcontractors")
      setSubcontractorPreliminaryForm(applyProjectDefaultsToPreliminary({
        ...createDefaultPreliminary("subcontractors"),
        title: nextPreliminaryTitle("subcontractors"),
      }));
    if (preliminaryTab === "materials")
      setMaterialPreliminaryForm(applyProjectDefaultsToPreliminary({
        ...createDefaultPreliminary("materials"),
        title: nextPreliminaryTitle("materials"),
      }));
  };

  const addProject = async () => {
    if (!isAdminAccess(projectAccess))
      return alert("אין הרשאה להוסיף פרויקטים במשתמש פרויקט");
    if (!newProjectName.trim()) return alert("יש להזין שם פרויקט");
    const id = crypto.randomUUID();
    const project: Project = {
      id,
      name: newProjectName.trim(),
      description: newProjectDescription.trim(),
      manager: newProjectManager.trim(),
      isActive: true,
      createdAt: nowLocal(),
    };
    await withSaving(async () => {
      if (cloudEnabled) {
        await supabase!
          .from("projects")
          .update({ is_active: false })
          .neq("id", id);
        const result = await supabase!.from("projects").insert({
          id,
          name: project.name,
          description: project.description,
          manager: project.manager,
          is_active: true,
          created_at: nowIso(),
        });
        if (result.error) throw result.error;
        await refreshCloudData();
      } else {
        setProjects((prev) => [
          ...(prev.length ? prev : getDefaultProjectList()).map((p) => ({
            ...p,
            isActive: false,
          })),
          project,
        ]);
        setCurrentProjectId(id);
      }
    });
    setNewProjectName("");
    setNewProjectDescription("");
    setNewProjectManager("");
  };

  const renameProject = async (projectId: string) => {
    const project = effectiveProjects.find((p) => p.id === projectId);
    if (!project) return;
    const nextName = window.prompt("שם פרויקט חדש", project.name);
    if (!nextName?.trim()) return;
    await withSaving(async () =>
      cloudEnabled
        ? (await supabase!
            .from("projects")
            .update({ name: nextName.trim() })
            .eq("id", normalizeStoredProjectId(projectId)),
          await refreshCloudData())
        : setProjects((prev) =>
            prev.map((p) =>
              p.id === projectId ? { ...p, name: nextName.trim() } : p,
            ),
          ),
    );
  };
  const updateProjectMeta = async (projectId: string) => {
    const project = effectiveProjects.find((p) => p.id === projectId);
    if (!project) return;
    const description = window.prompt(
      "תיאור פרויקט",
      project.description ?? "",
    );
    if (description === null) return;
    const manager = window.prompt("מנהל פרויקט", project.manager ?? "");
    if (manager === null) return;
    await withSaving(async () =>
      cloudEnabled
        ? (await supabase!
            .from("projects")
            .update({
              description: description.trim(),
              manager: manager.trim(),
            })
            .eq("id", normalizeStoredProjectId(projectId)),
          await refreshCloudData())
        : setProjects((prev) =>
            prev.map((p) =>
              p.id === projectId
                ? {
                    ...p,
                    description: description.trim(),
                    manager: manager.trim(),
                  }
                : p,
            ),
          ),
    );
  };
  const setActiveProject = async (projectId: string) =>
    await withSaving(async () => {
      projectId = normalizeStoredProjectId(projectId);
      const allProjects = effectiveProjects.length
        ? effectiveProjects
        : getDefaultProjectList();
      const selected =
        allProjects.find((project) => project.id === projectId) ??
        getDefaultProjectList().find((project) => project.id === projectId);
      if (!selected) return;

      const selectedId = normalizeStoredProjectId(selected.id);
      setCurrentProjectId(selectedId);
      writeLocalCurrentProjectId(selectedId);
      setProjects((prev) => {
        const base = prev.length ? prev : allProjects;
        return base.map((project) => ({
          ...project,
          isActive: normalizeStoredProjectId(project.id) === selectedId,
        }));
      });

      if (cloudEnabled && supabase) {
        try {
          await supabase
            .from("projects")
            .update({ is_active: false })
            .neq("id", selectedId);
          const result = await supabase
            .from("projects")
            .update({ is_active: true })
            .eq("id", selectedId);
          if (result.error)
            console.warn(
              "Failed to update active project in Supabase",
              result.error,
            );
        } catch (error) {
          console.warn("Failed to update active project in Supabase", error);
        }
      }

      setSection("home");
    });
  const deleteProject = async (projectId: string) => {
    const project = effectiveProjects.find((p) => p.id === projectId);
    if (!project || !window.confirm(`למחוק את הפרויקט "${project.name}"?`))
      return;
    await withSaving(async () => {
      if (cloudEnabled) {
        await supabase!
          .from("checklists")
          .delete()
          .eq("project_id", normalizeStoredProjectId(projectId));
        await supabase!
          .from("NCR")
          .delete()
          .eq("project_id", normalizeStoredProjectId(projectId));
        await supabase!
          .from("trial_sections")
          .delete()
          .eq("project_id", normalizeStoredProjectId(projectId));
        await supabase!
          .from("preliminary_records")
          .delete()
          .eq("project_id", normalizeStoredProjectId(projectId));
        await supabase!
          .from("rfi_records")
          .delete()
          .eq("project_id", normalizeStoredProjectId(projectId));
        const result = await supabase!
          .from("projects")
          .delete()
          .eq("id", normalizeStoredProjectId(projectId));
        if (result.error) throw result.error;
        await refreshCloudData();
      } else {
        const nextProjects = projects.filter((p) => p.id !== projectId);
        setProjects(nextProjects.map((p, i) => ({ ...p, isActive: i === 0 })));
        setCurrentProjectId(nextProjects[0]?.id ?? null);
        setSavedChecklists((prev) =>
          prev.filter((x) => x.projectId !== projectId),
        );
        setSavedNonconformances((prev) =>
          prev.filter((x) => x.projectId !== projectId),
        );
        setSavedTrialSections((prev) =>
          prev.filter((x) => x.projectId !== projectId),
        );
        setSavedPreliminary((prev) =>
          prev.filter((x) => x.projectId !== projectId),
        );
        setSavedRfis((prev) => prev.filter((x) => x.projectId !== projectId));
        setSavedControlProcesses((prev) =>
          prev.filter((x) => x.projectId !== projectId),
        );
      }
    });
  };

  const applyChecklistTemplate = (templateKey: ChecklistTemplateKey) => {
    setSelectedChecklistTemplateKey(normalizeChecklistTemplateKey(templateKey));
    setChecklistForm((prev) => {
      const next = createDefaultChecklist(templateKey);
      const profile = currentProjectProfile ?? getProjectProfile(projectName);
      return {
        ...next,
        location: prev.location,
        date: prev.date,
        contractor:
          !prev.contractor || prev.contractor.includes("פלסי הגליל")
            ? profile?.contractor || ""
            : prev.contractor,
        notes: prev.notes,
        items: applyProjectTeamToItems(next.items),
        approval: prev.approval,
      };
    });
  };
  const updateChecklistItem = (
    id: string,
    field: keyof ChecklistItem,
    value: string,
  ) =>
    setChecklistForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== id) return item;
        if (field === "responsible") {
          const autoName = resolveResponsibleName(value, projectName);
          return {
            ...item,
            responsible: value,
            inspector: autoName || item.inspector,
          };
        }
        return { ...item, [field]: value };
      }),
    }));
  const toggleChecklistItemPrintExclusion = (id: string) =>
    setChecklistForm((prev) => ({
      ...prev,
      items: prev.items.map((item: any) =>
        item.id === id
          ? { ...item, excludedFromPrint: !Boolean(item.excludedFromPrint) }
          : item,
      ),
    }));

  const addChecklistItem = () =>
    setChecklistForm((prev) => ({
      ...prev,
      items: [...prev.items, emptyChecklistItem(crypto.randomUUID())],
    }));
  const removeChecklistItem = (id: string) =>
    setChecklistForm((prev) => ({
      ...prev,
      items:
        prev.items.length <= 1
          ? prev.items
          : prev.items.filter((item) => item.id !== id),
    }));

  const uploadChecklistItemAttachment = (
    itemId: string,
    kind: ChecklistAttachmentKind,
    file: File,
  ) => {
    const reader = new FileReader();
    reader.onload = () => {
      const attachment: ChecklistAttachment = {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        dataUrl: String(reader.result ?? ""),
        uploadedAt: nowLocal(),
        kind,
      };

      setChecklistForm((prev) => ({
        ...prev,
        items: prev.items.map((item: any) =>
          item.id === itemId
            ? {
                ...item,
                attachments: [
                  ...normalizeChecklistAttachments(item.attachments),
                  attachment,
                ],
              }
            : item,
        ),
      }));
    };
    reader.onerror = () => alert("לא ניתן לקרוא את הקובץ שנבחר");
    reader.readAsDataURL(file);
  };

  const removeChecklistItemAttachment = (
    itemId: string,
    attachmentId: string,
  ) => {
    setChecklistForm((prev) => ({
      ...prev,
      items: prev.items.map((item: any) =>
        item.id === itemId
          ? {
              ...item,
              attachments: normalizeChecklistAttachments(
                item.attachments,
              ).filter((attachment) => attachment.id !== attachmentId),
            }
          : item,
      ),
    }));
  };

  const saveControlProcess = async () => {
    if (!currentProjectId) return alert("יש לבחור פרויקט");
    if (!String(controlProcessForm.title ?? "").trim())
      return alert("יש להזין שם תהליך בקרה");
    if (!String(controlProcessForm.location ?? "").trim())
      return alert("יש להזין מס׳ שכבה");
    const actor =
      projectAccess?.displayName || projectAccess?.username || "משתמש מערכת";
    const existing = editingControlProcessId
      ? savedControlProcesses.find(
          (item) => item.id === editingControlProcessId,
        )
      : null;
    const id = editingControlProcessId ?? crypto.randomUUID();
    const nextStatus: ControlProcessStatus =
      controlProcessForm.status === "נעול" ? "נעול" : controlProcessForm.status;
    const record: ControlProcessRecord = {
      id,
      projectId: normalizeStoredProjectId(currentProjectId),
      processNo: String(controlProcessForm.processNo || nextControlProcessNo()),
      title: String(controlProcessForm.title ?? ""),
      workType: String(controlProcessForm.workType ?? ""),
      specSection: String(controlProcessForm.specSection ?? ""),
      location: String(controlProcessForm.location ?? ""),
      fromSection: String(controlProcessForm.fromSection ?? ""),
      toSection: String(controlProcessForm.toSection ?? ""),
      status: nextStatus,
      checklistIds: normalizeStringArray(controlProcessForm.checklistIds),
      rfiIds: normalizeStringArray(controlProcessForm.rfiIds),
      nonconformanceIds: normalizeStringArray(
        controlProcessForm.nonconformanceIds,
      ),
      requiredDocuments: normalizeRequiredDocuments(
        controlProcessForm.requiredDocuments,
      ),
      referenceResults: ensureReferenceResultsForMaterial(
        controlProcessForm.workType,
        controlProcessForm.referenceResults,
      ).map(applyReferenceQualityStatus),
      auditTrail: [
        ...(existing?.auditTrail ?? []),
        {
          action: editingControlProcessId
            ? "עדכון תהליך בקרה"
            : "פתיחת תהליך בקרה",
          by: actor,
          at: nowLocal(),
          note: String(controlProcessForm.status ?? ""),
        },
      ],
      approval: normalizeApproval(controlProcessForm.approval),
      lockedAt: String(controlProcessForm.lockedAt ?? ""),
      savedAt: nowLocal(),
    };

    await withSaving(async () => {
      if (cloudEnabled) {
        const result = editingControlProcessId
          ? await supabase!
              .from(CONTROL_PROCESS_TABLE)
              .update(sanitizeCloudPayload(controlProcessToRow(record)))
              .eq("id", editingControlProcessId)
          : await supabase!
              .from(CONTROL_PROCESS_TABLE)
              .insert(sanitizeCloudPayload(controlProcessToRow(record)));
        if (result.error && !shouldIgnoreCloudError(result.error))
          throw result.error;
      }
      setSavedControlProcesses((prev) =>
        editingControlProcessId
          ? prev.map((item) =>
              item.id === editingControlProcessId ? record : item,
            )
          : [record, ...prev],
      );
    });
    resetControlProcessForm();
  };

  const loadControlProcess = (record: ControlProcessRecord) => {
    setSection("controlProcesses");
    setEditingControlProcessId(record.id);
    setControlProcessForm({
      processNo: record.processNo,
      title: record.title,
      workType: record.workType,
      specSection: record.specSection,
      location: record.location,
      fromSection: record.fromSection,
      toSection: record.toSection,
      status: record.status,
      checklistIds: record.checklistIds,
      rfiIds: record.rfiIds,
      nonconformanceIds: record.nonconformanceIds,
      requiredDocuments: normalizeRequiredDocuments(record.requiredDocuments),
      referenceResults: ensureReferenceResultsForMaterial(
        record.workType,
        record.referenceResults,
      ),
      auditTrail: record.auditTrail,
      approval: normalizeApproval(record.approval),
      lockedAt: record.lockedAt,
    });
  };

  const deleteControlProcess = async (id: string) => {
    if (!window.confirm("למחוק את תהליך הבקרה?")) return;
    await withSaving(async () => {
      if (cloudEnabled) {
        const result = await supabase!
          .from(CONTROL_PROCESS_TABLE)
          .delete()
          .eq("id", id);
        if (result.error && !shouldIgnoreCloudError(result.error))
          throw result.error;
      }
      setSavedControlProcesses((prev) => prev.filter((item) => item.id !== id));
      if (editingControlProcessId === id) resetControlProcessForm();
    });
  };

  const lockControlProcess = async () => {
    setControlProcessForm((prev: any) => ({
      ...prev,
      status: "נעול",
      lockedAt: nowLocal(),
    }));
    setTimeout(() => {
      void saveControlProcess();
    }, 0);
  };

  const saveChecklist = async () => {
    if (!currentProjectId) return alert("יש לבחור פרויקט");
    if (!checklistForm.title.trim()) return alert("יש להזין שם רשימת תיוג");
    const validation = validateApproval(checklistForm.approval);
    if (validation) return alert(validation);
    const id = editingChecklistId ?? crypto.randomUUID();
    const existingChecklistNo = getExistingEditingChecklistNo();
    const checklistNo =
      existingChecklistNo ??
      (checklistForm as any).checklistNo ??
      allocateNextChecklistNo(currentProjectId);
    setStoredChecklistSequence(
      currentProjectId,
      Math.max(
        getStoredChecklistSequence(currentProjectId),
        Number(checklistNo) || 0,
      ),
    );
    const normalizedProjectId = normalizeStoredProjectId(currentProjectId);
    const checklistDetails = {
      projectNameDisplay: String((checklistForm as any).projectNameDisplay || currentProjectDefaults.projectName || ""),
      roadStructure: String((checklistForm as any).roadStructure ?? ""),
      stationSection: String((checklistForm as any).stationSection ?? ""),
      toStationSection: String((checklistForm as any).toStationSection ?? ""),
      offset: String((checklistForm as any).offset ?? ""),
      revision: String((checklistForm as any).revision || CHECKLIST_DEFAULT_REVISION),
      revisionDate: String((checklistForm as any).revisionDate || CHECKLIST_DEFAULT_REVISION_DATE),
    };
    const record: ChecklistRecord = {
      id,
      projectId: normalizedProjectId,
      checklistNo: Number(checklistNo),
      ...checklistForm,
      ...checklistDetails,
      items: normalizeChecklistItems(checklistForm.items),
      approval: normalizeApproval(checklistForm.approval),
      savedAt: nowLocal(),
    } as any;
    await withSaving(async () => {
      setSavedChecklists((prev) => {
        const exists = prev.some((item) => item.id === id);
        return exists
          ? prev.map((item) => (item.id === id ? record : item))
          : [record, ...prev];
      });

      if (cloudEnabled) {
        const payload = {
          id: record.id,
          project_id: normalizeStoredProjectId(record.projectId),
          checklist_no: record.checklistNo,
          template_key: record.templateKey,
          title: record.title,
          category: record.category,
          location: record.location,
          date: record.date,
          contractor: record.contractor,
          notes: record.notes,
          items: record.items,
          approval: record.approval,
          details: checklistDetails,
          saved_at: nowIso(),
        };
        await saveWithApprovalFallback(
          "checklists",
          payload,
          editingChecklistId ? "update" : "insert",
          editingChecklistId ?? undefined,
        );
      }
    });
    setEditingChecklistId(id);
    setChecklistForm((prev: any) => ({ ...prev, ...checklistDetails, checklistNo: Number(checklistNo), items: record.items, savedAt: record.savedAt }));
    alert("רשימת התיוג נשמרה בהצלחה");
  };
  const loadChecklist = (record: ChecklistRecord) => {
    setSection("checklists");
    setSelectedChecklistTemplateKey(normalizeChecklistTemplateKey(record.templateKey));
    setEditingChecklistId(record.id);
    setChecklistForm({
      ...(record as any),
      checklistNo: record.checklistNo,
      templateKey: record.templateKey,
      title: record.title,
      category: record.category,
      location: record.location,
      date: record.date,
      contractor: record.contractor,
      notes: record.notes,
      items: normalizeChecklistItems(record.items),
      approval: normalizeApproval(record.approval),
    });
  };
  const deleteChecklist = async (id: string) =>
    withSaving(async () =>
      cloudEnabled
        ? (await supabase!.from("checklists").delete().eq("id", id),
          await refreshCloudData())
        : setSavedChecklists((prev) => prev.filter((item) => item.id !== id)),
    );

  const saveRfiPayload = async (
    payload: Record<string, any>,
    isUpdate: boolean,
    id?: string,
  ) => {
    payload = sanitizeCloudPayload(payload);
    const run = (body: Record<string, any>) =>
      isUpdate
        ? supabase!.from("rfi_records").update(body).eq("id", id)
        : supabase!.from("rfi_records").insert(body);

    let result = await run(payload);
    if (
      result.error &&
      [
        "rfi_number",
        "created_by",
        "updated_by",
        "updated_at",
        "audit_log",
      ].some((column) => isMissingColumnError(result.error, column))
    ) {
      const {
        rfi_number,
        created_by,
        updated_by,
        updated_at,
        audit_log,
        ...fallbackPayload
      } = payload;
      result = await run(fallbackPayload);
    }
    if (result.error) throw result.error;
  };

  const saveRfi = async () => {
    if (!currentProjectId) return alert("יש לבחור פרויקט");
    if (!String(rfiForm.title ?? "").trim()) return alert("יש להזין מספר RFI");
    if (!String(rfiForm.requestDescription ?? "").trim())
      return alert("יש להזין תיאור הבקשה");
    const title =
      editingRfiId || titleHasNumber(rfiForm.title)
        ? rfiForm.title
        : nextRfiTitle();
    rememberSequentialNo("rfi", title);
    const actor =
      projectAccess?.displayName || projectAccess?.username || "משתמש מערכת";
    const actionTime = nowLocal();
    const actionIso = nowIso();
    const existing = editingRfiId
      ? savedRfis.find((item) => item.id === editingRfiId)
      : null;
    const previousAuditTrail =
      normalizeRfiRecord(existing ?? rfiForm)?.auditTrail ?? [];
    const auditEntry = {
      action: editingRfiId ? "עדכון RFI" : "פתיחת RFI",
      by: actor,
      at: actionTime,
      note: editingRfiId
        ? `עודכן סטטוס: ${rfiForm.status || "פתוח"}`
        : `נפתחה בקשה: ${title}`,
    };
    const record: RfiRecord = {
      id: editingRfiId ?? crypto.randomUUID(),
      projectId: normalizeStoredProjectId(currentProjectId),
      ...rfiForm,
      title,
      rfiNumber: rfiForm.rfiNumber ?? existing?.rfiNumber ?? null,
      createdBy: existing?.createdBy || rfiForm.createdBy || actor,
      updatedBy: actor,
      updatedAt: actionTime,
      auditTrail: [auditEntry, ...previousAuditTrail],
      documents: normalizeAttachments(rfiForm.documents),
      savedAt: nowLocal(),
    };

    await withSaving(async () => {
      if (cloudEnabled) {
        const payload = rfiRecordToRow({ ...record, updatedAt: actionIso });
        await saveRfiPayload(
          payload,
          Boolean(editingRfiId),
          editingRfiId ?? undefined,
        );
        await refreshCloudData();
      } else {
        setSavedRfis((prev) =>
          editingRfiId
            ? prev.map((item) => (item.id === editingRfiId ? record : item))
            : [record, ...prev],
        );
      }
    });
    resetRfiForm();
  };

  const loadRfi = (record: RfiRecord) => {
    setSection("rfi");
    setEditingRfiId(record.id);
    const { id, projectId, savedAt, ...form } = record;
    setRfiForm(form);
  };

  const deleteRfi = async (id: string) => {
    const record = savedRfis.find((item) => item.id === id);
    if (!window.confirm("למחוק את " + (record?.title ?? "RFI") + "?")) return;
    await withSaving(async () => {
      if (cloudEnabled) {
        const result = await supabase!
          .from("rfi_records")
          .delete()
          .eq("id", id);
        if (result.error) throw result.error;
        await refreshCloudData();
      } else {
        setSavedRfis((prev) => prev.filter((item) => item.id !== id));
      }
    });
    if (editingRfiId === id) resetRfiForm();
  };

  const closeRfi = () => {
    if (!String(rfiForm.response ?? "").trim())
      return alert("לא ניתן לסגור RFI לפני הזנת תשובת RFI / התייחסות שהתקבלה.");
    const today = new Date().toISOString().slice(0, 10);
    setRfiForm((prev: any) => ({
      ...prev,
      status: "סגור",
      closeDate: prev.closeDate || today,
      closedAt: prev.closedAt || today,
      closedBy: prev.closedBy || projectAccess?.displayName || "",
    }));
    setTimeout(
      () =>
        alert(
          "סטטוס RFI עודכן לסגור. לחץ אישור/עדכון RFI כדי לשמור את הסגירה.",
        ),
      0,
    );
  };

  const saveNonconformance = async () => {
    if (!currentProjectId) return alert("יש לבחור פרויקט");
    if (!nonconformanceForm.title.trim())
      return alert("יש להזין כותרת לאי התאמה");
    const validation = validateApproval(nonconformanceForm.approval);
    if (validation) return alert(validation);
    const id = editingNonconformanceId ?? crypto.randomUUID();
    const title =
      editingNonconformanceId || titleHasNumber(nonconformanceForm.title)
        ? nonconformanceForm.title
        : nextNonconformanceTitle();
    rememberSequentialNo("NCR", title);
    const normalizedProjectId = normalizeStoredProjectId(currentProjectId);
    const enrichedNonconformanceForm = enrichNonconformanceRecordWithProjectDetails(nonconformanceForm);
    const record: NonconformanceRecord = {
      id,
      projectId: normalizedProjectId,
      ...enrichedNonconformanceForm,
      title,
      approval: normalizeApproval(nonconformanceForm.approval),
      savedAt: nowLocal(),
    };
    await withSaving(async () => {
      if (cloudEnabled) {
        const payload = {
          id: record.id,
          project_id: normalizeStoredProjectId(record.projectId),
          description: record.description,
          action_required: record.actionRequired,
          images: normalizeAttachments((record as any).images),
          approval: record.approval,
          saved_at: nowIso(),
          details: {
            ...(record as any),
            id: undefined,
            projectId: undefined,
            savedAt: undefined,
            approval: record.approval,
            images: normalizeAttachments((record as any).images),
            title: record.title,
            projectName: (record as any).projectName,
            projectManagement: (record as any).projectManagement,
            contractor: (record as any).contractor,
            qualityAssurance: (record as any).qualityAssurance,
            qualityControl: (record as any).qualityControl,
            projectDetails: (record as any).projectDetails,
            openedBy: (record as any).openedBy,
            openedRole: (record as any).openedRole,
            raisedBy: record.raisedBy,
            date: record.date,
            location: record.location,
            building: (record as any).building,
            element: (record as any).element,
            subElement: (record as any).subElement,
            fromSection: (record as any).fromSection,
            toSection: (record as any).toSection,
            offset: (record as any).offset,
            grade: (record as any).grade,
            expectedCloseDate: (record as any).expectedCloseDate,
            updatedExpectedCloseDate: (record as any).updatedExpectedCloseDate,
            delayDays: (record as any).delayDays,
            breakage: (record as any).breakage,
            qualityImpact: (record as any).qualityImpact,
            severity: record.severity,
            status: record.status,
            description: record.description,
            responsibleParty: (record as any).responsibleParty,
            actionRequired: record.actionRequired,
            handler: (record as any).handler,
            correctiveActionDetails: (record as any).correctiveActionDetails,
            notes: record.notes,
            closedBy: (record as any).closedBy,
            closingRole: (record as any).closingRole,
            closedName: (record as any).closedName,
            closingDate: (record as any).closingDate,
          },
        };
        await saveWithApprovalFallback(
          NONCONFORMANCE_TABLE,
          payload,
          editingNonconformanceId ? "update" : "insert",
          editingNonconformanceId ?? undefined,
        );
        await refreshCloudData();
      } else
        setSavedNonconformances((prev) =>
          editingNonconformanceId
            ? prev.map((item) =>
                item.id === editingNonconformanceId ? record : item,
              )
            : [record, ...prev],
        );
    });
    resetNonconformanceEditor();
  };
  const loadNonconformance = (record: NonconformanceRecord) => {
    setSection("nonconformances");
    setEditingNonconformanceId(record.id);
    setNonconformanceForm({
      title: record.title,
      projectName: (record as any).projectName ?? (record as any).projectDetails?.projectName ?? currentProjectDefaults.projectName,
      projectManagement: (record as any).projectManagement ?? (record as any).projectDetails?.projectManagement ?? currentProjectDefaults.projectManagement,
      contractor: (record as any).contractor ?? (record as any).projectDetails?.contractor ?? currentProjectDefaults.contractor,
      qualityAssurance: (record as any).qualityAssurance ?? (record as any).projectDetails?.qualityAssurance ?? currentProjectDefaults.qualityAssurance,
      qualityControl: (record as any).qualityControl ?? (record as any).projectDetails?.qualityControl ?? currentProjectDefaults.qualityControl,
      projectDetails: (record as any).projectDetails ?? {},
      openedBy: (record as any).openedBy ?? "QA / QC",
      openedRole: (record as any).openedRole ?? "בקרת איכות",
      raisedBy: record.raisedBy,
      date: record.date,
      location: record.location,
      building: (record as any).building ?? "",
      element: (record as any).element ?? "",
      subElement: (record as any).subElement ?? "",
      fromSection: (record as any).fromSection ?? "",
      toSection: (record as any).toSection ?? "",
      offset: (record as any).offset ?? "",
      grade: (record as any).grade ?? "",
      expectedCloseDate: (record as any).expectedCloseDate ?? "",
      updatedExpectedCloseDate: (record as any).updatedExpectedCloseDate ?? "",
      delayDays: (record as any).delayDays ?? "",
      breakage: (record as any).breakage ?? "",
      qualityImpact: (record as any).qualityImpact ?? "",
      description: record.description,
      responsibleParty: (record as any).responsibleParty ?? "",
      actionRequired: record.actionRequired,
      handler: (record as any).handler ?? "",
      correctiveActionDetails: (record as any).correctiveActionDetails ?? "",
      notes: record.notes,
      closedBy: (record as any).closedBy ?? "",
      closingRole: (record as any).closingRole ?? "",
      closedName: (record as any).closedName ?? "",
      closingDate: (record as any).closingDate ?? "",
      severity: record.severity,
      status: record.status,
      images: normalizeAttachments((record as any).images),
      approval: normalizeApproval(record.approval),
    } as any);
  };
  const uploadNonconformanceAttachment = (file?: File) => {
    if (!file) return;
    const maxSizeMb = 15;
    if (file.size > maxSizeMb * 1024 * 1024) {
      alert(`הקובץ גדול מדי. ניתן לצרף קובץ עד ${maxSizeMb}MB.`);
      return;
    }

    const appendAttachment = (attachment: StoredAttachment) => {
      setNonconformanceForm((prev: any) => ({
        ...prev,
        images: [
          ...normalizeAttachments(prev?.images),
          attachment,
        ],
      }));
    };

    const fallbackToLocalFile = () => {
      const reader = new FileReader();
      reader.onload = () =>
        appendAttachment({
          name: file.name,
          type: file.type,
          dataUrl: String(reader.result ?? ""),
          uploadedAt: nowLocal(),
        });
      reader.onerror = () => alert("לא ניתן לקרוא את הקובץ המצורף.");
      reader.readAsDataURL(file);
    };

    if (cloudEnabled && supabase) {
      void (async () => {
        try {
          const safeName = file.name.replace(/[^a-zA-Z0-9.א-ת_-]/g, "_");
          const filePath = `ncr/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
          const uploadResult = await supabase.storage
            .from("attachments")
            .upload(filePath, file, {
              upsert: false,
              contentType: file.type || undefined,
            });
          if (uploadResult.error) throw uploadResult.error;
          const { data } = supabase.storage
            .from("attachments")
            .getPublicUrl(filePath);
          appendAttachment({
            name: file.name,
            type: file.type,
            dataUrl: data.publicUrl,
            uploadedAt: nowLocal(),
          });
        } catch (error) {
          console.warn("NCR attachment upload failed, saving inline fallback", error);
          fallbackToLocalFile();
        }
      })();
      return;
    }

    fallbackToLocalFile();
  };

  const removeNonconformanceAttachment = (index: number) => {
    setNonconformanceForm((prev: any) => ({
      ...prev,
      images: normalizeAttachments(prev?.images).filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const deleteNonconformance = async (id: string) =>
    withSaving(async () =>
      cloudEnabled
        ? (await supabase!.from(NONCONFORMANCE_TABLE).delete().eq("id", id),
          await refreshCloudData())
        : setSavedNonconformances((prev) =>
            prev.filter((item) => item.id !== id),
          ),
    );

  const closeNonconformance = () => {
    if (
      !String((nonconformanceForm as any).correctiveActionDetails ?? "").trim()
    )
      return alert("יש למלא פירוט ביצוע פעולה מתקנת לפני סגירה.");
    const today = new Date().toISOString().slice(0, 10);
    setNonconformanceForm((prev: any) => ({
      ...prev,
      status: "סגור",
      closingDate: prev.closingDate || today,
      closedBy: prev.closedBy || "QA / QC",
      closingRole: prev.closingRole || "QC",
      closedName: prev.closedName || projectAccess?.displayName || "",
    }));
    setTimeout(
      () =>
        alert(
          "אי ההתאמה סומנה כסגורה. לחץ אישור/עדכון אי התאמה כדי לשמור את הסגירה.",
        ),
      0,
    );
  };

  const saveTrialSection = async () => {
    if (!currentProjectId) return alert("יש לבחור פרויקט");
    const completedTrialSectionForm: any = enrichTrialSectionRecord(trialSectionForm as any);
    if (!String(completedTrialSectionForm.title || "").trim()) return alert("יש להזין שם לקטע ניסוי");
    const validation = validateApproval(completedTrialSectionForm.approval);
    if (validation) return alert(validation);
    const id = editingTrialSectionId ?? crypto.randomUUID();
    const title =
      editingTrialSectionId || titleHasNumber(completedTrialSectionForm.title)
        ? completedTrialSectionForm.title
        : nextTrialSectionTitle();
    rememberSequentialNo("trialSections", title);
    const normalizedProjectId = normalizeStoredProjectId(currentProjectId);
    const record: TrialSectionRecord = {
      id,
      projectId: normalizedProjectId,
      ...completedTrialSectionForm,
      title,
      approval: normalizeApproval(completedTrialSectionForm.approval),
      savedAt: nowLocal(),
    } as any;
    await withSaving(async () => {
      if (cloudEnabled) {
        const payload = {
          id: record.id,
          project_id: normalizeStoredProjectId(record.projectId),
          title: record.title,
          location: record.location,
          date: record.date,
          spec: record.spec,
          result: record.result,
          approved_by: record.approvedBy,
          status: record.status,
          notes: record.notes,
          images: normalizeAttachments((record as any).images),
          approval: record.approval,
          details: {
            ...(record as any),
            ...trialSectionDetails(record as any),
            title: record.title,
            location: record.location,
            date: record.date,
            fromTo: (record as any).fromTo,
            fromToSide: (record as any).fromToSide || (record as any).fromTo,
            sectionRange: (record as any).sectionRange || (record as any).fromTo,
            fromSection: (record as any).fromSection,
            toSection: (record as any).toSection,
            side: (record as any).side || (record as any).roadSide,
            materials: (record as any).materials,
            materialsForUse: (record as any).materialsForUse || (record as any).materials,
            materialsToUse: (record as any).materialsToUse || (record as any).materials,
            tools: (record as any).tools || (record as any).toolsUsed || (record as any).equipment,
            toolsUsed: (record as any).tools || (record as any).toolsUsed || (record as any).equipment,
            equipment: (record as any).tools || (record as any).toolsUsed || (record as any).equipment,
            proofOfCapability: (record as any).proofOfCapability || (record as any).capabilityProof,
            capabilityProof: (record as any).proofOfCapability || (record as any).capabilityProof,
            spec: record.spec,
            result: record.result,
            approvedBy: record.approvedBy,
            status: record.status,
            notes: record.notes,
            images: normalizeAttachments((record as any).images),
            approval: record.approval,
          },
          saved_at: nowIso(),
        };
        await saveWithApprovalFallback(
          "trial_sections",
          payload,
          editingTrialSectionId ? "update" : "insert",
          editingTrialSectionId ?? undefined,
        );
        await refreshCloudData();
      } else
        setSavedTrialSections((prev) =>
          editingTrialSectionId
            ? prev.map((item) =>
                item.id === editingTrialSectionId ? record : item,
              )
            : [record, ...prev],
        );
    });
    resetTrialSectionEditor();
  };
  const loadTrialSection = (record: TrialSectionRecord) => {
    setSection("trialSections");
    setEditingTrialSectionId(record.id);
    const details = ((record as any).details && typeof (record as any).details === "object") ? (record as any).details : {};
    setTrialSectionForm(applyProjectDefaultsToTrialSection(enrichTrialSectionRecord({
      ...(record as any),
      ...details,
      details,
      title: details.title ?? record.title,
      location: details.location ?? (record as any).location,
      date: details.date ?? (record as any).date,
      spec: details.spec ?? (record as any).spec,
      result: details.result ?? (record as any).result,
      approvedBy: details.approvedBy ?? (record as any).approvedBy,
      status: details.status ?? (record as any).status,
      notes: details.notes ?? (record as any).notes,
      images: normalizeAttachments(details.images ?? (record as any).images),
      approval: normalizeApproval(details.approval ?? record.approval),
    } as any)));
  };
  const deleteTrialSection = async (id: string) =>
    withSaving(async () =>
      cloudEnabled
        ? (await supabase!.from("trial_sections").delete().eq("id", id),
          await refreshCloudData())
        : setSavedTrialSections((prev) =>
            prev.filter((item) => item.id !== id),
          ),
    );

  const currentPreliminaryForm =
    preliminaryTab === "suppliers"
      ? supplierPreliminaryForm
      : preliminaryTab === "subcontractors"
        ? subcontractorPreliminaryForm
        : materialPreliminaryForm;
  const savePreliminary = async (subtype: PreliminaryTab) => {
    if (!currentProjectId) return alert("יש לבחור פרויקט");
    const form =
      subtype === "suppliers"
        ? supplierPreliminaryForm
        : subtype === "subcontractors"
          ? subcontractorPreliminaryForm
          : materialPreliminaryForm;
    if (!form.title.trim()) return alert("יש להזין כותרת");
    const validation = validateApproval(form.approval);
    if (validation) return alert(validation);
    const id = editingPreliminaryId ?? crypto.randomUUID();
    const title =
      editingPreliminaryId || titleHasNumber(form.title)
        ? form.title
        : nextPreliminaryTitle(subtype);
    rememberSequentialNo(preliminarySequenceKind(subtype), title);
    const normalizedProjectId = normalizeStoredProjectId(currentProjectId);
    const record = {
      id,
      projectId: normalizedProjectId,
      ...form,
      title,
      approval: normalizeApproval(form.approval),
      savedAt: nowLocal(),
    } as PreliminaryRecord;
    await withSaving(async () => {
      if (cloudEnabled) {
        const payload = {
          id: record.id,
          project_id: normalizeStoredProjectId(record.projectId),
          subtype: record.subtype,
          title: record.title,
          date: record.date,
          status: record.status,
          supplier: record.supplier ?? null,
          subcontractor: record.subcontractor ?? null,
          material: record.material ?? null,
          approval: record.approval,
          saved_at: nowIso(),
        };
        await saveWithApprovalFallback(
          "preliminary_records",
          payload,
          editingPreliminaryId ? "update" : "insert",
          editingPreliminaryId ?? undefined,
        );
        await refreshCloudData();
      } else
        setSavedPreliminary((prev) =>
          editingPreliminaryId
            ? prev.map((item) =>
                item.id === editingPreliminaryId ? record : item,
              )
            : [record, ...prev],
        );
    });
    resetPreliminaryEditor();
  };
  const loadPreliminary = (record: PreliminaryRecord) => {
    setSection("preliminary");
    setPreliminaryTab(record.subtype);
    setEditingPreliminaryId(record.id);
    if (record.subtype === "suppliers")
      setSupplierPreliminaryForm({
        subtype: "suppliers",
        title: record.title,
        date: record.date,
        status: record.status,
        supplier:
          record.supplier ?? createDefaultPreliminary("suppliers").supplier,
        approval: normalizeApproval(record.approval),
      });
    if (record.subtype === "subcontractors")
      setSubcontractorPreliminaryForm({
        subtype: "subcontractors",
        title: record.title,
        date: record.date,
        status: record.status,
        subcontractor:
          record.subcontractor ??
          createDefaultPreliminary("subcontractors").subcontractor,
        approval: normalizeApproval(record.approval),
      });
    if (record.subtype === "materials")
      setMaterialPreliminaryForm({
        subtype: "materials",
        title: record.title,
        date: record.date,
        status: record.status,
        material:
          record.material ?? createDefaultPreliminary("materials").material,
        approval: normalizeApproval(record.approval),
      });
  };
  const deletePreliminary = async (id: string) =>
    withSaving(async () =>
      cloudEnabled
        ? (await supabase!.from("preliminary_records").delete().eq("id", id),
          await refreshCloudData())
        : setSavedPreliminary((prev) => prev.filter((item) => item.id !== id)),
    );

  const guardedBody =
    !currentProject &&
    section !== "home" &&
    section !== "projects" &&
    section !== "projectDetails" &&
    section !== "projectUsers" ? (
      <div style={styles.emptyBox}>יש לבחור פרויקט לפני עבודה במסך זה.</div>
    ) : projectLegendMissing &&
      section !== "home" &&
      section !== "projects" &&
      section !== "projectDetails" &&
      section !== "projectUsers" ? (
      <div style={styles.emptyBox}>
        יש להשלים מקרא / פרטי פרויקט לפני עבודה במסך זה.
      </div>
    ) : null;
  const homeModules = [
    {
      key: "projectDetails",
      title: "פרטי הפרויקט",
      icon: "🏗️",
      description: "מקרא, גורמים ופרטי התקשרות",
      count: currentProject ? 1 : 0,
    },
    {
      key: "projectUsers",
      title: "משתמשים",
      icon: "👥",
      description: "נמעני מיילים של הפרויקט",
      count: currentProjectEmailUsers.filter((user) => user.active).length,
    },
    ...(isAdminAccess(projectAccess)
      ? [
          {
            key: "projects",
            title: "פרויקטים",
            icon: "📁",
            description: "הוספה, עריכה וניהול פרויקטים",
            count: accessibleProjects.length,
          },
        ]
      : []),
    {
      key: "checklists",
      title: "רשימות תיוג",
      icon: "📋",
      description: "טפסי בקרת איכות לפי תבנית",
      count: projectChecklists.length,
    },
    {
      key: "nonconformances",
      title: "אי תאמות",
      icon: "⚠️",
      description: "מעקב סטטוסים ופעולות מתקנות",
      count: projectNonconformances.length,
    },
    {
      key: "trialSections",
      title: "קטעי ניסוי",
      icon: "🧪",
      description: "ניהול אישורי קטעי ניסוי",
      count: projectTrialSections.length,
    },
    {
      key: "preliminary",
      title: "בקרה מקדימה",
      icon: "🗂️",
      description: "ספקים, קבלנים וחומרים",
      count: projectPreliminary.length,
    },
    {
      key: "rfi",
      title: "RFI",
      icon: "📨",
      description: "ניהול תיקיית RFI",
      count: projectRfis.length,
    },
    {
      key: "supervisionReports",
      title: "דוחות פיקוח עליון",
      icon: "🏛️",
      description: "תיקיית דוחות פיקוח עליון",
      count: 0,
    },
    {
      key: "concentrations",
      title: "ריכוזים",
      icon: "📊",
      description: "ריכוזי בדיקות אוטומטיים",
      count: 0,
    },
  ];
  const labelForPreliminary = (subtype: PreliminaryTab) =>
    subtype === "suppliers"
      ? "ספקים"
      : subtype === "subcontractors"
        ? "קבלנים"
        : "חומרים";

  const CONTROLENG_LOGO_DATA_URI =
    "data:image/png;base64,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";
  const exportLogoSrc = () => CONTROLENG_LOGO_DATA_URI;
  const CONTROLENG_LOGO_ICON_DATA_URI =
    "data:image/png;base64,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";
  const CONTROLENG_LOGO_TEXT_DATA_URI =
    "data:image/png;base64,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";
  const exportCompanyHeader = () => `<div class="company-header" dir="rtl">
    <div class="company-header-line"></div>
    <div class="company-header-logo-box">
      <img class="company-full-logo" src="${CONTROLENG_LOGO_DATA_URI}" alt="CONTROLENG PRIME LTD" />
    </div>
    <div class="company-header-line"></div>
  </div>`;

  const exportCompanyFooter = () => `<div class="company-footer" dir="rtl">
    <div class="company-footer-line"></div>
    <div class="company-footer-single">
      <span class="company-footer-service">שירותי הנדסה, פיקוח ובקרת איכות</span>
      <span class="company-footer-contact">בית ג׳אן 249900&nbsp;&nbsp;|&nbsp;&nbsp;<span dir="ltr">q.controling@gmail.com</span></span>
    </div>
  </div>`;

  const safeText = (value: unknown) =>
    String(value ?? "").replace(
      /[&<>]/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char] ?? char,
    );
  const compactHeight = (height = 18) => Math.min(Number(height) || 18, 14);
  const blankCell = (height = 18) =>
    `<div class="blank-cell" style="min-height:${compactHeight(height)}px">&nbsp;</div>`;
  const valueOrBlank = (value: unknown, height = 18) => {
    const text = String(value ?? "").trim();
    return text ? safeText(text) : blankCell(height);
  };
  const checklistAttachmentSummary = (item: unknown) => {
    const attachments = normalizeChecklistAttachments(
      (item as any)?.attachments,
    );
    if (!attachments.length) return "";
    return attachments
      .map(
        (attachment) =>
          `${checklistAttachmentLabel(attachment.kind)}: ${attachment.name}`,
      )
      .join(" | ");
  };

  const checklistNotesOrAttachments = (item: unknown, height = 18) => {
    const attachments = checklistAttachmentSummary(item);
    const notes = String((item as any)?.notes ?? "").trim();
    const combined = [attachments, notes].filter(Boolean).join(" | ");
    return valueOrBlank(combined, height);
  };

  const embeddedAttachmentForExport = (
    file: { name?: string; type?: string; dataUrl?: string },
    title?: string,
  ) => {
    const src = String(file?.dataUrl ?? "").trim();
    if (!src) return "";
    const type = String(file?.type ?? "").toLowerCase();
    const name = safeText(file?.name || title || "קובץ מצורף");
    const isImage = type.startsWith("image/") || src.startsWith("data:image/");
    const isPdf = type.includes("pdf") || src.startsWith("data:application/pdf");

    if (isImage) {
      return `<div class="attachment-page"><h2>${name}</h2><img class="attachment-image-full" src="${safeText(src)}" /></div>`;
    }

    if (isPdf) {
      return `<div class="attachment-page"><h2>${name}</h2><div class="attachment-note">קובץ PDF מצורף לטופס. אם הדפדפן אינו מדפיס את התצוגה המקדימה, ניתן לפתוח אותו מהקישור.</div><div class="attachment-link-box">${attachmentLink(name, src)}</div><object class="attachment-pdf-object" data="${safeText(src)}" type="application/pdf"><iframe class="attachment-pdf-object" src="${safeText(src)}"></iframe></object></div>`;
    }

    return `<div class="attachment-page"><h2>${name}</h2><div class="attachment-link-box">${attachmentLink(name, src)}</div></div>`;
  };

  const checklistAttachmentsExportTable = (items: unknown) => {
    const rows = normalizeChecklistItems(items).flatMap((item: any) =>
      normalizeChecklistAttachments(item.attachments).map((attachment) => ({
        item,
        attachment,
      })),
    );
    if (!rows.length) return "";
    const table = `<h2>מסמכים שצורפו לרשימת התיוג</h2><table class="checklist-attachments-export"><thead><tr><th>תהליך בקרה</th><th>סוג מסמך</th><th>שם קובץ</th></tr></thead><tbody>${rows.map(({ item, attachment }) => `<tr><td>${valueOrBlank(item.description, 28)}</td><td>${safeText(checklistAttachmentLabel(attachment.kind))}</td><td>${attachmentLink(attachment.name, attachment.dataUrl)}</td></tr>`).join("")}</tbody></table>`;
    const embedded = rows
      .map(({ item, attachment }) =>
        embeddedAttachmentForExport(attachment, `${checklistAttachmentLabel(attachment.kind)} - ${String(item.description ?? "")}`),
      )
      .join("");
    return `${table}${embedded}`;
  };

  const exportStyles = `
    body{font-family:Arial,sans-serif;direction:rtl;padding:5px;color:#0f172a;font-size:9.5px;background:#fff}
    .export-page{width:100%;box-sizing:border-box;margin:0 auto;page-break-after:avoid;break-after:avoid}
    h1{display:none}
    h2{font-size:11px;margin:4px 0 2px;border-bottom:1px solid #111827;padding-bottom:3px;text-align:right}
    table{border-collapse:collapse;width:100%;margin:0 0 8px;table-layout:fixed;page-break-inside:auto}
    th,td{border:1px solid #111827;padding:3px 5px;vertical-align:middle;text-align:center;word-break:break-word;overflow-wrap:anywhere;white-space:normal;line-height:1.35}
    th{background:#f8fafc;font-weight:800}
    .base-rows th{width:18%;font-weight:800}.base-rows td{width:32%;font-weight:600}.base-rows .full-value{text-align:center}
    .meta{display:none}.blank-cell{min-height:18px}.header-title{font-size:17px;font-weight:900}.small{font-size:10px}.empty{background:#fff}
    .doc-header td{height:28px}.source-meta td{height:28px}.check-table td{height:34px}.check-table th{height:30px;background:#f8fafc}
    .wide-label{font-weight:800}.no-border{border:0!important}.signature td{height:20px}
    .company-header{width:100%;margin:0 0 12px;page-break-inside:avoid;box-sizing:border-box;border:0!important}
    .company-header-line,.company-footer-line{height:4px;background:#8a7d5b;width:100%;margin:0;border:0!important}
    .company-header-logo-box{height:54px;width:100%;display:block;text-align:center;background:#fff!important;border:0!important;box-sizing:border-box;padding:5px 0;overflow:hidden}
    .company-full-logo{height:48px!important;max-height:48px!important;width:auto!important;max-width:130px!important;display:inline-block!important;border:0!important;outline:0!important;object-fit:contain!important;vertical-align:middle!important}
    .company-footer{width:100%;margin:6px 0 0;page-break-inside:avoid;box-sizing:border-box;border:0!important}
    .company-footer-single{height:20px;line-height:17px;font-size:9px;font-weight:700;color:#111827;box-sizing:border-box;text-align:center;border:0!important;background:#fff!important;padding:3px 5px;white-space:nowrap}
    .company-footer-service{display:inline-block;margin-left:22px;text-align:left;border:0!important;background:transparent!important}
    .company-footer-contact{display:inline-block;text-align:right;direction:rtl;border:0!important;background:transparent!important}
    .checklist-export-title{font-size:19px;font-weight:900;text-align:center;text-decoration:underline;margin:8px 0 10px}
    .checklist-top-table th{font-size:11px}.checklist-top-table td{font-size:11px;font-weight:600;min-height:28px}
    .check-table .activity{text-align:right;font-weight:600}.check-table img{max-width:100px;max-height:42px}
    .checklist-attachments-export td{text-align:right}
    .attachment-page{page-break-before:always;break-before:page;margin-top:8px;min-height:180mm}
    .attachment-page h2{font-size:16px;text-align:center;margin:0 0 8px;border-bottom:1px solid #111827;padding-bottom:5px}
    .attachment-image-full{display:block;margin:0 auto;max-width:100%;max-height:175mm;object-fit:contain}
    .attachment-pdf-object{width:100%;height:175mm;border:1px solid #111827;background:#fff}
    .attachment-note{font-size:12px;text-align:center;margin:0 0 8px;color:#334155}
    .attachment-summary{font-size:12px;font-weight:800;text-align:right;margin:0 0 6px;color:#0f172a}
    .attachment-link-box{text-align:center;margin:8px 0;font-weight:800}
    .trial-report{width:100%;margin:0 0 6px;table-layout:fixed}
    .trial-report th,.trial-report td{font-size:10px;line-height:1.35;min-height:24px;height:auto;padding:3px 5px}
    .trial-report .trial-title{font-size:18px;font-weight:900;text-align:center}
    .trial-report .label{font-weight:800;width:32%}
    .trial-report .value{height:26px}
    .trial-report .large-value{height:56px}
    @page{size:A4 landscape;margin:8mm}
    @media print{button{display:none} body{padding:0;font-size:10px} th,td{padding:3px 4px}.header-title{font-size:15px}.company-header-logo-box{height:58px}.company-full-logo{height:52px!important;max-height:52px!important;max-width:115px!important}.company-footer-single{font-size:10px}}
  `;

  const recordTitleForExport = () => {
    if (section === "checklists") return checklistForm.title || "רשימת תיוג";
    if (section === "nonconformances")
      return nonconformanceForm.title || "אי התאמה";
    if (section === "trialSections")
      return trialSectionForm.title || "קטע ניסוי";
    if (section === "preliminary")
      return currentPreliminaryForm.title || "בקרה מקדימה";
    if (section === "controlProcesses")
      return controlProcessForm.title || "בקרה מקדימה / תעודת ייחוס";
    return "טופס";
  };

  const isLongExportRow = (row?: [string, unknown, number?]) => Number(row?.[2] ?? 0) >= 70;

  const baseRows = (rows: Array<[string, unknown, number?]>) => {
    const htmlRows: string[] = [];
    for (let index = 0; index < rows.length; index += 1) {
      const first = rows[index];
      if (!first) continue;
      const [label, value, height] = first;
      if (isLongExportRow(first)) {
        htmlRows.push(`<tr><th>${safeText(label)}</th><td class="full-value" colspan="3">${valueOrBlank(value, height ?? 34)}</td></tr>`);
        continue;
      }
      const second = rows[index + 1];
      if (second && !isLongExportRow(second)) {
        const [label2, value2, height2] = second;
        htmlRows.push(`<tr><th>${safeText(label)}</th><td>${valueOrBlank(value, height ?? 26)}</td><th>${safeText(label2)}</th><td>${valueOrBlank(value2, height2 ?? 26)}</td></tr>`);
        index += 1;
      } else {
        htmlRows.push(`<tr><th>${safeText(label)}</th><td>${valueOrBlank(value, height ?? 26)}</td><th class="empty">&nbsp;</th><td class="empty">&nbsp;</td></tr>`);
      }
    }
    return `<table class="base-rows"><tbody>${htmlRows.join("")}</tbody></table>`;
  };

  const attachmentLink = (name: unknown, url: unknown) => {
    const href = String(url ?? "").trim();
    const label = safeText(name || "פתח קובץ מצורף");
    return href
      ? `<a href="${safeText(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : label;
  };

  const attachmentPreview = (file: StoredAttachment) => {
    const src = String(file.dataUrl ?? "").trim();
    if (
      !src ||
      !(
        String(file.type ?? "").startsWith("image/") ||
        src.startsWith("data:image/")
      )
    )
      return "";
    return `<div style="margin-top:2px"><img src="${safeText(src)}" style="max-width:120px;max-height:90px;object-fit:contain" /></div>`;
  };

  const attachmentsList = (items: unknown) => {
    const attachments = normalizeAttachments(items);
    if (!attachments.length) return "";
    const table = `<h2>תמונות / קבצים מצורפים</h2><table><thead><tr><th>שם קובץ</th><th>סוג</th></tr></thead><tbody>${attachments.map((file) => `<tr><td>${attachmentLink(file.name, file.dataUrl)}</td><td>${safeText(file.type || "קובץ")}</td></tr>`).join("")}</tbody></table>`;
    const embedded = attachments.map((file) => embeddedAttachmentForExport(file)).join("");
    return `${table}${embedded}`;
  };

  const signatureCell = (value: unknown) => {
    const text = String(value ?? "");
    if (text.startsWith("data:image/"))
      return `<img src="${text}" style="max-width:120px;max-height:45px" />`;
    return valueOrBlank(text);
  };

  const signaturesTable = (approval: ApprovalFlow | undefined) => {
    const normalized = normalizeApproval(approval);
    return `<h2>אישורים וחתימות</h2><table class="signature"><thead><tr><th>תפקיד</th><th>שם</th><th>חתימה</th><th>תאריך</th><th>הערות</th></tr></thead><tbody>${normalized.signatures.map((sig) => `<tr><td>${safeText(sig.role)}</td><td>${valueOrBlank(sig.signerName)}</td><td>${signatureCell(sig.signature)}</td><td>${valueOrBlank(sig.signedAt)}</td><td>${blankCell()}</td></tr>`).join("")}</tbody></table>`;
  };

  const checklistExportHtml = (forcedChecklistNo?: number) => {
    const rawItems = normalizeChecklistItems(checklistForm.items) as Array<ChecklistItem & { attachments?: ChecklistAttachment[]; signature?: ProcessSignature; excludedFromPrint?: boolean }>;
    const templateKey = normalizeChecklistTemplateKey(checklistForm.templateKey);
    const template = checklistTemplates[templateKey] as any;
    const title = checklistForm.title || template.title || "רשימת תיוג";
    const procedureNo = template.procedureNo || "";
    const edition = (checklistForm as any).revision || template.edition || CHECKLIST_DEFAULT_REVISION;
    const procedureDate = (checklistForm as any).revisionDate || template.procedureDate || CHECKLIST_DEFAULT_REVISION_DATE;
    const profile = currentProjectProfile ?? getProjectProfile(projectName);
    const currentChecklistNo =
      forcedChecklistNo ??
      getExistingEditingChecklistNo() ??
      (checklistForm as any).checklistNo ??
      "";

    // הייצוא מבוסס על מה שהמשתמש מילא בפועל במערכת, ולא על תבנית קשיחה מוכנה מראש.
    const exportProjectName =
      (checklistForm as any).projectNameDisplay || profile?.projectName || projectName || "";
    const exportContractor = checklistForm.contractor || profile?.contractor || "";
    const executionPlanNo = checklistForm.location || "";
    const roadStructure = (checklistForm as any).roadStructure || "";
    const stationSection = (checklistForm as any).stationSection || "";
    const toStationSection = (checklistForm as any).toStationSection || "";
    const offset = (checklistForm as any).offset || "";
    const notes = checklistForm.notes || "";

    const displayedItems = rawItems.filter((item) => !Boolean((item as any).excludedFromPrint));

    const getItemSignature = (item: any) =>
      normalizeProcessSignature(
        item.signature,
        item.responsible || "גורם אחראי",
        resolveResponsibleName(item.responsible, projectName) || item.inspector || "",
      );

    const itemSignerName = (item: any) => {
      const sig = getItemSignature(item);
      return sig.signerName || resolveResponsibleName(item.responsible, projectName) || item.inspector || "";
    };

    const itemSignature = (item: any) => {
      const sig = getItemSignature(item);
      return signatureCell(sig.signature || "");
    };

    const itemDate = (item: any) => {
      const sig = getItemSignature(item);
      return sig.signedAt || item.executionDate || "";
    };

    const itemLabOrNotes = (item: ChecklistItem & { attachments?: ChecklistAttachment[] }) => {
      const attachments = normalizeChecklistAttachments((item as any).attachments);
      const attachmentNames = attachments.map((attachment) => attachment.name).filter(Boolean).join(" / ");
      return attachmentNames || item.notes || "";
    };

    const rowsHtml = displayedItems.length
      ? displayedItems.map((item) => `<tr>
          <td class="activity">${valueOrBlank(item.description, 42)}</td>
          <td>${valueOrBlank(item.responsible, 28)}</td>
          <td>${valueOrBlank(itemSignerName(item), 28)}</td>
          <td>${itemSignature(item)}</td>
          <td>${valueOrBlank(itemDate(item), 22)}</td>
          <td>${valueOrBlank(itemLabOrNotes(item), 38)}</td>
        </tr>`).join("")
      : `<tr><td colspan="6">לא מולאו סעיפי בקרה</td></tr>`;

    return `<div class="checklist-export-title">${safeText(title)}</div>
    <table class="doc-header">
      <tbody>
        <tr><td>מס׳ שכבה:</td><td colspan="5">שם הנוהל:</td><td>מהדורה:</td><td>תאריך:</td></tr>
        <tr><td>${valueOrBlank(procedureNo, 20)}</td><td colspan="5" class="header-title">${safeText(title)}</td><td>${valueOrBlank(edition, 16)}</td><td>${valueOrBlank(procedureDate, 18)}</td></tr>
      </tbody>
    </table>
    <table class="checklist-top-table source-meta">
      <tbody>
        <tr><th>שם הפרויקט</th><th>קבלן מבצע</th><th>מס׳ שכבה</th><th>כביש / מבנה</th><th>מספר רשימת תיוג</th></tr>
        <tr><td>${valueOrBlank(exportProjectName, 28)}</td><td>${valueOrBlank(exportContractor, 28)}</td><td>${valueOrBlank(executionPlanNo, 24)}</td><td>${valueOrBlank(roadStructure, 22)}</td><td>${valueOrBlank(currentChecklistNo, 18)}</td></tr>
        <tr><th>מחתך</th><th>לחתך</th><th>היטס</th><th colspan="2">הערות</th></tr>
        <tr><td>${valueOrBlank(stationSection, 18)}</td><td>${valueOrBlank(toStationSection, 18)}</td><td>${valueOrBlank(offset, 18)}</td><td colspan="2">${valueOrBlank(notes, 40)}</td></tr>
      </tbody>
    </table>
    <table class="check-table">
      <thead>
        <tr><th colspan="6" class="wide-label">תאור פעילות הבקרה &nbsp;&nbsp; אישור שלבי התהליך ע״י בקרת האיכות</th></tr>
        <tr><th style="width:34%">תיאור פעולת הבקרה</th><th style="width:14%">באחריות</th><th style="width:14%">שם</th><th style="width:12%">חתימה</th><th style="width:11%">תאריך</th><th style="width:15%">תעודת מעבדה / הערות</th></tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    ${checklistAttachmentsExportTable(displayedItems)}`;
  };

  const nonconformanceAttachmentsSummary = (items: unknown) => {
    const attachments = normalizeAttachments(items);
    if (!attachments.length) return "";
    const imageCount = attachments.filter((file) => {
      const type = String(file.type ?? "").toLowerCase();
      const src = String(file.dataUrl ?? "").toLowerCase();
      return type.startsWith("image/") || src.startsWith("data:image/");
    }).length;
    const documentCount = attachments.length - imageCount;
    const rows = attachments
      .map((file, index) => {
        const type = String(file.type ?? "").toLowerCase();
        const src = String(file.dataUrl ?? "").toLowerCase();
        const isImage = type.startsWith("image/") || src.startsWith("data:image/");
        const label = isImage ? `תמונה ${index + 1}` : `קובץ / תעודה ${index + 1}`;
        return `<tr><td>${safeText(label)}</td><td>${safeText(file.name || label)}</td><td>${safeText(file.type || (isImage ? "תמונה" : "קובץ"))}</td></tr>`;
      })
      .join("");
    const summary = [
      imageCount ? `${imageCount} תמונות צורפו` : "",
      documentCount ? `${documentCount} קבצים / תעודות צורפו` : "",
    ].filter(Boolean).join(" | ");
    return `<h2>קבצים / תמונות מצורפים</h2><div class="attachment-summary">${safeText(summary)}</div><table><thead><tr><th>סוג צירוף</th><th>שם / מספר קובץ</th><th>סוג קובץ</th></tr></thead><tbody>${rows}</tbody></table>`;
  };

  const nonconformanceExportHtml = () => {
    const f: any = enrichNonconformanceRecordWithProjectDetails(nonconformanceForm);
    return `${baseRows([
      ...nonconformanceProjectDetailRows(f),
      ["אי התאמה מס׳", f.title],
      ["נפתח QA / QC", f.openedBy],
      ["תפקיד", f.openedRole],
      ["שם פותח", f.raisedBy],
      ["תאריך פתיחה", f.date],
      ["קטע", f.location],
      ["מבנה", f.building],
      ["אלמנט", f.element],
      ["תת אלמנט", f.subElement],
      ["מחתך", f.fromSection],
      ["עד חתך", f.toSection],
      ["הסט", f.offset],
      ["דרגה", f.grade],
      ["תאריך סגירה משוער", f.expectedCloseDate],
      ["תאריך סגירה משוער מעודכן", f.updatedExpectedCloseDate],
      ["מס׳ ימי עיכוב לסגירה", f.delayDays],
      ["שבר", f.breakage],
      ["השפעה על איכות", f.qualityImpact],
      ["חומרה", f.severity],
      ["סטטוס", f.status],
      ["תיאור אי ההתאמה", f.description, 110],
      ["גורם אחראי לליקוי תכנון, ביצוע, ספק", f.responsibleParty, 90],
      ["טיפול נדרש", f.actionRequired, 100],
      ["גורם המטפל", f.handler],
      ["פירוט ביצוע פעולה מתקנת", f.correctiveActionDetails, 110],
      ["הערות", f.notes, 80],
      ["נסגרה ע״י", f.closedBy],
      ["תפקיד סגירה", f.closingRole],
      ["שם סוגר", f.closedName],
      ["תאריך סגירה", f.closingDate],
    ])}${nonconformanceAttachmentsSummary(f.images)}${signaturesTable(f.approval)}`;
  };

  const trialSectionExportHtml = () => {
    const f: any = enrichTrialSectionRecord(trialSectionForm as any);
    const details: any = (f as any).details ?? {};
    const profile = currentProjectProfile ?? getProjectProfile(projectName);
    const get = (...keys: string[]) => {
      for (const key of keys) {
        const value = f?.[key] ?? details?.[key];
        if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
      }
      return "";
    };
    const trialProjectName = get("projectName", "projectNameDisplay") || currentProjectLegend.projectName || profile?.projectName || projectName;
    const trialProjectManager = get("projectManagement", "managementCompany") || currentProjectLegend.projectManagement || profile?.projectManager || "";
    const trialContractor = get("contractor", "mainContractor") || currentProjectLegend.contractor || profile?.contractor || "";
    const trialNo = get("sectionNo", "sectionNumber", "trialSectionNo", "trialNo", "number") ||
      String(get("title") || f.title || "").replace(/^\s*קטע\s+ניסוי\s*(מס['׳]?|מספר)?\s*/i, "").trim();
    const visibleTrial = readTrialFormVisibleValues();
    const materialsText = firstFilled(visibleTrial.materials, get("materials", "materialsForUse", "materialsToUse", "materialForUse"));
    const fromTo = firstFilled(
      visibleTrial.fromTo,
      combineSectionRange(
        firstFilled(visibleTrial.fromSection, get("fromSection", "fromChainage", "fromStation")),
        firstFilled(visibleTrial.toSection, get("toSection", "toChainage", "toStation")),
        firstFilled(visibleTrial.side, get("side", "roadSide")),
      ),
      get("fromTo", "fromToSide", "sectionRange", "sectionRangeSide", "chainage", "chainageRange", "stationRange"),
    );
    const participantsText = get("participants");
    const toolsText = firstFilled(visibleTrial.tools, get("tools", "toolsInUse", "toolsUsed", "equipment", "equipmentUsed", "usedTools", "machinery", "toolsList"));
    const proofText = firstFilled(visibleTrial.proofOfCapability, get("proofOfCapability", "capabilityProof", "proof", "abilityProof", "classificationProof", "classifiedCapabilityProof"));
    const executionText = get("executionDescription", "executionStages", "workStages", "trialSteps", "description", "spec");
    const resultText = get("result", "conclusions", "trialConclusions");
    const images = normalizeAttachments(f.images ?? details.images);
    return `${baseRows([
      ["קטע ניסוי", trialNo || get("title") || ""],
      ["שם הפרויקט", trialProjectName],
      ["חברת ניהול", trialProjectManager],
      ["קבלן ראשי", get("mainContractor") || trialContractor],
      ["חברת בקרת איכות", get("qualityCompany", "qualityControl") || currentProjectLegend.qualityControl || profile?.qualityControl || CONTROL_QUALITY_COMPANY_NAME],
      ["חומרים לשימוש", materialsText],
      ["שם האלמנט", get("elementName", "element")],
      ["תת אלמנט", get("subElement")],
      ["מחתך / עד חתך", fromTo],
      ["משתתפים בקטע ניסוי", participantsText, 70],
      ["כלים בהם משתמשים", toolsText, 55],
      ["תאריך ביצוע", get("executionDate", "date")],
      ["הוכחת היכולת לפעולה מסווג", proofText, 60],
      ["תיאור קטע ניסוי / שלבי ביצוע", executionText, 100],
      ["תוצאה / מסקנות קטע ניסוי", resultText, 70],
      ["פעולה מתקנת / נדרשת", get("correctiveAction", "requiredAction", "actionRequired"), 55],
      ["אושר על ידי", get("approvedBy")],
      ["סטטוס", get("status")],
      ["הערות", get("notes"), 45],
    ])}${attachmentsList(images)}${signaturesTable(f.approval)}`;
  };

  const requiredDocumentsExportTable = (items: unknown) => {
    const docs = normalizeRequiredDocuments(items).filter(
      (doc) => doc.attached || doc.attachmentName || doc.attachmentDataUrl || doc.expiryDate || doc.certificateNo,
    );
    if (!docs.length) return "";
    return `<h2>קבצים / מסמכים שצורפו</h2><table><thead><tr><th>סוג</th><th>תיאור</th><th>מס׳ תעודה</th><th>תאריך תפוגה</th><th>קובץ</th></tr></thead><tbody>${docs.map((doc) => `<tr><td>${safeText(doc.type)}</td><td>${valueOrBlank(doc.description, 24)}</td><td>${safeText((doc as any).certificateNo || "")}</td><td>${safeText((doc as any).expiryDate || "")}</td><td>${attachmentLink(doc.attachmentName || "קובץ מצורף", doc.attachmentDataUrl)}</td></tr>`).join("")}</tbody></table>`;
  };

  const preliminaryCertificateExportTable = (record: any) => {
    const rows = collectCertificateRows(record);
    if (!rows.length) return "";
    return `<h2>מסמכים / תעודות / רישיונות</h2><table><thead><tr><th>פרטים</th><th>קיים</th><th>מס׳ תעודה</th><th>תאריך תפוגה</th><th>קבצים</th></tr></thead><tbody>${rows.map((row: any) => {
      const files = Array.isArray(row?.attachments) ? row.attachments : [];
      const fileLinks = files.length ? files.map((file: any) => attachmentLink(file?.name || "קובץ", file?.dataUrl)).join("<br/>") : attachmentLink(row?.attachmentName || "", row?.attachmentDataUrl);
      return `<tr><td>${safeText(row?.details || row?.description || row?.type || "")}</td><td>${row?.exists === false ? "לא" : "כן"}</td><td>${safeText(row?.certificateNo || row?.documentNo || "")}</td><td>${safeText(row?.expiryDate || row?.validUntil || "")}</td><td>${fileLinks || ""}</td></tr>`;
    }).join("")}</tbody></table>`;
  };


  const referenceResultsExportTable = (workType: unknown, rowsValue: unknown) => {
    const rows = ensureReferenceResultsForMaterial(workType, rowsValue).filter(
      (row) => row.metric || row.resultValue || row.qualityStatus || row.minValue || row.maxValue,
    );
    if (!rows.length) return "";
    return `<h2>תוצאות הזמנה מפורטות</h2><table><thead><tr><th>מדד תוצאה</th><th>ערך תוצאה</th><th>סטטוס איכות</th><th>ערך מינימלי</th><th>ערך מקסימלי</th></tr></thead><tbody>${rows
      .map(
        (row) =>
          `<tr><td>${safeText(row.metric)}</td><td>${safeText(row.resultValue)}</td><td>${safeText(row.qualityStatus)}</td><td>${safeText(row.minValue)}</td><td>${safeText(row.maxValue)}</td></tr>`,
      )
      .join("")}</tbody></table>`;
  };

  const controlProcessExportHtml = () =>
    `${baseRows([
      ["מס׳ תעודה / ר״ת", controlProcessForm.processNo],
      ["שם התעודה", controlProcessForm.title],
      ["תחום / סוג עבודה", controlProcessForm.workType],
      ["סעיף מפרט / תקן", controlProcessForm.specSection],
      ["מיקום / שימוש מיועד", controlProcessForm.location],
      ["מחתך", controlProcessForm.fromSection],
      ["עד חתך", controlProcessForm.toSection],
      ["סטטוס", controlProcessForm.status],
      ["ספק / מפעל", (controlProcessForm as any).supplier],
      ["מס׳ תעודת מעבדה", (controlProcessForm as any).labCertificateNo],
    ])}${referenceResultsExportTable(controlProcessForm.workType, (controlProcessForm as any).referenceResults)}${requiredDocumentsExportTable(controlProcessForm.requiredDocuments)}${signaturesTable(controlProcessForm.approval)}`;

  const preliminaryRows = () => {
    if (preliminaryTab === "suppliers") {
      const s = supplierPreliminaryForm.supplier ?? ({} as any);
      return (
        baseRows([
          ["סוג בקרה", "ספקים"],
          ["כותרת", supplierPreliminaryForm.title],
          ["תאריך", supplierPreliminaryForm.date],
          ["סטטוס", supplierPreliminaryForm.status],
          ["שם ספק", (s as any).supplierName],
          ["חומר מסופק", (s as any).suppliedMaterial],
          ["טלפון", (s as any).contactPhone],
          ["מספר אישור", (s as any).approvalNo],
          ["הערות", (s as any).notes, 90],
        ]) + preliminaryCertificateExportTable(supplierPreliminaryForm) + signaturesTable(supplierPreliminaryForm.approval)
      );
    }
    if (preliminaryTab === "subcontractors") {
      const s = subcontractorPreliminaryForm.subcontractor ?? ({} as any);
      return (
        baseRows([
          ["סוג בקרה", "קבלנים"],
          ["כותרת", subcontractorPreliminaryForm.title],
          ["תאריך", subcontractorPreliminaryForm.date],
          ["סטטוס", subcontractorPreliminaryForm.status],
          ["שם קבלן משנה", (s as any).subcontractorName],
          ["תחום", (s as any).field],
          ["טלפון", (s as any).contactPhone],
          ["מספר אישור", (s as any).approvalNo],
          ["הערות", (s as any).notes, 90],
        ]) + preliminaryCertificateExportTable(subcontractorPreliminaryForm) + signaturesTable(subcontractorPreliminaryForm.approval)
      );
    }
    const m = materialPreliminaryForm.material ?? ({} as any);
    return (
      baseRows([
        ["סוג בקרה", "חומרים"],
        ["כותרת", materialPreliminaryForm.title],
        ["תאריך", materialPreliminaryForm.date],
        ["סטטוס", materialPreliminaryForm.status],
        ["שם חומר", (m as any).materialName],
        ["מקור", (m as any).source],
        ["שימוש", (m as any).usage],
        ["מספר תעודה", (m as any).certificateNo],
        ["הערות", (m as any).notes, 90],
      ]) + preliminaryCertificateExportTable(materialPreliminaryForm) + signaturesTable(materialPreliminaryForm.approval)
    );
  };

  const exportHtml = (forcedChecklistNo?: number) => {
    const title = recordTitleForExport();
    const body =
      section === "checklists"
        ? checklistExportHtml(forcedChecklistNo)
        : section === "nonconformances"
          ? nonconformanceExportHtml()
          : section === "trialSections"
            ? trialSectionExportHtml()
            : section === "preliminary"
              ? preliminaryRows()
              : section === "controlProcesses"
                ? controlProcessExportHtml()
                : "";
    const header = exportCompanyHeader();
    const footer = exportCompanyFooter();
    return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${safeText(title)}</title><style>${exportStyles}</style></head><body><div class="export-page">${header}<h1>${safeText(title)}</h1><div class="meta">פרויקט: ${safeText(projectName)}</div>${body}${footer}</div></body></html>`;
  };

  const downloadTextFile = (
    filename: string,
    mimeType: string,
    content: string,
  ) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const getExportChecklistNo = () =>
    section === "checklists" ? ensureChecklistNo() : undefined;
  const exportWord = () =>
    downloadTextFile(
      `${recordTitleForExport()}.doc`,
      "application/msword;charset=utf-8",
      exportHtml(getExportChecklistNo()),
    );
  const exportExcel = () =>
    downloadTextFile(
      `${recordTitleForExport()}.xls`,
      "application/vnd.ms-excel;charset=utf-8",
      `﻿${exportHtml(getExportChecklistNo())}`,
    );
  const exportPdf = async () => {
    try {
      const exportChecklistNo = getExportChecklistNo();
      const title = recordTitleForExport();
      const blob = await buildMergedPdfBlob(title, exportHtml(exportChecklistNo));
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, "_blank");
      if (!opened) {
        const link = document.createElement("a");
        link.href = url;
        link.download = `${title}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      alert(error instanceof Error ? error.message : "יצירת PDF נכשלה");
    }
  };

  type OutgoingEmailAttachment = {
    filename: string;
    contentBase64?: string;
    mimeType?: string;
    url?: string;
  };

  const dataUrlToEmailAttachment = (
    name: unknown,
    dataUrl: unknown,
    mimeType?: unknown,
  ): OutgoingEmailAttachment | null => {
    const src = String(dataUrl ?? "").trim();
    if (!src) return null;

    const filename = String(name || "קובץ מצורף").trim() || "קובץ מצורף";
    const declaredMimeType = String(mimeType || "").trim();

    if (src.startsWith("data:")) {
      const match = src.match(/^data:([^;]+);base64,([\s\S]*)$/);
      if (!match) return null;
      return {
        filename,
        mimeType: declaredMimeType || match[1] || "application/octet-stream",
        contentBase64: match[2],
      };
    }

    if (/^https?:\/\//i.test(src)) {
      return {
        filename,
        mimeType: declaredMimeType || "application/octet-stream",
        url: src,
      };
    }

    return null;
  };

  const uniqueEmailAttachments = (
    attachments: Array<OutgoingEmailAttachment | null | undefined>,
  ) => {
    const seen = new Set<string>();
    return attachments.filter((attachment): attachment is OutgoingEmailAttachment => {
      if (!attachment) return false;
      const key = `${attachment.filename}|${attachment.contentBase64 || attachment.url || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const collectCurrentFormEmailAttachments = (): OutgoingEmailAttachment[] => {
    const collected: Array<OutgoingEmailAttachment | null> = [];
    const seenObjects = new WeakSet<object>();

    const pushAttachment = (name: unknown, dataUrl: unknown, mimeType?: unknown) => {
      const attachment = dataUrlToEmailAttachment(name, dataUrl, mimeType);
      if (attachment) collected.push(attachment);
    };

    const inferName = (value: any, fallback: string) =>
      value?.name ||
      value?.filename ||
      value?.fileName ||
      value?.attachmentName ||
      value?.title ||
      value?.description ||
      fallback;

    const inferType = (value: any) =>
      value?.type ||
      value?.mimeType ||
      value?.attachmentType ||
      value?.contentType ||
      undefined;

    const walkForAttachments = (value: unknown, fallbackName = "מסמך מצורף") => {
      if (!value || typeof value !== "object") return;
      const obj: any = value;
      if (seenObjects.has(obj)) return;
      seenObjects.add(obj);

      const name = inferName(obj, fallbackName);
      const mimeType = inferType(obj);

      // מבנה קובץ רגיל במערכת: { name, type, dataUrl }
      pushAttachment(name, obj.dataUrl, mimeType);

      // מבנה מסמכי חובה / אישורי ספקים / חומרים / קבלני משנה.
      pushAttachment(name, obj.attachmentDataUrl, obj.attachmentType || mimeType);

      // תמיכה בשמות שדה נוספים אם קיימים בטפסים אחרים.
      pushAttachment(name, obj.fileDataUrl, obj.fileType || mimeType);
      pushAttachment(name, obj.contentBase64 ? `data:${mimeType || "application/octet-stream"};base64,${obj.contentBase64}` : "", mimeType);
      pushAttachment(name, obj.url, mimeType);

      Object.entries(obj).forEach(([key, child]) => {
        if (key === "signature") return;
        const childFallback =
          key === "requiredDocuments"
            ? "מסמך חובה"
            : key === "attachments" || key === "documents" || key === "images"
              ? "מסמך מצורף"
              : name;
        if (Array.isArray(child)) {
          child.forEach((entry) => walkForAttachments(entry, childFallback));
        } else if (child && typeof child === "object") {
          walkForAttachments(child, childFallback);
        }
      });
    };

    const currentFormForSection = (() => {
      if (section === "checklists") return checklistForm;
      if (section === "rfi") return rfiForm;
      if (section === "preliminary") return currentPreliminaryForm;
      if (section === "trialSections") return trialSectionForm;
      if (section === "nonconformances") return nonconformanceForm;
      if (section === "controlProcesses") return controlProcessForm;
      return null;
    })();

    walkForAttachments(currentFormForSection);
    return uniqueEmailAttachments(collected);
  };

const loadExternalScript = async (src: string, test: () => boolean, label: string) => {
    if (test()) return;
    await new Promise<void>((resolve, reject) => {
      const existing = Array.from(document.scripts).find((script) => script.src === src);
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`טעינת ${label} נכשלה`)), { once: true });
        if (test()) resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`טעינת ${label} נכשלה`));
      document.head.appendChild(script);
    });
    if (!test()) throw new Error(`${label} לא נטען בדפדפן`);
  };

  const loadPdfTools = async () => {
    await loadExternalScript(
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
      () => Boolean((window as any).html2canvas),
      "html2canvas",
    );
    await loadExternalScript(
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
      () => Boolean((window as any).jspdf?.jsPDF),
      "jsPDF",
    );
    await loadExternalScript(
      "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js",
      () => Boolean((window as any).PDFLib?.PDFDocument),
      "pdf-lib",
    );
    return {
      html2canvas: (window as any).html2canvas,
      jsPDF: (window as any).jspdf.jsPDF,
      PDFDocument: (window as any).PDFLib.PDFDocument,
    };
  };

  const waitForImagesToLoad = async (root: HTMLElement) => {
    const images = Array.from(root.querySelectorAll("img"));
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            const image = img as HTMLImageElement;
            if (image.complete) return resolve();
            image.onload = () => resolve();
            image.onerror = () => resolve();
          }),
      ),
    );
    if ((document as any).fonts?.ready) {
      await (document as any).fonts.ready.catch(() => undefined);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer | Uint8Array) => {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  };

  const dataUrlToBytes = (dataUrl: string) => {
    const match = String(dataUrl || "").match(/^data:([^;]+);base64,([\s\S]*)$/);
    if (!match) return null;
    const binary = atob(match[2].replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { mimeType: match[1], bytes };
  };

  const collectCurrentFormPdfAppendices = () => collectCurrentFormEmailAttachments();

  const buildFormOnlyPdfBytes = async (html: string, title: string) => {
    const { html2canvas, jsPDF } = await loadPdfTools();

    const host = document.createElement("div");
    host.innerHTML = html;
    host.style.position = "fixed";
    host.style.left = "0";
    host.style.top = "0";
    host.style.width = "1123px";
    host.style.minHeight = "794px";
    host.style.background = "#ffffff";
    host.style.zIndex = "2147483647";
    host.style.pointerEvents = "none";
    host.style.boxShadow = "none";
    document.body.appendChild(host);

    try {
      host.querySelectorAll(".attachment-page").forEach((node) => node.remove());
      host.querySelectorAll("object,iframe").forEach((node) => node.remove());
      await waitForImagesToLoad(host);

      const page = (host.querySelector(".export-page") as HTMLElement) || host;
      const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1123,
        windowHeight: Math.max(page.scrollHeight, 794),
      });

      if (!canvas.width || !canvas.height) throw new Error("יצירת צילום הטופס נכשלה");

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = 297;
      const pageHeight = 210;
      const margin = 6;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;
      if (section !== "checklists") {
        // כל טופס רגיל נפרס לעמוד PDF אחד. נספחים/תמונות מצורפים בנפרד בהמשך.
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const imgWidthMm = usableWidth;
        const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;
        const scale = Math.min(usableWidth / imgWidthMm, usableHeight / imgHeightMm);
        const drawWidth = imgWidthMm * scale;
        const drawHeight = imgHeightMm * scale;
        pdf.addImage(
          imgData,
          "JPEG",
          margin + (usableWidth - drawWidth) / 2,
          margin + (usableHeight - drawHeight) / 2,
          drawWidth,
          drawHeight,
          undefined,
          "FAST",
        );
      } else {
        const sliceHeightPx = Math.floor((canvas.width * usableHeight) / usableWidth);
        let y = 0;
        let pageIndex = 0;

        while (y < canvas.height) {
          const currentSliceHeight = Math.min(sliceHeightPx, canvas.height - y);
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = currentSliceHeight;
          const ctx = sliceCanvas.getContext("2d");
          if (!ctx) throw new Error("יצירת PDF נכשלה");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(canvas, 0, y, canvas.width, currentSliceHeight, 0, 0, canvas.width, currentSliceHeight);
          const imgData = sliceCanvas.toDataURL("image/jpeg", 0.95);
          const imgHeightMm = (currentSliceHeight * usableWidth) / canvas.width;
          if (pageIndex > 0) pdf.addPage("a4", "landscape");
          pdf.addImage(imgData, "JPEG", margin, margin, usableWidth, Math.min(imgHeightMm, usableHeight), undefined, "FAST");
          y += currentSliceHeight;
          pageIndex += 1;
        }
      }

      pdf.setProperties({ title });
      return pdf.output("arraybuffer") as ArrayBuffer;
    } finally {
      host.remove();
    }
  };

  const appendAttachmentToPdf = async (targetPdf: any, attachment: OutgoingEmailAttachment) => {
    const { PDFDocument } = await loadPdfTools();
    const src = String(attachment.contentBase64 || attachment.url || "").trim();
    const mimeType = String(attachment.mimeType || "").toLowerCase();
    const bytesInfo = attachment.contentBase64
      ? { mimeType: mimeType || "application/octet-stream", bytes: Uint8Array.from(atob(attachment.contentBase64.replace(/\s/g, "")), (c) => c.charCodeAt(0)) }
      : src.startsWith("data:")
        ? dataUrlToBytes(src)
        : null;
    if (!bytesInfo) return;

    const bytes = bytesInfo.bytes;
    const detectedMime = mimeType || bytesInfo.mimeType.toLowerCase();

    if (detectedMime.includes("pdf")) {
      try {
        const sourcePdf = await PDFDocument.load(bytes);
        const copiedPages = await targetPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
        copiedPages.forEach((page: any) => targetPdf.addPage(page));
        return;
      } catch (error) {
        console.warn("PDF merge failed", attachment.filename, error);
      }
    }

    if (detectedMime.startsWith("image/") || /^image\//.test(bytesInfo.mimeType)) {
      try {
        const image = detectedMime.includes("png")
          ? await targetPdf.embedPng(bytes)
          : await targetPdf.embedJpg(bytes);
        const a4Landscape: [number, number] = [841.89, 595.28];
        const page = targetPdf.addPage(a4Landscape);
        const margin = 36;
        const maxWidth = a4Landscape[0] - margin * 2;
        const maxHeight = a4Landscape[1] - margin * 2;
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        const width = image.width * scale;
        const height = image.height * scale;
        page.drawImage(image, {
          x: (a4Landscape[0] - width) / 2,
          y: (a4Landscape[1] - height) / 2,
          width,
          height,
        });
        return;
      } catch (error) {
        console.warn("Image embed failed", attachment.filename, error);
      }
    }
  };

  const buildMergedPdfBlob = async (title: string, html: string) => {
    const { PDFDocument } = await loadPdfTools();
    const formPdfBytes = await buildFormOnlyPdfBytes(html, title);
    const mergedPdf = await PDFDocument.create();
    const formPdf = await PDFDocument.load(formPdfBytes);
    const formPages = await mergedPdf.copyPages(formPdf, formPdf.getPageIndices());
    formPages.forEach((page: any) => mergedPdf.addPage(page));

    const appendices = collectCurrentFormPdfAppendices();
    for (const attachment of appendices) {
      await appendAttachmentToPdf(mergedPdf, attachment);
    }

    const mergedBytes = await mergedPdf.save();
    return new Blob([mergedBytes], { type: "application/pdf" });
  };

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const [emailRecipientDialogOpen, setEmailRecipientDialogOpen] = useState(false);
  const [selectedEmailRecipientIds, setSelectedEmailRecipientIds] = useState<string[]>([]);

  const emailRecipientOptions = useMemo(
    () => currentProjectEmailUsers.filter((user) => user.active && isValidEmailAddress(user.email)),
    [currentProjectEmailUsers],
  );

  const sendEmailToRecipients = async (recipientEmails: string[]) => {
    try {
      const uniqueRecipients = Array.from(new Set(recipientEmails.map((email) => email.trim()).filter(Boolean)));
      const invalidRecipients = uniqueRecipients.filter((email) => !isValidEmailAddress(email));
      if (invalidRecipients.length) {
        alert(`כתובות המייל הבאות אינן תקינות:
${invalidRecipients.join("\n")}`);
        return;
      }
      if (!uniqueRecipients.length) {
        alert("יש לסמן לפחות משתמש אחד בריבוע הבחירה");
        return;
      }
      const normalizedRecipient = uniqueRecipients.join(", ");

      const exportChecklistNo = getExportChecklistNo();
      const title = recordTitleForExport();
      const html = exportHtml(exportChecklistNo);

      const mergedPdfBlob = await buildMergedPdfBlob(title, html);
      const pdfDataUrl = await blobToDataUrl(mergedPdfBlob);
      const formPdfAttachment = dataUrlToEmailAttachment(
        `${title} - כולל נספחים.pdf`,
        pdfDataUrl,
        "application/pdf",
      );

      const attachments = uniqueEmailAttachments([formPdfAttachment]);

      const response = await fetch("/api/send-checklist-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: normalizedRecipient,
          subject: `${title} - ${projectName}`,
          html: `<div dir="rtl">מצורף קובץ PDF עבור ${title} מפרויקט ${projectName}</div>`,
          text: `מצורף קובץ PDF עבור ${title} מפרויקט ${projectName}`,
          attachments,
          projectId: currentProject?.id || projectName || "806",
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result?.error || result?.details?.error_description || "שליחת המייל נכשלה");
      }

      alert(
        `המייל נשלח בהצלחה אל ${normalizedRecipient}` +
          `
צורף PDF אחד מאוחד הכולל את הטופס והנספחים.`,
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "שליחת המייל נכשלה");
    }
  };

  const sendCurrentFormEmail = async () => {
    if (emailRecipientOptions.length) {
      setSelectedEmailRecipientIds([]);
      setEmailRecipientDialogOpen(true);
      return;
    }

    const recipientInput = window.prompt("לא הוגדרו משתמשים לפרויקט. הקלד כתובות מייל מופרדות בפסיק:", FIXED_EMAIL_RECIPIENT);
    const rawRecipients = normalizeEmailList(recipientInput);
    if (!rawRecipients.length) return;
    await sendEmailToRecipients(rawRecipients);
  };

  const confirmSelectedEmailRecipients = async () => {
    const recipientEmails = emailRecipientOptions
      .filter((user) => selectedEmailRecipientIds.includes(user.id))
      .map((user) => user.email);
    if (!recipientEmails.length) {
      alert("יש לסמן לפחות משתמש אחד בריבוע הבחירה");
      return;
    }
    setEmailRecipientDialogOpen(false);
    await sendEmailToRecipients(recipientEmails);
  };

  const showExportButtons = [
    "checklists",
    "nonconformances",
    "trialSections",
    "preliminary",
    "controlProcesses",
  ].includes(section);
  const navItems: Array<[AppSection, string]> = isAdminAccess(projectAccess)
    ? [
        ["home", "דף בית"],
        ["projectDetails", "פרטי הפרויקט"],
        ["projectUsers", "משתמשים"],
        ["projects", "פרויקטים"],
        ["controlProcesses", "בקרה מקדימה / תעודות ייחוס"],
        ["rfi", "RFI"],
        ["supervisionReports", "דוחות פיקוח עליון"],
        ["checklists", "רשימות תיוג"],
        ["nonconformances", "אי תאמות"],
        ["trialSections", "קטעי ניסוי"],
        ["preliminary", "בקרה מקדימה"],
        ["concentrations", "ריכוזים"],
      ]
    : [
        ["home", "דף בית"],
        ["projectDetails", "פרטי הפרויקט"],
        ["projectUsers", "משתמשים"],
        ["controlProcesses", "בקרה מקדימה / תעודות ייחוס"],
        ["rfi", "RFI"],
        ["supervisionReports", "דוחות פיקוח עליון"],
        ["checklists", "רשימות תיוג"],
        ["nonconformances", "אי תאמות"],
        ["trialSections", "קטעי ניסוי"],
        ["preliminary", "בקרה מקדימה"],
        ["concentrations", "ריכוזים"],
      ];

  if (!authReady) {
    return (
      <div dir="rtl" style={{ padding: 32, fontWeight: 900 }}>
        טוען מערכת...
      </div>
    );
  }

  if (!projectAccess) {
    return (
      <ProjectLoginScreen
        username={loginCode}
        password={loginPassword}
        error={loginError}
        onUsernameChange={setLoginCode}
        onPasswordChange={setLoginPassword}
        onSubmit={handleProjectLogin}
      />
    );
  }

  return (
    <div style={styles.page} dir="rtl">
      {emailRecipientDialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "min(720px, 96vw)",
              maxHeight: "82vh",
              overflow: "auto",
              background: "#fff",
              borderRadius: 18,
              padding: 20,
              boxShadow: "0 20px 60px rgba(15, 23, 42, 0.35)",
              border: "1px solid #e2e8f0",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 950 }}>בחירת נמענים לשליחת מייל</h3>
            <div style={{ color: "#64748b", marginBottom: 14 }}>
              סמן בריבוע ליד כל משתמש שצריך לקבל את המייל. אין צורך להקליד מספרים.
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {emailRecipientOptions.map((user) => {
                const checked = selectedEmailRecipientIds.includes(user.id);
                return (
                  <label
                    key={user.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: checked ? "1px solid #8b3d72" : "1px solid #e2e8f0",
                      background: checked ? "#fdf2f8" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const isChecked = event.target.checked;
                        setSelectedEmailRecipientIds((prev) =>
                          isChecked ? Array.from(new Set([...prev, user.id])) : prev.filter((id) => id !== user.id),
                        );
                      }}
                      style={{ width: 18, height: 18 }}
                    />
                    <span style={{ fontWeight: 800 }}>
                      {user.name || "משתמש"}
                      {user.role ? ` - ${user.role}` : ""}
                      {user.company ? ` - ${user.company}` : ""}
                      <span style={{ display: "block", color: "#475569", fontWeight: 600, marginTop: 2 }}>
                        {user.email}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-start", marginTop: 18, flexWrap: "wrap" }}>
              <button type="button" style={styles.primaryBtn} onClick={confirmSelectedEmailRecipients}>
                שלח לנמענים שסומנו
              </button>
              <button type="button" style={styles.secondaryBtn} onClick={() => setSelectedEmailRecipientIds(emailRecipientOptions.map((user) => user.id))}>
                סמן הכל
              </button>
              <button type="button" style={styles.secondaryBtn} onClick={() => setSelectedEmailRecipientIds([])}>
                נקה בחירה
              </button>
              <button type="button" style={styles.dangerBtn} onClick={() => setEmailRecipientDialogOpen(false)}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
      <header style={styles.header}>
        <div style={styles.headerCard}>
          <div style={{ fontWeight: 900, fontSize: 24 }}>Y.K QUALITY</div>
          <div style={{ color: "#475569", marginTop: 6 }}>
            QA/QC · Multi-file refactor · workflow with signatures
          </div>
        </div>
        <div style={styles.headerCard}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontWeight: 800 }}>פרויקט פעיל</div>
              <div>{projectName}</div>
              <div style={{ color: "#64748b", marginTop: 4, fontSize: 13 }}>
                משתמש: {projectAccess.displayName} · הרשאה:{" "}
                {isAdminAccess(projectAccess)
                  ? "מנהל מערכת"
                  : `פרויקט ${projectAccess.code ?? ""}`}
              </div>
              {isSaving && (
                <div style={{ color: "#475569", marginTop: 6 }}>
                  שומר נתונים...
                </div>
              )}
              {!cloudEnabled && (
                <div style={{ color: "#475569", marginTop: 6 }}>
                  מצב מקומי בלבד
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {isAdminAccess(projectAccess) ? (
                <button
                  type="button"
                  onClick={() => setShowUserManagement((prev) => !prev)}
                  style={{
                    border: "1px solid #cbd5e1",
                    background: showUserManagement ? "#0f172a" : "#fff",
                    color: showUserManagement ? "#fff" : "#0f172a",
                    borderRadius: 10,
                    padding: "8px 10px",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  ניהול משתמשים
                </button>
              ) : null}
              <button
                type="button"
                onClick={logoutProject}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  borderRadius: 10,
                  padding: "8px 10px",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                יציאה
              </button>
            </div>
          </div>
        </div>
      </header>

      {isAdminAccess(projectAccess) && showUserManagement ? (
        <UserAccessPanel
          users={draftAccessUsers}
          onChangeUser={updateAccessUser}
          onAddUser={addAccessUser}
          onRemoveUser={removeAccessUser}
          onResetDefaults={resetAccessUsersToDefaults}
          onUploadSignature={uploadUserSignature}
          onApproveChanges={approveAccessUsersChanges}
          onCancelChanges={cancelAccessUsersChanges}
          hasUnsavedChanges={accessUsersDirty}
        />
      ) : null}

      <div style={styles.navRow}>
        {navItems.map(([key, label]) => (
          <button
            key={key}
            style={{
              ...styles.navBtn,
              background: section === key ? "#0f172a" : "#fff",
              color: section === key ? "#fff" : "#0f172a",
            }}
            onClick={() => setSection(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={styles.layout}>
        <main style={styles.mainCard}>
          {showExportButtons && !guardedBody && (
            <div
              style={{
                ...styles.buttonRow,
                justifyContent: "flex-start",
                marginBottom: 14,
              }}
            >
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={exportPdf}
              >
                הורד PDF
              </button>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={sendCurrentFormEmail}
              >
                שלח מייל
              </button>
            </div>
          )}
          {section === "projectDetails" && currentProject && (
            <ProjectLegendPanel
              legend={currentProjectLegend}
              missing={projectLegendMissing}
              isEditing={editingProjectLegend}
              hasChanges={projectLegendDirty}
              onChange={updateProjectLegendField}
              onStartEdit={startProjectLegendEdit}
              onApprove={approveProjectLegendChanges}
              onCancel={cancelProjectLegendChanges}
              onClear={clearProjectLegend}
              onAddFactor={addProjectLegendFactor}
              onRemoveFactor={removeProjectLegendFactor}
            />
          )}
          {section === "projectDetails" && !currentProject && (
            <div style={styles.emptyBox}>
              יש לבחור פרויקט לפני עריכת פרטי הפרויקט.
            </div>
          )}
          {section === "controlProcesses" && (
            <>
              <FolderRecordsTable
                title="בקרה מקדימה / תעודות ייחוס"
                description="כל הרשומות השמורות של תיקייה זו מוצגות כאן בשורות מסודרות."
                records={projectControlProcesses as any[]}
                columns={[
                  { label: "מספר", value: (record) => record.processNo || record.number || record.id },
                  { label: "כותרת", value: (record) => getRecordTitle(record) },
                  { label: "תחום", value: (record) => record.workType || record.category || record.type },
                  { label: "מיקום / שימוש", value: (record) => record.location || record.area },
                  { label: "סטטוס", value: (record) => getRecordStatus(record) },
                ]}
                onOpen={(id) => { const record = projectControlProcesses.find((item) => item.id === id); if (record) loadControlProcess(record); }}
                onDelete={deleteControlProcess}
                onNew={resetControlProcessForm}
              />
            <ControlProcessesSection
              guardedBody={guardedBody}
              form={controlProcessForm}
              setForm={setControlProcessForm}
              editingId={editingControlProcessId}
              savedProcesses={projectControlProcesses}
              checklists={projectChecklists}
              rfis={projectRfis}
              nonconformances={projectNonconformances}
              onSave={saveControlProcess}
              onReset={resetControlProcessForm}
              onLoad={loadControlProcess}
              onDelete={deleteControlProcess}
              onLock={lockControlProcess}
            />
            </>
          )}
          {section === "rfi" && (
            <>
              <FolderRecordsTable
                title="RFI / אישורי מתכנן"
                description="רשימת כל פניות RFI ואישורי המתכנן בפרויקט."
                records={projectRfis as any[]}
                columns={[
                  { label: "כותרת", value: (record) => getRecordTitle(record) },
                  { label: "מספר", value: (record) => record.rfiNo || record.number || record.id },
                  { label: "תאריך", value: (record) => getRecordDate(record) },
                  { label: "סטטוס", value: (record) => getRecordStatus(record) },
                ]}
                onOpen={(id) => { const record = projectRfis.find((item) => item.id === id); if (record) loadRfi(record); }}
                onDelete={deleteRfi}
                onNew={resetRfiForm}
              />
            <RfiSection
              guardedBody={guardedBody}
              rfiForm={rfiForm}
              setRfiForm={setRfiForm}
              editingRfiId={editingRfiId}
              savedRfis={projectRfis}
              saveRfi={saveRfi}
              resetRfiForm={resetRfiForm}
              closeRfi={closeRfi}
              deleteRfi={deleteRfi}
              loadRfi={loadRfi}
              projectMeta={currentProjectLegend}
            />
            </>
          )}
          {section === "supervisionReports" && (
            <SimpleFolderSection
              title="דוחות פיקוח עליון"
              description="תיקייה ייעודית לדוחות פיקוח עליון."
              icon="🏛️"
            />
          )}
          {section === "home" && (
            <HomeSection
              projects={accessibleProjects}
              projectChecklists={projectChecklists}
              projectNonconformances={projectNonconformances}
              projectTrialSections={projectTrialSections}
              projectPreliminary={projectPreliminary}
              projectRFIs={projectRfis as any}
              projectSupervisionReports={[] as any}
              homeModules={homeModules}
              setSection={setSection as any}
            />
          )}
          {section === "projects" && isAdminAccess(projectAccess) && (
            <ProjectsSection
              projects={accessibleProjects}
              currentProjectId={currentProjectId}
              newProjectName={newProjectName}
              newProjectDescription={newProjectDescription}
              newProjectManager={newProjectManager}
              setNewProjectName={setNewProjectName}
              setNewProjectDescription={setNewProjectDescription}
              setNewProjectManager={setNewProjectManager}
              addProject={addProject}
              setActiveProject={setActiveProject}
              renameProject={renameProject}
              updateProjectMeta={updateProjectMeta}
              deleteProject={deleteProject}
            />
          )}
          {section === "projectUsers" && (
            <ProjectUsersSection
              guardedBody={guardedBody}
              projectName={projectName}
              users={currentProjectEmailUsers}
              onAddUser={addProjectEmailUser}
              onUpdateUser={updateProjectEmailUser}
              onDeleteUser={deleteProjectEmailUser}
              onSaveUsers={saveCurrentProjectEmailUsers}
            />
          )}
          {section === "checklists" && (
            <>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 14,
                  justifyContent: "flex-start",
                }}
              >
                {Object.entries(checklistTemplates).map(([key, template]) => {
                  const normalizedKey = normalizeChecklistTemplateKey(key);
                  const isActive =
                    normalizeChecklistTemplateKey(selectedChecklistTemplateKey) === normalizedKey;
                  const count = projectChecklists.filter(
                    (record) => normalizeChecklistTemplateKey(record.templateKey) === normalizedKey,
                  ).length;
                  return (
                    <button
                      key={key}
                      type="button"
                      style={isActive ? styles.primaryBtn : styles.secondaryBtn}
                      onClick={() => {
                        setSelectedChecklistTemplateKey(normalizedKey);
                        resetChecklistForm(normalizedKey);
                      }}
                    >
                      {template.label} ({count})
                    </button>
                  );
                })}
              </div>
              <FolderRecordsTable
                title={`רשימות תיוג - ${selectedChecklistLabel}`}
                description="מוצגות רק הרשומות של סוג רשימת התיוג שנבחר. בחירה בסוג אחר פותחת תיקייה ייעודית לאותו סוג בלבד."
                records={selectedChecklistRecords as any[]}
                columns={[
                  { label: "מספר", value: (record, index) => getChecklistDisplayNumber(record, index) },
                  { label: "כותרת", value: (record) => getRecordTitle(record) },
                  { label: "קטגוריה", value: (record) => record.category || checklistTemplateLabel(record.templateKey) },
                  { label: "מיקום", value: (record) => getChecklistDisplayLocation(record) },
                  { label: "תאריך", value: (record) => getRecordDate(record) },
                  { label: "סטטוס", value: (record) => getApprovalDisplayStatus(record) },
                ]}
                onOpen={(id) => { const record = projectChecklists.find((item) => item.id === id); if (record) loadChecklist(record); }}
                onDelete={deleteChecklist}
                onNew={() => resetChecklistForm(selectedChecklistTemplateKey)}
              />
              <ChecklistsSection
                guardedBody={guardedBody}
                editingChecklistId={editingChecklistId}
                checklistForm={checklistForm}
                setChecklistForm={setChecklistForm}
                checklistTemplateLabel={checklistTemplateLabel}
                applyChecklistTemplate={applyChecklistTemplate}
                updateChecklistItem={updateChecklistItem}
                toggleChecklistItemPrintExclusion={
                  toggleChecklistItemPrintExclusion
                }
                addChecklistItem={addChecklistItem}
                removeChecklistItem={removeChecklistItem}
                saveChecklist={saveChecklist}
                resetChecklistForm={resetChecklistForm}
                projectName={projectName}
                onUploadAttachment={uploadChecklistItemAttachment}
                onRemoveAttachment={removeChecklistItemAttachment}
                savedSignatureForSigner={savedSignatureForSigner}
              />
            </>
          )}
          {section === "nonconformances" && (
            <>
              <FolderRecordsTable
                title="אי התאמות"
                description="כל אי ההתאמות של הפרויקט מוצגות כאן בשורות מסודרות."
                records={projectNonconformances as any[]}
                columns={[
                  { label: "כותרת", value: (record) => getRecordTitle(record) },
                  { label: "מיקום", value: (record) => record.location },
                  { label: "תאריך", value: (record) => getRecordDate(record) },
                  { label: "חומרה", value: (record) => record.severity },
                  { label: "סטטוס", value: (record) => getRecordStatus(record) },
                ]}
                onOpen={(id) => { const record = projectNonconformances.find((item) => item.id === id); if (record) loadNonconformance(record); }}
                onDelete={deleteNonconformance}
                onNew={resetNonconformanceEditor}
              />
            <EnhancedNonconformancesSection
              guardedBody={guardedBody}
              editingNonconformanceId={editingNonconformanceId}
              nonconformanceForm={nonconformanceForm}
              setNonconformanceForm={setNonconformanceForm}
              saveNonconformance={saveNonconformance}
              resetNonconformanceEditor={resetNonconformanceEditor}
              closeNonconformance={closeNonconformance}
              uploadNonconformanceAttachment={uploadNonconformanceAttachment}
              removeNonconformanceAttachment={removeNonconformanceAttachment}
            />
            </>
          )}
          {section === "trialSections" && (
            <>
              <FolderRecordsTable
                title="קטעי ניסוי"
                description="כל קטעי הניסוי של הפרויקט מוצגים כאן בטבלה."
                records={projectTrialSections as any[]}
                columns={[
                  { label: "כותרת", value: (record) => getRecordTitle(record) },
                  { label: "מיקום", value: (record) => record.location || record.roadStructure || record.area },
                  { label: "תאריך", value: (record) => getRecordDate(record) },
                  { label: "סטטוס", value: (record) => getRecordStatus(record) },
                ]}
                onOpen={(id) => { const record = projectTrialSections.find((item) => item.id === id); if (record) loadTrialSection(record); }}
                onDelete={deleteTrialSection}
                onNew={resetTrialSectionEditor}
              />
            <div style={{ border: "1px solid #dbe3ef", borderRadius: 16, padding: 14, marginBottom: 14, background: "#f8fafc" }}>
              <label style={{ display: "block", fontWeight: 900, marginBottom: 8 }}>משתתפים בקטע ניסוי - ניתן לבחור יותר ממשתתף אחד מתוך גורמי הפרויקט</label>
              {trialParticipantOptions.length ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 8 }}>
                  {trialParticipantOptions.map((label) => {
                    const selectedParticipants = String((trialSectionForm as any).participants || "")
                      .split(/\s*;\s*/)
                      .map((item) => item.trim())
                      .filter(Boolean);
                    const checked = selectedParticipants.includes(label);
                    return (
                      <label key={label} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #dbe3ef", borderRadius: 12, padding: "8px 10px", background: checked ? "#eef6ff" : "#fff", fontWeight: 800, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const current = String((trialSectionForm as any).participants || "")
                              .split(/\s*;\s*/)
                              .map((item) => item.trim())
                              .filter(Boolean);
                            const next = event.currentTarget.checked
                              ? Array.from(new Set([...current, label]))
                              : current.filter((item) => item !== label);
                            setTrialSectionForm((prev: any) => ({ ...prev, participants: next.join(" ; ") }));
                          }}
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div style={{ marginTop: 8, color: "#64748b", fontWeight: 700 }}>לא הוגדרו עדיין משתמשים/גורמים בפרויקט.</div>
              )}
            </div>
            <TrialSectionsSection
              guardedBody={guardedBody}
              editingTrialSectionId={editingTrialSectionId}
              trialSectionForm={trialSectionForm}
              setTrialSectionForm={setTrialSectionForm}
              saveTrialSection={saveTrialSection}
              resetTrialSectionEditor={resetTrialSectionEditor}
            />
            </>
          )}
          {section === "preliminary" && (
            <>
              <FolderRecordsTable
                title={`בקרה מקדימה - ${labelForPreliminary(preliminaryTab)}`}
                description="מוצגות רק רשומות הסוג שנבחר: ספקים, חומרים או קבלני משנה."
                records={projectPreliminary.filter((record) => record.subtype === preliminaryTab) as any[]}
                columns={preliminaryFolderColumns(preliminaryTab)}
                onOpen={(id) => { const record = projectPreliminary.find((item) => item.id === id); if (record) loadPreliminary(record); }}
                onDelete={deletePreliminary}
                onNew={resetPreliminaryEditor}
              />
            <PreliminarySection
              guardedBody={guardedBody}
              preliminaryTab={preliminaryTab}
              setPreliminaryTab={setPreliminaryTab}
              editingPreliminaryId={editingPreliminaryId}
              supplierPreliminaryForm={supplierPreliminaryForm}
              subcontractorPreliminaryForm={subcontractorPreliminaryForm}
              materialPreliminaryForm={materialPreliminaryForm}
              setSupplierPreliminaryForm={setSupplierPreliminaryForm}
              setSubcontractorPreliminaryForm={setSubcontractorPreliminaryForm}
              setMaterialPreliminaryForm={setMaterialPreliminaryForm}
              savePreliminary={savePreliminary}
              resetPreliminaryEditor={resetPreliminaryEditor}
              labelForPreliminary={labelForPreliminary}
              currentProjectName={projectName}
              projectMeta={{
                projectName: currentProjectLegend.projectName,
                projectManagement: currentProjectLegend.projectManagement,
                contractor: currentProjectLegend.contractor,
                qualityAssurance: currentProjectLegend.qualityAssurance,
                qualityControl: currentProjectLegend.qualityControl,
              }}
            />
            </>
          )}
          {section === "concentrations" && (
            <>
              <ConcentrationsSection
                savedChecklists={projectChecklists}
                savedNonconformances={projectNonconformances}
                savedTrialSections={projectTrialSections}
                savedPreliminary={projectPreliminary}
                savedRfis={projectRfis}
                savedControlProcesses={projectControlProcesses}
                currentProjectName={projectName}
                projectMeta={
                  {
                    projectName: currentProjectLegend.projectName,
                    projectManager: currentProjectLegend.projectManagement,
                    contractor: currentProjectLegend.contractor,
                    qualityAssurance: currentProjectLegend.qualityAssurance,
                    qualityControl: currentProjectLegend.qualityControl,
                    workManager: currentProjectLegend.workManager,
                    surveyor: currentProjectLegend.surveyor,
                    supervisor: currentProjectLegend.supervisor,
                  } as any
                }
              />
            </>
          )}
        </main>

      </div>
    </div>
  );
}
