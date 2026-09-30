import type { CSSProperties, ReactNode } from 'react';
import type { ApprovalFlow } from '../types';
export const styles: Record<string, CSSProperties> = {
  page: { background: '#f3f5f9', minHeight: '100vh', padding: 'clamp(10px, 3vw, 20px)', fontFamily: '"Heebo", Arial, sans-serif', color: '#0f1b2d' },
  header: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 16, marginBottom: 18 },
  headerCard: { background: '#fff', border: '1px solid #dde3ec', borderRadius: 14, padding: 'clamp(12px, 3vw, 16px)', boxShadow: '0 4px 16px rgba(11,31,58,0.05)' },
  navRow: { display: 'flex', gap: 8, flexWrap: 'nowrap', marginBottom: 18, overflowX: 'auto', paddingBottom: 6, WebkitOverflowScrolling: 'touch' as any },
  navBtn: { border: '1px solid #c9d2df', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' },
  layout: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 18, alignItems: 'start' },
  mainCard: { background: '#fff', border: '1px solid #dde3ec', borderRadius: 16, padding: 'clamp(12px, 3vw, 22px)', boxShadow: '0 4px 16px rgba(11,31,58,0.05)' },
  sideCard: { background: '#fff', border: '1px solid #dde3ec', borderRadius: 16, padding: 16, boxShadow: '0 4px 16px rgba(11,31,58,0.05)' },
  sectionTitle: { fontSize: 26, fontWeight: 800, margin: '0 0 18px', color: '#0b1f3a' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', gap: 14, marginBottom: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldFull: { gridColumn: '1 / -1' },
  label: { fontWeight: 600, fontSize: 13, color: '#334155' },
  input: { border: '1px solid #c9d2df', borderRadius: 10, padding: '10px 12px', fontSize: 14, width: '100%', background: '#fff', color: '#0f1b2d' },
  textarea: { border: '1px solid #c9d2df', borderRadius: 10, padding: '10px 12px', fontSize: 14, width: '100%', minHeight: 90, resize: 'vertical', background: '#fff', color: '#0f1b2d' },
  primaryBtn: { background: '#0b1f3a', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 18px', minHeight: 42, cursor: 'pointer', fontWeight: 700 },
  secondaryBtn: { background: '#fff', color: '#0b1f3a', border: '1px solid #c9d2df', borderRadius: 10, padding: '11px 16px', minHeight: 42, cursor: 'pointer', fontWeight: 600 },
  dangerBtn: { background: '#fdecea', color: '#b42318', border: '1px solid #f3c4be', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', fontWeight: 600 },
  buttonRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 },
  emptyBox: { background: '#f7f9fc', border: '1px dashed #c9d2df', borderRadius: 14, padding: 24, color: '#55657d' },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 },
  statCard: { background: '#f7f9fc', border: '1px solid #dde3ec', borderRadius: 14, padding: 16 },
  moduleCard: { background: '#fff', border: '1px solid #dde3ec', borderRadius: 14, padding: 16, textAlign: 'right', cursor: 'pointer' },
  recordCard: { background: '#fff', border: '1px solid #dde3ec', borderRadius: 14, padding: 14, marginBottom: 12 },
  rowCard: { background: '#f7f9fc', border: '1px solid #dde3ec', borderRadius: 14, padding: 14, marginBottom: 12 },
  subHeader: { fontSize: 18, fontWeight: 700, margin: '18px 0 12px', color: '#0b1f3a' },
  chipRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  chip: { border: '1px solid #c9d2df', borderRadius: 999, padding: '8px 12px', background: '#fff', cursor: 'pointer', fontWeight: 600 },
};
export function Field({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) { return <div style={{ ...styles.field, ...(full ? styles.fieldFull : {}) }}><label style={styles.label}>{label}</label>{children}</div>; }
export function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) { return <input style={styles.input} value={value} onChange={(e) => onChange(e.target.value)} placeholder="חיפוש ברשומות..." />; }
export function FormModeBanner({ isEditing }: { isEditing: boolean }) { return <div style={{ background: isEditing ? '#eff6ff' : '#f8fafc', color: '#334155', border: '1px solid #dbeafe', borderRadius: 14, padding: 12, marginBottom: 16, fontWeight: 700 }}>{isEditing ? 'מצב עריכה פעיל — שמירה תעדכן את הרשומה הקיימת.' : 'מצב יצירה — שמירה תיצור רשומה חדשה.'}</div>; }
export function ApprovalPanel({ value, onChange }: { value: ApprovalFlow; onChange: (next: ApprovalFlow) => void }) {
  const updateSignature = (index: number, patch: Partial<ApprovalFlow['signatures'][number]>) => onChange({ ...value, signatures: value.signatures.map((signature, currentIndex) => currentIndex === index ? { ...signature, ...patch } : signature) });
  return <div style={{ ...styles.rowCard, marginTop: 18 }}>
    <div style={styles.subHeader}>אישורים וחתימות</div>
    <div style={styles.formGrid}>
      <Field label="סטטוס אישור"><select style={styles.input} value={value.status} onChange={(event) => onChange({ ...value, status: event.target.value as ApprovalFlow['status'] })}><option value="draft">בתהליך / בטיפול</option><option value="approved">מאושר</option><option value="rejected">נדחה</option></select></Field>
      <Field label="הערות" full><textarea style={styles.textarea} value={value.remarks} onChange={(event) => onChange({ ...value, remarks: event.target.value })} /></Field>
    </div>
    {value.signatures.map((signature, index) => <div key={signature.role} style={{ ...styles.rowCard, background: '#fff', marginBottom: 10 }}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{signature.role}{signature.required ? ' *' : ''}</div>
      <div style={styles.formGrid}>
        <Field label="שם מאשר"><input style={styles.input} value={signature.signerName} onChange={(event) => updateSignature(index, { signerName: event.target.value })} /></Field>
        <Field label="חתימה"><input style={styles.input} value={signature.signature} onChange={(event) => updateSignature(index, { signature: event.target.value })} placeholder="הקלד/י שם או מזהה חתימה" /></Field>
        <Field label="תאריך חתימה"><input type="date" style={styles.input} value={signature.signedAt} onChange={(event) => updateSignature(index, { signedAt: event.target.value })} /></Field>
      </div>
    </div>)}
  </div>;
}
