import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const maxDuration = 60;

type EmailAttachment = {
  filename?: string;
  name?: string;
  mimeType?: string;
  contentType?: string;
  contentBase64?: string;
  data?: string;
  dataUrl?: string;
};

type EmailPayload = {
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  senderEmail?: string;
  senderName?: string;
  subject?: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
};

function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => toList(item));
  if (typeof value !== "string") return [];
  return value.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
}

function uniqueList(value: unknown): string[] {
  return Array.from(new Set(toList(value)));
}

function joinEmails(value: unknown): string {
  return uniqueList(value).join(", ");
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function base64Only(value?: string): string {
  if (!value) return "";
  const commaIndex = value.indexOf(",");
  if (value.startsWith("data:") && commaIndex >= 0) return value.slice(commaIndex + 1);
  return value;
}

function normalizeAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw, index) => {
      const item = raw as EmailAttachment;
      const filename = item.filename || item.name || `attachment-${index + 1}.pdf`;
      const contentType = item.mimeType || item.contentType || "application/pdf";
      const content = base64Only(item.contentBase64 || item.data || item.dataUrl);
      if (!content) return null;

      return {
        filename,
        content,
        encoding: "base64" as const,
        contentType,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function formatMailbox(email: string, name?: string) {
  const cleanEmail = email.trim();
  const cleanName = String(name || "").replace(/["<>]/g, "").trim();
  return cleanName ? `"${cleanName}" <${cleanEmail}>` : cleanEmail;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EmailPayload;

    const toItems = uniqueList(body.to);
    const ccItems = uniqueList(body.cc);
    const bccItems = uniqueList(body.bcc);
    const allRecipients = [...toItems, ...ccItems, ...bccItems];

    if (!toItems.length) {
      return NextResponse.json({ success: false, error: "Missing recipient" }, { status: 400 });
    }

    const invalidRecipients = allRecipients.filter((email) => !validEmail(email));
    if (invalidRecipients.length) {
      return NextResponse.json(
        { success: false, error: "Invalid email recipients", invalidRecipients },
        { status: 400 },
      );
    }
    const senderEmail = String(body.senderEmail || body.replyTo || "").trim();
    if (senderEmail && !validEmail(senderEmail)) {
      return NextResponse.json(
        { success: false, error: "Invalid sender email", senderEmail },
        { status: 400 },
      );
    }
    const systemEmail = requireEnv("EMAIL_USER");

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: systemEmail,
        pass: requireEnv("EMAIL_APP_PASSWORD"),
      },
    });

    const attachments = normalizeAttachments(body.attachments);

    const result = await transporter.sendMail({
      from: formatMailbox(systemEmail, body.senderName),
      sender: systemEmail,
      to: joinEmails(toItems),
      cc: ccItems.length ? joinEmails(ccItems) : undefined,
      bcc: bccItems.length ? joinEmails(bccItems) : undefined,
      replyTo: senderEmail || undefined,
      subject: body.subject?.trim() || "Y.K QUALITY document",
      text: body.text?.trim() || "Attached PDF document from Y.K QUALITY.",
      html: body.html?.trim() || '<div dir="rtl">Attached PDF document from Y.K QUALITY.</div>',
      attachments,
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      attachmentCount: attachments.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
