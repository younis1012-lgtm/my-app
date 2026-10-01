import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// ניהול משתמשי המערכת בצד השרת בלבד.
// הסיסמאות נשמרות מוצפנות (scrypt) ואף פעם לא נשלחות לדפדפן.

const TABLE = "project_access_users";
const ADMIN_LOGIN_EMAIL = "younis1012@gmail.com";

export const normalizeLogin = (value: unknown) =>
  String(value ?? "")
    .replace(/[׳`’']/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();

export const accessRole = (role: unknown) => {
  const value = normalizeLogin(role);
  if (value === "admin" || value === "administrator" || value.includes("מנהל")) return "admin" as const;
  if (value === "readonly" || value === "read_only" || value === "read-only" || value.includes("צפי")) return "readonly" as const;
  return "readwrite" as const;
};

const HASH_PREFIX = "scrypt$";

export const isHashedPassword = (stored: unknown) => String(stored ?? "").startsWith(HASH_PREFIX);

export const hashPassword = (password: string) => {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `${HASH_PREFIX}${salt.toString("base64")}$${hash.toString("base64")}`;
};

const sameBuffer = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

export const verifyPassword = (stored: unknown, password: string) => {
  const value = String(stored ?? "");
  if (!value || !password) return false;
  if (value.startsWith(HASH_PREFIX)) {
    const [, saltText, hashText] = value.split("$");
    if (!saltText || !hashText) return false;
    const expected = Buffer.from(hashText, "base64");
    const actual = scryptSync(password, Buffer.from(saltText, "base64"), expected.length || 32);
    return sameBuffer(actual, expected);
  }
  // סיסמה ישנה שעדיין לא הוצפנה – תוצפן בהתחברות הבאה
  return sameBuffer(Buffer.from(value), Buffer.from(password));
};

// אותם כללים כמו במסך הכניסה: שם משתמש, קוד פרויקט, או כתובת המייל של מנהל המערכת
export const loginMatchesRow = (row: Record<string, any>, login: string) => {
  const key = normalizeLogin(login);
  if (!key) return false;
  return (
    normalizeLogin(row.username) === key ||
    normalizeLogin(row.code) === key ||
    (accessRole(row.role) === "admin" && key === ADMIN_LOGIN_EMAIL)
  );
};

export const publicAccessRow = (row: Record<string, any>) => {
  const { password, ...rest } = row ?? {};
  return { ...rest, password: "", has_password: Boolean(password) };
};

const env = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, anonKey, serviceKey };
};

const noStore = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: noStore });

type Caller = {
  db: any;
  userId: string;
  legacyUsername: string;
  isAdmin: boolean;
  managedProjects: Set<string>;
  memberProjects: Set<string>;
};

async function identifyCaller(request: Request): Promise<Caller | Response> {
  const { url, anonKey, serviceKey } = env();
  if (!url || !anonKey || !serviceKey) return json({ error: "שירות המשתמשים אינו מוגדר" }, 503);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "הבקשה אינה תקינה" }, 403);
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return json({ error: "יש להתחבר מחדש" }, 401);
  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const caller = await auth.auth.getUser(token);
  if (caller.error || !caller.data.user) return json({ error: "ההתחברות פגה. יש להתחבר מחדש" }, 401);
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const members = await db.from("project_members").select("project_id,role,active").eq("user_id", caller.data.user.id);
  if (members.error) return json({ error: "בדיקת ההרשאות נכשלה" }, 503);
  const active = (members.data ?? []).filter((row: any) => row.active);
  return {
    db,
    userId: caller.data.user.id,
    legacyUsername: String(caller.data.user.app_metadata?.legacy_username ?? "").trim(),
    isAdmin: active.some((row: any) => row.role === "admin"),
    managedProjects: new Set(
      active.filter((row: any) => row.role === "admin" || row.role === "readwrite").map((row: any) => String(row.project_id)),
    ),
    memberProjects: new Set(active.map((row: any) => String(row.project_id))),
  };
}

const rowProjectIds = (row: Record<string, any>) =>
  (Array.isArray(row?.project_ids) ? row.project_ids : row?.project_id ? [row.project_id] : [])
    .map((id: unknown) => String(id ?? "").trim())
    .filter(Boolean);

const rowInProjects = (row: Record<string, any>, projects: Set<string>) =>
  rowProjectIds(row).some((id: string) => projects.has(id));

const missingColumn = (error: any, column: string) =>
  Boolean(error) && new RegExp(`\\b${column}\\b`, "i").test(`${error?.message ?? ""} ${error?.details ?? ""}`) &&
  /column|schema cache|does not exist/i.test(`${error?.message ?? ""} ${error?.details ?? ""}`);

// GET – רשימת המשתמשים, בלי סיסמאות.
// מנהל מערכת רואה את כולם; שאר המשתמשים רואים רק משתמשים של הפרויקטים שלהם.
export async function listAccessUsers(request: Request) {
  try {
    const caller = await identifyCaller(request);
    if (caller instanceof Response) return caller;
    const result = await caller.db.from(TABLE).select("*").order("created_at", { ascending: true });
    if (result.error) return json({ error: "טעינת המשתמשים נכשלה" }, 503);
    const rows = (result.data ?? []).filter(
      (row: any) =>
        caller.isAdmin ||
        normalizeLogin(row.username) === normalizeLogin(caller.legacyUsername) ||
        (accessRole(row.role) !== "admin" && rowInProjects(row, caller.memberProjects)),
    );
    return json({ users: rows.map(publicAccessRow) });
  } catch {
    return json({ error: "טעינת המשתמשים נכשלה" }, 500);
  }
}

// POST – שמירת רשימת המשתמשים (ניהול משתמשים) או שינוי סיסמה אישית.
export async function saveAccessUsers(request: Request) {
  try {
    const caller = await identifyCaller(request);
    if (caller instanceof Response) return caller;
    const body = await request.json().catch(() => null);
    if (body?.action === "changeOwnPassword") return changeOwnPassword(caller, body);

    if (!caller.isAdmin && !caller.managedProjects.size) return json({ error: "אין הרשאה לעדכן משתמשים" }, 403);
    const incoming: Record<string, any>[] = Array.isArray(body?.users) ? body.users : [];
    if (!incoming.length) return json({ error: "רשימת המשתמשים ריקה" }, 400);

    const existingResult = await caller.db.from(TABLE).select("*");
    if (existingResult.error) return json({ error: "קריאת המשתמשים נכשלה" }, 503);
    const existingRows: Record<string, any>[] = existingResult.data ?? [];
    const existingByKey = new Map<string, Record<string, any>>();
    existingRows.forEach((row) => {
      const key = normalizeLogin(row.username);
      if (key && !existingByKey.has(key)) existingByKey.set(key, row);
    });

    const canManageRow = (row: Record<string, any> | undefined) =>
      !row || caller.isAdmin || (accessRole(row.role) !== "admin" && rowProjectIds(row).every((id: string) => caller.managedProjects.has(id)) && rowProjectIds(row).length > 0);

    const rows: Record<string, any>[] = [];
    const seen = new Set<string>();
    for (const source of incoming) {
      const username = String(source?.username ?? "").trim();
      const key = normalizeLogin(username);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const existing = existingByKey.get(key);
      const role = accessRole(source.role);
      if (!caller.isAdmin) {
        if (existing && !canManageRow(existing)) continue; // משתמש מחוץ לפרויקטים שלי – לא משנים
        if (role === "admin") continue;
        if (!rowProjectIds(source).length || !rowProjectIds(source).every((id: string) => caller.managedProjects.has(id))) continue;
      }
      const newPassword = String(source.password ?? "");
      let password = existing?.password ?? "";
      if (newPassword) {
        if (newPassword.length < 6) return json({ error: `הסיסמה של "${username}" קצרה מדי (לפחות 6 תווים)` }, 400);
        password = hashPassword(newPassword);
      }
      if (!password) return json({ error: `יש להגדיר סיסמה למשתמש "${username}"` }, 400);
      rows.push({
        username,
        password,
        display_name: String(source.display_name ?? username).trim() || username,
        role,
        code: source.code ? String(source.code).trim() : null,
        project_name: role === "admin" ? null : String(source.project_name ?? ""),
        project_ids: role === "admin" ? [] : rowProjectIds(source),
        signature: String(source.signature ?? ""),
        discipline: role === "admin" ? "" : String(source.discipline ?? ""),
      });
    }

    if (!rows.some((row) => row.role === "admin") && caller.isAdmin)
      return json({ error: "חייב להישאר לפחות מנהל מערכת אחד" }, 400);

    // מחיקת משתמשים שהוסרו מהרשימה (רק כאלה שמותר לי לנהל)
    const removed = existingRows
      .filter((row) => !seen.has(normalizeLogin(row.username)) && canManageRow(row))
      .map((row) => String(row.username));
    // הגנה: רשימה שלא נטענה במלואה לא תמחק בטעות את רוב המשתמשים
    if (removed.length > 3 && removed.length > existingRows.length / 2)
      return json({ error: "השמירה בוטלה: היא הייתה מוחקת את רוב המשתמשים. יש לרענן את הדף ולנסות שוב" }, 409);
    if (removed.length) {
      const deleteResult = await caller.db.from(TABLE).delete().in("username", removed);
      if (deleteResult.error) return json({ error: "מחיקת משתמשים נכשלה" }, 503);
    }

    let payload = rows.map((row) => {
      const existing = existingByKey.get(normalizeLogin(row.username));
      return existing ? { ...row, username: existing.username } : row;
    });
    let disciplineMissing = false;
    let result = await caller.db.from(TABLE).upsert(payload, { onConflict: "username" });
    for (let attempt = 0; attempt < 2 && result.error; attempt += 1) {
      const column = ["discipline", "project_ids"].find((name) => missingColumn(result.error, name));
      if (!column) break;
      if (column === "discipline") disciplineMissing = true;
      payload = payload.map(({ [column]: _drop, ...rest }) => rest);
      result = await caller.db.from(TABLE).upsert(payload, { onConflict: "username" });
    }
    if (result.error && /no unique or exclusion constraint|ON CONFLICT/i.test(String(result.error.message))) {
      result = { error: null };
      for (const row of payload) {
        const exists = existingByKey.has(normalizeLogin(row.username));
        const single = exists
          ? await caller.db.from(TABLE).update(row).eq("username", row.username)
          : await caller.db.from(TABLE).insert(row);
        if (single.error) {
          result = single;
          break;
        }
      }
    }
    if (result.error) return json({ error: `שמירת המשתמשים נכשלה: ${result.error.message}` }, 503);

    // שורות כפולות ישנות של אותו משתמש (הבדל באותיות/רווחים)
    const savedExact = new Set(payload.map((row) => String(row.username)));
    const staleDuplicates = existingRows
      .map((row) => String(row.username ?? ""))
      .filter((username) => username && !savedExact.has(username) && seen.has(normalizeLogin(username)));
    if (staleDuplicates.length) await caller.db.from(TABLE).delete().in("username", staleDuplicates);

    return json({ ok: true, disciplineMissing });
  } catch {
    return json({ error: "שמירת המשתמשים נכשלה" }, 500);
  }
}

async function changeOwnPassword(caller: Caller, body: any) {
  const currentPassword = String(body?.currentPassword ?? "");
  const newPassword = String(body?.newPassword ?? "");
  const newUsername = String(body?.newUsername ?? "").trim();
  if (!caller.legacyUsername) return json({ error: "לא נמצאה רשומת המשתמש המחובר" }, 404);
  const result = await caller.db.from(TABLE).select("*");
  if (result.error) return json({ error: "קריאת המשתמשים נכשלה" }, 503);
  const rows: Record<string, any>[] = result.data ?? [];
  const own = rows.find((row) => normalizeLogin(row.username) === normalizeLogin(caller.legacyUsername));
  if (!own) return json({ error: "לא נמצאה רשומת המשתמש המחובר" }, 404);
  if (!verifyPassword(own.password, currentPassword)) return json({ error: "הסיסמה הנוכחית אינה נכונה" }, 401);
  if (newPassword && newPassword.length < 6) return json({ error: "הסיסמה החדשה חייבת להכיל לפחות 6 תווים" }, 400);
  const username = newUsername || own.username;
  if (
    normalizeLogin(username) !== normalizeLogin(own.username) &&
    rows.some((row) => normalizeLogin(row.username) === normalizeLogin(username))
  )
    return json({ error: "שם המשתמש כבר קיים במערכת" }, 409);
  const update = await caller.db
    .from(TABLE)
    .update({ username, password: hashPassword(newPassword || currentPassword) })
    .eq("username", own.username);
  if (update.error) return json({ error: "שמירת פרטי החשבון נכשלה" }, 503);
  return json({ ok: true, username });
}
