import React from "react";
import { useParams } from "react-router-dom";

const STORAGE_PREFIX = "bf_studio_v1";
const PRESETS = [
  { id: "flyer", label: "Flyer", width: 1080, height: 1350 },
  { id: "square", label: "Square Post", width: 1080, height: 1080 },
  { id: "story", label: "Story", width: 1080, height: 1920 },
  { id: "banner", label: "Banner", width: 1600, height: 900 },
];

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const px = (n) => `${Math.round(Number(n) || 0)}px`;

function getStorageKey(orgId) {
  return `${STORAGE_PREFIX}_${orgId || "global"}`;
}

function makeEmptyDocument(preset = PRESETS[0]) {
  return {
    id: uid("studio_doc"),
    name: `untitled ${preset.label.toLowerCase()}`,
    canvas: {
      width: preset.width,
      height: preset.height,
      background: "#ffffff",
      presetId: preset.id,
    },
    elements: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function exportSvgMarkup(doc) {
  const width = Number(doc?.canvas?.width || 1080);
  const height = Number(doc?.canvas?.height || 1350);
  const background = String(doc?.canvas?.background || "#ffffff");
  const items = Array.isArray(doc?.elements) ? doc.elements : [];

  const escapeXml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");

  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${escapeXml(background)}" />`,
  ];

  items.forEach((item) => {
    const x = Math.round(Number(item.x) || 0);
    const y = Math.round(Number(item.y) || 0);
    const w = Math.max(1, Math.round(Number(item.w) || 1));
    const h = Math.max(1, Math.round(Number(item.h) || 1));
    const rotation = Number(item.rotation) || 0;
    const opacity = clamp(Number(item.opacity ?? 1), 0, 1);
    const transform = rotation ? ` transform="rotate(${rotation} ${x + w / 2} ${y + h / 2})"` : "";

    if (item.type === "rect") {
      lines.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${escapeXml(item.fill || "#e11d48")}" rx="${Math.round(Number(item.radius) || 18)}" opacity="${opacity}"${transform} />`);
      return;
    }

    if (item.type === "text") {
      const fontSize = Math.max(12, Math.round(Number(item.fontSize) || 48));
      const fontFamily = escapeXml(item.fontFamily || "Inter, Arial, sans-serif");
      const fontWeight = escapeXml(item.fontWeight || 700);
      const color = escapeXml(item.color || "#111111");
      const text = escapeXml(item.text || "text");
      const lineHeight = Math.round(fontSize * clamp(Number(item.lineHeight || 1.15), 0.8, 2));
      const rows = text.split("\n");
      const baseY = y + fontSize;
      lines.push(`<g opacity="${opacity}"${transform}>`);
      rows.forEach((row, index) => {
        lines.push(`<text x="${x}" y="${baseY + (index * lineHeight)}" font-size="${fontSize}" font-family="${fontFamily}" font-weight="${fontWeight}" fill="${color}">${escapeXml(row)}</text>`);
      });
      lines.push(`</g>`);
      return;
    }

    if (item.type === "image" && item.src) {
      lines.push(`<image x="${x}" y="${y}" width="${w}" height="${h}" opacity="${opacity}" preserveAspectRatio="none" xlink:href="${escapeXml(item.src)}"${transform} />`);
    }
  });

  lines.push(`</svg>`);
  return lines.join("\n");
}

function triggerDownload(name, href) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

function DraggableHandle({ side, onPointerDown }) {
  const common = {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "#ffffff",
    border: "2px solid #0f172a",
    boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
    zIndex: 4,
  };

  const positions = {
    nw: { left: -6, top: -6, cursor: "nwse-resize" },
    ne: { right: -6, top: -6, cursor: "nesw-resize" },
    sw: { left: -6, bottom: -6, cursor: "nesw-resize" },
    se: { right: -6, bottom: -6, cursor: "nwse-resize" },
  };

  return <button type="button" aria-label={`Resize ${side}`} onPointerDown={onPointerDown} style={{ ...common, ...positions[side] }} />;
}

function CanvasElement({ element, selected, scale, onSelect, onDragStart, onResizeStart }) {
  const shellStyle = {
    position: "absolute",
    left: px(element.x),
    top: px(element.y),
    width: px(element.w),
    height: px(element.h),
    transform: `rotate(${Number(element.rotation) || 0}deg)`,
    transformOrigin: "center center",
    cursor: "move",
    opacity: clamp(Number(element.opacity ?? 1), 0, 1),
    userSelect: "none",
  };

  let inner = null;

  if (element.type === "rect") {
    inner = (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: px(element.radius || 18),
          background: element.fill || "#e11d48",
        }}
      />
    );
  }

  if (element.type === "text") {
    inner = (
      <div
        style={{
          width: "100%",
          minHeight: "100%",
          whiteSpace: "pre-wrap",
          color: element.color || "#111111",
          fontSize: px(element.fontSize || 48),
          fontFamily: element.fontFamily || "Inter, Arial, sans-serif",
          fontWeight: element.fontWeight || 700,
          lineHeight: String(element.lineHeight || 1.15),
        }}
      >
        {element.text || "text"}
      </div>
    );
  }

  if (element.type === "image") {
    inner = (
      <img
        src={element.src}
        alt={element.name || "studio asset"}
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: px(element.radius || 0), pointerEvents: "none" }}
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onMouseDown={(e) => onSelect(e, element.id)}
      onPointerDown={(e) => onDragStart(e, element.id)}
      style={shellStyle}
    >
      {inner}
      {selected ? (
        <>
          <div style={{ position: "absolute", inset: -2, border: `2px solid ${selected ? "#2563eb" : "transparent"}`, pointerEvents: "none" }} />
          <DraggableHandle side="nw" onPointerDown={(e) => onResizeStart(e, element.id, "nw")} />
          <DraggableHandle side="ne" onPointerDown={(e) => onResizeStart(e, element.id, "ne")} />
          <DraggableHandle side="sw" onPointerDown={(e) => onResizeStart(e, element.id, "sw")} />
          <DraggableHandle side="se" onPointerDown={(e) => onResizeStart(e, element.id, "se")} />
        </>
      ) : null}
    </div>
  );
}

