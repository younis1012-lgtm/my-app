import type { ChecklistAttachment, ChecklistItem, ChecklistRecord } from '../types';
import type { LabCertificateResults } from '../lib/labCertificateParser';
import { checklistTemplates } from '../checklistTemplates';
import { ApprovalPanel, Field, FormModeBanner, styles } from './common';
import LabCertificateScanButton from './LabCertificateScanButton';

type ChecklistForm = Omit<ChecklistRecord, 'id' | 'projectId' | 'savedAt'>;

type Props = {
  guardedBody: React.ReactNode;
  editingChecklistId: string | null;
  checklistForm: ChecklistForm;
  setChecklistForm: React.Dispatch<React.SetStateAction<ChecklistForm>>;
  checklistTemplateLabel: (value: any) => string;
  applyChecklistTemplate: (templateKey: any) => void;
  updateChecklistItem: (id: string, field: keyof ChecklistItem, value: string) => void;
  addChecklistItem: () => void;
  removeChecklistItem: (id: string) => void;
  saveChecklist: () => void;
  resetChecklistForm: () => void;
};

const normalizeAttachments = (value: unknown): ChecklistAttachment[] =>
  Array.isArray(value)
    ? value
        .filter((item) => item && typeof item === 'object')
        .map((item: any, index: number) => ({
          id: String(item.id ?? `${Date.now()}-${index}`),
          name: String(item.name ?? 'תעודת מעבדה'),
          type: String(item.type ?? 'application/pdf'),
          dataUrl: String(item.dataUrl ?? ''),
          uploadedAt: String(item.uploadedAt ?? ''),
          kind: item.kind === 'measurement' || item.kind === 'other' ? item.kind : 'lab',
          labResults: item.labResults ?? item.results,
        }))
    : [];

const fileMetaFromScan = (
  fileMeta: { name: string; type: string; dataUrl: string; uploadedAt: string } | undefined,
  existing: ChecklistAttachment | undefined,
  results: LabCertificateResults,
  item: ChecklistItem
): ChecklistAttachment => ({
  id: existing?.id ?? crypto.randomUUID(),
  name: fileMeta?.name || existing?.name || item.description || 'תעודת מעבדה',
  type: fileMeta?.type || existing?.type || 'application/pdf',
  dataUrl: fileMeta?.dataUrl || existing?.dataUrl || '',
  uploadedAt: fileMeta?.uploadedAt || existing?.uploadedAt || new Date().toLocaleString('he-IL'),
  kind: 'lab',
  labResults: results,
});

