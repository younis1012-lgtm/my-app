'use client';

import { useEffect, useMemo } from 'react';
import type { PreliminaryRecord, PreliminaryTab } from '../types';
import { ApprovalPanel, Field, FormModeBanner, styles } from './common';

type StoredAttachment = {
  name: string;
  type: string;
  dataUrl: string;
  uploadedAt: string;
};

type GenericCertificateRow = {
  id: string;
  details: string;
  exists: boolean;
  certificateNo: string;
  expiryDate: string;
  attachments: StoredAttachment[];
  ocrMessage?: string;
  ocrConfidence?: number;
};

type ProjectMeta = {
  projectName?: string;
  projectManagement?: string;
  projectManager?: string;
  contractor?: string;
  qualityAssurance?: string;
  qualityControl?: string;
  supervisor?: string;
};

type PreliminaryForm = Omit<PreliminaryRecord, 'id' | 'projectId' | 'savedAt'>;

type PreliminarySectionProps = {
  guardedBody: React.ReactNode;
  preliminaryTab: PreliminaryTab;
  setPreliminaryTab: (tab: PreliminaryTab) => void;
  editingPreliminaryId: string | null;
  supplierPreliminaryForm: PreliminaryForm;
  subcontractorPreliminaryForm: PreliminaryForm;
  materialPreliminaryForm: PreliminaryForm;
  setSupplierPreliminaryForm: React.Dispatch<React.SetStateAction<PreliminaryForm>>;
  setSubcontractorPreliminaryForm: React.Dispatch<React.SetStateAction<PreliminaryForm>>;
  setMaterialPreliminaryForm: React.Dispatch<React.SetStateAction<PreliminaryForm>>;
  savePreliminary: (subtype: PreliminaryTab) => void;
  resetPreliminaryEditor: () => void;
  labelForPreliminary: (subtype: PreliminaryTab) => string;
  currentProjectName?: string;
  projectMeta?: ProjectMeta;
};

const tabOrder: PreliminaryTab[] = ['suppliers', 'subcontractors', 'materials'];

const dataKeyByTab: Record<PreliminaryTab, 'supplier' | 'subcontractor' | 'material'> = {
  suppliers: 'supplier',
  subcontractors: 'subcontractor',
  materials: 'material',
};

const today = () => new Date().toISOString().slice(0, 10);

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result ?? ''));
  reader.onerror = () => reject(new Error('לא ניתן לקרוא את הקובץ'));
  reader.readAsDataURL(file);
});

const createId = () => {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
};

const normalizeRows = (value: unknown): GenericCertificateRow[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item: any, index) => ({
    id: String(item?.id ?? `${Date.now()}-${index}`),
    details: String(item?.details ?? item?.description ?? item?.name ?? ''),
    exists: item?.exists !== false,
    certificateNo: String(item?.certificateNo ?? item?.certificate_no ?? item?.documentNo ?? ''),
    expiryDate: String(item?.expiryDate ?? item?.expiry_date ?? item?.validUntil ?? ''),
    attachments: Array.isArray(item?.attachments) ? item.attachments : [],
    ocrMessage: String(item?.ocrMessage ?? ''),
    ocrConfidence: Number(item?.ocrConfidence ?? 0),
  }));
};

const getNestedData = (form: PreliminaryForm, tab: PreliminaryTab): any => {
  const key = dataKeyByTab[tab];
  return (form as any)[key] ?? {};
};

const patchNestedData = (form: PreliminaryForm, tab: PreliminaryTab, patch: Record<string, any>): PreliminaryForm => {
  const key = dataKeyByTab[tab];
  return { ...form, [key]: { ...((form as any)[key] ?? {}), ...patch } } as PreliminaryForm;
};

