"use client";

import { useMemo, useState } from "react";
import { ENGINEERING_TEMPLATES, type EngineeringTemplateNode } from "./TemplateData";

const cardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  background: "#fff",
  boxShadow: "0 16px 35px rgba(15,23,42,0.06)",
} as const;

function NodeTree({ nodes, depth = 0 }: { nodes: EngineeringTemplateNode[]; depth?: number }) {
  return (
    <div style={{ display: "grid", gap: 7 }}>
      {nodes.map((node, index) => (
        <div key={`${node.name}-${index}`}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 10px",
              marginInlineStart: depth * 22,
              borderRadius: 12,
              background: depth === 0 ? "#f8fafc" : "#fff",
              border: depth === 0 ? "1px solid #e2e8f0" : "1px solid transparent",
              fontWeight: depth === 0 ? 950 : 800,
              color: "#0f172a",
            }}
          >
            <span style={{ color: "#f59e0b", fontWeight: 950 }}>{depth === 0 ? "▣" : "├"}</span>
            <span>{node.name}</span>
          </div>
          {node.children?.length ? <NodeTree nodes={node.children} depth={depth + 1} /> : null}
        </div>
      ))}
    </div>
  );
}

export function TemplateLibrary() {
  const [selectedIds, setSelectedIds] = useState<string[]>(["road-structure", "retaining-wall", "drainage-channel"]);
  const selectedTemplates = useMemo(
    () => ENGINEERING_TEMPLATES.filter((template) => selectedIds.includes(template.id)),
    [selectedIds],
  );

  const toggleTemplate = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  return (
    <main dir="rtl" style={{ minHeight: "100vh", background: "linear-gradient(180deg,#f8fafc,#eef4f8)", padding: 24 }}>
      <section
        style={{
          ...cardStyle,
          padding: 24,
          marginBottom: 18,
          background: "#111827",
          color: "#fff",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", inset: 0, opacity: 0.18, backgroundImage: "linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)", backgroundSize: "34px 34px" }} />
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center" }}>
          <div>
            <div style={{ color: "#f59e0b", fontWeight: 950, letterSpacing: 1 }}>RND QUALITY CONTROL</div>
            <h1 style={{ margin: "10px 0 6px", fontSize: 32 }}>ספריית תבניות הנדסיות</h1>
            <p style={{ margin: 0, color: "#cbd5e1", fontWeight: 750 }}>
              בחר אלמנטים הנדסיים והמערכת תציג את עץ העבודה לפי סדר ביצוע: עבודות עפר, בטון, ניקוז, שכבות מבנה, אספלט וגמר.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { window.location.href = "/"; }}
            style={{ border: "1px solid #475569", background: "#fff", color: "#0f172a", borderRadius: 12, padding: "10px 16px", fontWeight: 950, cursor: "pointer" }}
          >
            חזרה לדף הבית
          </button>
        </div>
      </section>

      <section style={{ ...cardStyle, padding: 18, marginBottom: 18 }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 22 }}>בחירת תבניות</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
          {ENGINEERING_TEMPLATES.map((template) => {
            const selected = selectedIds.includes(template.id);
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => toggleTemplate(template.id)}
                style={{
                  textAlign: "right",
                  padding: 16,
                  borderRadius: 16,
                  border: selected ? "2px solid #f59e0b" : "1px solid #e2e8f0",
                  background: selected ? "#fff7ed" : "#fff",
                  cursor: "pointer",
                  minHeight: 118,
                }}
              >
                <div style={{ fontSize: 28 }}>{template.icon}</div>
                <div style={{ fontWeight: 950, fontSize: 17, marginTop: 8 }}>{template.title}</div>
                <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>{template.description}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ ...cardStyle, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>עץ מוצע מהתבניות שנבחרו</h2>
            <div style={{ color: "#64748b", fontWeight: 750, marginTop: 4 }}>
              נבחרו {selectedTemplates.length} תבניות. בשלב הבא נחבר את העץ הזה לשמירה בפרויקט וליצירת משימות אוטומטית.
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 14 }}>
          {selectedTemplates.map((template) => (
            <article key={template.id} style={{ border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 28 }}>{template.icon}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 20 }}>{template.title}</h3>
                  <div style={{ color: "#64748b", fontSize: 13, fontWeight: 750 }}>{template.description}</div>
                </div>
              </div>
              <NodeTree nodes={template.nodes} />
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
