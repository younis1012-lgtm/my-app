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

const downloadTrialTemplate = () => {
  const link = document.createElement('a');
  link.href = '/templates/trial-section.doc';
  link.download = 'דוח קטע ניסוי.doc';
  document.body.appendChild(link);
  link.click();
  link.remove();
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
      <div style={{ color: '#475569', fontSize: 13, marginTop: 6 }}>ניתן לצרף את דוח קטע הניסוי המלא לאחר מילוי, וגם תמונות, PDF, Word ו-Excel.</div>
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

export function TrialSectionsSection(props: {
  guardedBody: React.ReactNode;
  editingTrialSectionId: string | null;
  trialSectionForm: Omit<TrialSectionRecord, 'id' | 'projectId' | 'savedAt'>;
  setTrialSectionForm: React.Dispatch<React.SetStateAction<Omit<TrialSectionRecord, 'id' | 'projectId' | 'savedAt'>>>;
  saveTrialSection: () => void;
  resetTrialSectionEditor: () => void;
}) {
  return (
    <div>
      <h2 style={styles.sectionTitle}>קטעי ניסוי</h2>
      {props.guardedBody || (
        <>
          <FormModeBanner isEditing={Boolean(props.editingTrialSectionId)} />

          <div style={{ ...styles.card, marginBottom: 12, background: '#f8fafc' }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>עבודה לפי דוח קטע ניסוי מקורי</div>
            <div style={{ color: '#475569', lineHeight: 1.6, marginBottom: 10 }}>
              הורד את קובץ ה-Word המקורי, מלא אותו בדיוק לפי התבנית, ולאחר מכן צרף אותו כאן ושמור את הרשומה במערכת.
            </div>
            <button type="button" style={styles.primaryBtn} onClick={downloadTrialTemplate}>
              הורד דוח קטע ניסוי Word
            </button>
          </div>

          <div style={styles.formGrid}>
            <Field label="שם קטע"><input style={styles.input} value={props.trialSectionForm.title} onChange={(e) => props.setTrialSectionForm((prev) => ({ ...prev, title: e.target.value }))} /></Field>
            <Field label="מיקום"><input style={styles.input} value={props.trialSectionForm.location} onChange={(e) => props.setTrialSectionForm((prev) => ({ ...prev, location: e.target.value }))} /></Field>
            <Field label="תאריך"><input type="date" style={styles.input} value={props.trialSectionForm.date} onChange={(e) => props.setTrialSectionForm((prev) => ({ ...prev, date: e.target.value }))} /></Field>
            <Field label="מאושר על ידי"><input style={styles.input} value={props.trialSectionForm.approvedBy} onChange={(e) => props.setTrialSectionForm((prev) => ({ ...prev, approvedBy: e.target.value }))} /></Field>
            <Field label="סטטוס"><select style={styles.input} value={props.trialSectionForm.status} onChange={(e) => props.setTrialSectionForm((prev) => ({ ...prev, status: e.target.value as any }))}><option value="טיוטה">טיוטה</option><option value="אושר">אושר</option><option value="נדחה">נדחה</option></select></Field>
            <Field label="הערות פנימיות" full><textarea style={styles.textarea} value={props.trialSectionForm.notes} onChange={(e) => props.setTrialSectionForm((prev) => ({ ...prev, notes: e.target.value }))} /></Field>
          </div>

          <AttachmentsField value={(props.trialSectionForm as any).images} onChange={(images) => props.setTrialSectionForm((prev) => ({ ...prev, images } as any))} />
          <ApprovalPanel value={props.trialSectionForm.approval} onChange={(approval) => props.setTrialSectionForm((prev) => ({ ...prev, approval }))} />
          <div style={styles.buttonRow}><button style={styles.primaryBtn} onClick={props.saveTrialSection}>{props.editingTrialSectionId ? 'עדכן קטע ניסוי' : 'שמור קטע ניסוי'}</button><button style={styles.secondaryBtn} onClick={props.resetTrialSectionEditor}>בטל / נקה</button></div>
        </>
      )}
    </div>
  );
}
