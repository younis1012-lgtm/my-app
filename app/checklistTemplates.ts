import type { ChecklistItem, ChecklistTemplateKey, Project } from './types';
export const defaultProjects: Project[] = [
  { id: 'default-project', name: 'כביש 781 שפרעם', description: 'פרויקט ברירת מחדל', manager: '', isActive: true, createdAt: new Date().toLocaleString('he-IL') },
];

const managerKeywords = [
  'ציוד', 'כלי עבודה', 'ניקוי', 'פינוי', 'סילוק', 'עודפי', 'הכנת השטח', 'הכנת אזור',
  'ביצוע', 'פיזור', 'סלילה', 'הידוק', 'הנחה', 'הנחת', 'התקנה', 'התקנת', 'הרכבה',
  'יציקה', 'אשפרה', 'רטוט', 'קידוח', 'הדבקה', 'מילוי', 'כיסוי', 'שטיפה', 'חיטוי',
  'ריסוס', 'פריקה', 'גמר', 'תיקונים', 'מישקים', 'חיבורים', 'אביזרים', 'סידור', 'פריימר'
];

const surveyorKeywords = [
  'סימון', 'מדיד', 'מודד', 'מפלס', 'מפלסים', 'גובה', 'גבהים', 'שיפוע', 'שיפועים',
  'עומק', 'עובי', 'קו', 'קווים', 'תוואי', 'מיקום', 'מידות', 'as-made', 'AS-MADE', 'קילומטר', 'ק"מ', 'חתך'
];

const qualityKeywords = [
  'אישור', 'תעודה', 'תעודות', 'בדיקה מוקדמת', 'בדיקות מוקדמות', 'בדיקות אפיון',
  'מעבדה', 'מדגמים', 'תוצאות', 'תקן', 'מפרט', 'בקרה ויזואלית', 'חזותית', 'סופי'
];

const includesAny = (description: string, keywords: string[]) =>
  keywords.some((keyword) => description.includes(keyword));

const responsibilityFor = (description: string) => {
  // פעולות ביצוע/ניקוי/ציוד הן באחריות מנהל עבודה, גם אם מופיעה המילה "בדיקת".
  if (includesAny(description, managerKeywords)) return 'מנהל עבודה';

  // מדידות, סימונים, מפלסים, גבהים, שיפועים, עומקים ומידות הן באחריות מודד.
  if (includesAny(description, surveyorKeywords)) return 'מודד';

  // אישורים, תעודות, התאמה למפרט ובדיקות איכות הן באחריות בקרת איכות.
  if (includesAny(description, qualityKeywords) || description.includes('בדיק')) return 'בקרת איכות';

  return 'בקרת איכות';
};

