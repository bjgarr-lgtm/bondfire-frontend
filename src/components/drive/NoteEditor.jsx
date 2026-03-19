import React from "react";

export default function NoteEditor({ value, onChange }) {
  return (
    <textarea
      className="input"
      style={{ width: "100%", height: "72vh", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", resize: "vertical" }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
    />
  );
}
