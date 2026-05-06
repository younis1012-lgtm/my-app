import { useState } from "react";
import type { ChecklistItem, ChecklistRecord, ChecklistAttachment } from '../types';
import { checklistTemplates } from '../checklistTemplates';
import { ApprovalPanel, Field, FormModeBanner, styles } from './common';
import LabCertificateScanButton from './LabCertificateScanButton';
import type { LabCertificateResults } from '../lib/labCertificateParser';

type ChecklistsSectionProps = {
  guardedBody: React.ReactNode;
  editingChecklistId: string | null;
  checklistForm: Omit<ChecklistRecord, 'id' | 'projectId' | 'savedAt'>;
  setChecklistForm: React.Dispatch<React.SetStateAction<Omit<ChecklistRecord, 'id' | 'projectId' | 'savedAt'>>>;
  checklistTemplateLabel: (value: any) => string;
  applyChecklistTemplate: (templateKey: any) => void;
  updateChecklistItem: (id: string, field: keyof ChecklistItem, value: string) => void;
  addChecklistItem: () => void;
  removeChecklistItem: (id: string) => void;
  saveChecklist: () => void;
  resetChecklistForm: () => void;
};

const attachmentLabel = (attachment: ChecklistAttachment) => {
  if (attachment.labResults?.certificateNo) return `${attachment.name} · תעודה ${attachment.labResults.certificateNo}`;
  return attachment.name;
};

