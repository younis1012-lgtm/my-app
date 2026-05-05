import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!code) {
    return NextResponse.json({ error: "Missing OAuth code" }, { status: 400 });
  }

  if (!clientId || !clientSecret || !baseUrl) {
    return NextResponse.json(
      { error: "Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET or NEXT_PUBLIC_BASE_URL" },
      { status: 500 },
    );
  }

  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/auth/callback`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    return NextResponse.json(
      { error: "Failed to exchange OAuth code", details: tokenData },
      { status: 500 },
    );
  }

  return NextResponse.json({
    message: "OAuth connected successfully. Copy GOOGLE_REFRESH_TOKEN to Vercel.",
    refresh_token: tokenData.refresh_token ?? "",
    token_type: tokenData.token_type ?? "",
    scope: tokenData.scope ?? "",
    expires_in: tokenData.expires_in ?? "",
  });
}
