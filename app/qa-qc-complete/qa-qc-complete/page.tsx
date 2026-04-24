'use client';

import { useEffect, useMemo, useState } from 'react';

import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
type Section = 'home' | 'projects' | 'checklists' | 'nonconformances' | 'trialSections' | 'preliminary';
type ChecklistTemplateKey = 'general' | 'guardrails' | 'aggregateDistribution' | 'curbstones' | 'standardCompaction' | 'catsEyes' | 'concreteCasting' | 'jkWorks' | 'controlledCompaction' | 'signage' | 'paving' | 'steelGuardrailsSupply' | 'asphaltWorks' | 'drainagePiping';
type ChecklistStatus = 'לא נבדק' | 'תקין' | 'לא תקין' | 'לא רלוונטי';
type Severity = 'נמוכה' | 'בינונית' | 'גבוהה';
type RecordStatus = 'טיוטה' | 'מאושר' | 'לא מאושר';
type TrialStatus = 'טיוטה' | 'אושר' | 'נדחה';
type NonconformanceStatus = 'פתוח' | 'בטיפול' | 'נסגר';
type PreliminaryTab = 'suppliers' | 'subcontractors' | 'materials';

type Project = {
  id: string;
  name: string;
  description: string;
  manager: string;
  isActive: boolean;
  createdAt: string;
};

type ApprovalSignature = {
  role: string;
  signerName: string;
  signature: string;
  signedAt: string;
  required: boolean;
};

type ApprovalFlow = {
  status: 'draft' | 'approved' | 'rejected';
  remarks: string;
  signatures: ApprovalSignature[];
};

type ChecklistItemSignature = {
  role: string;
  required: boolean;
  signerName: string;
  signature: string;
  signedAt: string;
};

type ChecklistItem = {
  id: string;
  description: string;
  responsible: string;
  status: ChecklistStatus;
  notes: string;
  inspector: string;
  executionDate: string;
  notApplicable: boolean;
  rowSignatures: ChecklistItemSignature[];
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
  details?: Record<string, string>;
  items: ChecklistItem[];
  approval: ApprovalFlow;
  savedAt: string;
};

type NonconformanceRecord = {
  id: string;
  projectId: string;
  title: string;
  location: string;
  date: string;
  raisedBy: string;
  severity: Severity;
  status: NonconformanceStatus;
  description: string;
  actionRequired: string;
  notes: string;
  details: Record<string, string>;
  images: string[];
  approval: ApprovalFlow;
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
  status: TrialStatus;
  notes: string;
  details: Record<string, string>;
  images: string[];
  approval: ApprovalFlow;
  savedAt: string;
};

type FileAttachment = {
  name: string;
  type: string;
  dataUrl: string;
  uploadedAt: string;
};

type PreliminaryDocumentRow = {
  details: string;
  exists: string;
  certificateNo: string;
  validUntil: string;
  attachedDocuments: string;
};

type PreliminaryInspectionRow = {
  testType: string;
  specificationRequirements: string;
  testResults: string;
  certificateNo: string;
  passFail: string;
  notes: string;
};

type SupplierPreliminary = {
  mainContractor: string;
  projectName: string;
  managementCompany: string;
  contractNo: string;
  qualityControlCompany: string;
  qualityAssuranceCompany: string;
  approvalNo: string;
  openingDate: string;
  supplierName: string;
  subProject: string;
  contactPhone: string;
  suppliedMaterial: string;
  documents: PreliminaryDocumentRow[];
  qualityAssuranceNotes: string;
  qualityControlNotes: string;
  notes: string;
};

type SubcontractorPreliminary = {
  mainContractor: string;
  projectName: string;
  managementCompany: string;
  contractNo: string;
  qualityControlCompany: string;
  qualityAssuranceCompany: string;
  approvalNo: string;
  openingDate: string;
  subcontractorName: string;
  field: string;
  subProject: string;
  contactPhone: string;
  documents: PreliminaryDocumentRow[];
  qualityAssuranceNotes: string;
  qualityControlNotes: string;
  notes: string;
};

type MaterialPreliminary = {
  mainContractor: string;
  projectName: string;
  managementCompany: string;
  contractNo: string;
  qualityControlCompany: string;
  qualityAssuranceCompany: string;
  approvalNo: string;
  openingDate: string;
  supplierName: string;
  subProject: string;
  source: string;
  suppliedMaterial: string;
  usage: string;
  inspections: PreliminaryInspectionRow[];
  documents: PreliminaryDocumentRow[];
  qualityAssuranceNotes: string;
  qualityControlNotes: string;
  notes: string;
};

type PreliminaryRecord = {
  id: string;
  projectId: string;
  subtype: PreliminaryTab;
  title: string;
  date: string;
  status: RecordStatus;
  supplier?: SupplierPreliminary;
  subcontractor?: SubcontractorPreliminary;
  material?: MaterialPreliminary;
  attachments: FileAttachment[];
  approval: ApprovalFlow;
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

type ChecklistTemplateDefinition = {
  label: string;
  title: string;
  category: string;
  items: { description: string; responsible: string; stage?: string }[];
};

const STORAGE_KEY = 'yk-quality-stage5-single-file';
const CURRENT_PROJECT_STORAGE_KEY = `${STORAGE_KEY}-current-project-id`;
const DEFAULT_ROW_SIGNATURE_ROLES = ['מודד', 'מנהל עבודה', 'בקרת איכות'];

const nowLocal = () => new Date().toLocaleString('he-IL');
const nowIso = () => new Date().toISOString();

const defaultProjects: Project[] = [
  {
    id: '1',
    name: 'כביש 781',
    description: 'פרויקט תשתיות',
    manager: '',
    isActive: true,
    createdAt: nowLocal(),
  },
];

const checklistTemplates: Record<ChecklistTemplateKey, ChecklistTemplateDefinition> = {
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
  guardrails: {
    label: 'עבודות מעקות',
    title: 'רשימת תיוג לעבודות מעקות',
    category: 'מעקות',
    items: [
      { description: 'אישור המעקה וסוגו', responsible: 'בקרת איכות' },
      { description: 'אישור חומרים ובדיקות מוקדמות + אישור קבלן', responsible: 'בקרת איכות' },
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
  aggregateDistribution: {
    label: 'פיזור מצעים',
    title: 'רשימת תיוג לעבודות פיזור מצעים',
    category: 'פיזור מצעים',
    items: [
      { description: 'בדיקת תוכניות לביצוע + מהדורה', responsible: 'בקרת איכות' },
      { description: 'איתור בדיקות מקדימות לחומר המצע', responsible: 'בקרת איכות' },
      { description: 'אימות תוצאות כל הבדיקות לשכבה הקודמת', responsible: 'בקרת איכות' },
      { description: 'בדיקה חזותית לשלמות השכבה הקודמת', responsible: 'בקרת איכות' },
      { description: 'פיזור שכבה חדשה אחידה ומפולסת', responsible: 'מנהל עבודה' },
      { description: 'ביצוע בדיקות אפיון שוטפות', responsible: 'בקרת איכות' },
      { description: 'פיזור, פילוס, סילוק ריכוזי אבן, הרטבה והידוק', responsible: 'מנהל עבודה' },
      { description: 'בקרה ויזואלית', responsible: 'בקרת איכות' },
      { description: 'בדיקת מפלסי השכבה', responsible: 'מודד הקבלן' },
      { description: 'בדיקות דרגת הידוק ותכולת רטיבות', responsible: 'בקרת איכות' },
      { description: 'בדיקת מישוריות', responsible: 'בקרת איכות' },
      { description: 'בדיקות FWD לשכבה הסופית', responsible: 'בקרת איכות' },
      { description: 'אישור סופי', responsible: 'בקרת איכות' },
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
      { description: 'ביצוע תחתית ומשענת בטון לפי הפרט', responsible: 'מנהל העבודה' },
      { description: 'מילוי הפוגות בין אבני השפה בטיט צמנטי', responsible: 'מנהל העבודה' },
      { description: 'ביצוע ראש אי מבטון מזוין', responsible: 'מנהל העבודה' },
      { description: 'תוצאות הבדיקה לאחר 28 יום', responsible: 'מנהל העבודה' },
      { description: 'אישור גמר העבודה', responsible: 'בקרת איכות' },
    ],
  },
  standardCompaction: {
    label: 'הידוק רגיל',
    title: 'רשימת תיוג לעבודות הידוק רגיל',
    category: 'הידוק רגיל',
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
  catsEyes: {
    label: 'עיני חתול',
    title: 'רשימת תיוג להתקנת עיני חתול',
    category: 'התקנת עיני חתול',
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
  concreteCasting: {
    label: 'יציקות באתר',
    title: 'רשימת תיוג ליציקות באתר',
    category: 'בטון',
    items: [
      { description: 'שימוש בתוכניות מעודכנות', responsible: 'מב"א' },
      { description: 'סימון מיקום ורשימת גבהים ליציקה', responsible: 'מודד' },
      { description: 'יציקת בטון רזה (עפ"י דרישת התוכנית)', responsible: 'מנה"ע' },
      { description: 'סידור הזיון, מיקום חפיות, גובה סטטי של החתך, עובי כיסוי נדרש', responsible: 'מנה"ע' },
      { description: 'בדיקת זיון, חיפוש, הארקות, קיטום פינות, אביזרים נלווים, ניקיון כללי ואישור להרכבת תבניות', responsible: 'מב"א' },
      { description: 'אישור ליציקה', responsible: 'מב"א' },
      { description: 'פיקוח על יציקת הבטון (רצף, עובי וריטוט)', responsible: 'מב"א' },
      { description: 'נטילת מדגמי בטון', responsible: 'מב"א' },
      { description: 'טיפול בפני הבטון עם סיום היציקה למניעת סדיקה', responsible: 'מנה"ע' },
      { description: 'תהליך אשפרה', responsible: 'מנה"ע' },
      { description: 'בדיקת חזות הבטון', responsible: 'מב"א' },
      { description: 'בדיקת מודד לאחר יציקה As-Made', responsible: 'מודד' },
      { description: 'איטום', responsible: 'מנה"ע' },
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
      { description: 'הנחת רשתות מתכת דגם J.K STRUCTURE ועיגונן לקרקע, שימוש בשומרי מרחק מהקרקע ונשמים. קצות הרשתות החיצוניות יכופפו לתוך תעלות העיגון האורכיות', responsible: 'מנהל עבודה' },
      { description: 'אישור הנחת רשתות ואישור לפיזור הבטון', responsible: 'בקרת איכות' },
      { description: 'פיזור הבטון בגוון המתאים לפני השטח על גבי הרשתות', responsible: 'מנהל עבודה' },
      { description: 'בדיקת בטון', responsible: 'בקרת איכות' },
      { description: 'החלקת הבטון באמצעות מגרפות', responsible: 'מנהל עבודה' },
      { description: 'ביצוע אשפרה', responsible: 'מנהל עבודה' },
      { description: 'מדידת מצב לאחר ביצוע העבודות', responsible: 'מודד' },
      { description: 'אישור סופי', responsible: 'בקרת איכות' },
    ],
  },
  controlledCompaction: {
    label: 'הידוק מבוקר',
    title: 'רשימת תיוג לעבודות הידוק מבוקר',
    category: 'הידוק מבוקר',
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
      { description: 'האם קיימת סקיצה/תוכנית/הנחיות בכתב ממנהל הפרויקט לביצוע העבודות', responsible: 'מנהל העבודה' },
      { description: 'האם בוצע סיור וסימון מוקדם בנוכחות מנהל פרויקט', responsible: 'מנהל העבודה' },
      { description: 'אישור בקרה מוקדמת לטיב החומרים', responsible: 'בקרת איכות' },
      { description: 'בדיקת רום שתית', responsible: 'מנהל העבודה' },
      { description: 'בדיקת הידוק ורום מצעים', responsible: 'מנהל העבודה' },
      { description: 'פיזור חול דיונות בעובי 4 ס"מ', responsible: 'מנהל העבודה' },
      { description: 'פיזור חול מעל הריצוף והידוק בפלטה ויברציונית', responsible: 'מנהל העבודה' },
      { description: 'בדיקת מפלס אבן שפה / אבן אי מעל מפלס האספלט', responsible: 'מנהל העבודה' },
      { description: 'ביצוע תחתית ומשענת בטון עפ"י הפרט לאבן שפה / אבן אי', responsible: 'מנהל העבודה' },
      { description: 'מילוי הפוגות בין אבני השפה בטיט צמנטי', responsible: 'מנהל העבודה' },
      { description: 'ביצוע ראש אי מבטון מזוין', responsible: 'מנהל העבודה' },
      { description: 'תוצאות הבדיקה לאחר 28 יום', responsible: 'מנהל העבודה' },
      { description: 'אישור גמר העבודה', responsible: 'בקרת איכות' },
    ],
  },
  steelGuardrailsSupply: {
    label: 'אספקה והרכבת מעקות פלדה',
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
  asphaltWorks: {
    label: 'עבודות אספלט',
    title: 'רשימת תיוג לביצוע עבודות אספלט באתר',
    category: 'אספלט',
    items: [
      { description: 'אישור בקרה מוקדמת בהתאם לטופס 51.04', stage: 'לפני ביצוע', responsible: 'בקרת איכות' },
      { description: 'קיום אישור לשכבה קודמת', stage: 'לפני ביצוע', responsible: 'בקרת איכות' },
      { description: 'אישור בקרה ויזואלית של השכבה הקודמת', stage: 'לפני ביצוע', responsible: 'בקרת איכות' },
      { description: 'תקינות פינישר, כבלים, מרססת וציוד הידוק', stage: 'לפני ביצוע', responsible: 'בקרת איכות' },
      { description: 'קיום רשימת תוכניות עבודה מעודכנות', stage: 'לפני ביצוע', responsible: 'בקרת איכות' },
      { description: 'ביצוע בדיקות שוטפות – פרק 51.04', stage: 'במהלך הביצוע', responsible: 'בקרת איכות' },
      { description: 'בדיקת התאמת מפלס לדרישות המפרט', stage: 'במהלך הביצוע', responsible: 'מודד מוסמך' },
      { description: 'בדיקות גליות', stage: 'במהלך הביצוע', responsible: 'בקרת איכות' },
      { description: 'בדיקה ויזואלית וגמר', stage: 'במהלך הביצוע', responsible: 'בקרת איכות' },
      { description: 'מעקב בדיקות שוטפות לחומר ולתערובת', responsible: 'בקרת איכות' },
      { description: 'אישור סופי בקרת איכות', responsible: 'בקרת איכות' },
    ],
  },
  drainagePiping: {
    label: 'צנרת ניקוז',
    title: 'רשימת תיוג התקנת מערכות אספקת מים / צנרת ניקוז',
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
};

const styles: Record<string, React.CSSProperties> = {
  page: { background: '#f8fafc', minHeight: '100vh', padding: 20, fontFamily: 'Arial, sans-serif', color: '#0f172a' },
  header: { display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' },
  headerCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 18, flex: 1, minWidth: 260 },
  navRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 },
  navBtn: { borderRadius: 999, border: '1px solid #cbd5e1', padding: '10px 14px', cursor: 'pointer', fontWeight: 700 },
  layout: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 16 },
  mainCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 20 },
  sideCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 16, position: 'sticky', top: 20, alignSelf: 'start', maxHeight: 'calc(100vh - 40px)', overflow: 'auto' },
  sectionTitle: { marginTop: 0, marginBottom: 18, fontSize: 26 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 14 },
  full: { gridColumn: '1 / -1' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontWeight: 700, fontSize: 14 },
  input: { borderRadius: 12, border: '1px solid #cbd5e1', padding: '10px 12px', width: '100%', boxSizing: 'border-box', background: '#fff' },
  textarea: { borderRadius: 12, border: '1px solid #cbd5e1', padding: '10px 12px', width: '100%', minHeight: 90, resize: 'vertical', boxSizing: 'border-box' },
  card: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, marginBottom: 14 },
  buttonRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 },
  primaryBtn: { background: '#0f172a', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 14px', cursor: 'pointer', fontWeight: 700 },
  secondaryBtn: { background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 12, padding: '10px 14px', cursor: 'pointer', fontWeight: 700 },
  dangerBtn: { background: '#fff1f2', color: '#9f1239', border: '1px solid #fecdd3', borderRadius: 12, padding: '10px 14px', cursor: 'pointer', fontWeight: 700 },
  muted: { color: '#475569', fontSize: 13 },
  rowCard: { border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, marginBottom: 14, background: '#fff' },
  rowHeader: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' },
  rowGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 },
  signaturesWrap: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 12, marginTop: 12 },
  signatureGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 },
  statCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16 },
  badge: { display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: '#e2e8f0', fontSize: 12, fontWeight: 700 },
  emptyBox: { borderRadius: 16, border: '1px dashed #cbd5e1', padding: 24, textAlign: 'center', color: '#64748b', background: '#fff' },
  divider: { borderTop: '1px solid #e2e8f0', margin: '18px 0' },
  exportRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 },
};

