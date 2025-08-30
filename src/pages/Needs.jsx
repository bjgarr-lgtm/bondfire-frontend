// src/pages/Needs.jsx
import React, { useMemo, useState } from "react";
import { useStore, addNeed, updateNeed, deleteNeed } from "../utils/store.js";

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
  const needsAll = useStore((s) => s.needs || []);

  // ---- tiny "version" tick to reflect mutations immediately (no page refresh) ----
  const [, setVer] = useState(0);
  const bump = () => setVer((v) => v + 1);

  const needs = useMemo(() => {
    if (!orgId) return needsAll;
    return needsAll.some(
      (n) => n && Object.prototype.hasOwnProperty.call(n, "org")
    )
      ? needsAll.filter((n) => n?.org === orgId)
      : needsAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsAll, orgId]); // derived from global store + org

  const [q, setQ] = useState("");
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
    bump();
  }

  // shared cell input style to keep table within viewport
  const cellInputStyle = {
    width: "100%",
    minWidth: 80,
    boxSizing: "border-box",
  };

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

        {/* scroll container to prevent page overflow on narrow screens */}
        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table
            className="table"
            style={{ width: "100%", tableLayout: "fixed", minWidth: 720 }}
          >
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
                      defaultValue={n.title}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        updateNeed(n.id, { title: e.target.value });
                        bump();
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      defaultValue={n.description}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        updateNeed(n.id, { description: e.target.value });
                        bump();
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      defaultValue={n.urgency}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        updateNeed(n.id, { urgency: e.target.value });
                        bump();
                      }}
                    />
                  </td>
                  <td>
                    <select
                      className="input"
                      defaultValue={n.status || "open"}
                      style={cellInputStyle}
                      onChange={(e) => {
                        updateNeed(n.id, { status: e.target.value });
                        bump();
                      }}
                    >
                      <option value="open">open</option>
                      <option value="in-progress">in-progress</option>
                      <option value="resolved">resolved</option>
                    </select>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      defaultChecked={!!n.public}
                      onChange={(e) => {
                        updateNeed(n.id, { public: e.target.checked });
                        bump();
                      }}
                    />
                  </td>
                  <td>
                    <button
                      className="btn"
                      onClick={() => {
                        deleteNeed(n.id);
                        bump();
                      }}
                    >
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
          <input
            className="input"
            name="description"
            placeholder="Description"
          />
          <input
            className="input"
            name="urgency"
            placeholder="Urgency (e.g. high)"
          />
          <select className="input" name="status" defaultValue="open">
            <option value="open">open</option>
            <option value="in-progress">in-progress</option>
            <option value="resolved">resolved</option>
          </select>
          <label>
            <input type="checkbox" name="public" /> Public
          </label>
          <div />
          <button className="btn">Add Need</button>
        </form>
      </div>
    </div>
  );
}
