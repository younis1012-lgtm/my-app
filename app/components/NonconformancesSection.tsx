type NonconformanceRecord = any;
import JSZip from 'jszip';
import { ApprovalPanel, Field, FormModeBanner, styles } from './common';

type StoredAttachment = {
  name: string;
  type: string;
  dataUrl: string;
  uploadedAt: string;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<StoredAttachment>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        name: file.name,
        type: file.type,
        dataUrl: String(reader.result ?? ''),
        uploadedAt: new Date().toISOString(),
      });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const normalizeAttachments = (value: unknown): StoredAttachment[] =>
  Array.isArray(value)
    ? value
        .filter((item) => item && typeof item === 'object')
        .map((item: any) => ({
          name: String(item.name ?? 'קובץ'),
          type: String(item.type ?? ''),
          dataUrl: String(item.dataUrl ?? ''),
          uploadedAt: String(item.uploadedAt ?? ''),
        }))
        .filter((item) => item.dataUrl)
    : [];

const cleanFileName = (value: unknown, fallback: string) =>
  String(value ?? fallback)
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim() || fallback;

const htmlEscape = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatDate = (value: unknown) => {
  const text = String(value ?? '');
  if (!text) return '';
  const parts = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return parts ? `${parts[3]}.${parts[2]}.${parts[1]}` : text;
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

function AttachmentsField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: StoredAttachment[]) => void;
}) {
  const attachments = normalizeAttachments(value);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const nextFiles = await Promise.all(Array.from(files).map(readFileAsDataUrl));
    onChange([...attachments, ...nextFiles]);
  };

  const removeFile = (index: number) => onChange(attachments.filter((_, fileIndex) => fileIndex !== index));

  return (
    <div style={{ ...styles.card, marginTop: 10 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>תמונות וקבצים מצורפים</div>
      <input
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
        style={styles.input}
        onChange={(event) => {
          void addFiles(event.target.files);
          event.currentTarget.value = '';
        }}
      />
      <div style={{ color: '#475569', fontSize: 13, marginTop: 6 }}>ניתן לצרף תמונות, PDF, Word ו-Excel.</div>
      {attachments.length > 0 && (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          {attachments.map((file, index) => (
            <div key={`${file.name}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid #e2e8f0', borderRadius: 12, padding: 8 }}>
              <a href={file.dataUrl} download={file.name} target="_blank" rel="noreferrer" style={{ color: '#0f172a', fontWeight: 700 }}>
                {file.type.startsWith('image/') ? '🖼️' : '📎'} {file.name}
              </a>
              <button type="button" style={styles.dangerBtn} onClick={() => removeFile(index)}>מחק</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const nonconformanceGroups = [
  {
    title: 'פרטי הפרויקט',
    fields: [
      ['mainContractor', 'קבלן ראשי'],
      ['projectName', 'שם הפרויקט'],
      ['managementCompany', 'חברת ניהול'],
      ['contractNo', "חוזה מס'"],
      ['qualityControlCompany', 'חברת בקרת איכות'],
      ['qualityAssuranceCompany', 'חברת הבטחת איכות'],
      ['projectTreeTask', 'משימה מעץ פרויקט'],
    ],
  },
  {
    title: 'פרטי תוכנית ואי התאמה',
    fields: [
      ['planNo', "מס' תוכנית"],
      ['planRevision', 'מהדורה'],
      ['planName', 'שם תוכנית'],
      ['nonconformanceNo', "אי התאמה מס'"],
    ],
  },
  {
    title: 'פתיחת אי התאמה',
    fields: [
      ['openedBy', 'נפתח'],
      ['openedRole', 'תפקיד'],
      ['openedName', 'שם'],
      ['openingDate', 'תאריך הפתיחה', 'date'],
    ],
  },
  {
    title: 'פרטי המבנה',
    fields: [
      ['section', 'קטע'],
      ['structure', 'מבנה'],
      ['element', 'אלמנט'],
      ['subElement', 'תת אלמנט'],
      ['fromChainage', 'מחתך'],
      ['toChainage', 'עד חתך'],
      ['offset', 'הסט'],
      ['grade', 'דרגה'],
    ],
  },
  {
    title: 'ניהול סגירה והשפעה',
    fields: [
      ['estimatedCloseDate', 'תאריך סגירה משוער', 'date'],
      ['updatedEstimatedCloseDate', 'תאריך סגירה משוער מעודכן', 'date'],
      ['delayDays', "מס' ימי עיכוב לסגירה"],
      ['breakage', 'שבר'],
      ['qualityImpact', 'השפעה על איכות'],
    ],
  },
  {
    title: 'תיאור וטיפול',
    fields: [
      ['description', 'תאור אי ההתאמה', 'textarea'],
      ['responsibleParty', 'גורם אחראי לליקוי תכנון, ביצוע, ספק', 'textarea'],
      ['actionRequired', 'טיפול נדרש', 'textarea'],
      ['handler', 'גורם המטפל'],
      ['correctiveActionDetails', 'פירוט ביצוע פעולה מתקנת', 'textarea'],
      ['notes', 'הערות', 'textarea'],
    ],
  },
  {
    title: 'אישור ביצוע פעילות מתקנת',
    fields: [
      ['closedBy', 'נסגרה ע"י'],
      ['closingRole', 'תפקיד'],
      ['closingName', 'שם'],
      ['closeDate', 'תאריך סגירה', 'date'],
    ],
  },
  {
    title: 'חתימות נוספות',
    fields: [
      ['additionalSignatureRole', 'תפקיד'],
      ['additionalSignatureName', 'שם'],
      ['additionalSignature', 'חתימה'],
      ['additionalSignatureDate', 'תאריך', 'date'],
      ['additionalSignatureStatus', 'סטטוס (מאושר / לא מאושר)'],
    ],
  },
] as const;

const legacyAliases: Record<string, string[]> = {
  nonconformanceNo: ['title'],
  openingDate: ['date'],
  openedName: ['raisedBy'],
  description: ['description'],
  actionRequired: ['actionRequired'],
  correctiveActionDetails: ['notes'],
  qualityImpact: ['severity'],
};

const legacyWriteMap: Record<string, string> = {
  nonconformanceNo: 'title',
  openingDate: 'date',
  openedName: 'raisedBy',
  description: 'description',
  actionRequired: 'actionRequired',
  correctiveActionDetails: 'notes',
  qualityImpact: 'severity',
};

const getValue = (form: any, key: string) => {
  const direct = form?.[key];
  if (direct !== undefined && direct !== null && direct !== '') return direct;
  for (const alias of legacyAliases[key] ?? []) {
    const value = form?.[alias];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
};

const updateField = (setNonconformanceForm: any, key: string, value: string) => {
  setNonconformanceForm((prev: any) => ({
    ...prev,
    [key]: value,
    ...(legacyWriteMap[key] ? { [legacyWriteMap[key]]: value } : {}),
  }));
};

const excelNs = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

const columnNumber = (letters: string) => {
  let number = 0;
  for (const letter of letters.toUpperCase()) number = number * 26 + letter.charCodeAt(0) - 64;
  return number;
};

const cellColumnIndex = (cellRef: string) => columnNumber(cellRef.replace(/\d+/g, ''));
const cellRowIndex = (cellRef: string) => Number(cellRef.replace(/\D+/g, ''));

const getOrCreateRow = (doc: Document, sheetData: Element, rowNumber: number) => {
  const rows = Array.from(sheetData.getElementsByTagNameNS(excelNs, 'row'));
  let row = rows.find((candidate) => candidate.getAttribute('r') === String(rowNumber));
  if (row) return row;
  row = doc.createElementNS(excelNs, 'row');
  row.setAttribute('r', String(rowNumber));
  const nextRow = rows.find((candidate) => Number(candidate.getAttribute('r')) > rowNumber);
  sheetData.insertBefore(row, nextRow ?? null);
  return row;
};

const getOrCreateCell = (doc: Document, row: Element, cellRef: string) => {
  const cells = Array.from(row.getElementsByTagNameNS(excelNs, 'c'));
  let cell = cells.find((candidate) => candidate.getAttribute('r') === cellRef);
  if (cell) return cell;
  cell = doc.createElementNS(excelNs, 'c');
  cell.setAttribute('r', cellRef);
  const nextCell = cells.find((candidate) => cellColumnIndex(candidate.getAttribute('r') ?? 'A1') > cellColumnIndex(cellRef));
  row.insertBefore(cell, nextCell ?? null);
  return cell;
};

const setCell = (doc: Document, sheetData: Element, cellRef: string, value: string | number) => {
  const row = getOrCreateRow(doc, sheetData, cellRowIndex(cellRef));
  const cell = getOrCreateCell(doc, row, cellRef);
  Array.from(cell.childNodes).forEach((child) => cell.removeChild(child));
  cell.setAttribute('t', 'inlineStr');
  const is = doc.createElementNS(excelNs, 'is');
  const t = doc.createElementNS(excelNs, 't');
  t.setAttribute('xml:space', 'preserve');
  t.textContent = String(value ?? '');
  is.appendChild(t);
  cell.appendChild(is);
};

const valuesForExcel = (form: any) => {
  const v = (key: string) => key.toLowerCase().includes('date') ? formatDate(getValue(form, key)) : String(getValue(form, key) ?? '');
  return {
    D6: v('mainContractor'),
    G6: v('projectName'),
    D7: v('managementCompany'),
    G7: v('contractNo'),
    D8: v('qualityControlCompany'),
    G8: v('qualityAssuranceCompany'),
    D10: v('projectTreeTask'),
    D12: v('planNo'),
    F12: v('planRevision'),
    H12: v('planName'),
    D15: v('nonconformanceNo'),
    B18: v('openedBy'),
    D18: v('openedRole'),
    F18: v('openedName'),
    H18: v('openingDate'),
    B22: v('section'),
    C22: v('structure'),
    D22: v('element'),
    E22: v('subElement'),
    F22: v('fromChainage'),
    G22: v('toChainage'),
    H22: v('offset'),
    I22: v('grade'),
    D23: v('estimatedCloseDate'),
    D24: v('updatedEstimatedCloseDate'),
    D25: v('delayDays'),
    D26: v('breakage'),
    D27: v('qualityImpact'),
    D28: v('description'),
    D29: v('responsibleParty'),
    D30: v('actionRequired'),
    D31: v('handler'),
    D32: v('correctiveActionDetails'),
    D33: v('notes'),
    B37: v('closedBy'),
    D37: v('closingRole'),
    F37: v('closingName'),
    H37: v('closeDate'),
    B42: v('additionalSignatureRole'),
    D42: v('additionalSignatureName'),
    F42: v('additionalSignature'),
    G42: v('additionalSignatureDate'),
    H42: v('additionalSignatureStatus'),
  };
};

const patchNonconformanceWorkbook = async (buffer: ArrayBuffer, form: any) => {
  const zip = await JSZip.loadAsync(buffer);
  const sheetPath = 'xl/worksheets/sheet1.xml';
  const worksheetFile = zip.file(sheetPath);
  if (!worksheetFile) throw new Error('לא נמצא sheet1.xml בתוך טופס אי התאמה');
  const xml = await worksheetFile.async('text');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const sheetData = doc.getElementsByTagNameNS(excelNs, 'sheetData')[0];
  if (!sheetData) throw new Error('מבנה Excel לא תקין — sheetData חסר');

  Object.entries(valuesForExcel(form)).forEach(([cell, value]) => setCell(doc, sheetData, cell, value));
  zip.file(sheetPath, new XMLSerializer().serializeToString(doc));
  return await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

const buildFallbackExcelHtml = (form: any) => {
  const rows: Array<[string, string]> = [];
  nonconformanceGroups.forEach((group) => {
    rows.push([group.title, '']);
    group.fields.forEach(([key, label]) => rows.push([label, String(getValue(form, key) ?? '')]));
  });

  return `<!doctype html>
<html dir="rtl"><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;direction:rtl}
table{border-collapse:collapse;width:100%}
td{border:1px solid #111827;padding:8px;vertical-align:top}
.section{background:#e2e8f0;font-weight:900}
.label{background:#f8fafc;font-weight:700;width:35%}
</style></head><body>
<h2>טופס אי התאמה</h2>
<table>${rows.map(([a,b]) => b === '' ? `<tr><td colspan="2" class="section">${htmlEscape(a)}</td></tr>` : `<tr><td class="label">${htmlEscape(a)}</td><td>${htmlEscape(b)}</td></tr>`).join('')}</table>
</body></html>`;
};

export function NonconformancesSection(props: {
  guardedBody: React.ReactNode;
  editingNonconformanceId: string | null;
  nonconformanceForm: Omit<NonconformanceRecord, 'id' | 'projectId' | 'savedAt'>;
  setNonconformanceForm: React.Dispatch<React.SetStateAction<Omit<NonconformanceRecord, 'id' | 'projectId' | 'savedAt'>>>;
  saveNonconformance: () => void;
  resetNonconformanceEditor: () => void;
}) {
  const downloadFilledExcel = async () => {
    const fileName = `${cleanFileName(getValue(props.nonconformanceForm, 'nonconformanceNo'), 'טופס אי התאמה')}.xlsx`;
    try {
      const response = await fetch('/templates/nonconformance.xlsx');
      if (!response.ok) throw new Error('תבנית Excel לא נמצאה');
      const blob = await patchNonconformanceWorkbook(await response.arrayBuffer(), props.nonconformanceForm as any);
      downloadBlob(blob, fileName);
    } catch (error) {
      console.error(error);
      const fallback = buildFallbackExcelHtml(props.nonconformanceForm as any);
      downloadBlob(new Blob([fallback], { type: 'application/vnd.ms-excel;charset=utf-8' }), fileName.replace(/\.xlsx$/i, '.xls'));
    }
  };

  return (
    <div>
      <h2 style={styles.sectionTitle}>אי תאמות</h2>
      {props.guardedBody || (
        <>
          <FormModeBanner isEditing={Boolean(props.editingNonconformanceId)} />
          <div style={{ ...styles.card, marginBottom: 12, background: '#f8fafc' }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>טופס אי התאמה לפי קובץ Excel המקורי</div>
            <div style={{ color: '#475569', lineHeight: 1.6 }}>
              כל שלבי הטופס נלקחו מטופס האקסל: פתיחה, פרטי מבנה, טיפול נדרש, פעולה מתקנת, סגירה, חתימות ומסמכים.
            </div>
          </div>

          {nonconformanceGroups.map((group) => (
            <div key={group.title} style={{ ...styles.card, marginBottom: 12 }}>
              <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 18, fontWeight: 900 }}>{group.title}</h3>
              <div style={styles.formGrid}>
                {group.fields.map(([key, label, kind]) => (
                  <Field key={key} label={label} full={kind === 'textarea'}>
                    {kind === 'textarea' ? (
                      <textarea
                        style={styles.textarea}
                        value={String(getValue(props.nonconformanceForm, key))}
                        onChange={(e) => updateField(props.setNonconformanceForm, key, e.target.value)}
                      />
                    ) : (
                      <input
                        type={kind === 'date' ? 'date' : 'text'}
                        style={styles.input}
                        value={String(getValue(props.nonconformanceForm, key))}
                        onChange={(e) => updateField(props.setNonconformanceForm, key, e.target.value)}
                      />
                    )}
                  </Field>
                ))}
              </div>
            </div>
          ))}

          <Field label="חומרה / השפעה">
            <select style={styles.input} value={props.nonconformanceForm.severity} onChange={(e) => props.setNonconformanceForm((prev) => ({ ...prev, severity: e.target.value as any, qualityImpact: e.target.value as any }))}>
              <option value="נמוכה">נמוכה</option>
              <option value="בינונית">בינונית</option>
              <option value="גבוהה">גבוהה</option>
            </select>
          </Field>

          <Field label="סטטוס">
            <select style={styles.input} value={props.nonconformanceForm.status} onChange={(e) => props.setNonconformanceForm((prev) => ({ ...prev, status: e.target.value as any }))}>
              <option value="פתוח">פתוח</option>
              <option value="בטיפול">בטיפול</option>
              <option value="נסגר">נסגר</option>
            </select>
          </Field>

          <AttachmentsField value={(props.nonconformanceForm as any).images} onChange={(images) => props.setNonconformanceForm((prev) => ({ ...prev, images } as any))} />
          <ApprovalPanel value={props.nonconformanceForm.approval} onChange={(approval) => props.setNonconformanceForm((prev) => ({ ...prev, approval }))} />

          <div style={styles.buttonRow}>
            <button style={styles.primaryBtn} onClick={props.saveNonconformance}>{props.editingNonconformanceId ? 'עדכן אי התאמה' : 'שמור אי התאמה'}</button>
            <button style={styles.secondaryBtn} type="button" onClick={downloadFilledExcel}>הורד Excel מלא</button>
            <button style={styles.secondaryBtn} onClick={props.resetNonconformanceEditor}>בטל / נקה</button>
          </div>
        </>
      )}
    </div>
  );
}
