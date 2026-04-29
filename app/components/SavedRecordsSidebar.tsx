import type { ChecklistRecord, NonconformanceRecord, PreliminaryRecord, TrialSectionRecord, RFIRecord, SupervisionReportRecord } from '../types';
import { styles, SearchInput } from './common';

type Props = {
  projectName: string;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  checklistTemplateLabel: (value: any) => string;
  projectChecklists: ChecklistRecord[];
  projectNonconformances: NonconformanceRecord[];
  projectTrialSections: TrialSectionRecord[];
  projectPreliminary: PreliminaryRecord[];
  projectRFIs?: RFIRecord[];
  projectSupervisionReports?: SupervisionReportRecord[];
  onOpenChecklist: (record: ChecklistRecord) => void;
  onDeleteChecklist: (id: string) => void;
  onOpenNonconformance: (record: NonconformanceRecord) => void;
  onDeleteNonconformance: (id: string) => void;
  onOpenTrialSection: (record: TrialSectionRecord) => void;
  onDeleteTrialSection: (id: string) => void;
  onOpenPreliminary: (record: PreliminaryRecord) => void;
  onDeletePreliminary: (id: string) => void;
  onOpenRFI?: (record: RFIRecord) => void;
  onDeleteRFI?: (id: string) => void;
  onOpenSupervisionReport?: (record: SupervisionReportRecord) => void;
  onDeleteSupervisionReport?: (id: string) => void;
};

export function SavedRecordsSidebar(props: Props) {
  const Block = ({ title, children }: any) => <div style={{ marginTop: 16 }}><div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>{children}</div>;
  const Empty = () => <div style={{ color: '#64748b', fontSize: 14 }}>אין רשומות להצגה.</div>;
  const rfi = props.projectRFIs ?? [];
  const supervision = props.projectSupervisionReports ?? [];
  return <aside style={styles.sideCard}><div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>רשומות שמורות</div><div style={{ color: '#64748b', marginBottom: 12 }}>{props.projectName}</div><SearchInput value={props.searchTerm} onChange={props.onSearchTermChange} />
    <Block title="רשימות תיוג">{props.projectChecklists.length === 0 ? <Empty /> : props.projectChecklists.map((item) => <div key={item.id} style={styles.recordCard}><div style={{ fontWeight: 800 }}>{item.title}</div><div style={{ color: '#475569', fontSize: 14 }}>{props.checklistTemplateLabel(item.templateKey)} · {item.location || 'ללא מיקום'}</div><div style={styles.buttonRow}><button style={styles.secondaryBtn} onClick={() => props.onOpenChecklist(item)}>פתח</button><button style={styles.dangerBtn} onClick={() => props.onDeleteChecklist(item.id)}>מחק</button></div></div>)}</Block>
    <Block title="אי תאמות">{props.projectNonconformances.length === 0 ? <Empty /> : props.projectNonconformances.map((item) => <div key={item.id} style={styles.recordCard}><div style={{ fontWeight: 800 }}>{item.title}</div><div style={{ color: '#475569', fontSize: 14 }}>{item.status} · {item.location || 'ללא מיקום'}</div><div style={styles.buttonRow}><button style={styles.secondaryBtn} onClick={() => props.onOpenNonconformance(item)}>פתח</button><button style={styles.dangerBtn} onClick={() => props.onDeleteNonconformance(item.id)}>מחק</button></div></div>)}</Block>
    <Block title="קטעי ניסוי">{props.projectTrialSections.length === 0 ? <Empty /> : props.projectTrialSections.map((item) => <div key={item.id} style={styles.recordCard}><div style={{ fontWeight: 800 }}>{item.title}</div><div style={{ color: '#475569', fontSize: 14 }}>{item.status} · {item.location || 'ללא מיקום'}</div><div style={styles.buttonRow}><button style={styles.secondaryBtn} onClick={() => props.onOpenTrialSection(item)}>פתח</button><button style={styles.dangerBtn} onClick={() => props.onDeleteTrialSection(item.id)}>מחק</button></div></div>)}</Block>
    <Block title="RFI">{rfi.length === 0 ? <Empty /> : rfi.map((item) => <div key={item.id} style={styles.recordCard}><div style={{ fontWeight: 800 }}>{item.rfiNumber || item.subject || 'RFI'}</div><div style={{ color: '#475569', fontSize: 14 }}>{item.status} · {item.location || 'ללא מיקום'}</div><div style={styles.buttonRow}><button style={styles.secondaryBtn} onClick={() => props.onOpenRFI?.(item)}>פתח</button><button style={styles.dangerBtn} onClick={() => props.onDeleteRFI?.(item.id)}>מחק</button></div></div>)}</Block>
    <Block title="דוחות פיקוח עליון">{supervision.length === 0 ? <Empty /> : supervision.map((item) => <div key={item.id} style={styles.recordCard}><div style={{ fontWeight: 800 }}>{item.title || item.reportNo || 'דוח פיקוח עליון'}</div><div style={{ color: '#475569', fontSize: 14 }}>{item.status} · {item.location || 'ללא מיקום'}</div><div style={styles.buttonRow}><button style={styles.secondaryBtn} onClick={() => props.onOpenSupervisionReport?.(item)}>פתח</button><button style={styles.dangerBtn} onClick={() => props.onDeleteSupervisionReport?.(item.id)}>מחק</button></div></div>)}</Block>
    <Block title="בקרה מקדימה">{props.projectPreliminary.length === 0 ? <Empty /> : props.projectPreliminary.map((item) => <div key={item.id} style={styles.recordCard}><div style={{ fontWeight: 800 }}>{item.title}</div><div style={{ color: '#475569', fontSize: 14 }}>{item.subtype} · {item.status}</div><div style={styles.buttonRow}><button style={styles.secondaryBtn} onClick={() => props.onOpenPreliminary(item)}>פתח</button><button style={styles.dangerBtn} onClick={() => props.onDeletePreliminary(item.id)}>מחק</button></div></div>)}</Block>
  </aside>;
}
