import React from "react";

export default function NoteEditor({ value, onChange }) {
  return (
    <textarea
      className="input"
      style={{ width: "100%", minHeight: "72vh", resize: "vertical" }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="# Untitled\n\nWrite markdown here. Use [[Wiki Links]] to connect notes."
    />
  );
}
