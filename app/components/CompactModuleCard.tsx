"use client";

type CompactModuleCardProps = {
  icon: string;
  title: string;
  subtitle?: string;
  count?: number;
};

export function CompactModuleCard({
  icon,
  title,
  subtitle,
  count,
}: CompactModuleCardProps) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: "10px 14px",
        minHeight: 88,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        transition: "0.2s",
      }}
    >
      {/* LEFT ICON */}
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: "#f3f4f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      {/* CONTENT */}
      <div
        style={{
          flex: 1,
          textAlign: "right",
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 15,
            color: "#111827",
          }}
        >
          {title}
        </div>

        {subtitle && (
          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
              marginTop: 4,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {/* COUNT */}
      {count !== undefined && (
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "#111827",
            minWidth: 30,
            textAlign: "center",
          }}
        >
          {count}
        </div>
      )}
    </div>
  );
}