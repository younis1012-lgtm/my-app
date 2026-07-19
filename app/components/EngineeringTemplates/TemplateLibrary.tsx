"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { ENGINEERING_TEMPLATES, type EngineeringTemplateNode } from "./TemplateData";

const STORAGE_KEY = "yk-quality-stage4-multifile";
const CURRENT_PROJECT_STORAGE_KEY = `${STORAGE_KEY}-current-project-id`;
const PROJECT_STRUCTURE_STORAGE_KEY = `${STORAGE_KEY}-project-structure`;
const PROJECT_STRUCTURE_TABLE = "project_structure_nodes";

type StoredProjectNode = {
  id: string;
  projectId: string;
  parentId: string;
  nodeType: "structure" | "element" | "activity";
  name: string;
  code: string;
  fromChainage: string;
  toChainage: string;
  side: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

const normalizeStoredNode = (value: any): StoredProjectNode | null => {
  if (!value || typeof value !== "object" || !value.id) return null;
  return {
    id: String(value.id),
    projectId: String(value.projectId ?? value.project_id ?? ""),
    parentId: String(value.parentId ?? value.parent_id ?? ""),
    nodeType: value.nodeType ?? value.node_type ?? "activity",
    name: String(value.name ?? ""),
    code: String(value.code ?? ""),
    fromChainage: String(value.fromChainage ?? value.from_chainage ?? ""),
    toChainage: String(value.toChainage ?? value.to_chainage ?? ""),
    side: String(value.side ?? ""),
    sortOrder: Number(value.sortOrder ?? value.sort_order ?? 0) || 0,
    createdAt: String(value.createdAt ?? value.created_at ?? ""),
    updatedAt: String(value.updatedAt ?? value.updated_at ?? ""),
  };
};

const nodeToRow = (node: StoredProjectNode) => ({
  id: node.id,
  project_id: node.projectId,
  parent_id: node.parentId || null,
  node_type: node.nodeType,
  name: node.name,
  code: node.code || null,
  from_chainage: node.fromChainage || null,
  to_chainage: node.toChainage || null,
  side: node.side || null,
  sort_order: node.sortOrder,
  updated_at: node.updatedAt,
});

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
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selectedTemplates = useMemo(
    () => ENGINEERING_TEMPLATES.filter((template) => selectedIds.includes(template.id)),
    [selectedIds],
  );

  useEffect(() => {
    setProjectId(window.localStorage.getItem(CURRENT_PROJECT_STORAGE_KEY)?.trim() ?? "");
  }, []);

  const toggleTemplate = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const saveTreeToProject = async () => {
    if (!projectId) {
      setMessage("יש לחזור לדף הבית, לבחור פרויקט ולפתוח שוב את ספריית התבניות.");
      return;
    }
    if (!selectedTemplates.length) {
      setMessage("יש לבחור לפחות תבנית אחת.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      let localNodes: StoredProjectNode[] = [];
      try {
        const parsed = JSON.parse(window.localStorage.getItem(PROJECT_STRUCTURE_STORAGE_KEY) || "[]");
        if (Array.isArray(parsed)) localNodes = parsed.map(normalizeStoredNode).filter(Boolean) as StoredProjectNode[];
      } catch {}

      let cloudNodes: StoredProjectNode[] = [];
      if (supabase) {
        const result = await supabase.from(PROJECT_STRUCTURE_TABLE).select("*").eq("project_id", projectId);
        if (!result.error && Array.isArray(result.data)) {
          cloudNodes = result.data.map(normalizeStoredNode).filter(Boolean) as StoredProjectNode[];
        }
      }

      const allNodes = [...localNodes];
      for (const cloudNode of cloudNodes) {
        if (!allNodes.some((node) => node.id === cloudNode.id)) allNodes.push(cloudNode);
      }
      const projectNodes = allNodes.filter((node) => node.projectId === projectId);
      const created: StoredProjectNode[] = [];
      const now = new Date().toISOString();

      const findOrCreate = (
        name: string,
        parentId: string,
        nodeType: StoredProjectNode["nodeType"],
        sortOrder: number,
      ) => {
        const existing = [...projectNodes, ...created].find(
          (node) => node.parentId === parentId && node.name.trim() === name.trim(),
        );
        if (existing) return existing.id;
        const node: StoredProjectNode = {
          id: crypto.randomUUID(), projectId, parentId, nodeType, name,
          code: "", fromChainage: "", toChainage: "", side: "", sortOrder,
          createdAt: now, updatedAt: now,
        };
        created.push(node);
        return node.id;
      };

      const addChildren = (nodes: EngineeringTemplateNode[], parentId: string, depth: number) => {
        nodes.forEach((node, index) => {
          const id = findOrCreate(node.name, parentId, depth === 0 ? "element" : "activity", index);
          if (node.children?.length) addChildren(node.children, id, depth + 1);
        });
      };

      selectedTemplates.forEach((template, index) => {
        const rootId = findOrCreate(template.title, "", "structure", index);
        addChildren(template.nodes, rootId, 0);
      });

      const merged = [...allNodes, ...created];
      window.localStorage.setItem(PROJECT_STRUCTURE_STORAGE_KEY, JSON.stringify(merged));

      let cloudWarning = false;
      if (supabase && created.length) {
        const result = await supabase.from(PROJECT_STRUCTURE_TABLE).upsert(created.map(nodeToRow), { onConflict: "id" });
        cloudWarning = Boolean(result.error);
      }

      setMessage(
        created.length
          ? `נשמרו ${created.length} סעיפים בעץ הפרויקט.${cloudWarning ? " העץ נשמר בדפדפן, אך השמירה בענן נכשלה." : ""}`
          : "כל הסעיפים שנבחרו כבר קיימים בעץ הפרויקט.",
      );
    } catch (error) {
      setMessage(`שמירת העץ נכשלה: ${error instanceof Error ? error.message : "שגיאה לא צפויה"}`);
    } finally {
      setSaving(false);
    }
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
              נבחרו {selectedTemplates.length} תבניות. שמירת העץ תוסיף את הסעיפים לפרויקט הפעיל ותאפשר לשייך אליהם רשימות תיוג.
            </div>
          </div>
          <button
            type="button"
            onClick={saveTreeToProject}
            disabled={saving || !selectedTemplates.length}
            style={{ border: 0, background: saving ? "#94a3b8" : "#0f172a", color: "#fff", borderRadius: 12, padding: "12px 20px", fontWeight: 950, cursor: saving ? "wait" : "pointer", whiteSpace: "nowrap" }}
          >
            {saving ? "שומר..." : "שמור עץ בפרויקט"}
          </button>
        </div>

        {message ? (
          <div role="status" style={{ marginBottom: 14, padding: "11px 14px", borderRadius: 12, background: message.includes("נכשל") || message.includes("יש ") ? "#fff7ed" : "#ecfdf5", color: "#0f172a", fontWeight: 800 }}>
            {message}
            {message.startsWith("נשמרו") || message.startsWith("כל הסעיפים") ? (
              <button type="button" onClick={() => { window.location.href = "/"; }} style={{ marginInlineStart: 12, border: 0, background: "transparent", color: "#0369a1", fontWeight: 950, cursor: "pointer", textDecoration: "underline" }}>
                חזרה לפרויקט
              </button>
            ) : null}
          </div>
        ) : null}

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
