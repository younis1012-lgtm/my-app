"use client";

import { useEffect } from "react";

// הקטנת תמונות JPEG גדולות (בעיקר צילומי טלפון) לפני שהן נשמרות במערכת.
// צילום טלפון שוקל 3–6MB; אחרי ההקטנה כ-400–700KB, באיכות שמספיקה לקריאה ולהדפסה.
// כך בסיס הנתונים והתעבורה מ-Supabase נשארים בתוך המכסה החינמית.
// הקטנה רק ל-JPEG מעל 600KB; PDF, PNG ושאר הקבצים נשמרים כמו שהם.

const MIN_BYTES = 600 * 1024;
const MAX_SIDE = 2200;
const QUALITY = 0.82;

let installed = false;

async function compressJpeg(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image decode failed"));
      img.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return blob;
    context.drawImage(image, 0, 0, width, height);
    const result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    return result && result.size < blob.size ? result : blob;
  } catch {
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ImageUploadCompressor() {
  useEffect(() => {
    if (installed || typeof window === "undefined" || typeof FileReader === "undefined") return;
    installed = true;
    const original = FileReader.prototype.readAsDataURL;
    FileReader.prototype.readAsDataURL = function patchedReadAsDataURL(this: FileReader, blob: Blob) {
      const type = String(blob?.type || "").toLowerCase();
      if (!(blob instanceof Blob) || (type !== "image/jpeg" && type !== "image/jpg") || blob.size < MIN_BYTES) {
        return original.call(this, blob);
      }
      void compressJpeg(blob).then(
        (smaller) => original.call(this, smaller),
        () => original.call(this, blob),
      );
    };
  }, []);
  return null;
}
