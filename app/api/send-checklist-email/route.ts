import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type EmailAttachment = {
  filename: string;
  contentBase64?: string;
  mimeType?: string;
  url?: string;
};

type RequestBody = {
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  senderEmail?: string;
  projectId?: string;
};

const DEFAULT_SENDER_EMAIL = "q.controling@gmail.com";

function base64UrlEncode(input: string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function toBase64Utf8(input: string) {
  return Buffer.from(input || "", "utf8").toString("base64");
}

// ✅ FIXED HERE
function splitBase64(input: string) {
  return String(input || "")
    .replace(/\s/g, "")
    .replace(/(.{76})/g, "$1\n");
}

function encodeMimeWord(value: string) {
  return `=?UTF-8?B?${Buffer.from(value || "attachment", "utf8").toString("base64")}?=`;
}

function filenameStar(value: string) {
  return `UTF-8''${encodeURIComponent(value || "attachment")}`;
}

async function getAccessToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing GOOGLE_CLIENT_ID / SECRET / REFRESH_TOKEN");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.access_token) {
    throw new Error(data?.error_description || "Failed to refresh token");
  }

  return data.access_token as string;
}

async function normalizeAttachment(attachment: EmailAttachment) {
  const filename = attachment.filename || "attachment";
  const mimeType = attachment.mimeType || "application/octet-stream";

  if (attachment.contentBase64) {
    return {
      filename,
      mimeType,
      contentBase64: attachment.contentBase64
        .replace(/^data:[^;]+;base64,/, "")
        .replace(/\s/g, ""),
    };
  }

  if (attachment.url) {
    const res = await fetch(attachment.url);
    const buffer = await res.arrayBuffer();

    return {
      filename,
      mimeType: res.headers.get("content-type") || mimeType,
      contentBase64: Buffer.from(buffer).toString("base64"),
    };
  }

  return null;
}

async function buildRawEmail({
  from,
  to,
  subject,
  text,
  html,
  attachments = [],
}: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}) {
  const boundary = `boundary_${Date.now()}`;

  const normalizedAttachments = (
    await Promise.all(attachments.map(normalizeAttachment))
  ).filter(Boolean) as EmailAttachment[];

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeMimeWord(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];

  const parts: string[] = [];

  // BODY
  parts.push(
    `--${boundary}`,
    `Content-Type: ${html ? "text/html" : "text/plain"}; charset=UTF-8`,
    "Content-Transfer-Encoding: base64",
    "",
    splitBase64(toBase64Utf8(html || text))
  );

  // ATTACHMENTS
  for (const file of normalizedAttachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${file.mimeType}`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${file.filename}"`,
      "",
      splitBase64(file.contentBase64!)
    );
  }

  parts.push(`--${boundary}--`);

  return [...headers, "", ...parts].join("\r\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;

    const accessToken = await getAccessToken();

    const raw = await buildRawEmail({
      from: body.senderEmail || DEFAULT_SENDER_EMAIL,
      to: body.to || DEFAULT_SENDER_EMAIL,
      subject: body.subject || "דוח מערכת",
      text: body.text || "מצורף קובץ",
      html: body.html,
      attachments: body.attachments || [],
    });

    const res = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw: base64UrlEncode(raw),
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(JSON.stringify(data));
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}