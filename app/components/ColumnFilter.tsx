"use client";

import { useId } from "react";
import type { ChangeEventHandler, InputHTMLAttributes } from "react";

/** A visible dropdown alongside the existing free-text column search. */
export function ColumnFilter({ options, style, onChange, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & { options: string[]; onChange?: ChangeEventHandler<HTMLInputElement | HTMLSelectElement> }) {
  const id = useId();
  const values = Array.from(new Set(options.map((value) => value.trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "he", { numeric: true }));
  return (
    <div style={{ position: "relative", minWidth: style?.minWidth, width: "100%" }}>
      <input {...props} onChange={onChange} id={id} style={{ ...style, width: "100%", paddingInlineEnd: 32 }} />
      <select
        aria-label={`בחר ערך — ${props["aria-label"] || props.placeholder || "סינון"}`}
        value={String(props.value ?? "")}
        disabled={props.disabled}
        onChange={onChange}
        style={{ position: "absolute", insetInlineEnd: 0, top: 0, bottom: 0, width: 30, appearance: "none", background: "transparent", color: "transparent", border: 0, borderRadius: 8, cursor: "pointer" }}
      >
        <option style={{ color: "#0f172a", background: "#fff" }} value="">הכול</option>
        {props.value && !values.includes(String(props.value)) ? <option style={{ color: "#0f172a", background: "#fff" }} value={String(props.value)}>{String(props.value)}</option> : null}
        {values.map((value) => <option style={{ color: "#0f172a", background: "#fff" }} key={value} value={value}>{value}</option>)}
      </select>
      <span aria-hidden="true" style={{ position: "absolute", insetInlineEnd: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#64748b", fontSize: 12 }}>▾</span>
    </div>
  );
}
