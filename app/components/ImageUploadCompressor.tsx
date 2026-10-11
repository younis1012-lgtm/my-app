"use client";

import { useEffect } from "react";
import { shouldShrinkImage, shrinkImageBlob } from "../lib/shrinkImage";

// הקטנה אוטומטית של תמונות גדולות (צילומי טלפון, צילומי מסך) לפני שהן נשמרות במערכת –
// בכל מקום שבו קובץ נקרא לשמירה. PDF ושאר הקבצים נשמרים כמו שהם.
// כך בסיס הנתונים, האחסון והתעבורה מ-Supabase נשארים בתוך המכסה החינמית.

let installed = false;

export function ImageUploadCompressor() {
  useEffect(() => {
    if (installed || typeof window === "undefined" || typeof FileReader === "undefined") return;
    installed = true;
    const original = FileReader.prototype.readAsDataURL;
    FileReader.prototype.readAsDataURL = function patchedReadAsDataURL(this: FileReader, blob: Blob) {
      if (!(blob instanceof Blob) || !shouldShrinkImage(blob)) {
        return original.call(this, blob);
      }
      void shrinkImageBlob(blob).then(
        (smaller) => original.call(this, smaller),
        () => original.call(this, blob),
      );
    };
  }, []);
  return null;
}
