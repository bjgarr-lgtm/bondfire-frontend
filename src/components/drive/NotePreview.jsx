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
  if (!match) return { properties: {}, body: raw, hasFrontmatter: false };
  const properties = {};
  match[1].split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) properties[key] = value;
  });
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
function PropertyField({ label, value, onChange, type = "text", placeholder = "" }) {
  return <>
    <div className="helper" style={{ fontSize: 12 }}>{label}</div>
    <input className="input" type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", padding: "6px 8px", fontSize: 12 }} />
  </>;
}
export default function NotePreview({ content, onOpenLink, focusMode, onUpdateProperty }) {
  const parsed = parseFrontmatter(content);
  return (
    <div
      onClick={(e) => {
        const link = e.target.closest("a[data-note-title]");
        if (!link) return;
        e.preventDefault();
        onOpenLink?.(link.dataset.noteTitle || "");
      }}
      style={{ maxWidth: 920, margin: "0 auto", background: "rgba(255,255,255,0.02)", border: "1px solid #222", borderRadius: 12, padding: focusMode ? 14 : 12, minHeight: focusMode ? "84vh" : "72vh" }}
    >
      {parsed.hasFrontmatter ? <div className="card" style={{ padding: 10, marginBottom: 10 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 16 }}>Properties</h3>
        <div style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", gap: 8, alignItems: "center" }}>
          <PropertyField label="type" value={parsed.properties.type} onChange={(v) => onUpdateProperty?.("type", v)} placeholder="bit-log" />
          <PropertyField label="date" value={parsed.properties.date} onChange={(v) => onUpdateProperty?.("date", v)} type="date" />
          <PropertyField label="status" value={parsed.properties.status} onChange={(v) => onUpdateProperty?.("status", v)} placeholder="draft / active / archived" />
          <PropertyField label="tags" value={parsed.properties.tags} onChange={(v) => onUpdateProperty?.("tags", v)} placeholder="comma, separated, tags" />
        </div>
      </div> : null}
      <style>{`.bf-note-preview{max-width:74ch;margin:0 auto;font-size:15px;line-height:1.65}.bf-note-preview h1,.bf-note-preview h2,.bf-note-preview h3{margin:0 0 10px 0}.bf-note-preview p{margin:0 0 10px 0}.bf-note-preview ul,.bf-note-preview ol{margin:0 0 10px 0;padding-left:22px}.bf-note-preview li{margin:0 0 3px 0}.bf-note-preview blockquote{margin:0 0 10px 0;padding-left:12px;border-left:3px solid #666;color:#bbb}.bf-note-preview a[data-note-title]{color:#9ed0ff;text-decoration:underline;cursor:pointer}.bf-note-preview code{background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:4px}`}</style>
      <div className="bf-note-preview" dangerouslySetInnerHTML={{ __html: markdownToHtml(parsed.body) }} />
    </div>
  );
}
