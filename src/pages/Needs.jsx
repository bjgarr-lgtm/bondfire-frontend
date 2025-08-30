// src/pages/Needs.jsx
import React, { useMemo, useState } from "react";
import { useStore, addNeed, updateNeed, deleteNeed } from "../utils/store.js";

function getOrgId() {
  try {
    const m = (window.location.hash || "").match(/#\/org\/([^/]+)/);
    return m && m[1] ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

export default function Needs() {
  const orgId = getOrgId();
  const needsAll = useStore((s) => s.needs || []);

  const needs = useMemo(() => {
    if (!orgId) return needsAll;
    return needsAll.some(n => n && Object.prototype.hasOwnProperty.call(n, "org"))
      ? needsAll.filter(n => n?.org === orgId)
      : needsAll;
  }, [needsAll, orgId]);

  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const needle = q.toLowerCase();
    return needs.filter((n) =>
      [n.title, n.description, n.urgency, n.status].filter(Boolean).join(" ").toLowerCase().includes(needle)
    );
  }, [needs, q]);

  function onAdd(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    addNeed({
      id: crypto.randomUUID(),
      title: f.get("title"),
      description: f.get("description") || "",
      urgency: f.get("urgency") || "",
      status: f.get("status") || "open",
      public: f.get("public") === "on",
      created: Date.now(),
      org: orgId || undefined,
    });
    e.currentTarget.reset();
  }

  return (
    <div>
      <div className="card" style={{ margin: 16 }}>
        <h2 className="section-title">Needs</h2>

        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search needs"
        />

        <table className="table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Title</th><th>Description</th><th>Urgency</th>
              <th>Status</th><th>Public</th><th />
            </tr>
          </thead>
          <tbody>
            {list.map((n) => (
              <tr key={n.id}>
                <td>
                  <input className="input" defaultValue={n.title}
                    onBlur={(e) => updateNeed(n.id, { title: e.target.value })} />
                </td>
                <td>
                  <input className="input" defaultValue={n.description}
                    onBlur={(e) => updateNeed(n.id, { description: e.target.value })} />
                </td>
                <td>
                  <input className="input" defaultValue={n.urgency}
                    onBlur={(e) => updateNeed(n.id, { urgency: e.target.value })} />
                </td>
                <td>
                  <select
                    className="input"
                    defaultValue={n.status || "open"}
                    onChange={(e) => updateNeed(n.id, { status: e.target.value })}
                  >
                    <option value="open">open</option>
                    <option value="in-progress">in‑progress</option>
                    <option value="resolved">resolved</option>
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    defaultChecked={!!n.public}
                    onChange={(e) => updateNeed(n.id, { public: e.target.checked })}
                  />
                </td>
                <td>
                  <button className="btn" onClick={() => deleteNeed(n.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={6} className="helper">No needs match.</td></tr>
            )}
          </tbody>
        </table>

        <form onSubmit={onAdd} className="grid cols-3" style={{ marginTop: 12 }}>
          <input className="input" name="title" placeholder="Title" required />
          <input className="input" name="description" placeholder="Description" />
          <input className="input" name="urgency" placeholder="Urgency (e.g. high)" />
          <select className="input" name="status" defaultValue="open">
            <option value="open">open</option>
            <option value="in-progress">in‑progress</option>
            <option value="resolved">resolved</option>
          </select>
          <label><input type="checkbox" name="public" /> Public</label>
          <div />
          <button className="btn">Add Need</button>
        </form>
      </div>
    </div>
  );
}
