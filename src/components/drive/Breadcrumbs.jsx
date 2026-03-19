import React from "react";

export default function Breadcrumbs({ folders, currentFolder, setCurrentFolder }) {
  const path = [];
  let cursor = currentFolder;

  while (cursor) {
    const folder = folders.find((f) => f.id === cursor);
    if (!folder) break;
    path.unshift(folder);
    cursor = folder.parentId || null;
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, fontSize: 14 }}>
      <button className="btn" type="button" onClick={() => setCurrentFolder(null)}>Root</button>
      {path.map((folder) => (
        <React.Fragment key={folder.id}>
          <span style={{ opacity: 0.6 }}>/</span>
          <button className="btn" type="button" onClick={() => setCurrentFolder(folder.id)}>{folder.name}</button>
        </React.Fragment>
      ))}
    </div>
  );
}
