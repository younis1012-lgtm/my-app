export type Section = 'home' | 'projects' | 'checklists' | 'nonconformances' | 'trialSections' | 'preliminary' | 'rfi' | 'supervisionReports';
export type PreliminaryTab = 'suppliers' | 'subcontractors' | 'materials';
export type ChecklistTemplateKey = 'general' | 'paintWorks' | 'milling' | 'rockWall' | 'excavation' | 'channelPaving' | 'baseCourseSpreading' | 'curbstones' | 'asphaltSite' | 'castCurbstone' | 'catsEyes' | 'siteConcrete' | 'jkWorks' | 'controlledCompaction' | 'standardCompaction' | 'guardrails' | 'signage' | 'waterSystems' | 'paving' | 'steelGuardrailsSupply' | 'asphaltWorks' | 'drainagePiping';
export type ChecklistStatus = 'לא נבדק' | 'תקין' | 'לא תקין' | 'לא רלוונטי';
export type RecordStatus = 'טיוטה' | 'מאושר' | 'לא מאושר';
export type NonconformanceStatus = 'פתוח' | 'בטיפול' | 'נסגר';
export type Severity = 'נמוכה' | 'בינונית' | 'גבוהה';

export type Project = { id: string; name: string; description: string; manager: string; isActive: boolean; createdAt: string; };
export type ApprovalSignature = { role: string; signerName: string; signature: string; signedAt: string; required: boolean; };
export type ApprovalFlow = { status: 'draft' | 'approved' | 'rejected'; remarks: string; signatures: ApprovalSignature[]; };

export type ChecklistAttachment = {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
  uploadedAt: string;
  kind: 'lab' | 'measurement' | 'other';
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

export type ChecklistRecord = { id: string; projectId: string; checklistNo?: number; templateKey: ChecklistTemplateKey; title: string; category: string; location: string; date: string; contractor: string; notes: string; items: ChecklistItem[]; approval: ApprovalFlow; savedAt: string; };
export type StoredAttachment = { name: string; type: string; dataUrl: string; uploadedAt: string; };
export type RFIStatus = 'טיוטה' | 'פתוח' | 'נשלח למתכנן' | 'התקבלה התייחסות מתכנן' | 'סגור';
export type RFIRecord = {
  id: string; projectId: string; rfiNumber: string; subject: string; structure: string; location: string; activity: string; relevantPlans: string; fromSection: string; toSection: string; dateOpened: string; requestedBy: string; description: string; costImpact: string; scheduleImpact: string; designerResponse: string; responseDate: string; closingSummary: string; closedAt: string; status: RFIStatus; images?: StoredAttachment[]; approval: ApprovalFlow; savedAt: string;
};
export type SupervisionReportRecord = {
  id: string; projectId: string; reportNo: string; title: string; date: string; inspector: string; location: string; subject: string; findings: string; instructions: string; status: string; notes: string; images?: StoredAttachment[]; approval: ApprovalFlow; savedAt: string;
};

export type NonconformanceRecord = { id: string; projectId: string; title: string; location: string; date: string; raisedBy: string; severity: Severity | string; status: NonconformanceStatus | string; description: string; actionRequired: string; notes: string; images?: StoredAttachment[]; approval: ApprovalFlow; savedAt: string; };
export type TrialSectionRecord = { id: string; projectId: string; title: string; location: string; date: string; spec: string; result: string; approvedBy: string; status: string; notes: string; images?: StoredAttachment[]; approval: ApprovalFlow; savedAt: string; };
export type PreliminaryRecord = { id: string; projectId: string; subtype: PreliminaryTab; title: string; date: string; status: string; supplier?: any; subcontractor?: any; material?: any; approval: ApprovalFlow; savedAt: string; };
export type PersistedData = { projects: Project[]; currentProjectId: string | null; savedChecklists: ChecklistRecord[]; savedNonconformances: NonconformanceRecord[]; savedTrialSections: TrialSectionRecord[]; savedPreliminary: PreliminaryRecord[]; savedRFIs?: RFIRecord[]; savedSupervisionReports?: SupervisionReportRecord[]; };
