'use client';

import { useMemo, useRef, useState, type CSSProperties } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type ChecklistTemplateKey = 'template14' | 'template01' | 'templateCustom';

type ChecklistItem = {
  id: number;
  description: string;
  responsible: string;
  status: 'לא נבדק' | 'תקין' | 'לא תקין';
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
    title: 'רשימת תיוג',
    category: 'כללי',
    code: 'CUSTOM',
    items: [
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
  checklistNo: '',
  notes: '',
  items: buildChecklistItemsFromTemplate(templateKey),
});

const buildChecklistFileName = (title: string, extension: string) => {
  const safeTitle = (title || 'checklist')
    .replace(/[\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return `${safeTitle || 'checklist'}.${extension}`;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: '#eef2f7',
  direction: 'rtl',
  fontFamily: 'Arial, sans-serif',
  color: '#0f172a',
  padding: 20,
  boxSizing: 'border-box',
};

const pageWrapStyle: CSSProperties = {
  maxWidth: 1480,
  margin: '0 auto',
};

const topBarStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  marginBottom: 18,
  flexWrap: 'wrap',
};

const titleBlockStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const appTitleStyle: CSSProperties = {
  fontSize: 34,
  fontWeight: 900,
};

const appSubTitleStyle: CSSProperties = {
  fontSize: 15,
  color: '#475569',
};

const actionsRowStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
};

const layoutStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(360px, 460px) minmax(0, 1fr)',
  gap: 20,
  alignItems: 'start',
};

const cardStyle: CSSProperties = {
  background: '#fff',
  borderRadius: 24,
  border: '1px solid #dbe3ee',
  boxShadow: '0 12px 32px rgba(15,23,42,0.06)',
};

const sideCardStyle: CSSProperties = {
  ...cardStyle,
  padding: 22,
  position: 'sticky',
  top: 20,
};

const mainCardStyle: CSSProperties = {
  ...cardStyle,
  padding: 22,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  marginBottom: 14,
};

const formGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
};

const fieldWrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '11px 12px',
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  background: '#fff',
  fontSize: 14,
  boxSizing: 'border-box',
  color: '#0f172a',
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 88,
  resize: 'vertical',
};

const fullWidthStyle: CSSProperties = {
  gridColumn: '1 / -1',
};

const rowEditorHeaderStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '60px 2.3fr 1.2fr 1fr 1fr 1fr 1.3fr 1.5fr',
  gap: 8,
  marginBottom: 8,
  fontSize: 13,
  fontWeight: 800,
  color: '#334155',
};

const rowEditorStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '60px 2.3fr 1.2fr 1fr 1fr 1fr 1.3fr 1.5fr',
  gap: 8,
  marginBottom: 8,
  alignItems: 'start',
};

const rowIndexStyle: CSSProperties = {
  ...inputStyle,
  textAlign: 'center',
  background: '#f8fafc',
  fontWeight: 800,
};

const buttonBaseStyle: CSSProperties = {
  borderRadius: 14,
  padding: '11px 16px',
  fontWeight: 800,
  cursor: 'pointer',
  border: 'none',
  fontSize: 14,
};

const primaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#0f172a',
  color: '#fff',
};

const secondaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#fff',
  color: '#0f172a',
  border: '1px solid #cbd5e1',
};

const dangerButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#dc2626',
  color: '#fff',
};

const subHeaderStyle: CSSProperties = {
  fontSize: 17,
  fontWeight: 800,
  margin: '18px 0 10px',
};

const helperTextStyle: CSSProperties = {
  color: '#64748b',
  fontSize: 13,
  marginBottom: 10,
};

const previewShellStyle: CSSProperties = {
  background: '#f8fafc',
  border: '1px dashed #cbd5e1',
  borderRadius: 18,
  padding: 16,
};

const exportSheetStyle: CSSProperties = {
  background: '#fff',
  padding: '22px 22px 18px',
  border: '1px solid #000',
  direction: 'rtl',
  color: '#000',
  width: '100%',
  boxSizing: 'border-box',
};

const exportTitleStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: 28,
  fontWeight: 800,
  marginBottom: 12,
};

const exportMetaTableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginBottom: 12,
  tableLayout: 'fixed',
};

const exportItemsTableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
};

const metaHeaderCellStyle: CSSProperties = {
  border: '1px solid #000',
  background: '#f1f5f9',
  padding: '7px 6px',
  fontWeight: 700,
  fontSize: 12,
  textAlign: 'center',
  verticalAlign: 'middle',
};

const metaValueCellStyle: CSSProperties = {
  border: '1px solid #000',
  padding: '7px 6px',
  fontSize: 12,
  textAlign: 'center',
  verticalAlign: 'middle',
  background: '#fff',
};

