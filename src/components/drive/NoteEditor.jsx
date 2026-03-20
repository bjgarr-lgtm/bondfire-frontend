import React from "react";
export default function NoteEditor({ value, onChange, focusMode, editorRef }) {
  return <div style={{ maxWidth: 920, margin: "0 auto", background: "rgba(255,255,255,0.02)", border: "1px solid #222", borderRadius: 12, padding: focusMode ? 12 : 10 }}>
    <textarea ref={editorRef} value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} style={{ width: "100%", minHeight: focusMode ? "84vh" : "72vh", background: "transparent", border: "none", outline: "none", color: "#f5f5f5", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 14, lineHeight: 1.65, resize: "none" }} />
  </div>;
}