export default function Studio() {
  const { orgId } = useParams();
  const storageKey = React.useMemo(() => getStorageKey(orgId), [orgId]);
  const workspaceRef = React.useRef(null);
  const fileInputRef = React.useRef(null);
  const dragRef = React.useRef(null);

  const [docs, setDocs] = React.useState([]);
  const [selectedDocId, setSelectedDocId] = React.useState(null);
  const [selectedElementId, setSelectedElementId] = React.useState(null);
  const [status, setStatus] = React.useState("ready");
  const [zoom, setZoom] = React.useState(0.42);

  React.useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || "{}");
      const savedDocs = Array.isArray(raw.docs) ? raw.docs : [];
      const firstDoc = savedDocs[0] || makeEmptyDocument(PRESETS[0]);
      const nextDocs = savedDocs.length ? savedDocs : [firstDoc];
      setDocs(nextDocs);
      setSelectedDocId(raw.selectedDocId || firstDoc.id);
    } catch {
      const fallback = makeEmptyDocument(PRESETS[0]);
      setDocs([fallback]);
      setSelectedDocId(fallback.id);
    }
  }, [storageKey]);

  React.useEffect(() => {
    if (!docs.length) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ docs, selectedDocId }));
      setStatus("saved locally");
    } catch {
      setStatus("save failed");
    }
  }, [docs, selectedDocId, storageKey]);

  const selectedDoc = React.useMemo(() => docs.find((doc) => doc.id === selectedDocId) || docs[0] || null, [docs, selectedDocId]);
  const selectedElement = React.useMemo(() => selectedDoc?.elements?.find((item) => item.id === selectedElementId) || null, [selectedDoc, selectedElementId]);

  const setDoc = React.useCallback((updater) => {
    setDocs((prev) => prev.map((doc) => (doc.id === selectedDocId ? updater(doc) : doc)));
  }, [selectedDocId]);

  React.useEffect(() => {
    if (!selectedDoc) return;
    if (!selectedDoc.elements.some((item) => item.id === selectedElementId)) {
      setSelectedElementId(selectedDoc.elements[0]?.id || null);
    }
  }, [selectedDoc, selectedElementId]);

  function createDocument(preset = PRESETS[0]) {
    const doc = makeEmptyDocument(preset);
    setDocs((prev) => [doc, ...prev]);
    setSelectedDocId(doc.id);
    setSelectedElementId(null);
    setStatus("new document created");
  }

  function duplicateDocument() {
    if (!selectedDoc) return;
    const clone = {
      ...selectedDoc,
      id: uid("studio_doc"),
      name: `${selectedDoc.name} copy`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      elements: selectedDoc.elements.map((item) => ({ ...item, id: uid(item.type || "el"), x: item.x + 24, y: item.y + 24 })),
    };
    setDocs((prev) => [clone, ...prev]);
    setSelectedDocId(clone.id);
    setSelectedElementId(clone.elements[0]?.id || null);
    setStatus("document duplicated");
  }

  function renameDocument(name) {
    setDoc((doc) => ({ ...doc, name, updatedAt: Date.now() }));
  }

  function updateCanvas(patch) {
    setDoc((doc) => ({ ...doc, canvas: { ...doc.canvas, ...patch }, updatedAt: Date.now() }));
  }

  function addRect() {
    if (!selectedDoc) return;
    const rect = {
      id: uid("rect"),
      type: "rect",
      x: 120,
      y: 120,
      w: 320,
      h: 220,
      rotation: 0,
      fill: "#e11d48",
      radius: 22,
      opacity: 1,
      name: "shape",
    };
    setDoc((doc) => ({ ...doc, elements: [...doc.elements, rect], updatedAt: Date.now() }));
    setSelectedElementId(rect.id);
    setStatus("shape added");
  }

  function addText() {
    if (!selectedDoc) return;
    const text = {
      id: uid("text"),
      type: "text",
      x: 120,
      y: 120,
      w: 680,
      h: 180,
      rotation: 0,
      text: "new headline",
      color: "#111111",
      fontSize: 72,
      fontFamily: "Inter, Arial, sans-serif",
      fontWeight: 800,
      lineHeight: 1.05,
      opacity: 1,
      name: "headline",
    };
    setDoc((doc) => ({ ...doc, elements: [...doc.elements, text], updatedAt: Date.now() }));
    setSelectedElementId(text.id);
    setStatus("text added");
  }

  async function onPickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const src = await readImageFile(file);
      const image = {
        id: uid("image"),
        type: "image",
        x: 140,
        y: 140,
        w: 420,
        h: 420,
        rotation: 0,
        opacity: 1,
        src,
        name: file.name || "image",
      };
      setDoc((doc) => ({ ...doc, elements: [...doc.elements, image], updatedAt: Date.now() }));
      setSelectedElementId(image.id);
      setStatus("image added");
    } catch {
      setStatus("image read failed");
    } finally {
      e.target.value = "";
    }
  }

  function updateElement(id, patch) {
    setDoc((doc) => ({
      ...doc,
      elements: doc.elements.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      updatedAt: Date.now(),
    }));
  }

  function deleteElement() {
    if (!selectedElementId) return;
    setDoc((doc) => ({
      ...doc,
      elements: doc.elements.filter((item) => item.id !== selectedElementId),
      updatedAt: Date.now(),
    }));
    setSelectedElementId(null);
    setStatus("element deleted");
  }

  function moveLayer(direction) {
    if (!selectedElementId || !selectedDoc) return;
    const idx = selectedDoc.elements.findIndex((item) => item.id === selectedElementId);
    if (idx === -1) return;
    const nextIdx = clamp(idx + direction, 0, selectedDoc.elements.length - 1);
    if (idx === nextIdx) return;
    const copy = [...selectedDoc.elements];
    const [item] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, item);
    setDoc((doc) => ({ ...doc, elements: copy, updatedAt: Date.now() }));
    setStatus(direction > 0 ? "sent forward" : "sent backward");
  }

  function onCanvasPointerDown(e) {
    if (e.target === e.currentTarget) {
      setSelectedElementId(null);
    }
  }

  function startDrag(e, id) {
    if (e.target.tagName === "BUTTON") return;
    e.preventDefault();
    e.stopPropagation();
    const doc = selectedDoc;
    const element = doc?.elements?.find((item) => item.id === id);
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!element || !rect) return;
    setSelectedElementId(id);
    dragRef.current = {
      mode: "move",
      id,
      startX: e.clientX,
      startY: e.clientY,
      originX: element.x,
      originY: element.y,
      canvasRect: rect,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function startResize(e, id, corner) {
    e.preventDefault();
    e.stopPropagation();
    const doc = selectedDoc;
    const element = doc?.elements?.find((item) => item.id === id);
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!element || !rect) return;
    setSelectedElementId(id);
    dragRef.current = {
      mode: "resize",
      id,
      corner,
      startX: e.clientX,
      startY: e.clientY,
      originX: element.x,
      originY: element.y,
      originW: element.w,
      originH: element.h,
      canvasRect: rect,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  React.useEffect(() => {
    const onMove = (e) => {
      const drag = dragRef.current;
      if (!drag || !selectedDoc) return;
      const dx = (e.clientX - drag.startX) / zoom;
      const dy = (e.clientY - drag.startY) / zoom;

      if (drag.mode === "move") {
        const element = selectedDoc.elements.find((item) => item.id === drag.id);
        if (!element) return;
        const nextX = clamp(drag.originX + dx, 0, Math.max(0, selectedDoc.canvas.width - element.w));
        const nextY = clamp(drag.originY + dy, 0, Math.max(0, selectedDoc.canvas.height - element.h));
        updateElement(drag.id, { x: nextX, y: nextY });
      }

      if (drag.mode === "resize") {
        const minW = 80;
        const minH = 50;
        let next = {
          x: drag.originX,
          y: drag.originY,
          w: drag.originW,
          h: drag.originH,
        };

        if (drag.corner.includes("e")) next.w = Math.max(minW, drag.originW + dx);
        if (drag.corner.includes("s")) next.h = Math.max(minH, drag.originH + dy);
        if (drag.corner.includes("w")) {
          next.x = clamp(drag.originX + dx, 0, drag.originX + drag.originW - minW);
          next.w = Math.max(minW, drag.originW - dx);
        }
        if (drag.corner.includes("n")) {
          next.y = clamp(drag.originY + dy, 0, drag.originY + drag.originH - minH);
          next.h = Math.max(minH, drag.originH - dy);
        }

        next.w = Math.min(next.w, selectedDoc.canvas.width - next.x);
        next.h = Math.min(next.h, selectedDoc.canvas.height - next.y);
        updateElement(drag.id, next);
      }
    };

    const onUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [selectedDoc, zoom]);

  async function exportPng() {
    if (!selectedDoc) return;
    setStatus("exporting png");
    const svg = exportSvgMarkup(selectedDoc);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("png export failed"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = selectedDoc.canvas.width;
      canvas.height = selectedDoc.canvas.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0);
      triggerDownload(`${selectedDoc.name || "bondfire-studio"}.png`, canvas.toDataURL("image/png"));
      setStatus("png exported");
    } catch {
      setStatus("png export failed");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function exportPdf() {
    if (!selectedDoc) return;
    const svg = exportSvgMarkup(selectedDoc);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=900");
    if (!printWindow) {
      URL.revokeObjectURL(url);
      setStatus("popup blocked during pdf export");
      return;
    }
    printWindow.document.write(`<!doctype html><html><head><title>${selectedDoc.name}</title><style>html,body{margin:0;padding:0;background:#fff}img{display:block;width:100%;height:auto}</style></head><body><img src="${url}" alt="${selectedDoc.name}" onload="setTimeout(function(){window.print();},150)"></body></html>`);
    printWindow.document.close();
    setStatus("print dialog opened for pdf save");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  const canvasScale = zoom;
  const docWidth = selectedDoc?.canvas?.width || 1080;
  const docHeight = selectedDoc?.canvas?.height || 1350;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0,1fr) 320px", gap: 16, padding: 16, minHeight: "calc(100vh - 72px)", background: "#0b1020", color: "#f8fafc" }}>
      <aside className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
        <div>
          <div className="helper" style={{ textTransform: "uppercase", letterSpacing: ".08em" }}>Bondfire Studio</div>
          <h2 style={{ margin: "6px 0 0 0" }}>Phase 1 editor</h2>
          <div className="helper" style={{ marginTop: 6 }}>Org scoped canvas docs with local save, basic layers, image upload, and export. Because apparently this needed to become real.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button className="btn" type="button" onClick={() => createDocument(PRESETS[0])}>New flyer</button>
          <button className="btn secondary" type="button" onClick={duplicateDocument} disabled={!selectedDoc}>Duplicate</button>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="helper">Canvas presets</div>
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="btn secondary"
              onClick={() => updateCanvas({ width: preset.width, height: preset.height, presetId: preset.id })}
            >
              {preset.label} · {preset.width}×{preset.height}
            </button>
          ))}
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 12, minHeight: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="helper">Documents</div>
          <div style={{ display: "grid", gap: 8, overflow: "auto", paddingRight: 4 }}>
            {docs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedDocId(doc.id)}
                style={{
                  textAlign: "left",
                  padding: 12,
                  borderRadius: 14,
                  border: `1px solid ${doc.id === selectedDocId ? "rgba(96,165,250,0.78)" : "rgba(255,255,255,0.12)"}`,
                  background: doc.id === selectedDocId ? "rgba(37,99,235,0.18)" : "rgba(255,255,255,0.04)",
                  color: "#f8fafc",
                }}
              >
                <div style={{ fontWeight: 700 }}>{doc.name}</div>
                <div className="helper" style={{ marginTop: 4 }}>{doc.canvas.width}×{doc.canvas.height} · {doc.elements.length} layers</div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="card" style={{ padding: 14, display: "grid", gridTemplateRows: "auto auto minmax(0,1fr)", gap: 12, minHeight: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <input className="input" value={selectedDoc?.name || ""} onChange={(e) => renameDocument(e.target.value)} placeholder="Document name" style={{ minWidth: 260, maxWidth: 360 }} />
          <button className="btn" type="button" onClick={addText}>Add text</button>
          <button className="btn" type="button" onClick={addRect}>Add shape</button>
          <button className="btn" type="button" onClick={() => fileInputRef.current?.click()}>Add image</button>
          <button className="btn secondary" type="button" onClick={() => moveLayer(-1)} disabled={!selectedElementId}>Back</button>
          <button className="btn secondary" type="button" onClick={() => moveLayer(1)} disabled={!selectedElementId}>Forward</button>
          <button className="btn secondary" type="button" onClick={deleteElement} disabled={!selectedElementId}>Delete</button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickImage} style={{ display: "none" }} />
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn secondary" type="button" onClick={() => setZoom((z) => clamp(z - 0.05, 0.2, 1))}>−</button>
            <div className="helper">{Math.round(zoom * 100)}%</div>
            <button className="btn secondary" type="button" onClick={() => setZoom((z) => clamp(z + 0.05, 0.2, 1))}>+</button>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <label className="helper">Background</label>
          <input type="color" value={selectedDoc?.canvas?.background || "#ffffff"} onChange={(e) => updateCanvas({ background: e.target.value })} />
          <button className="btn secondary" type="button" onClick={exportPng}>Export PNG</button>
          <button className="btn secondary" type="button" onClick={exportPdf}>Export PDF</button>
          <div className="helper" style={{ marginLeft: "auto" }}>{status}</div>
        </div>

        <div style={{ minHeight: 0, overflow: "auto", borderRadius: 18, background: "linear-gradient(180deg, rgba(15,23,42,0.9), rgba(2,6,23,0.96))", border: "1px solid rgba(255,255,255,0.08)", padding: 20 }}>
          <div
            ref={workspaceRef}
            onMouseDown={onCanvasPointerDown}
            style={{
              position: "relative",
              width: px(docWidth * canvasScale),
              height: px(docHeight * canvasScale),
              margin: "0 auto",
              background: selectedDoc?.canvas?.background || "#ffffff",
              boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(15,23,42,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.03) 1px, transparent 1px)", backgroundSize: `${24 * canvasScale}px ${24 * canvasScale}px`, pointerEvents: "none" }} />
            <div style={{ transform: `scale(${canvasScale})`, transformOrigin: "top left", width: px(docWidth), height: px(docHeight), position: "relative" }}>
              {(selectedDoc?.elements || []).map((element) => (
                <CanvasElement
                  key={element.id}
                  element={element}
                  selected={element.id === selectedElementId}
                  scale={canvasScale}
                  onSelect={(_, id) => setSelectedElementId(id)}
                  onDragStart={startDrag}
                  onResizeStart={startResize}
                />
              ))}
            </div>
          </div>
        </div>
      </main>

      <aside className="card" style={{ padding: 14, display: "grid", gridTemplateRows: "auto auto minmax(0,1fr)", gap: 12, minHeight: 0 }}>
        <div>
          <div className="helper">Inspector</div>
          <h3 style={{ margin: "6px 0 0 0" }}>{selectedElement ? selectedElement.name || selectedElement.type : "Nothing selected"}</h3>
        </div>

        {selectedElement ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label style={{ display: "grid", gap: 4 }}><span className="helper">X</span><input className="input" type="number" value={Math.round(selectedElement.x)} onChange={(e) => updateElement(selectedElement.id, { x: Number(e.target.value) || 0 })} /></label>
              <label style={{ display: "grid", gap: 4 }}><span className="helper">Y</span><input className="input" type="number" value={Math.round(selectedElement.y)} onChange={(e) => updateElement(selectedElement.id, { y: Number(e.target.value) || 0 })} /></label>
              <label style={{ display: "grid", gap: 4 }}><span className="helper">W</span><input className="input" type="number" value={Math.round(selectedElement.w)} onChange={(e) => updateElement(selectedElement.id, { w: Math.max(80, Number(e.target.value) || 80) })} /></label>
              <label style={{ display: "grid", gap: 4 }}><span className="helper">H</span><input className="input" type="number" value={Math.round(selectedElement.h)} onChange={(e) => updateElement(selectedElement.id, { h: Math.max(50, Number(e.target.value) || 50) })} /></label>
            </div>
            <label style={{ display: "grid", gap: 4 }}><span className="helper">Rotation</span><input className="input" type="number" value={Number(selectedElement.rotation) || 0} onChange={(e) => updateElement(selectedElement.id, { rotation: Number(e.target.value) || 0 })} /></label>
            <label style={{ display: "grid", gap: 4 }}><span className="helper">Opacity</span><input className="input" type="number" min="0" max="1" step="0.05" value={Number(selectedElement.opacity ?? 1)} onChange={(e) => updateElement(selectedElement.id, { opacity: clamp(Number(e.target.value) || 0, 0, 1) })} /></label>

            {selectedElement.type === "rect" ? (
              <>
                <label style={{ display: "grid", gap: 4 }}><span className="helper">Fill</span><input type="color" value={selectedElement.fill || "#e11d48"} onChange={(e) => updateElement(selectedElement.id, { fill: e.target.value })} /></label>
                <label style={{ display: "grid", gap: 4 }}><span className="helper">Corner radius</span><input className="input" type="number" value={Number(selectedElement.radius) || 0} onChange={(e) => updateElement(selectedElement.id, { radius: Math.max(0, Number(e.target.value) || 0) })} /></label>
              </>
            ) : null}

            {selectedElement.type === "text" ? (
              <>
                <label style={{ display: "grid", gap: 4 }}><span className="helper">Text</span><textarea className="input" value={selectedElement.text || ""} rows={6} onChange={(e) => updateElement(selectedElement.id, { text: e.target.value })} /></label>
                <label style={{ display: "grid", gap: 4 }}><span className="helper">Color</span><input type="color" value={selectedElement.color || "#111111"} onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })} /></label>
                <label style={{ display: "grid", gap: 4 }}><span className="helper">Font size</span><input className="input" type="number" value={Number(selectedElement.fontSize) || 48} onChange={(e) => updateElement(selectedElement.id, { fontSize: Math.max(12, Number(e.target.value) || 12) })} /></label>
                <label style={{ display: "grid", gap: 4 }}><span className="helper">Line height</span><input className="input" type="number" step="0.05" value={Number(selectedElement.lineHeight) || 1.15} onChange={(e) => updateElement(selectedElement.id, { lineHeight: clamp(Number(e.target.value) || 1, 0.8, 2) })} /></label>
              </>
            ) : null}
          </div>
        ) : (
          <div className="helper">Select an element to edit its position, size, and basic style controls.</div>
        )}

        <div style={{ minHeight: 0, overflow: "auto", borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 12 }}>
          <div className="helper" style={{ marginBottom: 8 }}>Layers</div>
          <div style={{ display: "grid", gap: 8 }}>
            {[...(selectedDoc?.elements || [])].map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedElementId(item.id)}
                style={{
                  textAlign: "left",
                  padding: 10,
                  borderRadius: 12,
                  border: `1px solid ${item.id === selectedElementId ? "rgba(96,165,250,0.8)" : "rgba(255,255,255,0.10)"}`,
                  background: item.id === selectedElementId ? "rgba(37,99,235,0.18)" : "rgba(255,255,255,0.04)",
                  color: "#f8fafc",
                }}
              >
                <div style={{ fontWeight: 700 }}>{item.name || item.type}</div>
                <div className="helper" style={{ marginTop: 4 }}>Layer {index + 1} · {item.type}</div>
              </button>
            )).reverse()}
          </div>
        </div>
      </aside>
    </div>
  );
}
