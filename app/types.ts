// ===== CORE ENUMS & UNIONS =====
export type Section = 'home' | 'projects' | 'checklists' | 'nonconformances' | 'trialSections' | 'preliminary' | 'rfi' | 'supervisionReports';
export type AppSection = Section | 'concentrations' | 'projectDetails' | 'projectUsers' | 'controlProcesses';
export type PreliminaryTab = 'suppliers' | 'subcontractors' | 'materials';
export type ChecklistTemplateKey = 'general' | 'paintWorks' | 'milling' | 'rockWall' | 'excavation' | 'channelPaving' | 'baseCourseSpreading' | 'curbstones' | 'asphaltSite' | 'castCurbstone' | 'catsEyes' | 'siteConcrete' | 'jkWorks' | 'controlledCompaction' | 'standardCompaction' | 'guardrails' | 'signage' | 'waterSystems' | 'paving' | 'steelGuardrailsSupply' | 'asphaltWorks' | 'drainagePiping';
export type ChecklistStatus = 'לא נבדק' | 'תקין' | 'לא תקין' | 'לא רלוונטי';
export type RecordStatus = 'טיוטה' | 'מאושר' | 'לא מאושר';
export type NonconformanceStatus = 'פתוח' | 'בטיפול' | 'נסגר';
export type Severity = 'נמוכה' | 'בינונית' | 'גבוהה';
export type RFIStatus = 'טיוטה' | 'פתוח' | 'נשלח למתכנן' | 'התקבלה התייחסות מתכנן' | 'סגור';
export type ControlProcessStatus = 'טיוטה' | 'בביצוע' | 'ממתין לאישור' | 'מאושר' | 'נדחה' | 'נעול';
export type ChecklistAttachmentKind = 'lab' | 'measurement' | 'other';
export type RequiredDocumentType = 'תעודת מעבדה' | 'רשימת מדידה' | 'צילום' | 'אישור ספק' | 'תוכנית' | 'RFI' | 'אחר';
export type RfiStatus = 'פתוח' | 'ממתין להתייחסות' | 'בטיפול' | 'נענה' | 'סגור';

// ===== CORE DOMAIN TYPES =====
export type Project = { id: string; name: string; description: string; manager: string; isActive: boolean; createdAt: string; };
export type ApprovalSignature = { role: string; signerName: string; signature: string; signedAt: string; required: boolean; };
export type ApprovalFlow = { status: 'draft' | 'approved' | 'rejected'; remarks: string; signatures: ApprovalSignature[]; };

export type StoredAttachment = {
  name: string;
  type: string;
  dataUrl: string;
  uploadedAt: string;
};

export type ChecklistAttachment = StoredAttachment & {
  id: string;
  kind: ChecklistAttachmentKind;
  labResults?: any;
  results?: any;
};

export type ChecklistItem = {
  id: string;
  description: string;
  responsible: string;
  status: string;
  notes: string;
  inspector: string;
  executionDate: string;
  attachments?: ChecklistAttachment[];
  labResults?: any;
  results?: any;
};

export type ChecklistRecord = { id: string; projectId: string; checklistNo?: number; templateKey: ChecklistTemplateKey; title: string; category: string; location: string; date: string; contractor: string; notes: string; items: ChecklistItem[]; approval: ApprovalFlow; savedAt: string; controlProcessId?: string; specSection?: string; workType?: string; };
export type RFIRecord = {
  id: string; projectId: string; rfiNumber: string; subject: string; structure: string; location: string; activity: string; relevantPlans: string; fromSection: string; toSection: string; dateOpened: string; requestedBy: string; description: string; costImpact: string; scheduleImpact: string; designerResponse: string; responseDate: string; closingSummary: string; closedAt: string; status: RFIStatus; images?: StoredAttachment[]; approval: ApprovalFlow; savedAt: string;
};
export type SupervisionReportRecord = {
  id: string; projectId: string; reportNo: string; title: string; date: string; inspector: string; location: string; subject: string; findings: string; instructions: string; status: string; notes: string; images?: StoredAttachment[]; approval: ApprovalFlow; savedAt: string;
};

