export type Section = 'home' | 'projects' | 'checklists' | 'nonconformances' | 'trialSections' | 'preliminary';
export type PreliminaryTab = 'suppliers' | 'subcontractors' | 'materials';
export type ChecklistTemplateKey =
  | 'general'
  | 'guardrails'
  | 'aggregateDistribution'
  | 'curbstones'
  | 'standardCompaction'
  | 'catsEyes'
  | 'concreteCasting'
  | 'jkWorks'
  | 'controlledCompaction'
  | 'signage'
  | 'paving'
  | 'steelGuardrailsSupply'
  | 'asphaltWorks'
  | 'drainagePiping';

export type Project = {
  id: string;
  name: string;
  description: string;
  manager: string;
  isActive: boolean;
  createdAt: string;
};

export type ChecklistStatus = 'לא נבדק' | 'תקין' | 'לא תקין';
export type Severity = 'נמוכה' | 'בינונית' | 'גבוהה';
export type RecordStatus = 'טיוטה' | 'מאושר' | 'לא מאושר';
export type TrialStatus = 'טיוטה' | 'אושר' | 'נדחה';
export type NonconformanceStatus = 'פתוח' | 'בטיפול' | 'נסגר';
export type ApprovalDecision = 'draft' | 'approved' | 'rejected';
export type ApprovalSignature = { role: string; signerName: string; signature: string; signedAt: string; required: boolean };
export type ApprovalFlow = { status: ApprovalDecision; remarks: string; signatures: ApprovalSignature[] };
export type ChecklistItem = { id: string; description: string; responsible: string; status: ChecklistStatus; notes: string; inspector: string; executionDate: string };
export type ChecklistRecord = { id: string; projectId: string; templateKey: ChecklistTemplateKey; title: string; category: string; location: string; date: string; contractor: string; notes: string; items: ChecklistItem[]; approval: ApprovalFlow; savedAt: string };
export type NonconformanceRecord = { id: string; projectId: string; title: string; location: string; date: string; raisedBy: string; severity: Severity; status: NonconformanceStatus; description: string; actionRequired: string; notes: string; approval: ApprovalFlow; savedAt: string };
export type TrialSectionRecord = { id: string; projectId: string; title: string; location: string; date: string; spec: string; result: string; approvedBy: string; status: TrialStatus; notes: string; approval: ApprovalFlow; savedAt: string };
export type SupplierPreliminary = { supplierName: string; suppliedMaterial: string; contactPhone: string; approvalNo: string; notes: string };
export type SubcontractorPreliminary = { subcontractorName: string; field: string; contactPhone: string; approvalNo: string; notes: string };
export type MaterialPreliminary = { materialName: string; source: string; usage: string; certificateNo: string; notes: string };
export type PreliminaryRecord = { id: string; projectId: string; subtype: PreliminaryTab; title: string; date: string; status: RecordStatus; supplier?: SupplierPreliminary; subcontractor?: SubcontractorPreliminary; material?: MaterialPreliminary; approval: ApprovalFlow; savedAt: string };
export type PersistedData = { projects: Project[]; currentProjectId: string | null; savedChecklists: ChecklistRecord[]; savedNonconformances: NonconformanceRecord[]; savedTrialSections: TrialSectionRecord[]; savedPreliminary: PreliminaryRecord[] };
export type ChecklistTemplateDefinition = { label: string; title: string; category: string; items: { description: string; responsible: string }[] };
