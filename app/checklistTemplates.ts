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
  stoneFacingGravityWall: {
    label: 'בניית קיר כובד – חזית אבן לקט',
    title: 'רשימת תיוג לבניית קיר כובד – חזית אבן לקט',
    category: 'קירות כובד ובטון',
    items: [
      ['שימוש בתכניות ובפרטים בגרסה מעודכנת', 'בקרת איכות'],
      ['אישור מקור האבן, גוון וגודל (אישור אדריכל / מתכנן)', 'בקרת איכות'],
      ['אישור מפעל הבטון, תערובת ומלט הבנייה', 'בקרת איכות'],
      ['סימון צירים ורומים על ידי מודד מוסמך', 'מודד'],
      ['אישור השתית על ידי המתכנן ויועץ הקרקע (נקודת עצירה)', 'מתכנן / יועץ קרקע'],
      ['בניית מעטפת אבן – מהלכים ומילוי מישקים', 'מנהל עבודה'],
      ['הרכבת תבניות בגב הקיר ובדיקת יציבותן ואטימותן', 'מנהל עבודה'],
      ['אישור בקרת איכות ליציקה', 'בקרת איכות'],
      ['יציקת גוף הקיר בשכבות כל 60 ס״מ ורטוט מבוקר', 'מנהל עבודה'],
      ['נטילת דגימות בטון ובדיקת סומך על ידי מעבדה (ת״י 26)', 'מעבדה'],
      ['התקנת נקזים 4״ בתדירות ובשיפוע לפי הפרט', 'מנהל עבודה'],
      ['התקנת מסננת חצץ ועטיפת בד גיאוטכני בגב הנקזים', 'מנהל עבודה'],
      ['אשפרת הבטון וניקוי פני האבן', 'מנהל עבודה'],
      ['בדיקת פתחים ונקזים לאחר השלמת המילוי', 'בקרת איכות'],
      ['מדידת עדות (As Made)', 'מודד'],
      ['בדיקה חזותית סופית ואישור סיום שלב', 'בקרת איכות'],
    ].map(([description, responsible], index) => ({
      id: `stoneFacingGravityWall-${index + 1}`,
      description,
      responsible,
      status: 'לא נבדק',
      notes: '',
      inspector: '',
      executionDate: '',
    })),
  },
  dryMethodPiles: {
    label: 'כלונסאות בשיטה יבשה',
    title: 'רשימת תיוג לביצוע כלונסאות בשיטה יבשה / מיקרופייל',
    category: 'כלונסאות',
    procedureNo: '43',
    edition: 'a',
    procedureDate: '01.02.2020',
    items: [
      { id: 'dryMethodPiles-1', description: 'קיום בקרה מקדימה: אישור קבלן משנה ואישור תערובת בטון', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'dryMethodPiles-2', description: 'עבודה עם תוכניות מעודכנות', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'dryMethodPiles-3', description: 'בדיקת מפלס קרקע וסימון הכלונס', responsible: 'מודד', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'dryMethodPiles-4', description: 'בדיקת כלוב הזיון, כולל צינורות לבדיקות, בהתאם לתוכניות לביצוע', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'dryMethodPiles-5', description: 'בדיקת הארקה והתאמה לתוכנית הארקת יסוד', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'dryMethodPiles-6', description: 'בדיקת תקינות הציוד', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'dryMethodPiles-7', description: 'בדיקת קידוח הבור: אנכיות, מיקום ועומק; מעבר בין מכונות קידוח במידת הצורך', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'dryMethodPiles-8', description: 'אישור הורדת כלוב הברזל וקיום שומרי מרחק', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'dryMethodPiles-9', description: 'אישור יציקה', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'dryMethodPiles-10', description: 'פיקוח על יציקת הבטון ורצף האספקה', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'dryMethodPiles-11', description: 'נטילת מדגמי בטון לבדיקת סומך וחוזק', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'dryMethodPiles-12', description: 'סיתות החלק העליון', responsible: 'מנהל עבודה', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'dryMethodPiles-13', description: 'בדיקות גאמא / אולטרה־סוניות', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'dryMethodPiles-14', description: 'בדיקת מיקום ומפלס הכלונס (מפלס קוצי ברזל)', responsible: 'מודד', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'dryMethodPiles-15', description: 'אישור סופי לאלמנט', responsible: 'בקרת איכות', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
    ],
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
    label: 'חשמל - התקנת תא בקרה',
    title: 'רשימת תיוג: התקנת תאי בקרה',
    category: 'חשמל',
    items: [
      { id: 'electricalControlCells-1', description: 'אישור קבלן', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-2', description: 'אישור ציוד וחומרים + בדיקת ציוד שסופק לשטח', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-3', description: 'מדידה וסימון תשתיות תת קרקעיות', responsible: 'מנ"ע/מודד', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-4', description: 'בדיקת תוכנית מאושרת לביצוע', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-5', description: 'בדיקת ציוד שסופק לשטח', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-6', description: 'בדיקת סוג ודגם השוחה והתאמתה לתקן/תוכנית', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-7', description: 'בדיקת סוג מכסה והתאמתו לתקן/תוכנית', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-8', description: 'חפירה בעומק הנדרש בהתאם לסוג השוחה', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-9', description: 'ניקוי ופילוס תחתית תעלה / רצפה', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-10', description: 'הנחת שוחה ופילוסה', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-11', description: 'ביטון שוחה בחדירת צנרת ובין חוליות', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-12', description: 'מילוי חצץ בתחתית השוחה', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-13', description: 'אישור מודד למיקום שוחה AS MADE', responsible: 'מודד / מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalControlCells-14', description: 'בדיקה ויזואלית להתקנה', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
    ],
  },
  electricalCrossingPipesCables: {
    label: 'חשמל - כבלים ותקשורת בצנרת תת קרקעית',
    title: 'רשימת תיוג: תשתיות צנרת וכבלים לחשמל ותקשורת',
    category: 'חשמל',
    items: [
      { id: 'electricalCrossingPipesCables-1', description: 'אישור קבלן', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-2', description: 'אישור ציוד וחומרים + בדיקת ציוד שסופק לשטח', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-3', description: 'מדידה וסימון תשתיות תת קרקעיות', responsible: 'מנ"ע/מודד', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-4', description: 'בדיקת תוכנית מאושרת לביצוע', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-5', description: 'בדיקת ציוד שסופק לשטח', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-6', description: 'ביצוע חפירה לעומק מתוכנן / תיקני', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-7', description: 'ניקוי וריבוד תחתית התעלה', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-8', description: 'הנחת גיד הארקה CU35', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-9', description: 'הנחת צנרת מתוכננת בתעלה', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-10', description: 'חוטי משיכה בצנרת', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-11', description: 'שמירת מרחק תיקני בין צנרת חשמל לצנרת תקשורת', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-12', description: 'ביצוע הגנות בנקודת הצטלבות עם מכשולים', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-13', description: 'כיסוי תעלה והנחת סרט הסימון הנדרש', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-14', description: 'סגירת תעלה, ביצוע הידוק וסילוק עודפי אדמה', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-15', description: 'בדיקת מנדרול לצנרת', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-16', description: 'השחלת כבלי חשמל לפי תכנון', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-17', description: 'AS MADE', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-18', description: 'הגנה על קצוות כבלים עד חיבור סופי', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalCrossingPipesCables-19', description: 'סימון וסידור כבלים בתאי מעבר', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
    ],
  },
  electricalLightingPole: {
    label: 'חשמל - התקנת עמודי תאורה נמוכים',
    title: 'רשימת תיוג: התקנת עמודי תאורה עד 18 מטר כולל זרועות וגופי תאורה',
    category: 'חשמל',
    items: [
      { id: 'electricalLightingPole-1', description: 'אישור קבלן', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-2', description: 'בדיקת תקינות יסוד בטון לעמוד תאורה וכבלי חשמל לפני התקנה', responsible: 'מנ"ע/מודד', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-3', description: 'בדיקת תוכנית מאושרת לביצוע', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-4', description: 'אישור עמוד תאורה, זרועות, גופי תאורה ונורות', responsible: 'מנ"ע/מודד', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-5', description: 'בדיקת חיבור זרועות עם פנסים, מגשי חיבור, חיבור כבלים והארקות, הכנת יסוד להתקנת ע.ת. וזיפות בסיס עמוד', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-6', description: 'פילוס וחיזוק עמוד, כיוון פתח שירות בעמוד', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-7', description: 'ביצוע דיוס בין יסוד בטון לתחתית פלטת עמוד', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-8', description: 'צביעת עמוד תאורה בפסים שחור לבן', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-9', description: 'ביצוע מספור לעמוד תאורה', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-10', description: 'התקנת שוחת הארקה בהתאם לתוכנית', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-11', description: 'כיסוי בורג יסוד לפי פרט', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-12', description: 'התאמת ברגי יסוד להתקנת בורג שביר (אם נדרש)', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-13', description: 'בדיקת חיבור חשמלי בעמודים כולל הארקות', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingPole-14', description: 'בדיקה ויזואלית', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
    ],
  },
  electricalLightingCabinet: {
    label: 'חשמל - התקנת מרכזיית תאורה',
    title: 'רשימת תיוג: התקנת מרכזיית תאורה / לוח חשמל',
    category: 'חשמל',
    items: [
      { id: 'electricalLightingCabinet-1', description: 'אישור מפעל / יצרן לוחות', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingCabinet-2', description: 'אישור תוכנית ללוח חשמל / מרכזיית תאורה על ידי מתכנן חשמל', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingCabinet-3', description: 'בדיקת לוח חשמל במפעל', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingCabinet-4', description: 'אישור מתכנן להוצאת לוח חשמל מהמפעל', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingCabinet-5', description: 'ביצוע יסוד בטון ללוח חשמל לפי פרט כולל ביצוע וחיבור ההארקות', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingCabinet-6', description: 'התקנת לוח חשמל לפי פרט מאושר', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingCabinet-7', description: 'חיבור תיקני לכבל ההזנה וכבלי מעגלים מוזנים', responsible: 'מנ"ע / חשמלאי', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingCabinet-8', description: 'התאמת סוג וחתך כבלים לפי תוכנית מאושרת', responsible: 'מנ"ע / חשמלאי', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingCabinet-9', description: 'כיול מפסק ראשי', responsible: 'חשמלאי', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingCabinet-10', description: 'איזון פאזות', responsible: 'חשמלאי', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingCabinet-11', description: 'שילוט כבלים', responsible: 'מנ"ע / חשמלאי', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingCabinet-12', description: 'תוכנית AS MADE', responsible: 'מנ"ע / חשמלאי', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingCabinet-13', description: 'פס השוואת פוטנציאלים', responsible: 'מנ"ע / חשמלאי', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingCabinet-14', description: 'אטימת לוח חשמל', responsible: 'מנ"ע / חשמלאי', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingCabinet-15', description: 'בדיקת בודק חשמל מוסמך', responsible: 'מנ"ע / בודק', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
    ],
  },
  electricalLightingFoundation: {
    label: 'חשמל - יציקת יסוד בטון לעמודים',
    title: 'רשימת תיוג: ביצוע יסודות לעמודי תאורה',
    category: 'חשמל',
    items: [
      { id: 'electricalLightingFoundation-1', description: 'אישור קבלן', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingFoundation-2', description: 'אישור ציוד וחומרים', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingFoundation-3', description: 'מדידה וסימון מיקום יסודות', responsible: 'מנ"ע/מודד', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingFoundation-4', description: 'בדיקת תוכנית מאושרת לביצוע', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingFoundation-5', description: 'בדיקת ציוד שסופק לשטח', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingFoundation-6', description: 'סימון מיקום היסוד בהתאם לתוכנית מאושרת', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingFoundation-7', description: 'בדיקת גודל היסוד בהתאם לתוכנית מאושרת', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingFoundation-8', description: 'התאמת גודל בורג ליסוד עמוד / אישור מעבדה / פילוס בורג לפני יציקה', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingFoundation-9', description: 'קיום פלח הארקת יסוד מרותך לבורג', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingFoundation-10', description: 'התקנת צנרת כניסה ויציאה בצורה תקנית', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingFoundation-11', description: 'יציקה בבטון לפי פרט מאושר', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingFoundation-12', description: 'תוצאות בדיקת בטון', responsible: 'מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingFoundation-13', description: 'אישור מודד AS MADE', responsible: 'מודד / מנ"ע', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
      { id: 'electricalLightingFoundation-14', description: 'בדיקה ויזואלית', responsible: 'מב"א', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' },
    ],
  },
} as const;

export const normalizeChecklistTemplateKey = (key: string | undefined | null): ChecklistTemplateKey =>
  key && Object.prototype.hasOwnProperty.call(checklistTemplates, key) ? key as ChecklistTemplateKey : 'general';

export const buildChecklistItemsFromTemplate = (templateKey: ChecklistTemplateKey): ChecklistItem[] =>
  checklistTemplates[normalizeChecklistTemplateKey(templateKey)].items.map((item) => ({ ...item, id: crypto.randomUUID?.() ?? `${item.id}-${Date.now()}` }));