const createDefaultApproval = (): ApprovalFlow => ({
  status: 'draft',
  remarks: '',
  signatures: [
    { role: 'מנהל בקרת איכות', signerName: '', signature: '', signedAt: '', required: true },
    { role: 'מנהל פרויקט', signerName: '', signature: '', signedAt: '', required: true },
    { role: 'מפקח', signerName: '', signature: '', signedAt: '', required: false },
  ],
});

const createDefaultRowSignatures = (): ChecklistItemSignature[] =>
  DEFAULT_ROW_SIGNATURE_ROLES.map((role) => ({
    role,
    required: role !== 'מודד',
    signerName: '',
    signature: '',
    signedAt: '',
  }));

const emptyChecklistItem = (id: string): ChecklistItem => ({
  id,
  description: '',
  responsible: '',
  status: 'לא נבדק',
  notes: '',
  inspector: '',
  executionDate: '',
  notApplicable: false,
  rowSignatures: createDefaultRowSignatures(),
});

const normalizeApproval = (value: unknown): ApprovalFlow => {
  const base = createDefaultApproval();
  if (!value || typeof value !== 'object') return base;
  const raw = value as Partial<ApprovalFlow>;
  return {
    status: raw.status === 'approved' || raw.status === 'rejected' ? raw.status : 'draft',
    remarks: typeof raw.remarks === 'string' ? raw.remarks : '',
    signatures: base.signatures.map((sig) => {
      const found = Array.isArray(raw.signatures) ? raw.signatures.find((item) => item?.role === sig.role) : undefined;
      return {
        ...sig,
        signerName: found?.signerName ?? '',
        signature: found?.signature ?? '',
        signedAt: found?.signedAt ?? '',
        required: typeof found?.required === 'boolean' ? found.required : sig.required,
      };
    }),
  };
};

const normalizeChecklistItems = (items: ChecklistItem[] | unknown): ChecklistItem[] => {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    id: item?.id ?? `${Date.now()}-${index}`,
    description: item?.description ?? '',
    responsible: item?.responsible ?? '',
    status: item?.notApplicable ? 'לא רלוונטי' : (item?.status ?? 'לא נבדק'),
    notes: item?.notes ?? '',
    inspector: item?.inspector ?? '',
    executionDate: item?.executionDate ?? '',
    notApplicable: Boolean(item?.notApplicable),
    rowSignatures: Array.isArray(item?.rowSignatures)
      ? createDefaultRowSignatures().map((sig) => {
          const found = item.rowSignatures.find((rowSig) => rowSig?.role === sig.role);
          return {
            ...sig,
            required: typeof found?.required === 'boolean' ? found.required : sig.required,
            signerName: found?.signerName ?? '',
            signature: found?.signature ?? '',
            signedAt: found?.signedAt ?? '',
          };
        })
      : createDefaultRowSignatures(),
  }));
};

const buildChecklistItemsFromTemplate = (templateKey: ChecklistTemplateKey): ChecklistItem[] =>
  checklistTemplates[templateKey].items.map((item, index) => ({
    ...emptyChecklistItem(`${Date.now()}-${index}`),
    description: item.description,
    responsible: item.responsible,
    inspector: item.stage ?? '',
  }));

const createDefaultChecklist = (templateKey: ChecklistTemplateKey = 'general'): Omit<ChecklistRecord, 'id' | 'projectId' | 'savedAt'> => ({
  templateKey,
  title: checklistTemplates[templateKey].title,
  category: checklistTemplates[templateKey].category,
  location: '',
  date: '',
  contractor: '',
  notes: '',
  details: {},
  items: buildChecklistItemsFromTemplate(templateKey),
  approval: createDefaultApproval(),
});

const nonconformanceTemplateFields = [
  'שם הפרויקט',
  'חברת ניהול',
  'קבלן ראשי',
  'חברת בקרת איכות',
  'אי התאמה מס׳',
  'נפתח - תפקיד',
  'נפתח - שם',
  'תאריך הפתיחה',
  'מבנה',
  'אלמנט',
  'תת אלמנט',
  'מחתך',
  'עד חתך',
  'הסט',
  'דרגה',
  'תאריך סגירת אי התאמה משוער-מסוכם',
  'תאריך סגירה משוער על פי החלטת מנה״פ',
  'שבר',
  'השפעה על איכות',
  'תיאור אי ההתאמה',
  'גורם אחראי לליקוי תכנון, ביצוע, ספק',
  'טיפול נדרש',
  'גורם המטפל',
  'פירוט ביצוע פעולה מתקנת',
  'הערות',
  'אישור ביצוע פעילות מתקנת',
  'נסגרה ע״י - תפקיד',
  'נסגרה ע״י - שם',
  'תאריך סגירה',
  'מסמכים נוספים - פרטים',
  'מסמכים נוספים - קיים / לא קיים',
  'מסמכים נוספים - מספר תעודה',
  'מסמכים נוספים - תוקף',
  'מסמכים נוספים - מסמכים מצורפים',
];

const trialSectionTemplateFields = [
  'שם הפרויקט',
  'חברת ניהול',
  'קבלן ראשי',
  'חברת בקרת איכות',
  'קטע מס׳',
  'הוכחת היכולת לפעולה מסוג',
  'שם האלמנט',
  'תת אלמנט',
  'מחתך עד חתך/צד',
  'משתתפים בקטע ניסוי',
  'חומרים לשימוש',
  'הכלים בהם משתמשים',
  'תאריך ביצוע',
  'תיאור קטע ניסוי',
  'מסקנות קטע ניסוי',
  'פעולה מתקנת (במידה ונדרשת)',
];

const emptyDetails = (fields: string[]) => fields.reduce<Record<string, string>>((acc, field) => ({ ...acc, [field]: '' }), {});

const createDefaultNonconformance = (): Omit<NonconformanceRecord, 'id' | 'projectId' | 'savedAt'> => ({
  title: 'טופס אי התאמה',
  location: '',
  date: '',
  raisedBy: '',
  severity: 'בינונית',
  status: 'פתוח',
  description: '',
  actionRequired: '',
  notes: '',
  details: emptyDetails(nonconformanceTemplateFields),
  images: [],
  approval: createDefaultApproval(),
});

const createDefaultTrialSection = (): Omit<TrialSectionRecord, 'id' | 'projectId' | 'savedAt'> => ({
  title: 'דוח קטע ניסוי',
  location: '',
  date: '',
  spec: '',
  result: '',
  approvedBy: '',
  status: 'טיוטה',
  notes: '',
  details: emptyDetails(trialSectionTemplateFields),
  images: [],
  approval: createDefaultApproval(),
});


const emptyPreliminaryDocument = (details: string): PreliminaryDocumentRow => ({ details, exists: '', certificateNo: '', validUntil: '', attachedDocuments: '' });
const emptyPreliminaryInspection = (testType: string): PreliminaryInspectionRow => ({ testType, specificationRequirements: '', testResults: '', certificateNo: '', passFail: '', notes: '' });

const supplierPreliminaryFields: { key: keyof SupplierPreliminary; label: string }[] = [
  { key: 'mainContractor', label: 'קבלן ראשי' },
  { key: 'projectName', label: 'שם הפרויקט' },
  { key: 'managementCompany', label: 'חברת ניהול' },
  { key: 'contractNo', label: 'חוזה מס׳' },
  { key: 'qualityControlCompany', label: 'חברת בקרת איכות' },
  { key: 'qualityAssuranceCompany', label: 'חברת הבטחת איכות' },
  { key: 'approvalNo', label: 'מספר אישור' },
  { key: 'openingDate', label: 'תאריך פתיחת טופס' },
  { key: 'supplierName', label: 'שם ספק' },
  { key: 'subProject', label: 'תת פרויקט' },
  { key: 'contactPhone', label: 'אנשי קשר וטלפון' },
  { key: 'suppliedMaterial', label: 'חומר מסופק' },
];

const subcontractorPreliminaryFields: { key: keyof SubcontractorPreliminary; label: string }[] = [
  { key: 'mainContractor', label: 'קבלן ראשי' },
  { key: 'projectName', label: 'שם הפרויקט' },
  { key: 'managementCompany', label: 'חברת ניהול' },
  { key: 'contractNo', label: 'חוזה מס׳' },
  { key: 'qualityControlCompany', label: 'חברת בקרת איכות' },
  { key: 'qualityAssuranceCompany', label: 'חברת הבטחת איכות' },
  { key: 'approvalNo', label: 'מספר אישור' },
  { key: 'openingDate', label: 'תאריך פתיחת טופס' },
  { key: 'subcontractorName', label: 'קבלן משנה' },
  { key: 'field', label: 'תחום פעילות' },
  { key: 'subProject', label: 'תת פרויקט' },
  { key: 'contactPhone', label: 'אנשי קשר וטלפון' },
];

const materialPreliminaryFields: { key: keyof MaterialPreliminary; label: string }[] = [
  { key: 'mainContractor', label: 'קבלן ראשי' },
  { key: 'projectName', label: 'שם הפרויקט' },
  { key: 'managementCompany', label: 'חברת ניהול' },
  { key: 'contractNo', label: 'חוזה מס׳' },
  { key: 'qualityControlCompany', label: 'חברת בקרת איכות' },
  { key: 'qualityAssuranceCompany', label: 'חברת הבטחת איכות' },
  { key: 'approvalNo', label: 'מספר אישור' },
  { key: 'openingDate', label: 'תאריך פתיחת טופס' },
  { key: 'supplierName', label: 'שם ספק' },
  { key: 'subProject', label: 'תת פרויקט' },
  { key: 'source', label: 'מקור החומר' },
  { key: 'suppliedMaterial', label: 'חומר מסופק' },
  { key: 'usage', label: 'ייעוד השימוש בחומר' },
];

const createDefaultPreliminary = (subtype: PreliminaryTab): Omit<PreliminaryRecord, 'id' | 'projectId' | 'savedAt'> => ({
  subtype,
  title: subtype === 'suppliers' ? 'אישור ספקים' : subtype === 'subcontractors' ? 'אישור קבלני משנה' : 'בקרה מקדימה לחומרים',
  date: '',
  status: 'טיוטה',
  supplier: subtype === 'suppliers' ? {
    mainContractor: '', projectName: '', managementCompany: '', contractNo: '', qualityControlCompany: '', qualityAssuranceCompany: '', approvalNo: '', openingDate: '', supplierName: '', subProject: '', contactPhone: '', suppliedMaterial: '',
    documents: [emptyPreliminaryDocument('תעודת ISO'), emptyPreliminaryDocument('מסמך מקורי חתום ע״י ב״א')], qualityAssuranceNotes: '', qualityControlNotes: '', notes: '',
  } : undefined,
  subcontractor: subtype === 'subcontractors' ? {
    mainContractor: '', projectName: '', managementCompany: '', contractNo: '', qualityControlCompany: '', qualityAssuranceCompany: '', approvalNo: '', openingDate: '', subcontractorName: '', field: '', subProject: '', contactPhone: '',
    documents: [emptyPreliminaryDocument('אישור ת״ת רלוונטי'), emptyPreliminaryDocument('מסמך מקורי חתום ע״י ב״א')], qualityAssuranceNotes: '', qualityControlNotes: '', notes: '',
  } : undefined,
  attachments: [],
  material: subtype === 'materials' ? {
    mainContractor: '', projectName: '', managementCompany: '', contractNo: '', qualityControlCompany: '', qualityAssuranceCompany: '', approvalNo: '', openingDate: '', supplierName: '', subProject: '', source: '', suppliedMaterial: '', usage: '',
    inspections: [emptyPreliminaryInspection('בדיקת 100% מלאה'), emptyPreliminaryInspection('בדיקת מת״ק + לוס אנג׳לס')],
    documents: [emptyPreliminaryDocument('תוצאות בדיקת חומרים מקדימה'), emptyPreliminaryDocument('תעודת מעבדה'), emptyPreliminaryDocument('מסמך מקורי חתום ע״י ב״א')], qualityAssuranceNotes: '', qualityControlNotes: '', notes: '',
  } : undefined,
  approval: createDefaultApproval(),
});

