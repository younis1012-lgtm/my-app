import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const normalize = (value: unknown) =>
  String(value ?? "")
    .replace(/[\u05f3`\u2019']/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();

const sameSecret = (left: unknown, right: unknown) => {
  const a = Buffer.from(String(left ?? ""));
  const b = Buffer.from(String(right ?? ""));
  return a.length === b.length && timingSafeEqual(a, b);
};

const stableUserId = (username: string) => {
  const hex = createHash("sha256").update(`yk-quality:${normalize(username)}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const accessRole = (role: unknown) => {
  const value = normalize(role);
  if (value === "admin" || value.includes("מנהל")) return "admin" as const;
  if (value === "readwrite" || value.includes("עריכה")) return "readwrite" as const;
  return "readonly" as const;
};

export async function createLegacySupabaseSession(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return Response.json({ error: "שירות ההתחברות אינו מוגדר" }, { status: 503 });
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return Response.json({ error: "בקשת ההתחברות אינה תקינה" }, { status: 403 });
    const body = await request.json().catch(() => null);
    const login = String(body?.login ?? "").trim();
    const password = String(body?.password ?? "");
    if (!login || !password || login.length > 200 || password.length > 500)
      return Response.json({ error: "שם משתמש או סיסמה אינם נכונים" }, { status: 401 });

    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const accessRows = await db
      .from("project_access_users")
      .select("username,password,display_name,role,code,project_name,project_ids");
    if (accessRows.error) return Response.json({ error: "בדיקת המשתמש נכשלה" }, { status: 503 });
    const loginKey = normalize(login);
    const access = (accessRows.data ?? []).find(
      (row) => [row.username, row.code].some((value) => normalize(value) === loginKey) && sameSecret(row.password, password),
    );
    if (!access) return Response.json({ error: "שם משתמש או סיסמה אינם נכונים" }, { status: 401 });

    let projectIds = Array.isArray(access.project_ids) ? access.project_ids.filter(Boolean) : [];
    const role = accessRole(access.role);
    if (role === "admin") {
      const projects = await db.from("projects").select("id");
      if (projects.error) return Response.json({ error: "טעינת הפרויקטים נכשלה" }, { status: 503 });
      projectIds = (projects.data ?? []).map((project) => project.id);
    }
    if (!projectIds.length)
      return Response.json({ error: "למשתמש לא הוגדר שיוך לפרויקט. מנהל המערכת צריך לשמור את שיוכי המשתמש" }, { status: 409 });

    const userId = stableUserId(access.username);
    const emailHash = createHash("sha256").update(userId).digest("hex").slice(0, 24);
    const email = `legacy-${emailHash}@users.yk-quality.invalid`;
    const authPassword = randomBytes(32).toString("base64url");
    const existing = await db.auth.admin.getUserById(userId);
    const authResult = existing.data.user
      ? await db.auth.admin.updateUserById(userId, { password: authPassword, app_metadata: { legacy_username: access.username }, user_metadata: { name: access.display_name || access.username } })
      : await db.auth.admin.createUser({ id: userId, email, password: authPassword, email_confirm: true, app_metadata: { legacy_username: access.username }, user_metadata: { name: access.display_name || access.username } });
    if (authResult.error) return Response.json({ error: "יצירת ההתחברות המאובטחת נכשלה" }, { status: 503 });

    const memberships = projectIds.map((projectId) => ({ user_id: userId, project_id: projectId, role, active: true }));
    const membershipResult = await db.from("project_members").upsert(memberships, { onConflict: "user_id,project_id" });
    if (membershipResult.error) return Response.json({ error: "עדכון הרשאות הפרויקטים נכשל" }, { status: 503 });
    return Response.json({ email, password: authPassword }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "ההתחברות המאובטחת נכשלה" }, { status: 500 });
  }
}
