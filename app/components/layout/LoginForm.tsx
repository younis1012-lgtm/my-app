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
          fontSize: 14,
          fontWeight: 800,
          padding: 4,
        }}
      >
        {visible ? "הסתר" : "הצג"}
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
          background: #061326 url('/yk-login-bridge-bg.png') center / cover no-repeat;
          color: #fff;
        }

        .yk-login-exact::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(2, 8, 23, 0.76) 0%, rgba(2, 8, 23, 0.38) 42%, rgba(2, 8, 23, 0.12) 100%),
            linear-gradient(180deg, rgba(2, 8, 23, 0.05) 0%, rgba(2, 8, 23, 0.38) 100%);
          pointer-events: none;
        }

        .yk-login-left {
          position: absolute;
          z-index: 2;
          left: clamp(28px, 4.2vw, 76px);
          top: clamp(28px, 5.4vh, 58px);
          bottom: clamp(20px, 3.6vh, 40px);
          width: min(43vw, 690px);
          color: rgba(255,255,255,0.94);
          direction: ltr;
        }

        .yk-login-brand {
          display: flex;
          align-items: center;
          gap: 18px;
          direction: ltr;
          text-align: left;
        }

        .yk-login-logo {
          width: clamp(58px, 5vw, 78px);
          aspect-ratio: 1;
          border: 3px solid #d59a4a;
          color: #d59a4a;
          display: grid;
          place-items: center;
          font-size: clamp(27px, 2.3vw, 38px);
          font-weight: 700;
          line-height: 1;
          clip-path: polygon(25% 4%, 75% 4%, 98% 50%, 75% 96%, 25% 96%, 2% 50%);
        }

        .yk-login-brand-title {
          font-size: clamp(30px, 3.05vw, 53px);
          line-height: 0.95;
          font-weight: 950;
          letter-spacing: 0;
        }

        .yk-login-brand-subtitle {
          margin-top: 10px;
          font-size: clamp(12px, 1vw, 17px);
          font-weight: 800;
          color: rgba(255,255,255,0.88);
          direction: rtl;
          text-align: right;
        }

        .yk-login-gold-line {
          width: clamp(56px, 5vw, 90px);
          height: 4px;
          margin: clamp(24px, 4.1vh, 48px) 0 0 clamp(8px, 1.3vw, 22px);
          border-radius: 999px;
          background: #d59a4a;
        }

        .yk-login-quote {
          position: relative;
          margin-top: clamp(38px, 7.2vh, 86px);
          margin-left: clamp(10px, 1.2vw, 24px);
          max-width: min(33vw, 440px);
          padding: clamp(18px, 2.1vw, 32px) clamp(28px, 3.2vw, 54px);
          font-size: clamp(20px, 1.85vw, 32px);
          font-weight: 850;
          line-height: 1.38;
          color: rgba(255,255,255,0.94);
          text-align: right;
          direction: rtl;
        }

        .yk-login-quote::before,
        .yk-login-quote::after {
          content: "";
          position: absolute;
          width: 42px;
          height: 74px;
          border-color: #d59a4a;
          opacity: 0.95;
        }

        .yk-login-quote::before {
          right: 0;
          top: 0;
          border-top: 3px solid #d59a4a;
          border-right: 3px solid #d59a4a;
          border-radius: 0 10px 0 0;
        }

        .yk-login-quote::after {
          left: 0;
          bottom: 0;
          border-bottom: 3px solid #d59a4a;
          border-left: 3px solid #d59a4a;
          border-radius: 0 0 0 10px;
        }

        .yk-login-quote-mark {
          position: absolute;
          left: clamp(18px, 2vw, 34px);
          top: -20px;
          color: #d59a4a;
          font-size: clamp(34px, 3vw, 52px);
          font-weight: 950;
          line-height: 1;
        }

        .yk-login-quote strong {
          color: #d9a155;
        }

        .yk-login-features {
          display: grid;
          gap: clamp(18px, 3vh, 34px);
          margin-top: clamp(32px, 6vh, 72px);
          margin-right: auto;
          direction: rtl;
          width: min(31vw, 420px);
          padding-right: clamp(12px, 1vw, 20px);
        }

        .yk-login-feature {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 18px;
          font-size: clamp(15px, 1.25vw, 22px);
          font-weight: 800;
          color: rgba(255,255,255,0.88);
        }

        .yk-login-feature-icon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border: 2px solid rgba(213,154,74,0.88);
          color: #d59a4a;
          font-size: 16px;
          font-weight: 950;
        }

        .yk-login-left-modules {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          border-top: 1px solid rgba(255,255,255,0.13);
          color: rgba(255,255,255,0.90);
          text-align: center;
        }

        .yk-login-left-module {
          min-height: clamp(82px, 12vh, 116px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-left: 1px solid rgba(255,255,255,0.17);
          font-size: clamp(11px, 0.85vw, 14px);
          font-weight: 850;
        }

        .yk-login-left-module:first-child {
          border-left: 0;
        }

        .yk-login-left-module-icon {
          color: #d59a4a;
          font-size: clamp(19px, 1.55vw, 27px);
          font-weight: 950;
        }

        .yk-login-left-module-line {
          width: 30px;
          height: 3px;
          border-radius: 999px;
          background: rgba(255,255,255,0.86);
        }

        .yk-login-panel {
          position: absolute;
          z-index: 3;
          right: clamp(42px, 6.8vw, 118px);
          top: 50%;
          transform: translateY(-50%);
          width: min(37vw, 610px);
          min-height: min(75vh, 720px);
          border: 1px solid rgba(255,255,255,0.36);
          border-radius: 34px;
          background: linear-gradient(145deg, rgba(226, 233, 244, 0.78), rgba(30, 45, 70, 0.60));
          box-shadow:
            0 30px 90px rgba(0,0,0,0.38),
            inset 0 1px 0 rgba(255,255,255,0.50);
          backdrop-filter: blur(18px);
          padding: clamp(34px, 4.8vh, 54px) clamp(34px, 4vw, 64px);
          color: #07152d;
        }

        .yk-login-panel-header {
          text-align: center;
          padding-bottom: clamp(18px, 2.6vh, 30px);
          border-bottom: 1px solid rgba(255,255,255,0.34);
        }

        .yk-login-panel-title {
          font-size: clamp(40px, 3.65vw, 64px);
          line-height: 0.95;
          font-weight: 950;
          letter-spacing: 0;
        }

        .yk-login-panel-mark {
          width: 62px;
          height: 4px;
          margin: 18px auto 16px;
          border-radius: 999px;
          background: #d9a155;
        }

        .yk-login-panel-heading {
          font-size: clamp(21px, 1.65vw, 30px);
          font-weight: 950;
          margin-bottom: 8px;
        }

        .yk-login-panel-subtitle {
          font-size: clamp(12px, 0.95vw, 16px);
          font-weight: 800;
          color: rgba(7, 21, 45, 0.72);
        }

        .yk-login-exact-form {
          position: relative;
          z-index: 4;
          width: 100%;
          margin-top: clamp(24px, 3.5vh, 36px);
        }

        .yk-login-field-caption {
          display: block;
          margin: 0 8px 7px 0;
          color: rgba(7, 21, 45, 0.82);
          font-size: clamp(12px, 0.85vw, 15px);
          font-weight: 950;
        }

        .yk-login-exact-field {
          display: block;
          position: relative;
          width: 100%;
          height: clamp(46px, 5.6vh, 56px);
          margin-bottom: 16px;
          border: 1px solid rgba(255,255,255,0.80);
          border-radius: 12px;
          background: rgba(255,255,255,0.13);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.20);
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
          font-size: clamp(13px, 0.95vw, 17px);
          font-weight: 850;
          text-align: right;
          padding: 0 52px;
          direction: rtl;
          caret-color: #ffffff;
        }

        .yk-login-exact-field:focus-within {
          border-color: rgba(255,255,255,0.96);
          box-shadow:
            0 0 0 3px rgba(255,255,255,0.16),
            inset 0 1px 0 rgba(255,255,255,0.20);
        }

        .yk-login-exact-field input::placeholder {
          color: rgba(255,255,255,0.86);
          opacity: 1;
        }

        .yk-login-field-symbol {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,0.86);
          font-size: 19px;
          font-weight: 900;
          pointer-events: none;
        }

        .yk-login-eye {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          min-width: 42px;
          height: 34px;
          border: 0;
          background: transparent;
          color: rgba(255,255,255,0.88);
          cursor: pointer;
          font-size: 13px;
          font-weight: 850;
        }

        .yk-login-submit {
          display: block;
          width: 100%;
          height: clamp(50px, 5.9vh, 60px);
          margin-top: 16px;
          border: 0;
          border-radius: 12px;
          background: #061326;
          color: #ffffff;
          cursor: pointer;
          font-size: clamp(17px, 1.25vw, 22px);
          font-weight: 950;
          box-shadow: 0 14px 30px rgba(2, 8, 23, 0.24);
        }

        .yk-login-forgot {
          display: block;
          width: fit-content;
          min-height: 32px;
          margin: clamp(12px, 1.7vh, 18px) auto 0;
          border: 0;
          background: transparent;
          color: rgba(255,255,255,0.92);
          cursor: pointer;
          font-size: clamp(13px, 0.95vw, 16px);
          font-weight: 850;
        }

        .yk-login-panel-modules {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
          margin-top: clamp(20px, 3.3vh, 34px);
          padding-top: clamp(17px, 2.5vh, 25px);
          border-top: 1px solid rgba(255,255,255,0.28);
          color: rgba(255,255,255,0.92);
          text-align: center;
        }

        .yk-login-panel-module {
          min-width: 0;
          padding: 0 10px;
          border-left: 1px solid rgba(255,255,255,0.22);
          font-weight: 850;
          font-size: clamp(11px, 0.85vw, 14px);
        }

        .yk-login-panel-module:first-child {
          border-left: 0;
        }

        .yk-login-panel-module-icon {
          display: block;
          font-size: clamp(18px, 1.55vw, 26px);
          line-height: 1;
          margin-bottom: 8px;
          color: #ffffff;
          font-weight: 950;
        }

        .yk-login-error,
        .yk-login-help {
          position: absolute;
          right: clamp(52px, 8vw, 150px);
          width: min(31.2vw, 500px);
          z-index: 5;
          border-radius: 14px;
          padding: 12px 14px;
          font-weight: 900;
          line-height: 1.6;
          box-shadow: 0 14px 34px rgba(0,0,0,0.24);
          pointer-events: none;
        }

        .yk-login-error {
          top: calc(50% + 194px);
          background: rgba(254, 226, 226, 0.94);
          color: #991b1b;
          border: 1px solid rgba(254, 202, 202, 0.9);
        }

        .yk-login-help {
          top: calc(50% + 254px);
          background: rgba(248, 250, 252, 0.96);
          color: #07152d;
          border: 1px solid rgba(226, 232, 240, 0.96);
        }

        @media (max-width: 980px) {
          .yk-login-exact {
            background-position: center;
          }

          .yk-login-left {
            display: none;
          }

          .yk-login-panel {
            width: min(86vw, 560px);
            right: 50%;
            top: 50%;
            transform: translate(50%, -50%);
            min-height: auto;
            padding: 32px 24px;
          }

          .yk-login-exact-form {
            width: 100%;
          }

          .yk-login-error,
          .yk-login-help {
            width: min(76vw, 500px);
            right: 50%;
            transform: translateX(50%);
          }

          .yk-login-panel-modules {
            grid-template-columns: repeat(2, 1fr);
            row-gap: 18px;
          }
        }
      `}</style>

      <section className="yk-login-left" aria-hidden="true">
        <div className="yk-login-brand">
          <div className="yk-login-logo">YK</div>
          <div>
            <div className="yk-login-brand-title">Y.K QUALITY</div>
            <div className="yk-login-brand-subtitle">מערכת ניהול ובקרת איכות לפרויקטי תשתיות</div>
          </div>
        </div>
        <div className="yk-login-gold-line" />

        <div className="yk-login-quote">
          <span className="yk-login-quote-mark">”</span>
          איכות אינה נבדקת בסוף -
          <br />
          <strong>היא נבנית לאורך כל הפרויקט</strong>
        </div>

        <div className="yk-login-features">
          <div className="yk-login-feature">
            ניהול איכות
            <span className="yk-login-feature-icon">✓</span>
          </div>
          <div className="yk-login-feature">
            בקרה מדויקת
            <span className="yk-login-feature-icon">+</span>
          </div>
          <div className="yk-login-feature">
            תשתיות שמחזיקות
            <span className="yk-login-feature-icon">▥</span>
          </div>
        </div>

        <div className="yk-login-left-modules">
          <div className="yk-login-left-module">
            <span className="yk-login-left-module-icon">▱</span>
            פרויקטים פעילים
            <span className="yk-login-left-module-line" />
          </div>
          <div className="yk-login-left-module">
            <span className="yk-login-left-module-icon">▤</span>
            רשימות תיוג
            <span className="yk-login-left-module-line" />
          </div>
          <div className="yk-login-left-module">
            <span className="yk-login-left-module-icon">△</span>
            בדיקות מעבדה
            <span className="yk-login-left-module-line" />
          </div>
          <div className="yk-login-left-module">
            <span className="yk-login-left-module-icon">◷</span>
            אישורים
            <span className="yk-login-left-module-line" />
          </div>
          <div className="yk-login-left-module">
            <span className="yk-login-left-module-icon">!</span>
            אי-התאמות פתוחות
            <span className="yk-login-left-module-line" />
          </div>
        </div>
      </section>

      <section className="yk-login-panel">
        <header className="yk-login-panel-header">
          <div className="yk-login-panel-title">Y.K QUALITY</div>
          <div className="yk-login-panel-mark" />
          <div className="yk-login-panel-heading">כניסה למערכת</div>
          <div className="yk-login-panel-subtitle">מערכת ניהול ובקרת איכות לפרויקטי תשתיות</div>
        </header>

        <form onSubmit={onSubmit} className="yk-login-exact-form" aria-label="כניסה למערכת">
          <span className="yk-login-field-caption">שם משתמש / אימייל / קוד פרויקט</span>
          <label className="yk-login-exact-field" aria-label="שם משתמש / אימייל / קוד פרויקט">
            <span className="yk-login-field-symbol">○</span>
            <input
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              placeholder="הזן שם משתמש, אימייל או קוד פרויקט"
              autoFocus
              autoComplete="username"
            />
          </label>

          <span className="yk-login-field-caption">סיסמה</span>
          <label className="yk-login-exact-field" aria-label="סיסמה">
            <span className="yk-login-field-symbol">□</span>
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
            >
              {visible ? "הסתר" : "הצג"}
            </button>
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

        <div className="yk-login-panel-modules" aria-hidden="true">
          <div className="yk-login-panel-module">
            <span className="yk-login-panel-module-icon">PDF</span>
            דוחות
          </div>
          <div className="yk-login-panel-module">
            <span className="yk-login-panel-module-icon">DATA</span>
            ריכוזים
          </div>
          <div className="yk-login-panel-module">
            <span className="yk-login-panel-module-icon">LIST</span>
            רשימות תיוג
          </div>
          <div className="yk-login-panel-module">
            <span className="yk-login-panel-module-icon">QA</span>
            QA/QC
          </div>
        </div>
      </section>

      {error ? <div className="yk-login-error">{error}</div> : null}

      {showPasswordHelp ? (
        <div className="yk-login-help">
          <div style={{ fontWeight: 950, marginBottom: 4 }}>אפשרויות שחזור</div>
          <div>אם הוגדרת ב-Supabase Auth, התחבר עם כתובת המייל והסיסמה שלך.</div>
          <div>
            אם אין לך סיסמה או שהסיסמה שונתה, יש לפנות למנהל המערכת או לעדכן דרך מסך "ניהול משתמשים והרשאות".
          </div>
          <button type="button" onClick={onResetAdminPassword} style={{ display: "none" }}>
            <InlineCode>reset</InlineCode>
          </button>
        </div>
      ) : null}
    </div>
  );
}
