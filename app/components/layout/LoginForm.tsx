"use client";

import { useState } from "react";

const BRAND_NAVY = "#07152d";
const BRAND_NAVY_SOFT = "#0f2342";
const BRAND_GOLD = "#d6a23a";
const STEEL_TEXT = "#64748b";

const featureItems = [
  { icon: "◈", label: "QA/QC" },
  { icon: "☷", label: "רשימות תיוג" },
  { icon: "◷", label: "ריכוזים" },
  { icon: "▤", label: "דוחות" },
];

const trustItems = [
  { icon: "◇", title: "איכות", text: "ללא פשרות" },
  { icon: "◎", title: "בקרה", text: "מדויקת" },
  { icon: "▥", title: "תשתיות", text: "לעתיד" },
  { icon: "⌂", title: "שותפים", text: "להצלחה" },
];

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
          border: "1px solid #d8dee8",
          borderRadius: 14,
          padding: "13px 48px 13px 14px",
          fontWeight: 800,
          fontSize: 16,
          color: BRAND_NAVY,
          background: "rgba(255, 255, 255, 0.92)",
          outline: "none",
          boxShadow: "inset 0 1px 0 rgba(15, 23, 42, 0.03)",
        }}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? "הסתר סיסמה" : "הצג סיסמה"}
        title={visible ? "הסתר סיסמה" : "הצג סיסמה"}
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          border: 0,
          background: "transparent",
          color: "#7b8798",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 900,
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
  const onResetAdminPassword = () => undefined;

  return (
    <div dir="rtl" className="yk-login-shell">
      <style>{`
        .yk-login-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(420px, 1.05fr) minmax(420px, 0.95fr);
          background:
            radial-gradient(circle at 86% 12%, rgba(214, 162, 58, 0.10), transparent 26%),
            linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%);
          color: ${BRAND_NAVY};
          overflow: hidden;
        }

        .yk-login-visual {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          background:
            linear-gradient(90deg, rgba(3, 10, 25, 0.98) 0%, rgba(7, 21, 45, 0.90) 38%, rgba(15, 35, 66, 0.54) 100%),
            radial-gradient(circle at 48% 47%, rgba(255, 255, 255, 0.24), transparent 20%),
            linear-gradient(155deg, transparent 0 34%, rgba(255,255,255,0.70) 34.2% 35.2%, transparent 35.4%),
            linear-gradient(145deg, transparent 0 45%, rgba(255,255,255,0.50) 45.2% 46.1%, transparent 46.4%),
            repeating-linear-gradient(112deg, transparent 0 54px, rgba(255,255,255,0.16) 55px 57px),
            linear-gradient(165deg, #0b1424 0%, #111827 44%, #d8dde5 45%, #f8fafc 100%);
        }

        .yk-login-visual::before {
          content: "";
          position: absolute;
          inset: -16% -18% auto auto;
          width: 82%;
          height: 76%;
          transform: rotate(-16deg);
          border-radius: 999px;
          background:
            repeating-linear-gradient(90deg, rgba(255,255,255,0.62) 0 5px, transparent 5px 38px),
            linear-gradient(180deg, rgba(255,255,255,0.36), rgba(255,255,255,0.04));
          opacity: 0.55;
          filter: grayscale(1);
        }

        .yk-login-visual::after {
          content: "";
          position: absolute;
          inset: auto -10% 10% auto;
          width: 82%;
          height: 34%;
          transform: perspective(820px) rotateX(48deg) rotateZ(-10deg);
          transform-origin: bottom right;
          background:
            repeating-linear-gradient(90deg, rgba(255,255,255,0.42) 0 2px, transparent 2px 72px),
            linear-gradient(180deg, rgba(255,255,255,0.24), rgba(255,255,255,0.02));
          clip-path: polygon(0 18%, 100% 0, 100% 100%, 0 74%);
          opacity: 0.58;
        }

        .yk-visual-content {
          position: relative;
          z-index: 1;
          height: 100%;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: clamp(34px, 5vw, 76px);
          color: #fff;
        }

        .yk-login-panel {
          position: relative;
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: clamp(22px, 4vw, 64px);
        }

        .yk-login-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(115deg, transparent 0 64%, rgba(15, 23, 42, 0.05) 64.2% 65.3%, transparent 65.5%),
            repeating-linear-gradient(90deg, transparent 0 54px, rgba(15, 23, 42, 0.035) 55px 56px);
          mask-image: linear-gradient(90deg, transparent, #000 42%, #000);
          pointer-events: none;
        }

        .yk-login-card {
          position: relative;
          z-index: 1;
          width: min(560px, 94vw);
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(226, 232, 240, 0.95);
          border-radius: 28px;
          padding: clamp(26px, 4vw, 42px);
          box-shadow: 0 28px 90px rgba(15, 23, 42, 0.18);
          backdrop-filter: blur(14px);
        }

        @media (max-width: 980px) {
          .yk-login-shell {
            grid-template-columns: 1fr;
          }

          .yk-login-visual {
            min-height: 300px;
          }

          .yk-visual-content {
            min-height: 300px;
            padding: 30px;
          }

          .yk-login-panel {
            min-height: auto;
            padding: 28px 18px 42px;
          }
        }

        @media (max-width: 620px) {
          .yk-login-visual {
            display: none;
          }

          .yk-login-shell {
            min-height: 100vh;
          }
        }
      `}</style>

      <aside className="yk-login-visual" aria-hidden="true">
        <div className="yk-visual-content">
          <div>
            <div
              style={{
                fontSize: "clamp(30px, 4.4vw, 52px)",
                fontWeight: 950,
                letterSpacing: "0.04em",
                lineHeight: 1,
              }}
            >
              Y.K QUALITY
            </div>
            <div
              style={{
                width: 56,
                height: 3,
                background: BRAND_GOLD,
                margin: "24px 0 28px auto",
                borderRadius: 999,
              }}
            />
            <div
              style={{
                display: "grid",
                gap: 8,
                color: "rgba(255,255,255,0.88)",
                fontSize: "clamp(18px, 2vw, 25px)",
                fontWeight: 800,
                lineHeight: 1.45,
              }}
            >
              <span>ניהול איכות.</span>
              <span>בקרה מדויקת.</span>
              <span>תשתיות שמחזיקות.</span>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(72px, 1fr))",
              gap: 14,
              maxWidth: 560,
            }}
          >
            {trustItems.map((item) => (
              <div
                key={item.title}
                style={{
                  borderInlineStart: "1px solid rgba(255,255,255,0.20)",
                  paddingInlineStart: 14,
                  color: "rgba(255,255,255,0.84)",
                }}
              >
                <div style={{ color: BRAND_GOLD, fontSize: 28, lineHeight: 1 }}>
                  {item.icon}
                </div>
                <div style={{ fontWeight: 950, marginTop: 8 }}>{item.title}</div>
                <div style={{ fontWeight: 700, fontSize: 13, marginTop: 3 }}>
                  {item.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="yk-login-panel">
        <form onSubmit={onSubmit} className="yk-login-card">
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div
              style={{
                fontSize: "clamp(34px, 4vw, 56px)",
                fontWeight: 950,
                color: BRAND_NAVY,
                letterSpacing: "0.04em",
                lineHeight: 1,
              }}
            >
              Y.K QUALITY
            </div>
            <div
              style={{
                width: 46,
                height: 3,
                borderRadius: 999,
                background: BRAND_GOLD,
                margin: "18px auto 18px",
              }}
            />
            <div style={{ fontSize: 26, fontWeight: 950, color: BRAND_NAVY }}>
              כניסה למערכת
            </div>
            <div
              style={{
                color: STEEL_TEXT,
                marginTop: 8,
                fontWeight: 800,
                lineHeight: 1.5,
              }}
            >
              מערכת ניהול ובקרת איכות לפרויקטי תשתיות
            </div>
          </div>

          <div style={{ height: 1, background: "#e6ebf2", marginBottom: 26 }} />

          <label
            style={{
              display: "grid",
              gap: 9,
              marginBottom: 17,
              fontWeight: 950,
              color: BRAND_NAVY,
            }}
          >
            שם משתמש / אימייל / קוד פרויקט
            <div style={{ position: "relative" }}>
              <input
                value={username}
                onChange={(event) => onUsernameChange(event.target.value)}
                placeholder="הזן שם משתמש, אימייל או קוד פרויקט"
                autoFocus
                autoComplete="username"
                style={{
                  width: "100%",
                  border: "1px solid #d8dee8",
                  borderRadius: 14,
                  padding: "13px 48px 13px 14px",
                  fontWeight: 800,
                  fontSize: 16,
                  color: BRAND_NAVY,
                  background: "rgba(255, 255, 255, 0.92)",
                  outline: "none",
                }}
              />
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  right: 15,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#8a94a6",
                  fontSize: 20,
                  fontWeight: 950,
                }}
              >
                ◌
              </span>
            </div>
          </label>

          <label
            style={{
              display: "grid",
              gap: 9,
              marginBottom: 18,
              fontWeight: 950,
              color: BRAND_NAVY,
            }}
          >
            סיסמה
            <PasswordField
              value={password}
              onChange={onPasswordChange}
              autoComplete="current-password"
            />
          </label>

          {error ? (
            <div
              style={{
                background: "#fee2e2",
                color: "#991b1b",
                borderRadius: 14,
                padding: 12,
                fontWeight: 900,
                marginBottom: 16,
                border: "1px solid #fecaca",
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
              borderRadius: 15,
              padding: "15px 16px",
              background: `linear-gradient(135deg, ${BRAND_NAVY} 0%, ${BRAND_NAVY_SOFT} 100%)`,
              color: "#fff",
              fontWeight: 950,
              fontSize: 17,
              cursor: "pointer",
              boxShadow: "0 14px 26px rgba(7, 21, 45, 0.25)",
            }}
          >
            כניסה למערכת ←
          </button>

          <button
            type="button"
            onClick={() => setShowPasswordHelp((prev) => !prev)}
            style={{
              display: "block",
              border: 0,
              background: "transparent",
              color: "#2f5f9d",
              fontWeight: 900,
              cursor: "pointer",
              padding: 0,
              margin: "18px auto 22px",
              textDecoration: "none",
            }}
          >
            שכחתי סיסמה
          </button>

          {showPasswordHelp ? (
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                color: BRAND_NAVY,
                borderRadius: 16,
                padding: 14,
                fontWeight: 800,
                lineHeight: 1.7,
                marginBottom: 22,
              }}
            >
              <div style={{ fontWeight: 950, marginBottom: 4 }}>
                אפשרויות שחזור
              </div>
              <div>
                אם הוגדרת ב-Supabase Auth, התחבר עם כתובת המייל והסיסמה שלך.
              </div>
              <div>
                אם אין לך סיסמה או שהסיסמה שונתה, יש לפנות למנהל המערכת או
                לעדכן דרך מסך "ניהול משתמשים והרשאות".
              </div>
              <div style={{ marginTop: 4 }}>
                פרטי התחברות נשמרים באופן מאובטח ואינם מוצגים במסך הכניסה.
              </div>
              <button
                type="button"
                onClick={onResetAdminPassword}
                style={{ display: "none" }}
              >
                <InlineCode>reset</InlineCode>
              </button>
            </div>
          ) : null}

          <div style={{ height: 1, background: "#e6ebf2", marginBottom: 20 }} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
              textAlign: "center",
            }}
          >
            {featureItems.map((item) => (
              <div key={item.label}>
                <div
                  style={{
                    width: 54,
                    height: 54,
                    display: "grid",
                    placeItems: "center",
                    margin: "0 auto 8px",
                    border: "1px solid #dbe2ec",
                    borderRadius: 14,
                    color: BRAND_NAVY,
                    fontSize: 24,
                    fontWeight: 950,
                    background: "#fff",
                  }}
                >
                  {item.icon}
                </div>
                <div
                  style={{
                    width: 28,
                    height: 2,
                    borderRadius: 999,
                    background: BRAND_GOLD,
                    margin: "0 auto 7px",
                  }}
                />
                <div style={{ color: "#475569", fontWeight: 900, fontSize: 13 }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </form>
      </main>
    </div>
  );
}
