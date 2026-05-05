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

async function resolveAttachments(attachments: EmailAttachment[] = []): Promise<EmailAttachment[]> {
  const resolved: EmailAttachment[] = [];

  for (const attachment of attachments) {
    const filename = attachment.filename || "attachment";
    const mimeType = attachment.mimeType || "application/octet-stream";

    if (attachment.contentBase64) {
      resolved.push({
        filename,
        mimeType,
        contentBase64: String(attachment.contentBase64)
          .replace(/^data:[^;]+;base64,/, "")
          .replace(/\s/g, ""),
      });
      continue;
    }

    if (attachment.url && /^https?:\/\//i.test(attachment.url)) {
      const fileResponse = await fetch(attachment.url);
      if (!fileResponse.ok) continue;
      const arrayBuffer = await fileResponse.arrayBuffer();
      resolved.push({
        filename,
        mimeType:
          attachment.mimeType ||
          fileResponse.headers.get("content-type") ||
          "application/octet-stream",
        contentBase64: Buffer.from(arrayBuffer).toString("base64"),
      });
    }
  }

  return resolved;
}

function buildRawEmail({
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

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];

  const bodyParts: string[] = [];

  bodyParts.push(
    `--${boundary}`,
    `Content-Type: ${html ? "text/html" : "text/plain"}; charset="UTF-8"`,
    "Content-Transfer-Encoding: 7bit",
    "",
    html || text || "",
  );

  for (const attachment of attachments) {
    const mimeType = attachment.mimeType || "application/octet-stream";
    const filename = attachment.filename || "attachment";
    const cleanBase64 = String(attachment.contentBase64 || "")
      .replace(/^data:[^;]+;base64,/, "")
      .replace(/\s/g, "");

    if (!cleanBase64) continue;

    bodyParts.push(
      `--${boundary}`,
      `Content-Type: ${mimeType}; name="${filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${filename}"`,
      "",
      cleanBase64,
    );
  }

  bodyParts.push(`--${boundary}--`);

  return [...headers, "", ...bodyParts].join("\r\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;

    const to = body.to || DEFAULT_SENDER_EMAIL;
    const from = body.senderEmail || process.env.EMAIL_USER || DEFAULT_SENDER_EMAIL;
    const subject = body.subject || "מסמך ממערכת בקרת איכות";
    const text = body.text || "מצורף מסמך מהמערכת.";
    const html = body.html;

    const accessToken = await getAccessToken();
    const attachments = await resolveAttachments(body.attachments ?? []);

    const rawEmail = buildRawEmail({
      from,
      to,
      subject,
      text,
      html,
      attachments,
    });

    const gmailResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: base64UrlEncode(rawEmail) }),
      },
    );

    const result = await gmailResponse.json();

    if (!gmailResponse.ok) {
      return NextResponse.json(
        { error: "Gmail send failed", details: result },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to send email" },
      { status: 500 },
    );
  }
}
