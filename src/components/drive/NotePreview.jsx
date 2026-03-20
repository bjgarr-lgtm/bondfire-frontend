import React from "react";

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseFrontmatter(text) {
  const raw = String(text || "");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { properties: [], body: raw, hasFrontmatter: false };
  const properties = match[1]
    .split("\n")
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return null;
      return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    })
    .filter((x) => x && x.key);
  return { properties, body: raw.slice(match[0].length), hasFrontmatter: true };
}

function applyInlineMarkdown(text) {
  let html = escapeHtml(text || "");
  html = html.replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/gim, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/gim, "<code>$1</code>");
  html = html.replace(/\[\[(.*?)(\|(.*?))?\]\]/gim, (_, title, _x, label) => {
    const safeTitle = escapeHtml(String(title || "").trim());
    const safeLabel = escapeHtml(String(label || title || "").trim());
    return `<a href="#" data-note-title="${safeTitle}">${safeLabel}</a>`;
  });
  return html;
}

function markdownToHtml(md) {
  const lines = String(md || "").split("\n");
  let html = "";
  let inUL = false, inOL = false, inQuote = false;

  const closeBlocks = () => {
    if (inUL) { html += "</ul>"; inUL = false; }
    if (inOL) { html += "</ol>"; inOL = false; }
    if (inQuote) { html += "</blockquote>"; inQuote = false; }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) { closeBlocks(); continue; }

    if (trimmed.startsWith(">")) {
      if (!inQuote) { closeBlocks(); html += "<blockquote>"; inQuote = true; }
      html += `<div>${applyInlineMarkdown(trimmed.replace(/^>\s?/, ""))}</div>`;
      continue;
    }

    if (/^-\s+/.test(trimmed)) {
      if (!inUL) { closeBlocks(); html += "<ul>"; inUL = true; }
      html += `<li>${applyInlineMarkdown(trimmed.replace(/^-\s+/, ""))}</li>`;
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      if (!inOL) { closeBlocks(); html += "<ol>"; inOL = true; }
      html += `<li>${applyInlineMarkdown(trimmed.replace(/^\d+\.\s+/, ""))}</li>`;
      continue;
    }

    closeBlocks();
    if (/^###\s+/.test(trimmed)) { html += `<h3>${applyInlineMarkdown(trimmed.replace(/^###\s+/, ""))}</h3>`; continue; }
    if (/^##\s+/.test(trimmed)) { html += `<h2>${applyInlineMarkdown(trimmed.replace(/^##\s+/, ""))}</h2>`; continue; }
    if (/^#\s+/.test(trimmed)) { html += `<h1>${applyInlineMarkdown(trimmed.replace(/^#\s+/, ""))}</h1>`; continue; }
    html += `<p>${applyInlineMarkdown(trimmed)}</p>`;
  }

  closeBlocks();
  return html;
}

export default function NotePreview({ content, onOpenLink, focusMode, onUpdateProperty, onAddProperty, onRemoveProperty, propertiesCollapsed, onToggleProperties }) {
  const parsed = parseFrontmatter(content);

  return (
    <div
      onClick={(e) => {
        const link = e.target.closest("a[data-note-title]");
        if (!link) return;
        e.preventDefault();
        onOpenLink?.(link.dataset.noteTitle || "");
      }}
      style={{ maxWidth: 920, margin: "0 auto", background: "rgba(255,255,255,0.02)", border: "1px solid #1f1f1f", borderRadius: 10, padding: focusMode ? 12 : 10, minHeight: focusMode ? "84vh" : "72vh" }}
    >
      {parsed.hasFrontmatter ? (
        <div className="card" style={{ padding: 8, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: propertiesCollapsed ? 0 : 8 }}>
            <strong style={{ fontSize: 14 }}>Properties</strong>
            <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              <button className="btn" type="button" onClick={(e) => { e.stopPropagation(); onAddProperty?.(); }}>+ Add</button>
              <button className="btn" type="button" onClick={(e) => { e.stopPropagation(); onToggleProperties?.(); }}>{propertiesCollapsed ? "Show" : "Hide"}</button>
            </div>
          </div>
          {!propertiesCollapsed ? (
            <div style={{ display: "grid", gap: 6 }}>
              {parsed.properties.map((prop) => (
                <div key={prop.key} style={{ display: "grid", gridTemplateColumns: "120px minmax(0,1fr) auto", gap: 6, alignItems: "center" }}>
                  <div className="helper" style={{ fontSize: 12 }}>{prop.key}</div>
                  <input className="input" type={prop.key.toLowerCase() === "date" ? "date" : "text"} value={prop.value || ""} onChange={(e) => onUpdateProperty?.(prop.key, e.target.value)} style={{ width: "100%", padding: "5px 8px", fontSize: 12 }} />
                  <button className="btn" type="button" onClick={(e) => { e.stopPropagation(); onRemoveProperty?.(prop.key); }}>x</button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <style>{`.bf-note-preview{max-width:74ch;margin:0 auto;font-size:14px;line-height:1.62}.bf-note-preview h1,.bf-note-preview h2,.bf-note-preview h3{margin:0 0 8px 0}.bf-note-preview p{margin:0 0 8px 0}.bf-note-preview ul,.bf-note-preview ol{margin:0 0 8px 0;padding-left:22px}.bf-note-preview li{margin:0 0 2px 0}.bf-note-preview blockquote{margin:0 0 8px 0;padding-left:10px;border-left:3px solid #666;color:#bbb}.bf-note-preview a[data-note-title]{color:#9ed0ff;text-decoration:underline;cursor:pointer}.bf-note-preview code{background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:4px}`}</style>
      <div className="bf-note-preview" dangerouslySetInnerHTML={{ __html: markdownToHtml(parsed.body) }} />
    </div>
  );
}
