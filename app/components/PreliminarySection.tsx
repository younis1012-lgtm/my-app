import { useEffect, useMemo, useState } from 'react';
import type { ApprovalFlow, PreliminaryRecord, PreliminaryTab, StoredAttachment } from '../types';
import { ApprovalPanel, Field, FormModeBanner, styles } from './common';

type CertificateRow = {
  id: string;
  exists: boolean;
  details: string;
  certificateNo: string;
  expiryDate: string;
  issueDate: string;
  attachments: StoredAttachment[];
  ocrStatus?: string;
};

type ProjectMeta = {
  projectName?: string;
  projectManagement?: string;
  contractor?: string;
  qualityAssurance?: string;
  qualityControl?: string;
};

const CERTIFICATE_DEFAULTS = ['תעודת כיול', 'רישיון מודד', 'מודד מוסמך'];
const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const today = () => new Date().toISOString().slice(0, 10);

function normalizeAttachments(value: unknown): StoredAttachment[] {
  return Array.isArray(value)
    ? value.filter((item: any) => item && item.dataUrl).map((item: any) => ({
        name: String(item.name ?? 'קובץ'),
        type: String(item.type ?? ''),
        dataUrl: String(item.dataUrl ?? ''),
        uploadedAt: String(item.uploadedAt ?? ''),
      }))
    : [];
}

function normalizeCertificates(value: unknown): CertificateRow[] {
  const rows = Array.isArray(value) ? value : [];
  const normalized = rows.map((row: any, index: number): CertificateRow => ({
    id: String(row?.id ?? makeId()),
    exists: row?.exists !== false,
    details: String(row?.details ?? row?.name ?? CERTIFICATE_DEFAULTS[index] ?? 'מסמך'),
    certificateNo: String(row?.certificateNo ?? row?.certificate_no ?? ''),
    expiryDate: String(row?.expiryDate ?? row?.expiry_date ?? ''),
    issueDate: String(row?.issueDate ?? row?.issue_date ?? ''),
    attachments: normalizeAttachments(row?.attachments ?? row?.documents),
    ocrStatus: String(row?.ocrStatus ?? ''),
  }));
  while (normalized.length < 3) {
    normalized.push({ id: makeId(), exists: true, details: CERTIFICATE_DEFAULTS[normalized.length] ?? 'מסמך', certificateNo: '', expiryDate: '', issueDate: '', attachments: [] });
  }
  return normalized;
}

function attachmentFromFile(file: File): Promise<StoredAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, dataUrl: String(reader.result ?? ''), uploadedAt: new Date().toISOString() });
    reader.onerror = () => reject(new Error('לא ניתן לקרוא את הקובץ'));
    reader.readAsDataURL(file);
  });
}

function getDataKey(tab: PreliminaryTab) {
  return tab === 'suppliers' ? 'supplier' : tab === 'subcontractors' ? 'subcontractor' : 'material';
}

function getEntityLabel(tab: PreliminaryTab) {
  return tab === 'suppliers' ? 'ספקים' : tab === 'subcontractors' ? 'קבלנים' : 'חומרים';
}

function getNextSequentialApprovalNo(current: string, tab: PreliminaryTab) {
  const clean = String(current ?? '').trim();
  if (/^\d+$/.test(clean)) return clean;
  return '1';
}

function withAutoApproval(approval: ApprovalFlow, projectMeta?: ProjectMeta): ApprovalFlow {
  const qc = String(projectMeta?.qualityControl ?? '').trim();
  const qa = String(projectMeta?.qualityAssurance ?? '').trim();
  return {
    ...approval,
    signatures: approval.signatures.map((signature) => {
      const role = String(signature.role ?? '');
      const autoName = role.includes('QC') || role.includes('בקר') || role.includes('בקרת') ? qc : role.includes('QA') || role.includes('הבטחת') ? qa : '';
      return { ...signature, signerName: signature.signerName || autoName };
    }),
  };
}

function normalizeOcrDate(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const iso = text.match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  if (iso) return text;
  const year = text.match(/^20\d{2}$/);
  if (year) return text;
  return text;
}

function cleanCertificateNo(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text || /^20\d{2}$/.test(text)) return '';
  return text;
}

