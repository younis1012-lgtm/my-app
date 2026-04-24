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
  notes: string;
  inspector: string;
  executionDate: string;
}

export interface ChecklistTemplate {
  label: string;
  title: string;
  category: string;
  items: ChecklistItem[];
}

// ==== HELPERS ====

const createItem = (
  id: string,
  description: string,
  responsible = "בקרת איכות",
  status = "לא נבדק"
): ChecklistItem => ({
  id,
  description,
  responsible,
  status,
  notes: "",
  inspector: "",
  executionDate: "",
});

// ==== TEMPLATES ====

export const checklistTemplates: Record<ChecklistTemplateKey, ChecklistTemplate> = {
  general: {
    label: "כללי",
    title: "רשימת תיוג כללית",
    category: "כללי",
    items: [
      createItem("1", "בדיקה כללית"),
    ],
  },

  asphaltWorks: {
    label: "עבודות אספלט",
    title: "רשימת תיוג לעבודות אספלט",
    category: "אספלט",
    items: [
      createItem("1", "אישור תכנית העבודה לפני ביצוע"),
      createItem("2", "בדיקת ניקיון פני השטח לפני פיזור"),
      createItem("3", "בדיקת טמפרטורת התערובת בעת פריקה"),
      createItem("4", "בדיקת עובי שכבת האספלט"),
      createItem("5", "בדיקת הידוק וגימור פני השטח"),
      createItem("6", "אישור סופי לאחר ביצוע"),
    ],
  },

  drainagePiping: {
    label: "צנרת ניקוז",
    title: "רשימת תיוג לצנרת ניקוז",
    category: "ניקוז",
    items: [
      createItem("1", "אישור חומר/סוג הצינור לפני ביצוע"),
      createItem("2", "בדיקת תוואי וחפירה"),
      createItem("3", "בדיקת מצע ותחתית"),
      createItem("4", "הנחת צנרת ושוחות"),
      createItem("5", "בדיקת שיפועים ואטימות"),
      createItem("6", "כיסוי ואישור סופי"),
    ],
  },

  painting: {
    label: "צביעה",
    title: "רשימת תיוג לעבודות צבע",
    category: "גמר",
    items: [
      createItem("1", "אישור חומר הצבע והגוון"),
      createItem("2", "בדיקת הכנת השטח"),
      createItem("3", "בדיקת שכבת יסוד"),
      createItem("4", "בדיקת שכבות צבע וגמר"),
      createItem("5", "בדיקת תיקונים וניקיון"),
      createItem("6", "אישור סופי"),
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

  return checklistTemplates[safeKey].items.map((item, index) => ({
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${safeKey}-${item.id}-${Date.now()}-${index}`,
    description: item.description ?? "",
    responsible: item.responsible ?? "בקרת איכות",
    status: item.status ?? "לא נבדק",
    notes: item.notes ?? "",
    inspector: item.inspector ?? "",
    executionDate: item.executionDate ?? "",
  }));
}
