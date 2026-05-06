import { NextRequest, NextResponse } from "next/server";

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

function normalizeRecipients(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean).join(", ");
  }
  return String(value || "").trim();
}

function encodeMimeWord(value: string) {
  return `=?UTF-8?B?${Buffer.from(String(value || ""), "utf8").toString("base64")}?=`;
}

function stripDataUrl(value: string) {
  return String(value || "").replace(/^data:[^;]+;base64,/i, "").replace(/\s/g, "");
}

function foldBase64(value: string) {
  return stripDataUrl(value).replace(/(.{76})/g, "$1\r\n");
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function textPart(contentType: string, content: string) {
  return [
    `Content-Type: ${contentType}; charset=UTF-8`,
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(String(content || ""), "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
  ].join("\r\n");
}

async function getGoogleAccessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      refresh_token: requiredEnv("GOOGLE_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) {
    throw new Error(result?.error_description || result?.error || "Failed to get Google access token");
  }

  return String(result.access_token);
}

function buildRawEmail(body: SendEmailBody, from: string) {
  const to = normalizeRecipients(body.to);
  const cc = normalizeRecipients(body.cc);
  const bcc = normalizeRecipients(body.bcc);
  const replyTo = normalizeRecipients(body.replyTo);
  const subject = String(body.subject || "").trim();
  const attachments = (body.attachments || []).filter((attachment) => attachment?.contentBase64);

  if (!to) throw new Error("Missing recipient email");
  if (!subject) throw new Error("Missing email subject");
  if (!body.text && !body.html) throw new Error("Missing email content: send text or html");

  const mixedBoundary = `mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const altBoundary = `alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    cc ? `Cc: ${cc}` : "",
    bcc ? `Bcc: ${bcc}` : "",
    replyTo ? `Reply-To: ${replyTo}` : "",
    `Subject: ${encodeMimeWord(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
  ].filter(Boolean);

  const parts: string[] = [];

  parts.push(`--${mixedBoundary}`);
  if (body.text && body.html) {
    parts.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    parts.push("");
    parts.push(`--${altBoundary}`);
    parts.push(textPart("text/plain", body.text));
    parts.push(`--${altBoundary}`);
    parts.push(textPart("text/html", body.html));
    parts.push(`--${altBoundary}--`);
  } else if (body.html) {
    parts.push(textPart("text/html", body.html));
  } else {
    parts.push(textPart("text/plain", body.text || ""));
  }

  for (const attachment of attachments) {
    const filename = attachment.filename || "attachment";
    const mimeType = attachment.mimeType || "application/octet-stream";
    parts.push(`--${mixedBoundary}`);
    parts.push(`Content-Type: ${mimeType}; name="${encodeMimeWord(filename)}"`);
    parts.push(`Content-Disposition: attachment; filename="${encodeMimeWord(filename)}"`);
    parts.push("Content-Transfer-Encoding: base64");
    parts.push("");
    parts.push(foldBase64(attachment.contentBase64 || ""));
  }

  parts.push(`--${mixedBoundary}--`);
  return `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SendEmailBody;
    const from = requiredEnv("EMAIL_USER");
    const accessToken = await getGoogleAccessToken();
    const raw = buildRawEmail(body, from);

    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: base64Url(raw) }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.error?.message || result?.error_description || "Gmail send failed");
    }

    return NextResponse.json({ success: true, id: result.id });
  } catch (error: unknown) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown email error" },
      { status: 500 },
    );
  }
}
