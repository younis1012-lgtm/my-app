"use client";

import { useRef, useState } from "react";
import { parseLabCertificateText, type LabCertificateResults } from "../lib/labCertificateParser";

type FileInfo = {
  name: string;
  type: string;
  dataUrl: string;
  uploadedAt: string;
};

type Props = {
  attachmentName?: string;
  existingDataUrl?: string;
  initialResults?: LabCertificateResults;
  onSave: (results: LabCertificateResults, fileInfo?: FileInfo) => void;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const dataUrlToArrayBuffer = async (dataUrl: string) => {
  const response = await fetch(dataUrl);
  return await response.arrayBuffer();
};

async function extractTextFromPdfBuffer(buffer: ArrayBuffer) {
  const pdfjs = await import("pdfjs-dist");

  pdfjs.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

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

export default function LabCertificateScanButton({
  attachmentName,
  existingDataUrl,
  initialResults,
  onSave,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const scanBuffer = async (buffer: ArrayBuffer, fileInfo?: FileInfo) => {
    setBusy(true);
    try {
      const rawText = await extractTextFromPdfBuffer(buffer);
      const parsed = parseLabCertificateText(rawText);

      onSave(parsed, fileInfo);
      alert("התעודה נסרקה ונשמרה לריכוזים.");
    } catch (error) {
      console.error(error);
      alert("לא הצלחתי לסרוק את ה-PDF. אם זה צילום סרוק ולא PDF טקסטואלי, צריך OCR.");
    } finally {
      setBusy(false);
    }
  };

  const handleExistingScan = async () => {
    if (!existingDataUrl) {
      fileInputRef.current?.click();
      return;
    }

    const buffer = await dataUrlToArrayBuffer(existingDataUrl);
    await scanBuffer(buffer, {
      name: attachmentName || "תעודת מעבדה",
      type: "application/pdf",
      dataUrl: existingDataUrl,
      uploadedAt: new Date().toISOString(),
    });
  };

  const handleFile = async (file?: File) => {
    if (!file) return;

    const dataUrl = await readFileAsDataUrl(file);
    const buffer = await file.arrayBuffer();

    await scanBuffer(buffer, {
      name: file.name,
      type: file.type || "application/pdf",
      dataUrl,
      uploadedAt: new Date().toISOString(),
    });
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => void handleExistingScan()}
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
        {busy
          ? "סורק תעודה..."
          : initialResults?.certificateNo
            ? "סרוק שוב תעודה"
            : existingDataUrl
              ? "סרוק תעודה מצורפת"
              : "סרוק תעודה"}
      </button>
    </>
  );
}