const isChecklistTemplateKey = (value: unknown): value is ChecklistTemplateKey =>
  typeof value === 'string' && value in checklistTemplates;

const normalizeChecklistTemplateKey = (value: unknown): ChecklistTemplateKey =>
  isChecklistTemplateKey(value) ? value : 'general';

const errorText = (error: unknown) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
    const details = 'details' in error ? String((error as { details?: unknown }).details ?? '') : '';
    return `${message} ${details}`.trim();
  }
  return String(error);
};

const isMissingColumnError = (error: unknown, columnName: string) => {
  const text = errorText(error).toLowerCase();
  return (
    text.includes(columnName.toLowerCase()) &&
    (text.includes('does not exist') || text.includes('could not find') || text.includes('schema cache'))
  );
};

const shouldIgnoreCloudError = (error: unknown) => /relation .* does not exist/i.test(errorText(error));

const readLocalCurrentProjectId = () => (typeof window === 'undefined' ? null : window.localStorage.getItem(CURRENT_PROJECT_STORAGE_KEY));
const writeLocalCurrentProjectId = (projectId: string | null) => {
  if (typeof window === 'undefined') return;
  if (projectId) window.localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, projectId);
  else window.localStorage.removeItem(CURRENT_PROJECT_STORAGE_KEY);
};

async function selectTable(table: string, orderColumn?: string) {
  const baseQuery = supabase.from(table).select('*');
  if (!orderColumn) return await baseQuery;
  const ordered = await supabase.from(table).select('*').order(orderColumn, { ascending: false });
  if (!ordered.error) return ordered;
  if (isMissingColumnError(ordered.error, orderColumn)) return await baseQuery;
  return ordered;
}

async function saveWithFallback(table: string, payload: Record<string, any>, mode: 'insert' | 'update', id?: string) {
  const runSave = async (nextPayload: Record<string, any>) =>
    mode === 'insert' ? await supabase.from(table).insert(nextPayload) : await supabase.from(table).update(nextPayload).eq('id', id);

  let nextPayload = { ...payload };
  let result = await runSave(nextPayload);

  if (result.error && isMissingColumnError(result.error, 'approval')) {
    const { approval, ...withoutApproval } = nextPayload;
    nextPayload = withoutApproval;
    result = await runSave(nextPayload);
  }

  if (result.error && isMissingColumnError(result.error, 'details')) {
    const { details, ...withoutDetails } = nextPayload;
    nextPayload = withoutDetails;
    result = await runSave(nextPayload);
  }

  if (result.error && isMissingColumnError(result.error, 'attachments')) {
    const { attachments, ...withoutAttachments } = nextPayload;
    nextPayload = withoutAttachments;
    result = await runSave(nextPayload);
  }

  if (result.error && isMissingColumnError(result.error, 'images')) {
    const { images, ...withoutImages } = nextPayload;
    nextPayload = withoutImages;
    result = await runSave(nextPayload);
  }

  if (result.error) throw new Error(errorText(result.error) || 'שגיאה בשמירה מול Supabase');
}

const validateApproval = (approval: ApprovalFlow) => {
  if (approval.status !== 'approved') return null;
  const missing = approval.signatures.filter((s) => s.required && (!s.signerName.trim() || !s.signature.trim() || !s.signedAt));
  if (missing.length) return 'לא ניתן לאשר בלי חתימה, שם ותאריך לכל החתימות החובה.';
  return null;
};

const validateChecklistRows = (items: ChecklistItem[]) => {
  for (const item of items) {
    if (item.notApplicable) continue;
    const missingSignatures = item.rowSignatures.filter(
      (sig) => sig.required && (!sig.signerName.trim() || !sig.signature.trim() || !sig.signedAt),
    );
    if (missingSignatures.length) {
      return `בשורה "${item.description || 'ללא תיאור'}" חסרות חתימות חובה.`;
    }
  }
  return null;
};

const downloadBlob = (filename: string, content: BlobPart, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const buildChecklistHtml = (record: ChecklistRecord, projectName: string) => {
  const details = record.details ?? {};
  const metaFields = checklistMetaFields[record.templateKey] ?? [];
  const groupedMetaRows = [] as string[][];
  for (let i = 0; i < metaFields.length; i += 5) groupedMetaRows.push(metaFields.slice(i, i + 5));

  const detailsTable = groupedMetaRows
    .map((fields) => `
      <tr>${fields.map((field) => `<th>${escapeHtml(field)}</th>`).join('')}</tr>
      <tr>${fields.map((field) => `<td>${escapeHtml(details[field] || '')}</td>`).join('')}</tr>`)
    .join('');

  const signatureBlock = (item: ChecklistItem) => {
    const sig = item.rowSignatures?.[0];
    if (item.notApplicable) return '<div class="na-box">לא רלוונטי בשלב זה</div>';
    if (sig?.signature?.trim()) return `<div class="sig-box">${escapeHtml(sig.signature.trim())}</div>`;
    return '<span class="signature-line">&nbsp;</span>';
  };

  const rows = record.items
    .map(
      (item, index) => `
        <tr>
          <td class="col-index">${index + 1}</td>
          ${checklistUsesStage(record.templateKey) ? `<td class="col-stage">${escapeHtml(item.inspector || '')}</td>` : ''}
          <td class="col-desc">${escapeHtml(item.description)}</td>
          <td class="col-resp">${escapeHtml(item.responsible)}</td>
          <td class="col-status">${escapeHtml(checklistUsesStatus(record.templateKey) ? item.status : (item.rowSignatures?.[0]?.signerName || ''))}</td>
          <td class="col-signatures">${signatureBlock(item)}</td>
          <td class="col-date">${escapeHtml(item.rowSignatures?.[0]?.signedAt || item.executionDate || '')}</td>
          <td class="col-notes">${escapeHtml(item.notes || '')}</td>
        </tr>`,
    )
    .join('');

  return `
    <!doctype html>
    <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(record.title)}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 0; margin: 0; direction: rtl; color: #111827; }
          h1 { text-align: center; margin: 0 0 14px; font-size: 26px; text-decoration: underline; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; table-layout: fixed; }
          .meta-table th, .meta-table td { border: 1px solid #111827; padding: 7px 9px; text-align: center; vertical-align: middle; min-height: 26px; }
          .meta-table th { background: #d9d9d9; font-weight: 800; }
          .main-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .main-table th, .main-table td { border: 1px solid #111827; padding: 7px; text-align: center; vertical-align: middle; word-break: break-word; }
          .main-table th { background: #d9d9d9; font-weight: 800; }
          .col-index { width: 4%; }
          .col-stage { width: 10%; }
          .col-desc { width: 28%; }
          .col-resp { width: 13%; }
          .col-status { width: 12%; }
          .col-date { width: 11%; }
          .col-signatures { width: 14%; }
          .col-notes { width: 14%; }
          .signature-line { display: block; height: 24px; border-bottom: 1px dotted #94a3b8; }
          .sig-box { min-height: 24px; text-align: center; padding: 3px; background: #fff; }
          .na-box { border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 4px; padding: 8px; text-align: center; font-weight: 700; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(record.title)}</h1>
        <table class="meta-table"><tbody>
          ${detailsTable || `<tr><th>שם הפרויקט</th><th>קבלן מבצע</th><th>קטע עבודה</th><th>כביש/ מבנה</th><th>מספר רשימת תיוג</th></tr><tr><td>${escapeHtml(projectName)}</td><td>${escapeHtml(record.contractor || '')}</td><td></td><td></td><td></td></tr>`}
          <tr><th>תוכנית ביצוע מס׳</th><td colspan="4">${escapeHtml(details['תוכנית ביצוע מס׳'] || record.notes || '')}</td></tr>
        </tbody></table>
        <table class="main-table">
          <thead>
            ${!checklistUsesStatus(record.templateKey) ? `<tr><th class="col-index" rowspan="2">#</th>${checklistUsesStage(record.templateKey) ? '<th class="col-stage" rowspan="2">שלב</th>' : ''}<th class="col-desc" rowspan="2">${record.templateKey === 'jkWorks' || record.templateKey === 'signage' ? 'פעילות' : 'תאור פעילות הבקרה'}</th><th colspan="5">אישור שלבי התהליך ע״י בקרת האיכות</th></tr>` : ''}
            <tr>
              ${checklistUsesStatus(record.templateKey) ? '<th class="col-index">#</th>' : ''}
              ${checklistUsesStatus(record.templateKey) ? '<th class="col-desc">נושא לבדיקה</th>' : ''}
              <th class="col-resp">${checklistUsesStatus(record.templateKey) ? 'אחריות' : 'באחריות'}</th>
              <th class="col-status">${checklistUsesStatus(record.templateKey) ? 'תקין/לא תקין' : 'שם'}</th>
              <th class="col-signatures">חתימות</th>
              <th class="col-date">תאריך</th>
              <th class="col-notes">${checklistUsesStatus(record.templateKey) ? 'הערות' : record.templateKey === 'jkWorks' || record.templateKey === 'signage' ? 'מס׳ תעודה' : 'מס׳ תוכנית/ תעודת בדיקה'}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;
};

const checklistToCsv = (record: ChecklistRecord, projectName: string) => {
  const header = [
    'פרויקט',
    'טופס',
    'קטגוריה',
    'מיקום',
    'קבלן',
    'תאריך',
    'מספר שורה',
    'תיאור',
    'אחראי',
    'סטטוס',
    'לא רלוונטי',
    'תאריך ביצוע',
    'חתימות',
    'הערות',
  ];
  const lines = record.items.map((item, index) => [
    projectName,
    record.title,
    record.category,
    record.location,
    record.contractor,
    record.date,
    String(index + 1),
    item.description,
    item.responsible,
    item.notApplicable ? 'לא רלוונטי בשלב זה' : item.status,
    item.notApplicable ? 'כן' : 'לא',
    item.executionDate,
    item.notApplicable
      ? 'לא רלוונטי בשלב זה'
      : item.rowSignatures
          .filter((sig) => sig.required || sig.signerName || sig.signature || sig.signedAt)
          .map((sig) => `${sig.signerName || '-'} / ${sig.signature || (sig.signerName || sig.signedAt ? 'מאושר' : '')} / ${sig.signedAt || '-'}`)
          .join(' | '),
    item.notes,
  ]);
  const rows = [header, ...lines].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','));
  return `\uFEFF${rows.join('\n')}`;
};

const exportChecklistToWord = (record: ChecklistRecord, projectName: string) => {
  const html = buildChecklistHtml(record, projectName);
  downloadBlob(`${record.title}.doc`, html, 'application/msword;charset=utf-8');
};

const exportChecklistToExcel = (record: ChecklistRecord, projectName: string) => {
  const csv = checklistToCsv(record, projectName);
  downloadBlob(`${record.title}.csv`, csv, 'text/csv;charset=utf-8');
};

