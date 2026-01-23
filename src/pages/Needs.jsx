// src/pages/Needs.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../utils/api.js";

function getOrgId() {
  try {
    const m = (window.location.hash || "").match(/#\/org\/([^/]+)/);
    return m && m[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

export default function Needs() {
  const orgId = getOrgId();

  const [needs, setNeeds] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [err, setErr] = useState("");

  async function refreshNeeds() {
  if (!orgId) return;
  setLoading(true);
  setErr("");
  try {
    const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/needs`);
    setNeeds(Array.isArray(data.needs) ? data.needs : []);
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
    await api(`/api/orgs/${encodeURIComponent(orgId)}/needs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    refreshNeeds().catch(console.error);
  }

  async function delNeed(id) {
    if (!orgId || !id) return;
    await api(
      `/api/orgs/${encodeURIComponent(orgId)}/needs?id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    setNeeds((prev) => prev.filter((x) => x.id !== id));
    refreshNeeds().catch(console.error);
  }

  async function onAdd(e) {
    e.preventDefault();
    if (!orgId) return;

    const f = new FormData(e.currentTarget);

    const payload = {
      title: f.get("title"),
      description: f.get("description") || "",
      urgency: f.get("urgency") || "",
      status: f.get("status") || "open",
      is_public: String(f.get("is_public") || "") === "on",
    };

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

    e.currentTarget.reset();
  };

  const cellInputStyle = { width: "100%", minWidth: 80, boxSizing: "border-box" };

  return (
    <div>
      <div className="card" style={{ margin: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 className="section-title" style={{ margin: 0, flex: 1 }}>
            Needs
          </h2>
          <button className="btn" onClick={() => refreshNeeds().catch(console.error)} disabled={loading}>
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


        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", tableLayout: "fixed", minWidth: 760 }}>
            <thead>
              <tr>
                <th style={{ width: "20%" }}>Title</th>
                <th style={{ width: "36%" }}>Description</th>
                <th style={{ width: "14%" }}>Urgency</th>
                <th style={{ width: "14%" }}>Status</th>
                <th style={{ width: "8%" }}>Public</th>
                <th style={{ width: "8%" }} />
              </tr>
            </thead>
            <tbody>
              {list.map((n) => (
                <tr key={n.id}>
                  <td>
                    <input
                      className="input"
                      defaultValue={n.title || ""}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        const v = e.target.value || "";
                        if (v !== (n.title || "")) putNeed(n.id, { title: v }).catch(console.error);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      defaultValue={n.description || ""}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        const v = e.target.value || "";
                        if (v !== (n.description || "")) putNeed(n.id, { description: v }).catch(console.error);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      defaultValue={n.urgency || ""}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        const v = e.target.value || "";
                        if (v !== (n.urgency || "")) putNeed(n.id, { urgency: v }).catch(console.error);
                      }}
                    />
                  </td>
                  <td>
                    <select
                      className="input"
                      defaultValue={n.status || "open"}
                      style={cellInputStyle}
                      onChange={(e) => putNeed(n.id, { status: e.target.value }).catch(console.error)}
                    >
                      <option value="open">open</option>
                      <option value="in-progress">in-progress</option>
                      <option value="resolved">resolved</option>
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
                    <button className="btn" onClick={() => delNeed(n.id).catch(console.error)}>
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

        <form onSubmit={onAdd} className="grid cols-3" style={{ marginTop: 12 }}>
          <input className="input" name="title" placeholder="Title" required />
          <input className="input" name="description" placeholder="Description" />
          <input className="input" name="urgency" placeholder="Urgency (e.g. high)" />
          <select className="input" name="status" defaultValue="open">
            <option value="open">open</option>
            <option value="in-progress">in-progress</option>
            <option value="resolved">resolved</option>
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" name="is_public" />
            Public
          </label>
          <div />
          <button className="btn">Add Need</button>
        </form>
      </div>
    </div>
  );
}
