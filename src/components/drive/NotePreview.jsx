import React from "react";

function simpleMarkdown(md) {
  return String(md || "")
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/gim, "<em>$1</em>")
    .replace(/\n/gim, "<br />")}

export default function NotePreview({ content }) {
  return (
    <div style={{ border: "1px solid #333", padding: 8, minHeight: "70vh", overflow: "auto" }} dangerouslySetInnerHTML={{ __html: simpleMarkdown(content) }} />
  );
}
