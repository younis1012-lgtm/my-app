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
  senderAppPassword?: string;
  senderName?: string;
  subject?: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
};

const SYSTEM_SIGNATURE_TEXT =
  "\n\n--\nנשלח באמצעות מערכת RND QUALITY\nהודעה זו נשלחה ממערכת ניהול האיכות של הפרויקט.";

const SYSTEM_SIGNATURE_HTML = `
<div dir="rtl" style="margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;color:#64748b;font-family:Arial,sans-serif;font-size:13px;line-height:1.6">
  <strong style="color:#0f172a">נשלח באמצעות מערכת RND QUALITY</strong><br />
  הודעה זו נשלחה ממערכת ניהול האיכות של הפרויקט.
</div>`;

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

function withSystemSignatureText(value?: string) {
  const content = value?.trim() || "Attached PDF document from RND QUALITY.";
  return content.includes("נשלח באמצעות מערכת RND QUALITY")
    ? content
    : `${content}${SYSTEM_SIGNATURE_TEXT}`;
}

function withSystemSignatureHtml(value?: string) {
  const content = value?.trim() || '<div dir="rtl">Attached PDF document from RND QUALITY.</div>';
  return content.includes("נשלח באמצעות מערכת RND QUALITY")
    ? content
    : `${content}${SYSTEM_SIGNATURE_HTML}`;
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
    if (!senderEmail) {
      return NextResponse.json(
        { success: false, error: "Missing quality controller sender email" },
        { status: 400 },
      );
    }
    if (!validEmail(senderEmail)) {
      return NextResponse.json(
        { success: false, error: "Invalid sender email", senderEmail },
        { status: 400 },
      );
    }
    const senderAppPassword = String(body.senderAppPassword || "").trim();
    if (!senderAppPassword) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing Gmail app password for the project quality controller. Configure it under project users.",
        },
        { status: 400 },
      );
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: senderEmail,
        pass: senderAppPassword,
      },
    });

    const attachments = normalizeAttachments(body.attachments);

    const result = await transporter.sendMail({
      from: formatMailbox(senderEmail, String(body.senderName || "").trim() || "Quality Controller"),
      sender: senderEmail,
      to: joinEmails(toItems),
      cc: ccItems.length ? joinEmails(ccItems) : undefined,
      bcc: bccItems.length ? joinEmails(bccItems) : undefined,
      replyTo: senderEmail || undefined,
      subject: body.subject?.trim() || "RND QUALITY document",
      text: withSystemSignatureText(body.text),
      html: withSystemSignatureHtml(body.html),
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
