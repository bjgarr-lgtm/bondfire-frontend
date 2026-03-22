
import React, { useState, useEffect } from "react";

const defaultDoc = {
  elements: [],
  name: "Untitled Design"
};

export default function Studio() {
  const [doc, setDoc] = useState(defaultDoc);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("bf_studio_doc");
    if (saved) setDoc(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("bf_studio_doc", JSON.stringify(doc));
  }, [doc]);

  const pushHistory = (newDoc) => {
    setHistory([...history, doc]);
    setFuture([]);
    setDoc(newDoc);
  };

  const undo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setFuture([doc, ...future]);
    setHistory(history.slice(0, -1));
    setDoc(prev);
  };

  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setHistory([...history, doc]);
    setFuture(future.slice(1));
    setDoc(next);
  };

  const addText = () => {
    const newEl = {
      id: Date.now(),
      type: "text",
      text: "Edit me",
      x: 50,
      y: 50,
      fontSize: 24,
      align: "left"
    };
    pushHistory({ ...doc, elements: [...doc.elements, newEl] });
  };

  const addShape = () => {
    const newEl = {
      id: Date.now(),
      type: "shape",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      color: "#888"
    };
    pushHistory({ ...doc, elements: [...doc.elements, newEl] });
  };

  const updateElement = (id, changes) => {
    const updated = doc.elements.map(el =>
      el.id === id ? { ...el, ...changes } : el
    );
    pushHistory({ ...doc, elements: updated });
  };

  const deleteSelected = () => {
    if (!selected) return;
    const filtered = doc.elements.filter(el => el.id !== selected.id);
    pushHistory({ ...doc, elements: filtered });
    setSelected(null);
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Delete") deleteSelected();
      if (e.ctrlKey && e.key === "z") undo();
      if (e.ctrlKey && e.key === "y") redo();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <div style={{ width: 250, borderRight: "1px solid #ccc", padding: 10 }}>
        <button onClick={addText}>Add Text</button>
        <button onClick={addShape}>Add Shape</button>
        <button onClick={undo}>Undo</button>
        <button onClick={redo}>Redo</button>

        <h4>Layers</h4>
        {doc.elements.map(el => (
          <div key={el.id} onClick={() => setSelected(el)}>
            {el.type} #{el.id}
          </div>
        ))}

        {selected && (
          <div>
            <h4>Edit</h4>
            {selected.type === "text" && (
              <>
                <input
                  value={selected.text}
                  onChange={e => updateElement(selected.id, { text: e.target.value })}
                />
                <select
                  value={selected.align}
                  onChange={e => updateElement(selected.id, { align: e.target.value })}
                >
                  <option>left</option>
                  <option>center</option>
                  <option>right</option>
                </select>
              </>
            )}
            <input
              type="color"
              value={selected.color || "#000000"}
              onChange={e => updateElement(selected.id, { color: e.target.value })}
            />
          </div>
        )}
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        {doc.elements.map(el => (
          <div
            key={el.id}
            onClick={() => setSelected(el)}
            style={{
              position: "absolute",
              left: el.x,
              top: el.y,
              border: selected?.id === el.id ? "1px solid red" : "none",
              color: el.color
            }}
          >
            {el.type === "text" ? el.text : (
              <div style={{ width: el.width, height: el.height, background: el.color }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
