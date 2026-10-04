// מעתיק את כל הקבצים (Storage) מהפרויקט הישן לחדש: דליים, תיקיות וקבצים, כולל סוג הקובץ וזמן המטמון.
// רץ רק בתוך GitHub Actions. המפתחות מגיעים מ-GitHub Secrets ולא מודפסים.
const { SRC_URL, TGT_URL, SRC_KEY, TGT_KEY } = process.env;
if (!SRC_URL || !TGT_URL || !SRC_KEY || !TGT_KEY) throw new Error("missing storage env");

const headers = (key, extra = {}) => ({
  apikey: key,
  ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
  ...extra,
});

async function api(base, key, path, init = {}) {
  const res = await fetch(`${base}/storage/v1${path}`, { ...init, headers: headers(key, init.headers) });
  if (!res.ok) throw new Error(`${init.method || "GET"} ${path} -> ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res;
}

async function listAll(base, key, bucket, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await api(base, key, `/object/list/${bucket}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
    });
    const entries = await res.json();
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) files.push(...(await listAll(base, key, bucket, path)));
      else files.push({ path, metadata: entry.metadata || {} });
    }
    if (entries.length < 1000) break;
  }
  return files;
}

const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");

const srcBuckets = await (await api(SRC_URL, SRC_KEY, "/bucket")).json();
const tgtBuckets = await (await api(TGT_URL, TGT_KEY, "/bucket")).json();
const summary = [];
for (const bucket of srcBuckets) {
  if (!tgtBuckets.some((b) => b.id === bucket.id)) {
    await api(TGT_URL, TGT_KEY, "/bucket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: bucket.id,
        name: bucket.name,
        public: bucket.public,
        file_size_limit: bucket.file_size_limit ?? null,
        allowed_mime_types: bucket.allowed_mime_types ?? null,
      }),
    });
  }
  const files = await listAll(SRC_URL, SRC_KEY, bucket.id);
  const existing = new Set((await listAll(TGT_URL, TGT_KEY, bucket.id)).map((f) => f.path));
  let copied = 0, skipped = 0, failed = 0;
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const file = files[next++];
      if (existing.has(file.path)) { skipped++; continue; }
      try {
        const res = await api(SRC_URL, SRC_KEY, `/object/authenticated/${bucket.id}/${encodePath(file.path)}`);
        const body = Buffer.from(await res.arrayBuffer());
        await api(TGT_URL, TGT_KEY, `/object/${bucket.id}/${encodePath(file.path)}`, {
          method: "POST",
          headers: {
            "Content-Type": file.metadata.mimetype || res.headers.get("content-type") || "application/octet-stream",
            "cache-control": file.metadata.cacheControl || "max-age=3600",
            "x-upsert": "true",
          },
          body,
        });
        copied++;
      } catch (error) {
        failed++;
        console.error(`storage copy failed: ${bucket.id}/${file.path}: ${error.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  summary.push({ bucket: bucket.id, public: bucket.public, total: files.length, copied, skipped, failed });
}
console.log(JSON.stringify(summary));
if (summary.some((s) => s.failed)) process.exit(2);
