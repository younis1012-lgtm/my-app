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

export interface ChecklistTemplate {
  label: string;
  title: string;
  category: string;
  items: ChecklistItem[];
}

// ==== TEMPLATES ====

export const checklistTemplates: Record<ChecklistTemplateKey, ChecklistTemplate> = {
  general: {
    label: "כללי",
    title: "רשימת תיוג כללית",
    category: "כללי",
    items: [
      {
        id: "1",
        description: "בדיקה כללית",
        responsible: "בקרת איכות",
        status: "לא נבדק",
      },
    ],
  },

  asphaltWorks: {
    label: "עבודות אספלט",
    title: "רשימת תיוג לעבודות אספלט",
    category: "אספלט",
    items: [
      {
        id: "1",
        description: "בדיקת שכבת אספלט",
        responsible: "בקרת איכות",
        status: "לא נבדק",
      },
    ],
  },

  drainagePiping: {
    label: "צנרת ניקוז",
    title: "רשימת תיוג לצנרת ניקוז",
    category: "ניקוז",
    items: [
      {
        id: "1",
        description: "בדיקת צנרת ניקוז",
        responsible: "בקרת איכות",
        status: "לא נבדק",
      },
    ],
  },

  painting: {
    label: "צביעה",
    title: "רשימת תיוג לעבודות צבע",
    category: "גמר",
    items: [
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
  },
};

// ==== SAFE KEY ====

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

  return checklistTemplates[safeKey].items.map((item) => ({
    ...item,
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${item.id}-${Date.now()}`,
  }));
}