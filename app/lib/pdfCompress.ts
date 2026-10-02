// הקטנת קובצי PDF גדולים לפני שמירה במערכת.
// כל עמוד מומר לתמונה באיכות קריאה והדפסה (כ-150 DPI), והקובץ נבנה מחדש.
// מתאים במיוחד למסמכים סרוקים (תוכניות ב"א, נהלים, דוחות מתכננים).
// אם הקובץ המוקטן לא חוסך לפחות 20% – נשמר הקובץ המקורי כמו שהוא.
// שים לב: בקובץ המוקטן הטקסט הוא חלק מהתמונה (לא ניתן לסמן/להעתיק טקסט).

const PDFJS_VERSION = "3.11.174";
const PDFJS_SCRIPT = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

export const PDF_COMPRESS_MIN_BYTES = 3 * 1024 * 1024;
const MAX_PAGES = 300;
const TARGET_DPI = 150;
const MAX_SIDE_PX = 2000;
const JPEG_QUALITY = 0.72;

const loadPdfJs = async (): Promise<any> => {
  const existing = (window as any).pdfjsLib;
  if (existing) return existing;
  await new Promise<void>((resolve, reject) => {
    const previous = document.querySelector(`script[data-reference-pdfjs="true"]`) as HTMLScriptElement | null;
    if (previous) {
      if ((window as any).pdfjsLib) return resolve();
      previous.addEventListener("load", () => resolve(), { once: true });
      previous.addEventListener("error", () => reject(new Error("pdf.js load failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = PDFJS_SCRIPT;
    script.async = true;
    script.dataset.referencePdfjs = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("pdf.js load failed"));
    document.head.appendChild(script);
  });
  const pdfjs = (window as any).pdfjsLib;
  if (!pdfjs) throw new Error("pdf.js unavailable");
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  return pdfjs;
};

export const isPdfFile = (file: File) => /pdf/i.test(file.type) || /\.pdf$/i.test(file.name);

export async function compressLargePdf(
  file: File,
  onProgress?: (page: number, total: number) => void,
): Promise<File> {
  if (typeof window === "undefined" || !isPdfFile(file) || file.size < PDF_COMPRESS_MIN_BYTES) return file;
  try {
    const pdfjs = await loadPdfJs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    try {
      if (!doc.numPages || doc.numPages > MAX_PAGES) return file;
      const { jsPDF } = await import("jspdf");
      let output: any = null;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return file;
      for (let index = 1; index <= doc.numPages; index += 1) {
        onProgress?.(index, doc.numPages);
        const page = await doc.getPage(index);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(TARGET_DPI / 72, MAX_SIDE_PX / Math.max(base.width, base.height));
        const viewport = page.getViewport({ scale });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        const jpeg = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        const orientation = base.width > base.height ? "landscape" : "portrait";
        if (!output) output = new jsPDF({ unit: "pt", format: [base.width, base.height], orientation, compress: true });
        else output.addPage([base.width, base.height], orientation);
        output.addImage(jpeg, "JPEG", 0, 0, base.width, base.height, undefined, "FAST");
        page.cleanup?.();
      }
      if (!output) return file;
      const blob: Blob = output.output("blob");
      if (blob.size >= file.size * 0.8) return file;
      return new File([blob], file.name, { type: "application/pdf", lastModified: Date.now() });
    } finally {
      await doc.destroy?.();
    }
  } catch (error) {
    console.warn("PDF compression skipped", error);
    return file;
  }
}

export const formatFileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
