import React, { useEffect, useMemo, useState } from "react";

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function applyInlineMarkdown(text) {
  let html = escapeHtml(text || "");
  html = html.replace(/`([^`]+)`/gim, "<code>$1</code>");
  html = html.replace(/\*\*(.+?)\*\*/gim, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/gim, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gim, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return html;
}

function flushList(stack, targetIndent = -1) {
  let html = "";
  while (stack.length && stack[stack.length - 1].indent >= targetIndent + 1) {
    const top = stack.pop();
    html += `</${top.tag}>`;
  }
  return html;
}

function markdownToHtml(md) {
  const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let i = 0;
  const listStack = [];
  let inCode = false;
  let codeLang = "";
  let codeLines = [];
  let inBlockquote = false;
  const closeBlockquote = () => {
    if (inBlockquote) {
      html += "</blockquote>";
      inBlockquote = false;
    }
  };

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (inCode) {
      if (trimmed.startsWith("```")) {
        html += `<pre><code class="lang-${escapeHtml(codeLang)}">${escapeHtml(codeLines.join("\n"))}</code></pre>`;
        inCode = false;
        codeLang = "";
        codeLines = [];
      } else {
        codeLines.push(raw);
      }
      i += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      html += flushList(listStack, -1);
      closeBlockquote();
      inCode = true;
      codeLang = trimmed.slice(3).trim();
      i += 1;
      continue;
    }
    if (!trimmed) {
      html += flushList(listStack, -1);
      closeBlockquote();
      i += 1;
      continue;
    }
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      html += flushList(listStack, -1);
      closeBlockquote();
      html += "<hr />";
      i += 1;
      continue;
    }
    if (trimmed.startsWith(">")) {
      html += flushList(listStack, -1);
      if (!inBlockquote) {
        html += "<blockquote>";
        inBlockquote = true;
      }
      html += `<p>${applyInlineMarkdown(trimmed.replace(/^>\s?/, ""))}</p>`;
      i += 1;
      continue;
    }
    closeBlockquote();

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      html += flushList(listStack, -1);
      const level = heading[1].length;
      html += `<h${level}>${applyInlineMarkdown(heading[2])}</h${level}>`;
      i += 1;
      continue;
    }

    const indent = raw.match(/^\s*/)?.[0]?.length || 0;
    const task = trimmed.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    const ordered = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (task || bullet || ordered) {
      const tag = ordered ? "ol" : "ul";
      const content = task ? task[2] : bullet ? bullet[1] : ordered[2];
      while (listStack.length && indent < listStack[listStack.length - 1].indent) html += `</${listStack.pop().tag}>`;
      if (!listStack.length || indent > listStack[listStack.length - 1].indent || listStack[listStack.length - 1].tag !== tag) {
        html += `<${tag}>`;
        listStack.push({ indent, tag });
      }
      if (task) {
        const checked = String(task[1] || "").toLowerCase() === "x";
        html += `<li class="task-list-item"><label><input type="checkbox" disabled ${checked ? "checked" : ""} /> <span>${applyInlineMarkdown(content)}</span></label></li>`;
      } else {
        html += `<li>${applyInlineMarkdown(content)}</li>`;
      }
      i += 1;
      continue;
    }

    html += flushList(listStack, -1);
    html += `<p>${applyInlineMarkdown(trimmed)}</p>`;
    i += 1;
  }

  html += flushList(listStack, -1);
  closeBlockquote();
  return html;
}

function pickToken() {
  try {
    return localStorage.getItem("bf_token") || localStorage.getItem("bf_auth_token") || localStorage.getItem("bf_access_token") || localStorage.getItem("bf_accessToken") || "";
  } catch {
    return "";
  }
}

