import React, { useState } from "react";
export default function DriveSidebar({ folders, currentFolder, setCurrentFolder, onNewFolder, onRename, onDelete, tags, selectedTag, setSelectedTag, templates = [], onApplyTemplate, onDeleteTemplate, chromeCollapsed = true }) {
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const render = (parentId = null, depth = 0) =>
    folders.filter((f) => f.parentId === parentId).map((f) => (
      <div key={f.id} style={{ paddingLeft: depth * 12, marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
          <span style={{ cursor: "pointer", fontWeight: currentFolder === f.id ? 800 : 500, minWidth: 0, flex: 1 }} onClick={() => setCurrentFolder(f.id)} title={f.name}>📁 {f.name}</span>
          {!chromeCollapsed ? <span style={{ display: "flex", gap: 4 }}>
            <button className="btn" type="button" onClick={() => onRename(f.id)}>r</button>
            <button className="btn" type="button" onClick={() => onDelete(f.id)}>x</button>
          </span> : null}
        </div>
        {render(f.id, depth + 1)}
      </div>
    ));
  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className="btn" type="button" onClick={() => setCurrentFolder(null)}>Root</button>
        <button className="btn" type="button" onClick={onNewFolder}>+ Folder</button>
      </div>
      {render()}
      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Templates</h3>
          <button className="btn" type="button" onClick={() => setTemplatesOpen((v) => !v)}>{templatesOpen ? "Hide" : "Show"}</button>
        </div>
        {templatesOpen ? <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {templates.length ? templates.map((tpl) => (
            <div key={tpl.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "center" }}>
              <button className="btn" type="button" onClick={() => onApplyTemplate?.(tpl)} style={{ textAlign: "left" }}>{tpl.name}</button>
              {!chromeCollapsed ? <button className="btn" type="button" onClick={() => onDeleteTemplate?.(tpl.id)}>x</button> : null}
            </div>
          )) : <div className="helper">No templates yet.</div>}
        </div> : null}
      </div>
      <div style={{ marginTop: 18 }}>
        <h3 style={{ marginBottom: 8 }}>Tags</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" type="button" onClick={() => setSelectedTag("")} style={{ fontWeight: !selectedTag ? 800 : 400 }}>all</button>
          {tags.map((tag) => <button key={tag} className="btn" type="button" onClick={() => setSelectedTag(tag)} style={{ fontWeight: selectedTag === tag ? 800 : 400 }}>#{tag}</button>)}
        </div>
      </div>
    </div>
  );
}
