import React from "react";

export default function NoteEditor({ value, onChange }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      style={{
        width: "100%",
        minHeight: "75vh",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 16,
        lineHeight: 1.8,
        background: "transparent",
        border: "none",
        outline: "none",
        resize: "none",
        padding: "24px 32px",
        maxWidth: "800px",
        margin: "0 auto",
        display: "block"
      }}
    />
  );
}
