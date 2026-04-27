"use client";

import { useState } from "react";

type Concentration = {
  id: string;
  name: string;
  headers: string[];
};

const initialConcentrations: Concentration[] = [
  { id: "asphalt-tests", name: "ריכוז בדיקות אספלט", headers: [] },
  { id: "density-tests", name: "ריכוז בדיקות צפיפות", headers: [] },
  { id: "concrete", name: "ריכוז בטון", headers: [] },
  { id: "materials", name: "ריכוז חומרים", headers: [] },
  { id: "contractors", name: "ריכוז קבלנים", headers: [] },
  { id: "suppliers", name: "ריכוז ספקים", headers: [] },
  { id: "supervision", name: "ריכוז פיקוח עליון", headers: [] },
  { id: "trial-sections", name: "ריכוז קטעי ניסוי", headers: [] },
  { id: "base-a", name: "אפיון מצע א׳", headers: [] },
  { id: "selected-material", name: "אפיון נברר", headers: [] },
  { id: "nonconformances", name: "אי התאמות", headers: [] },
];

export function ConcentrationsSection() {
  const [items] = useState<Concentration[]>(initialConcentrations);

  return (
    <div dir="rtl" style={{ padding: 20 }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>📊 ריכוזים</h2>
        <p style={{ color: "#64748b", marginTop: 8, lineHeight: 1.6 }}>
          כאן יוצגו ריכוזי הבדיקות והמסמכים. כרגע הריכוזים נקיים מערכים ומוכנים למילוי אוטומטי בהמשך.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            style={{
              textAlign: "right",
              border: "1px solid #cbd5e1",
              borderRadius: 16,
              padding: 18,
              background: "#ffffff",
              boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{item.name}</div>
            <div style={{ color: "#64748b", marginTop: 8, fontSize: 14 }}>
              אין נתונים — מוכן למילוי אוטומטי
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default ConcentrationsSection;
