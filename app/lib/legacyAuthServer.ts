import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { hashPassword, isHashedPassword, publicAccessRow, verifyPassword } from "./accessUsersServer";

const normalize = (value: unknown) =>
  String(value ?? "")
    .replace(/[\u05f3`\u2019']/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();

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
      .select("*");
    if (accessRows.error) return Response.json({ error: "בדיקת המשתמש נכשלה" }, { status: 503 });
    const loginKey = normalize(login);
    const rows = accessRows.data ?? [];
    // שם משתמש אישי קודם לקוד פרויקט: קוד הפרויקט משותף לכל משתמשי הפרויקט,
    // ולכן התחברות לפיו עלולה לשייך את המשתמש לשורה של משתמש אחר (למשל "צופה").
    const byUsername = rows.find((row) => normalize(row.username) === loginKey && verifyPassword(row.password, password));
    const byCode = byUsername
      ? []
      : rows.filter((row) => normalize(row.code) === loginKey && verifyPassword(row.password, password));
    // כניסת מנהל המערכת בכתובת המייל שלו
    const byAdminEmail =
      !byUsername && !byCode.length && loginKey === "younis1012@gmail.com"
        ? rows.filter((row) => accessRole(row.role) === "admin" && verifyPassword(row.password, password))
        : [];
    if (!byUsername && byCode.length > 1)
      return Response.json({ error: "קוד הפרויקט משותף לכמה משתמשים. יש להתחבר עם שם המשתמש האישי והסיסמה" }, { status: 409 });
    const access = byUsername ?? byCode[0] ?? byAdminEmail[0];
    if (!access) return Response.json({ error: "שם משתמש או סיסמה אינם נכונים" }, { status: 401 });
    // סיסמה ישנה שנשמרה כטקסט גלוי – מוצפנת עכשיו, בהתחברות המוצלחת
    if (!isHashedPassword(access.password)) {
      await db.from("project_access_users").update({ password: hashPassword(password) }).eq("username", access.username);
    }

    const role = accessRole(access.role);
    const resolved = await resolveAccessProjectIds(db, access, role);
    if (resolved.error) return Response.json({ error: "טעינת הפרויקטים נכשלה" }, { status: 503 });
    const projectIds = resolved.projectIds;
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
    return Response.json({ email, password: authPassword, profile: publicAccessRow(access) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "ההתחברות המאובטחת נכשלה" }, { status: 500 });
  }
}

type AccessRow = Record<string, any>;

// שיוך הפרויקטים של משתמש מטבלת project_access_users (אותו חישוב כמו בהתחברות).
async function resolveAccessProjectIds(db: any, access: AccessRow, role: ReturnType<typeof accessRole>, projectsCache?: any[]) {
  let projectIds: string[] = Array.isArray(access.project_ids)
    ? access.project_ids.filter(Boolean)
    : access.project_id
      ? [access.project_id]
      : [];
  if (role === "admin" || !projectIds.length) {
    let projects = projectsCache;
    if (!projects) {
      const result = await db.from("projects").select("id,name,description");
      if (result.error) return { projectIds: [] as string[], error: result.error };
      projects = result.data ?? [];
    }
    if (role === "admin") projectIds = (projects ?? []).map((project: any) => project.id);
    else {
      const expectedName = normalize(access.project_name);
      const expectedCode = normalize(access.code);
      projectIds = (projects ?? [])
        .filter((project: any) => {
          const projectName = normalize(project.name);
          const searchable = normalize(`${project.id} ${project.name} ${project.description ?? ""}`);
          return (
            (expectedName && (projectName === expectedName || projectName.includes(expectedName) || expectedName.includes(projectName))) ||
            (expectedCode && searchable.includes(expectedCode))
          );
        })
        .map((project: any) => project.id);
    }
  }
  return { projectIds, error: null };
}

// אחרי שמנהל שומר שינויים בניהול משתמשים – מעדכן את ההרשאות בפועל (project_members)
// של משתמשים שכבר התחברו בעבר, כדי ששינוי מ"צופה" ל"קריאה וכתיבה" ייכנס לתוקף מיד
// ולא רק אחרי התנתקות והתחברות מחדש.
export async function syncLegacyMemberships(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || !anonKey) return Response.json({ error: "שירות ההתחברות אינו מוגדר" }, { status: 503 });
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return Response.json({ error: "הבקשה אינה תקינה" }, { status: 403 });
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return Response.json({ error: "יש להתחבר מחדש" }, { status: 401 });
    const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const caller = await auth.auth.getUser(token);
    if (caller.error || !caller.data.user) return Response.json({ error: "ההתחברות פגה" }, { status: 401 });

    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const callerMembers = await db.from("project_members").select("project_id,role,active").eq("user_id", caller.data.user.id);
    if (callerMembers.error) return Response.json({ error: "בדיקת הרשאות נכשלה" }, { status: 503 });
    const activeCaller = (callerMembers.data ?? []).filter((row: any) => row.active);
    const callerIsAdmin = activeCaller.some((row: any) => row.role === "admin");
    const managedProjects = new Set(
      activeCaller.filter((row: any) => row.role === "admin" || row.role === "readwrite").map((row: any) => String(row.project_id)),
    );
    if (!callerIsAdmin && !managedProjects.size) return Response.json({ error: "אין הרשאה לעדכן משתמשים" }, { status: 403 });

    const [accessRows, projects] = await Promise.all([
      db.from("project_access_users").select("*"),
      db.from("projects").select("id,name,description"),
    ]);
    if (accessRows.error || projects.error) return Response.json({ error: "טעינת המשתמשים נכשלה" }, { status: 503 });

    let updated = 0;
    for (const access of accessRows.data ?? []) {
      const role = accessRole(access.role);
      if (role === "admin" || !access.username) continue;
      const userId = stableUserId(access.username);
      // רק משתמשים שכבר התחברו בעבר (משתמש חדש יקבל את ההרשאה בהתחברות הראשונה)
      const existing = await db.auth.admin.getUserById(userId);
      if (!existing.data.user) continue;
      const resolved = await resolveAccessProjectIds(db, access, role, projects.data ?? []);
      const projectIds = resolved.projectIds.filter((projectId) => callerIsAdmin || managedProjects.has(String(projectId)));
      if (!projectIds.length) continue;
      const memberships = projectIds.map((projectId) => ({ user_id: userId, project_id: projectId, role, active: true }));
      const result = await db.from("project_members").upsert(memberships, { onConflict: "user_id,project_id" });
      if (!result.error) updated += memberships.length;
    }
    return Response.json({ updated }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "עדכון ההרשאות נכשל" }, { status: 500 });
  }
}
