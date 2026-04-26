'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ApprovalFlow, ChecklistItem, ChecklistRecord, ChecklistTemplateKey, NonconformanceRecord, PreliminaryRecord, PreliminaryTab, Project, Section, TrialSectionRecord, PersistedData } from './types';
import { buildChecklistItemsFromTemplate, checklistTemplates, defaultProjects, normalizeChecklistTemplateKey } from './checklistTemplates';
import { styles } from './components/common';
import { SavedRecordsSidebar } from './components/SavedRecordsSidebar';
import { HomeSection } from './components/HomeSection';
import { ProjectsSection } from './components/ProjectsSection';
import { ChecklistsSection } from './components/ChecklistsSection';
import { NonconformancesSection } from './components/NonconformancesSection';
import { TrialSectionsSection } from './components/TrialSectionsSection';
import { PreliminarySection } from './components/PreliminarySection';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
const STORAGE_KEY = 'yk-quality-stage4-multifile';
const CURRENT_PROJECT_STORAGE_KEY = `${STORAGE_KEY}-current-project-id`;
const SUPABASE_HEADER_ERROR_FRAGMENT = 'String contains non ISO-8859-1 code point';
const CONTROL_QUALITY_COMPANY_NAME = 'קונטרולינג פריים בע"מ';


type ProjectProfile = {
  projectName: string;
  contractor: string;
  projectManager: string;
  qaCompany: string;
  qualityControl: string;
  workManager: string;
  surveyor: string;
};

const PROJECT_PROFILES: ProjectProfile[] = [
  {
    projectName: "כביש 806 צלמון שלב א׳",
    contractor: 'מפלסי הגליל סלילה עפר ופיתוח בע"מ',
    projectManager: 'א.ש. רונן הנדסה אזרחית בע"מ',
    qaCompany: 'תיקו הנדסה בע"מ',
    qualityControl: 'יונס אברהים',
    workManager: 'חוסיין מריסאת',
    surveyor: 'באסל שקארה',
  },
];

