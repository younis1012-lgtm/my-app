type NonconformanceRecord = any;
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

export function NonconformancesSection(props: {
  guardedBody: React.ReactNode;
  editingNonconformanceId: string | null;
  nonconformanceForm: Omit<NonconformanceRecord, 'id' | 'projectId' | 'savedAt'>;
  setNonconformanceForm: React.Dispatch<React.SetStateAction<Omit<NonconformanceRecord, 'id' | 'projectId' | 'savedAt'>>>;
  saveNonconformance: () => void;
  resetNonconformanceEditor: () => void;
}) {
  return (
    <div>
      <h2 style={styles.sectionTitle}>אי תאמות</h2>
      {props.guardedBody || (
        <>
          <FormModeBanner isEditing={Boolean(props.editingNonconformanceId)} />
          <div style={styles.formGrid}>
            <Field label="כותרת"><input style={styles.input} value={props.nonconformanceForm.title} onChange={(e) => props.setNonconformanceForm((prev) => ({ ...prev, title: e.target.value }))} /></Field>
            <Field label="מיקום"><input style={styles.input} value={props.nonconformanceForm.location} onChange={(e) => props.setNonconformanceForm((prev) => ({ ...prev, location: e.target.value }))} /></Field>
            <Field label="תאריך"><input type="date" style={styles.input} value={props.nonconformanceForm.date} onChange={(e) => props.setNonconformanceForm((prev) => ({ ...prev, date: e.target.value }))} /></Field>
            <Field label="נפתח על ידי"><input style={styles.input} value={props.nonconformanceForm.raisedBy} onChange={(e) => props.setNonconformanceForm((prev) => ({ ...prev, raisedBy: e.target.value }))} /></Field>
            <Field label="חומרה"><select style={styles.input} value={props.nonconformanceForm.severity} onChange={(e) => props.setNonconformanceForm((prev) => ({ ...prev, severity: e.target.value as any }))}><option value="נמוכה">נמוכה</option><option value="בינונית">בינונית</option><option value="גבוהה">גבוהה</option></select></Field>
            <Field label="סטטוס"><select style={styles.input} value={props.nonconformanceForm.status} onChange={(e) => props.setNonconformanceForm((prev) => ({ ...prev, status: e.target.value as any }))}><option value="פתוח">פתוח</option><option value="בטיפול">בטיפול</option><option value="נסגר">נסגר</option></select></Field>
            <Field label="תיאור" full><textarea style={styles.textarea} value={props.nonconformanceForm.description} onChange={(e) => props.setNonconformanceForm((prev) => ({ ...prev, description: e.target.value }))} /></Field>
            <Field label="פעולה נדרשת" full><textarea style={styles.textarea} value={props.nonconformanceForm.actionRequired} onChange={(e) => props.setNonconformanceForm((prev) => ({ ...prev, actionRequired: e.target.value }))} /></Field>
            <Field label="הערות" full><textarea style={styles.textarea} value={props.nonconformanceForm.notes} onChange={(e) => props.setNonconformanceForm((prev) => ({ ...prev, notes: e.target.value }))} /></Field>
          </div>
          <AttachmentsField value={(props.nonconformanceForm as any).images} onChange={(images) => props.setNonconformanceForm((prev) => ({ ...prev, images } as any))} />
          <ApprovalPanel value={props.nonconformanceForm.approval} onChange={(approval) => props.setNonconformanceForm((prev) => ({ ...prev, approval }))} />
          <div style={styles.buttonRow}><button style={styles.primaryBtn} onClick={props.saveNonconformance}>{props.editingNonconformanceId ? 'עדכן אי התאמה' : 'שמור אי התאמה'}</button><button style={styles.secondaryBtn} onClick={props.resetNonconformanceEditor}>בטל / נקה</button></div>
        </>
      )}
    </div>
  );
}