function useProtectedPreviewSrc(file) {
  const [state, setState] = useState({ src: "", error: "", loading: false });

  const effectiveUrl = useMemo(() => file?.previewObjectUrl || file?.dataUrl || "", [file?.previewObjectUrl, file?.dataUrl]);
  const remoteUrl = useMemo(() => file?.previewUrl || file?.url || "", [file?.previewUrl, file?.url]);
  const mime = String(file?.mime || "");
  const needsBlobFetch = !!file && !effectiveUrl && !!remoteUrl && (mime === "application/pdf" || mime.startsWith("image/") || mime.startsWith("audio/") || mime.startsWith("video/"));

  useEffect(() => {
    if (!file) {
      setState({ src: "", error: "", loading: false });
      return;
    }
    if (effectiveUrl) {
      setState({ src: effectiveUrl, error: "", loading: false });
      return;
    }
    if (!needsBlobFetch) {
      setState({ src: remoteUrl || "", error: "", loading: false });
      return;
    }

    let cancelled = false;
    let objectUrl = "";
    setState({ src: "", error: "", loading: true });

    const headers = new Headers();
    const token = pickToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    fetch(remoteUrl, { credentials: "include", headers })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Preview request failed (${res.status})`);
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setState({ src: objectUrl, error: "", loading: false });
      })
      .catch((err) => {
        if (!cancelled) setState({ src: "", error: String(err?.message || err || "Preview failed"), loading: false });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, effectiveUrl, remoteUrl, needsBlobFetch]);

  return state;
}

export default function DriveFilePreview({ file }) {
  const { src, error, loading } = useProtectedPreviewSrc(file);
  if (!file) return null;

  if (loading) return <div className="card" style={{ padding: 16 }}>Loading preview…</div>;
  if (error) return <div className="card" style={{ padding: 16, color: "#ff9a9a", whiteSpace: "pre-wrap" }}>{error}</div>;

  if (String(file.mime || "").startsWith("image/") && src) {
    return <div style={{ display: "flex", justifyContent: "center" }}><img src={src} alt={file.name} style={{ maxWidth: "100%", maxHeight: "78vh", borderRadius: 12, border: "1px solid #1f1f1f" }} /></div>;
  }
  if (file.mime === "application/pdf" && src) {
    return <iframe key={src} title={file.name} src={src} style={{ width: "100%", height: "78vh", border: "1px solid #1f1f1f", borderRadius: 12, background: "#111" }} />;
  }
  if (String(file.mime || "").startsWith("audio/") && src) return <audio key={src} controls preload="metadata" src={src} style={{ width: "100%" }} />;
  if (String(file.mime || "").startsWith("video/") && src) return <video key={src} controls playsInline preload="metadata" src={src} style={{ width: "100%", borderRadius: 12, border: "1px solid #1f1f1f", background: "#111" }} />;
  if (file.textContent) {
    return (
      <div style={{ maxWidth: 920, margin: "0 auto", background: "rgba(255,255,255,0.02)", border: "1px solid #1f1f1f", borderRadius: 10, padding: 14, minHeight: "72vh" }}>
        <style>{`.bf-drive-file-markdown{max-width:74ch;margin:0 auto;font-size:14px;line-height:1.62}.bf-drive-file-markdown h1,.bf-drive-file-markdown h2,.bf-drive-file-markdown h3,.bf-drive-file-markdown h4,.bf-drive-file-markdown h5,.bf-drive-file-markdown h6{margin:0 0 10px 0}.bf-drive-file-markdown p{margin:0 0 10px 0}.bf-drive-file-markdown ul,.bf-drive-file-markdown ol{margin:0 0 10px 0;padding-left:24px}.bf-drive-file-markdown li{margin:0 0 4px 0}.bf-drive-file-markdown blockquote{margin:0 0 10px 0;padding-left:12px;border-left:3px solid #666;color:#bbb}.bf-drive-file-markdown a[href]{color:#9ed0ff;text-decoration:underline;cursor:pointer}.bf-drive-file-markdown code{background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:4px}.bf-drive-file-markdown pre{background:rgba(255,255,255,0.05);padding:12px;border-radius:8px;overflow:auto;margin:0 0 10px 0}.bf-drive-file-markdown pre code{background:transparent;padding:0}.bf-drive-file-markdown hr{border:none;border-top:1px solid rgba(255,255,255,0.15);margin:14px 0}.bf-drive-file-markdown .task-list-item{list-style:none;margin-left:-22px}.bf-drive-file-markdown .task-list-item input{margin-right:8px}`}</style>
        <div className="bf-drive-file-markdown" dangerouslySetInnerHTML={{ __html: markdownToHtml(file.textContent || "") }} />
      </div>
    );
  }
  return <div className="card" style={{ padding: 16 }}>This file type cannot be previewed in app.</div>;
}