export function PreliminarySection(props: {
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
  currentProjectName?: string;
  projectMeta?: ProjectMeta;
}) {
  const form = props.preliminaryTab === 'suppliers' ? props.supplierPreliminaryForm : props.preliminaryTab === 'subcontractors' ? props.subcontractorPreliminaryForm : props.materialPreliminaryForm;
  const setForm = props.preliminaryTab === 'suppliers' ? props.setSupplierPreliminaryForm : props.preliminaryTab === 'subcontractors' ? props.setSubcontractorPreliminaryForm : props.setMaterialPreliminaryForm;
  const dataKey = getDataKey(props.preliminaryTab);
  const data = ((form as any)[dataKey] ?? {}) as any;
  const certificates = useMemo(() => normalizeCertificates(data.certificates), [data.certificates]);
  const [ocrBusyRow, setOcrBusyRow] = useState<string>('');

  useEffect(() => {
    setForm((prev: any) => {
      const key = getDataKey(props.preliminaryTab);
      const current = prev[key] ?? {};
      const nextApproval = withAutoApproval(prev.approval, props.projectMeta);
      return {
        ...prev,
        date: prev.date || today(),
        approval: nextApproval,
        [key]: {
          ...current,
          approvalNo: getNextSequentialApprovalNo(current.approvalNo, props.preliminaryTab),
          certificates: normalizeCertificates(current.certificates),
        },
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.preliminaryTab, props.projectMeta?.qualityControl, props.projectMeta?.qualityAssurance]);

  const setData = (patch: any) => setForm((prev: any) => ({ ...prev, [dataKey]: { ...(prev[dataKey] ?? {}), ...patch } }));
  const updateCertificates = (next: CertificateRow[]) => setData({ certificates: next });

  const setCertificateRow = (rowId: string, patch: Partial<CertificateRow>) => {
    updateCertificates(certificates.map((row) => row.id === rowId ? { ...row, ...patch } : row));
  };

  const uploadAndScan = async (rowId: string, file: File) => {
    try {
      setOcrBusyRow(rowId);
      setCertificateRow(rowId, { ocrStatus: 'סורק מסמך...' });
      const attachment = await attachmentFromFile(file);
      const row = certificates.find((item) => item.id === rowId);
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'application/octet-stream', dataUrl: attachment.dataUrl, subtype: props.preliminaryTab, documentLabel: row?.details ?? '' }),
      });
      const result = await response.json();
      const ocr = result?.data ?? {};
      const certificateNo = cleanCertificateNo(ocr.certificateNo);
      const expiryDate = normalizeOcrDate(ocr.expiryDate);
      const issueDate = normalizeOcrDate(ocr.issueDate);
      const currentRows = normalizeCertificates(((form as any)[dataKey] ?? {}).certificates);
      updateCertificates(currentRows.map((item) => item.id === rowId ? {
        ...item,
        exists: true,
        certificateNo: certificateNo || item.certificateNo,
        expiryDate: expiryDate || item.expiryDate,
        issueDate: issueDate || item.issueDate,
        attachments: [...item.attachments, attachment],
        ocrStatus: certificateNo || expiryDate ? 'נקלט מהמסמך' : 'הקובץ צורף, לא זוהה מספר/תוקף ברור',
      } : item));
      if (ocr.supplierName && props.preliminaryTab === 'suppliers') setData({ supplierName: data.supplierName || ocr.supplierName });
      if (ocr.subcontractorName && props.preliminaryTab === 'subcontractors') setData({ subcontractorName: data.subcontractorName || ocr.subcontractorName });
      if (ocr.materialName && props.preliminaryTab === 'materials') setData({ materialName: data.materialName || ocr.materialName });
      if (ocr.suppliedMaterial && props.preliminaryTab === 'suppliers') setData({ suppliedMaterial: data.suppliedMaterial || ocr.suppliedMaterial });
      if (ocr.contactPhone) setData({ contactPhone: data.contactPhone || ocr.contactPhone });
    } catch (error: any) {
      setCertificateRow(rowId, { ocrStatus: `שגיאת OCR: ${error?.message ?? 'לא ידוע'}` });
    } finally {
      setOcrBusyRow('');
    }
  };

  const addCertificateRow = () => updateCertificates([...certificates, { id: makeId(), exists: true, details: 'מסמך נוסף', certificateNo: '', expiryDate: '', issueDate: '', attachments: [] }]);
  const removeCertificateRow = (rowId: string) => updateCertificates(certificates.filter((row) => row.id !== rowId));

  const signerNameForRole = (role: string) => {
    const r = String(role ?? '');
    if (r.includes('QC') || r.includes('בקר') || r.includes('בקרת')) return props.projectMeta?.qualityControl ?? '';
    if (r.includes('QA') || r.includes('הבטחת')) return props.projectMeta?.qualityAssurance ?? '';
    return '';
  };

  const fillApprovalNames = () => setForm((prev: any) => ({
    ...prev,
    approval: {
      ...prev.approval,
      signatures: prev.approval.signatures.map((signature: any) => ({ ...signature, signerName: signature.signerName || signerNameForRole(signature.role) })),
    },
  }));

  return <div>
    <h2 style={styles.sectionTitle}>בקרה מקדימה</h2>
    {props.guardedBody || <>
      <FormModeBanner isEditing={Boolean(props.editingPreliminaryId)} />
      <div style={styles.chipRow}>{(['suppliers','subcontractors','materials'] as PreliminaryTab[]).map((tab) => <button key={tab} style={{ ...styles.chip, background: props.preliminaryTab === tab ? '#0f172a' : '#fff', color: props.preliminaryTab === tab ? '#fff' : '#0f172a' }} onClick={() => props.setPreliminaryTab(tab)}>{props.labelForPreliminary(tab)}</button>)}</div>
      <div style={{ height: 12 }} />

      <div style={styles.formGrid}>
        <Field label="כותרת"><input style={styles.input} value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} /></Field>
        <Field label="תאריך"><input type="date" style={styles.input} value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} /></Field>
        <Field label="סטטוס"><select style={styles.input} value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as any }))}><option value="טיוטה">טיוטה</option><option value="מאושר">מאושר</option><option value="לא מאושר">לא מאושר</option></select></Field>
        <Field label="מספר אישור"><input style={styles.input} value={data.approvalNo ?? '1'} onChange={(e) => setData({ approvalNo: e.target.value.replace(/\D/g, '') || '1' })} /></Field>
      </div>

      <div style={styles.formGrid}>
        <Field label="שם הפרויקט"><input style={styles.input} value={props.projectMeta?.projectName || props.currentProjectName || ''} readOnly /></Field>
        <Field label="חברת ניהול"><input style={styles.input} value={props.projectMeta?.projectManagement || ''} readOnly /></Field>
        <Field label="קבלן ראשי"><input style={styles.input} value={props.projectMeta?.contractor || ''} readOnly /></Field>
        <Field label="חברת בקרת איכות"><input style={styles.input} value={props.projectMeta?.qualityControl || ''} readOnly /></Field>
      </div>

      {props.preliminaryTab === 'suppliers' && <div style={styles.formGrid}>
        <Field label="שם ספק"><input style={styles.input} value={data.supplierName ?? ''} onChange={(e) => setData({ supplierName: e.target.value })} /></Field>
        <Field label="חומר מסופק"><input style={styles.input} value={data.suppliedMaterial ?? ''} onChange={(e) => setData({ suppliedMaterial: e.target.value })} /></Field>
        <Field label="אנשי קשר וטלפון"><input style={styles.input} value={data.contactPhone ?? ''} onChange={(e) => setData({ contactPhone: e.target.value })} /></Field>
        <Field label="סניף"><input style={styles.input} value={data.branch ?? ''} onChange={(e) => setData({ branch: e.target.value })} /></Field>
        <Field label="הערות" full><textarea style={styles.textarea} value={data.notes ?? ''} onChange={(e) => setData({ notes: e.target.value })} /></Field>
      </div>}

      {props.preliminaryTab === 'subcontractors' && <div style={styles.formGrid}>
        <Field label="שם קבלן משנה"><input style={styles.input} value={data.subcontractorName || props.projectMeta?.contractor || ''} onChange={(e) => setData({ subcontractorName: e.target.value })} /></Field>
        <Field label="שירות / עבודה"><input style={styles.input} value={data.field ?? data.workType ?? ''} onChange={(e) => setData({ field: e.target.value, workType: e.target.value })} /></Field>
        <Field label="אנשי קשר וטלפון"><input style={styles.input} value={data.contactPhone ?? ''} onChange={(e) => setData({ contactPhone: e.target.value })} /></Field>
        <Field label="סניף"><input style={styles.input} value={data.branch ?? ''} onChange={(e) => setData({ branch: e.target.value })} /></Field>
        <Field label="הערות" full><textarea style={styles.textarea} value={data.notes ?? ''} onChange={(e) => setData({ notes: e.target.value })} /></Field>
      </div>}

      {props.preliminaryTab === 'materials' && <div style={styles.formGrid}>
        <Field label="שם חומר"><input style={styles.input} value={data.materialName ?? ''} onChange={(e) => setData({ materialName: e.target.value })} /></Field>
        <Field label="מקור"><input style={styles.input} value={data.source ?? ''} onChange={(e) => setData({ source: e.target.value })} /></Field>
        <Field label="שימוש"><input style={styles.input} value={data.usage ?? ''} onChange={(e) => setData({ usage: e.target.value })} /></Field>
        <Field label="הערות" full><textarea style={styles.textarea} value={data.notes ?? ''} onChange={(e) => setData({ notes: e.target.value })} /></Field>
      </div>}

      <div style={{ border: '1px solid #cbd5e1', borderRadius: 16, padding: 14, marginTop: 14, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>תעודות / רישיונות / מסמכים</h3>
          <button type="button" style={styles.secondaryBtn} onClick={addCertificateRow}>הוסף שורת תעודה</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>פרטים</th><th style={th}>קיים / לא קיים</th><th style={th}>מספר תעודה / רישיון</th><th style={th}>תאריך פקיעה / תוקף</th><th style={th}>תאריך הפקה</th><th style={th}>מסמכים מצורפים</th><th style={th}>פעולות</th>
            </tr></thead>
            <tbody>{certificates.map((row) => <tr key={row.id}>
              <td style={td}><input style={styles.input} value={row.details} onChange={(e) => setCertificateRow(row.id, { details: e.target.value })} /></td>
              <td style={td}><select style={styles.input} value={row.exists ? 'כן' : 'לא'} onChange={(e) => setCertificateRow(row.id, { exists: e.target.value === 'כן' })}><option>כן</option><option>לא</option></select></td>
              <td style={td}><input style={styles.input} value={row.certificateNo} onChange={(e) => setCertificateRow(row.id, { certificateNo: e.target.value })} placeholder="לדוגמה 25/3785" /></td>
              <td style={td}><input style={styles.input} value={row.expiryDate} onChange={(e) => setCertificateRow(row.id, { expiryDate: e.target.value })} placeholder="YYYY-MM-DD או שנה" /></td>
              <td style={td}><input style={styles.input} value={row.issueDate} onChange={(e) => setCertificateRow(row.id, { issueDate: e.target.value })} placeholder="YYYY-MM-DD" /></td>
              <td style={td}>
                <label style={{ ...styles.secondaryBtn, display: 'inline-block', cursor: 'pointer' }}>
                  {ocrBusyRow === row.id ? 'סורק...' : 'צרף מסמך / צילום'}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }} disabled={ocrBusyRow === row.id} onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadAndScan(row.id, file); event.currentTarget.value = ''; }} />
                </label>
                <div style={{ fontSize: 12, marginTop: 6, color: row.ocrStatus?.startsWith('שגיאת') ? '#b91c1c' : '#475569' }}>{row.ocrStatus || ''}</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{row.attachments.map((a) => <div key={a.uploadedAt}>✅ {a.name}</div>)}</div>
              </td>
              <td style={td}><button type="button" style={styles.dangerBtn} onClick={() => removeCertificateRow(row.id)}>מחיקה</button></td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" style={styles.secondaryBtn} onClick={fillApprovalNames}>מלא שמות מאשרים אוטומטית</button>
      </div>
      <ApprovalPanel value={form.approval} onChange={(approval) => setForm((prev) => ({ ...prev, approval: withAutoApproval(approval, props.projectMeta) }))} />

      <div style={styles.buttonRow}>
        <button style={styles.primaryBtn} onClick={() => props.savePreliminary(props.preliminaryTab)}>{props.editingPreliminaryId ? `עדכן ${props.labelForPreliminary(props.preliminaryTab)}` : `שמור ${props.labelForPreliminary(props.preliminaryTab)}`}</button>
        <button style={styles.secondaryBtn} onClick={props.resetPreliminaryEditor}>בטל / נקה</button>
      </div>
    </>}
  </div>;
}

const th: React.CSSProperties = { border: '1px solid #cbd5e1', padding: 8, background: '#f8fafc', fontWeight: 900, textAlign: 'center' };
const td: React.CSSProperties = { border: '1px solid #e2e8f0', padding: 8, verticalAlign: 'top' };
