import type { HoldPointRecord } from "../components/HoldPointsSection";

export const LEGACY_HOLD_POINT_PREFIX = "__YK_HOLD_POINT__:";

export const isLegacyHoldPoint = (value: any): boolean =>
  typeof value?.title === "string" && value.title.trimStart().startsWith(LEGACY_HOLD_POINT_PREFIX);

export function legacyHoldPointToRecord(row: any): HoldPointRecord | null {
  if (!isLegacyHoldPoint(row)) return null;
  let details: any = {};
  try {
    const parsed = typeof row.notes === "string" ? JSON.parse(row.notes) : row.notes;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) details = parsed;
  } catch { /* Keep the envelope visible even if old metadata is malformed. */ }
  const list = (value: any) => Array.isArray(value) ? value : [];
  return {
    id: String(row.id ?? details.id ?? ""),
    projectId: String(row.project_id ?? row.projectId ?? details.projectId ?? ""),
    serialNo: Number(details.serialNo ?? row.report_no ?? row.reportNo ?? 0),
    referenceNo: String(details.referenceNo ?? row.report_no ?? row.reportNo ?? ""),
    name: String(details.name ?? row.title.trimStart().slice(LEGACY_HOLD_POINT_PREFIX.length)),
    structureNodeId: String(row.structure_node_id ?? row.structureNodeId ?? details.structureNodeId ?? ""),
    element: String(details.element ?? row.location ?? ""),
    status: String(details.status ?? row.status ?? "נוצרה, לא הושלמה"),
    checklistIds: list(details.checklistIds),
    nonconformanceIds: list(details.nonconformanceIds),
    trialSectionIds: list(details.trialSectionIds),
    documents: list(details.documents ?? row.attachments),
    qcCompany: String(details.qcCompany ?? ""),
    qaCompany: String(details.qaCompany ?? ""),
    notes: String(details.notes ?? ""),
    createdBy: String(details.createdBy ?? row.author ?? ""),
    createdAt: String(details.createdAt ?? row.saved_at ?? row.savedAt ?? row.date ?? ""),
    updatedAt: String(details.updatedAt ?? row.saved_at ?? row.savedAt ?? ""),
    releasedAt: String(details.releasedAt ?? ""),
  };
}

export function legacyHoldPointToRow(record: HoldPointRecord) {
  return {
    id: record.id,
    project_id: record.projectId,
    title: `${LEGACY_HOLD_POINT_PREFIX}${record.name}`,
    report_no: String(record.serialNo),
    date: (record.updatedAt || record.createdAt || new Date().toISOString()).slice(0, 10),
    structure_node_id: record.structureNodeId || null,
    location: record.element,
    author: record.createdBy,
    status: record.status,
    notes: JSON.stringify(record),
    saved_at: record.updatedAt || new Date().toISOString(),
  };
}

export const isMissingHoldPointsTable = (error: any): boolean =>
  ["PGRST205", "42P01"].includes(String(error?.code)) &&
  String(error?.message ?? "").includes("hold_points");
