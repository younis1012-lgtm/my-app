type TrialSectionRecord = any;
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

const downloadTextFile = (content: string, fileName: string, type: string) => {
  const blob = new Blob([content], { type });
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

const trialFieldGroups = [
  {
    title: 'פרטי הפרויקט',
    fields: [
      ['projectName', 'שם הפרויקט'],
      ['managementCompany', 'חברת ניהול'],
      ['mainContractor', 'קבלן ראשי'],
      ['qualityControlCompany', 'חברת בקרת איכות'],
    ],
  },
  {
    title: 'פרטי קטע הניסוי',
    fields: [
      ['sectionNo', "קטע מס'"],
      ['proofForActivityType', 'הוכחת היכולת לפעולה מסוג'],
      ['elementName', 'שם האלמנט'],
      ['subElement', 'תת אלמנט'],
      ['chainageSide', 'מחתך עד חתך/צד'],
    ],
  },
  {
    title: 'שלבי ביצוע קטע ניסוי',
    fields: [
      ['participants', 'משתתפים בקטע ניסוי'],
      ['materialsForUse', 'חומרים לשימוש'],
      ['equipmentForUse', 'הכלים בהם משתמשים'],
      ['executionDate', 'תאריך ביצוע', 'date'],
      ['trialDescription', 'תיאור קטע ניסוי', 'textarea'],
      ['trialConclusions', 'מסקנות קטע ניסוי', 'textarea'],
      ['correctiveAction', 'פעולה מתקנת (במידה ונדרשת)', 'textarea'],
    ],
  },
  {
    title: 'אישור',
    fields: [
      ['approvalDate', 'תאריך אישור', 'date'],
      ['signature', 'חתימה'],
    ],
  },
] as const;

const getTrialValue = (form: any, key: string) => {
  const aliases: Record<string, string[]> = {
    sectionNo: ['title'],
    executionDate: ['date'],
    trialDescription: ['spec'],
    trialConclusions: ['result'],
    correctiveAction: ['notes'],
    mainContractor: ['contractor'],
    signature: ['approvedBy'],
  };
  const direct = form?.[key];
  if (direct !== undefined && direct !== null && direct !== '') return direct;
  for (const alias of aliases[key] ?? []) {
    const value = form?.[alias];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
};

const updateTrialField = (setTrialSectionForm: any, key: string, value: string) => {
  const legacyMap: Record<string, string> = {
    sectionNo: 'title',
    executionDate: 'date',
    trialDescription: 'spec',
    trialConclusions: 'result',
    correctiveAction: 'notes',
    mainContractor: 'contractor',
    signature: 'approvedBy',
  };

  setTrialSectionForm((prev: any) => ({
    ...prev,
    [key]: value,
    ...(legacyMap[key] ? { [legacyMap[key]]: value } : {}),
  }));
};

const buildTrialWordHtml = (form: any) => {
  const value = (key: string) => htmlEscape(key.toLowerCase().includes('date') ? formatDate(getTrialValue(form, key)) : getTrialValue(form, key));
  const rows = [
    ['שם הפרויקט', value('projectName'), 'חברת ניהול', value('managementCompany')],
    ['קבלן ראשי', value('mainContractor'), 'חברת בקרת איכות', value('qualityControlCompany')],
    ["קטע מס'", value('sectionNo'), 'הוכחת היכולת לפעולה מסוג', value('proofForActivityType')],
    ['שם האלמנט', value('elementName'), 'תת אלמנט', value('subElement')],
    ['מחתך עד חתך/צד', value('chainageSide'), 'תאריך ביצוע', value('executionDate')],
  ];

  const bigRows = [
    ['משתתפים בקטע ניסוי', value('participants')],
    ['חומרים לשימוש', value('materialsForUse')],
    ['הכלים בהם משתמשים', value('equipmentForUse')],
    ['תיאור קטע ניסוי', value('trialDescription')],
    ['מסקנות קטע ניסוי', value('trialConclusions')],
    ['פעולה מתקנת (במידה ונדרשת)', value('correctiveAction')],
  ];

  return `<!doctype html>
<html dir="rtl">
<head>
<meta charset="utf-8">
<title>דוח קטע ניסוי</title>
<style>
@page { size: A4 landscape; margin: 1.2cm; }
body { direction: rtl; font-family: Arial, sans-serif; color:#0f172a; font-size:12px; }
table { border-collapse: collapse; width: 100%; table-layout: fixed; }
td, th { border: 1px solid #111827; padding: 6px 8px; vertical-align: top; }
.header td { height: 42px; text-align:center; font-weight:700; }
.label { background:#f8fafc; font-weight:700; width:18%; }
.value { min-height:22px; white-space:pre-wrap; }
.big td { height:58px; }
.signature td { height:42px; }
</style>
</head>
<body>
<table class="header">
<tr>
<td style="width:90px"></td>
<td style="font-size:18px">דוח קטע ניסוי</td>
<td style="width:80px">מהדורה</td>
<td style="width:120px">תאריך</td>
</tr>
<tr>
<td></td>
<td></td>
<td>0</td>
<td>${value('approvalDate') || value('executionDate')}</td>
</tr>
</table>
<br/>
<table>
${rows.map(([a,b,c,d]) => `<tr><td class="label">${a}</td><td class="value">${b}</td><td class="label">${c}</td><td class="value">${d}</td></tr>`).join('')}
</table>
<br/>
<table class="big">
${bigRows.map(([a,b]) => `<tr><td class="label" style="width:25%">${a}</td><td class="value">${b}</td></tr>`).join('')}
</table>
<br/>
<table class="signature">
<tr><td class="label">תאריך אישור</td><td>${value('approvalDate')}</td><td class="label">חתימה</td><td>${value('signature')}</td></tr>
</table>
</body>
</html>`;
};

export function TrialSectionsSection(props: {
  guardedBody: React.ReactNode;
  editingTrialSectionId: string | null;
  trialSectionForm: Omit<TrialSectionRecord, 'id' | 'projectId' | 'savedAt'>;
  setTrialSectionForm: React.Dispatch<React.SetStateAction<Omit<TrialSectionRecord, 'id' | 'projectId' | 'savedAt'>>>;
  saveTrialSection: () => void;
  resetTrialSectionEditor: () => void;
}) {
  const downloadFilledTrialWord = () => {
    const html = buildTrialWordHtml(props.trialSectionForm as any);
    const fileName = `${cleanFileName(getTrialValue(props.trialSectionForm, 'sectionNo'), 'דוח קטע ניסוי')}.doc`;
    downloadTextFile(html, fileName, 'application/msword;charset=utf-8');
  };

  return (
    <div>
      <h2 style={styles.sectionTitle}>קטעי ניסוי</h2>
      {props.guardedBody || (
        <>
          <FormModeBanner isEditing={Boolean(props.editingTrialSectionId)} />
          <div style={{ ...styles.card, marginBottom: 12, background: '#f8fafc' }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>טופס קטע ניסוי לפי קובץ Word המקורי</div>
            <div style={{ color: '#475569', lineHeight: 1.6 }}>
              שלבי הביצוע והשדות במסך זה נלקחו מטופס קטע הניסוי. לאחר מילוי ושמירה ניתן להוריד דוח Word מלא מתוך המערכת.
            </div>
          </div>

          {trialFieldGroups.map((group) => (
            <div key={group.title} style={{ ...styles.card, marginBottom: 12 }}>
              <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 18, fontWeight: 900 }}>{group.title}</h3>
              <div style={styles.formGrid}>
                {group.fields.map(([key, label, kind]) => (
                  <Field key={key} label={label} full={kind === 'textarea'}>
                    {kind === 'textarea' ? (
                      <textarea
                        style={styles.textarea}
                        value={String(getTrialValue(props.trialSectionForm, key))}
                        onChange={(e) => updateTrialField(props.setTrialSectionForm, key, e.target.value)}
                      />
                    ) : (
                      <input
                        type={kind === 'date' ? 'date' : 'text'}
                        style={styles.input}
                        value={String(getTrialValue(props.trialSectionForm, key))}
                        onChange={(e) => updateTrialField(props.setTrialSectionForm, key, e.target.value)}
                      />
                    )}
                  </Field>
                ))}
              </div>
            </div>
          ))}

          <Field label="סטטוס">
            <select style={styles.input} value={props.trialSectionForm.status} onChange={(e) => props.setTrialSectionForm((prev) => ({ ...prev, status: e.target.value as any }))}>
              <option value="טיוטה">טיוטה</option>
              <option value="אושר">אושר</option>
              <option value="נדחה">נדחה</option>
            </select>
          </Field>

          <AttachmentsField value={(props.trialSectionForm as any).images} onChange={(images) => props.setTrialSectionForm((prev) => ({ ...prev, images } as any))} />
          <ApprovalPanel value={props.trialSectionForm.approval} onChange={(approval) => props.setTrialSectionForm((prev) => ({ ...prev, approval }))} />

          <div style={styles.buttonRow}>
            <button style={styles.primaryBtn} onClick={props.saveTrialSection}>{props.editingTrialSectionId ? 'עדכן קטע ניסוי' : 'שמור קטע ניסוי'}</button>
            <button style={styles.secondaryBtn} type="button" onClick={downloadFilledTrialWord}>הורד Word מלא</button>
            <button style={styles.secondaryBtn} onClick={props.resetTrialSectionEditor}>בטל / נקה</button>
          </div>
        </>
      )}
    </div>
  );
}
