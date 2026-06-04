"use client";

import { useState } from "react";

const InlineCode = ({ children }: { children: string }) => (
  <b dir="ltr" style={{ unicodeBidi: "isolate" }}>
    פרטי כניסה חסויים
  </b>
);

export function PasswordField({
  value,
  onChange,
  placeholder = "סיסמה",
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={{
          width: "100%",
          border: "1px solid #cbd5e1",
          borderRadius: 12,
          padding: "12px 44px 12px 14px",
          fontWeight: 800,
          fontSize: 16,
        }}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? "הסתר סיסמה" : "הצג סיסמה"}
        title={visible ? "הסתר סיסמה" : "הצג סיסמה"}
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          border: 0,
          background: "transparent",
          cursor: "pointer",
          fontSize: 20,
          padding: 4,
        }}
      >
        {visible ? "🙈" : "👁️"}
      </button>
    </div>
  );
}

export function ProjectLoginScreen({
  username,
  password,
  error,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: {
  username: string;
  password: string;
  error: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [showPasswordHelp, setShowPasswordHelp] = useState(false);
  const onResetAdminPassword = () => undefined;
  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f1f5f9",
        padding: 18,
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: "min(460px, 96vw)",
          background: "#fff",
          borderRadius: 22,
          padding: 24,
          boxShadow: "0 22px 70px rgba(15, 23, 42, 0.14)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 28, fontWeight: 950, color: "#0f172a" }}>
            Y.K QUALITY
          </div>
          <div style={{ color: "#475569", marginTop: 6, fontWeight: 700 }}>
            כניסה לפי Supabase Auth או שם משתמש פנימי
          </div>
        </div>

        <label
          style={{ display: "grid", gap: 7, marginBottom: 14, fontWeight: 900 }}
        >
          אימייל / שם משתמש / קוד פרויקט
          <input
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
            placeholder="לדוגמה: user@example.com, admin או 806"
            autoFocus
            autoComplete="username"
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "12px 14px",
              fontWeight: 800,
              fontSize: 16,
            }}
          />
        </label>

        <label
          style={{ display: "grid", gap: 7, marginBottom: 16, fontWeight: 900 }}
        >
          סיסמה
          <PasswordField
            value={password}
            onChange={onPasswordChange}
            autoComplete="current-password"
          />
        </label>

        <button
          type="button"
          onClick={() => setShowPasswordHelp((prev) => !prev)}
          style={{
            border: 0,
            background: "transparent",
            color: "#2563eb",
            fontWeight: 900,
            cursor: "pointer",
            padding: 0,
            marginBottom: showPasswordHelp ? 10 : 16,
            textDecoration: "underline",
          }}
        >
          שכחתי סיסמה
        </button>

        {showPasswordHelp ? (
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              color: "#1e3a8a",
              borderRadius: 12,
              padding: 12,
              fontWeight: 800,
              lineHeight: 1.7,
              marginBottom: 16,
            }}
          >
            <div style={{ fontWeight: 950, marginBottom: 4 }}>
              אפשרויות שחזור
            </div>
            <div>
              אם הוגדרת ב-Supabase Auth, התחבר עם כתובת המייל והסיסמה שלך.
            </div>
            <div>
              גיבוי פנימי: מנהל מערכת <InlineCode>admin</InlineCode> או{" "}
              <InlineCode>younis1012@gmail.com</InlineCode>, סיסמה{" "}
              <InlineCode>admin123</InlineCode>.
            </div>
            <div>
              פרויקט 806: שם משתמש <InlineCode>user806</InlineCode> או קוד{" "}
              <InlineCode>806</InlineCode>, סיסמה <InlineCode>806</InlineCode>.
            </div>
            <div>
              אם הסיסמה שונתה, יש להיכנס כמנהל ולשנות אותה דרך "ניהול משתמשים
              והרשאות".
            </div>
            <button
              type="button"
              onClick={onResetAdminPassword}
              style={{
                display: "none",
                width: "100%",
                border: "1px solid #2563eb",
                borderRadius: 10,
                background: "#dbeafe",
                color: "#1d4ed8",
                cursor: "pointer",
                fontWeight: 950,
                marginTop: 10,
                padding: "9px 12px",
              }}
            >
              איפוס סיסמת מנהל ל-admin123
            </button>
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              borderRadius: 12,
              padding: 10,
              fontWeight: 900,
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          style={{
            width: "100%",
            border: 0,
            borderRadius: 14,
            padding: "13px 16px",
            background: "#0f172a",
            color: "#fff",
            fontWeight: 950,
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          כניסה למערכת
        </button>
      </form>
    </div>
  );
}
