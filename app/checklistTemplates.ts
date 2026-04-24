import type { ChecklistItem, ChecklistTemplateKey, Project } from './types';

export const defaultProjects: Project[] = [
  { id: 'default-project', name: 'כביש 781 שפרעם', description: 'פרויקט ברירת מחדל', manager: '', isActive: true, createdAt: new Date().toLocaleString('he-IL') },
];

const makeItems = (key: string, descriptions: string[]): ChecklistItem[] =>
  descriptions.map((description, index) => ({
    id: `${key}-${index + 1}`,
    description,
    responsible: 'בקרת איכות',
    status: 'לא נבדק',
    notes: '',
    inspector: '',
    executionDate: '',
  }));

export const checklistTemplates = {
  general: {
    label: 'כללי',
    title: 'רשימת תיוג כללית',
    category: 'כללי',
    items: makeItems('general', ['בדיקה מקדימה', 'בדיקת ביצוע', 'אישור סופי']),
  },
  paintWorks: {
    label: 'עבודות צבע',
    title: 'רשימת תיוג לעבודות צבע',
    category: 'עבודות צבע',
    items: makeItems('paintWorks', ['אישור חומר הצבע והגוון', 'בדיקת הכנת השטח וניקוי', 'בדיקת שכבת יסוד / פריימר', 'בדיקת שכבות צבע בהתאם למפרט', 'בדיקת עובי / כיסוי / אחידות', 'בדיקה סופית ותיקונים']),
  },
  milling: {
    label: 'קרצוף',
    title: 'רשימת תיוג לעבודות קרצוף',
    category: 'קרצוף',
    items: makeItems('milling', ['אישור תוכנית הקרצוף', 'סימון שטחי הקרצוף', 'בדיקת עומק הקרצוף', 'ניקוי ופינוי חומר מקורצף', 'בדיקת מפלסים ושיפועים', 'אישור לפני המשך עבודה']),
  },
  rockWall: {
    label: 'מסלעה',
    title: 'רשימת תיוג לבניית מסלעה',
    category: 'מסלעה',
    items: makeItems('rockWall', ['אישור סוג האבן ומקורה', 'בדיקת תשתית ויסוד המסלעה', 'סידור האבנים בהתאם לתוכנית', 'בדיקת יציבות ושיפוע', 'מילוי מאחורי המסלעה וניקוז', 'אישור סופי']),
  },
  excavation: {
    label: 'חפירה',
    title: 'רשימת תיוג לעבודות חפירה',
    category: 'חפירה',
    items: makeItems('excavation', ['אישור תחום החפירה וסימון', 'בדיקת ציוד וכלי עבודה', 'בדיקת עומק ומפלסי חפירה', 'פינוי עודפי חפירה', 'בדיקת תחתית החפירה', 'אישור להמשך עבודה']),
  },
  channelPaving: {
    label: 'ריצוף אבן תעלה',
    title: 'רשימת תיוג לריצוף אבן תעלה',
    category: 'ריצוף אבן תעלה',
    items: makeItems('channelPaving', ['אישור חומר/סוג חומר', 'בדיקת תשתית ומפלסים', 'הנחת אבני התעלה', 'בדיקת קווים ושיפועים', 'מילוי מישקים וניקוי', 'אישור סופי']),
  },
  baseCourseSpreading: {
    label: 'פיזור מצע',
    title: 'רשימת תיוג לפיזור מצע',
    category: 'פיזור מצע',
    items: makeItems('baseCourseSpreading', ['אישור חומר/סוג חומר', 'בדיקת ניקיון ושטח העבודה', 'פיזור המצע בשכבות', 'בדיקת עובי שכבה', 'בדיקת הידוק ומפלסים', 'אישור המשך עבודה']),
  },
  curbstones: {
    label: 'אבני שפה',
    title: 'רשימת תיוג לאבני שפה',
    category: 'אבני שפה',
    items: makeItems('curbstones', ['אישור חומר/סוג חומר', 'בדיקת תוואי וגבהים', 'הכנת מצע/בטון רזה', 'הנחת אבני שפה', 'בדיקת יישור ומפלסים', 'אישור סופי']),
  },
  asphaltSite: {
    label: 'אספלט באתר',
    title: 'רשימת תיוג לביצוע עבודות אספלט באתר',
    category: 'אספלט באתר',
    items: makeItems('asphaltSite', ['אישור תערובת אספלט', 'בדיקת ניקיון וריסוס יסוד', 'בדיקת טמפרטורת אספלט', 'פיזור וסלילה', 'בדיקת הידוק ועובי', 'אישור סופי']),
  },
  castCurbstone: {
    label: 'יציקת אבן שפה',
    title: 'רשימת תיוג להנחת/יציקת אבן שפה',
    category: 'יציקת אבן שפה',
    items: makeItems('castCurbstone', ['אישור חומר/סוג חומר', 'בדיקת תבניות וסימון', 'בדיקת בטון לפני יציקה', 'ביצוע יציקה וגמר', 'בדיקת אשפרה ושמירה', 'אישור סופי']),
  },
  catsEyes: {
    label: 'עיני חתול',
    title: 'רשימת תיוג להתקנת עיני חתול',
    category: 'עיני חתול',
    items: makeItems('catsEyes', ['אישור חומר/סוג חומר', 'סימון מיקום ההתקנה', 'ניקוי והכנת המשטח', 'קידוח/הדבקה בהתאם למפרט', 'בדיקת יציבות ונראות', 'אישור סופי']),
  },
  siteConcrete: {
    label: 'יציקות באתר',
    title: 'רשימת תיוג ליציקות באתר',
    category: 'יציקות באתר',
    items: makeItems('siteConcrete', ['אישור תערובת בטון', 'בדיקת טפסנות וברזל', 'בדיקת ניקיון לפני יציקה', 'בדיקת שקיעה/מדגמים', 'ביצוע יציקה ורטוט', 'אשפרה ואישור סופי']),
  },
  jkWorks: {
    label: 'עבודות JK',
    title: 'רשימת תיוג לעבודות JK',
    category: 'עבודות JK',
    items: makeItems('jkWorks', ['אישור חומר/סוג חומר', 'בדיקת תשתית ומיקום', 'הכנת אזור העבודה', 'ביצוע העבודה בהתאם למפרט', 'בדיקת מידות וגמר', 'אישור סופי']),
  },
  controlledCompaction: {
    label: 'הידוק מבוקר',
    title: 'רשימת תיוג לעבודות הידוק מבוקר',
    category: 'הידוק מבוקר',
    items: makeItems('controlledCompaction', ['אישור חומר/סוג חומר', 'בדיקת שכבת מילוי', 'בדיקת עובי שכבה', 'ביצוע הידוק מבוקר', 'בדיקות צפיפות/רטיבות', 'אישור המשך עבודה']),
  },
  standardCompaction: {
    label: 'הידוק רגיל',
    title: 'רשימת תיוג לעבודות הידוק רגיל',
    category: 'הידוק רגיל',
    items: makeItems('standardCompaction', ['אישור חומר/סוג חומר', 'בדיקת שטח לפני מילוי', 'פיזור שכבה', 'ביצוע הידוק', 'בדיקת מפלסים וגמר', 'אישור סופי']),
  },
  guardrails: {
    label: 'מעקות',
    title: 'רשימת תיוג לעבודות מעקות',
    category: 'מעקות',
    items: makeItems('guardrails', ['אישור המעקה וסוגו', 'אישור חומרים ובדיקות מוקדמות', 'סימון תוואי המעקה', 'בדיקת מרווחים וגבהים טרם התקנה', 'בדיקת התקנה וחיבורים', 'בדיקת קצה מעקה ואביזרים', 'אישור סופי']),
  },
  signage: {
    label: 'תמרור ושילוט',
    title: 'רשימת תיוג לעבודות תמרור ושילוט',
    category: 'תמרור ושילוט',
    items: makeItems('signage', ['אישור חומר/סוג חומר', 'בדיקת מיקום ושילוט לפי תוכנית', 'בדיקת יסודות/עמודים', 'התקנת תמרורים ושלטים', 'בדיקת נראות וגבהים', 'אישור סופי']),
  },
  waterSystems: {
    label: 'מערכות מים',
    title: 'רשימת תיוג מערכות מים',
    category: 'מערכות מים',
    items: makeItems('waterSystems', ['אישור צנרת ואביזרים', 'בדיקת תוואי וחפירה', 'הנחת צנרת וחיבורים', 'בדיקת לחץ/אטימות', 'שטיפה וחיטוי לפי צורך', 'אישור סופי']),
  },
  paving: {
    label: 'ריצוף',
    title: 'רשימת תיוג ריצוף',
    category: 'ריצוף',
    items: makeItems('paving', ['אישור חומר/סוג חומר', 'בדיקת תשתית ומפלסים', 'הנחת ריצוף לפי דוגמה', 'בדיקת מישקים ושיפועים', 'מילוי חול/רובה וניקוי', 'אישור סופי']),
  },
  steelGuardrailsSupply: {
    label: 'אספקה והרכבת מעקות פלדה',
    title: 'תיוג לאספקה והרכבת מעקות פלדה',
    category: 'אספקה והרכבת מעקות פלדה',
    items: makeItems('steelGuardrailsSupply', ['אישור חומר/סוג חומר', 'בדיקת אספקה ותעודות', 'סימון ומיקום עמודים', 'הרכבת מעקה וחיבורים', 'בדיקת גבהים, מרווחים וסיומות', 'אישור סופי']),
  },
  asphaltWorks: {
    label: 'עבודות אספלט',
    title: 'תיוג עבודות אספלט',
    category: 'עבודות אספלט',
    items: makeItems('asphaltWorks', ['אישור תערובת ותעודות', 'בדיקת ניקיון וריסוס', 'בדיקת טמפרטורה בעת פריקה', 'סלילה והידוק', 'בדיקת עובי, שיפועים וגמר', 'אישור סופי']),
  },
  drainagePiping: {
    label: 'צנרת ניקוז',
    title: 'תיוג צנרת ניקוז',
    category: 'צנרת ניקוז',
    items: makeItems('drainagePiping', ['אישור חומר/סוג חומר', 'בדיקת תוואי וחפירה', 'בדיקת מצע ותחתית', 'הנחת צנרת ושוחות', 'בדיקת שיפועים ואטימות', 'כיסוי ואישור סופי']),
  },
} as const;

export const normalizeChecklistTemplateKey = (key: string | undefined | null): ChecklistTemplateKey =>
  key && Object.prototype.hasOwnProperty.call(checklistTemplates, key) ? key : 'general';

export const buildChecklistItemsFromTemplate = (templateKey: ChecklistTemplateKey): ChecklistItem[] =>
  checklistTemplates[normalizeChecklistTemplateKey(templateKey)].items.map((item) => ({ ...item, id: crypto.randomUUID?.() ?? `${item.id}-${Date.now()}` }));
