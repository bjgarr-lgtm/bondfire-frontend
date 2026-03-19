import React, { useState } from "react";
import NoteEditor from "../components/drive/NoteEditor.jsx";
import NotePreview from "../components/drive/NotePreview.jsx";

export default function Drive() {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("untitled");
  const [mode, setMode] = useState("split");
  const [focus, setFocus] = useState(false);

  const editor = <NoteEditor value={content} onChange={setContent} />;
  const preview = <NotePreview content={content} />;

  return (
    <div style={{
      height: "100vh",
      background: "#0b0b0b",
      color: "#eee",
      overflow: "auto"
    }}>
      {!focus && (
        <div style={{
          padding: 16,
          borderBottom: "1px solid #222",
          display: "flex",
          gap: 8
        }}>
          <button onClick={()=>setMode("edit")}>Source</button>
          <button onClick={()=>setMode("read")}>Reading</button>
          <button onClick={()=>setMode("split")}>Split</button>
          <button onClick={()=>setFocus(true)}>Focus</button>
        </div>
      )}

      <input
        value={title}
        onChange={(e)=>setTitle(e.target.value)}
        style={{
          width: "100%",
          fontSize: 28,
          background: "transparent",
          border: "none",
          outline: "none",
          padding: "24px 32px",
          maxWidth: "800px",
          margin: "0 auto",
          display: "block"
        }}
      />

      {mode === "edit" && editor}
      {mode === "read" && preview}
      {mode === "split" && (
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr"}}>
          {editor}
          {preview}
        </div>
      )}

      {focus && (
        <button
          onClick={()=>setFocus(false)}
          style={{
            position:"fixed",
            top:20,
            right:20
          }}
        >
          Exit
        </button>
      )}
    </div>
  );
}
