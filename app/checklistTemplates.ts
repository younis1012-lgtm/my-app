// ==== TYPES ====

export type ChecklistTemplateKey =
  | "general"
  | "asphaltWorks"
  | "drainagePiping"
  | "painting";

export interface ChecklistItem {
  id: string;
  description: string;
  responsible: string;
  status: string;
}

// ==== TEMPLATES ====

export const checklistTemplates: Record<ChecklistTemplateKey, ChecklistItem[]> = {
  general: [
    {
      id: "1",
      description: "בדיקה כללית",
      responsible: "בקרת איכות",
      status: "לא נבדק",
    },
  ],

  asphaltWorks: [
    {
      id: "1",
      description: "בדיקת שכבת אספלט",
      responsible: "בקרת איכות",
      status: "לא נבדק",
    },
  ],

  drainagePiping: [
    {
      id: "1",
      description: "בדיקת צנרת ניקוז",
      responsible: "בקרת איכות",
      status: "לא נבדק",
    },
  ],

  painting: [
    {
      id: "1",
      description: "אישור חומר הצבע והגוון",
      responsible: "בקרת איכות",
      status: "לא נבדק",
    },
    {
      id: "2",
      description: "בדיקת הכנת השטח",
      responsible: "בקרת איכות",
      status: "לא נבדק",
    },
  ],
};

// ==== FIX CRASH FUNCTION ====

export function normalizeChecklistTemplateKey(
  key: string | undefined | null
): ChecklistTemplateKey {
  if (!key) return "general";

  if (key in checklistTemplates) {
    return key as ChecklistTemplateKey;
  }

  return "general";
}

// ==== BUILD ITEMS ====

export function buildChecklistItemsFromTemplate(
  templateKey: string | undefined | null
): ChecklistItem[] {
  const safeKey = normalizeChecklistTemplateKey(templateKey);

  return checklistTemplates[safeKey].map((item) => ({
    ...item,
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${item.id}-${Date.now()}`,
  }));
}