const normalizeHebrewProjectName = (value: unknown) =>
  String(value ?? '')
    .replace(/[׳`’']/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const getProjectProfile = (projectName: unknown): ProjectProfile | undefined => {
  const normalized = normalizeHebrewProjectName(projectName);
  return PROJECT_PROFILES.find((profile) => {
    const profileName = normalizeHebrewProjectName(profile.projectName);
    return normalized === profileName || (normalized.includes('806') && normalized.includes('צלמון'));
  });
};

const resolveResponsibleName = (responsible: unknown, projectName: unknown) => {
  const profile = getProjectProfile(projectName);
  if (!profile) return '';
  const role = String(responsible ?? '');

  if (role.includes('בקרת איכות') || role.includes('בקר איכות')) return profile.qualityControl;
  if (role.includes('מנהל עבודה')) return profile.workManager;
  if (role.includes('מודד')) return profile.surveyor;
  if (role.includes('הבטחת איכות')) return profile.qaCompany;
  if (role.includes('ניהול פרויקט') || role.includes('מנהל פרויקט')) return profile.projectManager;

  return '';
};

const nowLocal = () => new Date().toLocaleString('he-IL');
const nowIso = () => new Date().toISOString();

type StoredAttachment = {
  name: string;
  type: string;
  dataUrl: string;
  uploadedAt: string;
};

const normalizeAttachments = (value: unknown): StoredAttachment[] =>
  Array.isArray(value)
    ? value
        .filter((item) => item && typeof item === 'object')
        .map((item: any) => ({
          name: String(item.name ?? 'קובץ'),
          type: String(item.type ?? ''),
          dataUrl: String(item.dataUrl ?? ''),
          uploadedAt: String(item.uploadedAt ?? ''),
        }))
        .filter((item) => item.dataUrl)
    : [];


const createDefaultApproval = (): ApprovalFlow => ({
  status: 'draft',
  remarks: '',
  signatures: [
    { role: 'מנהל בקרת איכות', signerName: '', signature: '', signedAt: '', required: true },
    { role: 'מנהל הבטחת איכות', signerName: '', signature: '', signedAt: '', required: true },
  ],
});

const normalizeApproval = (value: unknown): ApprovalFlow => {
  const base = createDefaultApproval();
  if (!value || typeof value !== 'object') return base;
  const raw = value as Partial<ApprovalFlow>;
  const signatures = Array.isArray(raw.signatures) ? raw.signatures : [];
  return {
    status: raw.status === 'approved' || raw.status === 'rejected' ? raw.status : 'draft',
    remarks: typeof raw.remarks === 'string' ? raw.remarks : '',
    signatures: base.signatures.map((entry) => {
      const found = signatures.find((s: any) => s?.role === entry.role || (entry.role === 'מנהל הבטחת איכות' && s?.role === 'מנהל פרויקט')) as any;
      return {
        ...entry,
        signerName: found?.signerName ?? '',
        signature: found?.signature ?? '',
        signedAt: found?.signedAt ?? '',
      };
    }),
  };
};

const approvalRequiresSignatures = (approval: ApprovalFlow) => approval.status === 'approved';
const validateApproval = (approval: ApprovalFlow) => {
  if (!approvalRequiresSignatures(approval)) return null;
  const missing = approval.signatures.filter((s) => s.required && (!s.signerName.trim() || !s.signature.trim() || !s.signedAt));
  if (missing.length) return 'לא ניתן לאשר בלי חתימה, שם ותאריך לכל החתימות החובה.';
  return null;
};

const emptyChecklistItem = (id: string): ChecklistItem => ({ id, description: '', responsible: '', status: 'לא נבדק', notes: '', inspector: '', executionDate: '' });
const normalizeChecklistItems = (items: ChecklistItem[] | unknown): ChecklistItem[] => Array.isArray(items) ? items.map((item, index) => ({ id: item?.id ?? `${Date.now()}-${index}`, description: item?.description ?? '', responsible: item?.responsible ?? '', status: item?.status ?? 'לא נבדק', notes: item?.notes ?? '', inspector: item?.inspector ?? '', executionDate: item?.executionDate ?? '' })) : [];

const createDefaultChecklist = (templateKey: ChecklistTemplateKey = 'general'): Omit<ChecklistRecord, 'id' | 'projectId' | 'savedAt'> => ({ checklistNo: undefined, templateKey, title: checklistTemplates[templateKey].title, category: checklistTemplates[templateKey].category, location: '', date: '', contractor: '', notes: '', items: buildChecklistItemsFromTemplate(templateKey), approval: createDefaultApproval() });
const createDefaultNonconformance = (): Omit<NonconformanceRecord, 'id' | 'projectId' | 'savedAt'> => ({ title: '', location: '', date: '', raisedBy: '', severity: 'בינונית', status: 'פתוח', description: '', actionRequired: '', notes: '', images: [] as StoredAttachment[], approval: createDefaultApproval() } as any);
const createDefaultTrialSection = (): Omit<TrialSectionRecord, 'id' | 'projectId' | 'savedAt'> => ({ title: '', location: '', date: '', spec: '', result: '', approvedBy: '', status: 'טיוטה', notes: '', images: [] as StoredAttachment[], approval: createDefaultApproval() } as any);
const createDefaultPreliminary = (subtype: PreliminaryTab): Omit<PreliminaryRecord, 'id' | 'projectId' | 'savedAt'> => ({ subtype, title: subtype === 'suppliers' ? 'בקרה מקדימה - ספקים' : subtype === 'subcontractors' ? 'בקרה מקדימה - קבלנים' : 'בקרה מקדימה - חומרים', date: '', status: 'טיוטה', supplier: subtype === 'suppliers' ? { supplierName: '', suppliedMaterial: '', contactPhone: '', approvalNo: '', notes: '' } : undefined, subcontractor: subtype === 'subcontractors' ? { subcontractorName: '', field: '', contactPhone: '', approvalNo: '', notes: '' } : undefined, material: subtype === 'materials' ? { materialName: '', source: '', usage: '', certificateNo: '', notes: '' } : undefined, approval: createDefaultApproval() });

const isSupabaseHeaderEncodingError = (error: unknown) => String(error ?? '').includes(SUPABASE_HEADER_ERROR_FRAGMENT);
const errorText = (error: unknown) => typeof error === 'object' && error !== null ? `${String((error as any).message ?? '')} ${String((error as any).details ?? '')}`.trim() : String(error ?? '');
const isMissingColumnError = (error: unknown, columnName: string) => errorText(error).toLowerCase().includes(columnName.toLowerCase()) && errorText(error).toLowerCase().includes('does not exist');
const shouldIgnoreCloudError = (error: unknown) => /relation .* does not exist/i.test(errorText(error));
const readLocalCurrentProjectId = () => typeof window === 'undefined' ? null : window.localStorage.getItem(CURRENT_PROJECT_STORAGE_KEY);
const writeLocalCurrentProjectId = (projectId: string | null) => { if (typeof window === 'undefined') return; projectId ? window.localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, projectId) : window.localStorage.removeItem(CURRENT_PROJECT_STORAGE_KEY); };

async function selectTable(table: string, orderColumn?: string) {
  const baseQuery = supabase.from(table).select('*');
  if (!orderColumn) return await baseQuery;
  const ordered = await supabase.from(table).select('*').order(orderColumn, { ascending: false });
  if (!ordered.error) return ordered;
  if (isMissingColumnError(ordered.error, orderColumn)) return await baseQuery;
  return ordered;
}

async function saveWithApprovalFallback(table: string, payload: Record<string, any>, mode: 'insert' | 'update', id?: string) {
  let result = mode === 'insert' ? await supabase.from(table).insert(payload) : await supabase.from(table).update(payload).eq('id', id);
  if (result.error && isMissingColumnError(result.error, 'approval')) {
    const { approval, ...withoutApproval } = payload;
    result = mode === 'insert' ? await supabase.from(table).insert(withoutApproval) : await supabase.from(table).update(withoutApproval).eq('id', id);
  }
  if (result.error && isMissingColumnError(result.error, 'images')) {
    const { images, ...withoutImages } = payload;
    result = mode === 'insert' ? await supabase.from(table).insert(withoutImages) : await supabase.from(table).update(withoutImages).eq('id', id);
  }
  if (result.error) throw new Error(errorText(result.error) || 'שגיאה בשמירה מול Supabase');
}

export default function Page() {
  const [section, setSection] = useState<Section>('home');
  const [preliminaryTab, setPreliminaryTab] = useState<PreliminaryTab>('suppliers');
  const [projects, setProjects] = useState<Project[]>(isSupabaseConfigured ? [] : defaultProjects);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(isSupabaseConfigured ? null : defaultProjects[0]?.id ?? null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectManager, setNewProjectManager] = useState('');
  const [checklistForm, setChecklistForm] = useState(createDefaultChecklist());
  const [nonconformanceForm, setNonconformanceForm] = useState(createDefaultNonconformance());
  const [trialSectionForm, setTrialSectionForm] = useState(createDefaultTrialSection());
  const [supplierPreliminaryForm, setSupplierPreliminaryForm] = useState(createDefaultPreliminary('suppliers'));
  const [subcontractorPreliminaryForm, setSubcontractorPreliminaryForm] = useState(createDefaultPreliminary('subcontractors'));
  const [materialPreliminaryForm, setMaterialPreliminaryForm] = useState(createDefaultPreliminary('materials'));
  const [savedChecklists, setSavedChecklists] = useState<ChecklistRecord[]>([]);
  const [savedNonconformances, setSavedNonconformances] = useState<NonconformanceRecord[]>([]);
  const [savedTrialSections, setSavedTrialSections] = useState<TrialSectionRecord[]>([]);
  const [savedPreliminary, setSavedPreliminary] = useState<PreliminaryRecord[]>([]);
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [editingNonconformanceId, setEditingNonconformanceId] = useState<string | null>(null);
  const [editingTrialSectionId, setEditingTrialSectionId] = useState<string | null>(null);
  const [editingPreliminaryId, setEditingPreliminaryId] = useState<string | null>(null);
  const [recordsSearchTerm, setRecordsSearchTerm] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cloudEnabled, setCloudEnabled] = useState(isSupabaseConfigured);

  const loadPersistedData = (raw: string | null) => {
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as PersistedData;
      setProjects(parsed.projects?.length ? parsed.projects : defaultProjects);
      setCurrentProjectId(parsed.currentProjectId ?? parsed.projects?.[0]?.id ?? defaultProjects[0]?.id ?? null);
      setSavedChecklists((parsed.savedChecklists ?? []).map((item) => ({ ...item, templateKey: normalizeChecklistTemplateKey(item.templateKey), items: normalizeChecklistItems(item.items), approval: normalizeApproval((item as any).approval) })));
      setSavedNonconformances((parsed.savedNonconformances ?? []).map((item) => ({ ...item, approval: normalizeApproval((item as any).approval) })));
      setSavedTrialSections((parsed.savedTrialSections ?? []).map((item) => ({ ...item, approval: normalizeApproval((item as any).approval) })));
      setSavedPreliminary((parsed.savedPreliminary ?? []).map((item) => ({ ...item, approval: normalizeApproval((item as any).approval) })));
    } catch (error) {
      console.error('Failed to parse local saved data', error);
    }
  };

  const loadFromCloudResults = (projectsRows: any[] | null, checklistRows: any[] | null, nonconRows: any[] | null, trialRows: any[] | null, preliminaryRows: any[] | null) => {
    const mappedProjects: Project[] = (projectsRows ?? []).map((row) => ({ id: row.id, name: row.name ?? '', description: row.description ?? '', manager: row.manager ?? '', isActive: Boolean(row.is_active), createdAt: row.created_at ? new Date(row.created_at).toLocaleString('he-IL') : '' }));
    setProjects(mappedProjects.length ? mappedProjects : defaultProjects);
    const storedProjectId = readLocalCurrentProjectId();
    const active = (storedProjectId ? mappedProjects.find((p) => p.id === storedProjectId) : undefined) ?? mappedProjects.find((p) => p.isActive) ?? mappedProjects[0] ?? defaultProjects[0];
    setCurrentProjectId(active?.id ?? null);
    setSavedChecklists((checklistRows ?? []).map((row) => ({ id: row.id, projectId: row.project_id, checklistNo: row.checklist_no ?? undefined, templateKey: normalizeChecklistTemplateKey(row.template_key), title: row.title ?? '', category: row.category ?? '', location: row.location ?? '', date: row.date ?? '', contractor: row.contractor ?? '', notes: row.notes ?? '', items: normalizeChecklistItems(row.items), approval: normalizeApproval(row.approval), savedAt: row.saved_at ? new Date(row.saved_at).toLocaleString('he-IL') : '' })));
    setSavedNonconformances((nonconRows ?? []).map((row) => ({ id: row.id, projectId: row.project_id, title: row.title ?? '', location: row.location ?? '', date: row.date ?? '', raisedBy: row.raised_by ?? '', severity: row.severity ?? 'בינונית', status: row.status ?? 'פתוח', description: row.description ?? '', actionRequired: row.action_required ?? '', notes: row.notes ?? '', images: normalizeAttachments(row.images), approval: normalizeApproval(row.approval), savedAt: row.saved_at ? new Date(row.saved_at).toLocaleString('he-IL') : '' })));
    setSavedTrialSections((trialRows ?? []).map((row) => ({ id: row.id, projectId: row.project_id, title: row.title ?? '', location: row.location ?? '', date: row.date ?? '', spec: row.spec ?? '', result: row.result ?? '', approvedBy: row.approved_by ?? '', status: row.status ?? 'טיוטה', notes: row.notes ?? '', images: normalizeAttachments(row.images), approval: normalizeApproval(row.approval), savedAt: row.saved_at ? new Date(row.saved_at).toLocaleString('he-IL') : '' })));
    setSavedPreliminary((preliminaryRows ?? []).map((row) => ({ id: row.id, projectId: row.project_id, subtype: row.subtype, title: row.title ?? '', date: row.date ?? '', status: row.status ?? 'טיוטה', supplier: row.supplier ?? undefined, subcontractor: row.subcontractor ?? undefined, material: row.material ?? undefined, approval: normalizeApproval(row.approval), savedAt: row.saved_at ? new Date(row.saved_at).toLocaleString('he-IL') : '' })));
  };

  useEffect(() => {
    const loadAll = async () => {
      if (!cloudEnabled) {
        loadPersistedData(window.localStorage.getItem(STORAGE_KEY));
        setLoaded(true);
        return;
      }
      try {
        const [projectsRes, checklistsRes, nonconRes, trialsRes, prelimRes] = await Promise.all([selectTable('projects', 'created_at'), selectTable('checklists', 'saved_at'), selectTable('nonconformances', 'saved_at'), selectTable('trial_sections', 'saved_at'), selectTable('preliminary_records', 'saved_at')]);
        const fatal = [projectsRes.error, checklistsRes.error, nonconRes.error, trialsRes.error, prelimRes.error].filter((item) => item && !shouldIgnoreCloudError(item));
        if (fatal.length) throw fatal[0];
        loadFromCloudResults(projectsRes.data, checklistsRes.data, nonconRes.data, trialsRes.data, prelimRes.data);
      } catch (error) {
        if (isSupabaseHeaderEncodingError(error)) setCloudEnabled(false);
        loadPersistedData(window.localStorage.getItem(STORAGE_KEY));
      } finally {
        setLoaded(true);
      }
    };
    void loadAll();
  }, [cloudEnabled]);

  useEffect(() => {
    if (!loaded || typeof window === 'undefined') return;

    // כאשר Supabase פעיל, הנתונים נשמרים בענן. אין צורך לשמור את כל הרשומות
    // גם ב-localStorage, כי תמונות/קבצים עלולים לעבור את מגבלת הדפדפן ולגרום לקריסת הדף.
    if (cloudEnabled) {
      writeLocalCurrentProjectId(currentProjectId);
      return;
    }

    try {
      const payload: PersistedData = {
        projects,
        currentProjectId,
        savedChecklists,
        savedNonconformances,
        savedTrialSections,
        savedPreliminary,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('Local storage quota exceeded. Clearing local cache and continuing without crash.', error);
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }, [projects, currentProjectId, savedChecklists, savedNonconformances, savedTrialSections, savedPreliminary, loaded, cloudEnabled]);
  useEffect(() => { if (loaded) writeLocalCurrentProjectId(currentProjectId); }, [currentProjectId, loaded]);

  const refreshCloudData = async () => {
    if (!cloudEnabled) return;
    const [projectsRes, checklistsRes, nonconRes, trialsRes, prelimRes] = await Promise.all([selectTable('projects', 'created_at'), selectTable('checklists', 'saved_at'), selectTable('nonconformances', 'saved_at'), selectTable('trial_sections', 'saved_at'), selectTable('preliminary_records', 'saved_at')]);
    const fatal = [projectsRes.error, checklistsRes.error, nonconRes.error, trialsRes.error, prelimRes.error].filter((item) => item && !shouldIgnoreCloudError(item));
    if (fatal.length) throw fatal[0];
    loadFromCloudResults(projectsRes.data, checklistsRes.data, nonconRes.data, trialsRes.data, prelimRes.data);
  };

  const withSaving = async (action: () => Promise<void>) => {
    try { setIsSaving(true); await action(); } catch (error) { console.error(error); alert(errorText(error) || 'אירעה שגיאה בשמירה'); if (cloudEnabled) { try { await refreshCloudData(); } catch {} } } finally { setIsSaving(false); }
  };

  const currentProject = useMemo(() => projects.find((p) => p.id === currentProjectId) ?? null, [projects, currentProjectId]);
  const currentProjectProfile = useMemo(() => getProjectProfile(currentProject?.name), [currentProject?.name]);
  const projectName = !loaded ? 'טוען...' : currentProjectProfile?.projectName ?? currentProject?.name ?? 'לא נבחר פרויקט';

  const checklistSequenceKey = (projectId: string) => `${STORAGE_KEY}-checklist-sequence-${projectId}`;
  const getStoredChecklistSequence = (projectId: string) => {
    if (typeof window === 'undefined') return 0;
    return Number(window.localStorage.getItem(checklistSequenceKey(projectId)) ?? 0) || 0;
  };
  const setStoredChecklistSequence = (projectId: string, value: number) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(checklistSequenceKey(projectId), String(value));
  };
  const getMaxSavedChecklistNo = (projectId: string) =>
    savedChecklists
      .filter((item) => item.projectId === projectId)
      .reduce((max, item) => Math.max(max, Number((item as any).checklistNo ?? 0) || 0), 0);
  const allocateNextChecklistNo = (projectId: string) => {
    const next = Math.max(getStoredChecklistSequence(projectId), getMaxSavedChecklistNo(projectId)) + 1;
    setStoredChecklistSequence(projectId, next);
    return next;
  };
  const getExistingEditingChecklistNo = () =>
    editingChecklistId ? savedChecklists.find((item) => item.id === editingChecklistId)?.checklistNo : undefined;
  const ensureChecklistNo = () => {
    if (!currentProjectId) return undefined;
    const existing = getExistingEditingChecklistNo();
    if (existing) return existing;
    if ((checklistForm as any).checklistNo) return Number((checklistForm as any).checklistNo);
    const next = allocateNextChecklistNo(currentProjectId);
    setChecklistForm((prev) => ({ ...(prev as any), checklistNo: next }));
    return next;
  };

  const applyProjectTeamToItems = (items: ChecklistItem[]) =>
    items.map((item) => ({
      ...item,
      inspector: resolveResponsibleName(item.responsible, projectName) || item.inspector,
    }));
  const checklistTemplateLabel = (key: ChecklistTemplateKey | string | undefined) => checklistTemplates[normalizeChecklistTemplateKey(key)]?.label ?? 'רשימת תיוג';
  const normalizedSearchTerm = recordsSearchTerm.trim().toLowerCase();
  const projectChecklists = useMemo(() => savedChecklists.filter((item) => item.projectId === currentProjectId).filter((item) => !normalizedSearchTerm || [item.title, item.category, item.location, item.contractor].join(' ').toLowerCase().includes(normalizedSearchTerm)), [savedChecklists, currentProjectId, normalizedSearchTerm]);
  const projectNonconformances = useMemo(() => savedNonconformances.filter((item) => item.projectId === currentProjectId).filter((item) => !normalizedSearchTerm || [item.title, item.location, item.description, item.status].join(' ').toLowerCase().includes(normalizedSearchTerm)), [savedNonconformances, currentProjectId, normalizedSearchTerm]);
  const projectTrialSections = useMemo(() => savedTrialSections.filter((item) => item.projectId === currentProjectId).filter((item) => !normalizedSearchTerm || [item.title, item.location, item.spec, item.result].join(' ').toLowerCase().includes(normalizedSearchTerm)), [savedTrialSections, currentProjectId, normalizedSearchTerm]);
  const projectPreliminary = useMemo(() => savedPreliminary.filter((item) => item.projectId === currentProjectId).filter((item) => !normalizedSearchTerm || [item.title, item.subtype, item.status].join(' ').toLowerCase().includes(normalizedSearchTerm)), [savedPreliminary, currentProjectId, normalizedSearchTerm]);

  const extractSequentialNo = (title: unknown) => {
    const text = String(title ?? '');
    const match = text.match(/מס[׳'’`]?\s*(\d+)/) ?? text.match(/#\s*(\d+)/) ?? text.match(/(?:^|\s)(\d+)(?:\s|$)/);
    return match ? Number(match[1]) || 0 : 0;
  };
  const nextSequentialNo = (records: Array<{ title?: string; projectId?: string; subtype?: string }>, subtype?: PreliminaryTab) =>
    records
      .filter((item) => item.projectId === currentProjectId)
      .filter((item) => !subtype || item.subtype === subtype)
      .reduce((max, item) => Math.max(max, extractSequentialNo(item.title)), 0) + 1;
  const numberedTitle = (base: string, number: number) => `${base} מס׳ ${number}`;
  const titleHasNumber = (title: unknown) => extractSequentialNo(title) > 0;
  const nextNonconformanceTitle = () => numberedTitle('אי התאמה', nextSequentialNo(savedNonconformances as any));
  const nextTrialSectionTitle = () => numberedTitle('קטע ניסוי', nextSequentialNo(savedTrialSections as any));
  const preliminaryBaseTitle = (subtype: PreliminaryTab) => subtype === 'suppliers' ? 'אישור ספקים' : subtype === 'subcontractors' ? 'אישור קבלנים' : 'אישור חומרים';
  const nextPreliminaryTitle = (subtype: PreliminaryTab) => numberedTitle(preliminaryBaseTitle(subtype), nextSequentialNo(savedPreliminary as any, subtype));


  useEffect(() => {
    if (!loaded || section !== 'checklists') return;
    const profile = currentProjectProfile ?? getProjectProfile(projectName);
    if (!profile) return;
    setChecklistForm((prev) => ({
      ...prev,
      contractor: !prev.contractor || prev.contractor.includes('פלסי הגליל') ? profile.contractor : prev.contractor,
      items: prev.items.map((item) => ({
        ...item,
        inspector: resolveResponsibleName(item.responsible, profile.projectName) || item.inspector,
      })),
    }));
  }, [loaded, section, currentProjectId, currentProjectProfile?.projectName, projectName]);

  const resetChecklistForm = (templateKey: ChecklistTemplateKey = checklistForm.templateKey) => {
    setEditingChecklistId(null);
    const next = createDefaultChecklist(templateKey);
    const profile = currentProjectProfile ?? getProjectProfile(projectName);
    setChecklistForm({ ...next, contractor: profile?.contractor || '', items: applyProjectTeamToItems(next.items) });
  };
  const resetNonconformanceEditor = () => {
    setEditingNonconformanceId(null);
    setNonconformanceForm({ ...createDefaultNonconformance(), title: nextNonconformanceTitle() });
  };
  const resetTrialSectionEditor = () => {
    setEditingTrialSectionId(null);
    setTrialSectionForm({ ...createDefaultTrialSection(), title: nextTrialSectionTitle() });
  };
  const resetPreliminaryEditor = () => {
    setEditingPreliminaryId(null);
    if (preliminaryTab === 'suppliers') setSupplierPreliminaryForm({ ...createDefaultPreliminary('suppliers'), title: nextPreliminaryTitle('suppliers') });
    if (preliminaryTab === 'subcontractors') setSubcontractorPreliminaryForm({ ...createDefaultPreliminary('subcontractors'), title: nextPreliminaryTitle('subcontractors') });
    if (preliminaryTab === 'materials') setMaterialPreliminaryForm({ ...createDefaultPreliminary('materials'), title: nextPreliminaryTitle('materials') });
  };

  const addProject = async () => {
    if (!newProjectName.trim()) return alert('יש להזין שם פרויקט');
    const id = crypto.randomUUID();
    const project: Project = { id, name: newProjectName.trim(), description: newProjectDescription.trim(), manager: newProjectManager.trim(), isActive: true, createdAt: nowLocal() };
    await withSaving(async () => {
      if (cloudEnabled) {
        await supabase.from('projects').update({ is_active: false }).neq('id', id);
        const result = await supabase.from('projects').insert({ id, name: project.name, description: project.description, manager: project.manager, is_active: true, created_at: nowIso() });
        if (result.error) throw result.error;
        await refreshCloudData();
      } else {
        setProjects((prev) => [...prev.map((p) => ({ ...p, isActive: false })), project]);
        setCurrentProjectId(id);
      }
    });
    setNewProjectName(''); setNewProjectDescription(''); setNewProjectManager('');
  };

  const renameProject = async (projectId: string) => { const project = projects.find((p) => p.id === projectId); if (!project) return; const nextName = window.prompt('שם פרויקט חדש', project.name); if (!nextName?.trim()) return; await withSaving(async () => cloudEnabled ? (await supabase.from('projects').update({ name: nextName.trim() }).eq('id', projectId), await refreshCloudData()) : setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, name: nextName.trim() } : p))); };
  const updateProjectMeta = async (projectId: string) => { const project = projects.find((p) => p.id === projectId); if (!project) return; const description = window.prompt('תיאור פרויקט', project.description ?? ''); if (description === null) return; const manager = window.prompt('מנהל פרויקט', project.manager ?? ''); if (manager === null) return; await withSaving(async () => cloudEnabled ? (await supabase.from('projects').update({ description: description.trim(), manager: manager.trim() }).eq('id', projectId), await refreshCloudData()) : setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, description: description.trim(), manager: manager.trim() } : p))); };
  const setActiveProject = async (projectId: string) => await withSaving(async () => {
    setCurrentProjectId(projectId);
    writeLocalCurrentProjectId(projectId);
    if (cloudEnabled) {
      await supabase.from('projects').update({ is_active: false }).neq('id', projectId);
      const result = await supabase.from('projects').update({ is_active: true }).eq('id', projectId);
      if (result.error) throw result.error;
      await refreshCloudData();
      setCurrentProjectId(projectId);
    } else {
      setProjects((prev) => prev.map((p) => ({ ...p, isActive: p.id === projectId })));
    }
  });
  const deleteProject = async (projectId: string) => { const project = projects.find((p) => p.id === projectId); if (!project || !window.confirm(`למחוק את הפרויקט "${project.name}"?`)) return; await withSaving(async () => { if (cloudEnabled) { await supabase.from('checklists').delete().eq('project_id', projectId); await supabase.from('nonconformances').delete().eq('project_id', projectId); await supabase.from('trial_sections').delete().eq('project_id', projectId); await supabase.from('preliminary_records').delete().eq('project_id', projectId); const result = await supabase.from('projects').delete().eq('id', projectId); if (result.error) throw result.error; await refreshCloudData(); } else { const nextProjects = projects.filter((p) => p.id !== projectId); setProjects(nextProjects.map((p, i) => ({ ...p, isActive: i === 0 }))); setCurrentProjectId(nextProjects[0]?.id ?? null); setSavedChecklists((prev) => prev.filter((x) => x.projectId !== projectId)); setSavedNonconformances((prev) => prev.filter((x) => x.projectId !== projectId)); setSavedTrialSections((prev) => prev.filter((x) => x.projectId !== projectId)); setSavedPreliminary((prev) => prev.filter((x) => x.projectId !== projectId)); } }); };

  const applyChecklistTemplate = (templateKey: ChecklistTemplateKey) => setChecklistForm((prev) => {
    const next = createDefaultChecklist(templateKey);
    const profile = currentProjectProfile ?? getProjectProfile(projectName);
    return {
      ...next,
      location: prev.location,
      date: prev.date,
      contractor: !prev.contractor || prev.contractor.includes('פלסי הגליל') ? profile?.contractor || '' : prev.contractor,
      notes: prev.notes,
      items: applyProjectTeamToItems(next.items),
      approval: prev.approval,
    };
  });
  const updateChecklistItem = (id: string, field: keyof ChecklistItem, value: string) => setChecklistForm((prev) => ({ ...prev, items: prev.items.map((item) => item.id === id ? { ...item, [field]: value } : item) }));
  const addChecklistItem = () => setChecklistForm((prev) => ({ ...prev, items: [...prev.items, emptyChecklistItem(crypto.randomUUID())] }));
  const removeChecklistItem = (id: string) => setChecklistForm((prev) => ({ ...prev, items: prev.items.length <= 1 ? prev.items : prev.items.filter((item) => item.id !== id) }));

  const saveChecklist = async () => {
    if (!currentProjectId) return alert('יש לבחור פרויקט');
    if (!checklistForm.title.trim()) return alert('יש להזין שם רשימת תיוג');
    const validation = validateApproval(checklistForm.approval); if (validation) return alert(validation);
    const id = editingChecklistId ?? crypto.randomUUID();
    const existingChecklistNo = getExistingEditingChecklistNo();
    const checklistNo = existingChecklistNo ?? (checklistForm as any).checklistNo ?? allocateNextChecklistNo(currentProjectId);
    setStoredChecklistSequence(currentProjectId, Math.max(getStoredChecklistSequence(currentProjectId), Number(checklistNo) || 0));
    const record: ChecklistRecord = { id, projectId: currentProjectId, checklistNo: Number(checklistNo), ...checklistForm, items: normalizeChecklistItems(checklistForm.items), approval: normalizeApproval(checklistForm.approval), savedAt: nowLocal() };
    await withSaving(async () => {
      if (cloudEnabled) {
        const payload = { id: record.id, project_id: record.projectId, checklist_no: record.checklistNo, template_key: record.templateKey, title: record.title, category: record.category, location: record.location, date: record.date, contractor: record.contractor, notes: record.notes, items: record.items, approval: record.approval, saved_at: nowIso() };
        await saveWithApprovalFallback('checklists', payload, editingChecklistId ? 'update' : 'insert', editingChecklistId ?? undefined);
        await refreshCloudData();
      } else {
        setSavedChecklists((prev) => editingChecklistId ? prev.map((item) => item.id === editingChecklistId ? record : item) : [record, ...prev]);
      }
    });
    resetChecklistForm();
  };
  const loadChecklist = (record: ChecklistRecord) => { setSection('checklists'); setEditingChecklistId(record.id); setChecklistForm({ checklistNo: record.checklistNo, templateKey: record.templateKey, title: record.title, category: record.category, location: record.location, date: record.date, contractor: record.contractor, notes: record.notes, items: normalizeChecklistItems(record.items), approval: normalizeApproval(record.approval) }); };
  const deleteChecklist = async (id: string) => withSaving(async () => cloudEnabled ? (await supabase.from('checklists').delete().eq('id', id), await refreshCloudData()) : setSavedChecklists((prev) => prev.filter((item) => item.id !== id)));

  const saveNonconformance = async () => {
    if (!currentProjectId) return alert('יש לבחור פרויקט');
    if (!nonconformanceForm.title.trim()) return alert('יש להזין כותרת לאי התאמה');
    const validation = validateApproval(nonconformanceForm.approval); if (validation) return alert(validation);
    const id = editingNonconformanceId ?? crypto.randomUUID();
    const title = editingNonconformanceId || titleHasNumber(nonconformanceForm.title) ? nonconformanceForm.title : nextNonconformanceTitle();
    const record: NonconformanceRecord = { id, projectId: currentProjectId, ...nonconformanceForm, title, approval: normalizeApproval(nonconformanceForm.approval), savedAt: nowLocal() };
    await withSaving(async () => {
      if (cloudEnabled) {
        const payload = { id: record.id, project_id: record.projectId, title: record.title, location: record.location, date: record.date, raised_by: record.raisedBy, severity: record.severity, status: record.status, description: record.description, action_required: record.actionRequired, notes: record.notes, images: normalizeAttachments((record as any).images), approval: record.approval, saved_at: nowIso() };
        await saveWithApprovalFallback('nonconformances', payload, editingNonconformanceId ? 'update' : 'insert', editingNonconformanceId ?? undefined); await refreshCloudData();
      } else setSavedNonconformances((prev) => editingNonconformanceId ? prev.map((item) => item.id === editingNonconformanceId ? record : item) : [record, ...prev]);
    });
    resetNonconformanceEditor();
  };
  const loadNonconformance = (record: NonconformanceRecord) => { setSection('nonconformances'); setEditingNonconformanceId(record.id); setNonconformanceForm({ title: record.title, location: record.location, date: record.date, raisedBy: record.raisedBy, severity: record.severity, status: record.status, description: record.description, actionRequired: record.actionRequired, notes: record.notes, images: normalizeAttachments((record as any).images), approval: normalizeApproval(record.approval) } as any); };
  const deleteNonconformance = async (id: string) => withSaving(async () => cloudEnabled ? (await supabase.from('nonconformances').delete().eq('id', id), await refreshCloudData()) : setSavedNonconformances((prev) => prev.filter((item) => item.id !== id)));

  const saveTrialSection = async () => {
    if (!currentProjectId) return alert('יש לבחור פרויקט');
    if (!trialSectionForm.title.trim()) return alert('יש להזין שם לקטע ניסוי');
    const validation = validateApproval(trialSectionForm.approval); if (validation) return alert(validation);
    const id = editingTrialSectionId ?? crypto.randomUUID();
    const title = editingTrialSectionId || titleHasNumber(trialSectionForm.title) ? trialSectionForm.title : nextTrialSectionTitle();
    const record: TrialSectionRecord = { id, projectId: currentProjectId, ...trialSectionForm, title, approval: normalizeApproval(trialSectionForm.approval), savedAt: nowLocal() };
    await withSaving(async () => {
      if (cloudEnabled) {
        const payload = { id: record.id, project_id: record.projectId, title: record.title, location: record.location, date: record.date, spec: record.spec, result: record.result, approved_by: record.approvedBy, status: record.status, notes: record.notes, images: normalizeAttachments((record as any).images), approval: record.approval, saved_at: nowIso() };
        await saveWithApprovalFallback('trial_sections', payload, editingTrialSectionId ? 'update' : 'insert', editingTrialSectionId ?? undefined); await refreshCloudData();
      } else setSavedTrialSections((prev) => editingTrialSectionId ? prev.map((item) => item.id === editingTrialSectionId ? record : item) : [record, ...prev]);
    });
    resetTrialSectionEditor();
  };
  const loadTrialSection = (record: TrialSectionRecord) => { setSection('trialSections'); setEditingTrialSectionId(record.id); setTrialSectionForm({ title: record.title, location: record.location, date: record.date, spec: record.spec, result: record.result, approvedBy: record.approvedBy, status: record.status, notes: record.notes, images: normalizeAttachments((record as any).images), approval: normalizeApproval(record.approval) } as any); };
  const deleteTrialSection = async (id: string) => withSaving(async () => cloudEnabled ? (await supabase.from('trial_sections').delete().eq('id', id), await refreshCloudData()) : setSavedTrialSections((prev) => prev.filter((item) => item.id !== id)));

  const currentPreliminaryForm = preliminaryTab === 'suppliers' ? supplierPreliminaryForm : preliminaryTab === 'subcontractors' ? subcontractorPreliminaryForm : materialPreliminaryForm;
  const savePreliminary = async (subtype: PreliminaryTab) => {
    if (!currentProjectId) return alert('יש לבחור פרויקט');
    const form = subtype === 'suppliers' ? supplierPreliminaryForm : subtype === 'subcontractors' ? subcontractorPreliminaryForm : materialPreliminaryForm;
    if (!form.title.trim()) return alert('יש להזין כותרת');
    const validation = validateApproval(form.approval); if (validation) return alert(validation);
    const id = editingPreliminaryId ?? crypto.randomUUID();
    const title = editingPreliminaryId || titleHasNumber(form.title) ? form.title : nextPreliminaryTitle(subtype);
    const record: PreliminaryRecord = { id, projectId: currentProjectId, ...form, title, approval: normalizeApproval(form.approval), savedAt: nowLocal() };
    await withSaving(async () => {
      if (cloudEnabled) {
        const payload = { id: record.id, project_id: record.projectId, subtype: record.subtype, title: record.title, date: record.date, status: record.status, supplier: record.supplier ?? null, subcontractor: record.subcontractor ?? null, material: record.material ?? null, approval: record.approval, saved_at: nowIso() };
        await saveWithApprovalFallback('preliminary_records', payload, editingPreliminaryId ? 'update' : 'insert', editingPreliminaryId ?? undefined); await refreshCloudData();
      } else setSavedPreliminary((prev) => editingPreliminaryId ? prev.map((item) => item.id === editingPreliminaryId ? record : item) : [record, ...prev]);
    });
    resetPreliminaryEditor();
  };
  const loadPreliminary = (record: PreliminaryRecord) => { setSection('preliminary'); setPreliminaryTab(record.subtype); setEditingPreliminaryId(record.id); if (record.subtype === 'suppliers') setSupplierPreliminaryForm({ subtype: 'suppliers', title: record.title, date: record.date, status: record.status, supplier: record.supplier ?? createDefaultPreliminary('suppliers').supplier, approval: normalizeApproval(record.approval) }); if (record.subtype === 'subcontractors') setSubcontractorPreliminaryForm({ subtype: 'subcontractors', title: record.title, date: record.date, status: record.status, subcontractor: record.subcontractor ?? createDefaultPreliminary('subcontractors').subcontractor, approval: normalizeApproval(record.approval) }); if (record.subtype === 'materials') setMaterialPreliminaryForm({ subtype: 'materials', title: record.title, date: record.date, status: record.status, material: record.material ?? createDefaultPreliminary('materials').material, approval: normalizeApproval(record.approval) }); };
  const deletePreliminary = async (id: string) => withSaving(async () => cloudEnabled ? (await supabase.from('preliminary_records').delete().eq('id', id), await refreshCloudData()) : setSavedPreliminary((prev) => prev.filter((item) => item.id !== id)));

  const guardedBody = !currentProject && section !== 'home' && section !== 'projects' ? <div style={styles.emptyBox}>יש לבחור פרויקט לפני עבודה במסך זה.</div> : null;
  const homeModules = [{ key: 'projects', title: 'פרויקטים', icon: '📁', description: 'הוספה, עריכה וניהול פרויקטים', count: projects.length }, { key: 'checklists', title: 'רשימות תיוג', icon: '📋', description: 'טפסי בקרת איכות לפי תבנית', count: projectChecklists.length }, { key: 'nonconformances', title: 'אי תאמות', icon: '⚠️', description: 'מעקב סטטוסים ופעולות מתקנות', count: projectNonconformances.length }, { key: 'trialSections', title: 'קטעי ניסוי', icon: '🧪', description: 'ניהול אישורי קטעי ניסוי', count: projectTrialSections.length }, { key: 'preliminary', title: 'בקרה מקדימה', icon: '🗂️', description: 'ספקים, קבלנים וחומרים', count: projectPreliminary.length }];
  const labelForPreliminary = (subtype: PreliminaryTab) => subtype === 'suppliers' ? 'ספקים' : subtype === 'subcontractors' ? 'קבלנים' : 'חומרים';



  const CONTROLENG_LOGO_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJIAAAC3CAYAAAD5GgcLAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAAFxEAABcRAcom8z8AAGPzSURBVHhe7Z11mFXV18fFeu3u7ha7AxMVpbsbZoZhuruLgQGGFAsRRZBSQUFA6e6aHrDjh600630+a59z59w7d3DoQfljPXPn3hP77P09q9fax0UHNJZjdIwOlI7z/OJooQj/RhLRq4IiezeqdMzRSJFH6XMdpUBqIqmRLSQzppVSelRLSQhp6uW4o4tiAptIckQzyYxuKZkxPB/P1UyfNzqwSaXjaxIddUCCE+UmtJXSOUnyy5pM2bIqU/63MkOmvxskEb0aS3TvyuccDRTeq5Fkx7aS4i+i5JeVifLzigT5bU2SfDEmQOKCm0lk72NAOqgU6tdQ3ujXVf7akCNS3k92lvQV+bK/rJ0eIxH+jSXqKAVSmF9DyU9rLzsLU0VK02VPcZpIeYYUfx4lKREt9AXyPKcm0VEHpDDfhvJmv67y+7os2VmSK9sK+yigVkyJknA4kpdzjgYCSANS28nW9SmyqyhNdhSkipSkS8GMCEkOb64viec5NYmOPiD5NZIRfbrIb2vdgbR8SpSE9WosUV7OORoIIPVPbit/ewBpw/RwSQoDSMc40kEjlNEQ34by/hAf+XtjH9lRbIC0p6yfbJqfLOlRrVTXiA6sfG5NJ4D03uBusqswTcUbQNpTnC7fLIiV9OiW5rm8nFdT6KgBUkxgU4nq3UT/Lv84SvaU5SmIoB1FubK9qI+MH+4rob6NJAorR6nydWoa8XKgSGOdFcyMkD3FGbKjwHAkG1Cj87tKWK9GNVr/O2qAFB3QVMXaa7ld5I912bKrpK9st4BkuFJfKZubKGlRLS194ugAEmZ9qF8jGTO4u2zbkOoSazYh3opmRkpiaDP1MVU6v4bQUQMk3tr4kGaybnqsyOb+sh0u5ADSjqI+sqc0Vz58o5eE+zWS6BpuLkMxAU10rKmRLWXT3BiR8kw3ENlAQty9P7i7hPg0lOjAmukvOyqAFNW7kU74uOG+squ4r3yzJE1+W5utYFIQFefKpnlJ8vWiZPl5Vbr0S2qr3MvzOjWLmqioxvc1bZS/7ClJl28Wxsmfa1NcIg3u9NWCGNm2IUW+nBcjaZEtJdzfiMPK1zuyVOOBFGMpojghcTx+syhVJr7mr5+dVtviyeHy3uAesru0r6yYGiUxQU1quKVjRNrwrE7y59pU+WFJgrw3qJv8tjqpwmorTZc5YwPVKcnnaaN6qdJdEy3TGg0ko4gaPQLzXsrz5J2BPWRIZiflSO7mf6QeC4ikvK9MfqOXcqWaOOkQyjNW5qY5sSJlGSq6+sS3lj/XOoBUliFfvN9bRV/ZnGj5c32KDM5ob7gtIq4GcaYaDSSsFCb8g1f9ZHdpP1n5SbQ6HV/N6VzJj8RvwT4NpU98G/luaYr8tSFLHZcKphpm7cBV4kOaytIPQ0U2Z8vyj0JVB+yb2Eb+WpfsBqR5HwSqJToip6NsLUiVolmRkhzWQiJVxNUcfanmASkQE9+8aYRDBqV3kF9WZ8lPKzIlL7mdBPVooJabNyCxQKG+DeX13M7yx3rOSZUhGR31O3UJ1IA3mDHyfF+8HyB7yjKk9IsoyYhpJUE9G0r/lLZegcSLwHmz3uutIm7Wu73VMlVu7eUeR4JqHpAsn5Fh/S2l+ItEka/y5eO3ApS7QK9XASSdXP/GEtqrkSycFC7ybX/5dkmyDM3spPrIkRZzjD0uqKkBREmG7CxMl1ezO+r34X6NpX+yd46k5/ZqJKkRLeSr+TGyrSBV3hlYs7htjQMSbyuAiA9uJks/RN8ZIFLeX94d5CPBPRtIuB8cpyogGWck3u8540JkR4lxCfxvZZq81a+rvtUVCvihd1rGWB52AAxXTAlvLosmhoiUYuany++rk1WcMS5ENiGSqoAE9wE4iyYFiWzO1OwAgrxw7SP9gkA1CEiInqbKUQDDzDHBsqskTzbMSJBfVmXL2GG+Etyzvlpwr/etAkiW95dFWzAxVMrnJsjk13vJH+syZVtBtkx9y1/iQpq5Jl9F6CEUd3BWgEsMkEUvmsWLkSXrpkXIlLf8ZMuKRBmY2lZfDhNrq5ojASRo4aRA+XJujPy6KlG+WRgrOXGta4Sro8YACeccfhXezMlv9JbdpXmy6pMYGZjaQX5Yninj9hFICyeFSfHseAXliD6d5YdlKSJlfWT1J1EyMLW9iwt4juNgEYuOkpwQ2kwmjugpW1YkKSdaPClEwTwsq4P8sjJpn4G09MNgmfWev7w3qKummhTPipSM6Jb6cniO4XDSkQcS7D/Qcs75N5Zxw/1kZ3F/KZ2dpHk46ElbVmbtF5BK5yZqUhjWXP/kdlIyO17ky37y2+p0mfFuoFp4BlANLV3DcMX94lL6DCZVNqxXQ4kNaioj87pKwcxokbIs2VGYJp+M9FMuGNCjvrye20mBlJ/abp+AtOyjYHUJhPg1ks9G9xLZlCnrp4drxmiYn5dxHSaqAUAyviI8tuOG+cm2gn7y1aJ0yU1sJ4E96ktOfJt9B5JfQ1k4MUxK5yRqWAXxEooHeXSA/LwqTRXwXaU5atV9/n6QDEhpp4CL8G9iFF9ypdG3/kGRxePOPc05fGdSgN/N7yYFM6JkZ0GGbN+YLt8ujlevdXZcawV5iG8Dea1PJ/llxf4Bae64QAnxbaR65OJJwSJl6bJuWrhmCRwpMXdEgYTX2ra0JozwVxDtKe0vr/frqm8cC3rAQFKAmEWY9X6QbJwZK9mxrWXcMB/5ckGi7CjKkj/WZciGGTEy8TVfGZzRUUVFbFATXfSgng2Ugn0s4v8e5jsAmhjWTHIT2ij3mf1+oHy3KF6tMZTp9dMjZVhmB7Wwvl4QJ3lJbfWZbCD9fABA4sUDNGmRLaTkiyiRr7KlcGaEZMW0tNwdzPF+cNb9pCMDpECjE7EQMUFNZerbQbKjqJ9sLegrv67J0cVkwplcJ5BCfBpUD0i+jWTBBICUIHEhRuHle7hPwaxYBRcBUDIPN8yIVkX8t7UZIuV9ZFtBpmyaHy9LPwxX8Tf5dV95f0gPGZ3fTd4Z2E3ey+8uHwzrKVPf6iXzPghWsGxZbvQfKc3SFJC/1qXKB8N7qJgM8mkob+V1lm8XxsmAFAMkFhoHI+cNPAAg8T+icvnHIbJ1IwHeNCmbE6X+KHV3aNpNE53rSmtwkOnIAAnHnF9DSQxrLvPGR4iU58vm+SaGhlgbkdPlgIAE258PkOYmSFxwU1PW499IZo0JlILP46yMw8YS7NtIFk8Ok6LP42RgWnsFzKJJofLL6lSRTbkim3JESnNkV1GWbN+YKds3kiuUIXuKs0TKskXKs0VKsuTbhQky74MgeWdAV/n07V7yw9JEyYlvLSE+jXTB3+7fRb5dZAHJr6ECaXh2R/lp+b5bbZ5A4vnWfBImK6eEyrRRfrKrKFV+WhYnb/TtpIHuKFJq9kfn20c6fEBymNphvqYSZN30eAXRhhmJkhHdSnIT2snXi9LlVW9AGuqroqV6QGoo8yeEGiChI/VqaAEpSAo+jzVA0roxFiZC1k2P1sVFKUckzBsfIuXz4uWNvl1kZP+uMm5oT1n3aYT8uipFZowOkDGDe8gbuZ1l+ju95dtFCQoGxHNA9/rKfX5aliR5yW2VM/IcAOm7xfEqxhg/9xqW3UF+WpYo+QcBSOs+DZNFE4P05RgzuJv8uS5J/l6fJJNG9FRuhDMzJmA/jYhq0uEDUkATnWwW8PXcbvLt4gzZVTxAZo8jJ7mFBPasr2b5N4sBUmdjTfmhI7W2gORXLSBRUAjnsoGkyrYTSLMqA2n9Z9E6PnPPhjJ7XLBsmBnj0pMQgxNf9ZHN8+IV8AAVXem13E6yeW6cZMW21KIEvh89sKv8tDxJ9SHO5Xpv9+8s3y+Ol8FpBFwtIGVVAInvDhRIuAX4H26M/vXD0jjZXZwqC8cHupRwkznquS4Hhw4tkKy4GdZNmG8DSQhtIZ+OCpa/NuSJlA+UH5dnS7+kdroALCJOu++WEDbooovspmxXB0jW5LLw3oA008GRjJneSJZ+FO4CEroU388ZFywbZ8VYWYkG/JNf85Gv5hvLi+MA+Zv9OsuX8+I1as8xAGTUgC4KkLykNgZIFkf6YUm8Fbk3QBqa2UF+XJrg4lIHA0jMN3OAA3Tmu/4KJClNk83zolUnwyplPJXW6SDQIQSSya/mwRj8wNSOsmFmkuwpzZeCmUny6agg+XpRhuSnEWsyEzkovaN8tyRDhmd31oWqNkfalCerp1l1bQFGtJGf9OXCJEu0GYDMHhssJbONjgRAGNdSONKMGFWMbSDNHhckGywgcS7HGSDFK5DwO5n6ui4GSAlOIHWVn5Y6gOTXUEb27yLfL0moAJJfQxmS0V5zkAalHZiyXRlIJqY4e2xvKfk8UqaP8pM/1iTJ1g3Jms/Es+Nv4tzKa7b/dMiAhMXARCaHt5CP3wqULav7yJ8b+8n0USHqrAMs3y7JUPC4AynzH4HEAv65IVtkcz8FkXyZJ0s+inTVfsHGP3qzlyyaFG6qVP0NR5r6tr+smRalotQG+IqpEVI8O861CBw3d3ywFHwRWwlIX1cDSHCfH5ckWjqSLdosIKVXcKTB6e0OKZDmfRAgGz8Lk9jgppKf1k5KZ0dp2i6e8Nf7dNLxcs+DFac7KEBSE9Mi3nQ78eqtvO5SMidVpHyQ7CwdqPEyo3M0kDf6oSdlWkAyABmc0Ul+WJYhw7I7uxYQ7/OWVVnywTCAZEQFIY+yeUlaXfvZ6CAZM7in9EtuazzLFgFW5Ty9TZk3i4/PhTRcFE89zr+xDM3qIG/376rck++4BoBbPiVCkgCSnttIPnzdV75ZmGgBqZELSHApp2gbmWeARADWCST8S06fEaD6fvGhBVLhzHCtTiFFBUcpRQSyKUP+Xpck8z8I0JcU8a6l7ipB9l+HOmhA4i+TS4JWflonWT4lTrYVDZAfV/aRZR/Hyk+rcmRIVid1xrEQ7kAyE0nm4/dLM2RYFhzJgKZPfFv5fV2OTHi1lwKJapLE8BaSHt1KEkKaqxjr1eUVCejewJTsBDRRLsQEx4c0V46YEt5CfUboS7GBTdWPRDoHk8ckB3ZvoIuOlcVf3uLUiJbGQOhtuNSwrI7y6dv+mq2ogVgqfvt2lq8XJEiuU7T17yo/r0hWU9+lIw0w5j9AsUEzKL2dfL847pADKTG0uXrdQ/waauYAJU8LJwbKtg3JsmV5vHz4ek+dG/xOvFiea1tdOgAgGfDwBjMJPFR+ekeZ80Gk/Lq2n/yxIU/mTyRpq7UGXn9cmSOv5XZVsHkDkuoNmR0VSEOzOikHCfc3ynbBrAR5rU9XXRg71zmgRwMVn1mxrVUUjs73kcmv95ZZY0Jl0aRIWTklRt0LBbPipXAWf+Nkw4w4WTMtRpZ9HCkLJoarp3vKyN5aDzd6YHdNTxmc0UFy4tooAAEcIAL8gBiLSN9gi0sReZ/wqo++7QAOTjw0s6OGR/olmgIEjqMuDautX5KJ7SmQ0trJd4cRSBG9G8vyj4NlwfgAFeso32unhcrW9claWEA5FKKcOea6zjWuDu07kKz0TlvHYPDDs7vIog9j5Ze1/WRP+SDZXjRQPnozSHUcfCsA7H8r+2hmY6hyJMRCZSABoB+XZRqOZOUWJYU2l6zYNkZk4g8JaiqD0jvJlLeCZPmUWNk8P01+XUM5Uj+RsgFKhFl2l+QZKu0nu0r7alGATVTmQuR2S3muSFmu7CjKkb820N0kTb5ZnKyZA6s/jZSFk0JlxnuBMul1P3knv7uKQoDGAjEHcDTmwcwHc9REMqNbSVyQZfEhPjM7yNLJIZIV08pwMxpGpMKR4pUz2UAakNpWtm9M0yzI3UU0kciU+QDJikfC7Zd9FFINIDWR+eMDpPhzxDPjNEWYq6aEqr8pvBcvY2Odyzf7dlKH5h9rk6VoVoS8P6S7qgQ8S6S/CURXwoAX2icgobTywIiyPgltZeywXrJmepKKr68WZ8tn74bJu4N95OvFWfJOvo++kSZdthpA8m0gwwDS8gogAVomjLgWImXMUD+1/H5ZnSs7i0l4y5c9ZQP18/bCvrKtwAsVGsvOO+XItsJspe1F2bKjOEd2luTI7lIKLnM1ZALtLs2RnUXZCrRfVqdpSspXCxJk44xoWTQxVD4Z2UveHdRdhmV2VMUbZR7xysKyIMwDOpv98kGI27FDe2gPJLgeYEJEfjk/RtvZwJnoRrJgQpCrCAIwrP4kTBZODHYDUuGMCFk1NdQATsVTU5kzLkDWTwt1AR4uNeu9XjL5dR/LKDEZF3B3xjY4vYNysc3zomTjZxHqzCTpjmoclTj/UJFTfSAFNta6qldzusmk1wNl4aRYWTcjWX7fMEA+HR2qSh16A6Lmy0VZ8v5QU8UBq6w2kLI7y5ZV2crhwiw/T1xIcwVnydxU2VY8UHaX58vuknzZUQR48mR7YX+lSgDaRyB5o+2FWbKtMEu2F2XJjqJs2VlMhS9AyxEpyxEpyZY9xZmyq5DQSbr8tS5NtixHVMTJ6qnh8sX7gTJ5hI+8lddF8tPba3AXMcjiACacmuh4PD//s7D8jn6Fgv7p234yqn8XyxdngPTxm74yflgP5TKAAyDhM5rypq+uEdwIwwFXA9zOeLNNVIEAM1zI+JpYG8NJuba5f2MFNt7xBeMDZeGEIJnwag91nqZFNq+MiX0Fkgb9AptIXkpHeW9ILxk10EcyYtqowls6L13eHthTgnrWV8cfoY+vbSBhJvs2qDaQ0KEKZmEZtVEu1DexvSyfGi/bAVBZvv5FgbfBYwCUZ5EBDpxpe2E/2QEV9ZMdxX21gNIrFfWR7UU5yo0gTyABIm8EwKAdGzNl58YM2VmQLrsKMhRQuwszZE9RhkhJpqHSLI3N/bU2Vb5blKBZkiunhinHIEsS3eS13M4KHrzmcAcWmOcP7NHAitdZolPTXAyHU+eiZk4AKPOZY/iev1wDnU45oDpVTYoM6whYsBpJjiNUwxrb+VhwOUAGJwXUr/XpKKMGdlH9zga0Jz6qDSTbuWi/SSw6b1JGdGvZtCBT3h3kqwop7A8gfbM4S8baQLJF26pco2xblsyb/bqpz0iBZDkM0YX6JuDppca/uwIS18GOEgMgmyqAlCc7CtGHjG4EkZ4LgADV1o258tfGPtqUy0Ubc+TvjTmytSBHthfmqG5UIc6MSIP4n5ylnSVG5JFu4uJQNpAKyL3OkB0Ec5XS3anA0M7CDNllg4ssgfJMVaR3F6drvT+523jDSTUpmx2luUWLJwXJF2N6y9S3fGXcsB7qMSckMySjg4IOsYP5DmXHtJTsuFb6uU9CG/VhDc1or8lzhGzI0IRrLfswWPUgUnRxUn69MEaGZLZ3E1u2G8cWfbbBYLIIPHGxz0Ay5HRecfHMmDayeWGWBaSG+ib0TWwn3y7JUv1JQefXSAand5Itq3M1xgb3wW8BkFCsKReylfbIgCbqdITj/bwahRjFfYBsK6wAEYRY210yUGRTvupHW1Zma/YAVtrCSZEyfXSwTH7DXwO97w7qoUWVowb0kFEDe6jC/N7gnvLBcF/tE/DpqAD5YmywesJXfxqlsbhN8xLl28XJmvj229p05U4qyjYZnQnaU5ojuxF1RVmyE0DBnVyg8gCUG7hMOfZOq9sIFtru4jQt2cZhiKJtOrYZhdsu3962MUW2bkjRRlx/rU3WitxfVibIzyvitRBA/66M11xuiiy3rk9SE3/7xmTZUYAlmCJSYlJN8CX9tT5ZRvXv7HLiHihVC0iwM09CqUsIbS4j+/eU7Pi2xivcu7EkhbeQUQN7Sp/Edsp2GWhaZCsFW2ZMaz2P47JiWss7+T21ewixOIBkOFE3+XlNnuwuHyzbCgcaEFlA2mGJuF3FA1UsLpwUpVmVcDX8PrB4W/arX0iV/YrPtvJP9oHrGOsvYGZciJbkiBbqCKWmDqcjpeCTXvNV6w0rbu30KCmfGy//W54sf69Ll11FmSLF2SLFWbKnKFNF224ITlSI6DPizwmkfyIAZBNNJACckwDZ7qLUylScIruLaNZlUSG9BJKVABS/bStIUd3HSALbtWAC3tUhb+Jtr0BCN0LBM5Fym0wQE7nL5Ad2r69BUvt3BofJj/daj7U83b27vaKLaeQ4zsvG0rs7WYaGnSIG0Ym+XpQte8qGyLbCfMOBLBDtLjU6UumcVAUP3BAQ9O5e3zjTALilyylrdnjb9VlIplOylE+e0eHJhdvaxAuAXmLEONkEJlMSECLiMY95KRAvxMxIevvoDT+ZPSZQVn4cJuWzY+R/yxLl99Up8vc6gEEOk60zIeIylAMh2nYVIfo4Bt+R8R9Vn1IsAiT2Z4BT8dn5G/fZU5KmItNeBxy0rnmyPuu8uOaJzxYeHGLPObf/CCSQlxPfTj4Y7i8TRvSW8a/6y/jhvWT8q5CfRb4yfriPjH+1p4x/1UfGD++pNMH6az73UBoPvdpdJgzvLuOHd5dJr/WQkXmd1ZKAEyyfkiCyaZgBkdIAFW17ygfLjytyZOLrAeqtBqiY10MyOmky3JwPwmTBxAiZPz5c5o0P1XwiaP74EFkwIVjmj4eClBZYf/GzzB8faP11JzzAKJn6Evk3kQGp7TVhTR2PGo8zZj0Ka9/Etkap9W+sTsyBaR01ED0orYO81qez5m8Tp5sxurcsmRyipvWX82I1sPv7mmTZthEuki5Shu6ETpih+pOKuJJ0BRzVIog/T9pTbICh4qoUByZiC2A6QWQDyfxOAhxzzQsxdSQcNlKTAMmWmDfBzJlzvpQmME+GFk8O1qwHmwFUC0joM2OG9JKdpUNENg9RnUTKIHw4pII4nHqW7qC6RFmWWis6OUrW5CiliZRZD705Xea831tFy+hBvrKtaJDsKB7kAtL2onzZXTZIir5IlYFpHZQrIE4BdMGsZPljXV/ZXdLfOCBL+1kOR/w+fURQnjHTS8litLiBG1k6iYvQHyz6Ml2mjPS1fEBkOHaVn5enqJ9L9Tkrd4kc7U1z4xVAPEPfpPby9ZJs+W5pjsYY10yLlwUTImTaO0HywXA/GTWgm4zI7azm9LDsjvJG387agWTiCB8F6pyxAeowxCdEE1ICrV8viNUUlP8tRw9KlF8soibup2Xx8u3iWPVM0xMAh+OsMf6y5tMwB2cyYLLTSXCKAnzSm3ehZ5bD7Zk7Y2DonJVkOeYJDmrPUZrI15ny+Rh/lTLO/KZ/AFIjeXewn/xVMFB2lLCwxmIiSd/dP1NhLqsVY1krhryx6xTZU5IqPy2NUydcXHBzKZ2bIbtLh8i2IkRavuwoNiBa+5nJnkQJz0/vJAWfp+j3smmw7Ciy/EeY/EV9ZVdJH9lp0a4SfD7ZqhDTTm93MeLFJvOWe5LRO4wyOuUtXxXTzAExtV9WJqupbpf8AByyJH9fnSpjh/SQ4J5kOrRUx6x8NVTHJ5sHi2waKPLlAM1SwFKk6vfLhYmq1K/4KFzmjgvSGB6WFQ5KrCwstLfzusib/Trpvd/I7aTecfK7SYQjIxPLjZBKbmJrtdhSo1qosYLY3TgjXLmVC0QlqfLrygQZnt1BK3MwZv4uNA7dncW0mIZy1XrdVcycZel8wSnduSAvWYbMfM9fVROn8bVXIGH+5cS3lTGD/eT9oX7qWVYa4itjhvjImCE9LephUXedbBxatGlx0RBP6ibjhnZX8YHbYPQgP9la6OBGcKLywVLwRap29mfREGkTRgTIwkkxsnxKvPyxHvAYIDER3y5J03wjSrWVPghWmguNC5J544L079xxAVVQoOvzwgmB8mqOEW0ASQGzJlU+ftNP9THmBuMCUff9kkTZ+FmUlWDfRF+8eROiNOY454MImTMuTEXvXETuBERwqNbcLZkcJksmhckiFSdBMntsgIq+P9Ykq8jDEtuyIl7jYSP7dzbzYBkPjMlFlqfc6J9N1D+FmLO5Ecr1jkKjXGNZEz+c8FqALJgULbPHhsvssWEy+4NQmT0uxCLmEArSa7nR2N46N7gVuJdTx9wrkIwvwVKuCaIqWU4uF9nfu5NRyp3kvseGfT4Lgm60p3yoA0RD5McVuZoMh8/KpQBS10/rGppurciRXSUDFEj0BqDPNr8ZL3GF8m/fq+KeVT1HRfgC0sClZUnimd66Pl31HBbDnh/0hJVTwuXPtWnq30Ex5zz36zvnxX08PLudA8XYSYbDxEeMGM6YrtwlKdxkdNoeaqchYc8NnPLd/K6ybaMx9W3RBjeaNy5AwyZ2VYkZoz02e0wVnz3nznOe7LnZByAdWmLwmbFt5MtFObKn3FhqypWKB8nE1wI05OI0NWGlWFP9k9vL/1b00ZxvG0ja1kZTIYx5eqBk3xNu+M6AbrKzMFO5mhNITOoHw3tqRcm0t3tbekPla1WHuE+eZ/S/NE3WTw/TNI+qYl0AgwXGgiSbAD2mQi9KlYKZVOG2VM+2s5+S5/33hTzHAB1RIMFtRvTpJr+uHSC70I8K0YsGS/GcNFVgvTnLeIOrAhJvkPqkvNxrf4kFfn9wDw1z0ElE2y+7uI5pDgHICmdGK+dgDJ7XqA55TSP5ByDZ3IV424qP6XJiW2zJqoOSb0Saiopj9UwfusZcRxRIIT71ZcwQP9lWNFh2lAyW7cX8HSSTXg/Qt8zl73HQ4QQSCwVwJr3mp1yHBhBwJJyu/ZLbqQ6FQ/W7RYny19o0rYIBEJ7XqQ7tD5CwmgDJ5Nd6KoCMSEtWpRgRhy6KUmzP46EslDyiQIIjIcJ2lAyR7cXE1AbJb+vy1DFp0kgqP/jhBBL3R3eZPspfZHOOciTyj3BF4HtBVOCTWTUlXKQ8R60uMwYv1/oH2h8gAaJBGe01PAIHAkQAis8YDehEWHKHEkA21QAgBVpAGiy7SgdrEFhFhJeJgw4rkLRpVyOZNz5Y5KtcmTs2WFN6CcmsmhqlaRk4IlHCicPN/yDYMlD2fQz7BCSr7Ih5wt9k9CKjYHMOgVny022u/q8HEqJt7FB/2V48RLnRrvIhsmFWivYUivD3LiIOJ5B4o1m0NZ9EinzZRz4b3Vu96oPSOsq6adGajkEK7thhKNw5Uj47TuKDaRa272PYFyAh0kidnf6On/qLdmmIxehFv6yg7KmDS/H3vM+hoiMMJHKQustv6wao9xyFu/CLNCs91Pti8H2eVyBFmTTT/RArVRHARAcqmxOnOhKVJOQIDU7vKIUzYyUnvpXmjlPZuqswU0u6M6JtI2HfuMA/Asnu34Re5GucpH+tS7IcjyZQu70gWcNQZpcoc6znfQ4VHVEgkQhH8PPLhdlq/u8sHSz/W9lXMqLbVIrluM7xx9RtJz+t6KN5SDaQlk+N1sU4mEBiwYizbVmBTyZTwxl4sPsltpPPxwRLakRzTejD44yHe+uGdPUnqX63j4vI2Eke8wTSuulhlh/J9ms11p0mCYvwu60X8RlnIffdH454oHREgcSi46ycPzFGdpcPtSy3fPUOm1Z27ovB8fQIGJbVRX5d21d2WZ5tgLRxRpw63fCUHyyWDsckzrazMEudjnTpR+9AwdacbNJWfBtKbnwr+X4JjdYzNRNAiwC8vARVEc8V1KO+hkFwSDqBhEOS+CIvlr07FCmwOC13WoFZ/EWb5kRpKMnUqB1+OqJAglgY6uC2rKICZagq3MWz0zS/iN/sNF/NRQ5qKkOzumi8bYcm/JsUWzIi/1qfIwsmhil3MFtyVb5XdcnmhNz/01G9RTb3kf8tS9IGXXYSvl1UiD8JcbZpbpwGiD96w9fE46oJJEAfG9RMRuR0kuJZUerRtmOSmPN/rkmUsUO7q07Edem7tN3ap0SV6+I0+W1VgoygzfIRAhF0xIFkWHFjtd6I/ssmA6Y5H0S5vLYcExvcTOZNiNYQigZFyweJlA3UyP+esv4im/pr6fZfG7Pkk1EB+22GQ+ro82+sdV5rp0UqkEq/iLXaCDaWrNhWWjBpGkw0lOSwZuqQpJ/SzPdMP/DqAAkxTdHEwgkh2uWNXQBcKSRQuSlN+ugNH1Xq8VORBWCsNJPItqs4VT5608elFx2p3QCOOJDsUmnAMn5EgPy4Mlfkq2Eim4fKwknRkhltSqQRJQsnx8rXi7OlbC6dyVItSrYoScrnJsm3S1Jk1phgy52//7oC96Tq41eabpXmyIIJIcqJEFsfvemrZUImbdiAgc5tAI4ublp/Vx0gaRP25rLi4zDt6EZCXPnsaIui5Kt5UbJkUpBeH1BTJUu/SOVYuolymhZM4tkG1JpX/18Fkk2kcPK2D0jtKNPeCZX1M5Ply0WZMmNMmFarADY6vKVEtNRutzYhAm0yv7XU4/aWqP7PZDIkyWjYTWFAUbZ8MMzHFbBc+mGYzH4fzkOeOk1Bm8qaTyNEvszVOrd9sdoAnJaV6/PwfJSYN5eU8GaSGt7c1dHl8zHsFkAIxNKfStJ1FwB6ERiRVr37HSqqMUCCmDQWB9GQGNZC02n7JLaVZM3Hrihbtgm9wZPIXjxQby7cDH1s5VQ4QI78viZddS88ySx8wcwYrSOrBKSvcmXZh2GuEiHP63qnJtqez/UMmg1gcuLRw7Ac3x3UTZVwW38id+r3NUmap2TiaEeGCzmpBgHJ9nuYwj8m1E5dUF3HSiNxS5+odA0TT6rqt+oS96QBGFUkiKuiWbHKJVg0FO7vliTLKN0LxAAJ0aO61JcGSJqrU20gQe7H6zNgEfo11gS2H5fFq66kepFVCEChpM6Nwzg4klSDgFRziIj/1JG9tLKWpqRYbpqfo00t2sr0dwJU4baV7aSwZprcBugWTwrVsMmBuCAABvdDzGkIBBBRUVJglO9lH4a6+oJ7nnuk6BiQHORcwBI25NucK7/jP8o2W3XxuwmEcrzhfICL3QnKZseq1UZ3W7Xa9okjOciyGLk2tfhGLzLuAEBUPjdGueK++qoONR0DkoPQ0YxO0l22F2YqN1r/WZTG/jTuZlcca3ag+Yt4odHWNwsTNAPg8zGBFpAqX/8fyRLfgITqG2Pip8n2jehF6Vr8ODyLTEzvccgjSceA5CCNqIc2V/BQEUOZ9oQRdJkzDR74jT6Mg9LbS4SVtoqexBYUP68kfSNLprxlmmfsl95C2orVlfb31cTRLL2o2IAJZ6Q2EzsAt8ahomNAchAAIK2W7v/spPTtkkRtLYyoAUyUEP2wLEGBhMltczC80jRzp6L2/aFmsasv2oxibUDZSPomtdXafFu5psoW8Tb7/d5qCapFuT8gPcR0DEgWoevgfyqaFSd7ymgqka3N2REz2u2DlsPvBcrGzyJV1Jk+RFQIN9YdA6jjo3ybosh9CdoaEJk+UFSlbLCVaytMwue100zgFv1tbxbrkaRjQFIiZbWhVgpvtxpG/LQ8RRPq7SoYFplNcLDmbGU6isqMgCby2Tu9VT+iZEnP8d+XUIVRrrHCFrHTkZtynaFRfrsBqg2iY0CqgWSLFBqEfbUoUVvboB999m6A1WDB9B4aNaC7bFmZplWytrKL45H4m51q++PSpL1md3oj05ihsepedoGm7bnesjxBWw2aWrqaBx4n/eeBpB5y/8byxdgg1YvgRt8tSdIWfqZLruE6CyZGSvEX8daGOAYoAI0tudiPhMS3DZ9FWXGv6gFJdS+/Rmqh0TtyT5ERaXiu/16XonVqOCUZQ03kQk767wLJWhgWkgZWv69L17p3yrxty0u5gGWS05aQHQdMgNkQ4oYcor/XE63P1t2X1M9UDasKhyX3piHDb6uTtZSc8na81vROosGWyUHiePdixJpI/1kgGWciuk9L3aIUBXtPaR/dYoJt0SN6u5vwHKspLdZ3Wtvm31g+fsNPdtMTqSRby9VN2kvl+3mSVoCkt9f9SGjUAIgIyCLSaCZh606e59VU+m8CydHckx2TdmvTCVoCZum2Wi4/kAU2Ft0zpmXSVJrIWgoDynLkjzWp1hYR/wAkauX8GklufBvZNJd0WdN0Q8380gxtO2N6Y1cvp6mm0H8SSICArm2jBnaTPzdkaqoIYJg/MVSj/raOA4iwwhA/RPidiXK2R/vHJUlaikTiG4UC/8SRcCNwHG4EWv6Ybi2IxkwpnBWl4ZYjmem4v/SfBBJ51kT36RMppaa309eL2PWxjeVoNAn0NF9dPTVU9/BIDDU7UdrXIJ+bTis4IjWhbVyQpq+YOJx30iS40Oay4qNQ5T7aDtAC0VfzY7WJxL6k6dYk+k8BydaLsLzYJYnutbuKc2TrRhqqdtdybKeXeUSfTvL3+hQtfbZFFr/bjSKWTA7VQC0VJoAq2Me7ODLA5HMTmTM2UBVrk3NN86oM+XFZgirt3goejhb6TwEJiwu9hi626EU7i42CPXdciJr4tkUGSNjYhs7+RTOjNN/IZD1W+J3Ya+SHpYi1HPlhSaLkJrLPiPfwhbYLVF+Rv+Zm06gUkbanJEN+WZWkndsItRytIIL+E0BSjmD1BPrgVV/ZVpClepFtpaVHmT1CbK8xnOGdgd3l9zVpupGf3c2Da8GNED/0zcRSw+ynR5KJg7kDgWtpkl6vxjLh1Z6ybQMOR9PFDq7EbtxkP9qpsgeWHnxk6T8DJJRrs/MkyrXZX2TLqnTdSEe5gZUWornhoc2leHaCFM6KVeXbVGcYkGhGZBgZAtGqoNNXe9ywnpZYct7XboDVSHtH/rGa7ACUaxqMZmij9kkjyAM/sO2tagr9J4BEqkd+Wgf5bkmK7ClFL+qjnfvpyGvSVdmB2gCJhWfXgr825Oou28YVUOFZ5vjhOZ3kz3UoySYsQnjFMyyilqFfIxme3Um2LE9ShRoQIdbwF00d6WdyzPezZKqm0b8XSCqmKCZopEHP8rkJCiK2g9hV2kf7JGrgtVJaRhNt/jVhRC/VjdR6s3xKdi45lSJ76JZrlSnZyrd9X+1b5NtQBqawJ1uCZgaor6jIAGnGaH/jcKx076OX/rVAUu5C3VhkS1k3Pcbak41YWl9ZOz3aa0c4W0cCPOHaoMoRwbeuxz4f9AJArG3bkKlJaObYiuNobkX/bXZJUhBttHYHKMnQpqfsXunJwY52+hcCCTAYEUTe0OIPw7WHNLsg7SnrK18vTJa+CWwTapfxwBEMeOzGFYZLeKaCmLTaGe8FGAdmeY4UzIiRZDbJcwDSziQo+Tza4kRmGwl6VtO11t7R0Zub4GimfxWQjAgybzv5PbQlpon7jmKU61xVrodld9LFtkWRUbDNPmm0IFYg2Wa4tXUCxDmY+GQGwI2oMCF/CSXeVqwBCBmVBTOj1GvNrkgQDdCpplXQubInjwGpRpNGzAOayIx36WzPTpO5srskV/7ckCXvDu4hoR4xLOOgbCGrp4ZJ4cwISaPxeSXF2dTX0VhdO+OX58jmBQna/UO5kWY4sitkS1n7aaRyIrzWWs9fkiVrPolQoJoU3Mpj/jfQvwNIFjDs6tuPR/aW7YU4HHMVTOhGH73Zy1SxWsWWcB47hZakMpo3zLSU4IqYmuEcgAiF/fulycqNdhVnyZSRvawSJUDUREMfFEeyq6TZEQmrLks3SiZ+VhMrPw4m/SuAZIMC7oK19fdGurmZXSJ3l/TVnQDsLThd51lKMcoyFRqFM4inmYZWLkvK0pXgOtPeCdBcJdJNiMshBrkehBhlIxhaKKNUs6skOlHxrGhTm1/Jx/Tvo38FkIzXurGMHearu0MCHgVRaT9Z+hEAMSEOl/Js6TN0i/tmQYL8uc6kgKCAVyjbFcf1S6JsGh8UroNsmfy6n36POOPYL8YEyu4iAyKUa8QZnUXQqUyabOUx/9vo6AaS5dtBEX5vUE/5Y1227Co1G+6wHfv6GbG6obMnR1BPcmATWTQpTPWdD9/wVRPemSYC8T8AxOekuhENR+fF6zWpP4ML0jqZoO3uQnaRNJmSm+fFaRu/f7s4c9LRDaQAU1f29oDu8uuaLDcQlc4xmyx75gfZwIN7Ef1fRyVtiGmt53l9gDA0s6P8soqtwdgDN0s37jEbHTbW5qSkkewuNl5rxNnXCxO0IZYJwla+5r+Vjj4gWR5ruAF5Ra/16SpbVmapGGPLrz1lefL1olTJS25XmSNYtfpDMjvLb2v7yM+rM2RAKpsxeznO2pZ0+ccRrr3oVn8aqaIMkIwb2lO2rmdHbZsTZcn3ixJ0S4lK9/0P0NEJJCsEMTSzk3y/jKT9POVE+Ix+WpEhQ7M7K8g8zzXpsk1lwcRo2VrQVyZqOXaDyiXQ6EZ+jWVkHlW3Wapg/7aGHZA6asP20fkmM4B9bAnaohP9sCRJhmWaZhOe9/0v0NEHJO0bRD/FDvL1ojTlQDQkhSP9siZTd+9ml6TK55lzARKZkET92bvMW9AUP1JKeAsp/oL+2uyq2Ec+fz9IRRp7t/0KiEpzdLt2zH0aldLxtnIGwOEjOC0i+0B6Zx4IHTVAsq0pTSpLaieb5qdqE1J2j9xdkid/rs/Rbdir02tbJ72X9+NM1L6hfPymv+6miDKOuZ8W1UqGZnXUOBvAQl9SEC1P1nIm29nosvgOI8FRB6W30z7g/ZPbGv+YF53vUNJRBSQWPzO2lRR8nqh7sQKincV5sm1jrkx+3d/K7anMjUxmZOVreiNEIgHX75elqF5EKGTM4B6qc323NFnFHCAin+mXVSlaGGB0rCNXTs3zsaXrksnBsmVlgiycFCR9Esg/P3zbSBw1QAIkbKWw+pNYbYm8vbCf7GA/1uJ+Mv2dIInWwkTHObb3WvcToXMuCrTtJ/Jel88xAIJ+3WQLUL696pMoGZrRUTbNo/aN/XsNiBBvZE/asbMjBSKb7Fz0uTTnKkuXbxfFypBM0zXlcIDpqAASoogae7YWNyAyTdoRafMmhFteaxP1t8/R0AUlQwmtdYvxxZOCZGhGe8OZvC24lYj2Zl5X+WsDO4T3kS2r0mTCq75SMIs0FAtEJdny+/p0eW9wD5droSpgHk5iUz92icTSXPphkG5j+uPSOG2iqoUL1eTI+0s1HkiaOM9WVu+Gyu6SgcqB4EboRyumRmuMC33AcIOKqDrcxUxqiMjX6DLx0j/J7HHi1gXWAhWeahRsqm7hRnQlWTstSjbOjNVtzAERRZR/bcw0+7JZVSFHmhNBpnlpRYYnL88PS2hFmKFbbtHK8FDnP9VoINmhjwkj/GVrARyIbSMA0QApmJUoGTGevRQtIFkt+Sa+6iO7ijN0ywW2QMeaq6wrVaSATBnpr5Ul0B/rMuWbxUmyvShbdSIU778LMmXSa76uLiU1MRWE52N8bMGFiGPrrU9GklJcBSc+SFRjgYQlgjn9Vl4P+Z0NbEoHyvbC/iJlA2TzAvoQGZat+dTWOYg24zBsqOY9OxbJpmytpWfhvZn6ejzt+3QXpDS1yLYVZivtKOJvluwsMWD68E0/k6ZibS7jea2aQOb5G8mQjPayjR27y9Llu8WxkhNnKmU8jz9YVOOAZHcwY3HZ8vP7pTgEAVGe7CkdKP9bkSXDszt77RnEJBK6wFSnzEi+6qPBU5LN+N6bCNImV0FNZZl6sI1Is4HEZwoo+UuLZFftWw0QZ1WStRUX7Zu/WUhvAbMx4IRXe6gfrNLxB4lqHJBsMUOtWdEX5P/kKyfaVTJA/lzfV0bn9zDKo5csQ8NxmsicD6iAzZU/1qZpmggTW5Uuw7VGD+ohWwvgQDkuEClHKs5WvYhGE4BbFfoaKM6cpC+TPy9TCymaFa5AkrI0WTgx0OKmlc85GFRjgKSLHGgsNPJ7Fk+mbixfdhT1tyhPpo4MssqHPIBhWWuItPcG+8i2AmJufWTaO/57UYpNT2241aYFiZqK6wQRehIgYj9bGkiYzZqP3KYx1Sadw8aSEtlCCmeGK4igjZ+Fq/vE2b/gYFKNAZKCobdJPpsyMkh2qIU2QHaoXpQvCydG6r5m3uS8yVJsLPlpHeXH5ZkiX/WXDVZivrfjARG1bNzrs/doa0MWZQU3QjdCV1r2UYTmMh1qRfWgkhY+mE5ybAYoJbQRTJMv55Nk18ri5l7OO0CqQUAy1bBv9Osmv6/vJ7sskQaICmclq95jyn4qLyh6TlJ4C1kzLVHkq0Ga5D843WwQXNWGL6qQZnWUX9ZkmCqTQgMkrDTM/zXTotVsNtdodtQAybgAmmgy3q8rE3SvW8D07eIY6Us7w0MUD6wBQDI+EOP/aCdfLsqQPeWDZFvRANlTmi/fL8tWpVvzo73oRRC+JoA2dqifTBkZqFH7ilBJ5eNtBycbKqNgO5VrHI+lc+K1pMhW6CuLxZpMRtkemddJdlsbJ8ORULwJo/xrgYRYiuxF3nNzWT41TvZsMiDaWTJQ/trYT0YPJBBb2UJzv4bJlITLYJnsjX3bpdRjhvjItqIcVagrQJQr3y5O0k7+hhNVfc+aSjwf1qXZx8Rs447CXTY7UsWdZ6LfwaIjDiSj9DaWD98IlO3FA1U32l4yQHaV5stn74aaifknS8PyaldwDvdwiZOYyMzoVrJ5PgFYovgGSOhEhERepe5Nc4roB3D0AQkxjy70/eI42V1sbZ5cli6rpoRKXJApQfc852DQEQcS/iIyFn9ehdMxX7kR+9WunZGknfjZfNjznP0mK2Hts3eDZVdpX62+BUToSH+uz5J383uo99ub47Kmk/0SwUmnjvSVXUWpuo37TuVIaVpqpem/h+jZjiiQAElyRAvZOCvZpRehZH+/LEcGpNgdzCqft7+kCXFp7eV/K1Gw+yqIdpXgyc6Rj97opZYfrfuOHn3IkBNE6EHfL6HnAB3hkmVPUYr8tS5J010O9nw66YgACbGDuNLq1VEhyol2WGJta9EAGTPEb696zv6QUbDZXjRa5KsBWrK0k262xX3k87GmM4ntc/I892ggu9xq0aQg1Yl2FCa7FO2y2VG6OaGJD1Y+92DQEQESBFAQab+uzZNdpXCjgbK7bJAsmBilIoiHtjmDrScRf9MtFzQjwOzo6CT7e9Nqz2xHZZ8b7tdQcuJay7KPo6R8XpJsWZmhQFr2sdmkBj3Nc4xHC/GcWGqTX+spOwtSZFeR0Y0QbYi4D18327kfypfkiACJhaaqde1nSbKnfIiCaE/5YNm8IEOyY+nsavQUOJa9BSiEZUZcjL5FeGmpL8MSgSiL1h22Q5sr54kNsnppW11G9FqWd5rNlgelddAyJkIxprrWu7+pRpPVLxyRTZLdH2vY481YasZaS5PN86J1bsIPcS+mIwKkML8GMmFEb9lePEh2FA+SnSWD5M8N/eXNft3Fv+vLurAAgiT9V3O6yvjhvWTme6Gy9KMY2TAjQcrmpmji/7dL0uX7pYa+W5ou3yxOk83zU6T4i0RZ91msLJ4cIZ+9G6Rl3BQFEOGnxzX7heCX8u/2igT2bKie4GpZhzWMKJmCE43O7yK/rGIHAfQiw412FSXLjkKzn0nVxRAHjw47kHh7KFz8ekm2cqPtxfmyvSRf5k2IlJy4NvJGv+4ybXSwrPssQX5akSN/b8iTHSjhxeg1A2V3aX8lMiWh3aV51nf9VIE2f/upVQZRuk0TCYKy9I/8dkmKrPssWjexoaHoiD6dJTehjSSGNNOx0T+bv3Ay7cTm5RlqAjFG+oBPft1H/liTqCBClBmRZnxHBGrVT3cYCgEOK5B44xEzs94Pl91lQ2R70SAF0l8F/WXDzGTZND/DmP+bBsvusnwFj8bbikhoI8XW5GpTflSJCvFQY4FVEB1JthexpWiOIZLWStjUj4LHXHVA/rUhU75ZlCzrpkdrydHYoT1lUFp7iQ8xmZcVYtEks2kuEtmIVXjZDy0Zg0Cts3iS/YMUPE5xxv+ItNIv6IJCKx1TmFD5WgeXDiuQeIsGpXeWX9b0k50lg2VbYb6CCR0Jy21PGaJuoGwvGqiebTgQOUjE2/irn0sJnTg4Ukme7CrOk51W4wiA4wkoZ1Tfk4jyk8xPxYgm9xdkyc+rUmXzgkRZ9nG4TH7NT4ZlddTuI4ALMOGPIXyimQiexZWHgOCOiGKAnRHVUj56w1d+wMQvYTclw4VcelFZmny7MFa984ezWPOwAcnOFVo4OVb2lA9VEG0rylc9aWdJvvqRcETaYPpjQ55sWcm+spny5YJ0KZ+XKmVzUqV0drKUzUmW8nkp8uX8VPlmUZr8tDxTflubLVsL2Jymr0hZP5FyUnL76v9wIpyPzqQ1J5H9uKMwS7bTUaQ42+rBbbbcYoPkv9ZRlZEoqz+JkGlv+8vIvK66UAR1ERvsGGCLRLUebSuz0jw4OYP92f2v3diU6+D3IeSDkjwgpa1MectXvpofo5YYKbS2KFNOhKlfmibfUT2SYTbXqXz/Q0eHAUgm45EaqyFZXeT3dQNkd/lQ2VWK+BosO0oHy5bVfaXoixRZOClaPh0VLGOH9ZI387qre4CUWgKoKMkk59NElAXEEsmMbS25CW1lUHoHeS23iya9oVjPGB0kiydFSMGsOPluaapWhdDJFg+29tguMWKuInUkqxJtLcjUTZJ3FGXKrqIsbRQhUIlpX/PzimTtf7RoYoh8MrKXjM7vphkHcK44a6cA21KkERf/22Ra4phG7vqZ7U71N7icKU4gT2p4dkf56HUfWTklRH5eQXdcGr27AwjlGmCx9y1pI/l21YijN/jhoMMCJNPwvKms+jRRZPNw+WPjQNm0IFNmj4uUUQN9pH9KB0mNaimxgeT+mMArb7ktPtT8t/9qfZo16dZiwAlg48E+DSTYByuMDWmaakdbehRRIfv+kJ7yxdgQKfw8Tn5aDrgACQ1K+8huqyckHMkJJBtM2wEUG9BspGs/fSEzDbBKKVvKkj3FmbJ1fZr8vCJJvl4QL8WfR8uqqaHawZYN/Kg6eTuvi2ZrsucIjSby09rpfm2A5c2+nWXM4G567PzxQbJ+erh8tSBGfl2VpHuWaBK/Fcm3rTKXKCtGvKXq/XLiTcaC5rEfZnfGoQeSlTqLblTweZrMmxCjfayJoxlHGtF6Fr+hRGn/R8vl7wjCur1Zjs+V3zijAHMNbQOo9fAGZDgkATSmP/nMb/Xrql3YVn8aJV8tSpI/1mWYriObzK4AiLTthZlG7AEkQGRTAXuJZLj+p80f/bPpTKJcq9S0Qt5dTB/JNO0IRyL+1g0puknO3+uT5e91yfp56/oU/Y1j2BSZbUjZ/A/iM+e7g8eACd1IytPlt1WJCkDSYtw5kefcHFo65EDiodh+KjuurelXpOzbcjAeBkXVJpdn3HZQav2/mfisOPZk6ypTR/rLiqkRWob098ZM1ZNozL6b3O3CTLMtlhNQVZFun2WAAbGpH5xlr1QIaMzx9lbtFVQBJAVQCeBMkTWfhCmHs8Wi5zMfTjrkQLLfELiNedgasj8rY7A8wyyEisaeDXVXJEQEjSHY23b1J5Hy07Jk2boB7mJa2NBQC+6zy+ZKngCzgHSwCHBpymxpqmzfmCzFn0fK6Pyu2k0FCxJOW+n5DjMdBiAdXQTHssWhlioFN1PFd0ROJ/l0ZC9ZPTVSvpofL7+uTDHAQk8qN+DaxT4jLl2qMiCqS2yOrFuTIuLKzd5uW5bHy6qpIfL2gM6SZOWRU9XiOf4jRceAtBcyQWLL0rKsLYoGiO0Ny+okE171kdnvB8raT8Pl6wVx2tQUXcnoSbaeY2h3MVtsVUHFWGMWcKzz0Ju+WRgryz8OkQ/f8NEa/ijL+tUo/l6aYRwJOgakapGtvNqisMLHg4JLkLhPXGsZktlB3hnQVT563U/mvB8gq6aGS/HnUQqyH5bEy88rEtUSs+nnlYny07IE7RxSOjtatz39fExvGT+8h4zI6ah75qIWYMGqX8gVC6w5nMimY0A6QLJ1LDIvEYcsuBE5TdSSSgpvrj6vrDh8Xm10s2UqPPKS2krfhDaqj2VGt9RshoQQk94L56NrrmZBHGElurp0DEgHhYyYceVPaWm3Ke9WspyTRjzaPjGzWTLWo/GTVWyVajzSNb+q10nHgHSMDgr9x4F09LzxNZ3+EUiwa7IN8a9gCtPcnOZWyH9KqGlm5TzWds/zPccTMY+3jud/Qhfu1oaxQOzjDTXX49zH4fwdaqrH8Nf9+72TPT4+M37GVUGMs7mW7TCeyp7zCv+T/Yz4csjYZE74a67rfq49L55j8TzO7Xjr2p7neJI9/675Vmruti72uMkutc/jOJ7f/WWqeC7WgOswH6w5nznPKcKdtFcgcYJObrCpuffv8pJ0af2MdGr1tPTs8LxGvLUk2nVhQhBmQfgusNvL0rXNs9K51dPSo/3zEuLbQAfPwOzBqLMyoImE9GwgwT1eMdSzvnkoazJMjRrH1JegHvX1GD5rmqlvAwnqbp1XDTJNFJpqyIT/e3etJ76d6urz9OxQV3p1flFCfOprT0oz6R6A9njGoB4vS7e2POMz0r3dczp2FgJQVTwj12ii82WPlb8RJKd5WRSjcDdyPWtVFNTjFfV5cT+dhx7MD9/XVx0M4NjrwlySmcrv9rk6F46XmnEmhLTQNaL/OHPC2rHmfp1fdNX7eRtzlUDiYN4ywFPn0Tvk8kvPl7POOFVOO+0UOfXU/5MzTj9Fzj37dKnz6O16YwYB52Gwrzx/n1x/zcVy9lmnyWmn/Z8Sx59/3ply9x3XSMcWT+kCwel42MAer8iVl1+gxxs6XerWuUsSQ1voBDBRwT3qy3VXm2tCl11yroL0njuuk7PPPE3OPhs6Xc+FzrE+n3P2aUqcw3hbNHhUOrZ6Wi664Gz9/ayzTpMzzzhVzjz9VDnjjFPkzDNPlXPPOUOuufJCefqxOySgWz3lVjbn5CVAeW7y8sNy8/WX6X1Ot56Rv5x7+81XSOvGj0usgzMDottuvtKMlWc48zR54am7rbfcyb0aK/d/8Zl7HPNhno17Gar4/slHbpOk8Jby8L03uR1/+01XKlDgrmYtW8ijD9zsdkyDF+7XTAV+t6VL26ZPyl23XyMXnHeWrhnPdPppp8iZZ5ym63fLjZdL1zbP6Ivyj0BSthraXNo1e1IuuehcOe6446qk22+5UgeZENpSQXfzdZdVOsaTGNgrdXkIwzYDutfTQTuP4UEBSlIYOdbN9A0677wzXL+f8n8nKSABl+f190YNX3xAF9nz+6ro6isulF5d6ul8UG0Cx6l9+zVy/PHHVzrWSaecfJI8+/idCiZeyOCer8gVl57vdsyTD9+m3N4TSLxkvLye1/RG99x5rSRHtJLbb77K7ftaxx0nLzxlXkaAmRDWQmrffrXbMXWfussl1pEKTz58q/zf/51U6R5OOuH446Vlw0e1g+7egYQ4C20hPdrXlXPPrlg414VOOF5OPvkEOfnkk+SkE0+UJx66VVIi6RTSSG66/lK3Y0Hz9ddconTKKfYAa+nfU0/5P+nQ8ml9mwK7v6xvmn1erVrm7803XG4KAcJaKpAuuvBs1zEAr1PLp6T2bVfrwwNOuMLxx59g7lGrltSqVUv+7+ST5PTTT5HTLC7avMGj0rrxE/oc9rVOPukk5Rb3332jXHXFhXqe8zngTOwyydzcW/s6t99O/r+T5JorL5Ibr7tUzjjNehms8Z94wvHS9JWHdX4AEqB0nvvUo7dXCaSnH7/T7diTTjxBzj/3TLnw/LOU4Bj8b8bWUmrfdk3F8db4zzrzNOnW7llJDG8hiWEtFHTOa774zN0uHfa5J+9y/GY/fy058YQT5KSTjlfiu3POOk1F3T9yJFsxvK/29W435QK8zegDXdo8o9wCFgcI4EiNXnrIMYDj5MQTj5eXn71XdQ30qyb1HtbFdD4oD58MkHp4AMn+W+s4eemZe/QYFsIJJK7Vpc2zen/G5NPheenQ8im54PyKY6CH77tJenV6QXq0f04JB1+z+o+4AensM09VHY4F8e9WT4Fhxml+v+OWq3TC2zWrIyefdKJ1nnmGZ564U8L9GmgPbzg4otGM3fwOwMz27Q0OCEgXX3S2dG3L86LXvaTcv1eXlyTUp75eo/atDiA5xn7bjVeof4o5vOeOykCiHZBvpxfd5h9CbDOfgMbQ0/ridmvzrET0Qrdzx00lIPEQyiHOcudGyE24B2+mWilqqViWUFBTufM2d7Z5/rlniF/nFyQlopWWFnHcjbbYsyb5ovPPNkpvz1cqPYhN55x1uvh2fEHlvSeQurZ7VieCsTAu9LPLLj7P7fznnrhTUiNausbM8U1fftgdSGedqspkelQbvc59NtexgXTzVfpyoQ86r33SSSfoCwXHQXTwZt9/9w36m81V4YI+nV6QCP+GBwSkKy47X/W0zLj2khZNxmhrva9tDVcCkkXH1zpeXn7uXj3+bi8cKTWylbz07D1uXPikk06Ulg0f03MQy6wf8wIY+VvJIvQGJAaG7oHocntoWGh4q0q+Fy5KVetll7ov4GUXnyshPq/oQ6qSGtpcuYPzGBTOnu2fV4vDBSRrAZyE+MICvNShr9lAMoqwGQcWlPMY6JnHb9d72+PlsyeQzjzjFGnV+HHp3a2etGnyhCryzmsgPij9uf0Wdz0E0eHToa5eUxXakObKQfV3a2FYoI4tn1YL80CAhDFw/93Xy6MP3CKP3H+zPHzfjdL4pQdc960KSBAGANbog/cYkNsEkADLAxb47bnH6ODlVevaEV9UTzylWlb+/V6BxFvb7JWH5cQT0TWsm9Y6TupabNDT9MPyCvWtr/LaOcgrLztfsx5t85kFr/PIbW7HoFNgNsNJnBzp1FNOlvMdijWL/tyTteWKSyqU1SqBdLEnkO7cO5Bq1ZLjTzjeWHXnnKEWqa1fnXLKyarf4SKgucR111zidu3zzjULpNfXl6WZNHjxAbdjoHZNnzxgIHkjxCbnwgmdOtKJJ56oetTxxwNmA+j777peLWbn+TZHuuOWK63vzLFYt6gbtiLOfGEoMP7LLjlfHn/oVlURYmESVQEpPrSZKogoWc6bPlfnLhVtnkjEfIej7A+QeMsQDZ5A4lq4EJzfIeJcyuxBBpLzeJtOOOEEue3mK1QXwSoK9WvgFUiIRBbSBlLDlyoDqX2zOjrxBwIkxsN8wcXPOsO4LBCjNrd3AumkE47Xa9964xWu73g5eVmcIgwgIR5xFZjvzG/MdUBX4/bg2rzEzrHceO2l6udSaVMlkEKaqdJYoVQaQiwBJNsbq4THO6iZvm2XXeIu2i695FzVfeyJchdtZsDnnXOG9O72kjoAnaBBZKAA1n3qbjneY6FrWeceLCCh2J988omqXKIHMib7XLjyQ/fe6FpoLDvntVlMn46INji1MfNfevZe87s1brhD1zbPqTjwCiQiBJqjbgwdO4Lw9GPuQLrw/LOldZMn1OmJ8oujEBBzDsCrfWuFjop+Vr/u/dKtzXNuL58nGdHWqpJOCOi4PhII9wFuAud5t9xweQWTsOamEpD40b9LPTnz9NPcTr7konOUjdOAAesGYuKQozx8Jf3hjNOkW9vnJBlFlBBJcHO56QZ3ZRsnJPcDAE4gnYnu1KGuTr7LgvKggwUkiLdcrbbwllLPBoJFp556snRu/Yy+uY89eKvbbyecUEu5DQaFzkVoc3nwnhvN77ZBccHZKibQLTyB9PTjd+h8YppzLkqtKu0hzSsBSZXtwMaSGddWxVFqVCttmqENMzyABCBefPouHbOnFHCSLdqeq+N+L7jW4w/eovORHt1alXHn77feeLlabrb+6xVIRiNv4vb22Vzg2qsuVpGDRt+8/iPqVGzZ6DG9IJ89BwoH0pLhwCbqUfZ0OvJGqvnv4UfChO7e/jlJiWyt3PGUU082v7E41ltzsIEEZ0mLbitd2z4np5xs3c8injkztp0+t/M8iAXEJIczdGr1jMNoqNBNAApc1xNIvNn1X3hAuccrz98vLz93nzR+6SE16Z99wl2coPO0avSYul46tnzKRf5dXtQ58AQSzkhAqve9/ALX985rAiSOwX2CH855DPrhEw/fqoaCp5GkQPK3gFSVaANEOCQ7tKhT4ffZC115+fmmpNingVx5mTVgi0448QTlKMhqxID53kzwxRedI/5d6+kk49muBKR2z+nbSfDw8Yducf1my/iDCaSzzjpVenR4XnUhQOES09a9YP144RHhhAic12c8cItbb7pClXXnb+oQbGvcA94ckt4IBydi5cWn3bkAnnS8+YgdFpnP/3fyico5GLeb1QaQnr5LnxXJgSXqzWMNkGwXDtag/b1Tj8KTffKJJ7rpkqgBRrRh1VUJJEIkRlvn7cAR6TkAJ8G6e3d7WZHdpfWzlXQlb0TMBueenRXQu3s99YLbv+MFZwGM17WFhiU8wwt4eru0faYSkC44/yy34/D9eAKJ53Iec+qpJykHBNRwFnQl5+8XnHumBHQzSje627VViFsn4eRsWu8hI9ZDCK04ALoXOunkExVIz9dx10uqIjge4/LU3xBX3NsOMOMy8Dy37lO1LcuMGGlD9doDHM/jPOlW4nj/ZLUZMso0inL3ts/JQ/fcqP4ZtHk4C/oPFgsTQ9AQq42FBBhwGRaPhdeAJuGJ006Rs848VR2KD959g4Zf0JlUuQwy8aubb7hM9TDoxmsvEd9OL7hkMAuMWEGnuvRic8z1V1+sxzBGG0j4re689WqND+ILgghM2mBTbhvSXNo2fUKtykv1fueqGY3iGhfSVI9t9NKD+rycD4eDqxIJNykjJm5Wt05tueryC+Tcc05Xa4pnZG4QQQCxc8unLWctCnQz5dj33Xmtjt0emydxT9wNPdvX1aAw977sEnP85Q7S43UezlVFGF2GdeB/zrn80nOlcb2HXKIHlw4ujNtuusLc/2JzTTizchUrxQWOa4LRl8sF552pHJVnOves0+XiC87WeXrykVv1BbYNrn8AkiECjpqPEmq2YvDtWFe6tn5WuQWAISXUBkTFQhmTkVRTnFqdWj4tHVo8pecQJrBzfiq2xrI1f5NiaqeZ2t/ZYyGKzXfOnkVec2Nc51W+hr3zkvt1rOPcTHB7PFbtG3/t/otqJTVTxTgqsIkaIICGZyRkE0zIwn5GO4xg5UCpc89uFOGF7FY5ZoxNtWrE8xh3clYic2wTHZNex2NeKIcnAuE6165CcaSR8DJigQIuDASMJXQy9EeYhQbZlctVw7PtTmYwmuykLNJK4LIuZh7CMwHNPJhyqBAm3JiQnGO7DjyP56Ht85zkBgLSKzjf6X7wUp6sY7VST8zx7vfzvJdrTG7jMvk7dgqLHuMcs5WTo1kS+ozMibG27JCR2z0tgNj3qorM7/Z4PJ7VK1m/24Cyx6vnVn5ut/vrceaz8ziejfNtkaiJjIRh7HmoogTqH4B0jI5R9cgrkHj77TeNZg8E6iA+K9mps/qmViAaxOo5Nnmcq4qnpni6cwCu4zxPswut63r+5iQni7XFjTeyj+Pt4w3z/N2TnNmNx6h6VAlI9gS2aPiovPD03arMka34fJ3a8tyTd+pf/Cr4d1Agkad2dh06UcMX8Yncp9l/zz5xpzzz+B1KdZ++W5VYQiIodapDwC6Dm6nn9+Xn71Oq99y9muaBTgYAfDvUVf8Kv3Fdm3Ac4kcxukgTtXT4znkMhKeZe2IIEOZAwfR2nOu6z90rjeo9KEE9X1FHn+f8HCPvVAlIcADiKNdeebFJhVByD1Pgg8GPcfGFZ0v9F+5XEGE5vFDnbv0N8kwOw6lJyAH/z3VXXaR+KuV6YS00roSfxFAttQZxpPHbS8/cW/HbCQ46vpaavBxD9gEZgoRT3I6xxkGQkdQL0lrsYKbncc7rktaKY5Jre87PMfJOlYAEKEgXuMrDuVgV4RRr8vJDkhrZ2iPLzgZQ5XMg/D34ZHDW4eF2/oZvimIAFhKHoue5NgE4rAmsQcxTz99tIk2CUAAmvjOWVhWRVUlY5BiQqk9VAsnTC4t/g6wAxBs+Brffrr1UrRJEofN7Fg33PznSxKBImHL+jtONfBjyfZzf4+uAIyGOnnB4teEWcDQ85vxPQnqPds9Lry4vurzwRMkJxdiJZRDZnjhMMdVxhprvDcfkufAOP/LAzUoP3XejPP3Y7ZqbVOF/MmTv4u3MDqz4zgu5jnF+X3kR/g1UbSBRgZAV105So1qruHH+Rv4KOdUvegCJyhOClZxHeYxnwtgDd12/VyChnD/kiPOQ2kKyv529ibgj5oe+ZifjEzO63cPLe9cdZHe20LhUBZAMIZrTyIwMt40C/CiWsu3hWzJeYEeJkhV5t7/3JH7DxPb8XpX6MOrn/j06WLWBREYeUe70mDaaqOXMV6JMiQxGV3agDaTLztdco6y49qpU4012/v7Yg7fsFUhMOlmB9vck0z947w1uGQHkyphwQkW0/RmPgCc511hr7kAyxz/7ZG0VjQSOA7q9rPVm6hx0AAkrkxACyjiiFq8xv+l3de9Xo4IxqGHyFOOprQYGRgMecQyP55/EYLlL/3Idyn54yWxjwXMdjjaqNpDurX2tRnyZ9OeeqO2WJ0RaLZP6gkegkboxQIKVdN9d17sFDlHWScEgH+Zpj9IbG0jUXDnjXog2xKezGoLPt7kSs0yyOxF1p7JPtJrnIknNkyOhWF9+yXkaWuC+ZDiQZO90LQBo/64vyRlWPPCSi89Vy5Pke0JAzus5iTkkqm9nTziJfK+brr9MU40TLA54NAOqekCqZaLtxMrOP+8sjT4zObYi/cDd12udE24C+xwzeZUnsNbxx2tMqeFLD1rWXouqgRTcTKPq9veIryb1HtJ6Mfs7xCXFkfb/5PjACZxAuum6S5WDeBNt3ohYnFM/4jMJeGQY8jvRfu2R5FtfdUbqwVypGsfV0pgUZVpwroYvPqh6G78RNec7Z+YidYBmK1aTvuO5HkcLVQtI3t4om5SzNH9KRZQzJVOB5uECgFC4CawSRESZVvPfG5AIBAc3UxDY3xOZbvrKI5rbZOeUAy77PgCblInWTR53uzcKNeIKruICkqWMw00JZpIeAoe467ZrlEt4ciSUbxuwAIk0CjvkQJWK0/Js8MIDmnSGgt/45Yes3Onj1A2REdtWx0HGI9/xgmIhaobCv54jWfnV6DxEmC+/9Dy59qqL5I5br5LGylnwB7WslNuLEo7ewFvJ5Dt/Q29BPDDZVQOpqVslLbVyAAm3gUukkKjvSL/16/SitG9ex7V40FVXXKALDxg8gYS+wi6WiFGAqzFEO05lLew/AQnQuAPpfncgnWDGQs5PakQr5WZ2aRYvFhxUXQ1HsUVXbSCRqxLiW1/fJnJzSKXAEcgkswC8UehOznOw2lC2cxM7VAIZJjppIPh3vCnb6GIouVddXgFA8p+x0lhgEuNc51jc54rLLtCxU5nCsfbv+JvIOoQLVgbS/aYuTcM+VpcVzUWuCDBXAtKlRrSZAG0zNULqPGyntNZSlwc7FCC2AZKd46NAimytDl8bSOhKzRs8okl8/wmO9Mj9N6npX9GixjSB4BxCHd6AxAKyAIg9fEk4+uzf8CLjlyL3uCogIY6cGY+UVrdu9LiWILslcllAQvHGhCedo6JE/Dj1wAP8AC+ijXTXZx+vLU8/ertyxqceuV1eeOZubWxhizdPIGF9MjY7cQxwVAdIpK5mx7PZTAPl6nx3+qmn6HhxCfz7gOTfUJO2nIuLQ1G7g3hRCHlzmQjPPGNAQDcPJtVNrFiEkk5yOcWXzu9ZeBRZAG3rEtApJ58o7Zo+oSLjKS9NFjCvM2LaqNXlzLjEQAhQ876eJuR5nudJ9BBwhkhsZZvOJfyOWL3nrmvVNUGGIuXMzziewQDJEm31HnJZuLycz9WpLffeeZ1LxyOJTNsw0zXEywIdLeQVSLDeqy5350gPACQrFdXzHFOK00J9Ms5zDJBeVucbx2C1OH9HRGjFxOOVgUTog348F5xbkTqLtdih+VMqSlC4azn0IEREy0aPqzJLvje+Lfu3s88+QxPx8BVRSu68lzcyzRee1xeH53NxpLO8l5WjBzpFN0CiKhkwOYHkJOKR111zsVbLOJPoj1aqBCQUTcqAGr7wgKbM1nnsdk3jbNvkiQqPr+c5VtYgVRSw76ceu13qPHqbOuvQkfgNwqLimoQgKJPBgQloadzFfTiHe6EA61YPvRpp9F7H8cjtGsvr3ZUKUFrhvCzPPnmnngPRT4isPgBNIykS27kHhEPQ3gZLr/fI7TpGb8TxeOjx1NsLzMsFsEnId537KHSb/iW7QJ/9kduUu5JZSDYh2aMAhReFMXIeYpznxiFpZ4x6zufRSJWApGQBw+nW95ZeaZMdP2LC3c9hISqA5y2cgKXieZ5+b4/D+b0DyADe8xzCEWY8/Oa4pmscHt9XRVb2p/szmhz2SsdqC0SrDaBrHBVz5RwneU7Ov5xzNOtFTvIOpGN0jPaRvANJ35ImVus6Yw6bt8648dV/YuXvwmVUdAVV5PVyPG+iLfL07baamnrm/Lp+03uYt9RuV2fuZdwL+r3FKezPdnkz5+tYHM02TT6zZVla9zBkihrshqPmfvaxFXnaXKPCr1RxX08yLoCquTVuBNfx1jzqtaxn0u/4zHGOVoH2XEDu+d6Vx+C5dvZ1GJeZp4pruZ7FOZd2U1fHMc7rm3U0AWjnNZxc2wuQrMUONG4A5Hhwz/qqY0RqI0+63Ju9z/ClEMqgMaj+zn5rvWlKzu9mLw/juDPA4DP6V8UAKu7Fb9yLa6np799E9SSqMsz1jRXH+fizMOe5p9mK3JyPbsRxFeebBukGaDY11abonKdjt65rxm3+0jzdfi6upVuCaYN1s9Ew56Iz2ffy2p3fcS98WCE9X9GMUnMvrtFQv+f59Bra4N00XLXnE/1S51q3Zeev2ZzZPobzGZvz5eQZeW6yLVgjnVcfx1i1ibxZF7uZq85lz/p6v0jXbpdmJyt9dntuWHtrizRdw70ByXTDMD0b8cvccv1l2kjhzluv0orTDs3raCypdWNTtk0wFtcAGYoP3XuTKpF33nKVlnKjWOJzofkBE0HHMEqJ0Q9sIHEvLCT8OdyDexEWeeaxO6VN48e14waJaXfdcbVeF3/UU4/frqY342MsKLs0k7q/9nXaA+iGay/RVJdX6t6nDcA0HGM3swhprhYfYRPM8Ltuv1p7QmJM3H37NdLoxQelXfM66prguW658QqNpeFRv/O2qzQOd++d18ttN16uY2Xc5Ex5vqEQ9yL6//gDt2g9H2XVtJYh5fiGay+Ve++8VrMqCNE89tCt0qbpk/LAvTfq8zLXzEPdOndLz451tcFp43oPa83bI/fdpNe77abLdYwAx+ZMzGe9Z+7RuaHFISk19rwS48PQ4fkJB5GlihHAXHJP6gnrPXefunFobkqJONfHd8fzch7HYaGq1HBww8pAQmkOxpfUSK6/9mKpfdtV+jZh4pKi0bnVU2rWY9ngb/Lp+LxG1Z+vc7c6IGk8RSEjlpfdau7Wmy5XVBMWIcnMxJXM/XhwEs7o3kYAlGpZFp/WKbyV1FSRIksDTNrdAFCfji/oOTwoZj4g4K3iWLzleI3xxLdq9Lj2WiR2BngNkJpJq4aPab0/MTly0+nFRJs7QEF5eFBP004Qk5+JvOHqizXscsnF5+jx1119iRaN8rI9cNcN2sHXvIQVQLLbKON2oKqYazFnl1x4juafU96NRxuO8+j9N2vpe6+uL2kWJ9EDcstpY0hdIBzvhmsukScevk1dGB1aPK0NUrGQTc6XKVDlvjxns/oPyyUXna0vNUFt0lqY17vvuFZdMDRS4/7kcTEu5syv0wty/bWXyAP33KBrd/UVF6jrAhcN80Sgndz5u2tfK3fcRivEih7fXoEE2R7rO2+9Uh576GbJim2rla7EmOjDyBtf79l7dM9YqlOTIlpKi4aPq8ONB6UpKQ2nWAQaiuLFpYCQB4fDVHCkCu7HucScyHd67KFb5OYbL9deTRyLH4oHhbuRnE/5MYn8OBgBd/tmT2rOuFpEoc31bWZCCIaSIgK4bSDxF18U3nMWjEmk4rZ7u+fl3trXKxdl7KYJQyt1HcCV6VZy9ZUXSpumT6hXncXBZ0UuElXClYBkVQjjboA7JIabGnyek9RkqmHhNH0SOqg74NqrL5KwXg3UsUucjuYNl116vjpCGTNd6xjb80/WlkcfvEVSolprcPiaqy6qBCRAT2gJRynMgAasmTFt1LUCh8IlwZrQE5K1s2sVSQAkgsFas8acd+3VF2uRBRwclxD3poVg9YBkpYneceuV8sgDN2mIAzEGOnH28QYCJIKd9uABARONfwe2Xb/uA+r1pZMF7WAYCGIIzqYcyQUkelbWU086E0zci5RXAOhU9AAwi8Bk4rAEALxNNpC4JsdyDgsHkPBPOYHkmuhmdTRWxzUACKDq1u45PY/ENYBKXhPHMl7eYp6b4C9AQkQAIEIjiApvQEJ/IESCn+maqy7UccEh9U1/6UHlFNwTMAJWgMTLgcLLsyBeOYY0YiQEAXL8UcwNnJ1rw9lI8vMEEpyGl47KmuuuvsiEoiJbafYBQOKZkR4AyQYEYyf3i2cHQKyxAumqi5UJUCIPkB554ECB9MojOjiaLewVSN1elhuvv1Q74CLGAFG3ts9rq2UmH2XPOQA+7wuQnnmC5vHn6QQDJETXvgIJPc8GEmIPIBESUSA9caeKN/QxnJvkWKFPwLGuueJCFRfoNIAJ7sszwbGqAhLAx4NtAwkw0sSChXQCiQWvDpDgCPTLJqb48vP3ahaG6b1g7q1Aav6kzqcC6RqA9Mg+A8nFka6yOJIFJALPhwhIpjEDHEtFW7eXVXdhkZDJD953k/7OZ/K+6S7itDIMkF7WkEx1gXTFZedpkhotmWHtdDMxHeyNuXowgITijWVD9iXeaqytpi8/pK2JWzV6VBVO0lkQNd6AxGdNkTnMQOI+vGCAB90SbrgvQEIpR+TTnJWX5uorLjoAIFk+Bm6KaEqLbqMch04YsHjq0rCKYO1o77x5AOnyy85TUAAG4kxYC+hEyRGtVWFj8Ey+8Xjb92quOhJiE+VOgXT/TdrdzR6HDSTkPrnQiAdynBCXKN+mu7210UtIM31QrItOrZ/RxDUsJ7t6FlB3aFZHsz1t0XbxhQZId995jS482Y0kuGkfxpuuMKEMrcJtoQtNzyFAosHjx25TkW2Dx7nNPGOq88gdqmcwNsbKM9jdTujKkh3fQVscws25jw0kxC9GDem8LJoC6bE75DFE261GtGFhsdWFvR+JC8RBTXT+yekynB7R1lpz5OmLyVzS1QWAYFkan5rRw7Dg0O3I9EDRx3DihbzuqovVooVj0a+SeTSb4lQJJDMBKKpwIBRBFODm9R+1dKTnle0R20IhJJ+HtNl7al9nNWAiR8k0VeCGD957oy4uPg2sIoBgcwd7shvVe0gnDSWYxYFzYXbbjkkDpLralZ/4GhyE4wkSo2TDOZgsgqUooHAuQEbFLAaCtqRxWW3NlSNxDQOkurqoxMfIS0dHqvPw7ZqUx3V4XpL2dBxBxjAA8NwL8c0z4Sqw32oD1mZqyj98/03KBW649jKtSIZT8xLQvB6RDFB5AXGdwA3w78BZzPYddZSbmo2EntXPPC9gYMF5buYejoTl5wYky6HMnNB3HB0HID3+kFG2DUc6V4ECaDkXYgxwctYPMNGrkkRG7smLhxWONU280d4npkog2ZPBzZvWf1hb92E9+XV8QVkyEwl3ot0Jk8DCwuaxpmh7Y08of/E/oPjZkwuyMXnte9gPDEixaNRBGWTu3aLhY9YxZkyY98hscrbtzVw0JyikuTrbMFkRM6a8/C4VF6ScIC6DfV5x88pj7TV68QHjEOz5ir5pODPxEeGTAsikmwCGuOAWkhn5suTGvKDcgm6viHUtX3+ytoIJLmzH+Ux8sLlOPm834ot5QuzismA8WKD0ZcTy4xqURDEml3gKbKq+L20D6NtAnwNdjPQYTHd8aXA4AIEiDQDNXFasIS4DXCb2vBJA5lxcHzxr4xcfVH3WePXN3HBd1svuRsJas66mVJ8KmNo6/8y3cqO9OSRt0jfDeovxATn/t+WjZxDWs07LhE8qvvP83/m9Ogzd/nc/jvvCzlnI+s+TVdDQ1WSL8zjeHgft7OxWLPaYPa9lvnd+rgiuAijtjanfN5PUsPoKJgWi9ozyDNq6K9kQL41PR9ODm2P4za5x43h7jF6v4TFG5trmHM45tNfEeZ6T7Hl1/98Ax9u8eK4Pvzt3ebDH63keVCWQairxZiM2naz8YJN5QXCaMuk0p0I0mwn0NolOMseYfc9MzdqhG2dNoqMOSNDhKHs2gKkQV4aNO777R3KKb8/f/n10VALpGNU8OgakY3RQ6P8BZDEf/SHEkccAAAAASUVORK5CYII=';
  const exportLogoSrc = () => CONTROLENG_LOGO_DATA_URI;
  const CONTROLENG_LOGO_ICON_DATA_URI = 'data:image/png;base64,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';
  const CONTROLENG_LOGO_TEXT_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE8AAAAqCAYAAADyDQZvAAAS0UlEQVR4nO2aaZBd1XHHf+dub1/mzT4jabSM1kESo33fWMWOABkMCJLgGMcVx5WqVGJ/cJxypSoLdqWcShUGY4wBATEIzGIEiMUSq5AEBoMEaB2NZt/nzVvuu/d2Ptz3niVDOUgChSR01a15c+45p/v06dP97z5XiQinQ/f9+Fa56oKZBEMmO3YeZtXV/6JOZvxjd31TLlo5ESug0dU9xkNbP+SvvnffSc1xOnT7P2+SGy+eTCRq8sJrXay77t8/NW/tdJmvXDCBUDTA/kP9J624f/uHG2RZawNW1GRwKMeTvzl0RhUHsGxuDZGoST7j0N6dPqmxp6W87Q//rTSNq2B4MMNzrxw86fGBgM7gcJ5jR0d4evsRbvmbu8+o4p76+TekZXIcBNp7smz69snxN06V8V233SLXXjIb23bZumM/f/Fdn/F//OPNkowHiEUsQgEDw1QopfBcoVBwyeYLpLMFhkdtvvnde8rCfnXxqUpyavTw7bfI+hXj0A2dgu2wZ18fU9ac3BzqVH3evhd/IDOm1nDk6AB73uugvjrKxIYEyWgQ09TQNXy7VgIC4IGAK4LrujgFj7Fcgb7BDD0DWfoGcvQMjPGN7/zic7e+J352q5yzuI5wyAAUb+3tp/XiH50031NS3pY7vyVXnjsTQSg4LpapoQwdCi6FgoPrCSIegqAATVPohqAphVYSUQkiglIKFLiORy7vMDyap2cgS3dfhu6BLAPDOb79GfnBu267WRadVcXMyXEMXQNNsf/wKM1r/+mU5j8l5XXvvk1qq2MMDmUYTmcYGs4xOJojnSmQzdo4jocnHigwdI2gZRAO6oRDFrGoSTxiEo9aRIKGr3ilfAs9jlzXo2A7jKZtBkdtegez9A3lGBrJM5wufOrAcvs/bZKGqhCTx8eY2BglGjaKJwH2Hhpm5rn/esobc9LKe/iOv5SW5ho+OtLHsa4RvvGdU3PyP/7BDZJKhqhJhaivilBdGSIZCxAM6CC+VYrnoQSU8tfruB52wSObc8jaDplsgWzOwXYEx/VABKVpBAxFOGQQDZvEIibhoI5pKARQmsLOu+z8XR8rrv7xaVn0Kfu8z4Pu/tGfybi6CONro9RWhomFDQy9+FJABPBPedFS/4js6vjX4vf3oK1rjO17erjhW3edtiv4QinvePrh318vdZVhGmvD1KbCpOIW0YiBZeroWtF3qv9GdgHH8xjLOXT3jvH+wWGu+Nodn1lA+sIq7w/ph9/7qiRjFpXJIKlEgHjEJBIyCFj+kdSKkcj1hELBYyzrMDJm0z2Qo6N3jG/83b2feRT/X6O8P0a3fe86KSnvr7+/+YwB7f8TyvufotPObf8/Uzk9+8rly+VY1wDZnI1paExuqmfzlu0K4LorV0h7xwCZbI5g0KK+toKHn3hNAWzauFYOtXVh6gYvvPJu+cisWjJLQkGLyooYXb1D2LaDrvt7JSK4nkd1ZYJ4NERbRx8F26HgOBi6TjwWpmlcFT+597nyfFdfulQ6OvvJ2Q6RcJDxDZVs3rJDAXx1wyo5crSHWDTE1hffOuHYXrCmVTLZHEpTiOfzra1OUl0Z58DhbgoFhymT6rj7gRcUwHmr50g+7zC9uYE779umAK6/apW0d/Qzls2haRqJWJjnfvNbhYiwqLVZLMsoxX4BZOmCaSIiLF80Q4IBU5RSEg5ZAohp6rJ4/lQREdatmF0es2DuFBERrr1iuQASDQdl8bxmiUaCJ8xdemZObZTlC6eX/08mIhIMmgJIbXVCvr7pfBERWmdPEtPQRdOUhIK+DKGgJeesmC0iwpL50wSQRDwsUsKIxScWDQkgmlJiWbrompLZMyfIFRcuEsv01zxpfE15XLA4/2UXLhQRYeXimWWepcc0NLnm0iViXHbBItn51n4AFs9rpml8DZ7n8cvHX1MbL18ub+z5CMdxWbZwOq/s3KfmtkyUd94/wlvvHGLTNWvENEtADN7d28aNV68S0/ANWhDGNVYxo3kc/YOjvPjy7xjL5pnb0kTL9PFEQkH2HegAIBK2uPripQyOjvHks7vo7h3m6LE+rrp4ibz97iEEuHBdK+MbK/nNq+/z4YEOXtvzIbfceK5Yps+vZNnHk6b5bfPmTOLNtw+or91wntx533Nq46XLRCnfSA8d7eHCtWfL1hffVkYRWFqmzg3XrJbXdn2A43rMbZnI9CkNgKBpGg88+rIyDrV1A5CIR3h990cnmHx7Zx+O42LoGpObagGYMbWR9/YdxS44dPcOFRGrT3m7wGu7PqRl2nh0XUME4pEQPyseiVQyKmPZPDWVce5/xD9yq5e1lCOW47p+VoGfVZiGzrGuAQQIhwM8/fweBXDp+Qvko4OdZDJ5enqGy0r7pDBb1A/psTyXr18sWhEbGuaJBaWdbx9gw0WLxDR0UL5raWvvxXE9ggGTuS1N3PPQSyewMPL5gv/jE3atYDvl3dOLO2joGpqucD0/XTIMvz0WDREKmhxs68YujlMKvOOieemX6318kWMZm18+8Sp528F1XObNmcxjW3eq2TObBMDUf2/hhqn7KZv4BYVPgxf2H+7iUFsPpqlz3YaVYmgaIoJlGVRWROnuGeb1PfvJ5wvomr/xtu3rRjc0gpYJwKxp46Srd4h5s6egWZa/A/l8gU0b15wgR6A4wPU8Co7Lbd+/SRzXw/X8bsGgScn0Y5EgS+dPJxYNcbSzH9f1UNqnh1yWaTBr2jjqqpMIkM3ZRRl8+eyCU+7rFFxKECsQNIt5G59oeqVXc2Y2cf1VK9l42TIe2LJDOa4/h6FrLJg7hcaGFJ3dg2SyeZTya5Bm0Tpt22F0LAfAwFCawaExRtNZjHENlbz3wVHSmRyv7NzHxefOFxGhMhWjuiqBrmm4rse+/ce4/5Htat6cKeK5HqGgRX1NkvbOAX9BrstjW3eqVUtmyY439p4g+B8u5JMoEDDY+dZ+ddmFC6W9s5/3P2znpo1rpLG+kt3vHCSbs1m9tEVmTGvkwOEuRCAZj7DlqdfV6qWzBCCTtVmzrEWCAQvLMkhVRNGLG1hwHLI5G8d1+fMbzxXH8YrtLtWVcRbObaajawi3qFSloKE+5fcpuLy++0PWr2uVfOlUafhne/bMCR+LhDOaG0VEmD9ncrktGDDLkWvV0hYREdYsbylGyt9HuvraCgEkEDDkxo2ry+2RYtRdvWxWuW35ohnFuQ0REf70unVlPisWzRARYcaUxrIMgeK7oGXIpef5G714XvPH5DdNQy49f4FUpWIfezdr2ji5fP0i0XVNlEI2FWVsmT6+3OfyYrRd1NosSqmPzbFs4XQxAN55/4i64sJF0t7RT75QIBCwmDzeDxC7fntAXX7hImk71ksmZxMJWkxqquORJ32cN76hiqULpxOPBMtWdO7K2ew/3EUoaPGL45zs0nnTyOTyNDVWlftOHF/tQ4SABcBdm59Xx9a2ynA6S1VlHIC9+9vVRee0SnvnALbtEosGmTalgfsf8XHo5KY6DMNAKYXgb0rAMqmtTrLg7GZG0hk0pfBE8DyhrjpJdWWClYtnIlAOBCsWzSSVjIKizPuNPR+pqy5ZKm3tveTyNqGARVVVgl9v262+TM9Og75Mz06D1JXrF8me3x0C8Z2qrmukklHmtkzknodeUmuXnyVH2ntxHBfHdbFMk6pUjLPPmshP739erVsxWw4c6aKxrpJX39yn1q9tlQ8OdqL8KwIWnj2VzVt2qDkzmySdzQGKSMji3b1t6torlsubbx1A6X7Z3XU9DF1nyfzp5dTwi0xG/2CaI0d7AahIRMjlbY4e66eza5A/uW6ddHQNcqitB0PXSVVE6Roc5Eh7L109QwB09Q7T1t6HVwRv7V39lIA3QF1NiuuuXCnv7msrt5UyguHRLAeLfWPRILrm32fki/jqi06arvsbHI+F2HjFcjZctASlFL0Do3R0DqAXQfCkphq6e4fUysUzAejpG+baK5aLVUzPSmmNV8SAlRVRLMugb2CUzu5BAFLJKKZpoBTcetP5UuIdjQTZcNESBofH1MBQWpWC0RedyjmK63qMjmZwHK94R6AwdK2MO0fTWTZcskR6+kcAqK6ME4+GEK8UcEqVXN8C66qTWOYY/YPD5PM2uqZorE9xpL2XsUwex/HKKYdtO7z93mEWz5sqVak4T23bXVZe6+xJEgiYvL7rQzX3rIkyNJRGxE/dJk2opX9wlIGhUUzTIBSwWHB2M3c/+MIZUX45YGSyeX719Jv86pk38USorIhSV1tRRvLdvcM8vvVN3nn/CAHLZGFrM3fct005xeNayiFL/8diYSpTMQYG0xzt6MOyDOpqkmiahuuJn8cWtec4Lsc6+zl4pJuunsETBOzsGSxb7pwZE7Ask2NdA0yeWEdDXQWHjvaglMb05kb2H+pi+2vvfb4aO47KlmfoOvV1FUQiQYKWwdRJDdy1+Xk1fUqDANTXJjm7ZRK73zlAb98Ibcf6AMrpWYk81wXwc8ZADNf1cWUqGaOyIu73F/+yvKTxaCREb//IJ1qLYRjomu8S7n14u1q1tEU6ugb8ehpQkYxKqiLKU8/tVhPH15RPxpkgo+SjAgGTNctbuPPebScswi1aUjQS5Kltu9Xi1qnS3TvMgcNd3HL9OVLSned53HrT+WLbReWZBol4uHwDWFUZ44FHd6hURUwAnEKhnK/lbJvVS1okGgniikvTuBp+8otnVWnevF3g1psvkNt//oxyCk7ZrwKIJ+RyNrfefIGkx3KEimD7TJCh6zq6rmFZBvIJ1Q7DNNB1hVbUUm1NEss0cB2XgaE0pmWUxwOU5gtYBhWJKPF4mPRYjrqaCgBCAZMRXcPzFLqmYxo64gmv7voAQTB0nfXnBMr8Q0GLjs4Bnnh2F3tam0XTNEKh3ysoGDQ51jnAMy+8hSceC8+e+jmq6w900zypjngsiGWZ/PT+bR87Ootam5nR3EAiFgbg8WfeVNdcslQEoaoqQTIRZUJDJfFYiNvveVZdf9UqGcvkeOzpnQogfeVyyeUdHv31GwpgzfIWMlmbXz7xqgK46pIl4lun4AnoSvHwk6+X5Vi+YDqj6Syu6xGOBImEAkwcX12Wb92K2X55XCkqEtFy7fBM0Jfp2WnQl+nZaZABsLC1WWKRECKCXXBoqK0gEDBp7xjA0DU88cjmCigFVRUxDENnS/EYXnTOfMnl8rieRzQSJJmIcPhoL+FQgIpkhPaOAeqqk4SCJh3dAxQcj2DAYtt2P1pect4CGRoZw3FdYpEQlqkTj4fp6Bz0qyNBk8xYnnA4QDqdZc6sphNu1a65dKn0DYySzRVwXIf66gqG01nqa5PYtkNn9yDj6lOkMzbJeJjRdJaRdIYdr+/1b8Y2rJRDR3swDB3LMMjm8oTCASKhAJFIgENtvZiGga4pTEMnk82j6ToVyYhveZqmGFefwjR08vkCmqa47+HtqqY6gSdCJlvAdT2GRzJ0dA+eEO1cz6WuLkkiGUHXNe5/ZIeqSsXo6RtGUxrJeBhNg/u37FDVVQkcxy2Xt8HPSKor48VNEoZGMkixLW8XyNsFcnaBhroUlmWQL5yYumVyNlXFvqah88Rzu5SmwUOPvaIe/fUbyjQNwuEgtl2go6ufVCqGZZl8/cbzBfyvpnLZPKGgxbiGFAXHo1BwiYSDbH7kZRWPhsnnbbJ5m2y+4Of4xe8QDfBr9Jqm0HQNXdcopU267ms7Fgvhui7hUIBMNsdjW3eWd17XNDRNw9A13CLoNU0du+AwPDqGUqqcuhm6jmFoJ9xy6YY/Vtf89oLjMDKSxQoYBAImiVgYzxWyWdvnpU70NKPpLJFQAFPX0It8SvctAJqu0HUNpSlGxrI4joOpa2VQH7BMotGQjyhK69e08rcvuqYIBCwfYXge4npouo6mab7lOba/bM/zKxuOU8RfORvD0HnupbeVoWtUVsZIxCN87YbzyqZXcD08T3CLf8HHhkpBX/8otu3w4GOvKPDvIeyCW8aOlHh64j+uh1KKwZE03b3DzGgexxPP7FIvv7FX/efjr6hc3ub4AHfTtetE8O+eHc+jUMSYzvHzu/5nvK7rIl7x0sgr5TZ+8XXq5HoKBQ/P89NLz/PKfAqOQyIeYtv23yrxhJxdwLYLuK6gfX3T+ZJKRbnnoZdUIhamtiYBwDWXLZORdK5cUU3EI6SSEepqkoyNZcvCBQMmmx/ZoaKREIloCIB4LEwi5vuXCeN8WLHh4iUyMJQmGDBJJELl8YloiGg4QGVFjMpklHgkzMBQmgmNVdxxrw+Ub752nVy+fqFEIkHufvDFYttaOXK0h5rKOJFwkPrqJJapc/G586UEqwBSyRiu4xEKWNRVJ4mEAiQTkTIIB8pfAfz8wRdUVUWMikS0DLYT8QgV8YhvpQG/qKHrGlUVUU64Xf+sn5u/svZjN/if5rnpK2tOadyZfv4LirfKIImDLWMAAAAASUVORK5CYII=';
  const exportCompanyHeader = () => `<div class="company-header" dir="rtl">
    <div class="company-header-line"></div>
    <div class="company-header-logo-box">
      <img class="company-full-logo" src="${CONTROLENG_LOGO_DATA_URI}" alt="CONTROLENG PRIME LTD" />
    </div>
    <div class="company-header-line"></div>
  </div>`;

  const exportCompanyFooter = () => `<div class="company-footer" dir="rtl">
    <div class="company-footer-line"></div>
    <div class="company-footer-single">
      <span class="company-footer-service">שירותי הנדסה, פיקוח ובקרת איכות</span>
      <span class="company-footer-contact">בית ג׳אן 249900&nbsp;&nbsp;|&nbsp;&nbsp;<span dir="ltr">q.controling@gmail.com</span></span>
    </div>
  </div>`;



  const safeText = (value: unknown) =>
    String(value ?? '').replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char] ?? char));
  const compactHeight = (height = 18) => Math.min(Number(height) || 18, 16);
  const blankCell = (height = 18) => `<div class="blank-cell" style="min-height:${compactHeight(height)}px">&nbsp;</div>`;
  const valueOrBlank = (value: unknown, height = 18) => {
    const text = String(value ?? '').trim();
    return text ? safeText(text) : blankCell(height);
  };

  const exportStyles = `
    body{font-family:Arial,sans-serif;direction:rtl;padding:4px;color:#0f172a;font-size:8px;background:#fff}
    .export-page{width:100%;box-sizing:border-box;margin:0 auto}
    h1{display:none}
    h2{font-size:9px;margin:2px 0 1px;border-bottom:1px solid #111827;padding-bottom:1px;text-align:right}
    table{border-collapse:collapse;width:100%;margin:0 0 2px;table-layout:fixed;page-break-inside:avoid}
    th,td{border:1px solid #111827;padding:1px 2px;vertical-align:middle;text-align:center;word-break:break-word;line-height:1.05}
    th{background:#fff;font-weight:700}
    .meta{display:none}.blank-cell{min-height:8px}.header-title{font-size:13px;font-weight:900}.small{font-size:8px}.empty{background:#fff}
    .doc-header td{height:15px}.source-meta td{height:14px}.check-table td{height:14px}.check-table th{height:14px;background:#fff}
    .wide-label{font-weight:700}.no-border{border:0!important}.signature td{height:14px}
    .company-header{width:100%;margin:0 0 7px;page-break-inside:avoid;box-sizing:border-box;border:0!important}
    .company-header-line,.company-footer-line{height:3px;background:#8a7d5b;width:100%;margin:0;border:0!important}
    .company-header-logo-box{height:58px;width:100%;display:block;text-align:center;background:#fff!important;border:0!important;box-sizing:border-box;padding:3px 0;overflow:hidden}
    .company-full-logo{height:52px!important;max-height:52px!important;width:auto!important;max-width:115px!important;display:inline-block!important;border:0!important;outline:0!important;object-fit:contain!important;vertical-align:middle!important}
    .company-footer{width:100%;margin:9px 0 0;page-break-inside:avoid;box-sizing:border-box;border:0!important}
    .company-footer-single{height:20px;line-height:18px;font-size:9px;font-weight:700;color:#111827;box-sizing:border-box;text-align:center;border:0!important;background:#fff!important;padding:2px 5px;white-space:nowrap}
    .company-footer-service{display:inline-block;margin-left:22px;text-align:left;border:0!important;background:transparent!important}
    .company-footer-contact{display:inline-block;text-align:right;direction:rtl;border:0!important;background:transparent!important}
    .trial-report{width:100%;margin:0 0 3px;table-layout:fixed}
    .trial-report th,.trial-report td{font-size:9px;line-height:1.15;height:18px;padding:2px 4px}
    .trial-report .trial-title{font-size:15px;font-weight:900;text-align:center}
    .trial-report .label{font-weight:800;width:32%}
    .trial-report .value{height:20px}
    .trial-report .large-value{height:48px}
    @page{size:A4 portrait;margin:8mm}
    @media print{button{display:none} body{padding:0;font-size:8px}.header-title{font-size:13px} th,td{padding:1px 2px}.doc-header td{height:15px}.source-meta td{height:14px}.check-table td{height:14px}.check-table th{height:14px}.company-header{margin-bottom:6px}.company-header-logo-box{height:54px}.company-full-logo{height:48px!important;max-height:48px!important;max-width:108px!important}.company-footer{margin-top:8px}.company-footer-single{height:18px;font-size:8.5px;line-height:16px}.trial-report{width:100%}}
  `;

  const recordTitleForExport = () => {
    if (section === 'checklists') return checklistForm.title || 'רשימת תיוג';
    if (section === 'nonconformances') return nonconformanceForm.title || 'אי התאמה';
    if (section === 'trialSections') return trialSectionForm.title || 'קטע ניסוי';
    if (section === 'preliminary') return currentPreliminaryForm.title || 'בקרה מקדימה';
    return 'טופס';
  };

  const baseRows = (rows: Array<[string, unknown, number?]>) =>
    `<table><tbody>${rows.map(([label, value, height]) => `<tr><th>${safeText(label)}</th><td>${valueOrBlank(value, height ?? 34)}</td></tr>`).join('')}</tbody></table>`;

  const attachmentsList = (items: unknown) => {
    const attachments = normalizeAttachments(items);
    if (!attachments.length) return '';
    return `<h2>תמונות / קבצים מצורפים</h2><table><thead><tr><th>שם קובץ</th><th>סוג</th><th>תאריך העלאה</th></tr></thead><tbody>${attachments.map((file) => `<tr><td>${safeText(file.name)}</td><td>${safeText(file.type || 'קובץ')}</td><td>${safeText(file.uploadedAt)}</td></tr>`).join('')}</tbody></table>`;
  };

  const signaturesTable = (approval: ApprovalFlow | undefined) => {
    const normalized = normalizeApproval(approval);
    return `<h2>אישורים וחתימות</h2><table class="signature"><thead><tr><th>תפקיד</th><th>שם</th><th>חתימה</th><th>תאריך</th><th>הערות</th></tr></thead><tbody>${normalized.signatures.map((sig) => `<tr><td>${safeText(sig.role)}</td><td>${valueOrBlank(sig.signerName)}</td><td>${valueOrBlank(sig.signature)}</td><td>${valueOrBlank(sig.signedAt)}</td><td>${blankCell()}</td></tr>`).join('')}</tbody></table>`;
  };

  const checklistExportHtml = (forcedChecklistNo?: number) => {
    const items = normalizeChecklistItems(checklistForm.items);
    const templateKey = normalizeChecklistTemplateKey(checklistForm.templateKey);
    const template = checklistTemplates[templateKey] as any;
    const title = checklistForm.title || template.title || 'רשימת תיוג';
    const procedureNo = template.procedureNo || '051.21.01';
    const edition = template.edition || 'א׳';
    const procedureDate = template.procedureDate || '20/05/2010';
    const profile = currentProjectProfile ?? getProjectProfile(projectName);
    const defaultProjectName = profile?.projectName || projectName;
    const currentChecklistNo = forcedChecklistNo ?? getExistingEditingChecklistNo() ?? (checklistForm as any).checklistNo ?? '';
    const contractor = checklistForm.contractor || profile?.contractor || '';
    const projectManager = profile?.projectManager || '';
    const qaCompany = profile?.qaCompany || '';
    const location = checklistForm.location || '';
    const titleText = `${title} ${template.label ?? ''} ${template.category ?? ''}`;
    const isBaseCourse = /מצע|מצעים/.test(titleText);
    const isPainting = /צבע/.test(titleText);
    const isAsphaltSite = templateKey === 'asphaltSite' || /אספלט באתר/.test(titleText);
    // בטופס אספלט מציגים במערכת את כל תהליכי הבקרה.
    // בייצוא Word/PDF מסתירים רק שורות שסומנו במפורש כ״לא רלוונטי״.
    const isRelevantChecklistItem = (item: ChecklistItem) =>
      String(item.status ?? '').trim() !== 'לא רלוונטי';
    const displayedItems = isAsphaltSite ? items.filter(isRelevantChecklistItem) : items;

    const renderChecklistRows = (columns: 'source' | 'system' = 'source') => {
      if (columns === 'system') {
        return `<table class="check-table">
          <thead>
            <tr><th colspan="7" class="wide-label">תאור פעילות הבקרה&nbsp;&nbsp;&nbsp;&nbsp; אישור שלבי התהליך ע״י בקרת האיכות</th></tr>
            <tr><th style="width:36%">תאור פעילות הבקרה</th><th>באחריות</th><th>שם</th><th>חתימה</th><th>תאריך</th><th>הערות</th><th>מס׳</th></tr>
          </thead>
          <tbody>
            ${displayedItems.map((item, index) => `<tr><td>${valueOrBlank(item.description, 34)}</td><td>${valueOrBlank(item.responsible, 30)}</td><td>${valueOrBlank(resolveResponsibleName(item.responsible, projectName) || item.inspector, 30)}</td><td>${blankCell(34)}</td><td>${valueOrBlank(item.executionDate, 30)}</td><td>${valueOrBlank(item.notes, 34)}</td><td>${index + 1}</td></tr>`).join('')}
          </tbody>
        </table>`;
      }
      return `<table class="check-table">
        <thead>
          <tr><th colspan="6" class="wide-label">תאור פעילות הבקרה&nbsp;&nbsp;&nbsp;&nbsp; אישור שלבי התהליך ע״י בקרת האיכות</th></tr>
          <tr><th style="width:36%">תאור פעילות הבקרה</th><th>באחריות</th><th>שם</th><th>חתימה</th><th>תאריך</th><th>מס׳ תוכנית/ תעודת בדיקה</th></tr>
        </thead>
        <tbody>
          ${displayedItems.map((item) => `<tr><td>${valueOrBlank(item.description, 34)}</td><td>${valueOrBlank(item.responsible, 30)}</td><td>${valueOrBlank(resolveResponsibleName(item.responsible, projectName) || item.inspector, 30)}</td><td>${blankCell(34)}</td><td>${valueOrBlank(item.executionDate, 30)}</td><td>${valueOrBlank(item.notes, 34)}</td></tr>`).join('')}
        </tbody>
      </table>`;
    };

    if (isAsphaltSite) {
      return `<table class="doc-header">
        <tbody>
          <tr><td>מס׳ רשימת תיוג</td><td>מס׳ נוהל</td><td colspan="4">שם הנוהל</td><td>מהדורה</td><td>תאריך</td></tr>
          <tr><td>${valueOrBlank(currentChecklistNo, 22)}</td><td>${valueOrBlank(procedureNo, 22)}</td><td colspan="4" class="header-title">${safeText(title)}</td><td>${safeText(edition)}</td><td>${safeText(procedureDate)}</td></tr>
        </tbody>
      </table>
      <table class="source-meta">
        <tbody>
          <tr><th>קבלן ראשי</th><td colspan="3">${safeText(contractor)}</td><th>שם הפרויקט</th><td colspan="3">${safeText(defaultProjectName)}</td></tr>
          <tr><th>חברת ניהול</th><td colspan="3">${valueOrBlank(projectManager, 22)}</td><th>מס׳ חוזה</th><td colspan="3">${valueOrBlank('', 22)}</td></tr>
          <tr><th>חברת בקרת איכות</th><td colspan="3">${safeText(CONTROL_QUALITY_COMPANY_NAME)}</td><th>חברת הבטחת איכות</th><td colspan="3">${valueOrBlank(qaCompany, 22)}</td></tr>
          <tr><th>תת פרויקט</th><td colspan="3">${valueOrBlank('', 22)}</td><th>תאריך ביצוע</th><td colspan="3">${valueOrBlank(checklistForm.date, 22)}</td></tr>
          <tr><th>כמות</th><td colspan="3">${valueOrBlank('', 22)}</td><th>מבנה</th><td colspan="3">${valueOrBlank(location, 22)}</td></tr>
          <tr><th>מס׳ שכבה</th><td colspan="3">${valueOrBlank('', 22)}</td><th>שטח מבוקר (מ״ר)</th><td colspan="3">${valueOrBlank('', 22)}</td></tr>
          <tr><th>מחתך</th><td colspan="3">${valueOrBlank('', 22)}</td><th>לחתך</th><td colspan="3">${valueOrBlank('', 22)}</td></tr>
          <tr><th>צד / מיקום</th><td colspan="3">${valueOrBlank(location, 22)}</td><th>עובי מתוכנן</th><td colspan="3">${valueOrBlank('', 22)}</td></tr>
          <tr><th>מפעל מייצר</th><td colspan="3">${valueOrBlank('', 22)}</td><th>סוג תערובת</th><td colspan="3">${valueOrBlank('', 22)}</td></tr>
          <tr><th>שם קבוצת הפיזור</th><td colspan="3">${valueOrBlank('', 22)}</td><th>סוג אמולסיה</th><td colspan="3">${valueOrBlank('', 22)}</td></tr>
          <tr><th>אלמנט</th><td colspan="7">${valueOrBlank('', 22)}</td></tr>
        </tbody>
      </table>
      <table class="check-table">
        <thead>
          <tr><th style="width:38%">תאור העבודה לבקרה</th><th>אחריות</th><th>שם</th><th>חתימה</th><th>תאריך</th><th>הערות</th></tr>
        </thead>
        <tbody>
          ${displayedItems.map((item) => `<tr><td>${valueOrBlank(item.description, 34)}</td><td>${valueOrBlank(item.responsible, 30)}</td><td>${valueOrBlank(resolveResponsibleName(item.responsible, projectName) || item.inspector, 30)}</td><td>${blankCell(34)}</td><td>${valueOrBlank(item.executionDate, 30)}</td><td>${valueOrBlank(item.notes, 34)}</td></tr>`).join('')}
        </tbody>
      </table>`;
    }

    if (isBaseCourse) {
      return `<table class="doc-header">
        <tbody>
          <tr><td class="empty" colspan="2">&nbsp;</td><td colspan="2">מספר נוהל:</td><td colspan="5">שם הנוהל:</td><td>מהדורה:</td><td>תאריך:</td></tr>
          <tr><td class="empty" colspan="2">&nbsp;</td><td colspan="2">${safeText(procedureNo)}</td><td colspan="5" class="header-title">${safeText(title)}</td><td>${safeText(edition)}</td><td>${safeText(procedureDate)}</td></tr>
        </tbody>
      </table>
      <table class="source-meta">
        <tbody>
          <tr><th>שם הפרויקט</th><th>קבלן מבצע</th><th>קטע עבודה</th><th>כביש/ מבנה</th><th>מספר רשימת תיוג</th></tr>
          <tr><td>${safeText(defaultProjectName)}</td><td>${safeText(contractor)}</td><td>${safeText(location)}</td><td>${safeText(location)}</td><td>${valueOrBlank(currentChecklistNo, 22)}</td></tr>
          <tr><th>מס׳ שכבה</th><th>מס׳ שכבות מתוכנן</th><th>עובי השכבה</th><th>שטח השכבה</th><th>מחתך / היסט / לחתך</th></tr>
          <tr><td>${valueOrBlank('', 22)}</td><td>${valueOrBlank('', 22)}</td><td>${valueOrBlank('', 22)}</td><td>${valueOrBlank('', 22)}</td><td>${valueOrBlank('', 22)}</td></tr>
          <tr><th>מקור החומר</th><th colspan="2">תאור חומר המילוי</th><th colspan="2">מיון החומר</th></tr>
          <tr><td>${valueOrBlank('', 22)}</td><td colspan="2">${valueOrBlank('', 22)}</td><td colspan="2">${valueOrBlank('', 22)}</td></tr>
        </tbody>
      </table>
      ${renderChecklistRows('source')}`;
    }

    if (isPainting) {
      return `<table class="doc-header">
        <tbody>
          <tr><td>מספר הליך:</td><td colspan="5">שם הנוהל:</td><td>מהדורה:</td><td>תאריך:</td></tr>
          <tr><td>${safeText(procedureNo)}</td><td colspan="5" class="header-title">${safeText(title)}</td><td>${safeText(edition)}</td><td>${safeText(procedureDate)}</td></tr>
        </tbody>
      </table>
      <table class="source-meta">
        <tbody>
          <tr><th>חוזה מס׳</th><th>שם פרויקט</th><th>כביש מס׳:</th><th colspan="2">מספר רשימת תיוג</th></tr>
          <tr><td>${valueOrBlank('', 22)}</td><td>${safeText(defaultProjectName)}</td><td>${safeText(location)}</td><td colspan="2">${valueOrBlank(currentChecklistNo, 22)}</td></tr>
          <tr><th>תאריך מתן העבודה:</th><th>יום / לילה</th><th>מק״מ / חתך</th><th>עד ק״מ / חתך</th><th></th></tr>
          <tr><td>${valueOrBlank(checklistForm.date, 22)}</td><td>${valueOrBlank('', 22)}</td><td>${valueOrBlank('', 22)}</td><td>${valueOrBlank('', 22)}</td><td>${valueOrBlank('', 22)}</td></tr>
          <tr><th>ניהול פרויקט</th><td>${valueOrBlank(projectManager, 22)}</td><th>שם קבלן:</th><td colspan="2">${safeText(contractor)}</td></tr>
          <tr><th>שם קבלן:</th><td>${safeText(contractor)}</td><th>שטח צביעה יומי (מ״ר):</th><td colspan="2">${valueOrBlank('', 22)}</td></tr>
          <tr><th>קבלן משנה:</th><td>${valueOrBlank('', 22)}</td><th>תחילת קטע יומי (ק״מ / חתך):</th><td colspan="2">${valueOrBlank('', 22)}</td></tr>
          <tr><th>קבלן משנה לעבודות צבע:</th><td>${valueOrBlank('', 22)}</td><th>סוף קטע יומי (ק״מ / חתך):</th><td colspan="2">${valueOrBlank('', 22)}</td></tr>
        </tbody>
      </table>
      <table class="approval-table">
        <thead><tr><th>תאור העבודה</th><th>אחריות</th><th>שם</th><th>חתימה</th><th>תאריך</th><th>הערות</th></tr></thead>
        <tbody>
          <tr><td>אישור מוקדם לצורך העבודה עפ״י נוהל 33.13</td><td>בקרת איכות</td><td>${blankCell(22)}</td><td>${blankCell(22)}</td><td>${blankCell(22)}</td><td>${blankCell(22)}</td></tr>
          <tr><td>שלמות השינויים בגוף המסמך</td><td>${blankCell(22)}</td><td>${blankCell(22)}</td><td>${blankCell(22)}</td><td>${blankCell(22)}</td><td>${blankCell(22)}</td></tr>
          <tr><td>אישור מנהל הבטחת איכות</td><td>מנהל הבטחת איכות</td><td>${blankCell(22)}</td><td>${blankCell(22)}</td><td>${blankCell(22)}</td><td>${blankCell(22)}</td></tr>
        </tbody>
      </table>
      ${renderChecklistRows('system')}`;
    }

    return `<table class="doc-header">
      <tbody>
        <tr><td>מספר הליך:</td><td colspan="5">שם הנוהל:</td><td>מהדורה:</td><td>תאריך:</td></tr>
        <tr><td>${safeText(procedureNo)}</td><td colspan="5" class="header-title">${safeText(title)}</td><td>${safeText(edition)}</td><td>${safeText(procedureDate)}</td></tr>
      </tbody>
    </table>
    <table class="source-meta">
      <tbody>
        <tr><th>שם הפרויקט</th><th>קבלן מבצע</th><th>קטע עבודה</th><th>כביש/ מבנה</th><th>מספר רשימת תיוג</th></tr>
        <tr><td>${safeText(defaultProjectName)}</td><td>${safeText(contractor)}</td><td>${safeText(location)}</td><td>${safeText(location)}</td><td>${valueOrBlank(currentChecklistNo, 22)}</td></tr>
        <tr><th>מחתך / היסט / לחתך</th><th>עד ק״מ / חתך</th><th>מק״מ / חתך</th><th>יום / לילה</th><th>הערות</th></tr>
        <tr><td>${valueOrBlank('', 22)}</td><td>${valueOrBlank('', 22)}</td><td>${valueOrBlank('', 22)}</td><td>${valueOrBlank('', 22)}</td><td>${valueOrBlank('', 22)}</td></tr>
      </tbody>
    </table>
    ${renderChecklistRows('source')}`;
  };

  const nonconformanceExportHtml = () => `${baseRows([
    ['כותרת', nonconformanceForm.title],
    ['מיקום', nonconformanceForm.location],
    ['תאריך', nonconformanceForm.date],
    ['נפתח על ידי', nonconformanceForm.raisedBy],
    ['חומרה', nonconformanceForm.severity],
    ['סטטוס', nonconformanceForm.status],
    ['תיאור אי ההתאמה', nonconformanceForm.description, 100],
    ['פעולה נדרשת / מתקנת', nonconformanceForm.actionRequired, 100],
    ['הערות', nonconformanceForm.notes, 80],
  ])}${attachmentsList((nonconformanceForm as any).images)}${signaturesTable(nonconformanceForm.approval)}`;

  const trialSectionExportHtml = () => {
    // תבנית ייצוא לפי קובץ "דוח קטע ניסוי" שצורף.
    // ערכי הדוגמה נמחקו, אך פרטי הפרויקט הקבועים והלוגו מוזנים אוטומטית.
    const trialBlank = (height = 20) => blankCell(height);
    const profile = currentProjectProfile ?? getProjectProfile(projectName);
    const trialProjectName = profile?.projectName || projectName;
    const trialProjectManager = profile?.projectManager || '';
    const trialContractor = profile?.contractor || '';
    return `<table class="trial-report">
      <tbody>
        <tr>
          <td rowspan="2" colspan="2" class="trial-title">דוח קטע ניסוי</td>
          <th>מהדורה</th>
          <th>תאריך מהדורה</th>
        </tr>
        <tr>
          <td>א׳</td>
          <td>01.01.2026</td>
        </tr>
      </tbody>
    </table>
    <table class="trial-report">
      <tbody>
        <tr><th class="label">שם הפרויקט</th><td class="value">${valueOrBlank(trialProjectName, 20)}</td></tr>
        <tr><th class="label">חברת ניהול</th><td class="value">${valueOrBlank(trialProjectManager, 20)}</td></tr>
        <tr><th class="label">קבלן ראשי</th><td class="value">${valueOrBlank(trialContractor, 20)}</td></tr>
        <tr><th class="label">חברת בקרת איכות</th><td class="value">${safeText(CONTROL_QUALITY_COMPANY_NAME)}</td></tr>
      </tbody>
    </table>
    <table class="trial-report">
      <tbody>
        <tr><th class="label">קטע מס'</th><td class="value">${trialBlank()}</td></tr>
        <tr><th class="label">הוכחת היכולת לפעולה מסוג</th><td class="value">${trialBlank()}</td></tr>
        <tr><th class="label">שם האלמנט</th><td class="value">${trialBlank()}</td></tr>
        <tr><th class="label">תת אלמנט</th><td class="value">${trialBlank()}</td></tr>
        <tr><th class="label">מחתך עד חתך/צד</th><td class="value">${trialBlank()}</td></tr>
        <tr><th class="label">משתתפים בקטע ניסוי</th><td class="large-value">${trialBlank(48)}</td></tr>
        <tr><th class="label">חומרים לשימוש</th><td class="value">${trialBlank()}</td></tr>
        <tr><th class="label">הכלים בהם משתמשים</th><td class="value">${trialBlank()}</td></tr>
        <tr><th class="label">תאריך ביצוע</th><td class="value">${trialBlank()}</td></tr>
        <tr><th class="label">תיאור קטע ניסוי</th><td class="large-value">${trialBlank(60)}</td></tr>
        <tr><th class="label">מסקנות קטע ניסוי</th><td class="large-value">${trialBlank(38)}</td></tr>
        <tr><th class="label">פעולה מתקנת (במידה ונדרשת)</th><td class="large-value">${trialBlank(38)}</td></tr>
      </tbody>
    </table>`;
  };

  const preliminaryRows = () => {
    if (preliminaryTab === 'suppliers') {
      const s = supplierPreliminaryForm.supplier ?? {} as any;
      return baseRows([
        ['סוג בקרה', 'ספקים'], ['כותרת', supplierPreliminaryForm.title], ['תאריך', supplierPreliminaryForm.date], ['סטטוס', supplierPreliminaryForm.status],
        ['שם ספק', (s as any).supplierName], ['חומר מסופק', (s as any).suppliedMaterial], ['טלפון', (s as any).contactPhone], ['מספר אישור', (s as any).approvalNo], ['הערות', (s as any).notes, 90],
      ]) + signaturesTable(supplierPreliminaryForm.approval);
    }
    if (preliminaryTab === 'subcontractors') {
      const s = subcontractorPreliminaryForm.subcontractor ?? {} as any;
      return baseRows([
        ['סוג בקרה', 'קבלנים'], ['כותרת', subcontractorPreliminaryForm.title], ['תאריך', subcontractorPreliminaryForm.date], ['סטטוס', subcontractorPreliminaryForm.status],
        ['שם קבלן משנה', (s as any).subcontractorName], ['תחום', (s as any).field], ['טלפון', (s as any).contactPhone], ['מספר אישור', (s as any).approvalNo], ['הערות', (s as any).notes, 90],
      ]) + signaturesTable(subcontractorPreliminaryForm.approval);
    }
    const m = materialPreliminaryForm.material ?? {} as any;
    return baseRows([
      ['סוג בקרה', 'חומרים'], ['כותרת', materialPreliminaryForm.title], ['תאריך', materialPreliminaryForm.date], ['סטטוס', materialPreliminaryForm.status],
      ['שם חומר', (m as any).materialName], ['מקור', (m as any).source], ['שימוש', (m as any).usage], ['מספר תעודה', (m as any).certificateNo], ['הערות', (m as any).notes, 90],
    ]) + signaturesTable(materialPreliminaryForm.approval);
  };

  const exportHtml = (forcedChecklistNo?: number) => {
    const title = recordTitleForExport();
    const body = section === 'checklists' ? checklistExportHtml(forcedChecklistNo)
      : section === 'nonconformances' ? nonconformanceExportHtml()
      : section === 'trialSections' ? trialSectionExportHtml()
      : section === 'preliminary' ? preliminaryRows()
      : '';
    const header = exportCompanyHeader();
    const footer = exportCompanyFooter();
    return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${safeText(title)}</title><style>${exportStyles}</style></head><body><div class="export-page">${header}<h1>${safeText(title)}</h1><div class="meta">פרויקט: ${safeText(projectName)}</div>${body}${footer}</div></body></html>`;
  };

  const downloadTextFile = (filename: string, mimeType: string, content: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const getExportChecklistNo = () => section === 'checklists' ? ensureChecklistNo() : undefined;
  const exportWord = () => downloadTextFile(`${recordTitleForExport()}.doc`, 'application/msword;charset=utf-8', exportHtml(getExportChecklistNo()));
  const exportExcel = () => downloadTextFile(`${recordTitleForExport()}.xls`, 'application/vnd.ms-excel;charset=utf-8', exportHtml(getExportChecklistNo()));
  const exportPdf = () => {
    const exportChecklistNo = getExportChecklistNo();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('הדפדפן חסם פתיחת חלון להפקת PDF');
    printWindow.document.open();
    printWindow.document.write(exportHtml(exportChecklistNo));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const showExportButtons = ['checklists', 'nonconformances', 'trialSections', 'preliminary'].includes(section);

  return (
    <div style={styles.page} dir="rtl">
      <header style={styles.header}>
        <div style={styles.headerCard}><div style={{ fontWeight: 900, fontSize: 24 }}>Y.K QUALITY</div><div style={{ color: '#475569', marginTop: 6 }}>QA/QC · Multi-file refactor · workflow with signatures</div></div>
        <div style={styles.headerCard}><div style={{ fontWeight: 800 }}>פרויקט פעיל</div><div>{projectName}</div>{isSaving && <div style={{ color: '#475569', marginTop: 6 }}>שומר נתונים...</div>}{!cloudEnabled && <div style={{ color: '#475569', marginTop: 6 }}>מצב מקומי בלבד</div>}</div>
      </header>

      <div style={styles.navRow}>{[['home','דף בית'],['projects','פרויקטים'],['checklists','רשימות תיוג'],['nonconformances','אי תאמות'],['trialSections','קטעי ניסוי'],['preliminary','בקרה מקדימה']].map(([key,label]) => <button key={key} style={{ ...styles.navBtn, background: section === key ? '#0f172a' : '#fff', color: section === key ? '#fff' : '#0f172a' }} onClick={() => setSection(key as Section)}>{label}</button>)}</div>

      <div style={styles.layout}>
        <main style={styles.mainCard}>
          {showExportButtons && !guardedBody && (
            <div style={{ ...styles.buttonRow, justifyContent: 'flex-start', marginBottom: 14 }}>
              <button type="button" style={styles.secondaryBtn} onClick={exportPdf}>הורד PDF</button>
              <button type="button" style={styles.secondaryBtn} onClick={exportExcel}>הורד Excel</button>
              <button type="button" style={styles.secondaryBtn} onClick={exportWord}>הורד Word</button>
            </div>
          )}
          {section === 'home' && <HomeSection projects={projects} projectChecklists={projectChecklists} projectNonconformances={projectNonconformances} projectTrialSections={projectTrialSections} projectPreliminary={projectPreliminary} homeModules={homeModules} setSection={setSection} />}
          {section === 'projects' && <ProjectsSection projects={projects} currentProjectId={currentProjectId} newProjectName={newProjectName} newProjectDescription={newProjectDescription} newProjectManager={newProjectManager} setNewProjectName={setNewProjectName} setNewProjectDescription={setNewProjectDescription} setNewProjectManager={setNewProjectManager} addProject={addProject} setActiveProject={setActiveProject} renameProject={renameProject} updateProjectMeta={updateProjectMeta} deleteProject={deleteProject} />}
          {section === 'checklists' && <ChecklistsSection guardedBody={guardedBody} editingChecklistId={editingChecklistId} checklistForm={checklistForm} setChecklistForm={setChecklistForm} checklistTemplateLabel={checklistTemplateLabel} applyChecklistTemplate={applyChecklistTemplate} updateChecklistItem={updateChecklistItem} addChecklistItem={addChecklistItem} removeChecklistItem={removeChecklistItem} saveChecklist={saveChecklist} resetChecklistForm={resetChecklistForm} />}
          {section === 'nonconformances' && <NonconformancesSection guardedBody={guardedBody} editingNonconformanceId={editingNonconformanceId} nonconformanceForm={nonconformanceForm} setNonconformanceForm={setNonconformanceForm} saveNonconformance={saveNonconformance} resetNonconformanceEditor={resetNonconformanceEditor} />}
          {section === 'trialSections' && <TrialSectionsSection guardedBody={guardedBody} editingTrialSectionId={editingTrialSectionId} trialSectionForm={trialSectionForm} setTrialSectionForm={setTrialSectionForm} saveTrialSection={saveTrialSection} resetTrialSectionEditor={resetTrialSectionEditor} />}
          {section === 'preliminary' && <PreliminarySection guardedBody={guardedBody} preliminaryTab={preliminaryTab} setPreliminaryTab={setPreliminaryTab} editingPreliminaryId={editingPreliminaryId} supplierPreliminaryForm={supplierPreliminaryForm} subcontractorPreliminaryForm={subcontractorPreliminaryForm} materialPreliminaryForm={materialPreliminaryForm} setSupplierPreliminaryForm={setSupplierPreliminaryForm} setSubcontractorPreliminaryForm={setSubcontractorPreliminaryForm} setMaterialPreliminaryForm={setMaterialPreliminaryForm} savePreliminary={savePreliminary} resetPreliminaryEditor={resetPreliminaryEditor} labelForPreliminary={labelForPreliminary} />}
        </main>

        <SavedRecordsSidebar projectName={projectName} searchTerm={recordsSearchTerm} onSearchTermChange={setRecordsSearchTerm} checklistTemplateLabel={checklistTemplateLabel} projectChecklists={projectChecklists} projectNonconformances={projectNonconformances} projectTrialSections={projectTrialSections} projectPreliminary={projectPreliminary} onOpenChecklist={loadChecklist} onDeleteChecklist={deleteChecklist} onOpenNonconformance={loadNonconformance} onDeleteNonconformance={deleteNonconformance} onOpenTrialSection={loadTrialSection} onDeleteTrialSection={deleteTrialSection} onOpenPreliminary={loadPreliminary} onDeletePreliminary={deletePreliminary} />
      </div>
    </div>
  );
}
