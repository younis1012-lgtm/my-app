'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { MAIL_MAX_BYTES, MAIL_SIGNATURE, MailAttachment, MailContext, mailRecipients, mailTemplates, mergeMailData, validMailAddress } from '../lib/email';

type History = {id: string; subject: string; status: string; created_at: string; error?: string; attachment_names: string[]; to_addresses: string[]};
const statusLabels: Record<string, string> = {sending:'בטיפול — אין לשלוח שוב לפני בדיקה', sent:'התקבל בשרת הדואר', partial:'התקבל עבור חלק מהנמענים', failed:'נכשל', unknown:'תוצאת השליחה אינה ודאית'};
async function authHeaders() {
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error('שליחת מייל והיסטוריה דורשות כניסה באמצעות חשבון Supabase בעל הרשאה בפרויקט');
  return {'Content-Type':'application/json', Authorization:`Bearer ${token}`};
}
async function blobBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('קריאת הקובץ נכשלה')); reader.readAsDataURL(blob); });
}
async function prepareAttachment(file: MailAttachment): Promise<MailAttachment> {
  if (file.contentBase64) return {...file, url: undefined};
  if (!file.url) throw new Error(`אין תוכן לקובץ ${file.filename}`);
  const url = new URL(file.url);
  const storage = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!storage || url.origin !== new URL(storage).origin || !url.pathname.startsWith('/storage/v1/object/')) throw new Error(`מקור הקובץ ${file.filename} אינו אחסון הפרויקט. ניתן להוריד ולהוסיף אותו ידנית`);
  const response = await fetch(url, {signal: AbortSignal.timeout(30000), redirect: 'error', credentials: 'omit'});
  if (!response.ok) throw new Error(`טעינת הקובץ ${file.filename} נכשלה`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error(`טעינת הקובץ ${file.filename} נכשלה`);
  const chunks: ArrayBuffer[] = []; let total = 0;
  while (true) { const {done, value} = await reader.read(); if (done) break; total += value.length; if (total > MAIL_MAX_BYTES) { await reader.cancel(); throw new Error('הקובץ גדול מ-3MB'); } chunks.push(value.slice().buffer); }
  return {...file, url: undefined, contentBase64: await blobBase64(new Blob(chunks))};
}
export function EmailComposer({context, senderEmail, contacts, canSend, onClose}: {
  context: MailContext; senderEmail: string; contacts: {id:string;name:string;email:string}[]; canSend: boolean; onClose: () => void;
}) {
  const [directoryContacts,setDirectoryContacts] = useState(contacts);
  const [senders,setSenders] = useState<{id:string;name:string;email:string}[]>([]);
  const [selectedSender,setSelectedSender] = useState(senderEmail);
  const [directoryError,setDirectoryError] = useState('');
  const [directoryLoading,setDirectoryLoading] = useState(true);
  async function loadDirectory() {
    setDirectoryLoading(true); setDirectoryError('');
    try {
      const response = await fetch(`/api/email-directory?projectId=${encodeURIComponent(context.projectId)}`, {headers:await authHeaders(),cache:'no-store'});
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setDirectoryContacts(result.contacts);setSenders(result.senders);
      setSelectedSender(previous => result.senders.some((x: {email:string})=>x.email===previous) ? previous : result.senders[0]?.email || '');
    } catch(error) {setDirectoryError(error instanceof Error ? error.message : 'טעינת כתובות המייל נכשלה');}
    finally {setDirectoryLoading(false);}
  }
  useEffect(()=>{void loadDirectory();},[]);
  const [to, setTo] = useState(''), [cc, setCc] = useState(''), [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState(mergeMailData(mailTemplates[0].subject, context.data));
  const [text, setText] = useState(mergeMailData(mailTemplates[0].text, context.data));
  const [files, setFiles] = useState(context.attachments);
  const [selected, setSelected] = useState(context.attachments.map(x => x.id));
  const [busy, setBusy] = useState(false), [generating, setGenerating] = useState(false), [generated, setGenerated] = useState(false);
  const [preview, setPreview] = useState(false), [notice, setNotice] = useState(''), [historyError, setHistoryError] = useState('');
  const [history, setHistory] = useState<History[]>([]);
  const [finished, setFinished] = useState(false), [locked, setLocked] = useState(false);
  const [projectHistory, setProjectHistory] = useState(false);
  const requestId = useRef(crypto.randomUUID()), sending = useRef(false);
  const dialog = useRef<HTMLDivElement>(null), initialFocus = useRef<HTMLInputElement>(null);
  async function loadHistory(all = projectHistory) {
    try {
      const params = new URLSearchParams({projectId: context.projectId, ...(all ? {} : {module: context.module, recordId: context.recordId})});
      const result = await fetch(`/api/send-email?${params}`, {headers: await authHeaders(), cache:'no-store'});
      const data = await result.json(); if (!result.ok) throw new Error(data.error);
      setHistory(data.history); setHistoryError('');
    } catch (error) { setHistoryError(error instanceof Error ? error.message : 'טעינת ההיסטוריה נכשלה'); }
  }
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; initialFocus.current?.focus(); void loadHistory(false); return () => previous?.focus(); }, []); // Context is mounted with a unique key.
  const renderedSubject = mergeMailData(subject, context.data), renderedText = mergeMailData(text, context.data);
  const chosen = files.filter(x => selected.includes(x.id));
  async function generate() {
    if (!context.generateDocuments || generating || generated) return;
    setGenerating(true); setNotice('');
    try { const docs = await context.generateDocuments(); setFiles(prev => [...prev, ...docs]); setSelected(prev => [...prev, ...docs.map(x => x.id)]); setGenerated(true); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'יצירת המסמך נכשלה'); }
    finally { setGenerating(false); }
  }
  async function send() {
    if (sending.current || !canSend || finished || locked || directoryLoading || directoryError || !selectedSender) return;
    if (!mailRecipients(to).length || [...mailRecipients(to),...mailRecipients(cc),...mailRecipients(bcc)].some(x => !validMailAddress(x))) { setNotice('יש להזין כתובות מייל תקינות'); return; }
    if (!renderedSubject.trim() || !renderedText.trim() || /\{\{[\w.]+\}\}/.test(renderedSubject + renderedText)) { setNotice('יש להשלים נושא, תוכן ושדות חסרים בתבנית'); return; }
    sending.current = true; setBusy(true); setNotice(''); let dispatched = false;
    try {
      const headers = await authHeaders();
      const attachments: MailAttachment[] = []; let total = 0;
      for (const file of chosen) { const ready = await prepareAttachment(file); total += atob(ready.contentBase64!).length; if (total > MAIL_MAX_BYTES) throw new Error('ניתן לצרף עד 3MB בסך הכול'); attachments.push(ready); }
      dispatched = true;
      const response = await fetch('/api/send-email', {method:'POST', headers, body: JSON.stringify({projectId: context.projectId, module: context.module, recordId: context.recordId, recordIds: context.recordIds, requestId: requestId.current, senderEmail: selectedSender, to, cc, bcc, subject: renderedSubject, text: renderedText, attachments})});
      const result = await response.json();
      if (!response.ok) { if (response.status === 409) setLocked(true); throw new Error(result.error || 'השליחה נכשלה'); }
      setNotice([statusLabels[result.status] || result.error, result.error, result.warning, result.rejected?.length ? `נמענים שנדחו: ${result.rejected.join(', ')}` : ''].filter(Boolean).join(' · '));
      setFinished(Boolean(result.success)); setLocked(true);
      await loadHistory();
    } catch (error) {
      setNotice((error instanceof Error ? error.message : 'השליחה נכשלה') + (dispatched ? ' — יש לבדוק את ההיסטוריה לפני ניסיון נוסף.' : ''));
      if (dispatched) { setLocked(true); await loadHistory(); }
    } finally { sending.current = false; setBusy(false); }
  }
  const inputStyle = {width:'100%', padding:10, border:'1px solid #cbd5e1', borderRadius:8, background:'#fff', color:'#0f172a'};
  const buttonStyle = {padding:'10px 16px', border:'1px solid #cbd5e1', borderRadius:8, cursor:'pointer'};
  return <div style={{position:'fixed', inset:0, zIndex:10000, background:'#0f172a88', display:'grid', placeItems:'center', padding:16}}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="email-title" dir="rtl" style={{width:'min(850px,100%)', maxHeight:'92vh', overflow:'auto', background:'white', color:'#0f172a', padding:24, borderRadius:16}} onKeyDown={event => {
      if (event.key === 'Escape' && !busy && !generating) onClose();
      if (event.key === 'Tab') { const nodes = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]'); if (nodes?.length) { const first=nodes[0], last=nodes[nodes.length-1]; if (event.shiftKey && document.activeElement===first) {event.preventDefault();last.focus();} else if (!event.shiftKey && document.activeElement===last) {event.preventDefault();first.focus();} } }
    }}>
      <h2 id="email-title" style={{fontSize:22,fontWeight:700,marginBottom:12}}>שליחה במייל — {context.title}</h2>
      <label>מאת — חשבון מייל מאושר בפרויקט<select style={inputStyle} value={selectedSender} disabled={busy || directoryLoading || finished || locked} onChange={e=>setSelectedSender(e.target.value)}><option value="">{directoryLoading ? 'טוען חשבונות מייל…' : 'בחירת שולח'}</option>{senders.map(x=><option key={x.id} value={x.email}>{x.name} — {x.email}</option>)}</select></label>
      {directoryError && <p role="alert">{directoryError} <button style={buttonStyle} onClick={()=>void loadDirectory()}>נסה שוב</button></p>}
      {!directoryLoading && !directoryError && !senders.length && <p role="alert">לא נמצא חשבון שליחה פעיל ברשימת משתמשי הפרויקט. יש לשמור לחשבון המאושר סיסמת אפליקציה במסך משתמשי הפרויקט.</p>}
      {!canSend && <p role="alert">אין הרשאת שליחה. נדרשת כניסת Supabase והרשאת כתיבה בפרויקט.</p>}
      <fieldset disabled={busy || finished || locked || generating} style={{border:0, padding:0, display:'grid', gap:12}}>
        <label>תבנית<select style={inputStyle} defaultValue="document" onChange={e => { const template = mailTemplates.find(x => x.id === e.target.value)!; setSubject(mergeMailData(template.subject, context.data)); setText(mergeMailData(template.text, context.data)); setPreview(false); }}>{mailTemplates.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>אל<input ref={initialFocus} dir="ltr" style={inputStyle} value={to} onChange={e=>{setTo(e.target.value);setPreview(false);}} placeholder="name@example.com, name2@example.com" /></label>
        <label>בחירה מהמיילים המאושרים במערכת<select value="" style={inputStyle} disabled={directoryLoading} onChange={e=>{setTo(mailRecipients([to,e.target.value]).join(', '));setPreview(false);}}><option value="">{directoryLoading ? 'טוען נמענים…' : 'הוספת נמען מאושר'}</option>{directoryContacts.map(x=><option key={x.id} value={x.email}>{x.name} — {x.email}</option>)}</select></label>
        {!directoryLoading && !directoryError && !directoryContacts.length && <p>לא נמצאו כתובות פעילות ברשימת משתמשי הפרויקט.</p>}
        {(['CC','BCC'] as const).map(kind=><label key={kind}>הוספת נמען מאושר ל-{kind}<select value="" style={inputStyle} onChange={e=>{const update=kind==='CC'?setCc:setBcc;update(prev=>mailRecipients([prev,e.target.value]).join(', '));setPreview(false);}}><option value="">בחירת כתובת</option>{directoryContacts.map(x=><option key={x.id} value={x.email}>{x.name} — {x.email}</option>)}</select></label>)}
        <label>עותק CC<input dir="ltr" style={inputStyle} value={cc} onChange={e=>{setCc(e.target.value);setPreview(false);}} /></label>
        <label>עותק מוסתר BCC<input dir="ltr" style={inputStyle} value={bcc} onChange={e=>{setBcc(e.target.value);setPreview(false);}} /></label>
        <label>נושא<input style={inputStyle} value={subject} onChange={e=>{setSubject(e.target.value);setPreview(false);}} /></label>
        <label>תוכן<textarea rows={6} style={inputStyle} value={text} onChange={e=>{setText(e.target.value);setPreview(false);}} /></label>
        <small>ניתן לשלב שדות כגון {'{{title}}, {{projectName}}, {{status}}, {{location}}'}. שדות חסרים יש להשלים לפני השליחה.</small>
        <strong>קבצים מצורפים — עד 30 קבצים ועד 3MB יחד</strong>
        {context.generateDocuments && <button type="button" style={buttonStyle} disabled={generating || generated} onClick={()=>void generate()}>{generating ? 'מכין PDF…' : generated ? 'PDF נוסף לרשימה' : 'הוספת PDF של הטופס'}</button>}
        {files.map(file=><label key={file.id}><input type="checkbox" checked={selected.includes(file.id)} onChange={e=>{setSelected(prev=>e.target.checked ? [...prev,file.id] : prev.filter(x=>x!==file.id));setPreview(false);}} /> {file.filename}</label>)}
        {!files.length && <p>לא נמצאו קבצים משויכים לרשומה.</p>}
        <label>הוספת קבצים<input type="file" multiple onChange={async e=>{
          const added = Array.from(e.target.files || []); e.target.value=''; setPreview(false);
          if (files.length + added.length > 30 || added.some(f=>f.size > MAIL_MAX_BYTES)) {setNotice('עד 30 קבצים, וכל קובץ עד 3MB');return;}
          setGenerating(true);
          try {const docs = await Promise.all(added.map(async file=>({id:crypto.randomUUID(),filename:file.name,mimeType:file.type || 'application/octet-stream',contentBase64:await blobBase64(file)})));setFiles(prev=>[...prev,...docs]);setSelected(prev=>[...prev,...docs.map(x=>x.id)]);} catch {setNotice('קריאת הקבצים נכשלה');} finally {setGenerating(false);}
        }} /></label>
        <small>ביטול סימון מסיר את הקובץ מהמייל בלבד.</small>
      </fieldset>
      {preview && <section aria-label="תצוגה מקדימה" style={{marginTop:16,padding:16,background:'#f1f5f9',borderRadius:10}}>
        <h3>תצוגה מקדימה</h3><p>אל: {to} | CC: {cc || '—'} | BCC: {bcc || '—'}</p><strong>{renderedSubject}</strong><p style={{whiteSpace:'pre-wrap'}}>{renderedText + MAIL_SIGNATURE}</p><p>קבצים: {chosen.map(x=>x.filename).join(', ') || 'ללא קבצים'}</p>
      </section>}
      <p role="status" aria-live="polite">{notice}</p>
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        <button style={buttonStyle} disabled={busy || generating} onClick={()=>setPreview(true)}>תצוגה מקדימה</button>
        <button style={{...buttonStyle,background:'#0f766e',color:'white'}} disabled={!canSend || !selectedSender || directoryLoading || !!directoryError || !preview || busy || generating || finished || locked} onClick={()=>void send()}>{busy?'שולח…':'שליחת המייל'}</button>
        <button style={buttonStyle} disabled={busy || generating} onClick={onClose}>סגירה</button>
      </div>
      <details style={{marginTop:20}}><summary>היסטוריית שליחה</summary>
        <label><input type="checkbox" checked={projectHistory} onChange={e=>{setProjectHistory(e.target.checked);void loadHistory(e.target.checked);}} /> כל הרשומות בפרויקט</label>
        <button style={buttonStyle} onClick={()=>void loadHistory()}>רענון</button><p role="status">{historyError}</p>
        {!historyError && !history.length && <p>אין שליחות קודמות.</p>}
        {history.map(item=><article key={item.id} style={{borderBottom:'1px solid #ddd',padding:8}}><strong>{item.subject}</strong><p>{new Date(item.created_at).toLocaleString('he-IL')} — {statusLabels[item.status]}</p><p>{item.to_addresses.join(', ')}</p><p>{item.attachment_names.join(', ')}</p>{item.error && <p>{item.error}</p>}</article>)}
      </details>
    </div>
  </div>;
}
