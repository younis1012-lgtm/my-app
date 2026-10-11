// הקטנת תמונות לפני שמירה – צילומי טלפון וצילומי מסך גדולים.
// יעד: צד ארוך עד 1800 פיקסלים, JPEG באיכות 0.78 – כ-200–450KB לתמונה, קריא היטב גם לתעודות מצולמות.
// לא נוגעים ב-PDF (כדי לא לפגוע בקריאת הטקסט שבו), בתמונות קטנות, או בפורמטים שהדפדפן לא יודע לפתוח.

export const SHRINK_MAX_SIDE = 1800;
export const SHRINK_QUALITY = 0.78;
const JPEG_MIN_BYTES = 300 * 1024;
// PNG / WebP הם לעיתים חתימות או לוגו עם רקע שקוף – ממירים רק כשהם כבדים באמת (צילום מסך / צילום)
const OTHER_MIN_BYTES = 700 * 1024;

const typeOf = (blob: Blob) => String(blob?.type || "").toLowerCase();

export const shouldShrinkImage = (blob: Blob) => {
  const type = typeOf(blob);
  if (type === "image/jpeg" || type === "image/jpg") return blob.size >= JPEG_MIN_BYTES;
  if (type === "image/png" || type === "image/webp" || type === "image/bmp") return blob.size >= OTHER_MIN_BYTES;
  return false;
};

export async function shrinkImageBlob(blob: Blob): Promise<Blob> {
  if (typeof document === "undefined" || !shouldShrinkImage(blob)) return blob;
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image decode failed"));
      img.src = url;
    });
    const scale = Math.min(1, SHRINK_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return blob;
    context.fillStyle = "#ffffff"; // רקע לבן במקום שקיפות
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", SHRINK_QUALITY));
    return result && result.size < blob.size * 0.9 ? result : blob;
  } catch {
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** קובץ להעלאה: תמונה גדולה מוקטנת (השם מקבל סיומת jpg); כל קובץ אחר חוזר כמו שהוא */
export async function shrinkUploadFile(file: File): Promise<File> {
  const smaller = await shrinkImageBlob(file);
  if (smaller === file) return file;
  const name = /\.(jpe?g)$/i.test(file.name) ? file.name : `${file.name.replace(/\.[^.]+$/, "")}.jpg`;
  return new File([smaller], name, { type: "image/jpeg", lastModified: file.lastModified });
}
