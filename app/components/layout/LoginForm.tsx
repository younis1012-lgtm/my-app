"use client";

import { useState } from "react";

const InlineCode = ({ children }: { children: string }) => (
  <b dir="ltr" style={{ unicodeBidi: "isolate" }}>
    {children}
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
  const [visible, setVisible] = useState(false);
  const onResetAdminPassword = () => undefined;

  return (
    <div dir="rtl" className="yk-login-exact">
      <style>{`
        .yk-login-exact {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          background: #061326 url('/yk-login-reference.png') center / cover no-repeat;
          color: #fff;
        }

        .yk-login-exact-form {
          position: absolute;
          z-index: 3;
          width: min(31.2vw, 500px);
          right: 11.7vw;
          top: 41.2vh;
        }

        .yk-login-exact-field {
          position: relative;
          width: 100%;
          height: clamp(44px, 5.7vh, 54px);
          margin-bottom: clamp(38px, 5.8vh, 58px);
        }

        .yk-login-exact-field input {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #ffffff;
          font-size: clamp(14px, 1.1vw, 18px);
          font-weight: 850;
          text-align: right;
          padding: 0 52px 0 54px;
          direction: rtl;
        }

        .yk-login-exact-field input::placeholder {
          color: rgba(255,255,255,0.86);
          opacity: 1;
        }

        .yk-login-eye {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 34px;
          height: 34px;
          border: 0;
          background: transparent;
          color: transparent;
          cursor: pointer;
        }

        .yk-login-submit {
          display: block;
          width: 100%;
          height: clamp(50px, 6vh, 60px);
          margin-top: clamp(10px, 1.4vh, 18px);
          border: 0;
          border-radius: 12px;
          background: transparent;
          color: transparent;
          cursor: pointer;
        }

        .yk-login-forgot {
          display: block;
          width: 170px;
          height: 34px;
          margin: clamp(12px, 2vh, 20px) auto 0;
          border: 0;
          background: transparent;
          color: transparent;
          cursor: pointer;
        }

        .yk-login-error,
        .yk-login-help {
          position: absolute;
          right: 11.7vw;
          width: min(31.2vw, 500px);
          z-index: 4;
          border-radius: 14px;
          padding: 12px 14px;
          font-weight: 900;
          line-height: 1.6;
          box-shadow: 0 14px 34px rgba(0,0,0,0.24);
        }

        .yk-login-error {
          top: calc(41.2vh + 178px);
          background: rgba(254, 226, 226, 0.94);
          color: #991b1b;
          border: 1px solid rgba(254, 202, 202, 0.9);
        }

        .yk-login-help {
          top: calc(41.2vh + 238px);
          background: rgba(248, 250, 252, 0.96);
          color: #07152d;
          border: 1px solid rgba(226, 232, 240, 0.96);
        }

        @media (max-width: 980px) {
          .yk-login-exact {
            background-position: center;
          }

          .yk-login-exact-form {
            width: min(76vw, 500px);
            right: 50%;
            top: 40vh;
            transform: translateX(50%);
          }

          .yk-login-error,
          .yk-login-help {
            width: min(76vw, 500px);
            right: 50%;
            transform: translateX(50%);
          }
        }
      `}</style>

      <form onSubmit={onSubmit} className="yk-login-exact-form" aria-label="כניסה למערכת">
        <label className="yk-login-exact-field" aria-label="שם משתמש / אימייל / קוד פרויקט">
          <input
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
            placeholder="הזן שם משתמש, אימייל או קוד פרויקט"
            autoFocus
            autoComplete="username"
          />
        </label>

        <label className="yk-login-exact-field" aria-label="סיסמה">
          <input
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            type={visible ? "text" : "password"}
            placeholder="הזן סיסמה"
            autoComplete="current-password"
          />
          <button
            type="button"
            className="yk-login-eye"
            onClick={() => setVisible((prev) => !prev)}
            aria-label={visible ? "הסתר סיסמה" : "הצג סיסמה"}
            title={visible ? "הסתר סיסמה" : "הצג סיסמה"}
          />
        </label>

        <button type="submit" className="yk-login-submit" aria-label="כניסה למערכת">
          כניסה למערכת
        </button>

        <button
          type="button"
          className="yk-login-forgot"
          onClick={() => setShowPasswordHelp((prev) => !prev)}
          aria-label="שכחתי סיסמה"
        >
          שכחתי סיסמה
        </button>
      </form>

      {error ? <div className="yk-login-error">{error}</div> : null}

      {showPasswordHelp ? (
        <div className="yk-login-help">
          <div style={{ fontWeight: 950, marginBottom: 4 }}>אפשרויות שחזור</div>
          <div>אם הוגדרת ב-Supabase Auth, התחבר עם כתובת המייל והסיסמה שלך.</div>
          <div>
            אם אין לך סיסמה או שהסיסמה שונתה, יש לפנות למנהל המערכת או לעדכן דרך
            מסך "ניהול משתמשים והרשאות".
          </div>
          <button type="button" onClick={onResetAdminPassword} style={{ display: "none" }}>
            <InlineCode>reset</InlineCode>
          </button>
        </div>
      ) : null}
    </div>
  );
}
