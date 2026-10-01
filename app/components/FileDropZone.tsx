import { useRef, useState, type CSSProperties } from "react";
import { styles } from "./common";

type Props = {
  accept?: string;
  multiple?: boolean;
  buttonLabel?: string;
  helperText?: string;
  /** תצוגה מצומצמת: כפתור קטן בלבד (עדיין אפשר לגרור אליו קובץ) */
  compact?: boolean;
  onFiles: (files: FileList | File[]) => void | Promise<void>;
};

export function FileDropZone({
  accept,
  multiple = true,
  buttonLabel = "צרף קובץ",
  helperText = "אפשר לבחור קובץ או לגרור לכאן",
  compact = false,
  onFiles,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const zoneStyle: CSSProperties = compact
    ? {
        border: `1px dashed ${dragActive ? "#0b1f3a" : "#b7c2d3"}`,
        borderRadius: 8,
        background: dragActive ? "#eef3fa" : "#fff",
        display: "block",
        transition: "border-color 120ms ease, background 120ms ease",
      }
    : {
    border: `2px dashed ${dragActive ? "#0f172a" : "#cbd5e1"}`,
    borderRadius: 12,
    background: dragActive ? "#eff6ff" : "#f8fafc",
    padding: 14,
    display: "grid",
    gap: 10,
    justifyItems: "center",
    textAlign: "center",
    transition: "border-color 120ms ease, background 120ms ease",
  };

  const handleFiles = (files: FileList | File[] | null) => {
    if (!files || !Array.from(files).length) return;
    void onFiles(files);
  };

  return (
    <div
      style={zoneStyle}
      onDragEnter={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setDragActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setDragActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setDragActive(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      {compact ? (
        <button
          type="button"
          title={`${buttonLabel} (אפשר גם לגרור קובץ לכאן)`}
          onClick={() => inputRef.current?.click()}
          style={{ width: "100%", minHeight: 34, border: 0, background: "transparent", color: "#13305a", fontWeight: 600, fontSize: 12, cursor: "pointer", padding: "6px 8px", lineHeight: 1.3 }}
        >
          + {buttonLabel}
        </button>
      ) : (
        <>
          <div style={{ fontWeight: 900, color: "#0f172a" }}>{helperText}</div>
          <button type="button" style={styles.primaryBtn} onClick={() => inputRef.current?.click()}>
            {buttonLabel}
          </button>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        style={{ display: "none" }}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
