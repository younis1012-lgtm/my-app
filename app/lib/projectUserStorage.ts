export async function saveProjectUserRows(db: any, projectId: string, rows: {project_id: string}[]) {
  if (!db || !projectId) throw new Error('יש להתחבר מחדש ולבחור פרויקט לפני השמירה');
  const session = await db.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error('ההתחברות פגה. יש לצאת ולהתחבר שוב לפני השמירה');
  const scoped = rows.filter(row => row.project_id === projectId);
  if (!scoped.length) return;
  const response = await fetch('/api/email-directory', {
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
    body:JSON.stringify({projectId,rows:scoped}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'שמירת משתמשי הפרויקט נכשלה');
}

export function restoreProjectUserDetails<T extends {email?: string; role?: string; company?: string; phone?: string; smtpAppPassword?: string}>(
  cloudUsers: T[],
  cachedUsers: T[],
  canManageCredentials = false,
) {
  const cachedByEmail = new Map(
    cachedUsers
      .filter(user => String(user.email || '').trim())
      .map(user => [String(user.email).trim().toLowerCase(), user]),
  );
  return cloudUsers.map(user => {
    const cached = cachedByEmail.get(String(user.email || '').trim().toLowerCase());
    if (!cached) return user;
    return {
      ...user,
      role: user.role || cached.role || '',
      company: user.company || cached.company || '',
      phone: user.phone || cached.phone || '',
      ...(canManageCredentials
        ? {smtpAppPassword:user.smtpAppPassword || cached.smtpAppPassword || ''}
        : {smtpAppPassword:''}),
    };
  });
}
