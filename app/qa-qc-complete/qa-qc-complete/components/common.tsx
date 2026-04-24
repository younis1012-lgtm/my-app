import type { CSSProperties, ReactNode } from 'react';
import type { ApprovalFlow } from '../types';
export const styles: Record<string, CSSProperties> = {
  page: { background: '#f8fafc', minHeight: '100vh', padding: 20, fontFamily: 'Arial, sans-serif' },
  header: { display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, marginBottom: 18 },
  headerCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 16, boxShadow: '0 10px 30px rgba(15,23,42,0.06)' },
  navRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 },
  navBtn: { border: '1px solid #cbd5e1', borderRadius: 12, padding: '10px 14px', cursor: 'pointer', fontWeight: 700 },
  layout: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 18, alignItems: 'start' },
  mainCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 20, boxShadow: '0 10px 30px rgba(15,23,42,0.06)' },
  sideCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 16, boxShadow: '0 10px 30px rgba(15,23,42,0.06)' },
  sectionTitle: { fontSize: 26, fontWeight: 800, margin: '0 0 18px' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 14, marginBottom: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldFull: { gridColumn: '1 / -1' },
  label: { fontWeight: 700, color: '#334155' },
  input: { border: '1px solid #cbd5e1', borderRadius: 12, padding: 12, fontSize: 14, width: '100%', background: '#fff' },
  textarea: { border: '1px solid #cbd5e1', borderRadius: 12, padding: 12, fontSize: 14, width: '100%', minHeight: 90, resize: 'vertical', background: '#fff' },
  primaryBtn: { background: '#0f172a', color: '#fff', border: 'none', borderRadius: 12, padding: '11px 16px', cursor: 'pointer', fontWeight: 700 },
  secondaryBtn: { background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 12, padding: '11px 16px', cursor: 'pointer', fontWeight: 700 },
  dangerBtn: { background: '#fff1f2', color: '#b91c1c', border: '1px solid #fecdd3', borderRadius: 12, padding: '10px 14px', cursor: 'pointer', fontWeight: 700 },
  buttonRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 },
  emptyBox: { background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 16, padding: 24, color: '#475569' },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 },
  statCard: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16 },
  moduleCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, textAlign: 'right', cursor: 'pointer' },
  recordCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, marginBottom: 12 },
  rowCard: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, marginBottom: 12 },
  subHeader: { fontSize: 20, fontWeight: 800, margin: '18px 0 12px' },
  chipRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  chip: { border: '1px solid #cbd5e1', borderRadius: 999, padding: '8px 12px', background: '#fff', cursor: 'pointer', fontWeight: 700 },
};
export function Field({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) { return <div style={{ ...styles.field, ...(full ? styles.fieldFull : {}) }}><label style={styles.label}>{label}</label>{children}</div>; }
export function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) { return <input style={styles.input} value={value} onChange={(e) => onChange(e.target.value)} placeholder="חיפוש ברשומות..." />; }
export function FormModeBanner({ isEditing }: { isEditing: boolean }) { return <div style={{ background: isEditing ? '#eff6ff' : '#f8fafc', color: '#334155', border: '1px solid #dbeafe', borderRadius: 14, padding: 12, marginBottom: 16, fontWeight: 700 }}>{isEditing ? 'מצב עריכה פעיל — שמירה תעדכן את הרשומה הקיימת.' : 'מצב יצירה — שמירה תיצור רשומה חדשה.'}</div>; }
export function ApprovalPanel({ value, onChange }: { value: ApprovalFlow; onChange: (next: ApprovalFlow) => void }) { return <div style={{ ...styles.rowCard, marginTop: 18 }}><div style={styles.subHeader}>אישורים וחתימות</div><div style={styles.formGrid}><Field label="סטטוס אישור"><select style={styles.input} value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value as ApprovalFlow['status'] })}><option value="draft">טיוטה</option><option value="approved">מאושר</option><option value="rejected">נדחה</option></select></Field><Field label="הערות" full><textarea style={styles.textarea} value={value.remarks} onChange={(e) => onChange({ ...value, remarks: e.target.value })} /></Field></div>{value.signatures.map((sig, index) => <div key={sig.role} style={{ ...styles.rowCard, background: '#fff', marginBottom: 10 }}><div style={{ fontWeight: 800, marginBottom: 10 }}>{sig.role}{sig.required ? ' *' : ''}</div><div style={styles.formGrid}><Field label="שם מאשר"><input style={styles.input} value={sig.signerName} onChange={(e) => onChange({ ...value, signatures: value.signatures.map((s, i) => i === index ? { ...s, signerName: e.target.value } : s) })} /></Field><Field label="חתימה"><input style={styles.input} value={sig.signature} onChange={(e) => onChange({ ...value, signatures: value.signatures.map((s, i) => i === index ? { ...s, signature: e.target.value } : s) })} placeholder="הקלד/י שם או מזהה חתימה" /></Field><Field label="תאריך חתימה"><input type="date" style={styles.input} value={sig.signedAt} onChange={(e) => onChange({ ...value, signatures: value.signatures.map((s, i) => i === index ? { ...s, signedAt: e.target.value } : s) })} /></Field></div></div>)}</div>; }
