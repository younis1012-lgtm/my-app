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

const backgroundScenes = ["גשר", "מנהרה", "מחלף", "קיר תומך", "כביש"];

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
          background: #07152d;
        }

        .yk-login-visual::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 1;
          background:
            linear-gradient(90deg, rgba(3, 10, 25, 0.98) 0%, rgba(7, 21, 45, 0.88) 44%, rgba(15, 35, 66, 0.46) 100%),
            radial-gradient(circle at 18% 18%, rgba(214, 162, 58, 0.12), transparent 22%);
          pointer-events: none;
        }

        .yk-login-visual::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 2;
          background:
            linear-gradient(120deg, transparent 0 34%, rgba(255,255,255,0.10) 34.2% 34.5%, transparent 34.8%),
            repeating-linear-gradient(90deg, transparent 0 74px, rgba(255,255,255,0.04) 75px 76px);
          pointer-events: none;
        }

        .yk-scene {
          position: absolute;
          inset: 0;
          opacity: 0;
          transform: scale(1.02);
          animation: ykSceneFade 300s infinite;
          filter: grayscale(1);
        }

        .yk-scene-bridge {
          opacity: 1;
          animation-delay: 0s;
          background:
            radial-gradient(circle at 48% 47%, rgba(255, 255, 255, 0.24), transparent 20%),
            linear-gradient(155deg, transparent 0 34%, rgba(255,255,255,0.70) 34.2% 35.2%, transparent 35.4%),
            linear-gradient(145deg, transparent 0 45%, rgba(255,255,255,0.50) 45.2% 46.1%, transparent 46.4%),
            repeating-linear-gradient(112deg, transparent 0 54px, rgba(255,255,255,0.16) 55px 57px),
            linear-gradient(165deg, #0b1424 0%, #111827 44%, #d8dde5 45%, #f8fafc 100%);
        }

        .yk-scene-tunnel {
          animation-delay: 60s;
          background:
            radial-gradient(ellipse at 62% 52%, transparent 0 18%, rgba(255,255,255,0.55) 18.5% 20%, transparent 20.5% 24%, rgba(255,255,255,0.35) 24.5% 26%, transparent 27%),
            repeating-radial-gradient(ellipse at 62% 52%, transparent 0 26px, rgba(255,255,255,0.15) 27px 30px),
            linear-gradient(120deg, #050b18, #172338 52%, #c6ccd4 100%);
        }

        .yk-scene-interchange {
          animation-delay: 120s;
          background:
            radial-gradient(ellipse at 70% 42%, transparent 0 28%, rgba(255,255,255,0.62) 28.3% 29.6%, transparent 30%),
            radial-gradient(ellipse at 42% 70%, transparent 0 34%, rgba(255,255,255,0.45) 34.3% 35.8%, transparent 36.2%),
            linear-gradient(28deg, transparent 0 43%, rgba(255,255,255,0.56) 43.4% 45%, transparent 45.4%),
            linear-gradient(155deg, #071020 0%, #1a2638 50%, #d7dbe1 100%);
        }

        .yk-scene-retaining {
          animation-delay: 180s;
          background:
            linear-gradient(112deg, transparent 0 34%, rgba(255,255,255,0.50) 34.3% 35.3%, transparent 35.7%),
            repeating-linear-gradient(0deg, rgba(255,255,255,0.14) 0 2px, transparent 2px 64px),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0 2px, transparent 2px 92px),
            linear-gradient(145deg, #081326 0%, #253248 56%, #d0d4db 100%);
        }

        .yk-scene-road {
          animation-delay: 240s;
          background:
            linear-gradient(103deg, transparent 0 47%, rgba(255,255,255,0.72) 47.3% 47.9%, transparent 48.2%),
            linear-gradient(78deg, transparent 0 52%, rgba(255,255,255,0.45) 52.3% 53.6%, transparent 54%),
            repeating-linear-gradient(104deg, transparent 0 70px, rgba(255,255,255,0.22) 71px 76px),
            linear-gradient(170deg, #050c19 0%, #1d293b 48%, #e2e5ea 100%);
        }

        @keyframes ykSceneFade {
          0%, 17% {
            opacity: 1;
            transform: scale(1.02);
          }
          20%, 97% {
            opacity: 0;
            transform: scale(1.07);
          }
          100% {
            opacity: 1;
            transform: scale(1.02);
          }
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

        .yk-scene-chip {
          position: absolute;
          left: clamp(24px, 4vw, 58px);
          bottom: clamp(24px, 4vw, 58px);
          z-index: 3;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .yk-scene-chip span {
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 999px;
          padding: 7px 11px;
          color: rgba(255,255,255,0.78);
          background: rgba(7, 21, 45, 0.42);
          backdrop-filter: blur(8px);
          font-size: 12px;
          font-weight: 850;
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
        <div className="yk-scene yk-scene-bridge" />
        <div className="yk-scene yk-scene-tunnel" />
        <div className="yk-scene yk-scene-interchange" />
        <div className="yk-scene yk-scene-retaining" />
        <div className="yk-scene yk-scene-road" />
        <div className="yk-scene-chip">
          {backgroundScenes.map((scene) => (
            <span key={scene}>{scene}</span>
          ))}
        </div>
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
            <div
              style={{
                marginTop: 32,
                maxWidth: 520,
                color: "rgba(255,255,255,0.88)",
                fontSize: "clamp(18px, 2vw, 24px)",
                fontWeight: 950,
                lineHeight: 1.55,
                borderInlineStart: `4px solid ${BRAND_GOLD}`,
                paddingInlineStart: 18,
              }}
            >
              איכות אינה נבדקת בסוף – היא נבנית לאורך כל הפרויקט
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
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: BRAND_NAVY,
                background: "rgba(214, 162, 58, 0.13)",
                border: "1px solid rgba(214, 162, 58, 0.28)",
                borderRadius: 999,
                padding: "8px 14px",
                fontWeight: 950,
                marginBottom: 18,
              }}
            >
              <span aria-hidden="true">👋</span>
              <span>ברוכים הבאים ל־Y.K QUALITY</span>
            </div>
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
