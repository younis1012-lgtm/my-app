'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';


type Section = 'home' | 'projects' | 'checklists' | 'nonconformances' | 'trialSections' | 'preliminary';
type PreliminaryTab = 'suppliers' | 'subcontractors' | 'materials';
type ChecklistTemplateKey = 'general' | 'guardrails' | 'aggregateDistribution' | 'curbstones' | 'standardCompaction' | 'controlledCompaction' | 'signage' | 'paving' | 'steelGuardrails' | 'asphalt' | 'drainagePipes' | 'curbCasting' | 'catEyes' | 'siteConcrete' | 'jkWorks';

type Project = {
  id: string;
  name: string;
  description: string;
  manager: string;
  isActive: boolean;
  createdAt: string;
};

type ChecklistItem = {
  id: string;
  description: string;
  responsible: string;
  status: 'לא נבדק' | 'תקין' | 'לא תקין';
  notes: string;

  // חדש 👇
  inspector: string;
  executionDate: string;
};
type ChecklistRecord = {
  id: string;
  projectId: string;
  templateKey: ChecklistTemplateKey;
  title: string;
  category: string;
  location: string;
  date: string;
  contractor: string;
  notes: string;
  items: ChecklistItem[];
  savedAt: string;
};

type NonconformanceRecord = {
  id: string;
  projectId: string;
  title: string;
  location: string;
  date: string;
  raisedBy: string;
  severity: 'נמוכה' | 'בינונית' | 'גבוהה';
  status: 'פתוח' | 'בטיפול' | 'נסגר';
  description: string;
  actionRequired: string;
  notes: string;
  savedAt: string;
};

type TrialSectionRecord = {
  id: string;
  projectId: string;
  title: string;
  location: string;
  date: string;
  spec: string;
  result: string;
  approvedBy: string;
  status: 'טיוטה' | 'אושר' | 'נדחה';
  notes: string;
  savedAt: string;
};

type SupplierPreliminary = {
  supplierName: string;
  suppliedMaterial: string;
  contactPhone: string;
  approvalNo: string;
  notes: string;
};

type SubcontractorPreliminary = {
  subcontractorName: string;
  field: string;
  contactPhone: string;
  approvalNo: string;
  notes: string;
};

type MaterialPreliminary = {
  materialName: string;
  source: string;
  usage: string;
  certificateNo: string;
  notes: string;
};

type PreliminaryRecord = {
  id: string;
  projectId: string;
  subtype: PreliminaryTab;
  title: string;
  date: string;
  status: 'טיוטה' | 'מאושר' | 'לא מאושר';
  supplier?: SupplierPreliminary;
  subcontractor?: SubcontractorPreliminary;
  material?: MaterialPreliminary;
  savedAt: string;
};

type PersistedData = {
  projects: Project[];
  currentProjectId: string | null;
  savedChecklists: ChecklistRecord[];
  savedNonconformances: NonconformanceRecord[];
  savedTrialSections: TrialSectionRecord[];
  savedPreliminary: PreliminaryRecord[];
};

const STORAGE_KEY = 'yk-quality-stage3-v2';

const defaultProjects: Project[] = [
  {
    id: '1',
    name: 'כביש 781',
    description: 'פרויקט תשתיות',
    manager: '',
    isActive: true,
    createdAt: new Date().toLocaleString('he-IL'),
  },
];

const checklistTemplates: Record<
  ChecklistTemplateKey,
  { label: string; title: string; category: string; items: { description: string; responsible: string }[] }
