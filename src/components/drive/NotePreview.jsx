import React from "react";

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function md(text) {
  let html = escapeHtml(text);

  html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");

  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  html = html.replace(/^\> (.*)$/gm, "<blockquote>$1</blockquote>");

  html = html.replace(/^\- (.*)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>)/gms, "<ul>$1</ul>");

  html = html.replace(/\n\n/g, "</p><p>");
  html = "<p>" + html + "</p>";

  return html;
}

export default function NotePreview({ content }) {
  return (
    <div style={{
      maxWidth: "800px",
      margin: "0 auto",
      padding: "32px",
      lineHeight: 1.8,
      fontSize: 16
    }}>
      <div dangerouslySetInnerHTML={{ __html: md(content) }} />
    </div>
  );
}
