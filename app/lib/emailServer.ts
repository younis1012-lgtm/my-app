import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { MAIL_MAX_BYTES, MAIL_SIGNATURE, escapeMailHtml, mailRecipients, validMailAddress } from './email';

class MailError extends Error { constructor(message: string, public status = 400) { super(message); } }
function personnelRole(row: {role?: string; name?: string; company?: string}) {
  const label = `${row.role || ''} ${row.name || ''} ${row.company || ''}`.toLowerCase();
  return /quality control|quality controller|qc|electrical inspector|בקרת? איכות|בקר.*(חשמל|גינון|תנועה|תשתיות|תקשורת|תאורה)/.test(label) ? 'readwrite' : 'readonly';
}
async function identity(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !serviceKey) throw new MailError('שירות המייל דורש הגדרת שרת Supabase', 503);
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new MailError('יש להתחבר לחשבון המערכת', 401);
  const auth = createClient(url, key, {auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error} = await auth.auth.getUser(token);
  if (error || !data.user) throw new MailError('ההתחברות פגה. יש להתחבר שוב',401);
  return {db:createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}),user:data.user};
}
async function authorize(request: Request, projectId: string, write: boolean) {
  const {db,user} = await identity(request);
  const member = await db.from('project_members').select('role,active').eq('project_id',projectId).eq('user_id',user.id).maybeSingle();
  if (member.error) throw new MailError('בדיקת הרשאות הפרויקט נכשלה',503);
  let role = member.data?.active === false ? null : member.data?.role;
  // Preserve established personnel assignments, but never override an explicit membership/revocation.
  if (!member.data && user.email) {
    const personnel = await db.from('project_email_users').select('role,name,company').eq('project_id',projectId).eq('active',true).ilike('email',user.email).limit(1).maybeSingle();
    if (personnel.error) throw new MailError('בדיקת שיוך המשתמש נכשלה',503);
    if (personnel.data) role = personnelRole(personnel.data);
  }
  if (!role || (write && !['admin','readwrite'].includes(role))) throw new MailError('אין הרשאה לפעולה בפרויקט זה',403);
  return {db,userId:user.id,user,role};
}
const normalizedIdentity = (value: unknown) => String(value || '').replace(/[\u05f3`\u2019']/g,'').replace(/\s+/g,'').trim().toLowerCase();
async function operatorIdentity(db: any, user: any, projectId: string, personnel: any[]) {
  const legacyUsername = String(user.app_metadata?.legacy_username || '').trim();
  let name = String(user.user_metadata?.full_name || user.user_metadata?.name || legacyUsername || '').trim();
  let email = [user.email, legacyUsername].map((value)=>String(value || '').trim().toLowerCase()).find((value)=>validMailAddress(value) && !value.endsWith('@users.yk-quality.invalid')) || '';
  let access: any = null;
  if (legacyUsername) {
    const result = await db.from('project_access_users').select('*');
    if (!result.error) access = (result.data || []).find((row: any)=>[row.username,row.code].some(value=>normalizedIdentity(value)===normalizedIdentity(legacyUsername)));
    name = String(access?.display_name || name).trim();
    email = [access?.email, access?.username, email].map((value)=>String(value || '').trim().toLowerCase()).find(validMailAddress) || '';
  }
  if (!email) {
    const keys = [name,legacyUsername,access?.username,access?.code].map(normalizedIdentity).filter(Boolean);
    const match = personnel.find((row: any)=>validMailAddress(row.email) && [row.name,row.role].map(normalizedIdentity).some(value=>keys.includes(value)));
    if (match) { email = String(match.email).trim().toLowerCase(); name = name || String(match.name || '').trim(); }
  }
  return {name:name || 'משתמש מערכת',email:validMailAddress(email) ? email : ''};
}
export async function readMailDirectory(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    if (params.get('mode') === 'memberships') {
      const {db,user} = await identity(request);
      const members = await db.from('project_members').select('project_id,role,active').eq('user_id',user.id);
      if (members.error) throw new MailError('טעינת שיוכי הפרויקטים נכשלה',503);
      const personnel = user.email ? await db.from('project_email_users').select('project_id,role,name,company').eq('active',true).ilike('email',user.email) : {data:[],error:null};
      if (personnel.error) throw new MailError('טעינת שיוכי אנשי הצוות נכשלה',503);
      const assigned = new Map<string,string>();
      const explicit = new Set((members.data || []).map(x=>String(x.project_id)));
      for (const row of members.data || []) if (row.active) assigned.set(String(row.project_id),row.role);
      for (const row of personnel.data || []) if (!explicit.has(String(row.project_id))) assigned.set(String(row.project_id),personnelRole(row));
      const ids = [...assigned.keys()];
      const projects = ids.length ? await db.from('projects').select('id,name').in('id',ids) : {data:[],error:null};
      if (projects.error) throw new MailError('טעינת הפרויקטים נכשלה',503);
      return Response.json({memberships:(projects.data || []).map(p=>({projectId:p.id,projectName:p.name,role:assigned.get(p.id)})),projects:projects.data || []},{headers:{'Cache-Control':'no-store'}});
    }
    const projectId = field(params.get('projectId'),100);
    const {db,user} = await authorize(request,projectId,false);
    const result = await db.from('project_email_users').select('id,name,email,role,smtp_app_password').eq('project_id',projectId).eq('active',true);
    if (result.error) throw new MailError('טעינת כתובות המייל המאושרות נכשלה',503);
    const contacts = (result.data || []).filter(x=>validMailAddress(x.email)).map(x=>({id:x.id,name:x.name || x.email,email:x.email}));
    const accessUsers = await db.from('project_access_users').select('*');
    if (!accessUsers.error) {
      const project = await db.from('projects').select('name').eq('id',projectId).maybeSingle();
      const projectName = String(project.data?.name || '').replace(/\s+/g,'').toLowerCase();
      for (const user of accessUsers.data || []) {
        const email = String(user.username || '').trim().toLowerCase();
        const ids = Array.isArray(user.project_ids) ? user.project_ids.map(String) : user.project_id ? [String(user.project_id)] : [];
        const assignedByName = projectName && String(user.project_name || '').replace(/\s+/g,'').toLowerCase() === projectName;
        if (validMailAddress(email) && (ids.includes(projectId) || assignedByName) && !contacts.some(x=>x.email.toLowerCase()===email))
          contacts.push({id:`access-${email}`,name:user.display_name || email,email});
      }
    }
    const senders = (result.data || []).filter(x=>validMailAddress(x.email) && x.smtp_app_password).map(x=>({id:x.id,name:x.name || x.email,email:x.email}));
    const systemEmail = process.env.EMAIL_USER?.trim();
    if (systemEmail && validMailAddress(systemEmail) && process.env.EMAIL_APP_PASSWORD && !senders.some(x=>x.email.toLowerCase()===systemEmail.toLowerCase())) senders.push({id:'system-mailbox',name:'חשבון המערכת',email:systemEmail});
    const operator = await operatorIdentity(db,user,projectId,result.data || []);
    return Response.json({contacts,senders,operator},{headers:{'Cache-Control':'no-store'}});
  } catch (error) {return errorResponse(error);}
}
function errorResponse(error: unknown) {
  return Response.json({ success: false, error: error instanceof MailError ? error.message : 'שירות המייל אינו זמין כרגע' }, { status: error instanceof MailError ? error.status : 500 });
}
function field(value: unknown, max: number) { if (typeof value !== 'string' || !value.trim() || value.length > max) throw new MailError('חסר שדה חובה או שאורכו אינו תקין'); return value.trim(); }
export async function readMailHistory(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const projectId = field(params.get('projectId'), 100);
    const { db } = await authorize(request, projectId, false);
    let query = db.from('email_history').select('id,module,record_id,subject,to_addresses,cc_addresses,status,created_at,finished_at,error,attachment_names,message_id').eq('project_id', projectId);
    if (params.has('module')) query = query.eq('module', params.get('module'));
    if (params.has('recordId')) query = query.contains('record_ids', [params.get('recordId')]);
    const result = await query.order('created_at', { ascending: false }).limit(50);
    if (result.error) throw new MailError('טעינת היסטוריית המייל נכשלה. יש לבדוק שהותקן עדכון מסד הנתונים', 503);
    return Response.json({ success: true, history: result.data }, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) { return errorResponse(error); }
}
export async function postMail(request: Request) {
  try {
    // Bound request size before parsing; remote URLs and filesystem paths are never fetched here.
    const reader = request.body?.getReader();
    if (!reader) throw new MailError('בקשה ריקה');
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.length;
      if (size > 4.2 * 1024 * 1024) { await reader.cancel(); throw new MailError('גודל המייל חורג מהמותר', 413); }
      chunks.push(value);
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new MailError('בקשה אינה תקינה'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new MailError('בקשה אינה תקינה');
    const projectId = field(body.projectId, 100), moduleName = field(body.module, 100), recordId = field(body.recordId, 200);
    const recordIds = [...new Set([recordId, ...(Array.isArray(body.recordIds) ? body.recordIds.map((id: unknown) => field(id, 200)) : [])])];
    if (recordIds.length > 100) throw new MailError('ניתן לשלוח עד 100 רשומות יחד');
    const { db, userId, user, role } = await authorize(request, projectId, false);
    if (role === 'readonly' && moduleName !== 'nonconformances') throw new MailError('משתמש צופה רשאי לשלוח מהמערכת טפסי אי־התאמה בלבד',403);
    const requestId = field(body.requestId, 36);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) throw new MailError('מזהה בקשה אינו תקין');
    const to = mailRecipients(body.to), cc = mailRecipients(body.cc), bcc = mailRecipients(body.bcc);
    const recipients = [...to, ...cc, ...bcc];
    if (!to.length || recipients.length > 100 || recipients.some(x => !validMailAddress(x))) throw new MailError('יש להזין נמענים תקינים, עד 100 כתובות');
    const subject = field(body.subject, 500), text = field(body.text, 50000);
    if (/[\r\n]/.test(subject)) throw new MailError('נושא המייל אינו תקין');
    if (/\{\{[\w.]+\}\}/.test(subject + text)) throw new MailError('יש להשלים את השדות החסרים בתבנית');
    if (!Array.isArray(body.attachments) || body.attachments.length > 30) throw new MailError('ניתן לצרף עד 30 קבצים');
    let total = 0;
    const attachments = body.attachments.map((item: {filename?: unknown; mimeType?: unknown; contentBase64?: unknown; url?: unknown}) => {
      if (!item || item.url || typeof item.contentBase64 !== 'string') throw new MailError('קובץ מצורף לא הוכן לשליחה');
      const filename = field(item.filename, 240).replace(/[\\/\r\n\x00]/g, '_');
      const content = item.contentBase64.replace(/\s/g, '');
      if (!content || content.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(content)) throw new MailError('תוכן קובץ אינו תקין');
      const buffer = Buffer.from(content, 'base64'); total += buffer.length;
      if (total > MAIL_MAX_BYTES) throw new MailError('ניתן לצרף עד 3MB בסך הכול', 413);
      return { filename, content: buffer, contentType: typeof item.mimeType === 'string' && /^[\w.+-]+\/[\w.+-]+$/.test(item.mimeType) ? item.mimeType : 'application/octet-stream' };
    });
    const senderEmail = field(body.senderEmail, 254).toLowerCase();
    if (!validMailAddress(senderEmail)) throw new MailError('כתובת השולח אינה תקינה');
    // Credentials are resolved server-side from the selected project's configured mailbox.
    const sender = await db.from('project_email_users').select('email,name,smtp_app_password').eq('project_id', projectId).eq('active', true).ilike('email', senderEmail).limit(1).maybeSingle();
    if (!sender.error && !sender.data?.smtp_app_password && senderEmail === process.env.EMAIL_USER?.trim().toLowerCase() && process.env.EMAIL_APP_PASSWORD) sender.data = {email:process.env.EMAIL_USER.trim(),name:'חשבון המערכת',smtp_app_password:process.env.EMAIL_APP_PASSWORD};
    if (sender.error || !sender.data?.smtp_app_password) throw new MailError('יש להגדיר חשבון מייל פעיל וסיסמת אפליקציה בפרויקט', 409);
    const personnel = await db.from('project_email_users').select('name,email,role').eq('project_id',projectId).eq('active',true);
    const operator = await operatorIdentity(db,user,projectId,personnel.error ? [] : personnel.data || []);
    const created = await db.from('email_history').insert({ id: requestId, project_id: projectId, module: moduleName, record_id: recordId, record_ids: recordIds, user_id: userId, subject, body: text, to_addresses: to, cc_addresses: cc, bcc_addresses: bcc, sender_email: senderEmail, attachment_names: attachments.map((a: {filename: string}) => a.filename), status: 'sending' }).select('id').single();
    if (created.error) {
      if (created.error.code === '23505') {
        const prior = await db.from('email_history').select('status').eq('id', requestId).eq('project_id', projectId).eq('user_id', userId).maybeSingle();
        throw new MailError(prior.data ? `בקשה זו כבר טופלה (${prior.data.status}). יש לבדוק את ההיסטוריה לפני שליחה נוספת` : 'מזהה בקשה כבר קיים', 409);
      }
      throw new MailError('לא ניתן לתעד את השליחה. יש לבדוק שהותקן עדכון מסד הנתונים', 503);
    }
    let status = 'failed', messageId: string | null = null, failure: string | null = null;
    let accepted: string[] = [], rejected: string[] = [];
    const transport = nodemailer.createTransport({service: 'gmail', auth: {user: sender.data.email, pass: sender.data.smtp_app_password}, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000, disableFileAccess: true, disableUrlAccess: true});
    try {
      const senderName = operator.email ? `${operator.name} באמצעות ${sender.data.name || 'Y.K QUALITY'}` : sender.data.name || 'Y.K QUALITY';
      const result = await transport.sendMail({from: {name: senderName, address: sender.data.email}, replyTo: operator.email || undefined, to, cc, bcc, subject, text: text + MAIL_SIGNATURE, html: `<div dir="rtl" style="white-space:pre-wrap;font-family:Arial,sans-serif">${escapeMailHtml(text + MAIL_SIGNATURE)}</div>`, attachments});
      messageId = result.messageId;
      accepted = (result.accepted || []).map(String); rejected = (result.rejected || []).map(String);
      status = accepted.length ? (rejected.length ? 'partial' : 'sent') : 'failed';
      if (status === 'failed') failure = 'שרת הדואר לא קיבל אף נמען';
    } catch (error) {
      const code = (error as {code?: string}).code;
      status = ['ETIMEDOUT', 'ECONNECTION', 'ESOCKET'].includes(code || '') ? 'unknown' : 'failed';
      failure = status === 'unknown' ? 'החיבור נותק; ייתכן שהמייל נשלח. יש לבדוק בתיבת הדואר לפני ניסיון נוסף' : 'שרת הדואר דחה את השליחה. יש לבדוק את הגדרות החשבון';
    } finally { transport.close(); }
    const updated = await db.from('email_history').update({status, message_id: messageId, error: failure, accepted, rejected, finished_at: new Date().toISOString()}).eq('id', requestId);
    return Response.json({success: status === 'sent' || status === 'partial', status, messageId, accepted, rejected, error: failure, historyId: requestId, warning: updated.error ? 'לא ניתן לעדכן את ההיסטוריה; אין לשלוח שוב לפני בדיקה בתיבת הדואר' : undefined});
  } catch (error) { return errorResponse(error); }
}
