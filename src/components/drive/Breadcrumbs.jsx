import React from "react";

export default function Breadcrumbs({ folders, currentFolder, setCurrentFolder }) {
  const buildPath = () => {
    const path = [];
    let current = currentFolder;
    while (current) {
      const f = folders.find((x) => x.id === current);
      if (!f) break;
      path.unshift(f);
      current = f.parentId;
    }
    return path;
  };

  const path = buildPath();

  return (
    <div style={{ marginBottom: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
      <span style={{ cursor: "pointer" }} onClick={() => setCurrentFolder(null)}>Root</span>
      {path.map((f) => (
        <span key={f.id}>
          {" / "}
          <span style={{ cursor: "pointer" }} onClick={() => setCurrentFolder(f.id)}>
            {f.name}
          </span>
        </span>
      ))}
    </div>
  );
}
