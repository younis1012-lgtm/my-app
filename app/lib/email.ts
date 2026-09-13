export type MailAttachment = { id: string; filename: string; mimeType: string; contentBase64?: string; url?: string };
export type MailContext = {
  projectId: string; module: string; recordId: string; recordIds?: string[]; title: string;
  data: Record<string, unknown>; attachments: MailAttachment[];
  generateDocuments?: () => Promise<MailAttachment[]>;
};
export const MAIL_MAX_BYTES = 20 * 1024 * 1024;
export const MAIL_INLINE_MAX_BYTES = 3 * 1024 * 1024;
export const MAIL_SIGNATURE = '\n\n--\nנשלח באמצעות מערכת RND QUALITY\nהודעה זו נשלחה ממערכת ניהול האיכות של הפרויקט.';
export const mailTemplates = [
  { id: 'document', name: 'שליחת מסמכים', subject: '{{title}} — {{projectName}}', text: 'שלום,\nמצורפים מסמכים עבור {{title}} בפרויקט {{projectName}}.\nבברכה' },
  { id: 'approval', name: 'בקשה לאישור', subject: 'לאישורכם: {{title}}', text: 'שלום,\nנא לבדוק ולאשר את {{title}} בפרויקט {{projectName}}.\nתודה' },
  { id: 'update', name: 'עדכון רשומה', subject: 'עדכון: {{title}}', text: 'שלום,\nעדכון לגבי {{title}} בפרויקט {{projectName}}.\nסטטוס: {{status}}\nמיקום: {{location}}' },
];
export function mergeMailData(template: string, data: Record<string, unknown>) {
  return template.replace(/\{\{([\w.]+)\}\}/g, (original, key: string) => {
    const value = key.split('.').reduce<unknown>((v, k) => v && typeof v === 'object' && Object.hasOwn(v, k) ? (v as Record<string, unknown>)[k] : undefined, data);
    return ['string', 'number', 'boolean'].includes(typeof value) ? String(value) : original;
  });
}
export function mailRecipients(value: unknown): string[] {
  if (Array.isArray(value)) return [...new Set(value.flatMap(mailRecipients))];
  return typeof value === 'string' ? [...new Set(value.split(/[;,\n]/).map(x => x.trim().toLowerCase()).filter(Boolean))] : [];
}
export function validMailAddress(value: string) { return /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(value) && !/[\r\n]/.test(value); }
export function escapeMailHtml(value: string) { return value.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]!)); }
// Shared attachment adapter for nested record structures used throughout the app.
export function collectMailAttachments(record: unknown): MailAttachment[] {
  const result: MailAttachment[] = [], seen = new WeakSet<object>(), sources = new Set<string>();
  function walk(value: unknown) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    const obj = value as Record<string, unknown>;
    const filename = String(obj.filename || obj.fileName || obj.attachmentName || obj.name || obj.title || 'מסמך מצורף');
    const mimeType = String(obj.mimeType || obj.contentType || obj.attachmentType || obj.fileType || obj.type || 'application/octet-stream');
    for (const source of [obj.dataUrl, obj.attachmentDataUrl, obj.fileDataUrl, obj.fileUrl, obj.url, obj.contentBase64 ? `data:${mimeType};base64,${obj.contentBase64}` : null]) {
      if (typeof source !== 'string' || sources.has(source)) continue;
      const match = source.match(/^data:([^;]+);base64,([\s\S]+)$/);
      if (!match && !/^https:\/\//i.test(source)) continue;
      sources.add(source);
      result.push({ id: `record-${result.length}`, filename, mimeType: match?.[1] || mimeType, ...(match ? {contentBase64: match[2]} : {url: source}) });
    }
    for (const [key, child] of Object.entries(obj)) if (!/signature|password|credential/i.test(key)) walk(child);
  }
  walk(record);
  return result;
}
