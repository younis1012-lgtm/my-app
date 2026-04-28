import type { ChecklistItem, ChecklistRecord } from '../types';
import { checklistTemplates } from '../checklistTemplates';
import { ApprovalPanel, Field, FormModeBanner, styles } from './common';
import LabCertificateScanButton from './LabCertificateScanButton';
import type { LabCertificateResults } from '../lib/labCertificateParser';

type ChecklistAttachment = {
  id?: string;
  name: string;
  type?: string;
  dataUrl?: string;
  kind: 'lab' | 'measurement' | 'document' | 'other';
  uploadedAt: string;
  labResults?: LabCertificateResults;
  results?: LabCertificateResults;
};

type ChecklistItemWithAttachments = ChecklistItem & {
  attachments?: ChecklistAttachment[];
  labResults?: LabCertificateResults;
  results?: LabCertificateResults;
};

const normalizeAttachments = (value: unknown): ChecklistAttachment[] =>
  Array.isArray(value)
    ? value
        .filter((item) => item && typeof item === 'object')
        .map((item: any, index: number) => ({
          id: String(item.id ?? `${Date.now()}-${index}`),
          name: String(item.name ?? 'תעודת מעבדה'),
          type: String(item.type ?? ''),
          dataUrl: String(item.dataUrl ?? ''),
          kind: item.kind === 'lab' || item.kind === 'measurement' || item.kind === 'document' ? item.kind : 'other',
          uploadedAt: String(item.uploadedAt ?? new Date().toLocaleString('he-IL')),
          labResults: item.labResults ?? item.results,
          results: item.results ?? item.labResults,
        }))
    : [];

const hasLabResults = (item: ChecklistItemWithAttachments) => {
  const attachments = normalizeAttachments(item.attachments);
  return Boolean(item.labResults || item.results || attachments.some((attachment) => attachment.kind === 'lab' && (attachment.labResults || attachment.results)));
};

