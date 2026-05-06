import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const maxDuration = 60;

function splitBase64(input: string) {
  return String(input || "")
    .replace(/\s/g, "")
    .replace(/(.{76})/g, "$1\n");
}

function encodeMimeWord(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      to,
      subject,
      html,
      attachments = [],
    } = body;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.EMAIL_USER,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
      },
    });

    const boundary = "boundary_" + Date.now();

    let rawMessage = `
From: ${process.env.EMAIL_USER}
To: ${to}
Subject: ${encodeMimeWord(subject)}
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="${boundary}"

--${boundary}
Content-Type: text/html; charset=UTF-8
Content-Transfer-Encoding: 7bit

${html}
`;

    for (const attachment of attachments) {
      rawMessage += `
--${boundary}
Content-Type: ${attachment.mimeType}; name="${encodeMimeWord(
        attachment.filename
      )}"
Content-Disposition: attachment; filename="${encodeMimeWord(
        attachment.filename
      )}"
Content-Transfer-Encoding: base64

${splitBase64(attachment.contentBase64)}
`;
    }

    rawMessage += `
--${boundary}--
`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      raw: rawMessage,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}