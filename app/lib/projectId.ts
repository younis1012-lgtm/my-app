// Shared project-id normalization, used by both the main app (app/page.tsx)
// and standalone pages such as the engineering templates library
// (app/components/EngineeringTemplates/TemplateLibrary.tsx) so that every
// place that writes or reads a `project_id` column agrees on the exact same
// canonical value. A mismatch here (e.g. one page writing a raw/legacy id
// while another reads with the normalized id) makes freshly saved records
// silently "disappear" from the project they were just saved into.

export const PROJECT_ID_ALIASES: Record<string, string> = {
  // This historical UUID is a duplicate project row for Road 65 / Dovrat.
  // Production also has a separate canonical Road 806 row ending in 000000.
  "80600000-0000-0000-0000-000000000806": "06500000-0000-0000-0000-000000000000",
  "project-806": "80600000-0000-0000-0000-000000000000",
  "project-909": "90900000-0000-0000-0000-000000000000",
};

export const UUID_PROJECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const projectCodeToUuid = (code: string) => {
  const digits = code.replace(/\D/g, "");
  if (!digits || digits.length > 8) return "";
  return `${digits.padStart(3, "0").padEnd(8, "0")}-0000-0000-0000-000000000000`;
};

export const normalizeStoredProjectId = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/[‐-―]/g, "-").trim();
  if (PROJECT_ID_ALIASES[cleaned]) return PROJECT_ID_ALIASES[cleaned];
  const lower = cleaned.toLowerCase();
  if (PROJECT_ID_ALIASES[lower]) return PROJECT_ID_ALIASES[lower];
  const codeMatch = lower.match(/^project[-_\s]*(\d+)$/);
  if (codeMatch?.[1] === "806") return PROJECT_ID_ALIASES["project-806"];
  if (codeMatch?.[1] === "909") return PROJECT_ID_ALIASES["project-909"];
  if (codeMatch?.[1]) return projectCodeToUuid(codeMatch[1]) || cleaned;
  return cleaned;
};

// Cloud rows may still carry a historical project id. Query every UUID that
// canonically belongs to the selected project, then normalize rows on read.
// This keeps projects isolated without making old records temporarily vanish.
export const projectCloudIdsForCanonicalId = (value: unknown) => {
  const normalized = normalizeStoredProjectId(value);
  if (!normalized) return [];
  return Array.from(
    new Set([
      normalized,
      ...Object.entries(PROJECT_ID_ALIASES)
        .filter(([, canonicalId]) => canonicalId === normalized)
        .map(([legacyId]) => legacyId)
        .filter((id) => UUID_PROJECT_ID_PATTERN.test(id)),
    ]),
  );
};