const normalizeIsoDate = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const iso = raw.match(/20\d{2}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const dmY = raw.match(/(\d{1,2})[./-](\d{1,2})[./-](20\d{2})/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, '0')}-${dmY[1].padStart(2, '0')}`;
  return raw;
};

const cleanDocNo = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^SUB-?20\d{2}/i.test(raw)) return '';
  if (/^20\d{2}$/.test(raw)) return '';
  return raw.replace(/^[:\s]+|[:\s]+$/g, '');
};

export function PreliminarySection(props: PreliminarySectionProps) {
  const form = props.preliminaryTab === 'suppliers'
    ? props.supplierPreliminaryForm
    : props.preliminaryTab === 'subcontractors'
      ? props.subcontractorPreliminaryForm
      : props.materialPreliminaryForm;

  const setForm = props.preliminaryTab === 'suppliers'
    ? props.setSupplierPreliminaryForm
    : props.preliminaryTab === 'subcontractors'
      ? props.setSubcontractorPreliminaryForm
      : props.setMaterialPreliminaryForm;

  const projectMeta = props.projectMeta ?? {};
  const projectName = projectMeta.projectName || props.currentProjectName || '';
  const nested = getNestedData(form, props.preliminaryTab);
  const rows = useMemo(() => normalizeRows(nested.certificates), [nested.certificates]);

  useEffect(() => {
    const qc = String(projectMeta.qualityControl ?? '').trim();
    const qa = String(projectMeta.qualityAssurance ?? '').trim();
    if (!qc && !qa) return;

    setForm((prev) => {
      const signatures = Array.isArray(prev.approval?.signatures) ? prev.approval.signatures : [];
      let changed = false;
      const nextSignatures = signatures.map((sig: any) => {
        const role = String(sig?.role ?? '');
        const autoName = role.includes('QA') || role.includes('הבטחת') ? qa : qc;
        if (!autoName || String(sig?.signerName ?? '').trim()) return sig;
        changed = true;
        return { ...sig, signerName: autoName };
      });
      if (!changed) return prev;
      return { ...prev, approval: { ...prev.approval, signatures: nextSignatures } };
    });
  }, [projectMeta.qualityAssurance, projectMeta.qualityControl, setForm]);

  const updateNested = (patch: Record<string, any>) => setForm((prev) => patchNestedData(prev, props.preliminaryTab, patch));
  const updateRows = (nextRows: GenericCertificateRow[]) => updateNested({ certificates: nextRows });

  const addEmptyRow = () => updateRows([...rows, {
    id: createId(),
    details: '',
    exists: true,
    certificateNo: '',
    expiryDate: '',
    attachments: [],
  }]);

  const updateRow = (id: string, patch: Partial<GenericCertificateRow>) => {
    updateRows(rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  const removeRow = (id: string) => updateRows(rows.filter((row) => row.id !== id));

  const handleFile = async (rowId: string | null, file: File) => {
    const dataUrl = await fileToDataUrl(file);
    const attachment: StoredAttachment = { name: file.name, type: file.type, dataUrl, uploadedAt: new Date().toISOString() };
    const currentRows = rowId ? rows : [...rows, { id: createId(), details: '', exists: true, certificateNo: '', expiryDate: '', attachments: [] }];
    const targetId = rowId ?? currentRows[currentRows.length - 1].id;

    updateRows(currentRows.map((row) => row.id === targetId ? { ...row, exists: true, attachments: [...row.attachments, attachment], ocrMessage: 'סורק מסמך...' } : row));

    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'application/octet-stream', dataUrl, subtype: props.preliminaryTab }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'OCR failed');
      const data = payload?.data ?? {};
      const certificateNo = cleanDocNo(data.certificateNo ?? data.documentNo ?? data.licenseNo);
      const expiryDate = normalizeIsoDate(data.expiryDate ?? data.validUntil ?? data.expirationDate);
      const details = String(data.documentType || data.details || data.materialName || data.supplierName || data.subcontractorName || file.name).trim();

      setForm((prev) => {
        const activeNested = getNestedData(prev, props.preliminaryTab);
        const activeRows = normalizeRows(activeNested.certificates);
        const nextRows = activeRows.map((row) => row.id === targetId ? {
          ...row,
          details: details || row.details,
          certificateNo: certificateNo || row.certificateNo,
          expiryDate: expiryDate || row.expiryDate,
          ocrMessage: certificateNo || expiryDate ? 'נקלט מהמסמך' : 'לא נמצאו מספר/תוקף ברורים במסמך',
          ocrConfidence: Number(data.confidence ?? 0),
        } : row);
        return patchNestedData(prev, props.preliminaryTab, { certificates: nextRows });
      });
    } catch (error: any) {
      setForm((prev) => {
        const activeNested = getNestedData(prev, props.preliminaryTab);
        const activeRows = normalizeRows(activeNested.certificates);
        const nextRows = activeRows.map((row) => row.id === targetId ? { ...row, ocrMessage: `שגיאת OCR: ${error?.message || error}` } : row);
        return patchNestedData(prev, props.preliminaryTab, { certificates: nextRows });
      });
    }
  };

  const autoFillApprovers = () => {
    const qc = String(projectMeta.qualityControl ?? '').trim();
    const qa = String(projectMeta.qualityAssurance ?? '').trim();
    setForm((prev) => ({
      ...prev,
      approval: {
        ...prev.approval,
        signatures: (prev.approval?.signatures ?? []).map((sig: any) => {
          const role = String(sig?.role ?? '');
          const autoName = role.includes('QA') || role.includes('הבטחת') ? qa : qc;
          return { ...sig, signerName: sig.signerName || autoName };
        }),
      },
    }));
  };

  if (props.guardedBody) return <div>{props.guardedBody}</div>;

  return (
    <div>
      <h2 style={styles.sectionTitle}>בקרה מקדימה</h2>
      <FormModeBanner isEditing={Boolean(props.editingPreliminaryId)} />

      <div style={styles.chipRow}>
        {tabOrder.map((tab) => (
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
        <Field label="שם הפרויקט"><input style={styles.input} value={projectName} readOnly /></Field>
        <Field label="חברת ניהול"><input style={styles.input} value={projectMeta.projectManagement || projectMeta.projectManager || ''} readOnly /></Field>
        <Field label="קבלן ראשי"><input style={styles.input} value={projectMeta.contractor || ''} readOnly /></Field>
        <Field label="חברת בקרת איכות"><input style={styles.input} value={projectMeta.qualityControl || ''} readOnly /></Field>
        <Field label="כותרת"><input style={styles.input} value={form.title ?? ''} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} /></Field>
        <Field label="תאריך"><input type="date" style={styles.input} value={form.date ?? ''} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} /></Field>
        <Field label="סטטוס"><select style={styles.input} value={form.status ?? 'טיוטה'} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as any }))}><option value="טיוטה">טיוטה</option><option value="מאושר">מאושר</option><option value="לא מאושר">לא מאושר</option></select></Field>
      </div>

      <div style={styles.formGrid}>
        {props.preliminaryTab === 'suppliers' && (
          <>
            <Field label="שם ספק"><input style={styles.input} value={nested.supplierName ?? ''} onChange={(e) => updateNested({ supplierName: e.target.value })} /></Field>
            <Field label="חומר מסופק"><input style={styles.input} value={nested.suppliedMaterial ?? ''} onChange={(e) => updateNested({ suppliedMaterial: e.target.value })} /></Field>
            <Field label="טלפון"><input style={styles.input} value={nested.contactPhone ?? ''} onChange={(e) => updateNested({ contactPhone: e.target.value })} /></Field>
            <Field label="מספר אישור"><input style={styles.input} value={nested.approvalNo ?? ''} onChange={(e) => updateNested({ approvalNo: e.target.value })} /></Field>
          </>
        )}
        {props.preliminaryTab === 'subcontractors' && (
          <>
            <Field label="שם קבלן"><input style={styles.input} value={nested.subcontractorName ?? projectMeta.contractor ?? ''} onChange={(e) => updateNested({ subcontractorName: e.target.value })} /></Field>
            <Field label="תחום"><input style={styles.input} value={nested.field ?? nested.workType ?? ''} onChange={(e) => updateNested({ field: e.target.value, workType: e.target.value })} /></Field>
            <Field label="טלפון"><input style={styles.input} value={nested.contactPhone ?? ''} onChange={(e) => updateNested({ contactPhone: e.target.value })} /></Field>
            <Field label="מספר אישור"><input style={styles.input} value={nested.approvalNo ?? ''} onChange={(e) => updateNested({ approvalNo: e.target.value })} /></Field>
          </>
        )}
        {props.preliminaryTab === 'materials' && (
          <>
            <Field label="שם חומר"><input style={styles.input} value={nested.materialName ?? ''} onChange={(e) => updateNested({ materialName: e.target.value })} /></Field>
            <Field label="מקור"><input style={styles.input} value={nested.source ?? ''} onChange={(e) => updateNested({ source: e.target.value })} /></Field>
            <Field label="שימוש"><input style={styles.input} value={nested.usage ?? ''} onChange={(e) => updateNested({ usage: e.target.value })} /></Field>
          </>
        )}
        <Field label="הערות" full><textarea style={styles.textarea} value={nested.notes ?? ''} onChange={(e) => updateNested({ notes: e.target.value })} /></Field>
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: 14, background: '#fff', marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>מסמכים / תעודות / רישיונות</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ ...styles.primaryBtn, display: 'inline-flex', cursor: 'pointer' }}>
              צרף קובץ חדש וסרוק
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(null, file); e.currentTarget.value = ''; }} />
            </label>
            <button type="button" style={styles.secondaryBtn} onClick={addEmptyRow}>הוסף שורה ידנית</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>פרטים</th>
                <th style={th}>קיים</th>
                <th style={th}>מספר תעודה / רישיון / אישור</th>
                <th style={th}>תאריך פקיעה / תוקף</th>
                <th style={th}>מסמכים מצורפים</th>
                <th style={th}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} style={{ ...td, color: '#64748b', textAlign: 'center' }}>אין שורות. צרף קובץ והמערכת תפתח שורה ותמלא לפי המסמך.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id}>
                  <td style={td}><input style={styles.input} value={row.details} onChange={(e) => updateRow(row.id, { details: e.target.value })} placeholder="לדוגמה: תעודת כיול / רישיון / אישור" /></td>
                  <td style={td}><select style={styles.input} value={row.exists ? 'כן' : 'לא'} onChange={(e) => updateRow(row.id, { exists: e.target.value === 'כן' })}><option>כן</option><option>לא</option></select></td>
                  <td style={td}><input style={styles.input} value={row.certificateNo} onChange={(e) => updateRow(row.id, { certificateNo: e.target.value })} /></td>
                  <td style={td}><input type="date" style={styles.input} value={row.expiryDate} onChange={(e) => updateRow(row.id, { expiryDate: e.target.value })} /></td>
                  <td style={td}>
                    <label style={{ ...styles.secondaryBtn, display: 'inline-flex', cursor: 'pointer' }}>
                      צרף וסרוק
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(row.id, file); e.currentTarget.value = ''; }} />
                    </label>
                    <div style={{ fontSize: 12, color: row.ocrMessage?.startsWith('שגיאת') ? '#b91c1c' : '#475569', marginTop: 6 }}>{row.ocrMessage || ''}</div>
                    <div style={{ fontSize: 12, color: '#0f766e', marginTop: 4 }}>{row.attachments.map((a) => `✅ ${a.name}`).join(' | ')}</div>
                  </td>
                  <td style={td}><button type="button" style={styles.dangerBtn} onClick={() => removeRow(row.id)}>מחיקה</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <button type="button" style={styles.secondaryBtn} onClick={autoFillApprovers}>מלא שמות מאשרים אוטומטית</button>
      </div>
      <ApprovalPanel value={form.approval} onChange={(approval) => setForm((prev) => ({ ...prev, approval }))} />
      <div style={styles.buttonRow}>
        <button style={styles.primaryBtn} onClick={() => props.savePreliminary(props.preliminaryTab)}>{props.editingPreliminaryId ? `עדכן ${props.labelForPreliminary(props.preliminaryTab)}` : `שמור ${props.labelForPreliminary(props.preliminaryTab)}`}</button>
        <button style={styles.secondaryBtn} onClick={props.resetPreliminaryEditor}>בטל / נקה</button>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { border: '1px solid #cbd5e1', padding: 8, background: '#f8fafc', fontWeight: 900, textAlign: 'center' };
const td: React.CSSProperties = { border: '1px solid #e2e8f0', padding: 8, verticalAlign: 'top' };
