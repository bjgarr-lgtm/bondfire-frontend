// src/pages/Needs.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../utils/api.js";
import { decryptWithOrgKey, encryptWithOrgKey, getCachedOrgKey } from "../lib/zk.js";

function getOrgId() {
  try {
    const m = (window.location.hash || "").match(/#\/org\/([^/]+)/);
    return m && m[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function useIsMobile(maxWidthPx = 720) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia && window.matchMedia(`(max-width: ${maxWidthPx}px)`).matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    try {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    } catch {
      mq.addListener(onChange);
      return () => mq.removeListener(onChange);
    }
  }, [maxWidthPx]);

  return isMobile;
}

const URGENCY_OPTIONS = [
  { value: "", label: "unspecified" },
  { value: "low", label: "low" },
  { value: "medium", label: "medium" },
  { value: "high", label: "high" },
  { value: "critical", label: "critical" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "open" },
  { value: "in-progress", label: "in-progress" },
  { value: "resolved", label: "resolved" },
];

export default function Needs() {
  const orgId = getOrgId();
  const isMobile = useIsMobile(720);

  const [orgKeyVersion, setOrgKeyVersion] = useState(1);

  const [needs, setNeeds] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Controlled add form so it clears reliably
  const [form, setForm] = useState({
    title: "",
    description: "",
    urgency: "",
    status: "open",
    is_public: false,
  });

  async function refreshNeeds() {
    if (!orgId) return;
    setLoading(true);
    setErr("");
    try {
      // best-effort key version (used when sending ciphertext)
      try {
        const c = await api(`/api/orgs/${encodeURIComponent(orgId)}/crypto`);
        if (c?.key_version) setOrgKeyVersion(Number(c.key_version) || 1);
      } catch {}

      const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/needs`);
      const rows = Array.isArray(data.needs) ? data.needs : [];

      const orgKey = getCachedOrgKey(orgId);
      if (!orgKey) {
        setNeeds(rows);
        return;
      }

      const decrypted = [];
      for (const n of rows) {
        if (n?.encrypted_description) {
          try {
            const desc = await decryptWithOrgKey(orgKey, n.encrypted_description);
            decrypted.push({ ...n, description: String(desc || "") });
          } catch {
            decrypted.push({ ...n, description: "[encrypted]" });
          }
        } else {
          decrypted.push(n);
        }
      }
      setNeeds(decrypted);
    } catch (e) {
      console.error(e);
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshNeeds().catch(console.error);
  }, [orgId]);

  const list = useMemo(() => {
    const needle = q.toLowerCase();
    return needs.filter((n) =>
      [n.title, n.description, n.urgency, n.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [needs, q]);

  async function putNeed(id, patch) {
    if (!orgId || !id) return;

    const orgKey = getCachedOrgKey(orgId);
    const finalPatch = { ...patch };
    if (orgKey && patch?.description !== undefined) {
      try {
        finalPatch.encrypted_description = await encryptWithOrgKey(orgKey, String(patch.description || ""));
        finalPatch.key_version = orgKeyVersion;
        finalPatch.description = "";
      } catch {
        // if encryption fails, fall back to plaintext
      }
    }
    await api(`/api/orgs/${encodeURIComponent(orgId)}/needs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...finalPatch }),
    });
    refreshNeeds().catch(console.error);
  }

  async function delNeed(id) {
    if (!orgId || !id) return;
    await api(`/api/orgs/${encodeURIComponent(orgId)}/needs?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    setNeeds((prev) => prev.filter((x) => x.id !== id));
    refreshNeeds().catch(console.error);
  }

  async function onAdd(e) {
    e.preventDefault();
    if (!orgId) return;

    setErr("");

    const title = String(form.title || "").trim();
    if (!title) return;

    const orgKey = getCachedOrgKey(orgId);

    const payload = {
      title,
      description: String(form.description || "").trim(),
      urgency: String(form.urgency || "").trim(),
      status: String(form.status || "open").trim() || "open",
      is_public: !!form.is_public,
    };

    if (orgKey && payload.description) {
      try {
        payload.encrypted_description = await encryptWithOrgKey(orgKey, payload.description);
        payload.key_version = orgKeyVersion;
        payload.description = "";
      } catch {
        // ignore
      }
    }

    const created = await api(`/api/orgs/${encodeURIComponent(orgId)}/needs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (created?.id) {
      setNeeds((prev) => [
        {
          id: created.id,
          ...payload,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
        ...(Array.isArray(prev) ? prev : []),
      ]);
      setTimeout(() => refreshNeeds().catch(console.error), 600);
    } else {
      refreshNeeds().catch(console.error);
    }

    // Clear add form
    setForm({ title: "", description: "", urgency: "", status: "open", is_public: false });
  }

  const cellStyle = { width: "100%", minWidth: 0, boxSizing: "border-box" };

  const Field = ({ label, children }) => (
    <label style={{ display: "grid", gap: 6 }}>
      <span className="helper">{label}</span>
      {children}
    </label>
  );

  return (
    <div>
      <div className="card" style={{ margin: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 className="section-title" style={{ margin: 0, flex: 1, minWidth: 140 }}>
            Needs
          </h2>
          <button
            className="btn"
            style={{ whiteSpace: "nowrap" }}
            onClick={() => refreshNeeds().catch(console.error)}
            disabled={loading}
          >
            {loading ? "Loading" : "Refresh"}
          </button>
        </div>

        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search needs"
          style={{ marginTop: 12 }}
        />

        {err && (
          <div className="helper" style={{ color: "tomato", marginTop: 10 }}>
            {err}
          </div>
        )}

        {/* MOBILE: cards, no sideways scroll */}
        {isMobile ? (
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            {list.map((n) => (
              <div key={n.id} className="card" style={{ padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontWeight: 800, flex: 1, minWidth: 0 }}>
                    {String(n.title || "Untitled")}
                  </div>
                  <button
                    className="btn"
                    style={{ whiteSpace: "nowrap" }}
                    type="button"
                    onClick={() => delNeed(n.id).catch(console.error)}
                  >
                    Delete
                  </button>
                </div>

                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  <Field label="Title">
                    <input
                      className="input"
                      defaultValue={n.title || ""}
                      style={cellStyle}
                      onBlur={(e) => {
                        const v = String(e.target.value || "").trim();
                        if (v !== String(n.title || "")) putNeed(n.id, { title: v }).catch(console.error);
                      }}
                    />
                  </Field>

                  <Field label="Description">
                    <textarea
                      className="input"
                      defaultValue={n.description || ""}
                      rows={3}
                      style={{ ...cellStyle, resize: "vertical" }}
                      onBlur={(e) => {
                        const v = String(e.target.value || "").trim();
                        if (v !== String(n.description || "")) putNeed(n.id, { description: v }).catch(console.error);
                      }}
                    />
                  </Field>

                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                    <Field label="Urgency">
                      <select
                        className="input"
                        style={cellStyle}
                        value={String(n.urgency || "")}
                        onChange={(e) => putNeed(n.id, { urgency: e.target.value }).catch(console.error)}
                      >
                        {URGENCY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Status">
                      <select
                        className="input"
                        style={cellStyle}
                        value={String(n.status || "open")}
                        onChange={(e) => putNeed(n.id, { status: e.target.value }).catch(console.error)}
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={!!n.is_public}
                      onChange={(e) => putNeed(n.id, { is_public: e.target.checked }).catch(console.error)}
                    />
                    <span className="helper">Public</span>
                  </label>
                </div>
              </div>
            ))}

            {list.length === 0 ? <div className="helper">No needs match.</div> : null}
          </div>
        ) : (
          /* DESKTOP: keep table */
          <div style={{ marginTop: 12, overflowX: "auto", paddingRight: 16 }}>
            <table className="table" style={{ width: "100%", tableLayout: "fixed", minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: "22%", whiteSpace: "nowrap", wordBreak: "normal" }}>Title</th>
                  <th style={{ width: "36%", whiteSpace: "nowrap", wordBreak: "normal" }}>Description</th>
                  <th style={{ width: "14%", whiteSpace: "nowrap", wordBreak: "normal" }}>Urgency</th>
                  <th style={{ width: "14%", whiteSpace: "nowrap", wordBreak: "normal" }}>Status</th>
                  <th style={{ width: "8%", whiteSpace: "nowrap", wordBreak: "normal" }}>Public</th>
                  <th style={{ width: "6%" }} />
                </tr>
              </thead>

              <tbody>
                {list.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <input
                        className="input"
                        defaultValue={n.title || ""}
                        style={cellStyle}
                        onBlur={(e) => {
                          const v = String(e.target.value || "").trim();
                          if (v !== String(n.title || "")) putNeed(n.id, { title: v }).catch(console.error);
                        }}
                      />
                    </td>

                    <td>
                      <input
                        className="input"
                        defaultValue={n.description || ""}
                        style={cellStyle}
                        onBlur={(e) => {
                          const v = String(e.target.value || "").trim();
                          if (v !== String(n.description || "")) putNeed(n.id, { description: v }).catch(console.error);
                        }}
                      />
                    </td>

                    <td>
                      <select
                        className="input"
                        style={cellStyle}
                        value={String(n.urgency || "")}
                        onChange={(e) => putNeed(n.id, { urgency: e.target.value }).catch(console.error)}
                      >
                        {URGENCY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <select
                        className="input"
                        style={cellStyle}
                        value={String(n.status || "open")}
                        onChange={(e) => putNeed(n.id, { status: e.target.value }).catch(console.error)}
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        defaultChecked={!!n.is_public}
                        onChange={(e) => putNeed(n.id, { is_public: e.target.checked }).catch(console.error)}
                      />
                    </td>

                    <td>
                      <button className="btn" style={{ whiteSpace: "nowrap" }} onClick={() => delNeed(n.id).catch(console.error)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}

                {list.length === 0 && (
                  <tr>
                    <td colSpan={6} className="helper">
                      No needs match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <form
          onSubmit={onAdd}
          className="grid cols-3"
          style={{
            marginTop: 12,
            gap: 10,
            ...(isMobile ? { gridTemplateColumns: "1fr" } : null),
          }}
        >
          <input
            className="input"
            name="title"
            placeholder="Title"
            required
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />

          <input
            className="input"
            name="description"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />

          <select
            className="input"
            name="urgency"
            value={form.urgency}
            onChange={(e) => setForm((p) => ({ ...p, urgency: e.target.value }))}
          >
            {URGENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            className="input"
            name="status"
            value={form.status}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              name="is_public"
              checked={form.is_public}
              onChange={(e) => setForm((p) => ({ ...p, is_public: e.target.checked }))}
            />
            Public
          </label>

          <div />
          <button className="btn">Add Need</button>
        </form>
      </div>
    </div>
  );
}
