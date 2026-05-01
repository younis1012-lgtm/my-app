import type { Project } from '../types';
import { Field, styles } from './common';

const PROJECT_SECTION_FALLBACK_PROJECTS: Project[] = [
  {
    id: 'project-806',
    name: 'כביש 806 צלמון שלב א׳',
    description: 'פרויקט ברירת מחדל לפי הרשאת משתמש 806',
    manager: 'א.ש. רונן הנדסה אזרחית בע"מ',
    isActive: true,
    createdAt: 'ברירת מחדל',
  },
  {
    id: 'project-909',
    name: 'פרויקט 909',
    description: 'פרויקט ברירת מחדל לפי הרשאת משתמש 909',
    manager: '',
    isActive: false,
    createdAt: 'ברירת מחדל',
  },
];

export function ProjectsSection(props: {
  projects: Project[];
  currentProjectId: string | null;
  newProjectName: string;
  newProjectDescription: string;
  newProjectManager: string;
  setNewProjectName: (v: string) => void;
  setNewProjectDescription: (v: string) => void;
  setNewProjectManager: (v: string) => void;
  addProject: () => void;
  setActiveProject: (id: string) => void;
  renameProject: (id: string) => void;
  updateProjectMeta: (id: string) => void;
  deleteProject: (id: string) => void;
}) {
  const displayProjects = props.projects.length ? props.projects : PROJECT_SECTION_FALLBACK_PROJECTS;

  return (
    <div>
      <h2 style={styles.sectionTitle}>פרויקטים</h2>

      <div style={{ ...styles.rowCard, background: '#eff6ff', borderColor: '#bfdbfe', marginBottom: 14 }}>
        <div style={{ fontWeight: 900, color: '#1e3a8a' }}>בחירת פרויקט פעיל</div>
        <div style={{ color: '#334155', marginTop: 6 }}>
          לחץ על “בחר פרויקט לעבודה”. לאחר הבחירה כל הרשימות, RFI, אי־התאמות, ריכוזים ותהליכי הבקרה יעבדו על הפרויקט שנבחר.
        </div>
      </div>

      <div style={styles.formGrid}>
        <Field label="שם פרויקט">
          <input style={styles.input} value={props.newProjectName} onChange={(e) => props.setNewProjectName(e.target.value)} />
        </Field>
        <Field label="מנהל פרויקט">
          <input style={styles.input} value={props.newProjectManager} onChange={(e) => props.setNewProjectManager(e.target.value)} />
        </Field>
        <Field label="תיאור" full>
          <textarea style={styles.textarea} value={props.newProjectDescription} onChange={(e) => props.setNewProjectDescription(e.target.value)} />
        </Field>
      </div>

      <div style={styles.buttonRow}>
        <button style={styles.primaryBtn} onClick={props.addProject}>הוסף פרויקט</button>
      </div>

      <div style={{ ...styles.cardGrid, marginTop: 18 }}>
        {displayProjects.map((project) => {
          const isActive = project.id === props.currentProjectId;
          return (
            <div
              key={project.id}
              style={{
                ...styles.recordCard,
                border: isActive ? '2px solid #16a34a' : styles.recordCard.border,
                background: isActive ? '#f0fdf4' : styles.recordCard.background,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div style={{ fontWeight: 900, fontSize: 17 }}>{project.name}</div>
                {isActive && (
                  <span style={{ background: '#dcfce7', color: '#166534', padding: '5px 12px', borderRadius: 999, fontWeight: 900 }}>
                    ✔ פעיל
                  </span>
                )}
              </div>

              <div style={{ color: '#475569', marginTop: 8 }}>מנהל: {project.manager || '-'}</div>
              <div style={{ color: '#475569', marginTop: 4 }}>תיאור: {project.description || '-'}</div>
              <div style={{ color: '#475569', marginTop: 4 }}>נוצר: {project.createdAt}</div>

              <div style={styles.buttonRow}>
                <button
                  style={{ ...styles.primaryBtn, background: isActive ? '#16a34a' : '#0f172a' }}
                  onClick={() => props.setActiveProject(project.id)}
                >
                  {isActive ? '✔ פרויקט פעיל' : 'בחר פרויקט לעבודה'}
                </button>
                <button style={styles.secondaryBtn} onClick={() => props.renameProject(project.id)}>ערוך שם</button>
                <button style={styles.secondaryBtn} onClick={() => props.updateProjectMeta(project.id)}>ערוך פרטים</button>
                <button style={styles.dangerBtn} onClick={() => props.deleteProject(project.id)}>מחק</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
