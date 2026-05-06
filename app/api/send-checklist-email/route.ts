import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type EmailAttachment = {
  filename?: string;
  mimeType?: string;
  contentBase64?: string;
  url?: string;
};

const encodeMimeWord = (value: string) =>
  `=?UTF-8?B?${Buffer.from(String(value || ""), "utf8").toString("base64")}?=`;

const normalizeBase64 = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const dataUrlMatch = raw.match(/^data:[^;]+;base64,([\s\S]*)$/);
  return (dataUrlMatch ? dataUrlMatch[1] : raw).replace(/\s/g, "");
};

const splitBase64 = (value: string) => normalizeBase64(value).replace(/(.{76})/g, "$1\r\n");

const base64Url = (value: string) =>
  Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

async function getAccessToken() {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error("Missing Google OAuth environment variables");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Failed to get Gmail access token");
  }
  return String(data.access_token);
}

async function attachmentToMimePart(attachment: EmailAttachment) {
  const filename = String(attachment.filename || "attachment");
  const mimeType = String(attachment.mimeType || "application/octet-stream");
  let contentBase64 = normalizeBase64(attachment.contentBase64);

  if (!contentBase64 && attachment.url && /^https?:\/\//i.test(attachment.url)) {
    const response = await fetch(attachment.url);
    if (!response.ok) throw new Error(`Cannot download attachment: ${filename}`);
    const arrayBuffer = await response.arrayBuffer();
    contentBase64 = Buffer.from(arrayBuffer).toString("base64");
  }

  if (!contentBase64) return "";

  return [
    `Content-Type: ${mimeType}; name="${encodeMimeWord(filename)}"`,
    `Content-Disposition: attachment; filename="${encodeMimeWord(filename)}"`,
    "Content-Transfer-Encoding: base64",
    "",
    splitBase64(contentBase64),
  ].join("\r\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const to = String(body.to || "").trim();
    const subject = String(body.subject || "").trim() || "הודעה מהמערכת";
    const html = String(body.html || body.text || "");
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const from = process.env.EMAIL_USER;

    if (!from) throw new Error("Missing EMAIL_USER environment variable");
    if (!to) throw new Error("Missing recipient email");

    const boundary = `mixed_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const parts: string[] = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${encodeMimeWord(subject)}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      splitBase64(Buffer.from(html || " ", "utf8").toString("base64")),
    ];

    for (const attachment of attachments as EmailAttachment[]) {
      const part = await attachmentToMimePart(attachment);
      if (part) parts.push(`--${boundary}`, part);
    }

    parts.push(`--${boundary}--`, "");

    const accessToken = await getAccessToken();
    const raw = base64Url(parts.join("\r\n"));

    const gmailResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });

    const result = await gmailResponse.json().catch(() => ({}));
    if (!gmailResponse.ok) {
      throw new Error(result?.error?.message || "Gmail send failed");
    }

    return NextResponse.json({ success: true, id: result.id });
  } catch (error: any) {
    console.error("send-email failed", error);
    return NextResponse.json({ success: false, error: error?.message || "Email send failed" }, { status: 500 });
  }
}
