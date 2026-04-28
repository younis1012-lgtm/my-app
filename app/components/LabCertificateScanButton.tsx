"use client";

import { useEffect, useRef, useState } from "react";
import { parseLabCertificateText, type LabCertificateResults } from "../lib/labCertificateParser";

type FileInfo = {
  name: string;
  type: string;
  dataUrl: string;
  uploadedAt: string;
};

type Props = {
  attachmentName?: string;
  initialResults?: LabCertificateResults;
  onSave?: (results: LabCertificateResults, fileInfo?: FileInfo) => void;
  onScanResult?: (data: LabCertificateResults) => void;
};

const numericFields = new Set<string>([
  "sieve3",
  "sieve15",
  "sieve1",
  "sieve38",
  "sieve34",
  "sieve4",
  "sieve10",
  "sieve40",
  "sieve200",
  "ll",
  "pl",
  "pi",
  "sandEquivalent",
  "specificGravity",
  "absorption",
  "losAngeles",
  "maxDensity",
  "optimumMoisture",
  "totalMoisture",
  "stone34",
]);

const fieldLabels: Array<[keyof LabCertificateResults, string]> = [
  ["certificateNo", "מס׳ תעודה"],
  ["samplingDate", "תאריך דגימה"],
  ["reportDate", "תאריך הוצאה"],
  ["materialSource", "מקור החומר"],
  ["location", "מיקום / מקום נטילה"],
  ["sieve3", 'נפה 3"'],
  ["sieve15", 'נפה 1.5"'],
  ["sieve34", 'נפה 3/4"'],
  ["sieve4", "#4"],
  ["sieve10", "#10"],
  ["sieve40", "#40"],
  ["sieve200", "#200"],
  ["ll", "LL"],
  ["pl", "PL"],
  ["pi", "PI"],
  ["sandEquivalent", "שווה ערך חול"],
  ["specificGravity", "צפיפות ממשית"],
  ["absorption", "ספיגות"],
  ["losAngeles", "לוס אנג׳לס"],
  ["aashto", "מיון AASHTO"],
  ["maxDensity", "צפיפות מקסימלית"],
  ["optimumMoisture", "רטיבות אופטימלית"],
  ["conclusion", "מסקנה"],
];

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("לא ניתן לקרוא את הקובץ"));
    reader.readAsDataURL(file);
  });

async function extractTextFromPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;

  let text = "";
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    text +=
      content.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .filter(Boolean)
        .join(" ") + "\n";
  }

  return text;
}

export default function LabCertificateScanButton({ attachmentName, initialResults, onSave, onScanResult }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<LabCertificateResults>(initialResults ?? {});
  const [pendingFileInfo, setPendingFileInfo] = useState<FileInfo | undefined>(undefined);

  useEffect(() => {
    setResults(initialResults ?? {});
  }, [initialResults]);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const [rawText, dataUrl] = await Promise.all([extractTextFromPdf(file), fileToDataUrl(file)]);
      const parsed = parseLabCertificateText(rawText);
      const fileInfo: FileInfo = {
        name: file.name,
        type: file.type || "application/pdf",
        dataUrl,
        uploadedAt: new Date().toLocaleString("he-IL"),
      };

      setResults(parsed);
      setPendingFileInfo(fileInfo);
      setOpen(true);
      onScanResult?.(parsed);
    } catch (error) {
      console.error("PDF parse error:", error);
      alert("לא הצלחתי לסרוק את ה-PDF. אם זו תמונה סרוקה ולא PDF טקסטואלי, צריך OCR או הזנה ידנית.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const updateField = (key: keyof LabCertificateResults, value: string) => {
    setResults((prev) => ({
      ...prev,
      [key]: numericFields.has(String(key)) && value !== "" ? Number(value.replace(",", ".")) : value,
    }));
  };

  const saveResults = () => {
    onSave?.(results, pendingFileInfo);
    onScanResult?.(results);
    setOpen(false);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={(event) => handleFile(event.target.files?.[0])}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
        style={{
          border: "1px solid #0f172a",
          background: busy ? "#f1f5f9" : "#fff",
          borderRadius: 10,
          padding: "8px 12px",
          fontWeight: 900,
          cursor: busy ? "wait" : "pointer",
          color: "#0f172a",
        }}
      >
        {busy ? "סורק תעודה..." : initialResults?.certificateNo ? "סרוק מחדש" : "סרוק תעודה"}
      </button>

      {open ? (
        <div
          dir="rtl"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,.45)",
            zIndex: 9999,
            display: "grid",
            placeItems: "center",
            padding: 18,
          }}
        >
          <div style={{ width: "min(980px, 96vw)", maxHeight: "88vh", overflow: "auto", background: "#fff", borderRadius: 18, padding: 18, boxShadow: "0 20px 70px rgba(0,0,0,.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>בדיקת תוצאות סריקת תעודה</h2>
                <div style={{ color: "#64748b", marginTop: 4 }}>{pendingFileInfo?.name || attachmentName || "תעודת מעבדה"}</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} style={{ border: 0, background: "#fee2e2", color: "#991b1b", borderRadius: 10, padding: "8px 12px", fontWeight: 900 }}>
                סגור
              </button>
            </div>

            <div style={{ marginTop: 14, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e3a8a", borderRadius: 12, padding: 12, fontWeight: 800, lineHeight: 1.6 }}>
              המערכת חילצה נתונים מה-PDF. בדוק/תקן במידת הצורך ואז לחץ "אשר ושמור". הנתונים יישמרו בשורת רשימת התיוג וישמשו את הריכוזים.
            </div>

            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
              {fieldLabels.map(([key, label]) => (
                <label key={String(key)} style={{ display: "grid", gap: 4, fontWeight: 800 }}>
                  <span>{label}</span>
                  <input
                    value={String(results[key] ?? "")}
                    onChange={(event) => updateField(key, event.target.value)}
                    style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "8px 10px", fontWeight: 700 }}
                  />
                </label>
              ))}
            </div>

            <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-start", flexWrap: "wrap" }}>
              <button type="button" onClick={saveResults} style={{ border: 0, background: "#0f172a", color: "#fff", borderRadius: 12, padding: "12px 18px", fontWeight: 900 }}>
                אשר ושמור לריכוזים
              </button>
              <button type="button" onClick={() => setOpen(false)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 12, padding: "12px 18px", fontWeight: 900 }}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
