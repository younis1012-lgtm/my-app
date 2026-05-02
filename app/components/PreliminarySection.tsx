import { useMemo, useState } from 'react';
import type React from 'react';
import type { PreliminaryRecord, PreliminaryTab } from '../types';
import { ApprovalPanel, Field, FormModeBanner, styles } from './common';

type Props = {
  guardedBody: React.ReactNode;
  preliminaryTab: PreliminaryTab;
  setPreliminaryTab: (tab: PreliminaryTab) => void;
  editingPreliminaryId: string | null;
  supplierPreliminaryForm: Omit<PreliminaryRecord, 'id' | 'projectId' | 'savedAt'>;
  subcontractorPreliminaryForm: Omit<PreliminaryRecord, 'id' | 'projectId' | 'savedAt'>;
  materialPreliminaryForm: Omit<PreliminaryRecord, 'id' | 'projectId' | 'savedAt'>;
  setSupplierPreliminaryForm: React.Dispatch<React.SetStateAction<Omit<PreliminaryRecord, 'id' | 'projectId' | 'savedAt'>>>;
  setSubcontractorPreliminaryForm: React.Dispatch<React.SetStateAction<Omit<PreliminaryRecord, 'id' | 'projectId' | 'savedAt'>>>;
  setMaterialPreliminaryForm: React.Dispatch<React.SetStateAction<Omit<PreliminaryRecord, 'id' | 'projectId' | 'savedAt'>>>;
  savePreliminary: (subtype: PreliminaryTab) => void;
  resetPreliminaryEditor: () => void;
  labelForPreliminary: (subtype: PreliminaryTab) => string;
};

type DocumentRow = {
  id: string;
  details: string;
  exists: boolean;
  certificateNo: string;
  expiryDate: string;
  attachments: Array<{ name: string; type: string; dataUrl: string; uploadedAt: string }>;
  ocrNotes?: string;
};

const PROJECT_QC_NAME = 'יונס אברהים';
const PROJECT_QA_NAME = 'תיקו הנדסה בע"מ';

const inputStyle: React.CSSProperties = { ...styles.input, minHeight: 42 };
const tableCell: React.CSSProperties = { border: '1px solid #cbd5e1', padding: 8, textAlign: 'center', verticalAlign: 'top' };

const entityKeyByTab: Record<PreliminaryTab, 'supplier' | 'subcontractor' | 'material'> = {
  suppliers: 'supplier',
  subcontractors: 'subcontractor',
  materials: 'material',
};

function asRows(value: unknown): DocumentRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row: any, index) => ({
    id: String(row?.id ?? `${Date.now()}-${index}`),
    details: String(row?.details ?? row?.documentType ?? row?.type ?? ''),
    exists: row?.exists !== false,
    certificateNo: String(row?.certificateNo ?? row?.certificate_no ?? ''),
    expiryDate: String(row?.expiryDate ?? row?.expiry_date ?? ''),
    attachments: Array.isArray(row?.attachments) ? row.attachments : [],
    ocrNotes: String(row?.ocrNotes ?? row?.notes ?? ''),
  }));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('לא ניתן לקרוא את הקובץ'));
    reader.readAsDataURL(file);
  });
}

function normalizeDate(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const iso = raw.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  return raw;
}

function getActiveForm(props: Props) {
  if (props.preliminaryTab === 'suppliers') return props.supplierPreliminaryForm;
  if (props.preliminaryTab === 'subcontractors') return props.subcontractorPreliminaryForm;
  return props.materialPreliminaryForm;
}

function getActiveSetter(props: Props) {
  if (props.preliminaryTab === 'suppliers') return props.setSupplierPreliminaryForm;
  if (props.preliminaryTab === 'subcontractors') return props.setSubcontractorPreliminaryForm;
  return props.setMaterialPreliminaryForm;
}

