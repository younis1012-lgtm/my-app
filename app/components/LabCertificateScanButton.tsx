"use client";

import React from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

type Props = {
  attachmentName: string;
  initialResults?: any;
  onSave: (
    results: any,
    fileInfo: {
      name: string;
      type: string;
      dataUrl: string;
      uploadedAt: string;
    }
  ) => void;
};

export default function LabCertificateScanButton({
  attachmentName,
  onSave,
}: Props) {
  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();

      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
      }).promise;

      let text = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();

        const strings = content.items.map((item: any) => item.str);
        text += strings.join(" ");
      }

      // 🔍 parsing פשוט
      const parsed = {
        PI: text.match(/PI\s*[:\-]?\s*(\d+(\.\d+)?)/)?.[1],
        density: text.match(/Density\s*[:\-]?\s*(\d+(\.\d+)?)/)?.[1],
        certificateNo:
          text.match(/Certificate\s*No\s*[:\-]?\s*(\d+)/)?.[1] ||
          file.name,
      };

      // convert file to base64 (לשמירה)
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      onSave(parsed, {
        name: file.name,
        type: file.type,
        dataUrl,
        uploadedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("PDF parse error:", err);
    }
  };

  return (
    <div>
      <label className="border px-3 py-2 rounded cursor-pointer">
        📄 סרוק תעודה
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </label>
    </div>
  );
}