export function ChecklistsSection(props: Props) {
  const setItemAttachments = (itemId: string, attachments: ChecklistAttachment[]) => {
    props.setChecklistForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId
          ? ({
              ...item,
              attachments,
            } as ChecklistItem)
          : item
      ),
    }));
  };

  const saveLabResultsToItem = (
    item: ChecklistItem,
    results: LabCertificateResults,
    fileMeta?: { name: string; type: string; dataUrl: string; uploadedAt: string }
  ) => {
    const attachments = normalizeAttachments((item as any).attachments);
    const existingLab = attachments.find((attachment) => attachment.kind === 'lab');
    const otherAttachments = attachments.filter((attachment) => attachment.kind !== 'lab');
    const nextLab = fileMetaFromScan(fileMeta, existingLab, results, item);

    // שומרים תעודת מעבדה אחת בלבד לכל שורת בקרה כדי למנוע כפילויות.
    setItemAttachments(item.id, [...otherAttachments, nextLab]);
  };

  const removeLabAttachment = (item: ChecklistItem) => {
    const attachments = normalizeAttachments((item as any).attachments).filter((attachment) => attachment.kind !== 'lab');
    setItemAttachments(item.id, attachments);
  };

  return (
    <div>
      <h2 style={styles.sectionTitle}>רשימות תיוג</h2>
      {props.guardedBody || (
        <>
          <FormModeBanner isEditing={Boolean(props.editingChecklistId)} />

          <div style={{ ...styles.rowCard }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>בחירת תבנית</div>
            <div style={styles.chipRow}>
              {Object.keys(checklistTemplates).map((templateKey) => (
                <button
                  key={templateKey}
                  type="button"
                  style={{
                    ...styles.chip,
                    background: props.checklistForm.templateKey === templateKey ? '#0f172a' : '#fff',
                    color: props.checklistForm.templateKey === templateKey ? '#fff' : '#0f172a',
                  }}
                  onClick={() => props.applyChecklistTemplate(templateKey)}
                >
                  {checklistTemplates[templateKey as keyof typeof checklistTemplates].label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.formGrid}>
            <Field label="תבנית">
              <input readOnly style={{ ...styles.input, background: '#f8fafc' }} value={props.checklistTemplateLabel(props.checklistForm.templateKey)} />
            </Field>
            <Field label="שם רשימה">
              <input style={styles.input} value={props.checklistForm.title} onChange={(e) => props.setChecklistForm((prev) => ({ ...prev, title: e.target.value }))} />
            </Field>
            <Field label="קטגוריה">
              <input style={styles.input} value={props.checklistForm.category} onChange={(e) => props.setChecklistForm((prev) => ({ ...prev, category: e.target.value }))} />
            </Field>
            <Field label="מיקום">
              <input style={styles.input} value={props.checklistForm.location} onChange={(e) => props.setChecklistForm((prev) => ({ ...prev, location: e.target.value }))} />
            </Field>
            <Field label="תאריך">
              <input type="date" style={styles.input} value={props.checklistForm.date} onChange={(e) => props.setChecklistForm((prev) => ({ ...prev, date: e.target.value }))} />
            </Field>
            <Field label="קבלן מבצע">
              <input style={styles.input} value={props.checklistForm.contractor} onChange={(e) => props.setChecklistForm((prev) => ({ ...prev, contractor: e.target.value }))} />
            </Field>
            <Field label="הערות" full>
              <textarea style={styles.textarea} value={props.checklistForm.notes} onChange={(e) => props.setChecklistForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </Field>
          </div>

          <div style={styles.subHeader}>סעיפי בקרה</div>

          {props.checklistForm.items.map((item, index) => {
            const attachments = normalizeAttachments((item as any).attachments);
            const labAttachment = attachments.find((attachment) => attachment.kind === 'lab');

            return (
              <div key={item.id} style={styles.rowCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontWeight: 800 }}>שורה {index + 1}</div>
                  <button type="button" style={styles.dangerBtn} onClick={() => props.removeChecklistItem(item.id)}>
                    מחק שורה
                  </button>
                </div>

                <div style={styles.formGrid}>
                  <Field label="תיאור">
                    <input style={styles.input} value={item.description} onChange={(e) => props.updateChecklistItem(item.id, 'description', e.target.value)} />
                  </Field>
                  <Field label="אחראי">
                    <input style={styles.input} value={item.responsible} onChange={(e) => props.updateChecklistItem(item.id, 'responsible', e.target.value)} />
                  </Field>
                  <Field label="סטטוס">
                    <select style={styles.input} value={item.status} onChange={(e) => props.updateChecklistItem(item.id, 'status', e.target.value)}>
                      <option value="לא נבדק">לא נבדק</option>
                      <option value="תקין">תקין</option>
                      <option value="לא תקין">לא תקין</option>
                      <option value="לא רלוונטי">לא רלוונטי</option>
                    </select>
                  </Field>
                  <Field label="שם בודק">
                    <input style={styles.input} value={item.inspector} onChange={(e) => props.updateChecklistItem(item.id, 'inspector', e.target.value)} />
                  </Field>
                  <Field label="תאריך ביצוע">
                    <input type="date" style={styles.input} value={item.executionDate} onChange={(e) => props.updateChecklistItem(item.id, 'executionDate', e.target.value)} />
                  </Field>
                  <Field label="הערות" full>
                    <input style={styles.input} value={item.notes} onChange={(e) => props.updateChecklistItem(item.id, 'notes', e.target.value)} />
                  </Field>
                </div>

                <div style={{ marginTop: 12, border: '1px dashed #94a3b8', borderRadius: 14, padding: 12, background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 900 }}>
                      מסמך נדרש: תעודת מעבדה
                      {labAttachment?.labResults ? <span style={{ color: '#166534', marginRight: 8 }}>✓ נסרקה ואושרה</span> : null}
                    </div>

                    <LabCertificateScanButton
                      attachmentName={labAttachment?.name || item.description || 'תעודת מעבדה'}
                      existingAttachment={labAttachment?.dataUrl ? labAttachment : undefined}
                      initialResults={labAttachment?.labResults}
                      onSave={(results, fileMeta) => saveLabResultsToItem(item, results, fileMeta)}
                    />
                  </div>

                  {labAttachment ? (
                    <div style={{ marginTop: 10, border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        ✅ {labAttachment.name}
                      </span>
                      <button type="button" onClick={() => removeLabAttachment(item)} style={{ border: 0, background: 'transparent', color: '#b91c1c', fontWeight: 900, cursor: 'pointer' }}>
                        מחיקה
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, color: '#64748b', fontWeight: 700 }}>טרם צורפה תעודת מעבדה</div>
                  )}
                </div>
              </div>
            );
          })}

          <ApprovalPanel value={props.checklistForm.approval} onChange={(approval) => props.setChecklistForm((prev) => ({ ...prev, approval }))} />

          <div style={styles.buttonRow}>
            <button type="button" style={styles.secondaryBtn} onClick={props.addChecklistItem}>
              הוסף שורה
            </button>
            <button type="button" style={styles.primaryBtn} onClick={props.saveChecklist}>
              {props.editingChecklistId ? 'עדכן רשימה' : 'שמור רשימה'}
            </button>
            <button type="button" style={styles.secondaryBtn} onClick={props.resetChecklistForm}>
              בטל / נקה
            </button>
          </div>
        </>
      )}
    </div>
  );
}
