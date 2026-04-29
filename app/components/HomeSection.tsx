import type { Project, Section } from '../types';
import { styles } from './common';

export function HomeSection({
  projects,
  projectChecklists,
  projectNonconformances,
  projectTrialSections,
  projectPreliminary,
  projectRFIs = [],
  projectSupervisionReports = [],
  homeModules,
  setSection
}: {
  projects: Project[];
  projectChecklists: any[];
  projectNonconformances: any[];
  projectTrialSections: any[];
  projectPreliminary: any[];
  projectRFIs?: any[];
  projectSupervisionReports?: any[];
  homeModules: { key: string; title: string; icon: string; description: string; count: number }[];
  setSection: (section: Section) => void;
}) {
  return (
    <div>
      <h2 style={styles.sectionTitle}>דף בית</h2>

      {/* סטטיסטיקות */}
      <div style={styles.cardGrid}>
        {[
          ['פרויקטים', projects.length],
          ['רשימות תיוג', projectChecklists.length],
          ['אי תאמות', projectNonconformances.length],
          ['קטעי ניסוי', projectTrialSections.length],
          ['RFI', projectRFIs.length],
          ['פיקוח עליון', projectSupervisionReports.length],
          ['בקרה מקדימה', projectPreliminary.length]
        ].map(([label, value]) => (
          <div key={String(label)} style={styles.statCard}>
            <div>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, marginTop: 8 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* מודולים */}
      <div style={{ ...styles.cardGrid, marginTop: 18 }}>
        {homeModules.map((module) => (
          <div
            key={module.key}
            style={{ ...styles.moduleCard, cursor: 'pointer' }}
            onClick={() => setSection(module.key as Section)}
          >
            <div style={{ fontSize: 28 }}>{module.icon}</div>
            <div style={{ fontWeight: 800, fontSize: 20, marginTop: 10 }}>
              {module.title}
            </div>
            <div style={{ color: '#475569', marginTop: 8 }}>
              {module.description}
            </div>
            <div style={{ marginTop: 10, fontWeight: 700 }}>
              רשומות: {module.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}