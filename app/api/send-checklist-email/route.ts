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

function splitBase64(input: string) {
  return String(input || "")
    .replace(/\s/g, "")
    .replace(/(.{76})/g, "$1\r\n");
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
    throw new Error("Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET or GOOGLE_REFRESH_TOKEN");
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
    throw new Error(data?.error_description || data?.error || "Failed to refresh Gmail access token");
  }

  return data.access_token as string;
}

async function normalizeAttachment(attachment: EmailAttachment) {
  const filename = String(attachment.filename || "attachment").trim() || "attachment";
  const mimeType = String(attachment.mimeType || "application/octet-stream").trim() || "application/octet-stream";

  if (attachment.contentBase64) {
    const contentBase64 = String(attachment.contentBase64)
      .replace(/^data:[^;]+;base64,/, "")
      .replace(/\s/g, "");
    return contentBase64 ? { filename, mimeType, contentBase64 } : null;
  }

  if (attachment.url && /^https?:\/\//i.test(attachment.url)) {
    const res = await fetch(attachment.url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return {
      filename,
      mimeType: res.headers.get("content-type") || mimeType,
      contentBase64: Buffer.from(arrayBuffer).toString("base64"),
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
  const boundary = `boundary_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const normalizedAttachments = (await Promise.all(attachments.map(normalizeAttachment))).filter(Boolean) as Array<{
    filename: string;
    mimeType: string;
    contentBase64: string;
  }>;

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeMimeWord(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];

  const bodyParts: string[] = [];

  bodyParts.push(
    `--${boundary}`,
    `Content-Type: ${html ? "text/html" : "text/plain"}; charset="UTF-8"`,
    "Content-Transfer-Encoding: base64",
    "",
    splitBase64(Buffer.from(html || text || "", "utf8").toString("base64")),
  );

  for (const attachment of normalizedAttachments) {
    bodyParts.push(
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}; name="${encodeMimeWord(attachment.filename)}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${encodeMimeWord(attachment.filename)}"; filename*=${filenameStar(attachment.filename)}`,
      "",
      splitBase64(attachment.contentBase64),
    );
  }

  bodyParts.push(`--${boundary}--`);

  return [...headers, "", ...bodyParts].join("\r\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;
    const accessToken = await getAccessToken();

    const rawEmail = await buildRawEmail({
      from: body.senderEmail || process.env.EMAIL_USER || DEFAULT_SENDER_EMAIL,
      to: body.to || DEFAULT_SENDER_EMAIL,
      subject: body.subject || "מסמך ממערכת בקרת איכות",
      text: body.text || "מצורף מסמך מהמערכת.",
      html: body.html,
      attachments: body.attachments ?? [],
    });

    const gmailResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: base64UrlEncode(rawEmail) }),
    });

    const result = await gmailResponse.json();

    if (!gmailResponse.ok) {
      return NextResponse.json({ error: "Gmail send failed", details: result }, { status: 500 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to send email" }, { status: 500 });
  }
}
