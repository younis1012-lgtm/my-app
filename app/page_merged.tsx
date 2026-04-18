'use client';

import { useMemo, useRef, useState, type CSSProperties } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type SectionKey = 'home' | 'projects' | 'nonConformities' | 'testSections' | 'preControl' | 'checklists';
type ChecklistTemplateKey = 'template14' | 'template01' | 'templateCustom';
type ChecklistStatus = 'לא נבדק' | 'תקין' | 'לא תקין';
type ProjectStatus = 'פעיל' | 'מושהה' | 'הושלם';

type Project = {
  id: number;
  name: string;
  manager: string;
  status: ProjectStatus;
  notes: string;
};

type FolderItem = {
  id: string;
  title: string;
  description: string;
  count?: number;
};

type ChecklistItem = {
  id: number;
  description: string;
  responsible: string;
  status: ChecklistStatus;
  executionDate: string;
  signature: string;
  documentRef: string;
  notes: string;
};

type ChecklistTemplateDefinition = {
  label: string;
  title: string;
  category: string;
  code: string;
  items: { description: string; responsible: string }[];
};

type ChecklistForm = {
  templateKey: ChecklistTemplateKey;
  title: string;
  category: string;
  location: string;
  date: string;
  contractor: string;
  structureName: string;
  roadOrSection: string;
  checklistNo: string;
  notes: string;
  items: ChecklistItem[];
};

const checklistTemplates: Record<ChecklistTemplateKey, ChecklistTemplateDefinition> = {
  template14: {
    label: 'מילוי בהידוק מבוקר',
    title: 'רשימת תיוג לעבודות בהידוק מבוקר',
    category: 'מילוי בהידוק מבוקר',
    code: '14',
    items: [
      { description: 'בדיקת תוכניות לביצוע + מהדורה', responsible: 'בקר איכות' },
      { description: 'ביצוע הבדיקות המקדימות התואמות לחומר', responsible: 'בקר איכות' },
      { description: 'השלמת תהליך הבקרה לשכבה הקודמת', responsible: 'בקר איכות' },
      { description: 'הכנת שכבה קודמת לפיזור שכבה מיועדת לבדיקה', responsible: 'מהנדס ביצוע / מנהל עבודה' },
      { description: 'אישור מנהל העבודה על סיום ביצוע השכבה', responsible: 'מהנדס ביצוע / מנהל עבודה' },
      { description: 'בקרה ויזואלית לשכבה', responsible: 'בקר איכות' },
      { description: 'בדיקות דרגת הידוק ותכולת רטיבות', responsible: 'בקר איכות' },
      { description: 'בדיקת מפלסים ורוחב השכבה', responsible: 'מודד' },
      { description: 'אישור סופי', responsible: 'בקר איכות' },
    ],
  },
  template01: {
    label: 'יציקת אלמנטים מבטון',
    title: 'רשימת תיוג ליציקת אלמנטים מבטון',
    category: 'יציקת אלמנטים מבטון',
    code: '02.01.01.1',
    items: [
      { description: 'עבודה עם תוכניות מעודכנות', responsible: 'בקר איכות' },
      { description: 'בקרה מוקדמת: אישורי קבלן משנה, חומרים', responsible: 'בקר איכות' },
      { description: 'מדידה וסימון', responsible: 'מודד' },
      { description: 'בדיקת תבניות וזיון', responsible: 'בקר איכות' },
      { description: 'אישור יציקה', responsible: 'בקר איכות' },
      { description: 'ביצוע יציקה כולל ריטוט', responsible: 'מהנדס ביצוע / מנהל עבודה' },
      { description: 'בדיקת אשפרה', responsible: 'מהנדס ביצוע / מנהל עבודה' },
      { description: 'מדידות As-Made', responsible: 'מודד' },
      { description: 'אישור סופי', responsible: 'בקר איכות' },
    ],
  },
  templateCustom: {
    label: 'טופס מותאם אישית',
    title: 'רשימת תיוג מקצועית',
    category: 'כללי',
    code: 'CUSTOM',
    items: [
      { description: '', responsible: '' },
      { description: '', responsible: '' },
      { description: '', responsible: '' },
      { description: '', responsible: '' },
    ],
  },
};

const buildChecklistItemsFromTemplate = (templateKey: ChecklistTemplateKey): ChecklistItem[] =>
  checklistTemplates[templateKey].items.map((item, index) => ({
    id: Date.now() + index,
    description: item.description,
    responsible: item.responsible,
    status: 'לא נבדק',
    executionDate: '',
    signature: '',
    documentRef: '',
    notes: '',
  }));

const createDefaultChecklist = (templateKey: ChecklistTemplateKey = 'template14'): ChecklistForm => ({
  templateKey,
  title: checklistTemplates[templateKey].title,
  category: checklistTemplates[templateKey].category,
  location: '',
  date: '',
  contractor: '',
  structureName: '',
  roadOrSection: '',
  checklistNo: checklistTemplates[templateKey].code,
  notes: '',
  items: buildChecklistItemsFromTemplate(templateKey),
});

