"use client";

import { useEffect, useState } from "react";

// הודעות קטנות בפינת המסך במקום חלונות alert שעוצרים את העבודה.
// הודעת הצלחה נעלמת לבד; הודעת שגיאה או הנחיה נשארת עד שסוגרים אותה.

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };

let nextId = 1;
let toasts: Toast[] = [];
const listeners = new Set<(items: Toast[]) => void>();
const emit = () => listeners.forEach((listener) => listener(toasts));

const toneOf = (message: string): Toast["tone"] => {
  if (/שגיאה|נכשל|לא ניתן|אינ[והםן]? |אין הרשאה|חסר|יש ל|יש להזין|יש לבחור|לא נמצא|לא תקין|שים לב|חסם/.test(message)) return "error";
  if (/נשמר|הושלם|בהצלחה|נשלח|עודכן|הועתק|אושר|נוצר|נמחק/.test(message)) return "success";
  return "info";
};

export function dismissToast(id: number) {
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

export function showToast(message?: unknown) {
  const text = String(message ?? "").trim();
  if (!text) return;
  if (typeof window === "undefined") return;
  const toast: Toast = { id: nextId++, message: text, tone: toneOf(text) };
  // אם עדיין אין מקום להציג (המסך לא נטען) – חוזרים להתנהגות הרגילה
  if (!listeners.size) {
    window.alert(text);
    return;
  }
  toasts = [...toasts.filter((item) => item.message !== text), toast].slice(-4);
  emit();
  if (toast.tone !== "error") {
    const delay = Math.min(9000, 3500 + text.length * 40);
    window.setTimeout(() => dismissToast(toast.id), delay);
  }
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>(toasts);
  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);
  if (!items.length) return null;
  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: 20,
        bottom: 20,
        zIndex: 10000,
        display: "grid",
        gap: 10,
        maxWidth: "min(440px, calc(100vw - 40px))",
      }}
    >
      {items.map((toast) => {
        const dark = toast.tone === "success" || toast.tone === "info";
        return (
          <div
            key={toast.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              background: dark ? "#0b1f3a" : "#fff",
              color: dark ? "#fff" : "#b42318",
              border: dark ? "0" : "1px solid #f3c4be",
              borderRadius: 12,
              padding: "11px 14px",
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.5,
              boxShadow: "0 10px 24px rgba(11,31,58,.22)",
              whiteSpace: "pre-line",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                flex: "0 0 auto",
                width: 20,
                height: 20,
                marginTop: 1,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 800,
                background: toast.tone === "success" ? "#15803d" : toast.tone === "info" ? "#2f5d93" : "#fdecea",
                color: toast.tone === "error" ? "#b42318" : "#fff",
              }}
            >
              {toast.tone === "success" ? "✓" : toast.tone === "info" ? "i" : "!"}
            </span>
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="סגירת ההודעה"
              style={{ border: 0, background: "transparent", color: "inherit", opacity: 0.6, cursor: "pointer", fontSize: 14, padding: 0 }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
