import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const maxDuration = 60;

type MailAttachment = {
  filename?: string;
  mimeType?: string;
  contentBase64?: string;
};

type SendEmailBody = {
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  subject?: string;
  text?: string;
  html?: string;
  attachments?: MailAttachment[];
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function base64ToBuffer(value: string) {
  const cleanBase64 = String(value || "")
    .replace(/^data:[^;]+;base64,/i, "")
    .replace(/\s/g, "");

  return Buffer.from(cleanBase64, "base64");
}

function hasRecipient(value: unknown) {
  if (Array.isArray(value)) return value.some(Boolean);
  return Boolean(value);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SendEmailBody;
    const { to, cc, bcc, replyTo, subject, text, html, attachments = [] } = body;

    if (!hasRecipient(to)) throw new Error("Missing recipient email");
    if (!subject) throw new Error("Missing email subject");
    if (!text && !html) throw new Error("Missing email content: send text or html");

    const user = requiredEnv("EMAIL_USER");

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user,
        clientId: requiredEnv("GOOGLE_CLIENT_ID"),
        clientSecret: requiredEnv("GOOGLE_CLIENT_SECRET"),
        refreshToken: requiredEnv("GOOGLE_REFRESH_TOKEN"),
      },
    });

    await transporter.sendMail({
      from: user,
      to,
      cc,
      bcc,
      replyTo,
      subject,
      text,
      html,
      attachments: attachments
        .filter((attachment) => attachment?.contentBase64)
        .map((attachment) => ({
          filename: attachment.filename || "attachment",
          content: base64ToBuffer(attachment.contentBase64 || ""),
          contentType: attachment.mimeType || "application/octet-stream",
        })),
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown email error",
      },
      { status: 500 }
    );
  }
}