export type NonconformanceRecord = { id: string; projectId: string; title: string; location: string; date: string; raisedBy: string; severity: Severity | string; status: NonconformanceStatus | string; description: string; actionRequired: string; notes: string; images?: StoredAttachment[]; approval: ApprovalFlow; savedAt: string; controlProcessId?: string; specSection?: string; workType?: string; };
export type TrialSectionRecord = { id: string; projectId: string; title: string; location: string; date: string; spec: string; result: string; approvedBy: string; status: string; notes: string; images?: StoredAttachment[]; approval: ApprovalFlow; savedAt: string; controlProcessId?: string; specSection?: string; workType?: string; };
export type PreliminaryRecord = { id: string; projectId: string; subtype: PreliminaryTab; title: string; date: string; status: string; supplier?: any; subcontractor?: any; material?: any; requiredDocuments?: any[]; certificates?: any[]; approval: ApprovalFlow; savedAt: string; controlProcessId?: string; specSection?: string; workType?: string; [key: string]: any; };
export type PersistedData = { projects: Project[]; currentProjectId: string | null; savedChecklists: ChecklistRecord[]; savedNonconformances: NonconformanceRecord[]; savedTrialSections: TrialSectionRecord[]; savedPreliminary: PreliminaryRecord[]; savedRFIs?: RFIRecord[]; savedSupervisionReports?: SupervisionReportRecord[]; };

// ===== CONTROL PROCESS =====
export type RequiredDocument = {
  id: string;
  type: RequiredDocumentType;
  description: string;
  required: boolean;
  attached: boolean;
  attachmentName?: string;
  attachedAt?: string;
  attachmentDataUrl?: string;
  attachmentType?: string;
  certificateNo?: string;
  expiryDate?: string;
};

export type AuditEntry = {
  action: string;
  by: string;
  at: string;
  note?: string;
};

export type ControlProcessRecord = {
  id: string;
  projectId: string;
  processNo: string;
  title: string;
  workType: string;
  specSection: string;
  location: string;
  fromSection: string;
  toSection: string;
  status: ControlProcessStatus;
  checklistIds: string[];
  rfiIds: string[];
  nonconformanceIds: string[];
  requiredDocuments: RequiredDocument[];
  auditTrail: AuditEntry[];
  approval: ApprovalFlow;
  lockedAt: string;
  savedAt: string;
};

/** @deprecated Use ControlProcessRecord instead */
export type ControlProcess = { id: string; projectId: string; processNo: string; workType: string; specSection: string; location: string; fromChainage?: string; toChainage?: string; checklistIds: string[]; rfiIds: string[]; nonconformanceIds: string[]; requiredDocuments: RequiredDocument[]; status: ControlProcessStatus; createdAt: string; updatedAt: string; };

// ===== RFI (LOCAL / EXTENDED) =====
export type RfiRecord = {
  id: string;
  projectId: string;
  title: string;
  referenceNo: string;
  rfiNumber: number | null;
  status: RfiStatus;
  planNo: string;
  revision: string;
  planName: string;
  buildingDetails: string;
  building: string;
  openDate: string;
  location: string;
  workActivity: string;
  relevantPlans: string;
  fromSection: string;
  toSection: string;
  requestDescription: string;
  budgetImpact: string;
  scheduleImpact: string;
  response: string;
  closeDate: string;
  closedAt: string;
  closedBy: string;
  createdBy: string;
  updatedBy: string;
  updatedAt: string;
  auditTrail: Array<{ action: string; by: string; at: string; note: string }>;
  documents: StoredAttachment[];
  savedAt: string;
};

// ===== PROJECT LEGEND =====
export type ProjectLegend = {
  projectName: string;
  projectManagement: string;
  contractor: string;
  qualityAssurance: string;
  qualityControl: string;
  workManager: string;
  surveyor: string;
  supervisor: string;
  extraFactors: Array<{ id: string; label: string; value: string }>;
};

export type ProjectProfile = {
  projectName: string;
  contractor: string;
  projectManager: string;
  qaCompany: string;
  qualityControl: string;
  workManager: string;
  surveyor: string;
};

// ===== AUTH & ACCESS =====
export type ProjectAccess = {
  username: string;
  password: string;
  displayName: string;
  role: 'admin' | 'user';
  code?: string;
  projectName?: string | null;
  signatureDataUrl?: string;
  signatureFileName?: string;
};

export type StoredAuthSession = {
  username?: string;
  code?: string;
  role?: 'admin' | 'user';
  expiresAt?: number;
};

// ===== EMAIL USERS =====
export type ProjectEmailUser = {
  id: string;
  projectId: string;
  name: string;
  role: string;
  company: string;
  email: string;
  phone?: string;
  active: boolean;
  createdAt: string;
};
