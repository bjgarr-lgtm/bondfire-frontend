import React from "react";

export default function DriveSidebar({
  folders,
  currentFolder,
  setCurrentFolder,
  onNewFolder,
  onRename,
  onDelete,
}) {
  const renderTree = (parentId = null, depth = 0) => {
    return folders
      .filter((folder) => (folder.parentId || null) === parentId)
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
      .map((folder) => (
        <div key={folder.id} style={{ marginTop: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: depth * 12 }}>
            <button
              type="button"
              className="btn"
              onClick={() => setCurrentFolder(folder.id)}
              style={{
                flex: 1,
                justifyContent: "flex-start",
                background: currentFolder === folder.id ? "rgba(255,255,255,0.10)" : undefined,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={folder.name}
            >
              📁 {folder.name}
            </button>
            <button className="btn" type="button" onClick={() => onRename(folder.id)}>r</button>
            <button className="btn" type="button" onClick={() => onDelete(folder.id)}>x</button>
          </div>
          {renderTree(folder.id, depth + 1)}
        </div>
      ));
  };

  return (
    <div style={{ padding: 12, height: "100%", overflow: "auto" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button className="btn" type="button" onClick={() => setCurrentFolder(null)}>Root</button>
        <button className="btn" type="button" onClick={onNewFolder}>+ Folder</button>
      </div>
      {renderTree()}
    </div>
  );
}