> = {
  general: {
    label: 'רשימה כללית',
    title: 'רשימת תיוג',
    category: 'עבודות עפר',
    items: [
      { description: 'בדיקת תוכניות לביצוע + מהדורה', responsible: 'בקרת איכות' },
      { description: 'בדיקה חזותית לשטח לפני תחילת עבודה', responsible: 'בקרת איכות' },
      { description: 'אישור סופי', responsible: 'בקרת איכות' },
    ],
  },
  standardCompaction: {
    label: 'הידוק רגיל',
    title: 'רשימת תיוג לעבודות הידוק רגיל',
    category: 'הידוק',
    items: [
      { description: 'בדיקת תוכניות לביצוע + מהדורה', responsible: 'בקרת איכות' },
      { description: 'איתור הבדיקות המקדימות התואמות לחומר המילוי', responsible: 'בקרת איכות' },
      { description: 'אימות תוצאות כל הבדיקות לשכבה הקודמת', responsible: 'בקרת איכות' },
      { description: 'בדיקה חזותית לשלמות השכבה הקודמת', responsible: 'בקרת איכות' },
      { description: 'ביצוע בדיקות אפיון שוטפות', responsible: 'בקרת איכות' },
      { description: 'פילוס, סילוק ריכוזי אבן, הרטבה והידוק', responsible: 'מנהל עבודה' },
      { description: 'בקרה ויזואלית', responsible: 'בקרת איכות' },
      { description: 'בדיקת מפלסי השכבה', responsible: 'מודד הקבלן' },
      { description: 'בדיקות מעברי מכבש', responsible: 'בקרת איכות' },
      { description: 'בדיקת FWD', responsible: 'בקרת איכות' },
      { description: 'אישור סופי', responsible: 'בקרת איכות' },
    ],
  },
  controlledCompaction: {
    label: 'הידוק מבוקר',
    title: 'רשימת תיוג לעבודות הידוק מבוקר',
    category: 'הידוק',
    items: [
      { description: 'בדיקת תוכניות לביצוע + מהדורה', responsible: 'בקרת איכות' },
      { description: 'איתור הבדיקות המקדימות התואמות לחומר המילוי', responsible: 'בקרת איכות' },
      { description: 'אימות תוצאות כל הבדיקות לשכבה הקודמת', responsible: 'בקרת איכות' },
      { description: 'בדיקה חזותית לשלמות השכבה הקודמת', responsible: 'בקרת איכות' },
      { description: 'ביצוע בדיקות אפיון שוטפות', responsible: 'בקרת איכות' },
      { description: 'פילוס, סילוק ריכוזי אבן, הרטבה והידוק', responsible: 'מנהל עבודה' },
      { description: 'בקרה ויזואלית', responsible: 'בקרת איכות' },
      { description: 'בדיקת מפלסי השכבה', responsible: 'מודד הקבלן' },
      { description: 'בדיקות דרגת הידוק ורטיבות', responsible: 'בקרת איכות' },
      { description: 'בדיקת FWD', responsible: 'בקרת איכות' },
      { description: 'אישור סופי', responsible: 'בקרת איכות' },
    ],
  },
  aggregateDistribution: {
    label: 'פיזור מצעים',
    title: 'רשימת תיוג לעבודות פיזור מצעים',
    category: 'מצעים',
    items: [
      { description: 'בדיקת תוכניות לביצוע + מהדורה', responsible: 'בקרת איכות' },
      { description: 'איתור בדיקות מקדימות לחומר המצע', responsible: 'בקרת איכות' },
      { description: 'אימות תוצאות כל הבדיקות לשכבה הקודמת', responsible: 'בקרת איכות' },
      { description: 'בדיקה חזותית לשלמות השכבה הקודמת', responsible: 'בקרת איכות' },
      { description: 'פיזור שכבה חדשה אחידה ומפולסת', responsible: 'מנהל עבודה' },
      { description: 'ביצוע בדיקות אפיון שוטפות', responsible: 'בקרת איכות' },
      { description: 'פיזור, פילוס, סילוק ריכוזי אבן, הרטבה והידוק', responsible: 'מנהל עבודה' },
      { description: 'בקרה ויזואלית', responsible: 'בקרת איכות' },
      { description: 'בדיקת מפלסי השכבה כל שכבה שנייה ו/או בסוף השלב', responsible: 'מודד הקבלן' },
      { description: 'בדיקות דרגת הידוק ותכולת רטיבות', responsible: 'בקרת איכות' },
      { description: 'בדיקת מישוריות', responsible: 'בקרת איכות' },
      { description: 'בדיקות FWD לשכבה הסופית', responsible: 'בקרת איכות' },
      { description: 'אישור סופי', responsible: 'בקרת איכות' },
    ],
  },
  guardrails: {
    label: 'עבודות מעקות',
    title: 'רשימת תיוג לעבודות מעקות',
    category: 'מעקות',
    items: [
      { description: 'אישור המעקה וסוגו', responsible: 'בקרת איכות' },
      { description: 'אישור חומרים ובדיקות מוקדמות + אישור קבלן משנה', responsible: 'בקרת איכות' },
      { description: 'סימון תוואי מעקה מתוכנן', responsible: 'מודד' },
      { description: 'בדיקת מרווח פעיל לפני התקנה', responsible: 'בקרת איכות' },
      { description: 'בדיקת תעודת משלוח', responsible: 'בקרת איכות' },
      { description: 'בקרה ויזואלית לחומרים המסופקים לשטח', responsible: 'בקרת איכות' },
      { description: 'בדיקה ויזואלית לקו ההתקנה', responsible: 'בקרת איכות' },
      { description: 'בדיקת סגירת ברגים ורום מעקה', responsible: 'מעבדה' },
      { description: 'עומק החדרת העמוד', responsible: 'מנהל עבודה' },
      { description: 'בדיקת מרווח פעיל + התקנת מחזירי אור', responsible: 'בקרת איכות' },
      { description: 'מדידה לאחר הביצוע', responsible: 'מודד' },
      { description: 'אישור סופי', responsible: 'בקרת איכות' },
    ],
  },
  steelGuardrails: {
    label: 'מעקות פלדה',
    title: 'רשימת תיוג לאספקה והרכבת מעקות פלדה',
    category: 'מעקות פלדה',
    items: [
      { description: 'בדיקת תוכניות לביצוע + מהדורה', responsible: 'מהנדס בקרת איכות' },
      { description: 'תעודות הסמכת רתכים', responsible: 'מהנדס בקרת איכות' },
      { description: 'ביצוע בדיקות אולטרסוניות לאיכות ריתוכים', responsible: 'מעבדה' },
      { description: 'אישור משלוח לגילוון', responsible: 'מהנדס בקרת איכות' },
      { description: 'קבלת תעודות טיב ועובי גילוון מהמפעל המגלוון', responsible: 'מהנדס בקרת איכות' },
      { description: 'ביצוע בדיקות עובי גילוון', responsible: 'מעבדה' },
      { description: 'בדיקה ויזואלית לניקיון ברגי העיגון', responsible: 'מהנדס בקרת איכות' },
      { description: 'אישור להרכבת מעקה', responsible: 'מהנדס בקרת איכות' },
      { description: 'בדיקת אופן הרכבת המעקה', responsible: 'מהנדס בקרת איכות' },
      { description: 'בדיקה ויזואלית לאיתור פגיעות ושפשופים של הגילוון', responsible: 'מהנדס בקרת איכות' },
      { description: 'בדיקה ויזואלית של קו המעקה לאחר הרכבה', responsible: 'מהנדס בקרת איכות' },
    ],
  },
  signage: {
    label: 'תמרור ושילוט',
    title: 'רשימת תיוג לעבודות תמרור ושילוט',
    category: 'תמרור ושילוט',
    items: [
      { description: 'אישור שלב ביצוע קודם', responsible: 'בקרת איכות' },
      { description: 'בדיקות מוקדמות', responsible: 'בקרת איכות' },
      { description: 'סימון', responsible: 'מודד' },
      { description: 'הכנת האלמנטים', responsible: 'מנהל עבודה' },
      { description: 'הצבת השילוט והתמרור', responsible: 'מנהל עבודה' },
      { description: 'בקרה ויזואלית', responsible: 'מנהל עבודה' },
      { description: 'בדיקות החזר אור', responsible: 'בקרת איכות' },
      { description: 'AS-MADE', responsible: 'מודד' },
      { description: 'אישור הקטע', responsible: 'בקרת איכות' },
    ],
  },
  paving: {
    label: 'ריצוף',
    title: 'רשימת תיוג עבודות ריצוף',
    category: 'ריצוף',
    items: [
      { description: 'האם קיימת סקיצה / תוכנית / הנחיות בכתב לביצוע העבודות', responsible: 'מנהל העבודה' },
      { description: 'האם בוצע סיור וסימון מוקדם בנוכחות מנהל פרויקט', responsible: 'מנהל העבודה' },
      { description: 'אישור בקרה מוקדמת לטיב החומרים', responsible: 'בקרת איכות' },
      { description: 'בדיקת רום שתית', responsible: 'מנהל העבודה' },
      { description: 'בדיקת הידוק ורום מצעים', responsible: 'מנהל העבודה' },
      { description: 'פיזור חול דיונות בעובי 4 ס"מ', responsible: 'מנהל העבודה' },
      { description: 'פיזור חול מעל הריצוף והידוק בפלטה ויברציונית', responsible: 'מנהל העבודה' },
      { description: 'בדיקת מפלס אבן שפה / אבן אי מעל מפלס האספלט', responsible: 'מנהל העבודה' },
      { description: 'ביצוע תחתית ומשענת בטון לפי הפרט לאבן שפה / אבן אי', responsible: 'מנהל העבודה' },
      { description: 'מילוי הפוגות בין אבני השפה בטיט צמנטי', responsible: 'מנהל העבודה' },
      { description: 'ביצוע ראש אי מבטון מזוין', responsible: 'מנהל העבודה' },
      { description: 'תוצאות הבדיקה לאחר 28 יום', responsible: 'מנהל העבודה' },
      { description: 'אישור גמר העבודה', responsible: 'בקרת איכות' },
    ],
  },
  curbstones: {
    label: 'אבני שפה',
    title: 'רשימת תיוג לאבני שפה',
    category: 'אבני שפה',
    items: [
      { description: 'האם קיימת סקיצה / תוכנית / הנחיות בכתב לביצוע העבודות', responsible: 'מנהל העבודה' },
      { description: 'האם בוצע סיור וסימון מוקדם בנוכחות מנהל פרויקט', responsible: 'מנהל העבודה' },
      { description: 'אישור בקרה מוקדמת לטיב החומרים', responsible: 'בקרת איכות' },
      { description: 'בדיקת רום שתית', responsible: 'מנהל העבודה' },
      { description: 'בדיקת הידוק ורום מצעים', responsible: 'מנהל העבודה' },
      { description: 'פיזור חול דיונות בעובי 4 ס"מ', responsible: 'מנהל העבודה' },
      { description: 'פיזור חול מעל הריצוף והידוק בפלטה ויברציונית', responsible: 'מנהל העבודה' },
      { description: 'בדיקת מפלס אבן שפה / אבן אי מעל מפלס האספלט', responsible: 'מנהל העבודה' },
      { description: 'ביצוע תחתית ומשענת בטון לפי הפרט לאבן שפה / אבן אי', responsible: 'מנהל העבודה' },
      { description: 'מילוי הפוגות בין אבני השפה בטיט צמנטי', responsible: 'מנהל העבודה' },
      { description: 'ביצוע ראש אי מבטון מזוין', responsible: 'מנהל העבודה' },
      { description: 'תוצאות הבדיקה לאחר 28 יום', responsible: 'מנהל העבודה' },
      { description: 'אישור גמר העבודה', responsible: 'בקרת איכות' },
    ],
  },
  curbCasting: {
    label: 'הנחת / יציקת אבן שפה',
    title: 'רשימת תיוג להנחת / יציקת אבן שפה',
    category: 'אבני שפה',
    items: [
      { description: 'בדיקת תוכניות לביצוע + מהדורה', responsible: 'בקר איכות' },
      { description: 'בדיקה חזותית לשטח ולשלמות האבן טרם ההנחה', responsible: 'בקר איכות' },
      { description: 'אישור מוקדם לספק האבן', responsible: 'בקר איכות' },
      { description: 'סימון לביצוע', responsible: 'מודד' },
      { description: 'הנחת בסיס מבטון לאבן (אבן טרומית בלבד)', responsible: 'מנהל עבודה' },
      { description: 'הנחת / יציקת אבן שפה', responsible: 'מנהל עבודה' },
      { description: 'ביצוע גב ופוגות כנדרש', responsible: 'מנהל עבודה' },
      { description: 'בדיקת מפלסים ומיקום', responsible: 'מודד' },
      { description: 'בדיקה חזותית בגמר העבודה', responsible: 'בקר איכות' },
      { description: 'אישור סופי', responsible: 'בקרת איכות' },
    ],
  },
  catEyes: {
    label: 'עיני חתול',
    title: 'רשימת תיוג להתקנת עיני חתול',
    category: 'בטיחות ותמרור',
    items: [
      { description: 'בדיקת תוכניות לביצוע + מהדורה', responsible: 'מב"א' },
      { description: 'בקרה מקדימה לחומרים ולציוד', responsible: 'מב"א' },
      { description: 'סימון לביצוע', responsible: 'מודד הקבלן' },
      { description: 'התקנת עיני חתול', responsible: 'מנהל עבודה' },
      { description: 'בדיקה חזותית לאחר התקנה ובדיקה ידנית לחוזק ההדבקה', responsible: 'מב"א' },
      { description: 'בדיקת AS MADE', responsible: 'מודד הקבלן' },
      { description: 'בדיקת נראות', responsible: 'מעבדה' },
      { description: 'אישור סופי', responsible: 'מב"א' },
    ],
  },
  asphalt: {
    label: 'אספלט',
    title: 'רשימת תיוג לביצוע עבודות אספלט באתר',
    category: 'אספלט',
    items: [
      { description: 'אישור בקרה מוקדמת בהתאם לטופס 51.04', responsible: 'בקרת איכות' },
      { description: 'קיום אישור לשכבה קודמת', responsible: 'בקרת איכות' },
      { description: 'אישור בקרה ויזואלית של השכבה הקודמת', responsible: 'בקרת איכות' },
      { description: 'תקינות פינישר, כבלים, מרססת וציוד הידוק', responsible: 'בקרת איכות' },
      { description: 'קיום רשימת תוכניות עבודה מעודכנות', responsible: 'בקרת איכות' },
      { description: 'ביצוע בדיקות שוטפות – פרק 51.04', responsible: 'בקרת איכות' },
      { description: 'בדיקת התאמת מפלס לדרישות המפרט', responsible: 'מודד מוסמך' },
      { description: 'בדיקות גליות', responsible: 'בקרת איכות' },
      { description: 'בדיקה ויזואלית וגמר', responsible: 'בקרת איכות' },
    ],
  },
  drainagePipes: {
    label: 'צנרת ניקוז',
    title: 'רשימת תיוג להתקנת צנרת ניקוז',
    category: 'צנרת ניקוז',
    items: [
      { description: 'בדיקת תוכניות לביצוע + מהדורה', responsible: 'בקרת איכות' },
      { description: 'סימון צירי החפירה ומיקום', responsible: 'מודד הקבלן' },
      { description: 'חפירה והכנת תחתית החפירה והידוק', responsible: 'מנהל עבודה' },
      { description: 'אישור להנחת הצנרת', responsible: 'בקרת איכות' },
      { description: 'התקנה והנחת צנרת בהתאם לדרישות', responsible: 'מנהל עבודה' },
      { description: 'מדידת גבהים ושיפועים', responsible: 'מודד הקבלן' },
      { description: 'הזמנת בדיקות לשלמות הקו (צילום)', responsible: 'בקרת איכות' },
      { description: 'בדיקת אטימות וישרות הקו', responsible: 'בקרת איכות' },
      { description: 'התקנת אביזרים', responsible: 'בקרת איכות' },
      { description: 'עטיפת הצינור בחול', responsible: 'מנהל עבודה' },
      { description: 'אישור לביצוע מילוי חוזר', responsible: 'בקרת איכות' },
      { description: 'אישור סופי', responsible: 'בקרת איכות' },
    ],
  },
  siteConcrete: {
    label: 'יציקות באתר',
    title: 'רשימת תיוג ליציקות באתר',
    category: 'בטון',
    items: [
      { description: 'שימוש בתוכניות מעודכנות', responsible: 'מב"א' },
      { description: 'סימון מיקום ורשימת גבהים ליציקה', responsible: 'מודד' },
      { description: 'יציקת בטון רזה (עפ"י דרישת התוכנית)', responsible: 'מנהל עבודה' },
      { description: 'סידור הזיון, מיקום חפיות, גובה סטטי של החתך, עובי כיסוי נדרש', responsible: 'מנהל עבודה' },
      { description: 'בדיקת זיון, חיפוש, הארקות, קיטום פינות, אביזרים נלווים, ניקיון כללי ואישור להרכבת תבניות', responsible: 'מב"א' },
      { description: 'אישור ליציקה', responsible: 'מב"א' },
      { description: 'פיקוח על יציקת הבטון (רצף, עובי וריטוט)', responsible: 'מב"א' },
      { description: 'נטילת מדגמי בטון', responsible: 'מב"א' },
      { description: 'טיפול בפני הבטון עם סיום היציקה למניעת סדיקה', responsible: 'מנהל עבודה' },
      { description: 'תהליך אשפרה', responsible: 'מנהל עבודה' },
      { description: 'בדיקת חזות הבטון', responsible: 'מב"א' },
      { description: 'בדיקת מודד לאחר יציקה AS-Made', responsible: 'מודד' },
      { description: 'איטום', responsible: 'מנהל עבודה' },
      { description: 'אישור סופי', responsible: 'מב"א' },
    ],
  },
  jkWorks: {
    label: 'עבודות JK',
    title: 'רשימת תיוג לעבודות JK',
    category: 'JK',
    items: [
      { description: 'סימון בשטח', responsible: 'מודד' },
      { description: 'חפירת תעלות לקורות העיגון', responsible: 'מנהל עבודה' },
      { description: 'אישור הברזל ואישור ליציקת קורות העיגון', responsible: 'בקרת איכות' },
      { description: 'ביצוע עבודות העפר', responsible: 'מנהל עבודה' },
      { description: 'הנחת רשתות מתכת J.K STRUCTURE ועיגונן לקרקע', responsible: 'מנהל עבודה' },
      { description: 'אישור הנחת רשתות ואישור לפיזור הבטון', responsible: 'בקרת איכות' },
      { description: 'פיזור הבטון בגוון המתאים לפני השטח על גבי הרשתות', responsible: 'מנהל עבודה' },
      { description: 'בדיקת בטון', responsible: 'בקרת איכות' },
      { description: 'החלקת הבטון באמצעות מגרפות', responsible: 'מנהל עבודה' },
      { description: 'ביצוע אשפרה', responsible: 'מנהל עבודה' },
      { description: 'מדידת מצב לאחר ביצוע העבודות', responsible: 'מודד' },
      { description: 'אישור סופי', responsible: 'בקרת איכות' },
    ],
  },
};

