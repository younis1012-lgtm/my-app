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

const createDefaultChecklist = (templateKey: ChecklistTemplateKey = 'general'): Omit<ChecklistRecord, 'id' | 'projectId' | 'savedAt'> => ({ templateKey, title: checklistTemplates[templateKey].title, category: checklistTemplates[templateKey].category, location: '', date: '', contractor: '', notes: '', items: buildChecklistItemsFromTemplate(templateKey), approval: createDefaultApproval() });
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
    setSavedChecklists((checklistRows ?? []).map((row) => ({ id: row.id, projectId: row.project_id, templateKey: normalizeChecklistTemplateKey(row.template_key), title: row.title ?? '', category: row.category ?? '', location: row.location ?? '', date: row.date ?? '', contractor: row.contractor ?? '', notes: row.notes ?? '', items: normalizeChecklistItems(row.items), approval: normalizeApproval(row.approval), savedAt: row.saved_at ? new Date(row.saved_at).toLocaleString('he-IL') : '' })));
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
  const projectName = !loaded ? 'טוען...' : currentProject?.name ?? 'לא נבחר פרויקט';
  const checklistTemplateLabel = (key: ChecklistTemplateKey | string | undefined) => checklistTemplates[normalizeChecklistTemplateKey(key)]?.label ?? 'רשימת תיוג';
  const normalizedSearchTerm = recordsSearchTerm.trim().toLowerCase();
  const projectChecklists = useMemo(() => savedChecklists.filter((item) => item.projectId === currentProjectId).filter((item) => !normalizedSearchTerm || [item.title, item.category, item.location, item.contractor].join(' ').toLowerCase().includes(normalizedSearchTerm)), [savedChecklists, currentProjectId, normalizedSearchTerm]);
  const projectNonconformances = useMemo(() => savedNonconformances.filter((item) => item.projectId === currentProjectId).filter((item) => !normalizedSearchTerm || [item.title, item.location, item.description, item.status].join(' ').toLowerCase().includes(normalizedSearchTerm)), [savedNonconformances, currentProjectId, normalizedSearchTerm]);
  const projectTrialSections = useMemo(() => savedTrialSections.filter((item) => item.projectId === currentProjectId).filter((item) => !normalizedSearchTerm || [item.title, item.location, item.spec, item.result].join(' ').toLowerCase().includes(normalizedSearchTerm)), [savedTrialSections, currentProjectId, normalizedSearchTerm]);
  const projectPreliminary = useMemo(() => savedPreliminary.filter((item) => item.projectId === currentProjectId).filter((item) => !normalizedSearchTerm || [item.title, item.subtype, item.status].join(' ').toLowerCase().includes(normalizedSearchTerm)), [savedPreliminary, currentProjectId, normalizedSearchTerm]);

  const resetChecklistForm = (templateKey: ChecklistTemplateKey = checklistForm.templateKey) => { setEditingChecklistId(null); setChecklistForm(createDefaultChecklist(templateKey)); };
  const resetNonconformanceEditor = () => { setEditingNonconformanceId(null); setNonconformanceForm(createDefaultNonconformance()); };
  const resetTrialSectionEditor = () => { setEditingTrialSectionId(null); setTrialSectionForm(createDefaultTrialSection()); };
  const resetPreliminaryEditor = () => { setEditingPreliminaryId(null); if (preliminaryTab === 'suppliers') setSupplierPreliminaryForm(createDefaultPreliminary('suppliers')); if (preliminaryTab === 'subcontractors') setSubcontractorPreliminaryForm(createDefaultPreliminary('subcontractors')); if (preliminaryTab === 'materials') setMaterialPreliminaryForm(createDefaultPreliminary('materials')); };

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
  const setActiveProject = async (projectId: string) => await withSaving(async () => cloudEnabled ? (await supabase.from('projects').update({ is_active: false }).neq('id', projectId), await supabase.from('projects').update({ is_active: true }).eq('id', projectId), await refreshCloudData()) : (setProjects((prev) => prev.map((p) => ({ ...p, isActive: p.id === projectId }))), setCurrentProjectId(projectId)));
  const deleteProject = async (projectId: string) => { const project = projects.find((p) => p.id === projectId); if (!project || !window.confirm(`למחוק את הפרויקט "${project.name}"?`)) return; await withSaving(async () => { if (cloudEnabled) { await supabase.from('checklists').delete().eq('project_id', projectId); await supabase.from('nonconformances').delete().eq('project_id', projectId); await supabase.from('trial_sections').delete().eq('project_id', projectId); await supabase.from('preliminary_records').delete().eq('project_id', projectId); const result = await supabase.from('projects').delete().eq('id', projectId); if (result.error) throw result.error; await refreshCloudData(); } else { const nextProjects = projects.filter((p) => p.id !== projectId); setProjects(nextProjects.map((p, i) => ({ ...p, isActive: i === 0 }))); setCurrentProjectId(nextProjects[0]?.id ?? null); setSavedChecklists((prev) => prev.filter((x) => x.projectId !== projectId)); setSavedNonconformances((prev) => prev.filter((x) => x.projectId !== projectId)); setSavedTrialSections((prev) => prev.filter((x) => x.projectId !== projectId)); setSavedPreliminary((prev) => prev.filter((x) => x.projectId !== projectId)); } }); };

  const applyChecklistTemplate = (templateKey: ChecklistTemplateKey) => setChecklistForm((prev) => ({ ...createDefaultChecklist(templateKey), location: prev.location, date: prev.date, contractor: prev.contractor, notes: prev.notes, approval: prev.approval }));
  const updateChecklistItem = (id: string, field: keyof ChecklistItem, value: string) => setChecklistForm((prev) => ({ ...prev, items: prev.items.map((item) => item.id === id ? { ...item, [field]: value } : item) }));
  const addChecklistItem = () => setChecklistForm((prev) => ({ ...prev, items: [...prev.items, emptyChecklistItem(crypto.randomUUID())] }));
  const removeChecklistItem = (id: string) => setChecklistForm((prev) => ({ ...prev, items: prev.items.length <= 1 ? prev.items : prev.items.filter((item) => item.id !== id) }));

  const saveChecklist = async () => {
    if (!currentProjectId) return alert('יש לבחור פרויקט');
    if (!checklistForm.title.trim()) return alert('יש להזין שם רשימת תיוג');
    const validation = validateApproval(checklistForm.approval); if (validation) return alert(validation);
    const id = editingChecklistId ?? crypto.randomUUID();
    const record: ChecklistRecord = { id, projectId: currentProjectId, ...checklistForm, items: normalizeChecklistItems(checklistForm.items), approval: normalizeApproval(checklistForm.approval), savedAt: nowLocal() };
    await withSaving(async () => {
      if (cloudEnabled) {
        const payload = { id: record.id, project_id: record.projectId, template_key: record.templateKey, title: record.title, category: record.category, location: record.location, date: record.date, contractor: record.contractor, notes: record.notes, items: record.items, approval: record.approval, saved_at: nowIso() };
        await saveWithApprovalFallback('checklists', payload, editingChecklistId ? 'update' : 'insert', editingChecklistId ?? undefined);
        await refreshCloudData();
      } else {
        setSavedChecklists((prev) => editingChecklistId ? prev.map((item) => item.id === editingChecklistId ? record : item) : [record, ...prev]);
      }
    });
    resetChecklistForm();
  };
  const loadChecklist = (record: ChecklistRecord) => { setSection('checklists'); setEditingChecklistId(record.id); setChecklistForm({ templateKey: record.templateKey, title: record.title, category: record.category, location: record.location, date: record.date, contractor: record.contractor, notes: record.notes, items: normalizeChecklistItems(record.items), approval: normalizeApproval(record.approval) }); };
  const deleteChecklist = async (id: string) => withSaving(async () => cloudEnabled ? (await supabase.from('checklists').delete().eq('id', id), await refreshCloudData()) : setSavedChecklists((prev) => prev.filter((item) => item.id !== id)));

  const saveNonconformance = async () => {
    if (!currentProjectId) return alert('יש לבחור פרויקט');
    if (!nonconformanceForm.title.trim()) return alert('יש להזין כותרת לאי התאמה');
    const validation = validateApproval(nonconformanceForm.approval); if (validation) return alert(validation);
    const id = editingNonconformanceId ?? crypto.randomUUID();
    const record: NonconformanceRecord = { id, projectId: currentProjectId, ...nonconformanceForm, approval: normalizeApproval(nonconformanceForm.approval), savedAt: nowLocal() };
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
    const record: TrialSectionRecord = { id, projectId: currentProjectId, ...trialSectionForm, approval: normalizeApproval(trialSectionForm.approval), savedAt: nowLocal() };
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
    const record: PreliminaryRecord = { id, projectId: currentProjectId, ...form, approval: normalizeApproval(form.approval), savedAt: nowLocal() };
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



  const safeText = (value: unknown) => String(value ?? '').replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char] ?? char));
  const blankCell = (height = 34) => `<div class="blank-cell" style="min-height:${height}px">&nbsp;</div>`;
  const valueOrBlank = (value: unknown, height = 34) => {
    const text = String(value ?? '').trim();
    return text ? safeText(text) : blankCell(height);
  };

  const exportStyles = `
    @page{size:A4 landscape;margin:10mm}
    body{font-family:Arial,sans-serif;direction:rtl;padding:10px;color:#111827;font-size:11px}
    h1{font-size:18px;margin:0 0 8px;text-align:center;font-weight:800}
    h2{font-size:13px;margin:12px 0 6px;text-align:right;font-weight:800}
    table{border-collapse:collapse;width:100%;margin:6px 0;table-layout:fixed}
    th,td{border:1px solid #111827;padding:5px 6px;vertical-align:middle;text-align:center;word-break:break-word;line-height:1.35}
    th{background:#eef3f8;font-weight:800}
    .meta{color:#334155;margin-bottom:8px;text-align:center;font-size:11px}
    .form-title{background:#fff;font-weight:800;font-size:15px;text-align:center}
    .details-table th{width:18%;background:#eef3f8;text-align:center}
    .details-table td{height:26px;text-align:center;background:#fff}
    .items-table th{background:#eef3f8;font-size:10.5px}
    .items-table td{height:28px;background:#fff;font-size:10.5px}
    .num-col{width:34px}.desc-col{width:32%}.resp-col{width:15%}.status-col{width:11%}.date-col{width:11%}.sign-col{width:14%}.notes-col{width:17%}
    .signature td{height:36px;background:#fff}.no-print-note{color:#64748b;font-size:10px;margin-top:6px;text-align:center}
    @media print{button{display:none} body{padding:0}}
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

  const checklistExportHtml = () => {
    const items = normalizeChecklistItems(checklistForm.items);
    return `
    <table class="details-table">
      <tbody>
        <tr><th colspan="2" class="form-title">${safeText(checklistForm.title || checklistTemplateLabel(checklistForm.templateKey))}</th></tr>
        <tr><th>כותרת</th><td>${valueOrBlank(checklistForm.title)}</td></tr>
        <tr><th>קטגוריה</th><td>${valueOrBlank(checklistForm.category)}</td></tr>
        <tr><th>מיקום</th><td>${valueOrBlank(checklistForm.location)}</td></tr>
        <tr><th>תאריך</th><td>${valueOrBlank(checklistForm.date)}</td></tr>
        <tr><th>קבלן</th><td>${valueOrBlank(checklistForm.contractor)}</td></tr>
        <tr><th>הערות</th><td>${valueOrBlank(checklistForm.notes, 60)}</td></tr>
      </tbody>
    </table>
    <h2>סעיפי בדיקה</h2>
    <table class="items-table">
      <thead>
        <tr>
          <th class="num-col">מס׳</th>
          <th class="desc-col">תיאור פעילות הבקרה</th>
          <th class="resp-col">אחראי</th>
          <th class="status-col">סטטוס</th>
          <th class="date-col">תאריך ביצוע</th>
          <th class="sign-col">חתימות</th>
          <th class="notes-col">הערות / ממצאים</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, index) => `<tr><td>${index + 1}</td><td>${valueOrBlank(item.description, 38)}</td><td>${valueOrBlank(item.responsible, 38)}</td><td>${valueOrBlank(item.status, 38)}</td><td>${valueOrBlank(item.executionDate, 38)}</td><td>${valueOrBlank(item.inspector, 38)}</td><td>${valueOrBlank(item.notes, 52)}</td></tr>`).join('')}
      </tbody>
    </table>
    ${signaturesTable(checklistForm.approval)}`;
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

  const trialSectionExportHtml = () => `${baseRows([
    ['שם קטע', trialSectionForm.title],
    ['מיקום', trialSectionForm.location],
    ['תאריך', trialSectionForm.date],
    ['מאושר על ידי', trialSectionForm.approvedBy],
    ['מפרט / דרישות', trialSectionForm.spec, 100],
    ['תוצאה', trialSectionForm.result, 100],
    ['סטטוס', trialSectionForm.status],
    ['הערות', trialSectionForm.notes, 80],
  ])}${attachmentsList((trialSectionForm as any).images)}${signaturesTable(trialSectionForm.approval)}`;

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

  const exportHtml = () => {
    const title = recordTitleForExport();
    const body = section === 'checklists' ? checklistExportHtml()
      : section === 'nonconformances' ? nonconformanceExportHtml()
      : section === 'trialSections' ? trialSectionExportHtml()
      : section === 'preliminary' ? preliminaryRows()
      : '';
    return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"/><title>${safeText(title)}</title><style>${exportStyles}</style></head><body><h1>${safeText(title)}</h1><div class="meta">פרויקט: ${safeText(projectName)} | הופק: ${safeText(nowLocal())}</div>${body}<div class="no-print-note">המסמך נוצר מהמערכת וניתן לעריכה ידנית ב-Word/Excel לאחר ההורדה.</div></body></html>`;
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

  const exportWord = () => downloadTextFile(`${recordTitleForExport()}.doc`, 'application/msword;charset=utf-8', exportHtml());
  const exportExcel = () => downloadTextFile(`${recordTitleForExport()}.xls`, 'application/vnd.ms-excel;charset=utf-8', exportHtml());
  const exportPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('הדפדפן חסם פתיחת חלון להפקת PDF');
    printWindow.document.open();
    printWindow.document.write(exportHtml());
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