const tableHeaderStyle: CSSProperties = {
  border: '1px solid #000',
  background: '#f1f5f9',
  padding: '7px 6px',
  fontWeight: 700,
  fontSize: 12,
  textAlign: 'center',
  verticalAlign: 'middle',
};

const tableCellStyle: CSSProperties = {
  border: '1px solid #000',
  padding: '7px 6px',
  fontSize: 12,
  textAlign: 'center',
  verticalAlign: 'middle',
  minHeight: 34,
  wordBreak: 'break-word',
};

const notesBoxStyle: CSSProperties = {
  marginTop: 12,
  border: '1px solid #000',
  padding: '10px 12px',
  minHeight: 46,
  fontSize: 12,
  background: '#fff',
};

const mobileNoticeStyle: CSSProperties = {
  marginTop: 12,
  fontSize: 12,
  color: '#64748b',
};

function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div style={{ ...fieldWrapStyle, ...(full ? fullWidthStyle : {}) }}>
      <label style={fieldLabelStyle}>{label}</label>
      {children}
    </div>
  );
}

export default function Page() {
  const [checklistForm, setChecklistForm] = useState<ChecklistForm>(createDefaultChecklist());
  const checklistExportRef = useRef<HTMLDivElement | null>(null);

  const templateLabel = useMemo(
    () => checklistTemplates[checklistForm.templateKey]?.label ?? 'טופס מותאם',
    [checklistForm.templateKey]
  );

  const templateCode = useMemo(
    () => checklistTemplates[checklistForm.templateKey]?.code ?? '',
    [checklistForm.templateKey]
  );

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

  const updateChecklistField = <K extends keyof ChecklistForm>(field: K, value: ChecklistForm[K]) => {
    setChecklistForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateChecklistItem = <K extends keyof ChecklistItem>(id: number, field: K, value: ChecklistItem[K]) => {
    setChecklistForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  };

  const addChecklistItem = () => {
    setChecklistForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: Date.now(),
          description: '',
          responsible: '',
          status: 'לא נבדק',
          executionDate: '',
          signature: '',
          documentRef: '',
          notes: '',
        },
      ],
    }));
  };

  const removeChecklistItem = (id: number) => {
    setChecklistForm((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
  };

  const buildChecklistExportRows = () =>
    checklistForm.items.map((item, index) => ({
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
      ...rows.map((row) => [
        row['מספר'],
        row['תיאור פעולת הבקרה'],
        row['אחריות'],
        row['סטטוס'],
        row['תאריך ביצוע'],
        row['חתימה'],
        row["מס' תוכנית / תעודת בדיקה"],
        row['הערות'],
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 42 },
      { wch: 20 },
      { wch: 14 },
      { wch: 16 },
      { wch: 18 },
      { wch: 28 },
      { wch: 30 },
    ];
    worksheet['!merges'] = [
      XLSX.utils.decode_range('A1:H1'),
      XLSX.utils.decode_range('A2:H2'),
      XLSX.utils.decode_range('A6:H6'),
      XLSX.utils.decode_range('A8:H8'),
    ];
    worksheet['!autofilter'] = { ref: `A9:H${rows.length + 9}` };

    XLSX.utils.book_append_sheet(workbook, worksheet, 'רשימת תיוג');
    XLSX.writeFile(workbook, buildChecklistFileName(title, 'xlsx'));
  };

  const exportChecklistToWord = () => {
    const rowsHtml = checklistForm.items
      .map(
        (item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(item.description || '')}</td>
            <td>${escapeHtml(item.responsible || '')}</td>
            <td>${escapeHtml(item.status || '')}</td>
            <td>${escapeHtml(item.executionDate || '')}</td>
            <td>${escapeHtml(item.signature || '')}</td>
            <td>${escapeHtml(item.documentRef || '')}</td>
            <td>${escapeHtml(item.notes || '')}</td>
          </tr>
        `
      )
      .join('');

    const html = `
      <html dir="rtl">
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; direction: rtl; padding: 24px; }
            h1 { text-align: center; margin-bottom: 18px; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 12px; }
            th, td { border: 1px solid #000; padding: 7px 6px; text-align: center; vertical-align: middle; font-size: 12px; }
            th { background: #f1f5f9; font-weight: 700; }
            .notes { border: 1px solid #000; padding: 10px; min-height: 40px; margin-top: 12px; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(checklistForm.title || 'רשימת תיוג')}</h1>

          <table>
            <tr>
              <th>שם הפרויקט</th>
              <td>${escapeHtml(checklistForm.roadOrSection || '-')}</td>
              <th>קבלן מבצע</th>
              <td>${escapeHtml(checklistForm.contractor || '-')}</td>
              <th>קטע עבודה</th>
              <td>${escapeHtml(checklistForm.category || '-')}</td>
              <th>מבנה / כביש</th>
              <td>${escapeHtml(checklistForm.structureName || '-')}</td>
            </tr>
            <tr>
              <th>מספר רשימת תיוג</th>
              <td>${escapeHtml(checklistForm.checklistNo || '-')}</td>
              <th>תבנית</th>
              <td>${escapeHtml(templateLabel)}</td>
              <th>קוד טופס</th>
              <td>${escapeHtml(templateCode || '-')}</td>
              <th>תאריך</th>
              <td>${escapeHtml(checklistForm.date || '-')}</td>
            </tr>
            <tr>
              <th>צד / מיקום</th>
              <td colspan="7">${escapeHtml(checklistForm.location || '-')}</td>
            </tr>
          </table>

          <table>
            <thead>
              <tr>
                <th>מספר</th>
                <th>תיאור פעולת הבקרה</th>
                <th>אחריות</th>
                <th>סטטוס</th>
                <th>תאריך ביצוע</th>
                <th>חתימה</th>
                <th>מס' תוכנית / תעודת בדיקה</th>
                <th>הערות</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          <div class="notes"><strong>הערות כלליות:</strong> ${escapeHtml(checklistForm.notes || '-')}</div>
        </body>
      </html>
    `;

    const blob = new Blob(['﻿', html], {
      type: 'application/msword;charset=utf-8',
    });
    saveAs(blob, buildChecklistFileName(checklistForm.title || templateLabel, 'doc'));
  };

  const exportChecklistToPdf = async () => {
    const target = checklistExportRef.current;
    if (!target) {
      alert('לא נמצא אזור לייצוא PDF');
      return;
    }

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: target.scrollWidth,
      windowHeight: target.scrollHeight,
    });

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

  return (
    <div style={pageStyle}>
      <div style={pageWrapStyle}>
        <div style={topBarStyle}>
          <div style={titleBlockStyle}>
            <div style={appTitleStyle}>רשימות תיוג</div>
            <div style={appSubTitleStyle}>
              עמוד מלא ומתוקן ל־Next.js עם טופס עליון בטבלה, חתימות, תאריך ביצוע וייצוא ל־Excel / Word / PDF.
            </div>
          </div>

          <div style={actionsRowStyle}>
            <button style={secondaryButtonStyle} onClick={exportChecklistToExcel}>ייצוא Excel</button>
            <button style={secondaryButtonStyle} onClick={exportChecklistToWord}>ייצוא Word</button>
            <button style={primaryButtonStyle} onClick={exportChecklistToPdf}>ייצוא PDF</button>
          </div>
        </div>

        <div style={layoutStyle}>
          <aside style={sideCardStyle}>
            <div style={sectionTitleStyle}>עריכת הטופס</div>

            <Field label="בחירת תבנית">
              <select
                value={checklistForm.templateKey}
                onChange={(e) => handleTemplateChange(e.target.value as ChecklistTemplateKey)}
                style={inputStyle}
              >
                <option value="template14">מילוי בהידוק מבוקר</option>
                <option value="template01">יציקת אלמנטים מבטון</option>
                <option value="templateCustom">טופס מותאם אישית</option>
              </select>
            </Field>

            <div style={{ ...formGridStyle, marginTop: 14 }}>
              <Field label="שם הטופס">
                <input
                  value={checklistForm.title}
                  onChange={(e) => updateChecklistField('title', e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="מספר רשימת תיוג">
                <input
                  value={checklistForm.checklistNo}
                  onChange={(e) => updateChecklistField('checklistNo', e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="שם הפרויקט">
                <input
                  value={checklistForm.roadOrSection}
                  onChange={(e) => updateChecklistField('roadOrSection', e.target.value)}
                  style={inputStyle}
                  placeholder="למשל: כביש 8070"
                />
              </Field>

              <Field label="מבנה / כביש">
                <input
                  value={checklistForm.structureName}
                  onChange={(e) => updateChecklistField('structureName', e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="קטע עבודה">
                <input
                  value={checklistForm.category}
                  onChange={(e) => updateChecklistField('category', e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="קבלן מבצע">
                <input
                  value={checklistForm.contractor}
                  onChange={(e) => updateChecklistField('contractor', e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="צד / מיקום">
                <input
                  value={checklistForm.location}
                  onChange={(e) => updateChecklistField('location', e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="תאריך">
                <input
                  type="date"
                  value={checklistForm.date}
                  onChange={(e) => updateChecklistField('date', e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="הערות כלליות" full>
                <textarea
                  value={checklistForm.notes}
                  onChange={(e) => updateChecklistField('notes', e.target.value)}
                  style={textareaStyle}
                />
              </Field>
            </div>

            <div style={subHeaderStyle}>סעיפי בקרה</div>
            <div style={helperTextStyle}>
              נוספו עמודות עריכה עבור סטטוס, תאריך ביצוע, חתימה ומס׳ תוכנית / תעודת בדיקה.
            </div>

            <div style={rowEditorHeaderStyle}>
              <div>מס׳</div>
              <div>תיאור</div>
              <div>אחריות</div>
              <div>סטטוס</div>
              <div>תאריך ביצוע</div>
              <div>חתימה</div>
              <div>מס׳ תוכנית</div>
              <div>הערות</div>
            </div>

            {checklistForm.items.map((item, index) => (
              <div key={item.id} style={rowEditorStyle}>
                <div style={rowIndexStyle}>{index + 1}</div>

                <input
                  value={item.description}
                  onChange={(e) => updateChecklistItem(item.id, 'description', e.target.value)}
                  style={inputStyle}
                  placeholder="תיאור פעולת הבקרה"
                />

                <input
                  value={item.responsible}
                  onChange={(e) => updateChecklistItem(item.id, 'responsible', e.target.value)}
                  style={inputStyle}
                  placeholder="אחריות"
                />

                <select
                  value={item.status}
                  onChange={(e) =>
                    updateChecklistItem(item.id, 'status', e.target.value as ChecklistItem['status'])
                  }
                  style={inputStyle}
                >
                  <option value="לא נבדק">לא נבדק</option>
                  <option value="תקין">תקין</option>
                  <option value="לא תקין">לא תקין</option>
                </select>

                <input
                  type="date"
                  value={item.executionDate}
                  onChange={(e) => updateChecklistItem(item.id, 'executionDate', e.target.value)}
                  style={inputStyle}
                />

                <input
                  value={item.signature}
                  onChange={(e) => updateChecklistItem(item.id, 'signature', e.target.value)}
                  style={inputStyle}
                  placeholder="חתימה / שם"
                />

                <input
                  value={item.documentRef}
                  onChange={(e) => updateChecklistItem(item.id, 'documentRef', e.target.value)}
                  style={inputStyle}
                  placeholder="מס׳ תוכנית"
                />

                <input
                  value={item.notes}
                  onChange={(e) => updateChecklistItem(item.id, 'notes', e.target.value)}
                  style={inputStyle}
                  placeholder="הערות"
                />

                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                  <button style={dangerButtonStyle} onClick={() => removeChecklistItem(item.id)}>
                    מחק שורה
                  </button>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <button style={secondaryButtonStyle} onClick={addChecklistItem}>
                הוסף שורה
              </button>
              <button style={secondaryButtonStyle} onClick={() => setChecklistForm(createDefaultChecklist(checklistForm.templateKey))}>
                איפוס לפי תבנית
              </button>
            </div>

            <div style={mobileNoticeStyle}>
              אם תרצה, אפשר בהמשך להחזיר גם את שאר המודולים מהקובץ הישן (פרויקטים, אי התאמות, קטעי ניסוי וכו׳).
            </div>
          </aside>

          <main style={mainCardStyle}>
            <div style={sectionTitleStyle}>תצוגה להדפסה / PDF</div>
            <div style={previewShellStyle}>
              <div ref={checklistExportRef} style={exportSheetStyle}>
                <div style={exportTitleStyle}>{checklistForm.title || 'רשימת תיוג'}</div>

                <table style={exportMetaTableStyle}>
                  <tbody>
                    <tr>
                      <th style={metaHeaderCellStyle}>שם הפרויקט</th>
                      <td style={metaValueCellStyle}>{checklistForm.roadOrSection || '-'}</td>
                      <th style={metaHeaderCellStyle}>קבלן מבצע</th>
                      <td style={metaValueCellStyle}>{checklistForm.contractor || '-'}</td>
                      <th style={metaHeaderCellStyle}>קטע עבודה</th>
                      <td style={metaValueCellStyle}>{checklistForm.category || '-'}</td>
                      <th style={metaHeaderCellStyle}>מבנה / כביש</th>
                      <td style={metaValueCellStyle}>{checklistForm.structureName || '-'}</td>
                    </tr>
                    <tr>
                      <th style={metaHeaderCellStyle}>מספר רשימת תיוג</th>
                      <td style={metaValueCellStyle}>{checklistForm.checklistNo || '-'}</td>
                      <th style={metaHeaderCellStyle}>תבנית</th>
                      <td style={metaValueCellStyle}>{templateLabel}</td>
                      <th style={metaHeaderCellStyle}>קוד טופס</th>
                      <td style={metaValueCellStyle}>{templateCode || '-'}</td>
                      <th style={metaHeaderCellStyle}>תאריך</th>
                      <td style={metaValueCellStyle}>{checklistForm.date || '-'}</td>
                    </tr>
                    <tr>
                      <th style={metaHeaderCellStyle}>צד / מיקום</th>
                      <td style={metaValueCellStyle} colSpan={7}>
                        {checklistForm.location || '-'}
                      </td>
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

                <div style={notesBoxStyle}>
                  <strong>הערות כלליות:</strong> {checklistForm.notes || '-'}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