const exportChecklistToPdf = (record: ChecklistRecord, projectName: string) => {
  const html = buildChecklistHtml(record, projectName);
  const win = window.open('', '_blank', 'width=1200,height=900');
  if (!win) {
    alert('הדפדפן חסם חלון חדש. יש לאפשר popups כדי לייצא PDF.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 400);
};


const tableFromRowsHtml = (title: string, rows: [string, string][]) => `
  <!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
  <style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;direction:rtl;color:#111827}h1{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #111827;padding:8px;vertical-align:top}th{width:30%;background:#e5e7eb}</style></head>
  <body><h1>${escapeHtml(title)}</h1><table><tbody>${rows.map(([k,v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v || '')}</td></tr>`).join('')}</tbody></table></body></html>`;

const downloadRowsAsWord = (title: string, rows: [string, string][]) => downloadBlob(`${title}.doc`, tableFromRowsHtml(title, rows), 'application/msword;charset=utf-8');
const downloadRowsAsExcel = (title: string, rows: [string, string][]) => downloadBlob(`${title}.csv`, `\uFEFF${rows.map(([k,v]) => `"${String(k).replaceAll('"','""')}","${String(v ?? '').replaceAll('"','""')}"`).join('\n')}`, 'text/csv;charset=utf-8');
const downloadRowsAsPdf = (title: string, rows: [string, string][]) => {
  const win = window.open('', '_blank', 'width=1200,height=900');
  if (!win) return alert('הדפדפן חסם חלון חדש. יש לאפשר popups כדי לייצא PDF.');
  win.document.open(); win.document.write(tableFromRowsHtml(title, rows)); win.document.close(); win.focus(); setTimeout(() => win.print(), 400);
};

const nonconformanceRows = (record: NonconformanceRecord): [string, string][] => [
  ...(Object.entries(mergeTemplateDetails(nonconformanceTemplateFields, record.details)) as [string, string][]),
  ['סטטוס', record.status], ['חומרה', record.severity], ['מספר תמונות', String(normalizeImages(record.images).length)],
];
const trialSectionRows = (record: TrialSectionRecord): [string, string][] => [
  ...(Object.entries(mergeTemplateDetails(trialSectionTemplateFields, record.details)) as [string, string][]),
  ['סטטוס', record.status], ['מספר תמונות', String(normalizeImages(record.images).length)],
];
const preliminaryRows = (record: PreliminaryRecord): [string, string][] => {
  const data: Record<string, any> = record.supplier ?? record.subcontractor ?? record.material ?? {};
  const simple = Object.entries(data).filter(([, value]) => !Array.isArray(value) && typeof value !== 'object').map(([key, value]) => [key, String(value ?? '')] as [string, string]);
  return [['סוג טופס', record.subtype], ['תאריך', record.date], ['סטטוס', record.status], ...simple, ['מספר קבצים מצורפים', String(normalizeAttachments(record.attachments).length)]];
};

const checklistMetaFields: Partial<Record<ChecklistTemplateKey, string[]>> = {
  general: ['שם הפרויקט', 'קבלן מבצע', 'קטע עבודה', 'כביש/ מבנה', 'מספר רשימת תיוג', 'מס׳ שכבה', 'מס׳ שכבות מתוכנן', 'עובי השכבה', 'שטח השכבה', 'מחתך', 'היסט', 'לחתך', 'צד/ מיקום', 'מקור החומר', 'תאור חומר המילוי', 'מיון החומר'],
  aggregateDistribution: ['שם הפרויקט', 'קבלן מבצע', 'קטע עבודה', 'כביש/ מבנה', 'מספר רשימת תיוג', 'מס׳ שכבה', 'מס׳ שכבות מתוכנן', 'עובי השכבה', 'שטח השכבה', 'מחתך', 'היסט', 'לחתך', 'מקור החומר', 'תאור חומר המילוי', 'מיון החומר'],
  controlledCompaction: ['שם הפרויקט', 'קבלן מבצע', 'קטע עבודה', 'כביש/ מבנה', 'מספר רשימת תיוג', 'מס׳ שכבה', 'מס׳ שכבות מתוכנן', 'עובי השכבה', 'שטח השכבה', 'מחתך', 'היסט', 'לחתך', 'צד/ מיקום', 'מקור החומר', 'תאור חומר המילוי', 'מיון החומר'],
  standardCompaction: ['שם הפרויקט', 'קבלן מבצע', 'קטע עבודה', 'כביש/ מבנה', 'מספר רשימת תיוג', 'מס׳ שכבה', 'מס׳ שכבות מתוכנן', 'עובי השכבה', 'שטח השכבה', 'מחתך', 'היסט', 'לחתך', 'צד/ מיקום', 'מקור החומר', 'תאור חומר המילוי', 'מיון החומר'],
  asphaltWorks: ['שם הפרויקט', 'קבלן מבצע', 'קטע עבודה', 'כביש/ מבנה', 'מספר רשימת תיוג', 'מס׳ שכבה', 'מס׳ שכבות מתוכנן', 'עובי השכבה', 'שטח השכבה', 'מחתך', 'היסט', 'לחתך', 'צד/ מיקום', 'מקור החומר', 'תאור חומר המילוי', 'מיון החומר', 'מרחב', 'מפעל מייצר וסוג תערובת', 'שם קבוצת הפיזור', 'שם מנהל הפרויקט', 'מספר החוזה'],
  guardrails: ['שם הפרויקט', 'קבלן מבצע', 'קטע עבודה', 'כביש/ מבנה', 'מספר רשימת תיוג', 'מחתך', 'היסט', 'לחתך', 'מחתך נוסף', 'היסט נוסף', 'לחתך נוסף', 'היסט נוסף 2', 'מקור החומר', 'תיאור חומר/סוג חומר'],
  steelGuardrailsSupply: ['שם הפרוייקט', 'קבלן מבצע', 'קבלן משנה', 'קטע עבודה', 'סוג מעקה', 'אורך מעקות בגשר', 'מפעל ייצור המעקות', 'מפעל הגילוון', 'אורך מעקות במנת ייצור', 'מקור החומר', 'תיאור חומר/סוג חומר'],
  signage: ['מס׳', 'סוג', 'מבנה', 'חתכים / צד', 'תמרור', 'קבלן', 'מקור החומר', 'תיאור חומר/סוג חומר'],
  paving: ['פרויקט', 'קבלן', 'מס׳ רשימת תיוג', 'סוג אבן', 'ספק', 'חתכים', 'מקור החומר', 'תיאור חומר/סוג חומר'],
  curbstones: ['פרויקט', 'קבלן', 'מס׳ רשימת תיוג', 'סוג אבן', 'ספק', 'חתכים', 'מקור החומר', 'תיאור חומר/סוג חומר'],
  drainagePiping: ['שם הפרויקט', 'קבלן מבצע', 'קטע עבודה', 'כביש/ מבנה', 'מספר רשימת תיוג', 'מס׳ קו ניקוז', 'קוטר', 'יצרן', 'סוג הצינור', 'דרג', 'מחתך', 'הייסט', 'לחתך', 'הייסט סוף', 'IL כניסה', 'IL יציאה', 'אורך הקו', 'מקור החומר', 'תיאור חומר/סוג חומר'],
  jkWorks: ['שם הפרויקט', 'קבלן מבצע', 'קטע עבודה', 'כביש/ מבנה', 'מספר רשימת תיוג', 'מקור החומר', 'תיאור חומר/סוג חומר'],
  catsEyes: ['שם הפרויקט', 'קבלן מבצע', 'קטע עבודה', 'כביש/ מבנה', 'מספר רשימת תיוג', 'מקור החומר', 'תיאור חומר/סוג חומר'],
  concreteCasting: ['שם הפרויקט', 'קבלן מבצע', 'קטע עבודה', 'כביש/ מבנה', 'מספר רשימת תיוג', 'מקור החומר', 'תיאור חומר/סוג חומר'],
};

const checklistUsesStatus = (templateKey: ChecklistTemplateKey) => templateKey === 'paving' || templateKey === 'curbstones';
const checklistUsesStage = (templateKey: ChecklistTemplateKey) => templateKey === 'asphaltWorks';
const tableHeaderStyle: React.CSSProperties = { border: '1px solid #94a3b8', background: '#e2e8f0', padding: 8, fontWeight: 800, textAlign: 'center' };
const tableCellStyle: React.CSSProperties = { border: '1px solid #cbd5e1', padding: 6, verticalAlign: 'top' };

function TemplateChecklistEditor({ form, onDetailsChange, onItemChange, onSignatureChange, onRemoveItem }: { form: Omit<ChecklistRecord, 'id' | 'projectId' | 'savedAt'>; onDetailsChange: (key: string, value: string) => void; onItemChange: (id: string, field: keyof ChecklistItem, value: string | boolean) => void; onSignatureChange: (itemId: string, signatureIndex: number, field: keyof ChecklistItemSignature, value: string | boolean) => void; onRemoveItem: (id: string) => void; }) {
  const metaFields = checklistMetaFields[form.templateKey] ?? [];
  const details = form.details ?? {};
  const isStatusForm = checklistUsesStatus(form.templateKey);
  const hasStage = checklistUsesStage(form.templateKey);
  return (
    <div>
      <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 24, margin: '14px 0 18px' }}>{form.title}</div>
      {metaFields.length > 0 && <div style={{ ...styles.grid, marginBottom: 18 }}>{metaFields.map((field) => <Field key={field} label={field}><input style={styles.input} value={details[field] ?? ''} onChange={(e) => onDetailsChange(field, e.target.value)} /></Field>)}</div>}
      <div style={{ ...styles.grid, marginBottom: 18 }}><Field label="תוכנית ביצוע מס׳"><input style={styles.input} value={details['תוכנית ביצוע מס׳'] ?? ''} onChange={(e) => onDetailsChange('תוכנית ביצוע מס׳', e.target.value)} /></Field></div>
      <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: 14, background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isStatusForm ? 980 : 1120 }}>
          <thead>
            {!isStatusForm && <tr>{hasStage && <th rowSpan={2} style={tableHeaderStyle}>שלב</th>}<th rowSpan={2} style={tableHeaderStyle}>{form.templateKey === 'jkWorks' || form.templateKey === 'signage' ? 'פעילות' : 'תאור פעילות הבקרה'}</th><th colSpan={5} style={tableHeaderStyle}>אישור שלבי התהליך ע״י בקרת האיכות</th><th rowSpan={2} style={tableHeaderStyle}>פעולות</th></tr>}
            <tr>
              {isStatusForm && <th style={tableHeaderStyle}>נושא לבדיקה</th>}
              <th style={tableHeaderStyle}>{isStatusForm ? 'אחריות' : 'באחריות'}</th>
              {isStatusForm ? <th style={tableHeaderStyle}>תקין/לא תקין</th> : <th style={tableHeaderStyle}>שם</th>}
              <th style={tableHeaderStyle}>חתימות</th><th style={tableHeaderStyle}>תאריך</th><th style={tableHeaderStyle}>{isStatusForm ? 'הערות' : form.templateKey === 'asphaltWorks' ? '' : form.templateKey === 'jkWorks' || form.templateKey === 'signage' ? 'מס׳ תעודה' : 'מס׳ תוכנית/ תעודת בדיקה'}</th>{isStatusForm && <th style={tableHeaderStyle}>פעולות</th>}
            </tr>
          </thead>
          <tbody>{form.items.map((item) => { const sig = item.rowSignatures[0] ?? createDefaultRowSignatures()[0]; return <tr key={item.id}>{hasStage && <td style={tableCellStyle}><input style={styles.input} value={item.inspector} onChange={(e) => onItemChange(item.id, 'inspector', e.target.value)} /></td>}<td style={{ ...tableCellStyle, minWidth: 260 }}><textarea style={{ ...styles.textarea, minHeight: 54 }} value={item.description} onChange={(e) => onItemChange(item.id, 'description', e.target.value)} /></td><td style={tableCellStyle}><input style={styles.input} value={item.responsible} onChange={(e) => onItemChange(item.id, 'responsible', e.target.value)} /></td><td style={tableCellStyle}>{isStatusForm ? <select style={styles.input} value={item.status} onChange={(e) => onItemChange(item.id, 'status', e.target.value)}><option value="לא נבדק">לא נבדק</option><option value="תקין">תקין</option><option value="לא תקין">לא תקין</option><option value="לא רלוונטי">לא רלוונטי</option></select> : <input style={styles.input} value={sig.signerName} onChange={(e) => onSignatureChange(item.id, 0, 'signerName', e.target.value)} />}</td><td style={tableCellStyle}><input style={styles.input} value={sig.signature} onChange={(e) => onSignatureChange(item.id, 0, 'signature', e.target.value)} /></td><td style={tableCellStyle}><input type="date" style={styles.input} value={sig.signedAt || item.executionDate} onChange={(e) => { onSignatureChange(item.id, 0, 'signedAt', e.target.value); onItemChange(item.id, 'executionDate', e.target.value); }} /></td><td style={tableCellStyle}><input style={styles.input} value={item.notes} onChange={(e) => onItemChange(item.id, 'notes', e.target.value)} /></td><td style={tableCellStyle}><button style={styles.dangerBtn} onClick={() => onRemoveItem(item.id)}>מחק</button></td></tr>; })}</tbody>
        </table>
      </div>
    </div>
  );
}


const mergeTemplateDetails = (fields: string[], details?: Record<string, string>) => ({ ...emptyDetails(fields), ...(details ?? {}) });
const normalizeImages = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
const normalizeAttachments = (value: unknown): FileAttachment[] =>
  Array.isArray(value)
    ? value.filter((item): item is FileAttachment => Boolean(item) && typeof item === 'object' && typeof (item as FileAttachment).dataUrl === 'string' && typeof (item as FileAttachment).name === 'string')
    : [];

const readAttachmentsFromInput = (files: FileList | null, onDone: (attachments: FileAttachment[]) => void) => {
  if (!files?.length) return;
  Promise.all(
    Array.from(files)
      .filter((file) => file.type.startsWith('image/') || file.type === 'application/pdf')
      .map(
        (file) =>
          new Promise<FileAttachment>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ name: file.name, type: file.type, dataUrl: String(reader.result ?? ''), uploadedAt: nowLocal() });
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
  )
    .then((attachments) => onDone(attachments.filter((item) => item.dataUrl)))
    .catch(() => alert('אירעה שגיאה בהעלאת הקבצים'));
};

function AttachmentsField({ attachments, onChange }: { attachments: FileAttachment[]; onChange: (next: FileAttachment[]) => void }) {
  return (
    <div style={{ ...styles.card, ...styles.full }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>מסמכים מצורפים / תמונות</div>
      <input type="file" accept="image/*,application/pdf" multiple style={styles.input} onChange={(e) => readAttachmentsFromInput(e.target.files, (next) => onChange([...attachments, ...next]))} />
      {!!attachments.length && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginTop: 12 }}>
          {attachments.map((file, index) => (
            <div key={`${file.name}-${index}`} style={{ border: '1px solid #cbd5e1', borderRadius: 12, padding: 8, background: '#fff' }}>
              {file.type.startsWith('image/') ? <img src={file.dataUrl} alt={file.name} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }} /> : <div style={{ ...styles.emptyBox, padding: 14 }}>PDF</div>}
              <div style={{ fontWeight: 700, marginTop: 8, wordBreak: 'break-word' }}>{file.name}</div>
              <div style={styles.muted}>{file.uploadedAt}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <a style={{ ...styles.secondaryBtn, textDecoration: 'none', flex: 1, textAlign: 'center' }} href={file.dataUrl} download={file.name}>הורד</a>
                <button style={{ ...styles.dangerBtn, flex: 1 }} onClick={() => onChange(attachments.filter((_, fileIndex) => fileIndex !== index))}>מחק</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


const readImagesFromInput = (files: FileList | null, onDone: (images: string[]) => void) => {
  if (!files?.length) return;
  Promise.all(
    Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ''));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
  )
    .then((images) => onDone(images.filter(Boolean)))
    .catch(() => alert('אירעה שגיאה בהעלאת התמונות'));
};

function ImagesField({ images, onChange }: { images: string[]; onChange: (next: string[]) => void }) {
  return (
    <div style={{ ...styles.card, ...styles.full }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>תמונות מצורפות</div>
      <input
        type="file"
        accept="image/*"
        multiple
        style={styles.input}
        onChange={(e) => readImagesFromInput(e.target.files, (next) => onChange([...images, ...next]))}
      />
      {!!images.length && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginTop: 12 }}>
          {images.map((image, index) => (
            <div key={`${image.slice(0, 24)}-${index}`} style={{ border: '1px solid #cbd5e1', borderRadius: 12, padding: 8, background: '#fff' }}>
              <img src={image} alt={`תמונה ${index + 1}`} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 8 }} />
              <button style={{ ...styles.dangerBtn, width: '100%', marginTop: 8 }} onClick={() => onChange(images.filter((_, imageIndex) => imageIndex !== index))}>מחק תמונה</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateDetailsEditor({ fields, details, onChange }: { fields: string[]; details: Record<string, string>; onChange: (field: string, value: string) => void }) {
  return (
    <div style={styles.grid}>
      {fields.map((field) => (
        <Field key={field} label={field} full={field.includes('תיאור') || field.includes('פירוט') || field.includes('משתתפים') || field.includes('חומרים') || field.includes('כלים') || field.includes('פעולה מתקנת')}>
          {field.includes('תיאור') || field.includes('פירוט') || field.includes('משתתפים') || field.includes('חומרים') || field.includes('כלים') || field.includes('פעולה מתקנת') ? (
            <textarea style={styles.textarea} value={details[field] ?? ''} onChange={(e) => onChange(field, e.target.value)} />
          ) : (
            <input style={styles.input} value={details[field] ?? ''} onChange={(e) => onChange(field, e.target.value)} />
          )}
        </Field>
      ))}
    </div>
  );
}

function Field({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ ...styles.field, ...(full ? styles.full : {}) }}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.muted}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 900, marginTop: 8 }}>{value}</div>
    </div>
  );
}


function PreliminaryKeyValueFields<T extends Record<string, any>>({ data, fields, onChange }: { data: T; fields: { key: keyof T; label: string }[]; onChange: (key: keyof T, value: string) => void }) {
  return <div style={styles.grid}>{fields.map((field) => <Field key={String(field.key)} label={field.label}><input style={styles.input} value={String(data[field.key] ?? '')} onChange={(e) => onChange(field.key, e.target.value)} /></Field>)}</div>;
}

function PreliminaryDocumentsTable({ rows, onChange }: { rows: PreliminaryDocumentRow[]; onChange: (rows: PreliminaryDocumentRow[]) => void }) {
  const updateRow = (index: number, key: keyof PreliminaryDocumentRow, value: string) => onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>תעודות / מסמכים נוספים</div>
      <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: 14, background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead><tr><th style={tableHeaderStyle}>פרטים</th><th style={tableHeaderStyle}>קיים / לא קיים</th><th style={tableHeaderStyle}>מספר תעודה</th><th style={tableHeaderStyle}>תוקף</th><th style={tableHeaderStyle}>מסמכים מצורפים</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={`${row.details}-${index}`}><td style={tableCellStyle}><input style={styles.input} value={row.details} onChange={(e) => updateRow(index, 'details', e.target.value)} /></td><td style={tableCellStyle}><input style={styles.input} value={row.exists} onChange={(e) => updateRow(index, 'exists', e.target.value)} /></td><td style={tableCellStyle}><input style={styles.input} value={row.certificateNo} onChange={(e) => updateRow(index, 'certificateNo', e.target.value)} /></td><td style={tableCellStyle}><input style={styles.input} value={row.validUntil} onChange={(e) => updateRow(index, 'validUntil', e.target.value)} /></td><td style={tableCellStyle}><input style={styles.input} value={row.attachedDocuments} onChange={(e) => updateRow(index, 'attachedDocuments', e.target.value)} /></td></tr>)}</tbody>
        </table>
      </div>
      <button style={{ ...styles.secondaryBtn, marginTop: 10 }} onClick={() => onChange([...rows, emptyPreliminaryDocument('')])}>הוסף שורה</button>
    </div>
  );
}

function PreliminaryInspectionsTable({ rows, onChange }: { rows: PreliminaryInspectionRow[]; onChange: (rows: PreliminaryInspectionRow[]) => void }) {
  const updateRow = (index: number, key: keyof PreliminaryInspectionRow, value: string) => onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>סיכום בדיקה מקדימה</div>
      <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: 14, background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
          <thead><tr><th style={tableHeaderStyle}>סוג הבדיקה</th><th style={tableHeaderStyle}>דרישות מפרטיות</th><th style={tableHeaderStyle}>תוצאות בדיקה</th><th style={tableHeaderStyle}>מספר תעודה</th><th style={tableHeaderStyle}>עבר - נכשל</th><th style={tableHeaderStyle}>הערות</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={`${row.testType}-${index}`}><td style={tableCellStyle}><input style={styles.input} value={row.testType} onChange={(e) => updateRow(index, 'testType', e.target.value)} /></td><td style={tableCellStyle}><input style={styles.input} value={row.specificationRequirements} onChange={(e) => updateRow(index, 'specificationRequirements', e.target.value)} /></td><td style={tableCellStyle}><input style={styles.input} value={row.testResults} onChange={(e) => updateRow(index, 'testResults', e.target.value)} /></td><td style={tableCellStyle}><input style={styles.input} value={row.certificateNo} onChange={(e) => updateRow(index, 'certificateNo', e.target.value)} /></td><td style={tableCellStyle}><input style={styles.input} value={row.passFail} onChange={(e) => updateRow(index, 'passFail', e.target.value)} /></td><td style={tableCellStyle}><input style={styles.input} value={row.notes} onChange={(e) => updateRow(index, 'notes', e.target.value)} /></td></tr>)}</tbody>
        </table>
      </div>
      <button style={{ ...styles.secondaryBtn, marginTop: 10 }} onClick={() => onChange([...rows, emptyPreliminaryInspection('')])}>הוסף שורה</button>
    </div>
  );
}

function PreliminaryNotes({ qualityAssuranceNotes, qualityControlNotes, notes, onChange }: { qualityAssuranceNotes: string; qualityControlNotes: string; notes: string; onChange: (key: 'qualityAssuranceNotes' | 'qualityControlNotes' | 'notes', value: string) => void }) {
  return <div style={{ ...styles.grid, marginTop: 16 }}><Field label="הערות נוספות" full><textarea style={styles.textarea} value={notes} onChange={(e) => onChange('notes', e.target.value)} /></Field><Field label="הערות הבטחת איכות" full><textarea style={styles.textarea} value={qualityAssuranceNotes} onChange={(e) => onChange('qualityAssuranceNotes', e.target.value)} /></Field><Field label="הערות בקרת איכות" full><textarea style={styles.textarea} value={qualityControlNotes} onChange={(e) => onChange('qualityControlNotes', e.target.value)} /></Field></div>;
}

function Page() {
  const [section, setSection] = useState<Section>('home');
  const [preliminaryTab, setPreliminaryTab] = useState<PreliminaryTab>('suppliers');
  const [projects, setProjects] = useState<Project[]>(isSupabaseConfigured ? [] : defaultProjects);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(isSupabaseConfigured ? null : defaultProjects[0]?.id ?? null);
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
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [editingNonconformanceId, setEditingNonconformanceId] = useState<string | null>(null);
  const [editingTrialSectionId, setEditingTrialSectionId] = useState<string | null>(null);
  const [editingPreliminaryId, setEditingPreliminaryId] = useState<string | null>(null);
  const [recordsSearchTerm, setRecordsSearchTerm] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cloudEnabled, setCloudEnabled] = useState(isSupabaseConfigured);

  const loadPersistedData = (raw: string | null) => {
    if (!raw) {
      setProjects(defaultProjects);
      setCurrentProjectId(defaultProjects[0]?.id ?? null);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as PersistedData;
      setProjects(parsed.projects?.length ? parsed.projects : defaultProjects);
      setCurrentProjectId(parsed.currentProjectId ?? parsed.projects?.[0]?.id ?? defaultProjects[0]?.id ?? null);
      setSavedChecklists(
        (parsed.savedChecklists ?? []).map((item) => ({
          ...item,
          templateKey: normalizeChecklistTemplateKey(item.templateKey),
          items: normalizeChecklistItems(item.items),
          approval: normalizeApproval((item as any).approval),
        })),
      );
      setSavedNonconformances((parsed.savedNonconformances ?? []).map((item) => ({ ...item, details: mergeTemplateDetails(nonconformanceTemplateFields, (item as any).details), images: normalizeImages((item as any).images), approval: normalizeApproval((item as any).approval) })));
      setSavedTrialSections((parsed.savedTrialSections ?? []).map((item) => ({ ...item, details: mergeTemplateDetails(trialSectionTemplateFields, (item as any).details), images: normalizeImages((item as any).images), approval: normalizeApproval((item as any).approval) })));
      setSavedPreliminary((parsed.savedPreliminary ?? []).map((item) => ({ ...item, attachments: normalizeAttachments((item as any).attachments), approval: normalizeApproval((item as any).approval) }))); 
    } catch (error) {
      console.error('Failed to parse local data', error);
      setProjects(defaultProjects);
      setCurrentProjectId(defaultProjects[0]?.id ?? null);
    }
  };

  const loadFromCloudResults = (projectsRows: any[] | null, checklistRows: any[] | null, nonconRows: any[] | null, trialRows: any[] | null, preliminaryRows: any[] | null) => {
    const mappedProjects: Project[] = (projectsRows ?? []).map((row) => ({
      id: row.id,
      name: row.name ?? '',
      description: row.description ?? '',
      manager: row.manager ?? '',
      isActive: Boolean(row.is_active),
      createdAt: row.created_at ? new Date(row.created_at).toLocaleString('he-IL') : '',
    }));
    const nextProjects = mappedProjects.length ? mappedProjects : defaultProjects;
    setProjects(nextProjects);
    const storedProjectId = readLocalCurrentProjectId();
    const active = (storedProjectId ? nextProjects.find((p) => p.id === storedProjectId) : undefined) ?? nextProjects.find((p) => p.isActive) ?? nextProjects[0] ?? null;
    setCurrentProjectId(active?.id ?? null);
    setSavedChecklists(
      (checklistRows ?? []).map((row) => ({
        id: row.id,
        projectId: row.project_id,
        templateKey: normalizeChecklistTemplateKey(row.template_key),
        title: row.title ?? '',
        category: row.category ?? '',
        location: row.location ?? '',
        date: row.date ?? '',
        contractor: row.contractor ?? '',
        notes: row.notes ?? '',
        details: row.details ?? {},
        items: normalizeChecklistItems(row.items),
        approval: normalizeApproval(row.approval),
        savedAt: row.saved_at ? new Date(row.saved_at).toLocaleString('he-IL') : '',
      })),
    );
    setSavedNonconformances(
      (nonconRows ?? []).map((row) => ({
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
        details: mergeTemplateDetails(nonconformanceTemplateFields, row.details ?? {}),
        images: normalizeImages(row.images),
        approval: normalizeApproval(row.approval),
        savedAt: row.saved_at ? new Date(row.saved_at).toLocaleString('he-IL') : '',
      })),
    );
    setSavedTrialSections(
      (trialRows ?? []).map((row) => ({
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
        details: mergeTemplateDetails(trialSectionTemplateFields, row.details ?? {}),
        images: normalizeImages(row.images),
        approval: normalizeApproval(row.approval),
        savedAt: row.saved_at ? new Date(row.saved_at).toLocaleString('he-IL') : '',
      })),
    );
    setSavedPreliminary(
      (preliminaryRows ?? []).map((row) => ({
        id: row.id,
        projectId: row.project_id,
        subtype: row.subtype,
        title: row.title ?? '',
        date: row.date ?? '',
        status: row.status ?? 'טיוטה',
        supplier: row.supplier ?? undefined,
        subcontractor: row.subcontractor ?? undefined,
        material: row.material ?? undefined,
        attachments: normalizeAttachments(row.attachments),
        approval: normalizeApproval(row.approval),
        savedAt: row.saved_at ? new Date(row.saved_at).toLocaleString('he-IL') : '',
      })),
    );
  };

  useEffect(() => {
    const loadAll = async () => {
      if (!cloudEnabled) {
        loadPersistedData(window.localStorage.getItem(STORAGE_KEY));
        setLoaded(true);
        return;
      }
      try {
        const [projectsRes, checklistsRes, nonconRes, trialsRes, prelimRes] = await Promise.all([
          selectTable('projects', 'created_at'),
          selectTable('checklists', 'saved_at'),
          selectTable('nonconformances', 'saved_at'),
          selectTable('trial_sections', 'saved_at'),
          selectTable('preliminary_records', 'saved_at'),
        ]);
        const fatal = [projectsRes.error, checklistsRes.error, nonconRes.error, trialsRes.error, prelimRes.error].filter((item) => item && !shouldIgnoreCloudError(item));
        if (fatal.length) throw fatal[0];
        loadFromCloudResults(projectsRes.data, checklistsRes.data, nonconRes.data, trialsRes.data, prelimRes.data);
      } catch (error) {
        console.error(error);
        setCloudEnabled(false);
        loadPersistedData(window.localStorage.getItem(STORAGE_KEY));
      } finally {
        setLoaded(true);
      }
    };
    void loadAll();
  }, [cloudEnabled]);

  useEffect(() => {
    if (!loaded) return;
    const payload: PersistedData = { projects, currentProjectId, savedChecklists, savedNonconformances, savedTrialSections, savedPreliminary };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [projects, currentProjectId, savedChecklists, savedNonconformances, savedTrialSections, savedPreliminary, loaded]);

  useEffect(() => {
    if (loaded) writeLocalCurrentProjectId(currentProjectId);
  }, [currentProjectId, loaded]);

  const refreshCloudData = async () => {
    if (!cloudEnabled) return;
    const [projectsRes, checklistsRes, nonconRes, trialsRes, prelimRes] = await Promise.all([
      selectTable('projects', 'created_at'),
      selectTable('checklists', 'saved_at'),
      selectTable('nonconformances', 'saved_at'),
      selectTable('trial_sections', 'saved_at'),
      selectTable('preliminary_records', 'saved_at'),
    ]);
    const fatal = [projectsRes.error, checklistsRes.error, nonconRes.error, trialsRes.error, prelimRes.error].filter((item) => item && !shouldIgnoreCloudError(item));
    if (fatal.length) throw fatal[0];
    loadFromCloudResults(projectsRes.data, checklistsRes.data, nonconRes.data, trialsRes.data, prelimRes.data);
  };

  const withSaving = async (action: () => Promise<void>) => {
    try {
      setIsSaving(true);
      await action();
    } catch (error) {
      console.error(error);
      alert(errorText(error) || 'אירעה שגיאה בשמירה');
      if (cloudEnabled) {
        try {
          await refreshCloudData();
        } catch (refreshError) {
          console.error(refreshError);
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const currentProject = useMemo(() => projects.find((p) => p.id === currentProjectId) ?? null, [projects, currentProjectId]);
  const projectName = !loaded ? 'טוען...' : currentProject?.name ?? 'לא נבחר פרויקט';
  const normalizedSearchTerm = recordsSearchTerm.trim().toLowerCase();
  const projectChecklists = useMemo(
    () =>
      savedChecklists
        .filter((item) => item.projectId === currentProjectId)
        .filter((item) => !normalizedSearchTerm || [item.title, item.category, item.location, item.contractor].join(' ').toLowerCase().includes(normalizedSearchTerm)),
    [savedChecklists, currentProjectId, normalizedSearchTerm],
  );
  const projectNonconformances = useMemo(
    () =>
      savedNonconformances
        .filter((item) => item.projectId === currentProjectId)
        .filter((item) => !normalizedSearchTerm || [item.title, item.location, item.description, item.status].join(' ').toLowerCase().includes(normalizedSearchTerm)),
    [savedNonconformances, currentProjectId, normalizedSearchTerm],
  );
  const projectTrialSections = useMemo(
    () =>
      savedTrialSections
        .filter((item) => item.projectId === currentProjectId)
        .filter((item) => !normalizedSearchTerm || [item.title, item.location, item.spec, item.result].join(' ').toLowerCase().includes(normalizedSearchTerm)),
    [savedTrialSections, currentProjectId, normalizedSearchTerm],
  );
  const projectPreliminary = useMemo(
    () =>
      savedPreliminary
        .filter((item) => item.projectId === currentProjectId)
        .filter((item) => !normalizedSearchTerm || [item.title, item.subtype, item.status].join(' ').toLowerCase().includes(normalizedSearchTerm)),
    [savedPreliminary, currentProjectId, normalizedSearchTerm],
  );

  const checklistTemplateLabel = (key: ChecklistTemplateKey | string | undefined) => checklistTemplates[normalizeChecklistTemplateKey(key)]?.label ?? 'רשימת תיוג';

  const resetChecklistForm = (templateKey: ChecklistTemplateKey = checklistForm.templateKey) => {
    setEditingChecklistId(null);
    setChecklistForm(createDefaultChecklist(templateKey));
  };
  const resetNonconformanceEditor = () => {
    setEditingNonconformanceId(null);
    setNonconformanceForm(createDefaultNonconformance());
  };
  const resetTrialSectionEditor = () => {
    setEditingTrialSectionId(null);
    setTrialSectionForm(createDefaultTrialSection());
  };
  const resetPreliminaryEditor = () => {
    setEditingPreliminaryId(null);
    if (preliminaryTab === 'suppliers') setSupplierPreliminaryForm(createDefaultPreliminary('suppliers'));
    if (preliminaryTab === 'subcontractors') setSubcontractorPreliminaryForm(createDefaultPreliminary('subcontractors'));
    if (preliminaryTab === 'materials') setMaterialPreliminaryForm(createDefaultPreliminary('materials'));
  };

  const addProject = async () => {
    if (!newProjectName.trim()) {
      alert('יש להזין שם פרויקט');
      return;
    }
    const id = crypto.randomUUID();
    const project: Project = { id, name: newProjectName.trim(), description: newProjectDescription.trim(), manager: newProjectManager.trim(), isActive: true, createdAt: nowLocal() };
    await withSaving(async () => {
      if (cloudEnabled) {
        await supabase.from('projects').update({ is_active: false }).neq('id', id);
        const result = await supabase.from('projects').insert({ id, name: project.name, description: project.description, manager: project.manager, is_active: true, created_at: nowIso() });
        if (result.error) throw result.error;
        await refreshCloudData();
      } else {
        setProjects((prev) => [...prev.map((p) => ({ ...p, isActive: false })), project]);
        setCurrentProjectId(id);
      }
    });
    setNewProjectName('');
    setNewProjectDescription('');
    setNewProjectManager('');
  };

  const renameProject = async (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    const nextName = window.prompt('שם פרויקט חדש', project.name);
    if (!nextName?.trim()) return;
    await withSaving(async () => {
      if (cloudEnabled) {
        const result = await supabase.from('projects').update({ name: nextName.trim() }).eq('id', projectId);
        if (result.error) throw result.error;
        await refreshCloudData();
      } else {
        setProjects((prev) => prev.map((item) => (item.id === projectId ? { ...item, name: nextName.trim() } : item)));
      }
    });
  };

  const updateProjectMeta = async (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    const description = window.prompt('תיאור פרויקט', project.description ?? '');
    if (description === null) return;
    const manager = window.prompt('מנהל פרויקט', project.manager ?? '');
    if (manager === null) return;
    await withSaving(async () => {
      if (cloudEnabled) {
        const result = await supabase.from('projects').update({ description: description.trim(), manager: manager.trim() }).eq('id', projectId);
        if (result.error) throw result.error;
        await refreshCloudData();
      } else {
        setProjects((prev) => prev.map((item) => (item.id === projectId ? { ...item, description: description.trim(), manager: manager.trim() } : item)));
      }
    });
  };

  const setActiveProject = async (projectId: string) => {
    await withSaving(async () => {
      if (cloudEnabled) {
        await supabase.from('projects').update({ is_active: false }).neq('id', projectId);
        const result = await supabase.from('projects').update({ is_active: true }).eq('id', projectId);
        if (result.error) throw result.error;
        await refreshCloudData();
      } else {
        setProjects((prev) => prev.map((item) => ({ ...item, isActive: item.id === projectId })));
        setCurrentProjectId(projectId);
      }
    });
  };

  const deleteProject = async (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project || !window.confirm(`למחוק את הפרויקט "${project.name}"?`)) return;
    await withSaving(async () => {
      if (cloudEnabled) {
        await supabase.from('checklists').delete().eq('project_id', projectId);
        await supabase.from('nonconformances').delete().eq('project_id', projectId);
        await supabase.from('trial_sections').delete().eq('project_id', projectId);
        await supabase.from('preliminary_records').delete().eq('project_id', projectId);
        const result = await supabase.from('projects').delete().eq('id', projectId);
        if (result.error) throw result.error;
        await refreshCloudData();
      } else {
        const nextProjects = projects.filter((item) => item.id !== projectId);
        setProjects(nextProjects.map((item, index) => ({ ...item, isActive: index === 0 })));
        setCurrentProjectId(nextProjects[0]?.id ?? null);
        setSavedChecklists((prev) => prev.filter((item) => item.projectId !== projectId));
        setSavedNonconformances((prev) => prev.filter((item) => item.projectId !== projectId));
        setSavedTrialSections((prev) => prev.filter((item) => item.projectId !== projectId));
        setSavedPreliminary((prev) => prev.filter((item) => item.projectId !== projectId));
      }
    });
  };

  const applyChecklistTemplate = (templateKey: ChecklistTemplateKey) => {
    setChecklistForm((prev) => ({
      ...createDefaultChecklist(templateKey),
      location: prev.location,
      date: prev.date,
      contractor: prev.contractor,
      notes: prev.notes,
      approval: prev.approval,
    }));
  };

  const updateChecklistDetails = (key: string, value: string) => {
    setChecklistForm((prev) => ({ ...prev, details: { ...(prev.details ?? {}), [key]: value } }));
  };

  const updateChecklistItem = (id: string, field: keyof ChecklistItem, value: string | boolean) => {
    setChecklistForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== id) return item;
        if (field === 'notApplicable') {
          const nextNotApplicable = Boolean(value);
          return {
            ...item,
            notApplicable: nextNotApplicable,
            status: nextNotApplicable ? 'לא רלוונטי' : item.status === 'לא רלוונטי' ? 'לא נבדק' : item.status,
          };
        }
        return { ...item, [field]: value } as ChecklistItem;
      }),
    }));
  };

  const updateChecklistItemSignature = (itemId: string, signatureIndex: number, field: keyof ChecklistItemSignature, value: string | boolean) => {
    setChecklistForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id !== itemId
          ? item
          : {
              ...item,
              rowSignatures: item.rowSignatures.map((sig, index) => (index === signatureIndex ? { ...sig, [field]: value } : sig)),
            },
      ),
    }));
  };

  const addChecklistItem = () => setChecklistForm((prev) => ({ ...prev, items: [...prev.items, emptyChecklistItem(crypto.randomUUID())] }));
  const removeChecklistItem = (id: string) => setChecklistForm((prev) => ({ ...prev, items: prev.items.length <= 1 ? prev.items : prev.items.filter((item) => item.id !== id) }));

  const saveChecklist = async () => {
    if (!currentProjectId) return alert('יש לבחור פרויקט');
    if (!checklistForm.title.trim()) return alert('יש להזין שם רשימת תיוג');
    const rowValidation = validateChecklistRows(checklistForm.items);
    if (rowValidation) return alert(rowValidation);
    const id = editingChecklistId ?? crypto.randomUUID();
    const record: ChecklistRecord = {
      id,
      projectId: currentProjectId,
      ...checklistForm,
      items: normalizeChecklistItems(checklistForm.items),
      approval: normalizeApproval(checklistForm.approval),
      savedAt: nowLocal(),
    };
    await withSaving(async () => {
      if (cloudEnabled) {
        const payload = {
          id: record.id,
          project_id: record.projectId,
          template_key: record.templateKey,
          title: record.title,
          category: record.category,
          location: record.location,
          date: record.date,
          contractor: record.contractor,
          notes: record.notes,
          details: record.details ?? {},
          items: record.items,
          approval: record.approval,
          saved_at: nowIso(),
        };
        await saveWithFallback('checklists', payload, editingChecklistId ? 'update' : 'insert', editingChecklistId ?? undefined);
        await refreshCloudData();
      } else {
        setSavedChecklists((prev) => (editingChecklistId ? prev.map((item) => (item.id === editingChecklistId ? record : item)) : [record, ...prev]));
      }
    });
    resetChecklistForm();
    alert('רשימת התיוג נשמרה');
  };

  const loadChecklist = (record: ChecklistRecord) => {
    setSection('checklists');
    setEditingChecklistId(record.id);
    setChecklistForm({
      templateKey: record.templateKey,
      title: record.title,
      category: record.category,
      location: record.location,
      date: record.date,
      contractor: record.contractor,
      notes: record.notes,
      items: normalizeChecklistItems(record.items),
      approval: normalizeApproval(record.approval),
    });
  };

  const deleteChecklist = async (id: string) => {
    await withSaving(async () => {
      if (cloudEnabled) {
        const result = await supabase.from('checklists').delete().eq('id', id);
        if (result.error) throw result.error;
        await refreshCloudData();
      } else {
        setSavedChecklists((prev) => prev.filter((item) => item.id !== id));
      }
    });
  };

  const saveNonconformance = async () => {
    if (!currentProjectId) return alert('יש לבחור פרויקט');
    if (!nonconformanceForm.title.trim()) return alert('יש להזין כותרת לאי התאמה');
    const id = editingNonconformanceId ?? crypto.randomUUID();
    const details = mergeTemplateDetails(nonconformanceTemplateFields, nonconformanceForm.details);
    const record: NonconformanceRecord = {
      id,
      projectId: currentProjectId,
      ...nonconformanceForm,
      title: details['אי התאמה מס׳'] ? `טופס אי התאמה ${details['אי התאמה מס׳']}` : 'טופס אי התאמה',
      location: [details['מבנה'], details['אלמנט'], details['תת אלמנט']].filter(Boolean).join(' / '),
      date: details['תאריך הפתיחה'] || nonconformanceForm.date,
      raisedBy: details['נפתח - שם'] || nonconformanceForm.raisedBy,
      description: details['תיאור אי ההתאמה'] || nonconformanceForm.description,
      actionRequired: details['טיפול נדרש'] || nonconformanceForm.actionRequired,
      notes: details['הערות'] || nonconformanceForm.notes,
      details,
      images: normalizeImages(nonconformanceForm.images),
      approval: normalizeApproval(nonconformanceForm.approval),
      savedAt: nowLocal(),
    };
    await withSaving(async () => {
      if (cloudEnabled) {
        const payload = {
          id: record.id,
          project_id: record.projectId,
          title: record.title,
          location: record.location,
          date: record.date,
          raised_by: record.raisedBy,
          severity: record.severity,
          status: record.status,
          description: record.description,
          action_required: record.actionRequired,
          notes: record.notes,
          details: record.details,
          images: record.images,
          approval: record.approval,
          saved_at: nowIso(),
        };
        await saveWithFallback('nonconformances', payload, editingNonconformanceId ? 'update' : 'insert', editingNonconformanceId ?? undefined);
        await refreshCloudData();
      } else {
        setSavedNonconformances((prev) => (editingNonconformanceId ? prev.map((item) => (item.id === editingNonconformanceId ? record : item)) : [record, ...prev]));
      }
    });
    resetNonconformanceEditor();
  };

  const loadNonconformance = (record: NonconformanceRecord) => {
    setSection('nonconformances');
    setEditingNonconformanceId(record.id);
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
      details: mergeTemplateDetails(nonconformanceTemplateFields, record.details),
      images: normalizeImages(record.images),
      approval: normalizeApproval(record.approval),
    });
  };

  const deleteNonconformance = async (id: string) => {
    await withSaving(async () => {
      if (cloudEnabled) {
        const result = await supabase.from('nonconformances').delete().eq('id', id);
        if (result.error) throw result.error;
        await refreshCloudData();
      } else {
        setSavedNonconformances((prev) => prev.filter((item) => item.id !== id));
      }
    });
  };

  const saveTrialSection = async () => {
    if (!currentProjectId) return alert('יש לבחור פרויקט');
    if (!trialSectionForm.title.trim()) return alert('יש להזין שם לקטע ניסוי');
    const id = editingTrialSectionId ?? crypto.randomUUID();
    const details = mergeTemplateDetails(trialSectionTemplateFields, trialSectionForm.details);
    const record: TrialSectionRecord = {
      id,
      projectId: currentProjectId,
      ...trialSectionForm,
      title: details['קטע מס׳'] ? `דוח קטע ניסוי ${details['קטע מס׳']}` : 'דוח קטע ניסוי',
      location: [details['שם האלמנט'], details['תת אלמנט'], details['מחתך עד חתך/צד']].filter(Boolean).join(' / '),
      date: details['תאריך ביצוע'] || trialSectionForm.date,
      spec: details['הוכחת היכולת לפעולה מסוג'] || trialSectionForm.spec,
      result: details['מסקנות קטע ניסוי'] || trialSectionForm.result,
      approvedBy: trialSectionForm.approvedBy,
      notes: details['פעולה מתקנת (במידה ונדרשת)'] || trialSectionForm.notes,
      details,
      images: normalizeImages(trialSectionForm.images),
      approval: normalizeApproval(trialSectionForm.approval),
      savedAt: nowLocal(),
    };
    await withSaving(async () => {
      if (cloudEnabled) {
        const payload = {
          id: record.id,
          project_id: record.projectId,
          title: record.title,
          location: record.location,
          date: record.date,
          spec: record.spec,
          result: record.result,
          approved_by: record.approvedBy,
          status: record.status,
          notes: record.notes,
          details: record.details,
          images: record.images,
          approval: record.approval,
          saved_at: nowIso(),
        };
        await saveWithFallback('trial_sections', payload, editingTrialSectionId ? 'update' : 'insert', editingTrialSectionId ?? undefined);
        await refreshCloudData();
      } else {
        setSavedTrialSections((prev) => (editingTrialSectionId ? prev.map((item) => (item.id === editingTrialSectionId ? record : item)) : [record, ...prev]));
      }
    });
    resetTrialSectionEditor();
  };

  const loadTrialSection = (record: TrialSectionRecord) => {
    setSection('trialSections');
    setEditingTrialSectionId(record.id);
    setTrialSectionForm({
      title: record.title,
      location: record.location,
      date: record.date,
      spec: record.spec,
      result: record.result,
      approvedBy: record.approvedBy,
      status: record.status,
      notes: record.notes,
      details: mergeTemplateDetails(trialSectionTemplateFields, record.details),
      images: normalizeImages(record.images),
      approval: normalizeApproval(record.approval),
    });
  };

  const deleteTrialSection = async (id: string) => {
    await withSaving(async () => {
      if (cloudEnabled) {
        const result = await supabase.from('trial_sections').delete().eq('id', id);
        if (result.error) throw result.error;
        await refreshCloudData();
      } else {
        setSavedTrialSections((prev) => prev.filter((item) => item.id !== id));
      }
    });
  };

  const savePreliminary = async (subtype: PreliminaryTab) => {
    if (!currentProjectId) return alert('יש לבחור פרויקט');
    const form = subtype === 'suppliers' ? supplierPreliminaryForm : subtype === 'subcontractors' ? subcontractorPreliminaryForm : materialPreliminaryForm;
    if (!form.title.trim()) return alert('יש להזין כותרת');
    const id = editingPreliminaryId ?? crypto.randomUUID();
    const record: PreliminaryRecord = { id, projectId: currentProjectId, ...form, approval: normalizeApproval(form.approval), savedAt: nowLocal() };
    await withSaving(async () => {
      if (cloudEnabled) {
        const payload = {
          id: record.id,
          project_id: record.projectId,
          subtype: record.subtype,
          title: record.title,
          date: record.date,
          status: record.status,
          supplier: record.supplier ?? null,
          subcontractor: record.subcontractor ?? null,
          material: record.material ?? null,
          attachments: record.attachments,
          approval: record.approval,
          saved_at: nowIso(),
        };
        await saveWithFallback('preliminary_records', payload, editingPreliminaryId ? 'update' : 'insert', editingPreliminaryId ?? undefined);
        await refreshCloudData();
      } else {
        setSavedPreliminary((prev) => (editingPreliminaryId ? prev.map((item) => (item.id === editingPreliminaryId ? record : item)) : [record, ...prev]));
      }
    });
    resetPreliminaryEditor();
  };

  const loadPreliminary = (record: PreliminaryRecord) => {
    setSection('preliminary');
    setPreliminaryTab(record.subtype);
    setEditingPreliminaryId(record.id);
    if (record.subtype === 'suppliers') {
      setSupplierPreliminaryForm({ subtype: 'suppliers', title: record.title, date: record.date, status: record.status, attachments: normalizeAttachments(record.attachments), supplier: record.supplier ?? createDefaultPreliminary('suppliers').supplier, approval: normalizeApproval(record.approval) });
    }
    if (record.subtype === 'subcontractors') {
      setSubcontractorPreliminaryForm({ subtype: 'subcontractors', title: record.title, date: record.date, status: record.status, attachments: normalizeAttachments(record.attachments), subcontractor: record.subcontractor ?? createDefaultPreliminary('subcontractors').subcontractor, approval: normalizeApproval(record.approval) });
    }
    if (record.subtype === 'materials') {
      setMaterialPreliminaryForm({ subtype: 'materials', title: record.title, date: record.date, status: record.status, attachments: normalizeAttachments(record.attachments), material: record.material ?? createDefaultPreliminary('materials').material, approval: normalizeApproval(record.approval) });
    }
  };

  const deletePreliminary = async (id: string) => {
    await withSaving(async () => {
      if (cloudEnabled) {
        const result = await supabase.from('preliminary_records').delete().eq('id', id);
        if (result.error) throw result.error;
        await refreshCloudData();
      } else {
        setSavedPreliminary((prev) => prev.filter((item) => item.id !== id));
      }
    });
  };

  const guardedBody = !currentProject && section !== 'home' && section !== 'projects' ? <div style={styles.emptyBox}>יש לבחור פרויקט לפני עבודה במסך זה.</div> : null;

  const homeModules = [
    { key: 'projects' as Section, title: 'פרויקטים', count: projects.length, icon: '📁' },
    { key: 'checklists' as Section, title: 'רשימות תיוג', count: projectChecklists.length, icon: '📋' },
    { key: 'nonconformances' as Section, title: 'אי תאמות', count: projectNonconformances.length, icon: '⚠️' },
    { key: 'trialSections' as Section, title: 'קטעי ניסוי', count: projectTrialSections.length, icon: '🧪' },
    { key: 'preliminary' as Section, title: 'בקרה מקדימה', count: projectPreliminary.length, icon: '🗂️' },
  ];

  return (
    <div style={styles.page} dir="rtl">
      <header style={styles.header}>
        <div style={styles.headerCard}>
          <div style={{ fontWeight: 900, fontSize: 26 }}>Y.K QUALITY</div>
          <div style={styles.muted}>QA / QC · סימון לא רלוונטי · Word/Excel/PDF</div>
        </div>
        <div style={styles.headerCard}>
          <div style={{ fontWeight: 800 }}>פרויקט פעיל</div>
          <div style={{ marginTop: 8 }}>{projectName}</div>
          {isSaving && <div style={{ ...styles.muted, marginTop: 8 }}>שומר נתונים...</div>}
          {!cloudEnabled && <div style={{ ...styles.muted, marginTop: 8 }}>מצב מקומי בלבד</div>}
        </div>
      </header>

      <div style={styles.navRow}>
        {[
          ['home', 'דף בית'],
          ['projects', 'פרויקטים'],
          ['checklists', 'רשימות תיוג'],
          ['nonconformances', 'אי תאמות'],
          ['trialSections', 'קטעי ניסוי'],
          ['preliminary', 'בקרה מקדימה'],
        ].map(([key, label]) => (
          <button key={key} style={{ ...styles.navBtn, background: section === key ? '#0f172a' : '#fff', color: section === key ? '#fff' : '#0f172a' }} onClick={() => setSection(key as Section)}>
            {label}
          </button>
        ))}
      </div>

      <div style={styles.layout}>
        <main style={styles.mainCard}>
          {section === 'home' && (
            <div>
              <h2 style={styles.sectionTitle}>דף בית</h2>
              <div style={styles.statGrid}>
                <StatCard title="פרויקטים" value={projects.length} />
                <StatCard title="רשימות תיוג" value={projectChecklists.length} />
                <StatCard title="אי תאמות" value={projectNonconformances.length} />
                <StatCard title="קטעי ניסוי" value={projectTrialSections.length} />
              </div>
              <div style={{ ...styles.card, marginTop: 18 }}>
                <div style={{ fontWeight: 800, marginBottom: 12 }}>מודולים ראשיים</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12 }}>
                  {homeModules.map((module) => (
                    <button key={module.key} style={{ ...styles.card, cursor: 'pointer', textAlign: 'right' }} onClick={() => setSection(module.key)}>
                      <div style={{ fontSize: 24 }}>{module.icon}</div>
                      <div style={{ fontWeight: 800, marginTop: 6 }}>{module.title}</div>
                      <div style={styles.muted}>רשומות: {module.count}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {section === 'projects' && (
            <div>
              <h2 style={styles.sectionTitle}>פרויקטים</h2>
              <div style={styles.grid}>
                <Field label="שם פרויקט">
                  <input style={styles.input} value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
                </Field>
                <Field label="מנהל פרויקט">
                  <input style={styles.input} value={newProjectManager} onChange={(e) => setNewProjectManager(e.target.value)} />
                </Field>
                <Field label="תיאור" full>
                  <textarea style={styles.textarea} value={newProjectDescription} onChange={(e) => setNewProjectDescription(e.target.value)} />
                </Field>
              </div>
              <div style={styles.buttonRow}>
                <button style={styles.primaryBtn} onClick={() => void addProject()}>הוסף פרויקט</button>
              </div>
              <div style={styles.divider} />
              {projects.map((project) => (
                <div key={project.id} style={styles.card}>
                  <div style={styles.rowHeader}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{project.name}</div>
                      <div style={styles.muted}>{project.description || '-'}</div>
                    </div>
                    {project.id === currentProjectId && <span style={styles.badge}>פעיל</span>}
                  </div>
                  <div style={styles.muted}>מנהל: {project.manager || '-'}</div>
                  <div style={styles.muted}>נוצר: {project.createdAt}</div>
                  <div style={styles.buttonRow}>
                    <button style={styles.secondaryBtn} onClick={() => void setActiveProject(project.id)}>בחר</button>
                    <button style={styles.secondaryBtn} onClick={() => void renameProject(project.id)}>ערוך שם</button>
                    <button style={styles.secondaryBtn} onClick={() => void updateProjectMeta(project.id)}>ערוך פרטים</button>
                    <button style={styles.dangerBtn} onClick={() => void deleteProject(project.id)}>מחק</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {section === 'checklists' && (
            <div>
              <h2 style={styles.sectionTitle}>רשימות תיוג</h2>
              {guardedBody || (
                <>
                  <div style={styles.card}>
                    <div style={{ fontWeight: 800, marginBottom: 12 }}>בחירת תבנית</div>
                    <div style={styles.buttonRow}>
                      {(Object.keys(checklistTemplates) as ChecklistTemplateKey[]).map((templateKey) => (
                        <button key={templateKey} style={{ ...styles.secondaryBtn, background: checklistForm.templateKey === templateKey ? '#0f172a' : '#fff', color: checklistForm.templateKey === templateKey ? '#fff' : '#0f172a' }} onClick={() => applyChecklistTemplate(templateKey)}>
                          {checklistTemplates[templateKey].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <TemplateChecklistEditor
                    form={checklistForm}
                    onDetailsChange={updateChecklistDetails}
                    onItemChange={updateChecklistItem}
                    onSignatureChange={updateChecklistItemSignature}
                    onRemoveItem={removeChecklistItem}
                  />

                  <div style={styles.buttonRow}>
                    <button style={styles.secondaryBtn} onClick={addChecklistItem}>הוסף שורה</button>
                    <button style={styles.primaryBtn} onClick={() => void saveChecklist()}>{editingChecklistId ? 'עדכן רשימת תיוג' : 'שמור רשימת תיוג'}</button>
                    <button style={styles.secondaryBtn} onClick={() => resetChecklistForm()}>נקה / בטל עריכה</button>
                    <button style={styles.secondaryBtn} onClick={() => exportChecklistToWord({ id: 'preview', projectId: currentProjectId ?? '', ...checklistForm, items: normalizeChecklistItems(checklistForm.items), approval: normalizeApproval(checklistForm.approval), savedAt: nowLocal() }, projectName)}>Word</button>
                    <button style={styles.secondaryBtn} onClick={() => exportChecklistToExcel({ id: 'preview', projectId: currentProjectId ?? '', ...checklistForm, items: normalizeChecklistItems(checklistForm.items), approval: normalizeApproval(checklistForm.approval), savedAt: nowLocal() }, projectName)}>Excel</button>
                    <button style={styles.secondaryBtn} onClick={() => exportChecklistToPdf({ id: 'preview', projectId: currentProjectId ?? '', ...checklistForm, items: normalizeChecklistItems(checklistForm.items), approval: normalizeApproval(checklistForm.approval), savedAt: nowLocal() }, projectName)}>PDF</button>
                  </div>
                </>
              )}
            </div>
          )}

          {section === 'nonconformances' && (
            <div>
              <h2 style={styles.sectionTitle}>אי תאמות</h2>
              {guardedBody || (
                <>
                  <div style={styles.card}>
                    <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>טופס אי התאמה</div>
                    <TemplateDetailsEditor fields={nonconformanceTemplateFields} details={nonconformanceForm.details} onChange={(field, value) => setNonconformanceForm((prev) => ({ ...prev, details: { ...prev.details, [field]: value } }))} />
                    <div style={{ ...styles.grid, marginTop: 14 }}>
                      <Field label="חומרה"><select style={styles.input} value={nonconformanceForm.severity} onChange={(e) => setNonconformanceForm((prev) => ({ ...prev, severity: e.target.value as Severity }))}><option value="נמוכה">נמוכה</option><option value="בינונית">בינונית</option><option value="גבוהה">גבוהה</option></select></Field>
                      <Field label="סטטוס"><select style={styles.input} value={nonconformanceForm.status} onChange={(e) => setNonconformanceForm((prev) => ({ ...prev, status: e.target.value as NonconformanceStatus }))}><option value="פתוח">פתוח</option><option value="בטיפול">בטיפול</option><option value="נסגר">נסגר</option></select></Field>
                    </div>
                  </div>
                  <ImagesField images={nonconformanceForm.images} onChange={(images) => setNonconformanceForm((prev) => ({ ...prev, images }))} />
                  <div style={styles.buttonRow}>
                    <button style={styles.primaryBtn} onClick={() => void saveNonconformance()}>{editingNonconformanceId ? 'עדכן אי התאמה' : 'שמור אי התאמה'}</button>
                    <button style={styles.secondaryBtn} onClick={resetNonconformanceEditor}>נקה / בטל עריכה</button>
                  </div>
                </>
              )}
            </div>
          )}

          {section === 'trialSections' && (
            <div>
              <h2 style={styles.sectionTitle}>קטעי ניסוי</h2>
              {guardedBody || (
                <>
                  <div style={styles.card}>
                    <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>דוח קטע ניסוי</div>
                    <TemplateDetailsEditor fields={trialSectionTemplateFields} details={trialSectionForm.details} onChange={(field, value) => setTrialSectionForm((prev) => ({ ...prev, details: { ...prev.details, [field]: value } }))} />
                    <div style={{ ...styles.grid, marginTop: 14 }}>
                      <Field label="סטטוס"><select style={styles.input} value={trialSectionForm.status} onChange={(e) => setTrialSectionForm((prev) => ({ ...prev, status: e.target.value as TrialStatus }))}><option value="טיוטה">טיוטה</option><option value="אושר">אושר</option><option value="נדחה">נדחה</option></select></Field>
                    </div>
                  </div>
                  <ImagesField images={trialSectionForm.images} onChange={(images) => setTrialSectionForm((prev) => ({ ...prev, images }))} />
                  <div style={styles.buttonRow}>
                    <button style={styles.primaryBtn} onClick={() => void saveTrialSection()}>{editingTrialSectionId ? 'עדכן קטע ניסוי' : 'שמור קטע ניסוי'}</button>
                    <button style={styles.secondaryBtn} onClick={resetTrialSectionEditor}>נקה / בטל עריכה</button>
                  </div>
                </>
              )}
            </div>
          )}

          {section === 'preliminary' && (
            <div>
              <h2 style={styles.sectionTitle}>בקרה מקדימה</h2>
              {guardedBody || (
                <>
                  <div style={styles.buttonRow}>
                    {(['suppliers', 'subcontractors', 'materials'] as PreliminaryTab[]).map((tab) => (
                      <button key={tab} style={{ ...styles.secondaryBtn, background: preliminaryTab === tab ? '#0f172a' : '#fff', color: preliminaryTab === tab ? '#fff' : '#0f172a' }} onClick={() => setPreliminaryTab(tab)}>
                        {tab === 'suppliers' ? 'ספקים' : tab === 'subcontractors' ? 'קבלנים' : 'חומרים'}
                      </button>
                    ))}
                  </div>
                  {preliminaryTab === 'suppliers' && supplierPreliminaryForm.supplier && (
                    <div>
                      <div style={{ ...styles.grid, marginBottom: 16 }}>
                        <Field label="כותרת"><input style={styles.input} value={supplierPreliminaryForm.title} onChange={(e) => setSupplierPreliminaryForm((prev) => ({ ...prev, title: e.target.value }))} /></Field>
                        <Field label="תאריך"><input type="date" style={styles.input} value={supplierPreliminaryForm.date} onChange={(e) => setSupplierPreliminaryForm((prev) => ({ ...prev, date: e.target.value }))} /></Field>
                      </div>
                      <PreliminaryKeyValueFields data={supplierPreliminaryForm.supplier} fields={supplierPreliminaryFields} onChange={(key, value) => setSupplierPreliminaryForm((prev) => ({ ...prev, supplier: { ...(prev.supplier ?? createDefaultPreliminary('suppliers').supplier!), [key]: value } }))} />
                      <PreliminaryDocumentsTable rows={supplierPreliminaryForm.supplier.documents ?? []} onChange={(documents) => setSupplierPreliminaryForm((prev) => ({ ...prev, supplier: { ...(prev.supplier ?? createDefaultPreliminary('suppliers').supplier!), documents } }))} />
                      <AttachmentsField attachments={normalizeAttachments(supplierPreliminaryForm.attachments)} onChange={(attachments) => setSupplierPreliminaryForm((prev) => ({ ...prev, attachments }))} />
                      <PreliminaryNotes qualityAssuranceNotes={supplierPreliminaryForm.supplier.qualityAssuranceNotes ?? ''} qualityControlNotes={supplierPreliminaryForm.supplier.qualityControlNotes ?? ''} notes={supplierPreliminaryForm.supplier.notes ?? ''} onChange={(key, value) => setSupplierPreliminaryForm((prev) => ({ ...prev, supplier: { ...(prev.supplier ?? createDefaultPreliminary('suppliers').supplier!), [key]: value } }))} />
                    </div>
                  )}
                  {preliminaryTab === 'subcontractors' && subcontractorPreliminaryForm.subcontractor && (
                    <div>
                      <div style={{ ...styles.grid, marginBottom: 16 }}>
                        <Field label="כותרת"><input style={styles.input} value={subcontractorPreliminaryForm.title} onChange={(e) => setSubcontractorPreliminaryForm((prev) => ({ ...prev, title: e.target.value }))} /></Field>
                        <Field label="תאריך"><input type="date" style={styles.input} value={subcontractorPreliminaryForm.date} onChange={(e) => setSubcontractorPreliminaryForm((prev) => ({ ...prev, date: e.target.value }))} /></Field>
                      </div>
                      <PreliminaryKeyValueFields data={subcontractorPreliminaryForm.subcontractor} fields={subcontractorPreliminaryFields} onChange={(key, value) => setSubcontractorPreliminaryForm((prev) => ({ ...prev, subcontractor: { ...(prev.subcontractor ?? createDefaultPreliminary('subcontractors').subcontractor!), [key]: value } }))} />
                      <PreliminaryDocumentsTable rows={subcontractorPreliminaryForm.subcontractor.documents ?? []} onChange={(documents) => setSubcontractorPreliminaryForm((prev) => ({ ...prev, subcontractor: { ...(prev.subcontractor ?? createDefaultPreliminary('subcontractors').subcontractor!), documents } }))} />
                      <AttachmentsField attachments={normalizeAttachments(subcontractorPreliminaryForm.attachments)} onChange={(attachments) => setSubcontractorPreliminaryForm((prev) => ({ ...prev, attachments }))} />
                      <PreliminaryNotes qualityAssuranceNotes={subcontractorPreliminaryForm.subcontractor.qualityAssuranceNotes ?? ''} qualityControlNotes={subcontractorPreliminaryForm.subcontractor.qualityControlNotes ?? ''} notes={subcontractorPreliminaryForm.subcontractor.notes ?? ''} onChange={(key, value) => setSubcontractorPreliminaryForm((prev) => ({ ...prev, subcontractor: { ...(prev.subcontractor ?? createDefaultPreliminary('subcontractors').subcontractor!), [key]: value } }))} />
                    </div>
                  )}
                  {preliminaryTab === 'materials' && materialPreliminaryForm.material && (
                    <div>
                      <div style={{ ...styles.grid, marginBottom: 16 }}>
                        <Field label="כותרת"><input style={styles.input} value={materialPreliminaryForm.title} onChange={(e) => setMaterialPreliminaryForm((prev) => ({ ...prev, title: e.target.value }))} /></Field>
                        <Field label="תאריך"><input type="date" style={styles.input} value={materialPreliminaryForm.date} onChange={(e) => setMaterialPreliminaryForm((prev) => ({ ...prev, date: e.target.value }))} /></Field>
                      </div>
                      <PreliminaryKeyValueFields data={materialPreliminaryForm.material} fields={materialPreliminaryFields} onChange={(key, value) => setMaterialPreliminaryForm((prev) => ({ ...prev, material: { ...(prev.material ?? createDefaultPreliminary('materials').material!), [key]: value } }))} />
                      <PreliminaryInspectionsTable rows={materialPreliminaryForm.material.inspections ?? []} onChange={(inspections) => setMaterialPreliminaryForm((prev) => ({ ...prev, material: { ...(prev.material ?? createDefaultPreliminary('materials').material!), inspections } }))} />
                      <PreliminaryDocumentsTable rows={materialPreliminaryForm.material.documents ?? []} onChange={(documents) => setMaterialPreliminaryForm((prev) => ({ ...prev, material: { ...(prev.material ?? createDefaultPreliminary('materials').material!), documents } }))} />
                      <AttachmentsField attachments={normalizeAttachments(materialPreliminaryForm.attachments)} onChange={(attachments) => setMaterialPreliminaryForm((prev) => ({ ...prev, attachments }))} />
                      <PreliminaryNotes qualityAssuranceNotes={materialPreliminaryForm.material.qualityAssuranceNotes ?? ''} qualityControlNotes={materialPreliminaryForm.material.qualityControlNotes ?? ''} notes={materialPreliminaryForm.material.notes ?? ''} onChange={(key, value) => setMaterialPreliminaryForm((prev) => ({ ...prev, material: { ...(prev.material ?? createDefaultPreliminary('materials').material!), [key]: value } }))} />
                    </div>
                  )}
                  <div style={styles.buttonRow}>
                    <button style={styles.primaryBtn} onClick={() => void savePreliminary(preliminaryTab)}>{editingPreliminaryId ? 'עדכן בקרה מקדימה' : 'שמור בקרה מקדימה'}</button>
                    <button style={styles.secondaryBtn} onClick={resetPreliminaryEditor}>נקה / בטל עריכה</button>
                  </div>
                </>
              )}
            </div>
          )}
        </main>

        <aside style={styles.sideCard}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>רשומות שמורות</div>
          <input style={styles.input} placeholder="חיפוש ברשומות..." value={recordsSearchTerm} onChange={(e) => setRecordsSearchTerm(e.target.value)} />

          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>רשימות תיוג</div>
            {projectChecklists.length === 0 && <div style={styles.muted}>אין רשומות</div>}
            {projectChecklists.map((record) => (
              <div key={record.id} style={styles.card}>
                <div style={{ fontWeight: 800 }}>{record.title}</div>
                <div style={styles.muted}>{record.location || '-'} · {record.savedAt}</div>
                <div style={styles.exportRow}>
                  <button style={styles.secondaryBtn} onClick={() => loadChecklist(record)}>פתח</button>
                  <button style={styles.secondaryBtn} onClick={() => exportChecklistToWord(record, projectName)}>Word</button>
                  <button style={styles.secondaryBtn} onClick={() => exportChecklistToExcel(record, projectName)}>Excel</button>
                  <button style={styles.secondaryBtn} onClick={() => exportChecklistToPdf(record, projectName)}>PDF</button>
                  <button style={styles.dangerBtn} onClick={() => void deleteChecklist(record.id)}>מחק</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>אי תאמות</div>
            {projectNonconformances.length === 0 && <div style={styles.muted}>אין רשומות</div>}
            {projectNonconformances.map((record) => (
              <div key={record.id} style={styles.card}>
                <div style={{ fontWeight: 800 }}>{record.title}</div>
                <div style={styles.muted}>{record.location || '-'} · {record.savedAt}</div>
                <div style={styles.buttonRow}>
                  <button style={styles.secondaryBtn} onClick={() => loadNonconformance(record)}>פתח</button>
                  <button style={styles.secondaryBtn} onClick={() => downloadRowsAsWord(record.title, nonconformanceRows(record))}>Word</button>
                  <button style={styles.secondaryBtn} onClick={() => downloadRowsAsExcel(record.title, nonconformanceRows(record))}>Excel</button>
                  <button style={styles.secondaryBtn} onClick={() => downloadRowsAsPdf(record.title, nonconformanceRows(record))}>PDF</button>
                  <button style={styles.dangerBtn} onClick={() => void deleteNonconformance(record.id)}>מחק</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>קטעי ניסוי</div>
            {projectTrialSections.length === 0 && <div style={styles.muted}>אין רשומות</div>}
            {projectTrialSections.map((record) => (
              <div key={record.id} style={styles.card}>
                <div style={{ fontWeight: 800 }}>{record.title}</div>
                <div style={styles.muted}>{record.location || '-'} · {record.savedAt}</div>
                <div style={styles.buttonRow}>
                  <button style={styles.secondaryBtn} onClick={() => loadTrialSection(record)}>פתח</button>
                  <button style={styles.secondaryBtn} onClick={() => downloadRowsAsWord(record.title, trialSectionRows(record))}>Word</button>
                  <button style={styles.secondaryBtn} onClick={() => downloadRowsAsExcel(record.title, trialSectionRows(record))}>Excel</button>
                  <button style={styles.secondaryBtn} onClick={() => downloadRowsAsPdf(record.title, trialSectionRows(record))}>PDF</button>
                  <button style={styles.dangerBtn} onClick={() => void deleteTrialSection(record.id)}>מחק</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>בקרה מקדימה</div>
            {projectPreliminary.length === 0 && <div style={styles.muted}>אין רשומות</div>}
            {projectPreliminary.map((record) => (
              <div key={record.id} style={styles.card}>
                <div style={{ fontWeight: 800 }}>{record.title}</div>
                <div style={styles.muted}>{record.subtype} · {record.savedAt}</div>
                <div style={styles.buttonRow}>
                  <button style={styles.secondaryBtn} onClick={() => loadPreliminary(record)}>פתח</button>
                  <button style={styles.secondaryBtn} onClick={() => downloadRowsAsWord(record.title, preliminaryRows(record))}>Word</button>
                  <button style={styles.secondaryBtn} onClick={() => downloadRowsAsExcel(record.title, preliminaryRows(record))}>Excel</button>
                  <button style={styles.secondaryBtn} onClick={() => downloadRowsAsPdf(record.title, preliminaryRows(record))}>PDF</button>
                  <button style={styles.dangerBtn} onClick={() => void deletePreliminary(record.id)}>מחק</button>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Page;