export function ChecklistsSection(props: ChecklistsSectionProps) {
  const [emailSending, setEmailSending] = useState(false);

  const escapeHtml = (value: unknown) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const buildChecklistPdfHtml = () => {
    const checklist = props.checklistForm;
    const rows = (checklist.items || [])
      .map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.description)}</td>
          <td>${escapeHtml(item.responsible)}</td>
          <td>${escapeHtml(item.inspector)}</td>
          <td>${escapeHtml(item.executionDate)}</td>
          <td>${escapeHtml(item.status)}</td>
          <td>${escapeHtml(item.notes)}</td>
        </tr>
      `)
      .join("");

    const attachments = (checklist.items || [])
      .flatMap((item) => item.attachments || [])
      .map((attachment) => `<li>${escapeHtml(attachment.name)}</li>`)
      .join("");

    return `
      <div dir="rtl" style="font-family: Arial, sans-serif; color:#0f172a; padding: 24px;">
        <h1 style="text-align:center; margin:0 0 18px; font-size:24px;">רשימת תיוג</h1>
        <table style="width:100%; border-collapse:collapse; margin-bottom:18px; font-size:12px;">
          <tbody>
            <tr><td style="border:1px solid #94a3b8; padding:8px; font-weight:bold;">שם רשימה</td><td style="border:1px solid #94a3b8; padding:8px;">${escapeHtml(checklist.title)}</td><td style="border:1px solid #94a3b8; padding:8px; font-weight:bold;">קטגוריה</td><td style="border:1px solid #94a3b8; padding:8px;">${escapeHtml(checklist.category)}</td></tr>
            <tr><td style="border:1px solid #94a3b8; padding:8px; font-weight:bold;">מיקום</td><td style="border:1px solid #94a3b8; padding:8px;">${escapeHtml(checklist.location)}</td><td style="border:1px solid #94a3b8; padding:8px; font-weight:bold;">תאריך</td><td style="border:1px solid #94a3b8; padding:8px;">${escapeHtml(checklist.date)}</td></tr>
            <tr><td style="border:1px solid #94a3b8; padding:8px; font-weight:bold;">קבלן מבצע</td><td style="border:1px solid #94a3b8; padding:8px;" colspan="3">${escapeHtml(checklist.contractor)}</td></tr>
            <tr><td style="border:1px solid #94a3b8; padding:8px; font-weight:bold;">הערות</td><td style="border:1px solid #94a3b8; padding:8px;" colspan="3">${escapeHtml(checklist.notes)}</td></tr>
          </tbody>
        </table>
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead><tr style="background:#e2e8f0;"><th style="border:1px solid #64748b; padding:6px;">#</th><th style="border:1px solid #64748b; padding:6px;">תיאור</th><th style="border:1px solid #64748b; padding:6px;">אחראי</th><th style="border:1px solid #64748b; padding:6px;">שם בודק</th><th style="border:1px solid #64748b; padding:6px;">תאריך ביצוע</th><th style="border:1px solid #64748b; padding:6px;">סטטוס</th><th style="border:1px solid #64748b; padding:6px;">הערות</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="7" style="border:1px solid #64748b; padding:10px; text-align:center;">אין סעיפים</td></tr>`}</tbody>
        </table>
        <h2 style="font-size:16px; margin:18px 0 8px;">מסמכים מצורפים</h2>
        <ul style="font-size:12px; line-height:1.8;">${attachments || "<li>אין מסמכים מצורפים</li>"}</ul>
      </div>
    `;
  };

  const sendChecklistPdfEmail = async () => {
    const to = window.prompt("לאיזה מייל לשלוח את רשימת התיוג כ-PDF?");
    if (!to) return;

    setEmailSending(true);
    try {
      const html = buildChecklistPdfHtml();
      // @ts-ignore - html2pdf.js has no built-in TypeScript types in this project
      const html2pdfModule = await import("html2pdf.js");
      const html2pdf = html2pdfModule.default || html2pdfModule;

      const container = document.createElement("div");
      container.innerHTML = html;
      container.style.position = "fixed";
      container.style.left = "-10000px";
      container.style.top = "0";
      container.style.width = "794px";
      document.body.appendChild(container);

      const pdfBlob: Blob = await html2pdf()
        .from(container)
        .set({
          margin: 8,
          filename: "checklist.pdf",
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        })
        .outputPdf("blob");

      container.remove();
      const pdfDataUrl = await blobToDataUrl(pdfBlob);

      const uploadedAttachments = (props.checklistForm.items || [])
        .flatMap((item) => item.attachments || [])
        .filter((attachment) => Boolean(attachment.dataUrl))
        .map((attachment) => ({
          filename: attachment.name || "attachment",
          mimeType: attachment.type || "application/octet-stream",
          contentBase64: attachment.dataUrl,
        }));

      const attachments = [
        { filename: `${props.checklistForm.title || "checklist"}.pdf`, mimeType: "application/pdf", contentBase64: pdfDataUrl },
        ...uploadedAttachments,
      ];

      const response = await fetch("/api/send-checklist-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject: `${props.checklistForm.title || "רשימת תיוג"} - PDF`,
          text: "מצורפת רשימת תיוג בפורמט PDF ובצירוף המסמכים שהועלו למערכת.",
          attachments,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result?.error || "שליחת המייל נכשלה");
      alert("המייל נשלח בהצלחה עם קובץ PDF ומסמכים מצורפים ✅");
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "שגיאה בשליחת המייל");
    } finally {
      setEmailSending(false);
    }
  };

  const updateItemAttachments = (itemId: string, attachments: ChecklistAttachment[]) => {
    props.setChecklistForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId ? { ...item, attachments } : item)),
    }));
  };

  const saveLabResultsToItem = (
    item: ChecklistItem,
    results: LabCertificateResults,
    fileInfo?: { name: string; type: string; dataUrl: string; uploadedAt: string }
  ) => {
    const existing = Array.isArray(item.attachments) ? item.attachments : [];
    const fileName = fileInfo?.name || results.certificateNo || 'תעודת מעבדה';
    const uploadedAt = fileInfo?.uploadedAt || new Date().toLocaleString('he-IL');

    const labAttachment: ChecklistAttachment = {
      id: existing.find((attachment) => attachment.kind === 'lab' && attachment.name === fileName)?.id || crypto.randomUUID(),
      name: fileName,
      type: fileInfo?.type || 'application/pdf',
      dataUrl: fileInfo?.dataUrl || existing.find((attachment) => attachment.kind === 'lab' && attachment.name === fileName)?.dataUrl || '',
      uploadedAt,
      kind: 'lab',
      labResults: results,
    };

    const withoutSameLab = existing.filter(
      (attachment) => !(attachment.kind === 'lab' && attachment.name === labAttachment.name)
    );

    updateItemAttachments(item.id, [...withoutSameLab, labAttachment]);
  };

  const removeAttachment = (item: ChecklistItem, attachmentId: string) => {
    updateItemAttachments(
      item.id,
      (item.attachments ?? []).filter((attachment) => attachment.id !== attachmentId)
    );
  };

  return (
    <div>
      <h2 style={styles.sectionTitle}>רשימות תיוג</h2>
      {props.guardedBody || (
        <>
          <FormModeBanner isEditing={Boolean(props.editingChecklistId)} />

          <div style={{ ...styles.rowCard }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>בחירת תבנית</div>
            <div style={styles.chipRow}>
              {Object.keys(checklistTemplates).map((templateKey) => (
                <button
                  key={templateKey}
                  type="button"
                  style={{
                    ...styles.chip,
                    background: props.checklistForm.templateKey === templateKey ? '#0f172a' : '#fff',
                    color: props.checklistForm.templateKey === templateKey ? '#fff' : '#0f172a',
                  }}
                  onClick={() => props.applyChecklistTemplate(templateKey)}
                >
                  {checklistTemplates[templateKey as keyof typeof checklistTemplates].label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.formGrid}>
            <Field label="תבנית">
              <input readOnly style={{ ...styles.input, background: '#f8fafc' }} value={props.checklistTemplateLabel(props.checklistForm.templateKey)} />
            </Field>
            <Field label="שם רשימה">
              <input style={styles.input} value={props.checklistForm.title} onChange={(e) => props.setChecklistForm((prev) => ({ ...prev, title: e.target.value }))} />
            </Field>
            <Field label="קטגוריה">
              <input style={styles.input} value={props.checklistForm.category} onChange={(e) => props.setChecklistForm((prev) => ({ ...prev, category: e.target.value }))} />
            </Field>
            <Field label="מיקום">
              <input style={styles.input} value={props.checklistForm.location} onChange={(e) => props.setChecklistForm((prev) => ({ ...prev, location: e.target.value }))} />
            </Field>
            <Field label="תאריך">
              <input type="date" style={styles.input} value={props.checklistForm.date} onChange={(e) => props.setChecklistForm((prev) => ({ ...prev, date: e.target.value }))} />
            </Field>
            <Field label="קבלן מבצע">
              <input style={styles.input} value={props.checklistForm.contractor} onChange={(e) => props.setChecklistForm((prev) => ({ ...prev, contractor: e.target.value }))} />
            </Field>
            <Field label="הערות" full>
              <textarea style={styles.textarea} value={props.checklistForm.notes} onChange={(e) => props.setChecklistForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </Field>
          </div>

          <div style={styles.subHeader}>סעיפי בקרה</div>

          {props.checklistForm.items.map((item, index) => {
            const labAttachments = (item.attachments ?? []).filter((attachment) => attachment.kind === 'lab');
            const latestLab = labAttachments[labAttachments.length - 1];

            return (
              <div key={item.id} style={styles.rowCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontWeight: 800 }}>שורה {index + 1}</div>
                  <button type="button" style={styles.dangerBtn} onClick={() => props.removeChecklistItem(item.id)}>מחק שורה</button>
                </div>

                <div style={styles.formGrid}>
                  <Field label="תיאור">
                    <input style={styles.input} value={item.description} onChange={(e) => props.updateChecklistItem(item.id, 'description', e.target.value)} />
                  </Field>
                  <Field label="אחראי">
                    <input style={styles.input} value={item.responsible} onChange={(e) => props.updateChecklistItem(item.id, 'responsible', e.target.value)} />
                  </Field>
                  <Field label="סטטוס">
                    <select style={styles.input} value={item.status} onChange={(e) => props.updateChecklistItem(item.id, 'status', e.target.value)}>
                      <option value="לא נבדק">לא נבדק</option>
                      <option value="תקין">תקין</option>
                      <option value="לא תקין">לא תקין</option>
                      <option value="לא רלוונטי">לא רלוונטי</option>
                    </select>
                  </Field>
                  <Field label="שם בודק">
                    <input style={styles.input} value={item.inspector} onChange={(e) => props.updateChecklistItem(item.id, 'inspector', e.target.value)} />
                  </Field>
                  <Field label="תאריך ביצוע">
                    <input type="date" style={styles.input} value={item.executionDate} onChange={(e) => props.updateChecklistItem(item.id, 'executionDate', e.target.value)} />
                  </Field>
                  <Field label="הערות" full>
                    <input style={styles.input} value={item.notes} onChange={(e) => props.updateChecklistItem(item.id, 'notes', e.target.value)} />
                  </Field>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    border: '1px dashed #94a3b8',
                    borderRadius: 14,
                    padding: 12,
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 900 }}>
                      מסמך נדרש: תעודת מעבדה
                      {latestLab?.labResults ? <span style={{ color: '#166534', marginRight: 8 }}>✓ נסרק ונשמר לריכוזים</span> : null}
                    </div>

                    <LabCertificateScanButton
                      attachmentName={latestLab?.name || item.description || 'תעודת מעבדה'}
                      existingDataUrl={latestLab?.dataUrl}
                      initialResults={latestLab?.labResults}
                      onSave={(results, fileInfo) => saveLabResultsToItem(item, results, fileInfo)}
                    />
                  </div>

                  <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                    {labAttachments.length ? (
                      labAttachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 10,
                            border: '1px solid #e2e8f0',
                            borderRadius: 10,
                            padding: '7px 10px',
                            background: '#f8fafc',
                          }}
                        >
                          <span style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {attachment.labResults ? '✅' : '📎'} {attachmentLabel(attachment)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(item, attachment.id)}
                            style={{ border: 0, background: 'transparent', color: '#b91c1c', fontWeight: 900, cursor: 'pointer' }}
                          >
                            מחיקה
                          </button>
                        </div>
                      ))
                    ) : (
                      <span style={{ color: '#64748b' }}>טרם צורפה תעודת מעבדה</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <ApprovalPanel value={props.checklistForm.approval} onChange={(approval) => props.setChecklistForm((prev) => ({ ...prev, approval }))} />

          <div style={styles.buttonRow}>
            <button type="button" style={styles.secondaryBtn} onClick={props.addChecklistItem}>הוסף שורה</button>
            <button type="button" style={styles.primaryBtn} disabled={emailSending} onClick={sendChecklistPdfEmail}>{emailSending ? 'שולח PDF...' : 'שלח PDF במייל'}</button>
            <button type="button" style={styles.primaryBtn} onClick={props.saveChecklist}>{props.editingChecklistId ? 'עדכן רשימה' : 'שמור רשימה'}</button>
            <button type="button" style={styles.secondaryBtn} onClick={props.resetChecklistForm}>בטל / נקה</button>
          </div>
        </>
      )}
    </div>
  );
}