const buildChecklistItemsFromTemplate = (templateKey: ChecklistTemplateKey) =>
  checklistTemplates[templateKey].items.map((item, index) => ({
    id: `${Date.now()}-${index}`,
    description: item.description,
    responsible: item.responsible,
    status: 'לא נבדק' as const,
    notes: '',
    inspector: '',
    executionDate: '',
  }));

const emptyChecklistItem = (id: string): ChecklistItem => ({
  id,
  description: '',
  responsible: '',
  status: 'לא נבדק',
  notes: '',
  inspector: '',
  executionDate: '',
});

const createDefaultChecklist = (
  templateKey: ChecklistTemplateKey = 'general'
): Omit<ChecklistRecord, 'id' | 'projectId' | 'savedAt'> => ({
  templateKey,
  title: checklistTemplates[templateKey].title,
  category: checklistTemplates[templateKey].category,
  location: '',
  date: '',
  contractor: '',
  notes: '',
  items: buildChecklistItemsFromTemplate(templateKey),
});

const createDefaultNonconformance = (): Omit<NonconformanceRecord, 'id' | 'projectId' | 'savedAt'> => ({
  title: '',
  location: '',
  date: '',
  raisedBy: '',
  severity: 'בינונית',
  status: 'פתוח',
  description: '',
  actionRequired: '',
  notes: '',
});

const createDefaultTrialSection = (): Omit<TrialSectionRecord, 'id' | 'projectId' | 'savedAt'> => ({
  title: '',
  location: '',
  date: '',
  spec: '',
  result: '',
  approvedBy: '',
  status: 'טיוטה',
  notes: '',
});

const createDefaultPreliminary = (subtype: PreliminaryTab): Omit<PreliminaryRecord, 'id' | 'projectId' | 'savedAt'> => ({
  subtype,
  title:
    subtype === 'suppliers'
      ? 'בקרה מקדימה - ספקים'
      : subtype === 'subcontractors'
      ? 'בקרה מקדימה - קבלנים'
      : 'בקרה מקדימה - חומרים',
  date: '',
  status: 'טיוטה',
  supplier:
    subtype === 'suppliers'
      ? {
          supplierName: '',
          suppliedMaterial: '',
          contactPhone: '',
          approvalNo: '',
          notes: '',
        }
      : undefined,
  subcontractor:
    subtype === 'subcontractors'
      ? {
          subcontractorName: '',
          field: '',
          contactPhone: '',
          approvalNo: '',
          notes: '',
        }
      : undefined,
  material:
    subtype === 'materials'
      ? {
          materialName: '',
          source: '',
          usage: '',
          certificateNo: '',
          notes: '',
        }
      : undefined,
}});

