// src/pages/Settings.jsx
import * as React from "react";
import { useParams } from "react-router-dom";
import PublicPage from "./PublicPage.jsx";

/* ---------- API helper ---------- */
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
function authFetch(path, opts = {}) {
  const token =
    localStorage.getItem("bf_auth_token") ||
    sessionStorage.getItem("bf_auth_token");
  const url = path.startsWith("http")
    ? path
    : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, {
    ...opts,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false)
      throw new Error(j.error || j.message || `HTTP ${r.status}`);
    return j;
  });
}

/* ---------- local org settings helpers ---------- */
const orgSettingsKey = (orgId) => `bf_org_settings_${orgId}`;
const readJSON = (k, fallback = {}) => {
  try {
    return JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};
const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export default function Settings() {
  const { orgId } = useParams();

  /* ========== ORG BASICS (local) ========== */
  const [orgName, setOrgName] = React.useState("");
  const [logoDataUrl, setLogoDataUrl] = React.useState(null);

  React.useEffect(() => {
    const s = readJSON(orgSettingsKey(orgId));
    if (s.name) setOrgName(s.name);
    if (s.logoDataUrl || s.logoUrl)
      setLogoDataUrl(s.logoDataUrl || s.logoUrl);
  }, [orgId]);

  const onLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const saveBasics = () => {
    const key = orgSettingsKey(orgId);
    const prev = readJSON(key);
    writeJSON(key, { ...prev, name: (orgName || "").trim(), logoDataUrl });
    // notify overview/header, etc.
    window.dispatchEvent(
      new CustomEvent("bf:org_settings_changed", { detail: { orgId } })
    );
    alert("Organization settings saved.");
  };

  /* ========== PUBLIC PAGE (backend) ========== */
  const [enabled, setEnabled] = React.useState(false);
  const [slug, setSlug] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [about, setAbout] = React.useState("");
  const [features, setFeatures] = React.useState(""); // lines
  const [links, setLinks] = React.useState(""); // "Text | URL" lines
  const [msg, setMsg] = React.useState("");

  // optional: if you already know a slug, you could fetch current config here.
  // We rely on Save/Generate flow to populate fields.

  const genSlug = async () => {
    setMsg("");
    try {
      const r = await authFetch(
        `/api/orgs/${encodeURIComponent(orgId)}/public/generate`,
        { method: "POST" }
      );
      setSlug(r.public?.slug || "");
      setMsg("Generated new link.");
      setTimeout(() => setMsg(""), 1200);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const savePublic = async (e) => {
    e?.preventDefault();
    setMsg("");
    try {
      const payload = {
        enabled,
        slug: (slug || "").trim(),
        title: (title || "").trim(),
        about: (about || "").trim(),
        features: (features || "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        links: (links || "")
          .split("\n")
          .map((line) => {
            const [text, url] = line
              .split("|")
              .map((s) => (s || "").trim());
            return url ? { text: text || url, url } : null;
          })
          .filter(Boolean),
      };
      const r = await authFetch(
        `/api/orgs/${encodeURIComponent(orgId)}/public/save`,
        { method: "POST", body: payload }
      );
      // reflect server-cleaned values (slug may change)
      setSlug(r.public?.slug || payload.slug);
      setTitle(r.public?.title ?? payload.title);
      setAbout(r.public?.about ?? payload.about);
      setFeatures(
        Array.isArray(r.public?.features)
          ? r.public.features.join("\n")
          : features
      );
      setLinks(
        Array.isArray(r.public?.links)
          ? r.public.links
              .map((l) => `${l.text || l.url} | ${l.url}`)
              .join("\n")
          : links
      );
      setEnabled(!!r.public?.enabled);
      setMsg("Saved.");
      setTimeout(() => setMsg(""), 1200);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const publicUrl = slug ? `${location.origin}/#/p/${slug}` : "";

  return (
    <div className="grid" style={{ gap: 16, padding: 16 }}>
      {/* ---------- Org Basics ---------- */}
      <div className="card" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Organization</h2>
        <div className="grid" style={{ gap: 10 }}>
          <label className="grid" style={{ gap: 6 }}>
            <span className="helper">Name</span>
            <input
              className="input"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Your org name"
            />
          </label>

          <label className="grid" style={{ gap: 6 }}>
            <span className="helper">Logo</span>
            <input
              className="input"
              type="file"
              accept="image/*"
              onChange={onLogo}
            />
            {logoDataUrl && (
              <img
                src={logoDataUrl}
                alt="Logo preview"
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 12,
                  objectFit: "cover",
                  marginTop: 8,
                }}
              />
            )}
          </label>

          <div>
            <button className="btn-red" onClick={saveBasics}>
              Save
            </button>
          </div>
        </div>
      </div>

      {/* ---------- Public Page ---------- */}
      <div className="card" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Public Page</h2>
        <p className="helper">
          Share a read‑only page for your org. Only what you enable is shown.
        </p>

        <form
          onSubmit={savePublic}
          className="grid"
          style={{ gap: 10, marginTop: 8 }}
        >
          <label className="row" style={{ gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>Enable public page</span>
          </label>

          <label className="grid" style={{ gap: 6 }}>
            <span className="helper">Share URL (slug)</span>
            <div className="row" style={{ gap: 8 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. bondfire-team"
              />
              <button
                type="button"
                className="btn"
                onClick={genSlug}
                title="Generate a nice slug"
              >
                Generate
              </button>
            </div>

            {/* Share link visible right in Settings */}
            {slug && (
              <div
                className="row"
                style={{ gap: 8, alignItems: "center", marginTop: 8 }}
              >
                <span className="helper">Public link:</span>
                <a
                  className="helper"
                  href={`/#/p/${encodeURIComponent(slug)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {publicUrl}
                </a>
              </div>
            )}
          </label>

          <label className="grid" style={{ gap: 6 }}>
            <span className="helper">Title</span>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Public page title"
            />
          </label>

          <label className="grid" style={{ gap: 6 }}>
            <span className="helper">About</span>
            <textarea
              className="textarea"
              rows={3}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Short description"
            />
          </label>

          <label className="grid" style={{ gap: 6 }}>
            <span className="helper">Features (one per line)</span>
            <textarea
              className="textarea"
              rows={3}
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              placeholder={"Donations tracker\nVolunteers\nEvents"}
            />
          </label>

          <label className="grid" style={{ gap: 6 }}>
            <span className="helper">Links (Text | URL per line)</span>
            <textarea
              className="textarea"
              rows={3}
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              placeholder={
                "Website | https://example.org\nTwitter | https://x.com/yourorg"
              }
            />
          </label>

          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <button className="btn-red" type="submit">
              Save
            </button>
            {msg && (
              <span className={msg.includes("Saved") ? "success" : "error"}>
                {msg}
              </span>
            )}
          </div>
        </form>

        {/* Inline preview (no iframe) */}
        {enabled && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ margin: "8px 0" }}>Preview</h3>
            <PublicPage
              data={{
                public: {
                  title: (title || orgName || "Public page").trim(),
                  about: (about || "").trim(),
                  features: (features || "")
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  links: (links || "")
                    .split("\n")
                    .map((line) => {
                      const [text, url] = line
                        .split("|")
                        .map((s) => (s || "").trim());
                      return url ? { text: text || url, url } : null;
                    })
                    .filter(Boolean),
                },
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