const buildChecklistFileName = (title: string, extension: string) => {
  const safeTitle = (title || 'checklist').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
  return `${safeTitle || 'checklist'}.${extension}`;
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const statusBadgeTone = (status: ChecklistStatus): CSSProperties =>
  status === 'תקין'
    ? { background: '#dcfce7', color: '#166534' }
    : status === 'לא תקין'
      ? { background: '#fee2e2', color: '#991b1b' }
      : { background: '#e2e8f0', color: '#334155' };

const getProjectStatusStyle = (status: ProjectStatus): CSSProperties => {
  if (status === 'פעיל') return { background: '#dcfce7', color: '#166534' };
  if (status === 'מושהה') return { background: '#fef3c7', color: '#92400e' };
  return { background: '#e2e8f0', color: '#334155' };
};

const pageStyle: CSSProperties = { minHeight: '100vh', background: '#eef3f8', direction: 'rtl', fontFamily: 'Arial, sans-serif', color: '#0f172a', padding: 20, boxSizing: 'border-box' };
const pageWrapStyle: CSSProperties = { maxWidth: 1580, margin: '0 auto' };
const heroStyle: CSSProperties = { background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)', color: '#fff', borderRadius: 28, padding: 28, boxShadow: '0 18px 45px rgba(15,23,42,0.16)', marginBottom: 22 };
const heroTopStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' };
const appTitleStyle: CSSProperties = { fontSize: 34, fontWeight: 900, marginBottom: 8 };
const appSubTitleStyle: CSSProperties = { fontSize: 15, opacity: 0.92, lineHeight: 1.7 };
const statsGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, marginTop: 20 };
const statCardStyle: CSSProperties = { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 18, padding: 16, textAlign: 'center' };
const statValueStyle: CSSProperties = { fontSize: 30, fontWeight: 900, marginBottom: 4 };
const statLabelStyle: CSSProperties = { fontSize: 13, opacity: 0.95 };
const navRowStyle: CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 };
const buttonBaseStyle: CSSProperties = { borderRadius: 14, padding: '11px 16px', fontWeight: 800, cursor: 'pointer', fontSize: 14 };
const primaryButtonStyle: CSSProperties = { ...buttonBaseStyle, border: 'none', background: '#0f172a', color: '#fff' };
const secondaryButtonStyle: CSSProperties = { ...buttonBaseStyle, background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1' };
const softButtonStyle: CSSProperties = { ...buttonBaseStyle, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8' };
const dangerButtonStyle: CSSProperties = { ...buttonBaseStyle, border: 'none', background: '#dc2626', color: '#fff' };
const activeNavStyle: CSSProperties = { ...primaryButtonStyle, background: '#1d4ed8' };
const cardStyle: CSSProperties = { background: '#fff', borderRadius: 24, border: '1px solid #dbe3ee', boxShadow: '0 14px 34px rgba(15,23,42,0.07)' };
const sectionGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(320px, 400px) minmax(0, 1fr)', gap: 22, alignItems: 'start' };
const checklistLayoutStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(420px, 500px) minmax(0, 1fr)', gap: 22, alignItems: 'start' };
const sideCardStyle: CSSProperties = { ...cardStyle, padding: 22, position: 'sticky', top: 20 };
const mainCardStyle: CSSProperties = { ...cardStyle, padding: 22 };
const sectionTitleStyle: CSSProperties = { fontSize: 24, fontWeight: 900, marginBottom: 10 };
const smallTitleStyle: CSSProperties = { fontSize: 18, fontWeight: 800, marginBottom: 12 };
const helperTextStyle: CSSProperties = { color: '#64748b', fontSize: 14, lineHeight: 1.7, marginBottom: 16 };
const modulesGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 };
const moduleCardStyle: CSSProperties = { borderRadius: 22, border: '1px solid #dbeafe', background: '#f8fbff', padding: 18, cursor: 'pointer' };
const folderGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 };
const folderCardStyle: CSSProperties = { borderRadius: 20, border: '1px solid #e2e8f0', background: '#fff', padding: 18 };
const folderIconStyle: CSSProperties = { width: 52, height: 52, borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#dbeafe', fontSize: 26, marginBottom: 12 };
const formGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 };
const rowGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 };
const fieldWrapStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const fullWidthStyle: CSSProperties = { gridColumn: '1 / -1' };
const fieldLabelStyle: CSSProperties = { fontSize: 14, fontWeight: 800 };
const inputStyle: CSSProperties = { width: '100%', padding: '11px 12px', borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', fontSize: 14, boxSizing: 'border-box', color: '#0f172a' };
const textareaStyle: CSSProperties = { ...inputStyle, minHeight: 88, resize: 'vertical' };
const projectCardStyle: CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 22, padding: 16, background: '#fff', marginBottom: 14 };
const projectHeaderStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 };
const pillBaseStyle: CSSProperties = { borderRadius: 999, padding: '6px 10px', fontSize: 12, fontWeight: 800 };
const emptyStateStyle: CSSProperties = { borderRadius: 18, padding: 18, background: '#f8fafc', border: '1px dashed #cbd5e1', color: '#64748b', textAlign: 'center' };
const softPanelStyle: CSSProperties = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 18, padding: 16 };
const rowCardStyle: CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 20, padding: 14, background: '#fff', marginBottom: 12 };
const rowTopStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' };
const rowNumberPillStyle: CSSProperties = { width: 42, height: 42, borderRadius: 14, background: '#e2e8f0', color: '#0f172a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18 };
const previewShellStyle: CSSProperties = { background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 18, padding: 16 };
const exportSheetStyle: CSSProperties = { background: '#fff', padding: '22px 22px 18px', border: '1px solid #000', direction: 'rtl', color: '#000', width: '100%', boxSizing: 'border-box' };
const exportTitleStyle: CSSProperties = { textAlign: 'center', fontSize: 28, fontWeight: 800, marginBottom: 8 };
const exportSubTitleStyle: CSSProperties = { textAlign: 'center', fontSize: 12, marginBottom: 14, color: '#334155' };
const exportMetaTableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', marginBottom: 12, tableLayout: 'fixed' };
const exportItemsTableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' };
const metaHeaderCellStyle: CSSProperties = { border: '1px solid #000', background: '#f1f5f9', padding: '7px 6px', fontWeight: 700, fontSize: 12, textAlign: 'center', verticalAlign: 'middle' };
const metaValueCellStyle: CSSProperties = { border: '1px solid #000', padding: '7px 6px', fontSize: 12, textAlign: 'center', verticalAlign: 'middle', background: '#fff' };
const tableHeaderStyle: CSSProperties = { border: '1px solid #000', background: '#f1f5f9', padding: '7px 6px', fontWeight: 700, fontSize: 12, textAlign: 'center', verticalAlign: 'middle' };
const tableCellStyle: CSSProperties = { border: '1px solid #000', padding: '7px 6px', fontSize: 12, textAlign: 'center', verticalAlign: 'middle', minHeight: 34, wordBreak: 'break-word' };
const notesBoxStyle: CSSProperties = { marginTop: 12, border: '1px solid #000', padding: '10px 12px', minHeight: 46, fontSize: 12, background: '#fff' };

function Field({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ ...fieldWrapStyle, ...(full ? fullWidthStyle : {}) }}>
      <label style={fieldLabelStyle}>{label}</label>
      {children}
    </div>
  );
}