export function ChecklistsSection(props: {
  guardedBody: React.ReactNode;
  editingChecklistId: string | null;
  checklistForm: Omit<ChecklistRecord, 'id' | 'projectId' | 'savedAt'>;
  setChecklistForm: React.Dispatch<React.SetStateAction<Omit<ChecklistRecord, 'id' | 'projectId' | 'savedAt'>>>;
  checklistTemplateLabel: (value: any) => string;
  applyChecklistTemplate: (templateKey: any) => void;
  updateChecklistItem: (id: string, field: keyof ChecklistItem, value: string) => void;
  addChecklistItem: () => void;
  removeChecklistItem: (id: string) => void;
  saveChecklist: () => void;
  resetChecklistForm: () => void;
}) {
  const saveLabResultsToItem = (itemId: string, itemDescription: string, results: LabCertificateResults) => {
    props.setChecklistForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== itemId) return item;
        const currentItem = item as ChecklistItemWithAttachments;
        const existing = normalizeAttachments(currentItem.attachments).filter((attachment) => attachment.kind !== 'lab');
        const certificateName = results.certificateNo ? `תעודת מעבדה ${results.certificateNo}` : itemDescription || 'תעודת מעבדה';
        return {
          ...currentItem,
          labResults: results,
          results,
          attachments: [
            ...existing,
            {
              id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`,
              name: certificateName,
              kind: 'lab',
              uploadedAt: new Date().toLocaleString('he-IL'),
              labResults: results,
              results,
            },
          ],
        } as ChecklistItem;
      }),
    }));
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
            <Field label="תבנית"><input readOnly style={{ ...styles.input, background: '#f8fafc' }} value={props.checklistTemplateLabel(props.checklistForm.templateKey)} /></Field>
            <Field label="שם רשימה"><input style={styles.input} value={props.checklistForm.title} onChange={(e) => props.setChecklistForm((prev) => ({ ...prev, title: e.target.value }))} /></Field>
            <Field label="קטגוריה"><input style={styles.input} value={props.checklistForm.category} onChange={(e) => props.setChecklistForm((prev) => ({ ...prev, category: e.target.value }))} /></Field>
            <Field label="מיקום"><input style={styles.input} value={props.checklistForm.location} onChange={(e) => props.setChecklistForm((prev) => ({ ...prev, location: e.target.value }))} /></Field>
            <Field label="תאריך"><input type="date" style={styles.input} value={props.checklistForm.date} onChange={(e) => props.setChecklistForm((prev) => ({ ...prev, date: e.target.value }))} /></Field>
            <Field label="קבלן מבצע"><input style={styles.input} value={props.checklistForm.contractor} onChange={(e) => props.setChecklistForm((prev) => ({ ...prev, contractor: e.target.value }))} /></Field>
            <Field label="הערות" full><textarea style={styles.textarea} value={props.checklistForm.notes} onChange={(e) => props.setChecklistForm((prev) => ({ ...prev, notes: e.target.value }))} /></Field>
          </div>

          <div style={styles.subHeader}>סעיפי בקרה</div>
          {props.checklistForm.items.map((item, index) => {
            const currentItem = item as ChecklistItemWithAttachments;
            const scanned = hasLabResults(currentItem);
            const existingResults = currentItem.labResults ?? currentItem.results ?? normalizeAttachments(currentItem.attachments).find((attachment) => attachment.kind === 'lab')?.labResults;
            return (
              <div key={item.id} style={styles.rowCard}>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>שורה {index + 1}</div>
                <div style={styles.formGrid}>
                  <Field label="תיאור"><input style={styles.input} value={item.description} onChange={(e) => props.updateChecklistItem(item.id, 'description', e.target.value)} /></Field>
                  <Field label="אחראי"><input style={styles.input} value={item.responsible} onChange={(e) => props.updateChecklistItem(item.id, 'responsible', e.target.value)} /></Field>
                  <Field label="סטטוס"><select style={styles.input} value={item.status} onChange={(e) => props.updateChecklistItem(item.id, 'status', e.target.value)}><option value="לא נבדק">לא נבדק</option><option value="תקין">תקין</option><option value="לא תקין">לא תקין</option><option value="לא רלוונטי">לא רלוונטי</option></select></Field>
                  <Field label="שם בודק"><input style={styles.input} value={item.inspector} onChange={(e) => props.updateChecklistItem(item.id, 'inspector', e.target.value)} /></Field>
                  <Field label="תאריך ביצוע"><input type="date" style={styles.input} value={item.executionDate} onChange={(e) => props.updateChecklistItem(item.id, 'executionDate', e.target.value)} /></Field>
                  <Field label="הערות" full><input style={styles.input} value={item.notes} onChange={(e) => props.updateChecklistItem(item.id, 'notes', e.target.value)} /></Field>
                </div>

                <div style={{ marginTop: 12, border: '1px dashed #94a3b8', borderRadius: 12, padding: 12, background: scanned ? '#ecfdf5' : '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>תעודת מעבדה לסעיף זה</div>
                      <div style={{ color: scanned ? '#166534' : '#64748b', marginTop: 4, fontWeight: 700 }}>
                        {scanned ? 'נסרקה תעודה — הנתונים ייכנסו לריכוזים אוטומטית לאחר שמירת הרשימה.' : 'סרוק PDF של תעודת מעבדה, בדוק את הנתונים ואשר שמירה.'}
                      </div>
                    </div>
                    <LabCertificateScanButton
                      attachmentName={item.description || `שורה ${index + 1}`}
                      initialResults={existingResults}
                      onSave={(results) => saveLabResultsToItem(item.id, item.description, results)}
                    />
                  </div>
                </div>

                <button style={{ ...styles.dangerBtn, marginTop: 10 }} onClick={() => props.removeChecklistItem(item.id)}>מחק שורה</button>
              </div>
            );
          })}

          <ApprovalPanel value={props.checklistForm.approval} onChange={(approval) => props.setChecklistForm((prev) => ({ ...prev, approval }))} />
          <div style={styles.buttonRow}>
            <button style={styles.secondaryBtn} onClick={props.addChecklistItem}>הוסף שורה</button>
            <button style={styles.primaryBtn} onClick={props.saveChecklist}>{props.editingChecklistId ? 'עדכן רשימה' : 'שמור רשימה'}</button>
            <button style={styles.secondaryBtn} onClick={props.resetChecklistForm}>בטל / נקה</button>
          </div>
        </>
      )}
    </div>
  );
}