const makeItems = (key: string, descriptions: string[]): ChecklistItem[] =>
  descriptions.map((description, index) => ({
    id: `${key}-${index + 1}`,
    description,
    responsible: responsibilityFor(description),
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
    label: 'פיזור מצעים',
    title: 'רשימת תיוג לעבודות פיזור מצעים',
    category: 'פיזור מצעים',
    procedureNo: '051.21.01',
    edition: 'א׳',
    procedureDate: '20/05/2010',
    items: [
      { id: 'baseCourseSpreading-1', description: 'בדיקת תוכניות לביצוע + מהדורה', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: 'מוניר', executionDate: '' },
      { id: 'baseCourseSpreading-2', description: 'איתור בדיקות מקדימות לחומר המצע', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: 'מוניר', executionDate: '' },
      { id: 'baseCourseSpreading-3', description: 'אימות תוצאות כל הבדיקות לשכבה הקודמת', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: 'מוניר', executionDate: '' },
      { id: 'baseCourseSpreading-4', description: 'בדיקה חזותית לשלמות השכבה הקודמת', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: 'מוניר', executionDate: '' },
      { id: 'baseCourseSpreading-5', description: 'פיזור שכבה חדשה אחידה ומפולסת', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: 'גמאל', executionDate: '' },
      { id: 'baseCourseSpreading-6', description: 'ביצוע בדיקות אפיון שוטפות', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: 'מוניר', executionDate: '' },
      { id: 'baseCourseSpreading-7', description: 'פיזור, פילוס, סילוק ריכוזי אבן, הרטבה והידוק', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: 'גמאל', executionDate: '' },
      { id: 'baseCourseSpreading-8', description: 'בקרה ויזואלית', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: 'מוניר', executionDate: '' },
      { id: 'baseCourseSpreading-9', description: 'בדיקת מפלסי השכבה כל שכבה שנייה ו/או בסוף השלב', responsible: 'מודד', status: 'לא נבדק', notes: '', inspector: 'אחמד', executionDate: '' },
      { id: 'baseCourseSpreading-10', description: 'בדיקות דרגת הידוק ותכולת רטיבות', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: 'מוניר', executionDate: '' },
      { id: 'baseCourseSpreading-11', description: 'בדיקת מישוריות', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: 'מוניר', executionDate: '' },
      { id: 'baseCourseSpreading-12', description: 'בדיקות FWD לשכבה הסופית', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: 'מוניר', executionDate: '' },
      { id: 'baseCourseSpreading-13', description: 'אישור סופי', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: 'מוניר', executionDate: '' },
    ],
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
    procedureNo: '051.21.01',
    edition: 'א׳',
    procedureDate: '01.02.2020',
    items: [
      { id: 'asphaltSite-1', description: 'אישור בקרה מוקדמת', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'asphaltSite-2', description: 'תקינות שכבה קודמת', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'asphaltSite-3', description: 'אישור בקרה ויזואלית של השכבה הקודמת', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'asphaltSite-4', description: 'סימון ע״י מודד מוסמך', responsible: 'מודד', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'asphaltSite-5', description: 'תקינות פינישר, כבלים, מרססת וציוד הידוק', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'asphaltSite-6', description: 'ביצוע בדיקת אמולסיה', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'asphaltSite-7', description: 'בדיקת כמות ריסוס יסוד או מאחה', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'asphaltSite-8', description: 'קיום רשימת תוכניות עבודה מעודכנות', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'asphaltSite-9', description: 'ביצוע בדיקות שוטפות לתערובת אספלטית', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'asphaltSite-10', description: 'מעקב אחרי טמפרטורת התערובת, פיזור בעובי נדרש ועיבוד השכבה', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'asphaltSite-11', description: 'ביצוע גלילי אספלט בשיטת ר.י.פ בשדה', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'asphaltSite-12', description: 'ביצוע גלילי אספלט בשיטת וואקום בשדה', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'asphaltSite-13', description: 'ביצוע גלילי אספלט בשיטת ר.י.פ בתפר', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'asphaltSite-14', description: 'ביצוע גלילי אספלט בשיטת וואקום בתפר', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'asphaltSite-15', description: 'ביצוע מישוריות אורכי ורוחבי', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'asphaltSite-16', description: 'ביצוע גליות', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'asphaltSite-17', description: 'ביצוע בדיקות FWD לאספלט שכבה עליונה', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'asphaltSite-18', description: 'ביצוע בדיקות התנגדות להחלקה לאספלט שכבה עליונה', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'asphaltSite-19', description: 'בדיקת התאמת מפלס לדרישות המפרט', responsible: 'מודד', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'asphaltSite-20', description: 'בדיקה ויזואלית וגמר', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
    ],
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
  electricalControlCells: {
    label: 'חשמל - תאי בקרה',
    title: 'רשימת תיוג להתקנת תאי בקרה',
    category: 'חשמל',
    items: [
      { id: 'electricalControlCells-1', description: 'בדיקת תוכניות מעודכנות', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-2', description: 'מדידה וסימון מיקום וגובה (לפי תוכנית עדכנית)', responsible: 'מודד', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-3', description: 'אישורים לביצוע חפירה', responsible: 'מנהל ביצוע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-4', description: 'חפירה לעומק המתוכנן', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-5', description: 'פתיחת פתחים בתא עבור צנרת על פי תכנית פרטים', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-6', description: 'התקנת התא בעזרת אביזרי הרמה תקניים', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-7', description: 'הכנסת צנרת לדופן התא על פי תוכנית פרטים', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-8', description: 'ביטון צנרת מחוץ לתא ובתוכו', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-9', description: 'אישור שלב', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-10', description: 'מילוי והידוק אדמה מקומית סביב התא', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-11', description: 'התאמת המכסה לתא בהתאם לגובה קרקע', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-12', description: 'תוצאות בדיקת בטון 28 יום', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
    ],
  },
  electricalCrossingPipesCables: {
    label: 'חשמל - חצייה וצנרת/כבלים',
    title: 'רשימת תיוג לעבודות חצייה, הנחת וכיסוי צנרת/כבלים',
    category: 'חשמל',
    items: [
      { id: 'electricalCrossingPipesCables-1', description: 'בדיקת עבודה ע"פ תוכניות מעודכנות', responsible: 'מב"את', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-2', description: 'מדידה וסימון מיקום ע"י מודד כולל גובה', responsible: 'מודד', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-3', description: 'אישורים לביצוע חפירה', responsible: 'מנהל ביצוע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-4', description: 'ביצוע חפירה לעומק המתוכנן', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-5', description: 'יישור תחתית קרקעית החפירה', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-6', description: 'פיזור חול בשכבה של כ-10 ס"מ', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-7', description: 'הנחת צנרת ו/או מוליך הארקת נחושת', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-8', description: 'אישור שלב', responsible: 'מב"את', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-9', description: 'כיסוי מצע נברר כ-20 ס"מ לאחר הנחת הצנרת', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-10', description: 'מילוי אדמה ע"פ גיליון פרטי מבנה תוך כדי הידוק בשכבות של 20 ס"מ', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-11', description: 'הנחת סרט סימון כ-30 ס"מ מתחת לפני קרקע סופיים', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-12', description: 'נקודת עצירה - ביצוע השחלת חבל משיכה בצנרת', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-13', description: 'בדיקת מנדרול - לאחר השחלת החבל', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-14', description: 'השחלת כבלים', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
    ],
  },
  electricalLightingPole: {
    label: 'חשמל - עמוד תאורה',
    title: "רשימת תיוג להתקנת עמודים עד 18 מ' וגופי תאורה",
    category: 'חשמל',
    items: [
      { id: 'electricalLightingPole-1', description: 'אישור בקרה מוקדימה', responsible: 'בקרת איכות חשמל', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-2', description: 'בדיקת תוכנית מעדכנת', responsible: 'בקרת איכות חשמל', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-3', description: 'הכנת זרועות עם פנסים כולל גירוז הברגים בזווית הנדרשת על הזרוע + חיבור הכבל המזין כולל בדיקת תקינות הפנס, סימון הפנס, חיזוק כל המגעים ותברוג הנורה', responsible: 'מ"ע קבלן חשמל', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-4', description: 'בדיקת תקינות ראשי יסודות, כבלי חשמל, איטום, שרוולים', responsible: 'מ"ע קבלן חשמל', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-5', description: 'הנפת העמוד והתקנתו על היסוד, תוך הקפדה על כיוון פתח האביזרים זיפות תושבת העמוד', responsible: 'מ"ע קבלן חשמל', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-6', description: 'פילוס העמוד וחיזוק, מתיחה סופית של אומי ברגי היסוד, תוספת אום', responsible: 'מ"ע קבלן חשמל', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-7', description: 'התקנת מגש בעמוד הכולל חיבור הארקה ואביזרי חשמל לפי פרט', responsible: 'מ"ע קבלן חשמל', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-8', description: 'התקנת צינורות ממולאים בגריז לכיסוי הברגים', responsible: 'מ"ע קבלן חשמל', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-9', description: 'ביצוע אזמד', responsible: 'מודד הקבלן', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-10', description: 'מילוי דיס בטון בין היסוד לפלטת העמוד', responsible: 'מ"ע קבלן חשמל', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-11', description: 'אישור סופי', responsible: 'בקרת איכות חשמל', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
    ],
  },
} as const;

export const normalizeChecklistTemplateKey = (key: string | undefined | null): ChecklistTemplateKey =>
  key && Object.prototype.hasOwnProperty.call(checklistTemplates, key) ? key as ChecklistTemplateKey : 'general';

export const buildChecklistItemsFromTemplate = (templateKey: ChecklistTemplateKey): ChecklistItem[] =>
  checklistTemplates[normalizeChecklistTemplateKey(templateKey)].items.map((item) => ({ ...item, id: crypto.randomUUID?.() ?? `${item.id}-${Date.now()}` }));