export function PreliminarySection(props: Props) {
  const [ocrBusy, setOcrBusy] = useState(false);
  const form = getActiveForm(props);
  const setForm = getActiveSetter(props);
  const entityKey = entityKeyByTab[props.preliminaryTab];
  const entity = ((form as any)[entityKey] ?? {}) as any;
  const documents = useMemo(() => asRows(entity.certificates ?? entity.documents ?? []), [entity.certificates, entity.documents]);

  const patchEntity = (patch: Record<string, any>) => {
    setForm((prev: any) => ({
      ...prev,
      [entityKey]: {
        ...(prev?.[entityKey] ?? {}),
        ...patch,
      },
    }));
  };

  const setDocuments = (next: DocumentRow[]) => patchEntity({ certificates: next, documents: next });

  const updateDocument = (id: string, patch: Partial<DocumentRow>) => {
    setDocuments(documents.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  const removeDocument = (id: string) => setDocuments(documents.filter((row) => row.id !== id));

  const uploadAndScan = async (file?: File) => {
    if (!file) return;
    setOcrBusy(true);
    const attachment = { name: file.name, type: file.type, dataUrl: '', uploadedAt: new Date().toLocaleString('he-IL') };
    try {
      const dataUrl = await fileToDataUrl(file);
      attachment.dataUrl = dataUrl;

      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataUrl, subtype: props.preliminaryTab }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'OCR failed');
      const data = result?.data ?? {};

      const nextRow: DocumentRow = {
        id: crypto.randomUUID(),
        details: String(data.documentType || data.details || file.name.replace(/\.[^.]+$/, '') || 'מסמך מצורף'),
        exists: true,
        certificateNo: String(data.certificateNo || ''),
        expiryDate: normalizeDate(data.expiryDate),
        attachments: [attachment],
        ocrNotes: data.notes ? `נקלט מהמסמך: ${data.notes}` : 'נקלט מהמסמך המצורף',
      };

      setDocuments([...documents, nextRow]);
    } catch (error: any) {
      setDocuments([
        ...documents,
        {
          id: crypto.randomUUID(),
          details: file.name.replace(/\.[^.]+$/, '') || 'מסמך מצורף',
          exists: true,
          certificateNo: '',
          expiryDate: '',
          attachments: [attachment],
          ocrNotes: `OCR: ${error?.message || 'שגיאה בסריקת המסמך'}`,
        },
      ]);
    } finally {
      setOcrBusy(false);
    }
  };

  const fillApprovers = () => {
    const signatures = (form.approval?.signatures ?? []).map((signature: any) => {
      const role = String(signature.role ?? '');
      const signerName = role.includes('QA') || role.includes('הבטחת') ? PROJECT_QA_NAME : PROJECT_QC_NAME;
      return { ...signature, signerName };
    });
    setForm((prev: any) => ({ ...prev, approval: { ...(prev.approval ?? {}), signatures } }));
  };

  if (props.guardedBody) return <>{props.guardedBody}</>;

  return (
    <div>
      <h2 style={styles.sectionTitle}>בקרה מקדימה</h2>
      <FormModeBanner isEditing={Boolean(props.editingPreliminaryId)} />

      <div style={styles.chipRow}>
        {(['suppliers', 'subcontractors', 'materials'] as PreliminaryTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            style={{ ...styles.chip, background: props.preliminaryTab === tab ? '#0f172a' : '#fff', color: props.preliminaryTab === tab ? '#fff' : '#0f172a' }}
            onClick={() => props.setPreliminaryTab(tab)}
          >
            {props.labelForPreliminary(tab)}
          </button>
        ))}
      </div>

      <div style={{ height: 12 }} />

      <div style={styles.formGrid}>
        <Field label="כותרת"><input style={inputStyle} value={form.title} onChange={(e) => setForm((prev: any) => ({ ...prev, title: e.target.value }))} /></Field>
        <Field label="תאריך"><input type="date" style={inputStyle} value={form.date} onChange={(e) => setForm((prev: any) => ({ ...prev, date: e.target.value }))} /></Field>
        <Field label="סטטוס"><select style={inputStyle} value={form.status} onChange={(e) => setForm((prev: any) => ({ ...prev, status: e.target.value }))}><option>טיוטה</option><option>מאושר</option><option>לא מאושר</option></select></Field>
      </div>

      {props.preliminaryTab === 'suppliers' && entity ? <div style={styles.formGrid}>
        <Field label="שם ספק"><input style={inputStyle} value={entity.supplierName ?? ''} onChange={(e) => patchEntity({ supplierName: e.target.value })} /></Field>
        <Field label="חומר מסופק"><input style={inputStyle} value={entity.suppliedMaterial ?? ''} onChange={(e) => patchEntity({ suppliedMaterial: e.target.value })} /></Field>
        <Field label="טלפון"><input style={inputStyle} value={entity.contactPhone ?? ''} onChange={(e) => patchEntity({ contactPhone: e.target.value })} /></Field>
        <Field label="מספר אישור"><input style={inputStyle} value={entity.approvalNo ?? ''} onChange={(e) => patchEntity({ approvalNo: e.target.value })} /></Field>
        <Field label="הערות" full><textarea style={styles.textarea} value={entity.notes ?? ''} onChange={(e) => patchEntity({ notes: e.target.value })} /></Field>
      </div> : null}

      {props.preliminaryTab === 'subcontractors' && entity ? <div style={styles.formGrid}>
        <Field label="שם קבלן משנה"><input style={inputStyle} value={entity.subcontractorName ?? ''} onChange={(e) => patchEntity({ subcontractorName: e.target.value })} /></Field>
        <Field label="שירות עבודה"><input style={inputStyle} value={entity.field ?? entity.workType ?? ''} onChange={(e) => patchEntity({ field: e.target.value, workType: e.target.value })} /></Field>
        <Field label="טלפון"><input style={inputStyle} value={entity.contactPhone ?? ''} onChange={(e) => patchEntity({ contactPhone: e.target.value })} /></Field>
        <Field label="מספר אישור"><input style={inputStyle} value={entity.approvalNo ?? ''} onChange={(e) => patchEntity({ approvalNo: e.target.value })} /></Field>
        <Field label="הערות" full><textarea style={styles.textarea} value={entity.notes ?? ''} onChange={(e) => patchEntity({ notes: e.target.value })} /></Field>
      </div> : null}

      {props.preliminaryTab === 'materials' && entity ? <div style={styles.formGrid}>
        <Field label="שם חומר"><input style={inputStyle} value={entity.materialName ?? ''} onChange={(e) => patchEntity({ materialName: e.target.value })} /></Field>
        <Field label="מקור"><input style={inputStyle} value={entity.source ?? ''} onChange={(e) => patchEntity({ source: e.target.value })} /></Field>
        <Field label="שימוש"><input style={inputStyle} value={entity.usage ?? ''} onChange={(e) => patchEntity({ usage: e.target.value })} /></Field>
        <Field label="מספר תעודה ראשי"><input style={inputStyle} value={entity.certificateNo ?? ''} onChange={(e) => patchEntity({ certificateNo: e.target.value })} /></Field>
        <Field label="הערות" full><textarea style={styles.textarea} value={entity.notes ?? ''} onChange={(e) => patchEntity({ notes: e.target.value })} /></Field>
      </div> : null}

      <div style={{ ...styles.card, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>תעודות / רישיונות / מסמכים</h3>
            <div style={{ color: '#64748b', marginTop: 4 }}>לא נפתחות שורות אוטומטית. כל קובץ שמצורף נסרק ונפתחת עבורו שורה אחת בלבד לפי תוכן הקובץ.</div>
          </div>
          <label style={{ ...styles.primaryBtn, display: 'inline-flex', cursor: 'pointer', alignItems: 'center' }}>
            {ocrBusy ? 'סורק מסמך...' : 'צרף וסרוק מסמך'}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }} disabled={ocrBusy} onChange={(event) => { uploadAndScan(event.target.files?.[0]); event.currentTarget.value = ''; }} />
          </label>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
            <thead>
              <tr>
                <th style={tableCell}>פרטים</th>
                <th style={tableCell}>קיים / לא קיים</th>
                <th style={tableCell}>מספר תעודה / רישיון</th>
                <th style={tableCell}>תוקף</th>
                <th style={tableCell}>מסמכים מצורפים</th>
                <th style={tableCell}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {documents.length ? documents.map((row) => (
                <tr key={row.id}>
                  <td style={tableCell}><input style={inputStyle} value={row.details} onChange={(e) => updateDocument(row.id, { details: e.target.value })} /></td>
                  <td style={tableCell}><select style={inputStyle} value={row.exists ? 'כן' : 'לא'} onChange={(e) => updateDocument(row.id, { exists: e.target.value === 'כן' })}><option>כן</option><option>לא</option></select></td>
                  <td style={tableCell}><input style={inputStyle} value={row.certificateNo} onChange={(e) => updateDocument(row.id, { certificateNo: e.target.value })} /></td>
                  <td style={tableCell}><input type="date" style={inputStyle} value={/^\d{4}-\d{2}-\d{2}$/.test(row.expiryDate) ? row.expiryDate : ''} onChange={(e) => updateDocument(row.id, { expiryDate: e.target.value })} placeholder={row.expiryDate || 'YYYY-MM-DD'} /></td>
                  <td style={tableCell}>
                    {row.attachments.map((attachment) => <div key={attachment.name}>✅ {attachment.name}</div>)}
                    {row.ocrNotes ? <div style={{ color: '#64748b', marginTop: 4 }}>{row.ocrNotes}</div> : null}
                  </td>
                  <td style={tableCell}><button type="button" style={styles.dangerBtn} onClick={() => removeDocument(row.id)}>מחיקה</button></td>
                </tr>
              )) : (
                <tr><td colSpan={6} style={{ ...tableCell, color: '#64748b', padding: 18 }}>אין עדיין מסמכים. לחץ “צרף וסרוק מסמך” כדי לפתוח שורה לפי הקובץ.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <button type="button" style={styles.secondaryBtn} onClick={fillApprovers}>מלא שמות מאשרים אוטומטית</button>
      </div>

      <ApprovalPanel value={form.approval} onChange={(approval) => setForm((prev: any) => ({ ...prev, approval }))} />

      <div style={styles.buttonRow}>
        <button style={styles.primaryBtn} onClick={() => props.savePreliminary(props.preliminaryTab)}>{props.editingPreliminaryId ? `עדכן ${props.labelForPreliminary(props.preliminaryTab)}` : `שמור ${props.labelForPreliminary(props.preliminaryTab)}`}</button>
        <button style={styles.secondaryBtn} onClick={props.resetPreliminaryEditor}>בטל / נקה</button>
      </div>
    </div>
  );
}
