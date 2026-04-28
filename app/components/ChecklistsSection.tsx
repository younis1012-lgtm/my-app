import type { ChecklistItem, ChecklistRecord, ChecklistAttachment } from '../types';
import { checklistTemplates } from '../checklistTemplates';
import { ApprovalPanel, Field, FormModeBanner, styles } from './common';
import LabCertificateScanButton from './LabCertificateScanButton';
import type { LabCertificateResults } from '../lib/labCertificateParser';

type ChecklistsSectionProps = {
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
};

const attachmentLabel = (attachment: ChecklistAttachment) => {
  if (attachment.labResults?.certificateNo) return `${attachment.name} · תעודה ${attachment.labResults.certificateNo}`;
  return attachment.name;
};

export function ChecklistsSection(props: ChecklistsSectionProps) {
  const updateItemAttachments = (itemId: string, attachments: ChecklistAttachment[]) => {
    props.setChecklistForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId ? { ...item, attachments } : item)),
    }));
  };

  const saveLabResultsToItem = (
    item: ChecklistItem,
    results: LabCertificateResults,
    fileInfo?: { name: string; type: string; dataUrl: string; uploadedAt: string }
  ) => {
    const existing = Array.isArray(item.attachments) ? item.attachments : [];
    const fileName = fileInfo?.name || results.certificateNo || 'תעודת מעבדה';
    const uploadedAt = fileInfo?.uploadedAt || new Date().toLocaleString('he-IL');

    const labAttachment: ChecklistAttachment = {
      id: existing.find((attachment) => attachment.kind === 'lab' && attachment.name === fileName)?.id || crypto.randomUUID(),
      name: fileName,
      type: fileInfo?.type || 'application/pdf',
      dataUrl: fileInfo?.dataUrl || existing.find((attachment) => attachment.kind === 'lab' && attachment.name === fileName)?.dataUrl || '',
      uploadedAt,
      kind: 'lab',
      labResults: results,
    };

    const withoutSameLab = existing.filter(
      (attachment) => !(attachment.kind === 'lab' && attachment.name === labAttachment.name)
    );

    updateItemAttachments(item.id, [...withoutSameLab, labAttachment]);
  };

  const removeAttachment = (item: ChecklistItem, attachmentId: string) => {
    updateItemAttachments(
      item.id,
      (item.attachments ?? []).filter((attachment) => attachment.id !== attachmentId)
    );
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
            const labAttachments = (item.attachments ?? []).filter((attachment) => attachment.kind === 'lab');
            const latestLab = labAttachments[labAttachments.length - 1];

            return (
              <div key={item.id} style={styles.rowCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontWeight: 800 }}>שורה {index + 1}</div>
                  <button type="button" style={styles.dangerBtn} onClick={() => props.removeChecklistItem(item.id)}>מחק שורה</button>
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

                <div
                  style={{
                    marginTop: 14,
                    border: '1px dashed #94a3b8',
                    borderRadius: 14,
                    padding: 12,
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 900 }}>
                      מסמך נדרש: תעודת מעבדה
                      {latestLab?.labResults ? <span style={{ color: '#166534', marginRight: 8 }}>✓ נסרק ונשמר לריכוזים</span> : null}
                    </div>

                    <LabCertificateScanButton
                      attachmentName={latestLab?.name || item.description || 'תעודת מעבדה'}
                      initialResults={latestLab?.labResults}
                      onSave={(results, fileInfo) => saveLabResultsToItem(item, results, fileInfo)}
                    />
                  </div>

                  <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                    {labAttachments.length ? (
                      labAttachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 10,
                            border: '1px solid #e2e8f0',
                            borderRadius: 10,
                            padding: '7px 10px',
                            background: '#f8fafc',
                          }}
                        >
                          <span style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {attachment.labResults ? '✅' : '📎'} {attachmentLabel(attachment)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(item, attachment.id)}
                            style={{ border: 0, background: 'transparent', color: '#b91c1c', fontWeight: 900, cursor: 'pointer' }}
                          >
                            מחיקה
                          </button>
                        </div>
                      ))
                    ) : (
                      <span style={{ color: '#64748b' }}>טרם צורפה/נסרקה תעודת מעבדה</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <ApprovalPanel value={props.checklistForm.approval} onChange={(approval) => props.setChecklistForm((prev) => ({ ...prev, approval }))} />

          <div style={styles.buttonRow}>
            <button type="button" style={styles.secondaryBtn} onClick={props.addChecklistItem}>הוסף שורה</button>
            <button type="button" style={styles.primaryBtn} onClick={props.saveChecklist}>{props.editingChecklistId ? 'עדכן רשימה' : 'שמור רשימה'}</button>
            <button type="button" style={styles.secondaryBtn} onClick={props.resetChecklistForm}>בטל / נקה</button>
          </div>
        </>
      )}
    </div>
  );
}
