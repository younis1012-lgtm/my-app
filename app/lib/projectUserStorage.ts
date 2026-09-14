export async function saveProjectUserRows(db: any, projectId: string, rows: {project_id: string}[]) {
  if (!db || !projectId) throw new Error('יש להתחבר מחדש ולבחור פרויקט לפני השמירה');
  const auth = await db.auth.getUser();
  if (auth.error || !auth.data.user) throw new Error('ההתחברות פגה. יש לצאת ולהתחבר שוב לפני השמירה');
  const member = await db.from('project_members').select('role,active').eq('project_id',projectId).eq('user_id',auth.data.user.id).maybeSingle();
  if (member.error) throw new Error('בדיקת הרשאות השמירה נכשלה. נסה שוב');
  if (!member.data?.active || member.data.role !== 'admin') throw new Error('שמירת משתמשי הפרויקט דורשת הרשאת מנהל בפרויקט הנבחר');
  const scoped = rows.filter(row => row.project_id === projectId);
  if (!scoped.length) return;
  const result = await db.from('project_email_users').upsert(scoped, {onConflict:'id'});
  if (result.error) {
    if (result.error.code === '42501') throw new Error('אין הרשאה לשמור בפרויקט הנבחר. יש להתחבר מחדש כמנהל; אם התקלה נמשכת נדרשת בדיקת הרשאות הפרויקט');
    throw result.error;
  }
}
