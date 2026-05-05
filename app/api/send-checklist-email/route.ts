import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_SENDER_EMAIL = "q.controling@gmail.com";

// =======================
// 🔐 AUTH
// =======================
async function getAccessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();

  if (!data.access_token) {
    throw new Error("Failed to get access token");
  }

  return data.access_token;
}

// =======================
// 🧾 HTML → PDF
// =======================
async function htmlToPdfBuffer(html: string) {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
  });

  await browser.close();
  return pdf;
}

// =======================
// 📦 BUILD EMAIL
// =======================
function base64UrlEncode(input: string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function splitBase64(input: string) {
  return input.replace(/(.{76})/g, "$1\n");
}

function buildRawEmail({
  from,
  to,
  subject,
  text,
  pdfBase64,
}: {
  from: string;
  to: string;
  subject: string;
  text: string;
  pdfBase64: string;
}) {
  const boundary = "boundary123";

  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary=${boundary}`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    text,
    "",
    `--${boundary}`,
    "Content-Type: application/pdf; name=report.pdf",
    "Content-Transfer-Encoding: base64",
    "Content-Disposition: attachment; filename=report.pdf",
    "",
    splitBase64(pdfBase64),
    "",
    `--${boundary}--`,
  ].join("\r\n");
}

// =======================
// 🚀 API
// =======================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const html = body.html;

    if (!html) {
      return NextResponse.json(
        { error: "Missing HTML" },
        { status: 400 }
      );
    }

    // 🎯 convert to PDF
    const pdfBuffer = await htmlToPdfBuffer(html);

    const rawEmail = buildRawEmail({
      from: DEFAULT_SENDER_EMAIL,
      to: body.to || DEFAULT_SENDER_EMAIL,
      subject: body.subject || "דוח מערכת",
      text: "מצורף דוח PDF",
      pdfBase64: pdfBuffer.toString("base64"),
    });

    const accessToken = await getAccessToken();

    const res = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw: base64UrlEncode(rawEmail),
        }),
      }
    );

    const data = await res.json();

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}