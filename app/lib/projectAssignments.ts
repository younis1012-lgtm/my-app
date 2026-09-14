// Directory compatibility only. Authorization still requires project_members.
type Assignment = {
  project_ids?: unknown; projectIds?: unknown;
  project_id?: unknown; projectId?: unknown;
  project_name?: unknown; projectName?: unknown;
};
const text = (value: unknown) => String(value ?? '').trim().toLowerCase();
const name = (value: unknown) => text(value).replace(/[\u05f3`\u2019']/g, '').replace(/\s+/g, '');

export function assignmentProjectIds(row: Assignment): string[] {
  return [...new Set([
    ...(Array.isArray(row.project_ids) ? row.project_ids : []),
    ...(Array.isArray(row.projectIds) ? row.projectIds : []),
    row.project_id, row.projectId,
  ].map(text).filter(Boolean))];
}

export function matchesProjectAssignment(row: Assignment, projectId: string, projectName: string): boolean {
  return assignmentProjectIds(row).includes(text(projectId)) ||
    Boolean(name(projectName) && name(row.project_name ?? row.projectName) === name(projectName));
}
