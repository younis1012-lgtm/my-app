"use client";

import { useEffect, useMemo, useState } from "react";
import { styles } from "./common";

type QualityDocument = {
  id: string; projectId: string; category: string; documentNo: string; title: string;
  revision: string; date: string; status: string; notes: string; fileName: string;
  fileType: string; fileSize: number; fileUrl: string; storagePath: string; uploadedAt: string;
};

const categories = ["תוכנית הבטחת איכות", "נהלי עבודה", "הוראות עבודה", "טפסים ונספחים", "מפרטים ותקנים", "תוכניות איכות של קבלני משנה", "אחר"];
const statuses = ["טיוטה", "לאישור", "מאושר", "מבוטל", "הוחלף במהדורה חדשה"];
const MAX_FILE_SIZE = 500 * 1024 * 1024;
const formatSize = (size: number) => size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
const safePart = (value: string) => value.replace(/[^a-zA-Z0-9.א-ת_-]/g, "_").slice(0, 100) || "file";

export function QualityDocumentsSection({ projectId, canWrite, supabase }: { projectId: string; canWrite: boolean; supabase: any }) {
  const storageKey = `yk-quality-documents-${projectId}`;
  const indexPath = `quality-documents/${safePart(projectId)}/index.json`;
  const emptyForm = { category: categories[0], documentNo: "", title: "", revision: "", date: new Date().toISOString().slice(0, 10), status: "טיוטה", notes: "" };
  const [records, setRecords] = useState<QualityDocument[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("הכול");
  const [statusFilter, setStatusFilter] = useState("הכול");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const saveLocal = (next: QualityDocument[]) => {
    setRecords(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };
  const saveCloudIndex = async (next: QualityDocument[]) => {
    if (!supabase) return;
    const blob = new Blob([JSON.stringify(next)], { type: "application/json;charset=utf-8" });
    const result = await supabase.storage.from("attachments").upload(indexPath, blob, { upsert: true, contentType: "application/json" });
    if (result.error) throw result.error;
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      const local = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (Array.isArray(local) && active) setRecords(local);
      if (!supabase) return;
      const result = await supabase.storage.from("attachments").download(indexPath);
      if (!result.error && result.data) {
        const cloud = JSON.parse(await result.data.text());
        if (Array.isArray(cloud) && active) saveLocal(cloud);
      }
    };
    void load().catch((error) => console.warn("Quality documents index load failed", error));
    return () => { active = false; };
  }, [projectId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("he");
    return records.filter((record) =>
      (categoryFilter === "הכול" || record.category === categoryFilter) &&
      (statusFilter === "הכול" || record.status === statusFilter) &&
      (!q || [record.documentNo, record.title, record.revision, record.fileName, record.notes].join(" ").toLocaleLowerCase("he").includes(q)),
    );
  }, [records, search, categoryFilter, statusFilter]);

  const upload = async () => {
    if (!canWrite) return;
    if (!file || !form.title.trim()) return alert("יש להזין שם מסמך ולבחור קובץ.");
    if (file.size > MAX_FILE_SIZE) return alert("הקובץ גדול מ־500MB. יש לפצל אותו או להעלות קובץ דחוס קטן יותר.");
    if (!supabase) return alert("שירות אחסון הקבצים אינו מחובר. לא ניתן לשמור קובץ גדול באופן בטוח.");
    setUploading(true); setMessage(`מעלה ${file.name}... אין לסגור את החלון.`);
    try {
      const id = crypto.randomUUID();
      const storagePath = `quality-documents/${safePart(projectId)}/${safePart(form.category)}/${Date.now()}-${id}-${safePart(file.name)}`;
      const result = await supabase.storage.from("attachments").upload(storagePath, file, { upsert: false, contentType: file.type || "application/octet-stream", cacheControl: "3600" });
      if (result.error) throw result.error;
      const publicData = supabase.storage.from("attachments").getPublicUrl(storagePath).data;
      const now = new Date().toISOString();
      const next = records.map((record) => form.documentNo.trim() && record.documentNo === form.documentNo.trim() && record.status !== "מבוטל" ? { ...record, status: "הוחלף במהדורה חדשה" } : record);
      next.unshift({ id, projectId, ...form, title: form.title.trim(), documentNo: form.documentNo.trim(), revision: form.revision.trim(), fileName: file.name, fileType: file.type, fileSize: file.size, fileUrl: publicData.publicUrl, storagePath, uploadedAt: now });
      saveLocal(next); await saveCloudIndex(next);
      setForm(emptyForm); setFile(null); setMessage("המסמך הועלה ונשמר בהצלחה.");
    } catch (error: any) {
      setMessage("");
      alert(`העלאת הקובץ נכשלה: ${error?.message || "שגיאת אחסון"}. ייתכן שיש להגדיל את מגבלת הקובץ ב־Supabase Storage.`);
    } finally { setUploading(false); }
  };

  const remove = async (record: QualityDocument) => {
    if (!canWrite || !confirm(`למחוק את ${record.title}?`)) return;
    const next = records.filter((item) => item.id !== record.id);
    if (supabase && record.storagePath) await supabase.storage.from("attachments").remove([record.storagePath]);
    saveLocal(next); await saveCloudIndex(next).catch((error) => alert(error?.message || "עדכון האינדקס נכשל"));
  };

  return <section dir="rtl" style={{ display: "grid", gap: 16 }}>
    <div><h2 style={{ margin: 0, fontSize: 26, fontWeight: 950 }}>תוכנית הבטחת איכות ונהלים</h2><div style={{ color: "#64748b", marginTop: 5 }}>ניהול מסמכים, מהדורות ונהלים. הקבצים נטענים רק בעת צפייה או הורדה.</div></div>
    <div style={{ ...styles.card, display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 950, fontSize: 18 }}>הוספת מסמך</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
        <label>קטגוריה<select style={styles.input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>מספר מסמך<input style={styles.input} value={form.documentNo} onChange={(e) => setForm({ ...form, documentNo: e.target.value })} /></label>
        <label>שם המסמך *<input style={styles.input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label>מהדורה<input style={styles.input} value={form.revision} onChange={(e) => setForm({ ...form, revision: e.target.value })} /></label>
        <label>תאריך<input type="date" style={styles.input} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
        <label>סטטוס<select style={styles.input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{statuses.map((x) => <option key={x}>{x}</option>)}</select></label>
      </div>
      <label>הערות<textarea style={{ ...styles.input, minHeight: 70 }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      <label style={{ border: "2px dashed #94a3b8", borderRadius: 14, padding: 16, background: "#f8fafc", cursor: "pointer" }}><strong>בחירת קובץ — עד 500MB</strong><input type="file" disabled={!canWrite || uploading} style={{ display: "block", marginTop: 10 }} onChange={(e) => setFile(e.target.files?.[0] || null)} />{file ? <div style={{ marginTop: 7 }}>{file.name} · {formatSize(file.size)}</div> : null}</label>
      <button type="button" style={styles.primaryBtn} disabled={!canWrite || uploading} onClick={() => void upload()}>{uploading ? "מעלה קובץ..." : "העלה ושמור מסמך"}</button>
      {message ? <div style={{ color: message.includes("בהצלחה") ? "#166534" : "#1d4ed8", fontWeight: 850 }}>{message}</div> : null}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,1fr) repeat(2,minmax(160px,220px))", gap: 10 }}><input style={styles.input} placeholder="חיפוש לפי שם, מספר, מהדורה או קובץ..." value={search} onChange={(e) => setSearch(e.target.value)} /><select style={styles.input} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option>הכול</option>{categories.map((x) => <option key={x}>{x}</option>)}</select><select style={styles.input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>הכול</option>{statuses.map((x) => <option key={x}>{x}</option>)}</select></div>
    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 14 }}><table style={{ width: "100%", minWidth: 1000, borderCollapse: "collapse", background: "#fff" }}><thead><tr>{["קטגוריה", "מספר", "שם מסמך", "מהדורה", "תאריך", "סטטוס", "קובץ", "גודל", "פעולות"].map((x) => <th key={x} style={{ padding: 12, textAlign: "right", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>{x}</th>)}</tr></thead><tbody>{filtered.map((record) => <tr key={record.id}>{[record.category, record.documentNo || "—", record.title, record.revision || "—", record.date, record.status].map((x, i) => <td key={i} style={{ padding: 12, borderBottom: "1px solid #eef2f7" }}>{x}</td>)}<td style={{ padding: 12, borderBottom: "1px solid #eef2f7" }}><a href={record.fileUrl} target="_blank" rel="noreferrer" download={record.fileName}>📎 {record.fileName}</a></td><td style={{ padding: 12, borderBottom: "1px solid #eef2f7" }}>{formatSize(record.fileSize)}</td><td style={{ padding: 12, borderBottom: "1px solid #eef2f7" }}><button type="button" style={styles.dangerBtn} disabled={!canWrite} onClick={() => void remove(record)}>מחק</button></td></tr>)}{!filtered.length ? <tr><td colSpan={9} style={{ padding: 28, textAlign: "center", color: "#64748b" }}>טרם נשמרו מסמכים מתאימים.</td></tr> : null}</tbody></table></div>
  </section>;
}
