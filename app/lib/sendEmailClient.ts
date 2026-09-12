import { supabase } from '../../lib/supabaseClient';

export type EmailAttachment = {
  filename: string;
  mimeType: string;
  contentBase64: string;
};

export type SendEmailPayload = {
  projectId: string;
  module: string;
  recordId: string;
  requestId: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  senderEmail?: string;
  senderName?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
};

export async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function sendEmail(payload: SendEmailPayload) {
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error('יש להתחבר באמצעות חשבון Supabase');
  const response = await fetch("/api/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...payload, attachments: payload.attachments || [] }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result?.error || "שליחת המייל נכשלה");
  }

  return result as { success: true; status: 'sent' | 'partial'; messageId: string; rejected: string[]; warning?: string };
}
