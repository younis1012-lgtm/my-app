import { useEffect } from 'react';
import type React from 'react';
import type { PreliminaryRecord, PreliminaryTab, StoredAttachment } from '../types';
import { ApprovalPanel, Field, FormModeBanner, styles } from './common';

type PreliminaryForm = Omit<PreliminaryRecord, 'id' | 'projectId' | 'savedAt'>;
type SetPreliminaryForm = React.Dispatch<React.SetStateAction<PreliminaryForm>>;

type ProjectMeta = {
  projectName?: string;
  projectManagement?: string;
  projectManager?: string;
  contractor?: string;
  qualityAssurance?: string;
  qualityControl?: string;
};

type CertificateRow = {
  id: string;
  details: string;
  exists: boolean;
  certificateNo: string;
  expiryDate: string;
  attachments: StoredAttachment[];
};

type ApprovalTableRow = {
  id: string;
  role: string;
  name: string;
  date: string;
  status: 'מאושר' | 'לא מאושר' | '';
};

type Props = {
  guardedBody: React.ReactNode;
  preliminaryTab: PreliminaryTab;
  setPreliminaryTab: (tab: PreliminaryTab) => void;
  editingPreliminaryId: string | null;
  supplierPreliminaryForm: PreliminaryForm;
  subcontractorPreliminaryForm: PreliminaryForm;
  materialPreliminaryForm: PreliminaryForm;
  setSupplierPreliminaryForm: SetPreliminaryForm;
  setSubcontractorPreliminaryForm: SetPreliminaryForm;
  setMaterialPreliminaryForm: SetPreliminaryForm;
  savePreliminary: (subtype: PreliminaryTab) => void;
  resetPreliminaryEditor: () => void;
  labelForPreliminary: (subtype: PreliminaryTab) => string;
  currentProjectName?: string;
  projectMeta?: ProjectMeta;
};

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', background: '#fff', direction: 'rtl' };
const thStyle: React.CSSProperties = { border: '1px solid #94a3b8', padding: 8, background: '#f8fafc', fontWeight: 900, textAlign: 'center' };
const tdStyle: React.CSSProperties = { border: '1px solid #cbd5e1', padding: 7, verticalAlign: 'top' };
const readOnlyStyle: React.CSSProperties = { ...styles.input, background: '#f1f5f9', color: '#334155' };
const panelStyle: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, background: '#f8fafc', marginTop: 14 };

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const defaultCertificates = (): CertificateRow[] => [{ id: newId(), details: '', exists: false, certificateNo: '', expiryDate: '', attachments: [] }];
const defaultApprovalRows = (): ApprovalTableRow[] => [
  { id: 'qc', role: 'בקרת איכות (QC)', name: '', date: '', status: '' },
  { id: 'qa', role: 'הבטחת איכות (QA)', name: '', date: '', status: '' },
];

const getMetaValue = (meta: ProjectMeta | undefined, key: keyof ProjectMeta) => String(meta?.[key] ?? '').trim();
const getProjectName = (props: Props) => getMetaValue(props.projectMeta, 'projectName') || String(props.currentProjectName ?? '').trim();
const getProjectManagement = (props: Props) => getMetaValue(props.projectMeta, 'projectManagement') || getMetaValue(props.projectMeta, 'projectManager');
const getContractor = (props: Props) => getMetaValue(props.projectMeta, 'contractor');
const getQualityCompany = (props: Props) => getMetaValue(props.projectMeta, 'qualityAssurance') || getMetaValue(props.projectMeta, 'qualityControl') || 'קונטרולינג פריים בע״מ';

function normalizeCertificates(value: unknown): CertificateRow[] {
  if (!Array.isArray(value) || !value.length) return defaultCertificates();
  return value.map((row: any) => ({
    id: String(row?.id ?? newId()),
    details: String(row?.details ?? row?.name ?? row?.description ?? ''),
    exists: Boolean(row?.exists ?? row?.isExisting),
    certificateNo: String(row?.certificateNo ?? row?.certificate_no ?? ''),
    expiryDate: String(row?.expiryDate ?? row?.expiry_date ?? row?.validUntil ?? ''),
    attachments: Array.isArray(row?.attachments) ? row.attachments : [],
  }));
}