function escapeHtml(value: string) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sanitizeFileName(value: string) {
  return String(value ?? 'file')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildChecklistExportHtml(record: ChecklistRecord, projectName: string) {
  const rows = record.items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.description)}</td>
          <td>${escapeHtml(item.responsible)}</td>
          <td>${escapeHtml(item.status)}</td>
          <td>${escapeHtml(item.inspector || '')}</td>
          <td>${escapeHtml(item.executionDate || '')}</td>
          <td>${escapeHtml(item.notes || '')}</td>
        </tr>
      `
    )
    .join('');

  return `
    <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(record.title)}</title>
        <style>
          body { font-family: Arial, sans-serif; direction: rtl; padding: 24px; color: #0f172a; }
          h1 { margin: 0 0 16px; font-size: 28px; }
          .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 24px; margin-bottom: 20px; }
          .meta div { padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: right; vertical-align: top; }
          th { background: #e2e8f0; }
          .notes-box { margin-top: 18px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; min-height: 72px; white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(record.title)}</h1>
        <div class="meta">
          <div><strong>פרויקט:</strong> ${escapeHtml(projectName || '')}</div>
          <div><strong>קטגוריה:</strong> ${escapeHtml(record.category || '')}</div>
          <div><strong>מיקום:</strong> ${escapeHtml(record.location || '')}</div>
          <div><strong>תאריך:</strong> ${escapeHtml(record.date || '')}</div>
          <div><strong>קבלן מבצע:</strong> ${escapeHtml(record.contractor || '')}</div>
          <div><strong>תבנית:</strong> ${escapeHtml(record.templateKey)}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>תיאור</th>
              <th>אחראי</th>
              <th>סטטוס</th>
              <th>חתימה / שם בודק</th>
              <th>תאריך ביצוע</th>
              <th>הערות</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="notes-box"><strong>הערות כלליות:</strong><br />${escapeHtml(record.notes || '')}</div>
      </body>
    </html>
  `;
}

export default function Page() {
  const [section, setSection] = useState<Section>('home');
  const [preliminaryTab, setPreliminaryTab] = useState<PreliminaryTab>('suppliers');

  const [projects, setProjects] = useState<Project[]>(defaultProjects);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>('1');

  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectManager, setNewProjectManager] = useState('');

  const [checklistForm, setChecklistForm] = useState(createDefaultChecklist());
  const [nonconformanceForm, setNonconformanceForm] = useState(createDefaultNonconformance());
  const [trialSectionForm, setTrialSectionForm] = useState(createDefaultTrialSection());
  const [supplierPreliminaryForm, setSupplierPreliminaryForm] = useState(createDefaultPreliminary('suppliers'));
  const [subcontractorPreliminaryForm, setSubcontractorPreliminaryForm] = useState(createDefaultPreliminary('subcontractors'));
  const [materialPreliminaryForm, setMaterialPreliminaryForm] = useState(createDefaultPreliminary('materials'));

  const [savedChecklists, setSavedChecklists] = useState<ChecklistRecord[]>([]);
  const [savedNonconformances, setSavedNonconformances] = useState<NonconformanceRecord[]>([]);
  const [savedTrialSections, setSavedTrialSections] = useState<TrialSectionRecord[]>([]);
  const [savedPreliminary, setSavedPreliminary] = useState<PreliminaryRecord[]>([]);

  const [loaded, setLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadFromCloudResults = (
    projectsRows: any[] | null,
    checklistRows: any[] | null,
    nonconformanceRows: any[] | null,
    trialRows: any[] | null,
    preliminaryRows: any[] | null
  ) => {
    if (projectsRows?.length) {
      const mappedProjects: Project[] = projectsRows.map((row) => ({
        id: row.id,
        name: row.name ?? '',
        description: row.description ?? '',
        manager: row.manager ?? '',
        isActive: Boolean(row.is_active),
        createdAt: row.created_at ? new Date(row.created_at).toLocaleString('he-IL') : '',
      }));
      setProjects(mappedProjects);
      const active = mappedProjects.find((item) => item.isActive) ?? mappedProjects[0] ?? null;
      setCurrentProjectId(active?.id ?? null);
    }

    if (checklistRows) {
      const mapped: ChecklistRecord[] = checklistRows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        templateKey: row.template_key,
        title: row.title ?? '',
        category: row.category ?? '',
        location: row.location ?? '',
        date: row.date ?? '',
        contractor: row.contractor ?? '',
        notes: row.notes ?? '',
        items: Array.isArray(row.items)
          ? row.items.map((item: any) => ({
              ...item,
              inspector: item?.inspector ?? '',
              executionDate: item?.executionDate ?? '',
            }))
          : [],
        savedAt: row.saved_at ? new Date(row.saved_at).toLocaleString('he-IL') : '',
      }));
      setSavedChecklists(mapped);
    }

    if (nonconformanceRows) {
      const mapped: NonconformanceRecord[] = nonconformanceRows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        title: row.title ?? '',
        location: row.location ?? '',
        date: row.date ?? '',
        raisedBy: row.raised_by ?? '',
        severity: row.severity ?? 'בינונית',
        status: row.status ?? 'פתוח',
        description: row.description ?? '',
        actionRequired: row.action_required ?? '',
        notes: row.notes ?? '',
        savedAt: row.saved_at ? new Date(row.saved_at).toLocaleString('he-IL') : '',
      }));
      setSavedNonconformances(mapped);
    }

    if (trialRows) {
      const mapped: TrialSectionRecord[] = trialRows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        title: row.title ?? '',
        location: row.location ?? '',
        date: row.date ?? '',
        spec: row.spec ?? '',
        result: row.result ?? '',
        approvedBy: row.approved_by ?? '',
        status: row.status ?? 'טיוטה',
        notes: row.notes ?? '',
        savedAt: row.saved_at ? new Date(row.saved_at).toLocaleString('he-IL') : '',
      }));
      setSavedTrialSections(mapped);
    }

    if (preliminaryRows) {
      const mapped: PreliminaryRecord[] = preliminaryRows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        subtype: row.subtype,
        title: row.title ?? '',
        date: row.date ?? '',
        status: row.status ?? 'טיוטה',
        supplier: row.supplier ?? undefined,
        subcontractor: row.subcontractor ?? undefined,
        material: row.material ?? undefined,
        savedAt: row.saved_at ? new Date(row.saved_at).toLocaleString('he-IL') : '',
      }));
      setSavedPreliminary(mapped);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      if (!isSupabaseConfigured) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          setLoaded(true);
          return;
        }

        try {
          const parsed = JSON.parse(raw) as PersistedData;
          if (parsed.projects?.length) setProjects(parsed.projects);
          if (typeof parsed.currentProjectId !== 'undefined') setCurrentProjectId(parsed.currentProjectId);
          if (parsed.savedChecklists) setSavedChecklists(parsed.savedChecklists);
          if (parsed.savedNonconformances) setSavedNonconformances(parsed.savedNonconformances);
          if (parsed.savedTrialSections) setSavedTrialSections(parsed.savedTrialSections);
          if (parsed.savedPreliminary) setSavedPreliminary(parsed.savedPreliminary);
        } catch (error) {
          console.error('Failed to load local saved data', error);
        } finally {
          setLoaded(true);
        }
        return;
      }

      try {
        const [projectsRes, checklistsRes, nonconRes, trialsRes, prelimRes] = await Promise.all([
          supabase.from('projects').select('*').order('created_at', { ascending: false }),
          supabase.from('checklists').select('*').order('saved_at', { ascending: false }),
          supabase.from('nonconformances').select('*').order('saved_at', { ascending: false }),
          supabase.from('trial_sections').select('*').order('saved_at', { ascending: false }),
          supabase.from('preliminary_records').select('*').order('saved_at', { ascending: false }),
        ]);

        const fatalErrors = [projectsRes.error, checklistsRes.error, nonconRes.error, trialsRes.error, prelimRes.error].filter(
          (item) => item && !String(item.message).includes('relation')
        );
        if (fatalErrors.length) throw fatalErrors[0];

        loadFromCloudResults(projectsRes.data, checklistsRes.data, nonconRes.data, trialsRes.data, prelimRes.data);
      } catch (error) {
        console.error('Failed to load Supabase data, falling back to localStorage', error);
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as PersistedData;
            if (parsed.projects?.length) setProjects(parsed.projects);
            if (typeof parsed.currentProjectId !== 'undefined') setCurrentProjectId(parsed.currentProjectId);
            if (parsed.savedChecklists) setSavedChecklists(parsed.savedChecklists);
            if (parsed.savedNonconformances) setSavedNonconformances(parsed.savedNonconformances);
            if (parsed.savedTrialSections) setSavedTrialSections(parsed.savedTrialSections);
            if (parsed.savedPreliminary) setSavedPreliminary(parsed.savedPreliminary);
          } catch (innerError) {
            console.error('Failed to parse local fallback data', innerError);
          }
        }
      } finally {
        setLoaded(true);
      }
    };

    loadAll();
  }, []);

  useEffect(() => {
    if (!loaded) return;

    const payload: PersistedData = {
      projects,
      currentProjectId,
      savedChecklists,
      savedNonconformances,
      savedTrialSections,
      savedPreliminary,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [projects, currentProjectId, savedChecklists, savedNonconformances, savedTrialSections, savedPreliminary, loaded]);

  const refreshCloudData = async () => {
    if (!isSupabaseConfigured) return;
    const [projectsRes, checklistsRes, nonconRes, trialsRes, prelimRes] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('checklists').select('*').order('saved_at', { ascending: false }),
      supabase.from('nonconformances').select('*').order('saved_at', { ascending: false }),
      supabase.from('trial_sections').select('*').order('saved_at', { ascending: false }),
      supabase.from('preliminary_records').select('*').order('saved_at', { ascending: false }),
    ]);
    loadFromCloudResults(projectsRes.data, checklistsRes.data, nonconRes.data, trialsRes.data, prelimRes.data);
  };

  const currentProject = useMemo(
    () => projects.find((project) => project.id === currentProjectId) ?? null,
    [projects, currentProjectId]
  );

  const projectName = currentProject?.name ?? 'לא נבחר פרויקט';
  const checklistTemplateLabel = (key: ChecklistTemplateKey) => checklistTemplates[key].label;

  const projectChecklists = useMemo(
    () => savedChecklists.filter((item) => item.projectId === currentProjectId),
    [savedChecklists, currentProjectId]
  );
  const projectNonconformances = useMemo(
    () => savedNonconformances.filter((item) => item.projectId === currentProjectId),
    [savedNonconformances, currentProjectId]
  );
  const projectTrialSections = useMemo(
    () => savedTrialSections.filter((item) => item.projectId === currentProjectId),
    [savedTrialSections, currentProjectId]
  );
  const projectPreliminary = useMemo(
    () => savedPreliminary.filter((item) => item.projectId === currentProjectId),
    [savedPreliminary, currentProjectId]
  );

  const addProject = async () => {
    if (!newProjectName.trim()) {
      alert('יש להזין שם פרויקט');
      return;
    }

    const id = crypto.randomUUID();
    const project: Project = {
      id,
      name: newProjectName.trim(),
      description: newProjectDescription.trim(),
      manager: newProjectManager.trim(),
      isActive: true,
      createdAt: new Date().toLocaleString('he-IL'),
    };

    const nextProjects = [...projects.map((item) => ({ ...item, isActive: false })), project];
    setProjects(nextProjects);
    setCurrentProjectId(id);
    if (isSupabaseConfigured) {
      await supabase.from('projects').insert({
        id,
        name: project.name,
        description: project.description,
        manager: project.manager,
        is_active: true,
        created_at: new Date().toISOString(),
      });
      await supabase.from('projects').update({ is_active: false }).neq('id', id);
      await refreshCloudData();
    }
    setNewProjectName('');
    setNewProjectDescription('');
    setNewProjectManager('');
  };

  const renameProject = async (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;

    const nextName = window.prompt('שם פרויקט חדש', project.name);
    if (!nextName || !nextName.trim()) return;

    setProjects((prev) => prev.map((item) => (item.id === projectId ? { ...item, name: nextName.trim() } : item)));
    if (isSupabaseConfigured) {
      await supabase.from('projects').update({ name: nextName.trim() }).eq('id', projectId);
      await refreshCloudData();
    }
  };

  const updateProjectMeta = async (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;

    const nextDescription = window.prompt('תיאור פרויקט', project.description ?? '');
    if (nextDescription === null) return;
    const nextManager = window.prompt('מנהל פרויקט', project.manager ?? '');
    if (nextManager === null) return;

    setProjects((prev) => prev.map((item) => item.id === projectId ? { ...item, description: nextDescription.trim(), manager: nextManager.trim() } : item));
    if (isSupabaseConfigured) {
      await supabase.from('projects').update({ description: nextDescription.trim(), manager: nextManager.trim() }).eq('id', projectId);
      await refreshCloudData();
    }
  };

  const setActiveProject = async (projectId: string) => {
    setProjects((prev) => prev.map((item) => ({ ...item, isActive: item.id === projectId })));
    setCurrentProjectId(projectId);
    if (isSupabaseConfigured) {
      await supabase.from('projects').update({ is_active: false }).neq('id', projectId);
      await supabase.from('projects').update({ is_active: true }).eq('id', projectId);
      await refreshCloudData();
    }
  };

  const deleteProject = async (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;

    const ok = window.confirm(`למחוק את הפרויקט "${project.name}"? כל הרשומות שלו יימחקו.`);
    if (!ok) return;

    const nextProjects = projects.filter((item) => item.id !== projectId);
    const nextCurrentProjectId = nextProjects[0]?.id ?? null;

    setProjects(nextProjects.map((item, index) => ({ ...item, isActive: index === 0 && nextCurrentProjectId === item.id })));
    setCurrentProjectId(nextCurrentProjectId);
    setSavedChecklists((prev) => prev.filter((item) => item.projectId !== projectId));
    setSavedNonconformances((prev) => prev.filter((item) => item.projectId !== projectId));
    setSavedTrialSections((prev) => prev.filter((item) => item.projectId !== projectId));
    setSavedPreliminary((prev) => prev.filter((item) => item.projectId !== projectId));
    if (isSupabaseConfigured) {
      await Promise.all([
        supabase.from('projects').delete().eq('id', projectId),
        supabase.from('checklists').delete().eq('project_id', projectId),
        supabase.from('nonconformances').delete().eq('project_id', projectId),
        supabase.from('trial_sections').delete().eq('project_id', projectId),
        supabase.from('preliminary_records').delete().eq('project_id', projectId),
      ]);
      await refreshCloudData();
    }
  };

  const resetChecklistForm = () => setChecklistForm(createDefaultChecklist());

  const applyChecklistTemplate = (templateKey: ChecklistTemplateKey) => {
    setChecklistForm((prev) => ({
      ...createDefaultChecklist(templateKey),
      location: prev.location,
      date: prev.date,
      contractor: prev.contractor,
      notes: prev.notes,
    }));
  };

  const updateChecklistItem = (id: string, field: keyof ChecklistItem, value: string) => {
    setChecklistForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  };

  const addChecklistItem = () => {
    setChecklistForm((prev) => ({
      ...prev,
      items: [...prev.items, emptyChecklistItem(crypto.randomUUID())],
    }));
  };

  const removeChecklistItem = (id: string) => {
    setChecklistForm((prev) => ({
      ...prev,
      items: prev.items.length <= 1 ? prev.items : prev.items.filter((item) => item.id !== id),
    }));
  };

  const saveChecklist = async () => {
    if (!currentProjectId) {
      alert('יש לבחור פרויקט');
      return;
    }
    if (!checklistForm.title.trim()) {
      alert('יש להזין שם רשימת תיוג');
      return;
    }

    const record: ChecklistRecord = {
      id: crypto.randomUUID(),
      projectId: currentProjectId,
      ...checklistForm,
      savedAt: new Date().toLocaleString('he-IL'),
    };

    setSavedChecklists((prev) => [record, ...prev]);
    if (isSupabaseConfigured) {
      await supabase.from('checklists').insert({
        id: record.id, project_id: record.projectId, template_key: record.templateKey, title: record.title, category: record.category, location: record.location, date: record.date, contractor: record.contractor, notes: record.notes, items: record.items, saved_at: new Date().toISOString()
      });
      await refreshCloudData();
    }
    resetChecklistForm();
    alert('רשימת התיוג נשמרה');
  };

  const loadChecklist = (record: ChecklistRecord) => {
    setSection('checklists');
    setChecklistForm({
      templateKey: record.templateKey,
      title: record.title,
      category: record.category,
      location: record.location,
      date: record.date,
      contractor: record.contractor,
      notes: record.notes,
      items: record.items.map((item) => ({
        ...item,
        inspector: item.inspector || '',
        executionDate: item.executionDate || '',
      })),
    });
  };

  const deleteChecklist = async (id: string) => {
    setSavedChecklists((prev) => prev.filter((item) => item.id !== id));
    if (isSupabaseConfigured) { await supabase.from('checklists').delete().eq('id', id); await refreshCloudData(); }
  };

  const saveNonconformance = async () => {
    if (!currentProjectId) {
      alert('יש לבחור פרויקט');
      return;
    }
    if (!nonconformanceForm.title.trim()) {
      alert('יש להזין כותרת לאי התאמה');
      return;
    }

    const record: NonconformanceRecord = {
      id: crypto.randomUUID(),
      projectId: currentProjectId,
      ...nonconformanceForm,
      savedAt: new Date().toLocaleString('he-IL'),
    };

    setSavedNonconformances((prev) => [record, ...prev]);
    if (isSupabaseConfigured) {
      await supabase.from('nonconformances').insert({
        id: record.id, project_id: record.projectId, title: record.title, location: record.location, date: record.date, raised_by: record.raisedBy, severity: record.severity, status: record.status, description: record.description, action_required: record.actionRequired, notes: record.notes, saved_at: new Date().toISOString()
      });
      await refreshCloudData();
    }
    setNonconformanceForm(createDefaultNonconformance());
    alert('אי ההתאמה נשמרה');
  };

  const loadNonconformance = (record: NonconformanceRecord) => {
    setSection('nonconformances');
    setNonconformanceForm({
      title: record.title,
      location: record.location,
      date: record.date,
      raisedBy: record.raisedBy,
      severity: record.severity,
      status: record.status,
      description: record.description,
      actionRequired: record.actionRequired,
      notes: record.notes,
    });
  };

  const deleteNonconformance = async (id: string) => {
    setSavedNonconformances((prev) => prev.filter((item) => item.id !== id));
    if (isSupabaseConfigured) { await supabase.from('nonconformances').delete().eq('id', id); await refreshCloudData(); }
  };

  const saveTrialSection = async () => {
    if (!currentProjectId) {
      alert('יש לבחור פרויקט');
      return;
    }
    if (!trialSectionForm.title.trim()) {
      alert('יש להזין שם לקטע ניסוי');
      return;
    }

    const record: TrialSectionRecord = {
      id: crypto.randomUUID(),
      projectId: currentProjectId,
      ...trialSectionForm,
      savedAt: new Date().toLocaleString('he-IL'),
    };

    setSavedTrialSections((prev) => [record, ...prev]);
    if (isSupabaseConfigured) {
      await supabase.from('trial_sections').insert({
        id: record.id, project_id: record.projectId, title: record.title, location: record.location, date: record.date, spec: record.spec, result: record.result, approved_by: record.approvedBy, status: record.status, notes: record.notes, saved_at: new Date().toISOString()
      });
      await refreshCloudData();
    }
    setTrialSectionForm(createDefaultTrialSection());
    alert('קטע הניסוי נשמר');
  };

  const loadTrialSection = (record: TrialSectionRecord) => {
    setSection('trialSections');
    setTrialSectionForm({
      title: record.title,
      location: record.location,
      date: record.date,
      spec: record.spec,
      result: record.result,
      approvedBy: record.approvedBy,
      status: record.status,
      notes: record.notes,
    });
  };

  const deleteTrialSection = async (id: string) => {
    setSavedTrialSections((prev) => prev.filter((item) => item.id !== id));
    if (isSupabaseConfigured) { await supabase.from('trial_sections').delete().eq('id', id); await refreshCloudData(); }
  };

  const savePreliminary = async (subtype: PreliminaryTab) => {
    if (!currentProjectId) {
      alert('יש לבחור פרויקט');
      return;
    }

    const form =
      subtype === 'suppliers'
        ? supplierPreliminaryForm
        : subtype === 'subcontractors'
        ? subcontractorPreliminaryForm
        : materialPreliminaryForm;

    const record: PreliminaryRecord = {
      id: crypto.randomUUID(),
      projectId: currentProjectId,
      ...form,
      savedAt: new Date().toLocaleString('he-IL'),
    };

    setSavedPreliminary((prev) => [record, ...prev]);
    if (isSupabaseConfigured) {
      await supabase.from('preliminary_records').insert({
        id: record.id, project_id: record.projectId, subtype: record.subtype, title: record.title, date: record.date, status: record.status, supplier: record.supplier ?? null, subcontractor: record.subcontractor ?? null, material: record.material ?? null, saved_at: new Date().toISOString()
      });
      await refreshCloudData();
    }

    if (subtype === 'suppliers') setSupplierPreliminaryForm(createDefaultPreliminary('suppliers'));
    if (subtype === 'subcontractors') setSubcontractorPreliminaryForm(createDefaultPreliminary('subcontractors'));
    if (subtype === 'materials') setMaterialPreliminaryForm(createDefaultPreliminary('materials'));

    alert('טופס הבקרה המקדימה נשמר');
  };

  const loadPreliminary = (record: PreliminaryRecord) => {
    setSection('preliminary');
    setPreliminaryTab(record.subtype);

    if (record.subtype === 'suppliers') {
      setSupplierPreliminaryForm({
        subtype: 'suppliers',
        title: record.title,
        date: record.date,
        status: record.status,
        supplier: record.supplier ?? createDefaultPreliminary('suppliers').supplier,
      });
    }
    if (record.subtype === 'subcontractors') {
      setSubcontractorPreliminaryForm({
        subtype: 'subcontractors',
        title: record.title,
        date: record.date,
        status: record.status,
        subcontractor: record.subcontractor ?? createDefaultPreliminary('subcontractors').subcontractor,
      });
    }
    if (record.subtype === 'materials') {
      setMaterialPreliminaryForm({
        subtype: 'materials',
        title: record.title,
        date: record.date,
        status: record.status,
        material: record.material ?? createDefaultPreliminary('materials').material,
      });
    }
  };

  const deletePreliminary = async (id: string) => {
    setSavedPreliminary((prev) => prev.filter((item) => item.id !== id));
    if (isSupabaseConfigured) { await supabase.from('preliminary_records').delete().eq('id', id); await refreshCloudData(); }
  };

  const guardedBody = !currentProject && section !== 'home' && section !== 'projects' ? (
    <div style={emptyBoxStyle}>יש לבחור פרויקט לפני עבודה במסך זה.</div>
  ) : null;

  const buildChecklistRecordForExport = (): ChecklistRecord => ({
    id: 'export-preview',
    projectId: currentProjectId ?? '',
    templateKey: checklistForm.templateKey,
    title: checklistForm.title || checklistTemplates[checklistForm.templateKey].title,
    category: checklistForm.category,
    location: checklistForm.location,
    date: checklistForm.date,
    contractor: checklistForm.contractor,
    notes: checklistForm.notes,
    items: checklistForm.items.map((item) => ({ ...item })),
    savedAt: new Date().toLocaleString('he-IL'),
  });

  const downloadBlobFile = (content: BlobPart, mimeType: string, fileName: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const exportChecklistAsWord = () => {
    const record = buildChecklistRecordForExport();
    const fileName = `${sanitizeFileName(record.title || 'רשימת-תיוג')}.doc`;
    const html = buildChecklistExportHtml(record, projectName);
    downloadBlobFile('\ufeff' + html, 'application/msword;charset=utf-8', fileName);
  };

  const exportChecklistAsExcel = () => {
    const record = buildChecklistRecordForExport();
    const rows = record.items
      .map(
        (item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(item.description)}</td>
            <td>${escapeHtml(item.responsible)}</td>
            <td>${escapeHtml(item.status)}</td>
            <td>${escapeHtml(item.inspector || '')}</td>
            <td>${escapeHtml(item.executionDate || '')}</td>
            <td>${escapeHtml(item.notes || '')}</td>
          </tr>
        `
      )
      .join('');

    const tableHtml = `
      <html dir="rtl" lang="he">
        <head><meta charset="utf-8" /></head>
        <body>
          <table border="1">
            <tr><th>שם רשימת תיוג</th><td>${escapeHtml(record.title)}</td></tr>
            <tr><th>פרויקט</th><td>${escapeHtml(projectName || '')}</td></tr>
            <tr><th>קטגוריה</th><td>${escapeHtml(record.category || '')}</td></tr>
            <tr><th>מיקום</th><td>${escapeHtml(record.location || '')}</td></tr>
            <tr><th>תאריך</th><td>${escapeHtml(record.date || '')}</td></tr>
            <tr><th>קבלן מבצע</th><td>${escapeHtml(record.contractor || '')}</td></tr>
          </table>
          <br />
          <table border="1">
            <thead>
              <tr>
                <th>#</th>
                <th>תיאור</th>
                <th>אחראי</th>
                <th>סטטוס</th>
                <th>חתימה / שם בודק</th>
                <th>תאריך ביצוע</th>
                <th>הערות</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;

    const fileName = `${sanitizeFileName(record.title || 'רשימת-תיוג')}.xls`;
    downloadBlobFile('\ufeff' + tableHtml, 'application/vnd.ms-excel;charset=utf-8', fileName);
  };

  const exportChecklistAsPdf = () => {
    const record = buildChecklistRecordForExport();
    const html = buildChecklistExportHtml(record, projectName);
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      alert('הדפדפן חסם את חלון ההדפסה. יש לאפשר פתיחת חלונות קופצים ולנסות שוב.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const homeModules = [
    {
      key: 'projects' as Section,
      title: 'פרויקטים',
      icon: '📁',
      description: 'הוספה, עריכה, בחירה ומחיקה של פרויקטים',
      count: projects.length,
    },
    {
      key: 'nonconformances' as Section,
      title: 'אי תאמות',
      icon: '⚠️',
      description: 'ניהול אי תאמות, סטטוסים ופעולות נדרשות',
      count: projectNonconformances.length,
    },
    {
      key: 'trialSections' as Section,
      title: 'קטעי ניסוי',
      icon: '🧪',
      description: 'פתיחת קטעי ניסוי, תוצאות ואישורים',
      count: projectTrialSections.length,
    },
    {
      key: 'preliminary' as Section,
      title: 'בקרה מקדימה',
      icon: '🗂️',
      description: 'תיקיית אב הכוללת קבלנים, ספקים וחומרים',
      count: projectPreliminary.length,
    },
    {
      key: 'checklists' as Section,
      title: 'רשימות תיוג',
      icon: '📋',
      description: 'טפסי בקרת איכות לפי תבניות עבודה',
      count: projectChecklists.length,
    },
  ];

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <QualityLogo />
          <div>
            <div style={brandTitleStyle}>Y.K QUALITY</div>
            <div style={brandSubTitleStyle}>QA / QC · Built on Quality. Driven by Precision</div>
          </div>
        </div>
        <div style={projectBadgeStyle}>
          <div style={{ fontWeight: 800 }}>פרויקט פעיל</div>
          <div>{projectName}</div>
        </div>
      </header>

      <div style={navRowStyle}>
        <NavButton label="דף בית" active={section === 'home'} onClick={() => setSection('home')} />
        <NavButton label="פרויקטים" active={section === 'projects'} onClick={() => setSection('projects')} />
        <NavButton label="רשימות תיוג" active={section === 'checklists'} onClick={() => setSection('checklists')} />
        <NavButton label="אי תאמות" active={section === 'nonconformances'} onClick={() => setSection('nonconformances')} />
        <NavButton label="קטעי ניסוי" active={section === 'trialSections'} onClick={() => setSection('trialSections')} />
        <NavButton label="בקרה מקדימה" active={section === 'preliminary'} onClick={() => setSection('preliminary')} />
      </div>

      <div style={layoutStyle}>
        <main style={mainCardStyle}>
          {section === 'home' && (
            <div>
              <h2 style={sectionTitleStyle}>דף שער</h2>
              <div style={statsGridStyle}>
                <StatCard title="פרויקטים" value={projects.length} />
                <StatCard title="רשימות תיוג" value={projectChecklists.length} />
                <StatCard title="אי תאמות" value={projectNonconformances.length} />
                <StatCard title="קטעי ניסוי" value={projectTrialSections.length} />
                <StatCard title="בקרה מקדימה" value={projectPreliminary.length} />
              </div>

              <div style={heroBoxStyle}>
                <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 8 }}>מודולים ותיקיות</div>
                <div style={{ color: '#475569', lineHeight: 1.7 }}>
                  בדף השער מוצגים כל המודולים הראשיים. לחץ על כל כרטיס כדי להיכנס למסך המתאים.
                </div>
              </div>

              <div style={templateSelectorCardStyle}>
                <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 10 }}>רשימות תיוג</div>
                <div style={{ color: '#475569', lineHeight: 1.7, marginBottom: 14 }}>
                  בחר תבנית רשימת תיוג מדף הבית, והמערכת תפתח את הטופס הרלוונטי בלי שמות קבועים של אתר, כביש, חומר או בעלי תפקידים.
                </div>
                <div style={templateButtonsWrapStyle}>
                  {(Object.keys(checklistTemplates) as ChecklistTemplateKey[]).map((templateKey) => (
                    <button
                      key={templateKey}
                      style={templateChipStyle}
                      onClick={() => {
                        applyChecklistTemplate(templateKey);
                        setSection('checklists');
                      }}
                    >
                      {checklistTemplates[templateKey].label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={homeModulesGridStyle}>
                {homeModules.map((module) => (
                  <button key={module.key} style={homeModuleCardStyle} onClick={() => setSection(module.key)}>
                    <div style={homeModuleIconStyle}>{module.icon}</div>
                    <div style={homeModuleTitleStyle}>{module.title}</div>
                    <div style={homeModuleTextStyle}>{module.description}</div>
                    <div style={homeModuleCountStyle}>רשומות: {module.count}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {section === 'projects' && (
            <div>
              <h2 style={sectionTitleStyle}>פרויקטים</h2>

              <div style={formGridStyle}>
                <Field label="שם פרויקט">
                  <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} style={inputStyle} />
                </Field>
                <Field label="מנהל פרויקט">
                  <input value={newProjectManager} onChange={(e) => setNewProjectManager(e.target.value)} style={inputStyle} />
                </Field>
                <Field label="תיאור" full>
                  <textarea
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                  />
                </Field>
              </div>

              <div style={buttonRowStyle}>
                <button style={primaryButtonStyle} onClick={addProject}>
                  הוסף פרויקט
                </button>
              </div>

              <div style={cardsGridStyle}>
                {projects.map((project) => (
                  <div key={project.id} style={savedCardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={savedCardTitleStyle}>{project.name}</div>
                      {project.id === currentProjectId && <span style={activePillStyle}>פעיל</span>}
                    </div>
                    <div style={savedCardTextStyle}>מנהל פרויקט: {project.manager || '-'}</div>
                    <div style={savedCardTextStyle}>תיאור: {project.description || '-'}</div>
                    <div style={savedCardTextStyle}>נוצר בתאריך: {project.createdAt}</div>
                    <div style={savedCardActionsStyle}>
                      <button style={secondaryButtonStyle} onClick={() => setActiveProject(project.id)}>
                        בחר
                      </button>
                      <button style={secondaryButtonStyle} onClick={() => renameProject(project.id)}>
                        ערוך שם
                      </button>
                      <button style={secondaryButtonStyle} onClick={() => updateProjectMeta(project.id)}>
                        ערוך פרטים
                      </button>
                      <button style={dangerButtonStyle} onClick={() => deleteProject(project.id)}>
                        מחק
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'checklists' && (
            <div>
              <h2 style={sectionTitleStyle}>רשימות תיוג</h2>
              {guardedBody || (
                <>
                  <div style={templateSelectorCardStyle}>
                    <div style={{ fontWeight: 800, marginBottom: 10 }}>בחירת טופס רשימת תיוג</div>
                    <div style={templateButtonsWrapStyle}>
                      {(Object.keys(checklistTemplates) as ChecklistTemplateKey[]).map((templateKey) => (
                        <button
                          key={templateKey}
                          style={{
                            ...templateChipStyle,
                            background: checklistForm.templateKey === templateKey ? '#0f172a' : '#fff',
                            color: checklistForm.templateKey === templateKey ? '#fff' : '#0f172a',
                          }}
                          onClick={() => applyChecklistTemplate(templateKey)}
                        >
                          {checklistTemplates[templateKey].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={formGridStyle}>
                    <Field label="תבנית">
                      <input value={checklistTemplateLabel(checklistForm.templateKey)} readOnly style={{ ...inputStyle, background: '#f8fafc' }} />
                    </Field>
                    <Field label="שם רשימת תיוג">
                      <input value={checklistForm.title} onChange={(e) => setChecklistForm((prev) => ({ ...prev, title: e.target.value }))} style={inputStyle} />
                    </Field>
                    <Field label="קטגוריה">
                      <input value={checklistForm.category} onChange={(e) => setChecklistForm((prev) => ({ ...prev, category: e.target.value }))} style={inputStyle} />
                    </Field>
                    <Field label="מיקום">
                      <input value={checklistForm.location} onChange={(e) => setChecklistForm((prev) => ({ ...prev, location: e.target.value }))} style={inputStyle} />
                    </Field>
                    <Field label="תאריך">
                      <input type="date" value={checklistForm.date} onChange={(e) => setChecklistForm((prev) => ({ ...prev, date: e.target.value }))} style={inputStyle} />
                    </Field>
                    <Field label="קבלן מבצע">
                      <input value={checklistForm.contractor} onChange={(e) => setChecklistForm((prev) => ({ ...prev, contractor: e.target.value }))} style={inputStyle} />
                    </Field>
                    <Field label="הערות כלליות" full>
                      <textarea value={checklistForm.notes} onChange={(e) => setChecklistForm((prev) => ({ ...prev, notes: e.target.value }))} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
                    </Field>
                  </div>

                  <div style={subHeaderStyle}>סעיפי בקרה</div>
                  {checklistForm.items.map((item, index) => (
                    <div key={item.id} style={rowCardStyle}>
                      <div style={rowCardIndexStyle}>{index + 1}</div>
                      <div style={rowCardGridStyle}>
                        <Field label="תיאור">
                          <input value={item.description} onChange={(e) => updateChecklistItem(item.id, 'description', e.target.value)} style={inputStyle} />
                        </Field>
                        <Field label="אחראי">
                          <input value={item.responsible} onChange={(e) => updateChecklistItem(item.id, 'responsible', e.target.value)} style={inputStyle} />
                        </Field>
                        <Field label="סטטוס">
                          <select value={item.status} onChange={(e) => updateChecklistItem(item.id, 'status', e.target.value)} style={inputStyle}>
                            <option value="לא נבדק">לא נבדק</option>
                            <option value="תקין">תקין</option>
                            <option value="לא תקין">לא תקין</option>
                          </select>
                        </Field>
                        <Field label="הערות" full>
                          <input value={item.notes} onChange={(e) => updateChecklistItem(item.id, 'notes', e.target.value)} style={inputStyle} />
                        </Field>
                        <Field label="שם בודק / חתימה">
                          <input
                            value={item.inspector || ''}
                            onChange={(e) => updateChecklistItem(item.id, 'inspector', e.target.value)}
                            style={inputStyle}
                          />
                        </Field>
                        <Field label="תאריך ביצוע">
                          <input
                            type="date"
                            value={item.executionDate || ''}
                            onChange={(e) => updateChecklistItem(item.id, 'executionDate', e.target.value)}
                            style={inputStyle}
                          />
                        </Field>
                      </div>
                      <button style={dangerButtonStyle} onClick={() => removeChecklistItem(item.id)}>
                        מחק שורה
                      </button>
                    </div>
                  ))}

                  <div style={buttonRowStyle}>
                    <button style={secondaryButtonStyle} onClick={addChecklistItem}>הוסף שורה</button>
                    <button style={primaryButtonStyle} onClick={saveChecklist}>שמור רשימת תיוג</button>
                    <button style={secondaryButtonStyle} onClick={resetChecklistForm}>נקה טופס</button>
                    <button style={secondaryButtonStyle} onClick={exportChecklistAsExcel}>הורד Excel</button>
                    <button style={secondaryButtonStyle} onClick={exportChecklistAsWord}>הורד Word</button>
                    <button style={secondaryButtonStyle} onClick={exportChecklistAsPdf}>הורד PDF</button>
                  </div>
                </>
              )}
            </div>
          )}

          {section === 'nonconformances' && (
            <div>
              <h2 style={sectionTitleStyle}>אי תאמות</h2>
              {guardedBody || (
                <>
                  <div style={formGridStyle}>
                    <Field label="כותרת">
                      <input value={nonconformanceForm.title} onChange={(e) => setNonconformanceForm((prev) => ({ ...prev, title: e.target.value }))} style={inputStyle} />
                    </Field>
                    <Field label="מיקום">
                      <input value={nonconformanceForm.location} onChange={(e) => setNonconformanceForm((prev) => ({ ...prev, location: e.target.value }))} style={inputStyle} />
                    </Field>
                    <Field label="תאריך">
                      <input type="date" value={nonconformanceForm.date} onChange={(e) => setNonconformanceForm((prev) => ({ ...prev, date: e.target.value }))} style={inputStyle} />
                    </Field>
                    <Field label="נפתח על ידי">
                      <input value={nonconformanceForm.raisedBy} onChange={(e) => setNonconformanceForm((prev) => ({ ...prev, raisedBy: e.target.value }))} style={inputStyle} />
                    </Field>
                    <Field label="חומרה">
                      <select value={nonconformanceForm.severity} onChange={(e) => setNonconformanceForm((prev) => ({ ...prev, severity: e.target.value as NonconformanceRecord['severity'] }))} style={inputStyle}>
                        <option value="נמוכה">נמוכה</option>
                        <option value="בינונית">בינונית</option>
                        <option value="גבוהה">גבוהה</option>
                      </select>
                    </Field>
                    <Field label="סטטוס">
                      <select value={nonconformanceForm.status} onChange={(e) => setNonconformanceForm((prev) => ({ ...prev, status: e.target.value as NonconformanceRecord['status'] }))} style={inputStyle}>
                        <option value="פתוח">פתוח</option>
                        <option value="בטיפול">בטיפול</option>
                        <option value="נסגר">נסגר</option>
                      </select>
                    </Field>
                    <Field label="תיאור אי תאמה" full>
                      <textarea value={nonconformanceForm.description} onChange={(e) => setNonconformanceForm((prev) => ({ ...prev, description: e.target.value }))} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
                    </Field>
                    <Field label="פעולה נדרשת" full>
                      <textarea value={nonconformanceForm.actionRequired} onChange={(e) => setNonconformanceForm((prev) => ({ ...prev, actionRequired: e.target.value }))} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
                    </Field>
                    <Field label="הערות" full>
                      <textarea value={nonconformanceForm.notes} onChange={(e) => setNonconformanceForm((prev) => ({ ...prev, notes: e.target.value }))} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
                    </Field>
                  </div>

                  <div style={buttonRowStyle}>
                    <button style={primaryButtonStyle} onClick={saveNonconformance}>שמור אי תאמה</button>
                    <button style={secondaryButtonStyle} onClick={() => setNonconformanceForm(createDefaultNonconformance())}>נקה טופס</button>
                  </div>
                </>
              )}
            </div>
          )}

          {section === 'trialSections' && (
            <div>
              <h2 style={sectionTitleStyle}>קטעי ניסוי</h2>
              {guardedBody || (
                <>
                  <div style={formGridStyle}>
                    <Field label="שם קטע ניסוי">
                      <input value={trialSectionForm.title} onChange={(e) => setTrialSectionForm((prev) => ({ ...prev, title: e.target.value }))} style={inputStyle} />
                    </Field>
                    <Field label="מיקום">
                      <input value={trialSectionForm.location} onChange={(e) => setTrialSectionForm((prev) => ({ ...prev, location: e.target.value }))} style={inputStyle} />
                    </Field>
                    <Field label="תאריך">
                      <input type="date" value={trialSectionForm.date} onChange={(e) => setTrialSectionForm((prev) => ({ ...prev, date: e.target.value }))} style={inputStyle} />
                    </Field>
                    <Field label="מפרט / תקן">
                      <input value={trialSectionForm.spec} onChange={(e) => setTrialSectionForm((prev) => ({ ...prev, spec: e.target.value }))} style={inputStyle} />
                    </Field>
                    <Field label="תוצאה">
                      <input value={trialSectionForm.result} onChange={(e) => setTrialSectionForm((prev) => ({ ...prev, result: e.target.value }))} style={inputStyle} />
                    </Field>
                    <Field label="מאשר">
                      <input value={trialSectionForm.approvedBy} onChange={(e) => setTrialSectionForm((prev) => ({ ...prev, approvedBy: e.target.value }))} style={inputStyle} />
                    </Field>
                    <Field label="סטטוס">
                      <select value={trialSectionForm.status} onChange={(e) => setTrialSectionForm((prev) => ({ ...prev, status: e.target.value as TrialSectionRecord['status'] }))} style={inputStyle}>
                        <option value="טיוטה">טיוטה</option>
                        <option value="אושר">אושר</option>
                        <option value="נדחה">נדחה</option>
                      </select>
                    </Field>
                    <Field label="הערות" full>
                      <textarea value={trialSectionForm.notes} onChange={(e) => setTrialSectionForm((prev) => ({ ...prev, notes: e.target.value }))} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
                    </Field>
                  </div>

                  <div style={buttonRowStyle}>
                    <button style={primaryButtonStyle} onClick={saveTrialSection}>שמור קטע ניסוי</button>
                    <button style={secondaryButtonStyle} onClick={() => setTrialSectionForm(createDefaultTrialSection())}>נקה טופס</button>
                  </div>
                </>
              )}
            </div>
          )}

          {section === 'preliminary' && (
            <div>
              <h2 style={sectionTitleStyle}>בקרה מקדימה</h2>
              {guardedBody || (
                <>
                  <div style={folderIntroStyle}>
                    <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>תיקיות בתוך בקרה מקדימה</div>
                    <div style={{ color: '#475569', lineHeight: 1.7 }}>
                      כאן יש תיקיית אב אחת בשם "בקרה מקדימה", ובתוכה שלוש תיקיות: קבלנים, ספקים וחומרים.
                    </div>
                  </div>

                  <div style={preliminaryFoldersGridStyle}>
                    <FolderCard
                      title="קבלנים"
                      subtitle="אישורים, תחום, טלפון ומסמכים"
                      active={preliminaryTab === 'subcontractors'}
                      onClick={() => setPreliminaryTab('subcontractors')}
                    />
                    <FolderCard
                      title="ספקים"
                      subtitle="אישורי ספק, חומרים מסופקים ותיעוד"
                      active={preliminaryTab === 'suppliers'}
                      onClick={() => setPreliminaryTab('suppliers')}
                    />
                    <FolderCard
                      title="חומרים"
                      subtitle="מקור, ייעוד, תעודות ובקרה"
                      active={preliminaryTab === 'materials'}
                      onClick={() => setPreliminaryTab('materials')}
                    />
                  </div>

                  {preliminaryTab === 'suppliers' && (
                    <>
                      <div style={subHeaderStyle}>תיקיית ספקים</div>
                      <div style={formGridStyle}>
                        <Field label="כותרת">
                          <input value={supplierPreliminaryForm.title} onChange={(e) => setSupplierPreliminaryForm((prev) => ({ ...prev, title: e.target.value }))} style={inputStyle} />
                        </Field>
                        <Field label="תאריך">
                          <input type="date" value={supplierPreliminaryForm.date} onChange={(e) => setSupplierPreliminaryForm((prev) => ({ ...prev, date: e.target.value }))} style={inputStyle} />
                        </Field>
                        <Field label="סטטוס">
                          <select value={supplierPreliminaryForm.status} onChange={(e) => setSupplierPreliminaryForm((prev) => ({ ...prev, status: e.target.value as PreliminaryRecord['status'] }))} style={inputStyle}>
                            <option value="טיוטה">טיוטה</option>
                            <option value="מאושר">מאושר</option>
                            <option value="לא מאושר">לא מאושר</option>
                          </select>
                        </Field>
                        <Field label="שם ספק">
                          <input value={supplierPreliminaryForm.supplier?.supplierName ?? ''} onChange={(e) => setSupplierPreliminaryForm((prev) => ({ ...prev, supplier: { ...(prev.supplier as SupplierPreliminary), supplierName: e.target.value } }))} style={inputStyle} />
                        </Field>
                        <Field label="חומר מסופק">
                          <input value={supplierPreliminaryForm.supplier?.suppliedMaterial ?? ''} onChange={(e) => setSupplierPreliminaryForm((prev) => ({ ...prev, supplier: { ...(prev.supplier as SupplierPreliminary), suppliedMaterial: e.target.value } }))} style={inputStyle} />
                        </Field>
                        <Field label="טלפון">
                          <input value={supplierPreliminaryForm.supplier?.contactPhone ?? ''} onChange={(e) => setSupplierPreliminaryForm((prev) => ({ ...prev, supplier: { ...(prev.supplier as SupplierPreliminary), contactPhone: e.target.value } }))} style={inputStyle} />
                        </Field>
                        <Field label="מספר אישור">
                          <input value={supplierPreliminaryForm.supplier?.approvalNo ?? ''} onChange={(e) => setSupplierPreliminaryForm((prev) => ({ ...prev, supplier: { ...(prev.supplier as SupplierPreliminary), approvalNo: e.target.value } }))} style={inputStyle} />
                        </Field>
                        <Field label="הערות" full>
                          <textarea value={supplierPreliminaryForm.supplier?.notes ?? ''} onChange={(e) => setSupplierPreliminaryForm((prev) => ({ ...prev, supplier: { ...(prev.supplier as SupplierPreliminary), notes: e.target.value } }))} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
                        </Field>
                      </div>
                      <div style={buttonRowStyle}>
                        <button style={primaryButtonStyle} onClick={() => savePreliminary('suppliers')}>שמור ספק</button>
                      </div>
                    </>
                  )}

                  {preliminaryTab === 'subcontractors' && (
                    <>
                      <div style={subHeaderStyle}>תיקיית קבלנים</div>
                      <div style={formGridStyle}>
                        <Field label="כותרת">
                          <input value={subcontractorPreliminaryForm.title} onChange={(e) => setSubcontractorPreliminaryForm((prev) => ({ ...prev, title: e.target.value }))} style={inputStyle} />
                        </Field>
                        <Field label="תאריך">
                          <input type="date" value={subcontractorPreliminaryForm.date} onChange={(e) => setSubcontractorPreliminaryForm((prev) => ({ ...prev, date: e.target.value }))} style={inputStyle} />
                        </Field>
                        <Field label="סטטוס">
                          <select value={subcontractorPreliminaryForm.status} onChange={(e) => setSubcontractorPreliminaryForm((prev) => ({ ...prev, status: e.target.value as PreliminaryRecord['status'] }))} style={inputStyle}>
                            <option value="טיוטה">טיוטה</option>
                            <option value="מאושר">מאושר</option>
                            <option value="לא מאושר">לא מאושר</option>
                          </select>
                        </Field>
                        <Field label="שם קבלן">
                          <input value={subcontractorPreliminaryForm.subcontractor?.subcontractorName ?? ''} onChange={(e) => setSubcontractorPreliminaryForm((prev) => ({ ...prev, subcontractor: { ...(prev.subcontractor as SubcontractorPreliminary), subcontractorName: e.target.value } }))} style={inputStyle} />
                        </Field>
                        <Field label="תחום">
                          <input value={subcontractorPreliminaryForm.subcontractor?.field ?? ''} onChange={(e) => setSubcontractorPreliminaryForm((prev) => ({ ...prev, subcontractor: { ...(prev.subcontractor as SubcontractorPreliminary), field: e.target.value } }))} style={inputStyle} />
                        </Field>
                        <Field label="טלפון">
                          <input value={subcontractorPreliminaryForm.subcontractor?.contactPhone ?? ''} onChange={(e) => setSubcontractorPreliminaryForm((prev) => ({ ...prev, subcontractor: { ...(prev.subcontractor as SubcontractorPreliminary), contactPhone: e.target.value } }))} style={inputStyle} />
                        </Field>
                        <Field label="מספר אישור">
                          <input value={subcontractorPreliminaryForm.subcontractor?.approvalNo ?? ''} onChange={(e) => setSubcontractorPreliminaryForm((prev) => ({ ...prev, subcontractor: { ...(prev.subcontractor as SubcontractorPreliminary), approvalNo: e.target.value } }))} style={inputStyle} />
                        </Field>
                        <Field label="הערות" full>
                          <textarea value={subcontractorPreliminaryForm.subcontractor?.notes ?? ''} onChange={(e) => setSubcontractorPreliminaryForm((prev) => ({ ...prev, subcontractor: { ...(prev.subcontractor as SubcontractorPreliminary), notes: e.target.value } }))} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
                        </Field>
                      </div>
                      <div style={buttonRowStyle}>
                        <button style={primaryButtonStyle} onClick={() => savePreliminary('subcontractors')}>שמור קבלן</button>
                      </div>
                    </>
                  )}

                  {preliminaryTab === 'materials' && (
                    <>
                      <div style={subHeaderStyle}>תיקיית חומרים</div>
                      <div style={formGridStyle}>
                        <Field label="כותרת">
                          <input value={materialPreliminaryForm.title} onChange={(e) => setMaterialPreliminaryForm((prev) => ({ ...prev, title: e.target.value }))} style={inputStyle} />
                        </Field>
                        <Field label="תאריך">
                          <input type="date" value={materialPreliminaryForm.date} onChange={(e) => setMaterialPreliminaryForm((prev) => ({ ...prev, date: e.target.value }))} style={inputStyle} />
                        </Field>
                        <Field label="סטטוס">
                          <select value={materialPreliminaryForm.status} onChange={(e) => setMaterialPreliminaryForm((prev) => ({ ...prev, status: e.target.value as PreliminaryRecord['status'] }))} style={inputStyle}>
                            <option value="טיוטה">טיוטה</option>
                            <option value="מאושר">מאושר</option>
                            <option value="לא מאושר">לא מאושר</option>
                          </select>
                        </Field>
                        <Field label="שם חומר">
                          <input value={materialPreliminaryForm.material?.materialName ?? ''} onChange={(e) => setMaterialPreliminaryForm((prev) => ({ ...prev, material: { ...(prev.material as MaterialPreliminary), materialName: e.target.value } }))} style={inputStyle} />
                        </Field>
                        <Field label="מקור">
                          <input value={materialPreliminaryForm.material?.source ?? ''} onChange={(e) => setMaterialPreliminaryForm((prev) => ({ ...prev, material: { ...(prev.material as MaterialPreliminary), source: e.target.value } }))} style={inputStyle} />
                        </Field>
                        <Field label="ייעוד">
                          <input value={materialPreliminaryForm.material?.usage ?? ''} onChange={(e) => setMaterialPreliminaryForm((prev) => ({ ...prev, material: { ...(prev.material as MaterialPreliminary), usage: e.target.value } }))} style={inputStyle} />
                        </Field>
                        <Field label="מספר תעודה">
                          <input value={materialPreliminaryForm.material?.certificateNo ?? ''} onChange={(e) => setMaterialPreliminaryForm((prev) => ({ ...prev, material: { ...(prev.material as MaterialPreliminary), certificateNo: e.target.value } }))} style={inputStyle} />
                        </Field>
                        <Field label="הערות" full>
                          <textarea value={materialPreliminaryForm.material?.notes ?? ''} onChange={(e) => setMaterialPreliminaryForm((prev) => ({ ...prev, material: { ...(prev.material as MaterialPreliminary), notes: e.target.value } }))} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
                        </Field>
                      </div>
                      <div style={buttonRowStyle}>
                        <button style={primaryButtonStyle} onClick={() => savePreliminary('materials')}>שמור חומר</button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </main>

        <aside style={sideCardStyle}>
          <h3 style={sideTitleStyle}>רשומות שמורות</h3>
          <div style={sideProjectStyle}>פרויקט: {projectName}</div>

          <div style={smallSectionTitleStyle}>רשימות תיוג</div>
          {projectChecklists.length === 0 ? (
            <div style={emptyBoxStyle}>אין רשימות תיוג שמורות.</div>
          ) : (
            projectChecklists.map((item) => (
              <SavedCard
                key={item.id}
                title={item.title}
                subtitle={`תבנית: ${checklistTemplateLabel(item.templateKey)} · קטגוריה: ${item.category}`}
                meta={`נשמר: ${item.savedAt}`}
                onOpen={() => loadChecklist(item)}
                onDelete={() => deleteChecklist(item.id)}
              />
            ))
          )}

          <div style={smallSectionTitleStyle}>אי תאמות</div>
          {projectNonconformances.length === 0 ? (
            <div style={emptyBoxStyle}>אין אי תאמות שמורות.</div>
          ) : (
            projectNonconformances.map((item) => (
              <SavedCard
                key={item.id}
                title={item.title}
                subtitle={`סטטוס: ${item.status}`}
                meta={`נשמר: ${item.savedAt}`}