export default function Page() {
  const [selectedSection, setSelectedSection] = useState<SectionKey>('home');
  const [projects, setProjects] = useState<Project[]>([
    { id: 1, name: 'פרויקט כביש צפוני', manager: 'איתי לוי', status: 'פעיל', notes: 'פרויקט לדוגמה לעריכה.' },
    { id: 2, name: 'מבנה תעשייה מערב', manager: 'נועה כהן', status: 'מושהה', notes: 'ממתין לאישור חומרים.' },
  ]);
  const [projectForm, setProjectForm] = useState<Omit<Project, 'id'>>({ name: '', manager: '', status: 'פעיל', notes: '' });
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [checklistForm, setChecklistForm] = useState<ChecklistForm>(createDefaultChecklist());
  const checklistExportRef = useRef<HTMLDivElement | null>(null);

  const moduleCards = [
    { key: 'projects' as SectionKey, title: 'פרויקטים', description: 'ניהול פרויקטים עם אפשרות לערוך, להוסיף חדש או למחוק.', icon: '📁' },
    { key: 'nonConformities' as SectionKey, title: 'אי תאמות', description: 'ריכוז מסמכי אי תאמות ומעקב אחר טיפול.', icon: '⚠️' },
    { key: 'testSections' as SectionKey, title: 'קטעי ניסוי', description: 'תיקייה ייעודית למסמכים ונתונים של קטעי ניסוי.', icon: '🧪' },
    { key: 'preControl' as SectionKey, title: 'בקרה מקדימה', description: 'גישה מהירה לתיקיות קבלני משנה, ספקים וחומרים.', icon: '🗂️' },
    { key: 'checklists' as SectionKey, title: 'רשימות תיוג', description: 'מסך הבקרה המקצועי עם עריכה וייצוא ל־PDF, Word ו־Excel.', icon: '📋' },
  ];

  const preControlFolders: FolderItem[] = [
    { id: 'sub-1', title: 'קבלני משנה 1', description: 'תיקיית מעקב ואישורים לקבלני משנה.' },
    { id: 'sub-2', title: 'קבלני משנה 2', description: 'תיקיית מסמכים נוספת לקבלני משנה.' },
    { id: 'sub-3', title: 'קבלני משנה 3', description: 'תיקיית משנה שלישית לקבלני משנה.' },
    { id: 'suppliers', title: 'ספקים', description: 'אישורי ספקים, תעודות ותיעוד רלוונטי.' },
    { id: 'materials', title: 'חומרים', description: 'מסמכי חומרים, אישורים ותוצאות בדיקה.' },
  ];

  const templateLabel = useMemo(() => checklistTemplates[checklistForm.templateKey]?.label ?? 'טופס מותאם', [checklistForm.templateKey]);
  const templateCode = useMemo(() => checklistTemplates[checklistForm.templateKey]?.code ?? '', [checklistForm.templateKey]);
  const activeProjects = useMemo(() => projects.filter((project) => project.status === 'פעיל').length, [projects]);
  const pausedProjects = useMemo(() => projects.filter((project) => project.status === 'מושהה').length, [projects]);
  const completedProjects = useMemo(() => projects.filter((project) => project.status === 'הושלם').length, [projects]);
  const statusSummary = useMemo(() => {
    const total = checklistForm.items.length;
    const ok = checklistForm.items.filter((item) => item.status === 'תקין').length;
    const bad = checklistForm.items.filter((item) => item.status === 'לא תקין').length;
    const pending = checklistForm.items.filter((item) => item.status === 'לא נבדק').length;
    return { total, ok, bad, pending };
  }, [checklistForm.items]);

  const homeFolders: FolderItem[] = [
    { id: 'projects-folder', title: 'פרויקטים', description: 'רשימת כל הפרויקטים הפעילים וההיסטוריים.', count: projects.length },
    { id: 'nonconformities-folder', title: 'אי תאמות', description: 'טפסים, סיכומים ופעולות מתקנות.', count: 8 },
    { id: 'tests-folder', title: 'קטעי ניסוי', description: 'מסמכי ניסוי, תוצאות ובדיקות שטח.', count: 5 },
    { id: 'precontrol-folder', title: 'בקרה מקדימה', description: 'תיקיות משנה לפי גורם מאשר או סוג מסמך.', count: 5 },
    { id: 'checklist-folder', title: 'רשימות תיוג', description: 'טפסי בקרה מקצועיים עם אפשרות ייצוא.', count: checklistForm.items.length },
  ];

  const handleTemplateChange = (templateKey: ChecklistTemplateKey) => {
    const template = checklistTemplates[templateKey];
    setChecklistForm((prev) => ({
      ...prev,
      templateKey,
      title: template.title,
      category: template.category,
      checklistNo: template.code === 'CUSTOM' ? prev.checklistNo : template.code,
      items: buildChecklistItemsFromTemplate(templateKey),
    }));
  };

  const updateChecklistField = <K extends keyof ChecklistForm>(field: K, value: ChecklistForm[K]) => setChecklistForm((prev) => ({ ...prev, [field]: value }));
  const updateChecklistItem = <K extends keyof ChecklistItem>(id: number, field: K, value: ChecklistItem[K]) => setChecklistForm((prev) => ({ ...prev, items: prev.items.map((item) => (item.id === id ? { ...item, [field]: value } : item)) }));
  const addChecklistItem = () => setChecklistForm((prev) => ({ ...prev, items: [...prev.items, { id: Date.now(), description: '', responsible: '', status: 'לא נבדק', executionDate: '', signature: '', documentRef: '', notes: '' }] }));
  const removeChecklistItem = (id: number) => setChecklistForm((prev) => ({ ...prev, items: prev.items.filter((item) => item.id !== id) }));
  const resetProjectForm = () => {
    setProjectForm({ name: '', manager: '', status: 'פעיל', notes: '' });
    setEditingProjectId(null);
  };

  const handleSaveProject = () => {
    if (!projectForm.name.trim()) {
      alert('יש להזין שם פרויקט.');
      return;
    }

    if (editingProjectId !== null) {
      setProjects((prev) => prev.map((project) => (project.id === editingProjectId ? { ...project, ...projectForm } : project)));
      resetProjectForm();
      return;
    }

    setProjects((prev) => [{ id: Date.now(), ...projectForm }, ...prev]);
    resetProjectForm();
  };

  const handleEditProject = (project: Project) => {
    setSelectedSection('projects');
    setEditingProjectId(project.id);
    setProjectForm({ name: project.name, manager: project.manager, status: project.status, notes: project.notes });
  };

  const handleDeleteProject = (id: number) => {
    setProjects((prev) => prev.filter((project) => project.id !== id));
    if (editingProjectId === id) resetProjectForm();
  };

  const buildChecklistExportRows = () => checklistForm.items.map((item, index) => ({
    מספר: index + 1,
    'תיאור פעולת הבקרה': item.description,
    אחריות: item.responsible,
    סטטוס: item.status,
    'תאריך ביצוע': item.executionDate,
    חתימה: item.signature,
    "מס' תוכנית / תעודת בדיקה": item.documentRef,
    הערות: item.notes,
  }));

  const exportChecklistToExcel = () => {
    const workbook = XLSX.utils.book_new();
    const title = checklistForm.title || 'רשימת תיוג';
    const rows = buildChecklistExportRows();
    const sheetRows = [
      [title],
      ['פרטי הטופס'],
      ['שם תבנית', templateLabel, 'קוד טופס', templateCode || '-', 'מספר רשימת תיוג', checklistForm.checklistNo || '-'],
      ['שם הפרויקט / כביש', checklistForm.roadOrSection || '-', 'קבלן מבצע', checklistForm.contractor || '-', 'תאריך', checklistForm.date || '-'],
      ['מבנה / כביש', checklistForm.structureName || '-', 'קטע עבודה', checklistForm.category || '-', 'צד / מיקום', checklistForm.location || '-'],
      ['הערות כלליות', checklistForm.notes || '-'],
      [],
      ['סעיפי בקרה'],
      ['מספר', 'תיאור פעולת הבקרה', 'אחריות', 'סטטוס', 'תאריך ביצוע', 'חתימה', "מס' תוכנית / תעודת בדיקה", 'הערות'],
      ...rows.map((row) => [row['מספר'], row['תיאור פעולת הבקרה'], row['אחריות'], row['סטטוס'], row['תאריך ביצוע'], row['חתימה'], row["מס' תוכנית / תעודת בדיקה"], row['הערות']]),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
    worksheet['!cols'] = [{ wch: 8 }, { wch: 42 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 28 }, { wch: 30 }];
    worksheet['!merges'] = [XLSX.utils.decode_range('A1:H1'), XLSX.utils.decode_range('A2:H2'), XLSX.utils.decode_range('A6:H6'), XLSX.utils.decode_range('A8:H8')];
    worksheet['!autofilter'] = { ref: `A9:H${rows.length + 9}` };
    XLSX.utils.book_append_sheet(workbook, worksheet, 'רשימת תיוג');
    XLSX.writeFile(workbook, buildChecklistFileName(title, 'xlsx'));
  };

  const exportChecklistToWord = () => {
    const rowsHtml = checklistForm.items.map((item, index) => `\n      <tr>\n        <td>${index + 1}</td>\n        <td>${escapeHtml(item.description || '')}</td>\n        <td>${escapeHtml(item.responsible || '')}</td>\n        <td>${escapeHtml(item.status || '')}</td>\n        <td>${escapeHtml(item.executionDate || '')}</td>\n        <td>${escapeHtml(item.signature || '')}</td>\n        <td>${escapeHtml(item.documentRef || '')}</td>\n        <td>${escapeHtml(item.notes || '')}</td>\n      </tr>`).join('');

    const html = `
      <html dir="rtl">
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; direction: rtl; padding: 24px; }
            h1 { text-align: center; margin-bottom: 8px; }
            .sub { text-align: center; font-size: 12px; margin-bottom: 14px; color: #475569; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 12px; }
            th, td { border: 1px solid #000; padding: 7px 6px; text-align: center; vertical-align: middle; font-size: 12px; }
            th { background: #f1f5f9; font-weight: 700; }
            .notes { border: 1px solid #000; padding: 10px; min-height: 40px; margin-top: 12px; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(checklistForm.title || 'רשימת תיוג')}</h1>
          <div class="sub">טופס בקרת איכות מקצועי</div>
          <table>
            <tr>
              <th>שם הפרויקט</th><td>${escapeHtml(checklistForm.roadOrSection || '-')}</td>
              <th>קבלן מבצע</th><td>${escapeHtml(checklistForm.contractor || '-')}</td>
              <th>קטע עבודה</th><td>${escapeHtml(checklistForm.category || '-')}</td>
              <th>מבנה / כביש</th><td>${escapeHtml(checklistForm.structureName || '-')}</td>
            </tr>
            <tr>
              <th>מספר רשימת תיוג</th><td>${escapeHtml(checklistForm.checklistNo || '-')}</td>
              <th>תבנית</th><td>${escapeHtml(templateLabel)}</td>
              <th>קוד טופס</th><td>${escapeHtml(templateCode || '-')}</td>
              <th>תאריך</th><td>${escapeHtml(checklistForm.date || '-')}</td>
            </tr>
            <tr><th>צד / מיקום</th><td colspan="7">${escapeHtml(checklistForm.location || '-')}</td></tr>
          </table>
          <table>
            <thead>
              <tr>
                <th>מספר</th><th>תיאור פעולת הבקרה</th><th>אחריות</th><th>סטטוס</th><th>תאריך ביצוע</th><th>חתימה</th><th>מס' תוכנית / תעודת בדיקה</th><th>הערות</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="notes"><strong>הערות כלליות:</strong> ${escapeHtml(checklistForm.notes || '-')}</div>
        </body>
      </html>`;
    const blob = new Blob(['﻿', html], { type: 'application/msword;charset=utf-8' });
    saveAs(blob, buildChecklistFileName(checklistForm.title || templateLabel, 'doc'));
  };

  const exportChecklistToPdf = async () => {
    const target = checklistExportRef.current;
    if (!target) return alert('לא נמצא אזור לייצוא PDF');
    const canvas = await html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false, windowWidth: target.scrollWidth, windowHeight: target.scrollHeight });
    const imageData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const usableWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * usableWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = margin;
    pdf.addImage(imageData, 'PNG', margin, position, usableWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;
    while (heightLeft > 0) {
      position = -(imgHeight - heightLeft) + margin;
      pdf.addPage();
      pdf.addImage(imageData, 'PNG', margin, position, usableWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
    }
    pdf.save(buildChecklistFileName(checklistForm.title || templateLabel, 'pdf'));
  };

  const renderFolderCards = (items: FolderItem[]) => (
    <div style={folderGridStyle}>
      {items.map((item) => (
        <div key={item.id} style={folderCardStyle}>
          <div style={folderIconStyle}>📂</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>{item.title}</div>
          <div style={{ color: '#475569', lineHeight: 1.7, fontSize: 14 }}>{item.description}</div>
          {typeof item.count === 'number' ? <div style={{ marginTop: 12, fontWeight: 800, color: '#1d4ed8' }}>{item.count} פריטים</div> : null}
        </div>
      ))}
    </div>
  );

  const renderHome = () => (
    <div style={mainCardStyle}>
      <div style={sectionTitleStyle}>דף שער – מודולים ותיקיות</div>
      <div style={helperTextStyle}>המסך הראשי כולל מודולים מרכזיים ותיקיות ניווט מהירות: פרויקטים, אי תאמות, קטעי ניסוי, בקרה מקדימה ורשימות תיוג.</div>
      <div style={{ ...smallTitleStyle, marginTop: 0 }}>מודולים ראשיים</div>
      <div style={modulesGridStyle}>
        {moduleCards.map((item) => (
          <div key={item.key} style={moduleCardStyle} onClick={() => setSelectedSection(item.key)}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>{item.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>{item.title}</div>
            <div style={{ color: '#475569', lineHeight: 1.7 }}>{item.description}</div>
          </div>
        ))}
      </div>
      <div style={{ ...smallTitleStyle, marginTop: 22 }}>תיקיות בדף השער</div>
      {renderFolderCards(homeFolders)}
    </div>
  );

  const renderProjects = () => (
    <div style={sectionGridStyle}>
      <aside style={sideCardStyle}>
        <div style={sectionTitleStyle}>ניהול פרויקטים</div>
        <div style={helperTextStyle}>כאן ניתן להוסיף פרויקט חדש, לערוך פרויקט קיים או למחוק פרויקט.</div>
        <div style={formGridStyle}>
          <Field label="שם פרויקט"><input value={projectForm.name} onChange={(e) => setProjectForm((prev) => ({ ...prev, name: e.target.value }))} style={inputStyle} placeholder="הזן שם פרויקט" /></Field>
          <Field label="מנהל פרויקט"><input value={projectForm.manager} onChange={(e) => setProjectForm((prev) => ({ ...prev, manager: e.target.value }))} style={inputStyle} placeholder="הזן שם מנהל" /></Field>
          <Field label="סטטוס">
            <select value={projectForm.status} onChange={(e) => setProjectForm((prev) => ({ ...prev, status: e.target.value as ProjectStatus }))} style={inputStyle}>
              <option value="פעיל">פעיל</option>
              <option value="מושהה">מושהה</option>
              <option value="הושלם">הושלם</option>
            </select>
          </Field>
          <Field label="הערות" full><textarea value={projectForm.notes} onChange={(e) => setProjectForm((prev) => ({ ...prev, notes: e.target.value }))} style={textareaStyle} placeholder="הערות על הפרויקט" /></Field>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <button style={primaryButtonStyle} onClick={handleSaveProject}>{editingProjectId !== null ? 'שמור שינויים' : 'הוסף פרויקט חדש'}</button>
          <button style={secondaryButtonStyle} onClick={resetProjectForm}>נקה טופס</button>
        </div>
      </aside>

      <main style={mainCardStyle}>
        <div style={sectionTitleStyle}>רשימת פרויקטים</div>
        <div style={helperTextStyle}>לכל פרויקט יש פעולות מהירות: עריכה, מחיקה והצגת פרטים.</div>
        {projects.length === 0 ? <div style={emptyStateStyle}>עדיין לא נוספו פרויקטים. ניתן להוסיף פרויקט חדש מהטופס בצד.</div> : projects.map((project) => (
          <div key={project.id} style={projectCardStyle}>
            <div style={projectHeaderStyle}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}>{project.name}</div>
                <div style={{ color: '#64748b', fontSize: 14 }}>מנהל פרויקט: {project.manager || '-'}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ ...pillBaseStyle, ...getProjectStatusStyle(project.status) }}>{project.status}</span>
                <button style={softButtonStyle} onClick={() => handleEditProject(project)}>ערוך</button>
                <button style={dangerButtonStyle} onClick={() => handleDeleteProject(project.id)}>מחק</button>
              </div>
            </div>
            <div style={{ color: '#334155', lineHeight: 1.8 }}>{project.notes || 'אין הערות לפרויקט זה.'}</div>
          </div>
        ))}
      </main>
    </div>
  );

  const renderSimpleSection = (title: string, description: string, items: FolderItem[]) => (
    <div style={mainCardStyle}>
      <div style={sectionTitleStyle}>{title}</div>
      <div style={helperTextStyle}>{description}</div>
      {renderFolderCards(items)}
    </div>
  );

  const renderChecklists = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={sectionTitleStyle}>רשימות תיוג – גרסה מקצועית</div>
          <div style={helperTextStyle}>מסך מקצועי עם עריכת סעיפים, סטטוסים, חתימות וייצוא ל־Excel, Word ו־PDF.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={secondaryButtonStyle} onClick={exportChecklistToExcel}>ייצוא Excel</button>
          <button style={secondaryButtonStyle} onClick={exportChecklistToWord}>ייצוא Word</button>
          <button style={primaryButtonStyle} onClick={exportChecklistToPdf}>ייצוא PDF</button>
        </div>
      </div>

      <div style={{ ...statsGridStyle, marginBottom: 16 }}>
        <div style={{ ...cardStyle, padding: 16, textAlign: 'center' }}><div style={{ ...statValueStyle, color: '#0f172a' }}>{statusSummary.total}</div><div style={{ ...statLabelStyle, color: '#334155' }}>סה״כ סעיפים</div></div>
        <div style={{ ...cardStyle, padding: 16, textAlign: 'center' }}><div style={{ ...statValueStyle, color: '#0f172a' }}>{statusSummary.ok}</div><div style={{ ...statLabelStyle, color: '#334155' }}>תקין</div></div>
        <div style={{ ...cardStyle, padding: 16, textAlign: 'center' }}><div style={{ ...statValueStyle, color: '#0f172a' }}>{statusSummary.bad}</div><div style={{ ...statLabelStyle, color: '#334155' }}>לא תקין</div></div>
        <div style={{ ...cardStyle, padding: 16, textAlign: 'center' }}><div style={{ ...statValueStyle, color: '#0f172a' }}>{statusSummary.pending}</div><div style={{ ...statLabelStyle, color: '#334155' }}>לא נבדק</div></div>
        <div style={{ ...cardStyle, padding: 16, textAlign: 'center' }}><div style={{ ...statValueStyle, color: '#0f172a' }}>{projects.length}</div><div style={{ ...statLabelStyle, color: '#334155' }}>פרויקטים במערכת</div></div>
      </div>

      <div style={checklistLayoutStyle}>
        <aside style={sideCardStyle}>
          <div style={sectionTitleStyle}>עריכת הטופס</div>
          <Field label="בחירת תבנית">
            <select value={checklistForm.templateKey} onChange={(e) => handleTemplateChange(e.target.value as ChecklistTemplateKey)} style={inputStyle}>
              <option value="template14">מילוי בהידוק מבוקר</option>
              <option value="template01">יציקת אלמנטים מבטון</option>
              <option value="templateCustom">טופס מותאם אישית</option>
            </select>
          </Field>

          <div style={{ ...formGridStyle, marginTop: 14 }}>
            <Field label="שם הטופס"><input value={checklistForm.title} onChange={(e) => updateChecklistField('title', e.target.value)} style={inputStyle} /></Field>
            <Field label="מספר רשימת תיוג"><input value={checklistForm.checklistNo} onChange={(e) => updateChecklistField('checklistNo', e.target.value)} style={inputStyle} /></Field>
            <Field label="שם הפרויקט"><input value={checklistForm.roadOrSection} onChange={(e) => updateChecklistField('roadOrSection', e.target.value)} style={inputStyle} placeholder="למשל: כביש 8070" /></Field>
            <Field label="מבנה / כביש"><input value={checklistForm.structureName} onChange={(e) => updateChecklistField('structureName', e.target.value)} style={inputStyle} /></Field>
            <Field label="קטע עבודה"><input value={checklistForm.category} onChange={(e) => updateChecklistField('category', e.target.value)} style={inputStyle} /></Field>
            <Field label="קבלן מבצע"><input value={checklistForm.contractor} onChange={(e) => updateChecklistField('contractor', e.target.value)} style={inputStyle} /></Field>
            <Field label="צד / מיקום"><input value={checklistForm.location} onChange={(e) => updateChecklistField('location', e.target.value)} style={inputStyle} /></Field>
            <Field label="תאריך"><input type="date" value={checklistForm.date} onChange={(e) => updateChecklistField('date', e.target.value)} style={inputStyle} /></Field>
            <Field label="הערות כלליות" full><textarea value={checklistForm.notes} onChange={(e) => updateChecklistField('notes', e.target.value)} style={textareaStyle} /></Field>
          </div>

          <div style={{ ...smallTitleStyle, marginTop: 18 }}>סעיפי בקרה</div>
          <div style={helperTextStyle}>לכל סעיף ניתן לעדכן סטטוס, תאריך ביצוע, חתימה, אסמכתא והערות.</div>

          <div style={softPanelStyle}>
            {checklistForm.items.map((item, index) => (
              <div key={item.id} style={rowCardStyle}>
                <div style={rowTopStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={rowNumberPillStyle}>{index + 1}</div>
                    <div style={{ fontWeight: 800 }}>סעיף בקרה</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ ...pillBaseStyle, ...statusBadgeTone(item.status) }}>{item.status}</span>
                    <button style={dangerButtonStyle} onClick={() => removeChecklistItem(item.id)}>מחק שורה</button>
                  </div>
                </div>
                <div style={rowGridStyle}>
                  <Field label="תיאור"><input value={item.description} onChange={(e) => updateChecklistItem(item.id, 'description', e.target.value)} style={inputStyle} placeholder="תיאור פעולת הבקרה" /></Field>
                  <Field label="אחראי"><input value={item.responsible} onChange={(e) => updateChecklistItem(item.id, 'responsible', e.target.value)} style={inputStyle} placeholder="אחראי" /></Field>
                  <Field label="סטטוס">
                    <select value={item.status} onChange={(e) => updateChecklistItem(item.id, 'status', e.target.value as ChecklistStatus)} style={inputStyle}>
                      <option value="לא נבדק">לא נבדק</option>
                      <option value="תקין">תקין</option>
                      <option value="לא תקין">לא תקין</option>
                    </select>
                  </Field>
                  <Field label="תאריך ביצוע"><input type="date" value={item.executionDate} onChange={(e) => updateChecklistItem(item.id, 'executionDate', e.target.value)} style={inputStyle} /></Field>
                  <Field label="חתימה / שם בודק"><input value={item.signature} onChange={(e) => updateChecklistItem(item.id, 'signature', e.target.value)} style={inputStyle} placeholder="חתימה / שם" /></Field>
                  <Field label="מס׳ תוכנית / תעודת בדיקה"><input value={item.documentRef} onChange={(e) => updateChecklistItem(item.id, 'documentRef', e.target.value)} style={inputStyle} placeholder="מס׳ אסמכתא" /></Field>
                  <Field label="הערות" full><input value={item.notes} onChange={(e) => updateChecklistItem(item.id, 'notes', e.target.value)} style={inputStyle} placeholder="הערות" /></Field>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <button style={secondaryButtonStyle} onClick={addChecklistItem}>הוסף שורה</button>
              <button style={secondaryButtonStyle} onClick={() => setChecklistForm(createDefaultChecklist(checklistForm.templateKey))}>איפוס לפי תבנית</button>
            </div>
          </div>
        </aside>

        <main style={mainCardStyle}>
          <div style={sectionTitleStyle}>תצוגה רשמית להדפסה / PDF</div>
          <div style={previewShellStyle}>
            <div ref={checklistExportRef} style={exportSheetStyle}>
              <div style={exportTitleStyle}>{checklistForm.title || 'רשימת תיוג'}</div>
              <div style={exportSubTitleStyle}>טופס בקרת איכות מקצועי</div>
              <table style={exportMetaTableStyle}>
                <tbody>
                  <tr>
                    <th style={metaHeaderCellStyle}>שם הפרויקט</th><td style={metaValueCellStyle}>{checklistForm.roadOrSection || '-'}</td>
                    <th style={metaHeaderCellStyle}>קבלן מבצע</th><td style={metaValueCellStyle}>{checklistForm.contractor || '-'}</td>
                    <th style={metaHeaderCellStyle}>קטע עבודה</th><td style={metaValueCellStyle}>{checklistForm.category || '-'}</td>
                    <th style={metaHeaderCellStyle}>מבנה / כביש</th><td style={metaValueCellStyle}>{checklistForm.structureName || '-'}</td>
                  </tr>
                  <tr>
                    <th style={metaHeaderCellStyle}>מספר רשימת תיוג</th><td style={metaValueCellStyle}>{checklistForm.checklistNo || '-'}</td>
                    <th style={metaHeaderCellStyle}>תבנית</th><td style={metaValueCellStyle}>{templateLabel}</td>
                    <th style={metaHeaderCellStyle}>קוד טופס</th><td style={metaValueCellStyle}>{templateCode || '-'}</td>
                    <th style={metaHeaderCellStyle}>תאריך</th><td style={metaValueCellStyle}>{checklistForm.date || '-'}</td>
                  </tr>
                  <tr>
                    <th style={metaHeaderCellStyle}>צד / מיקום</th>
                    <td style={metaValueCellStyle} colSpan={7}>{checklistForm.location || '-'}</td>
                  </tr>
                </tbody>
              </table>
              <table style={exportItemsTableStyle}>
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>מספר</th>
                    <th style={tableHeaderStyle}>תיאור פעולת הבקרה</th>
                    <th style={tableHeaderStyle}>אחריות</th>
                    <th style={tableHeaderStyle}>סטטוס</th>
                    <th style={tableHeaderStyle}>תאריך ביצוע</th>
                    <th style={tableHeaderStyle}>חתימה</th>
                    <th style={tableHeaderStyle}>מס׳ תוכנית / תעודת בדיקה</th>
                    <th style={tableHeaderStyle}>הערות</th>
                  </tr>
                </thead>
                <tbody>
                  {checklistForm.items.map((item, index) => (
                    <tr key={item.id}>
                      <td style={tableCellStyle}>{index + 1}</td>
                      <td style={tableCellStyle}>{item.description || '-'}</td>
                      <td style={tableCellStyle}>{item.responsible || '-'}</td>
                      <td style={tableCellStyle}>{item.status || '-'}</td>
                      <td style={tableCellStyle}>{item.executionDate || ''}</td>
                      <td style={tableCellStyle}>{item.signature || ''}</td>
                      <td style={tableCellStyle}>{item.documentRef || ''}</td>
                      <td style={tableCellStyle}>{item.notes || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={notesBoxStyle}><strong>הערות כלליות:</strong> {checklistForm.notes || '-'}</div>
            </div>
          </div>
        </main>
      </div>
    </>
  );

  return (
    <div style={pageStyle}>
      <div style={pageWrapStyle}>
        <div style={heroStyle}>
          <div style={heroTopStyle}>
            <div>
              <div style={appTitleStyle}>מערכת ניהול בקרת איכות</div>
              <div style={appSubTitleStyle}>דף שער עם מודולים ותיקיות, ניהול פרויקטים מלא, קטגוריות ייעודיות, ובנוסף מסך רשימות תיוג מקצועי עם ייצוא.</div>
            </div>
            <button style={secondaryButtonStyle} onClick={() => setSelectedSection('home')}>חזרה לדף השער</button>
          </div>
          <div style={statsGridStyle}>
            <div style={statCardStyle}><div style={statValueStyle}>{projects.length}</div><div style={statLabelStyle}>סה״כ פרויקטים</div></div>
            <div style={statCardStyle}><div style={statValueStyle}>{activeProjects}</div><div style={statLabelStyle}>פרויקטים פעילים</div></div>
            <div style={statCardStyle}><div style={statValueStyle}>{pausedProjects}</div><div style={statLabelStyle}>פרויקטים מושהים</div></div>
            <div style={statCardStyle}><div style={statValueStyle}>{completedProjects}</div><div style={statLabelStyle}>פרויקטים שהושלמו</div></div>
            <div style={statCardStyle}><div style={statValueStyle}>{statusSummary.total}</div><div style={statLabelStyle}>סעיפי בקרה</div></div>
          </div>
        </div>

        <div style={navRowStyle}>
          <button style={selectedSection === 'home' ? activeNavStyle : secondaryButtonStyle} onClick={() => setSelectedSection('home')}>דף שער</button>
          <button style={selectedSection === 'projects' ? activeNavStyle : secondaryButtonStyle} onClick={() => setSelectedSection('projects')}>פרויקטים</button>
          <button style={selectedSection === 'nonConformities' ? activeNavStyle : secondaryButtonStyle} onClick={() => setSelectedSection('nonConformities')}>אי תאמות</button>
          <button style={selectedSection === 'testSections' ? activeNavStyle : secondaryButtonStyle} onClick={() => setSelectedSection('testSections')}>קטעי ניסוי</button>
          <button style={selectedSection === 'preControl' ? activeNavStyle : secondaryButtonStyle} onClick={() => setSelectedSection('preControl')}>בקרה מקדימה</button>
          <button style={selectedSection === 'checklists' ? activeNavStyle : secondaryButtonStyle} onClick={() => setSelectedSection('checklists')}>רשימות תיוג</button>
        </div>

        {selectedSection === 'home' ? renderHome() :
          selectedSection === 'projects' ? renderProjects() :
          selectedSection === 'nonConformities' ? renderSimpleSection('אי תאמות', 'אזור ייעודי למסמכי אי תאמות, מעקב אחר סגירת פערים והוספת קבצים בעתיד.', [
            { id: 'nc-1', title: 'דוחות אי תאמות', description: 'ריכוז דוחות פתוחים וסגורים.', count: 4 },
            { id: 'nc-2', title: 'פעולות מתקנות', description: 'מעקב אחר פעולות, אחריות וסטטוס.', count: 6 },
            { id: 'nc-3', title: 'אסמכתאות', description: 'צירוף מסמכים, תמונות ואישורים.', count: 11 },
          ]) :
            selectedSection === 'testSections' ? renderSimpleSection('קטעי ניסוי', 'אזור נפרד לקטעי ניסוי, עם מקום לתוצאות, מסמכים וניתוחי בדיקה.', [
              { id: 'test-1', title: 'תכנון קטע ניסוי', description: 'מסמכי הכנה וקריטריונים לביצוע.', count: 3 },
              { id: 'test-2', title: 'תוצאות בדיקה', description: 'ריכוז תוצאות ודו"חות.', count: 7 },
              { id: 'test-3', title: 'סיכומים והמלצות', description: 'מסקנות להמשך ביצוע.', count: 2 },
            ]) :
              selectedSection === 'preControl' ? renderSimpleSection('בקרה מקדימה', 'בתוך בקרה מקדימה נוספו 3 תיקיות של קבלני משנה, ועוד תיקיה של ספקים ועוד תיקיה של חומרים.', preControlFolders) :
                renderChecklists()}
      </div>
    </div>
  );
}