function normalizeApprovalRows(value: unknown): ApprovalTableRow[] {
  if (!Array.isArray(value) || !value.length) return defaultApprovalRows();
  const rows = value.map((row: any, index) => ({
    id: String(row?.id ?? `${index}`),
    role: String(row?.role ?? (index === 0 ? 'בקרת איכות (QC)' : 'הבטחת איכות (QA)')),
    name: String(row?.name ?? ''),
    date: String(row?.date ?? ''),
    status: row?.status === 'מאושר' || row?.status === 'לא מאושר' ? row.status : '',
  }));
  return rows.length >= 2 ? rows : [...rows, ...defaultApprovalRows().slice(rows.length)];
}

const extractCertificateNo = (fileName: string) => {
  const clean = fileName.replace(/\.[^.]+$/, '');
  const match = clean.match(/(?:מספר|תעודה|cert|certificate)?[\s_\-]*(\d{3,})/i);
  return match?.[1] ?? '';
};

function fileToAttachment(file: File): Promise<StoredAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, dataUrl: String(reader.result ?? ''), uploadedAt: new Date().toLocaleString('he-IL') });
    reader.onerror = () => reject(new Error('לא ניתן לקרוא את הקובץ'));
    reader.readAsDataURL(file);
  });
}

export function PreliminarySection(props: Props) {
  const form = props.preliminaryTab === 'suppliers' ? props.supplierPreliminaryForm : props.preliminaryTab === 'subcontractors' ? props.subcontractorPreliminaryForm : props.materialPreliminaryForm;
  const setForm = props.preliminaryTab === 'suppliers' ? props.setSupplierPreliminaryForm : props.preliminaryTab === 'subcontractors' ? props.setSubcontractorPreliminaryForm : props.setMaterialPreliminaryForm;
  const entityKey = props.preliminaryTab === 'suppliers' ? 'supplier' : props.preliminaryTab === 'subcontractors' ? 'subcontractor' : 'material';
  const data: any = (form as any)[entityKey] ?? {};

  const patchEntity = (patch: Record<string, any>) => {
    setForm((prev: any) => {
      const previous = prev[entityKey] ?? {};
      const next = { ...previous, ...patch };
      return { ...prev, [entityKey]: next };
    });
  };

  useEffect(() => {
    if (props.guardedBody) return;
    const autoProjectName = getProjectName(props);
    const autoManagement = getProjectManagement(props);
    const autoContractor = getContractor(props);
    const autoQuality = getQualityCompany(props);
    setForm((prev: any) => {
      const previous = prev[entityKey] ?? {};
      const next = {
        ...previous,
        projectName: previous.projectName || autoProjectName,
        managementCompany: previous.managementCompany || autoManagement,
        mainContractor: previous.mainContractor || autoContractor,
        qualityControlCompany: previous.qualityControlCompany || autoQuality,
        certificates: normalizeCertificates(previous.certificates),
        approvalsTable: normalizeApprovalRows(previous.approvalsTable),
      };
      if (props.preliminaryTab === 'subcontractors') next.subcontractorName = previous.subcontractorName || autoContractor;
      if (JSON.stringify(previous) === JSON.stringify(next)) return prev;
      return { ...prev, [entityKey]: next };
    });
  }, [props.preliminaryTab, props.guardedBody, props.currentProjectName, JSON.stringify(props.projectMeta ?? {})]);

  const certificates = normalizeCertificates(data.certificates);
  const approvalRows = normalizeApprovalRows(data.approvalsTable);

  const setCertificates = (rows: CertificateRow[]) => patchEntity({ certificates: rows });
  const setApprovalRows = (rows: ApprovalTableRow[]) => patchEntity({ approvalsTable: rows });

  const updateCertificate = (index: number, patch: Partial<CertificateRow>) => {
    const next = certificates.map((row, i) => (i === index ? { ...row, ...patch } : row));
    setCertificates(next);
  };

  const uploadCertificateFile = async (index: number, file?: File) => {
    if (!file) return;
    const attachment = await fileToAttachment(file);
    const row = certificates[index];
    const certificateNo = row.certificateNo || extractCertificateNo(file.name);
    updateCertificate(index, {
      exists: true,
      certificateNo,
      details: row.details || file.name.replace(/\.[^.]+$/, ''),
      attachments: [...(row.attachments ?? []), attachment],
    });
    if (props.preliminaryTab === 'materials' && certificateNo && !data.certificateNo) patchEntity({ certificateNo });
  };

  const updateApproval = (index: number, patch: Partial<ApprovalTableRow>) => {
    const next = approvalRows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    setApprovalRows(next);
  };

  const titleLabel = props.preliminaryTab === 'suppliers' ? 'אישור ספקים' : props.preliminaryTab === 'subcontractors' ? 'אישור קבלן משנה' : 'אישור חומרים';

  return (
    <div>
      <h2 style={styles.sectionTitle}>בקרה מקדימה</h2>
      {props.guardedBody || (
        <>
          <FormModeBanner isEditing={Boolean(props.editingPreliminaryId)} />
          <div style={styles.chipRow}>
            {(['suppliers', 'subcontractors', 'materials'] as PreliminaryTab[]).map((tab) => (
              <button key={tab} type="button" style={{ ...styles.chip, background: props.preliminaryTab === tab ? '#0f172a' : '#fff', color: props.preliminaryTab === tab ? '#fff' : '#0f172a' }} onClick={() => props.setPreliminaryTab(tab)}>
                {props.labelForPreliminary(tab)}
              </button>
            ))}
          </div>

          <div style={{ ...panelStyle, background: '#fff' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
              <Field label="שם הטופס"><input style={readOnlyStyle} value={titleLabel} readOnly /></Field>
              <Field label="מהדורה"><input style={readOnlyStyle} value={data.revision || 'א'} readOnly /></Field>
              <Field label="תאריך"><input type="date" style={styles.input} value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} /></Field>
            </div>
          </div>

          <div style={panelStyle}>
            <h3 style={{ marginTop: 0, fontSize: 18 }}>פרטי פרויקט — מילוי אוטומטי</h3>
            <div style={styles.formGrid}>
              <Field label="שם הפרויקט"><input style={readOnlyStyle} value={data.projectName || getProjectName(props)} readOnly /></Field>
              <Field label="חברת ניהול"><input style={readOnlyStyle} value={data.managementCompany || getProjectManagement(props)} readOnly /></Field>
              <Field label="קבלן ראשי"><input style={readOnlyStyle} value={data.mainContractor || getContractor(props)} readOnly /></Field>
              <Field label="חברת בקרת איכות"><input style={readOnlyStyle} value={data.qualityControlCompany || getQualityCompany(props)} readOnly /></Field>
            </div>
          </div>

          <div style={panelStyle}>
            <h3 style={{ marginTop: 0, fontSize: 18 }}>פרטי האישור — מילוי ידני</h3>
            <div style={styles.formGrid}>
              <Field label="כותרת"><input style={styles.input} value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} /></Field>
              <Field label="סטטוס"><select style={styles.input} value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as any }))}><option value="טיוטה">טיוטה</option><option value="מאושר">מאושר</option><option value="לא מאושר">לא מאושר</option></select></Field>
              <Field label="מספר אישור"><input style={styles.input} value={data.approvalNo ?? ''} onChange={(e) => patchEntity({ approvalNo: e.target.value })} /></Field>
              <Field label="סניף"><input style={styles.input} value={data.branch ?? ''} onChange={(e) => patchEntity({ branch: e.target.value })} /></Field>
              <Field label="אנשי קשר וטלפון"><input style={styles.input} value={data.contactPhone ?? data.contact ?? ''} onChange={(e) => patchEntity({ contactPhone: e.target.value, contact: e.target.value })} /></Field>

              {props.preliminaryTab === 'suppliers' && (
                <>
                  <Field label="שם ספק"><input style={styles.input} value={data.supplierName ?? ''} onChange={(e) => patchEntity({ supplierName: e.target.value })} /></Field>
                  <Field label="חומר מסופק"><input style={styles.input} value={data.suppliedMaterial ?? ''} onChange={(e) => patchEntity({ suppliedMaterial: e.target.value })} /></Field>
                </>
              )}

              {props.preliminaryTab === 'subcontractors' && (
                <>
                  <Field label="שם קבלן משנה"><input style={styles.input} value={data.subcontractorName ?? getContractor(props)} onChange={(e) => patchEntity({ subcontractorName: e.target.value })} /></Field>
                  <Field label="שירות עבודה"><input style={styles.input} value={data.workType ?? data.field ?? ''} onChange={(e) => patchEntity({ workType: e.target.value, field: e.target.value })} /></Field>
                </>
              )}

              {props.preliminaryTab === 'materials' && (
                <>
                  <Field label="שם חומר"><input style={styles.input} value={data.materialName ?? ''} onChange={(e) => patchEntity({ materialName: e.target.value })} /></Field>
                  <Field label="מקור / ספק"><input style={styles.input} value={data.source ?? ''} onChange={(e) => patchEntity({ source: e.target.value })} /></Field>
                  <Field label="שימוש"><input style={styles.input} value={data.usage ?? ''} onChange={(e) => patchEntity({ usage: e.target.value })} /></Field>
                </>
              )}

              <Field label="הערות" full><textarea style={styles.textarea} value={data.notes ?? ''} onChange={(e) => patchEntity({ notes: e.target.value })} /></Field>
            </div>
          </div>

          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>תעודות</h3>
              <button type="button" style={styles.secondaryBtn} onClick={() => setCertificates([...certificates, { id: newId(), details: '', exists: false, certificateNo: '', expiryDate: '', attachments: [] }])}>הוסף שורת תעודה</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead><tr><th style={thStyle}>פרטים</th><th style={thStyle}>קיים / לא קיים</th><th style={thStyle}>מספר תעודה</th><th style={thStyle}>תוקף</th><th style={thStyle}>מסמכים מצורפים</th><th style={thStyle}>פעולות</th></tr></thead>
                <tbody>
                  {certificates.map((row, index) => (
                    <tr key={row.id}>
                      <td style={tdStyle}><input style={styles.input} value={row.details} onChange={(e) => updateCertificate(index, { details: e.target.value })} /></td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}><select style={styles.input} value={row.exists ? 'קיים' : 'לא קיים'} onChange={(e) => updateCertificate(index, { exists: e.target.value === 'קיים' })}><option>לא קיים</option><option>קיים</option></select></td>
                      <td style={tdStyle}><input style={styles.input} value={row.certificateNo} onChange={(e) => updateCertificate(index, { certificateNo: e.target.value })} /></td>
                      <td style={tdStyle}><input type="date" style={styles.input} value={row.expiryDate} onChange={(e) => updateCertificate(index, { expiryDate: e.target.value })} /></td>
                      <td style={tdStyle}>
                        <label style={{ ...styles.secondaryBtn, display: 'inline-flex', cursor: 'pointer' }}>צרף מסמך / צילום<input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }} onChange={(e) => { uploadCertificateFile(index, e.target.files?.[0]); e.currentTarget.value = ''; }} /></label>
                        <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>{(row.attachments ?? []).map((a, i) => <div key={`${a.name}-${i}`}>✅ {a.name}</div>)}</div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}><button type="button" style={styles.secondaryBtn} onClick={() => setCertificates(certificates.length === 1 ? defaultCertificates() : certificates.filter((_, i) => i !== index))}>מחיקה</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={panelStyle}>
            <h3 style={{ marginTop: 0, fontSize: 18 }}>אישורים</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead><tr><th style={thStyle}>תפקיד</th><th style={thStyle}>שם</th><th style={thStyle}>תאריך</th><th style={thStyle}>סטטוס</th></tr></thead>
                <tbody>
                  {approvalRows.map((row, index) => (
                    <tr key={row.id}>
                      <td style={tdStyle}><input style={readOnlyStyle} value={row.role} readOnly /></td>
                      <td style={tdStyle}><input style={styles.input} value={row.name} onChange={(e) => updateApproval(index, { name: e.target.value })} /></td>
                      <td style={tdStyle}><input type="date" style={styles.input} value={row.date} onChange={(e) => updateApproval(index, { date: e.target.value })} /></td>
                      <td style={tdStyle}><select style={styles.input} value={row.status} onChange={(e) => updateApproval(index, { status: e.target.value as any })}><option value="">בחר</option><option value="מאושר">מאושר</option><option value="לא מאושר">לא מאושר</option></select></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <ApprovalPanel value={form.approval} onChange={(approval) => setForm((prev) => ({ ...prev, approval }))} />

          <div style={styles.buttonRow}>
            <button type="button" style={styles.primaryBtn} onClick={() => props.savePreliminary(props.preliminaryTab)}>{props.editingPreliminaryId ? `עדכן ${props.labelForPreliminary(props.preliminaryTab)}` : `שמור ${props.labelForPreliminary(props.preliminaryTab)}`}</button>
            <button type="button" style={styles.secondaryBtn} onClick={props.resetPreliminaryEditor}>בטל / נקה</button>
          </div>
        </>
      )}
    </div>
  );
}
