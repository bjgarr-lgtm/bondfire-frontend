import React from "react";

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function markdownToHtml(md) {
  let html = escapeHtml(md || "");
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");
  html = html.replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/gim, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/gim, "<code>$1</code>");
  html = html.replace(/\[\[(.*?)(\|(.*?))?\]\]/gim, (_, title, _x, label) => {
    const safeTitle = escapeHtml(title.trim());
    const safeLabel = escapeHtml((label || title).trim());
    return `<a href="#" data-note-title="${safeTitle}">${safeLabel}</a>`;
  });
  html = html.replace(/\n/gim, "<br />");
  return html;
}

export default function NotePreview({ content, onOpenLink }) {
  return (
    <div
      style={{ border: "1px solid #333", padding: 8, minHeight: "72vh", overflow: "auto" }}
      onClick={(e) => {
        const link = e.target.closest("a[data-note-title]");
        if (!link) return;
        e.preventDefault();
        onOpenLink?.(link.dataset.noteTitle || "");
      }}
      dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
    />
  );
}
