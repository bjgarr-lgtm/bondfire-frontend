import React from "react";

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function applyInlineMarkdown(text) {
  const safe = escapeHtml(text);
  return safe
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");
}

function renderMarkdown(md) {
  const lines = String(md || "").split("\n");
  let html = "";
  let inUL = false;
  let inOL = false;
  let inQuote = false;

  const closeBlocks = () => {
    if (inUL) {
      html += "</ul>";
      inUL = false;
    }
    if (inOL) {
      html += "</ol>";
      inOL = false;
    }
    if (inQuote) {
      html += "</blockquote>";
      inQuote = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "    ");
    const trimmed = line.trim();

    if (!trimmed) {
      closeBlocks();
      continue;
    }

    if (trimmed.startsWith(">")) {
      if (!inQuote) {
        closeBlocks();
        html += "<blockquote>";
        inQuote = true;
      }
      html += `<div>${applyInlineMarkdown(trimmed.replace(/^>\s?/, ""))}</div>`;
      continue;
    }

    if (/^-\s+/.test(trimmed)) {
      if (!inUL) {
        closeBlocks();
        html += "<ul>";
        inUL = true;
      }
      html += `<li>${applyInlineMarkdown(trimmed.replace(/^-\s+/, ""))}</li>`;
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      if (!inOL) {
        closeBlocks();
        html += "<ol>";
        inOL = true;
      }
      html += `<li>${applyInlineMarkdown(trimmed.replace(/^\d+\.\s+/, ""))}</li>`;
      continue;
    }

    closeBlocks();

    if (/^###\s+/.test(trimmed)) {
      html += `<h3>${applyInlineMarkdown(trimmed.replace(/^###\s+/, ""))}</h3>`;
      continue;
    }

    if (/^##\s+/.test(trimmed)) {
      html += `<h2>${applyInlineMarkdown(trimmed.replace(/^##\s+/, ""))}</h2>`;
      continue;
    }

    if (/^#\s+/.test(trimmed)) {
      html += `<h1>${applyInlineMarkdown(trimmed.replace(/^#\s+/, ""))}</h1>`;
      continue;
    }

    html += `<p>${applyInlineMarkdown(trimmed)}</p>`;
  }

  closeBlocks();
  return html;
}

export default function NotePreview({ content }) {
  return (
    <div
      style={{
        border: "1px solid #333",
        padding: 12,
        minHeight: "70vh",
        overflow: "auto",
        lineHeight: 1.5,
      }}
    >
      <style>{`
        .bf-note-preview h1,
        .bf-note-preview h2,
        .bf-note-preview h3 {
          margin: 0 0 12px 0;
        }
        .bf-note-preview p {
          margin: 0 0 12px 0;
        }
        .bf-note-preview ul,
        .bf-note-preview ol {
          margin: 0 0 12px 0;
          padding-left: 24px;
        }
        .bf-note-preview li {
          margin: 0 0 4px 0;
        }
        .bf-note-preview blockquote {
          margin: 0 0 12px 0;
          padding-left: 12px;
          border-left: 3px solid #666;
          color: #bbb;
        }
      `}</style>
      <div
        className="bf-note-preview"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
      />
    </div>
  );
}
