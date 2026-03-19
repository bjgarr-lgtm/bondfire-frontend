import React from "react";

export default function NoteEditor({ value, onChange }) {
  return (
    <textarea
      className="input"
      style={{ width: "100%", height: "70vh" }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
