// src/pages/People.jsx
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

export default function People() {
  const orgId = getOrgId();

  const [people, setPeople] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  async function refreshPeople() {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/people`);
      setPeople(Array.isArray(data.people) ? data.people : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshPeople().catch(console.error);
  }, [orgId]);

  const list = useMemo(() => {
    const needle = q.toLowerCase();
    return people.filter((p) =>
      [p.name, p.role, p.skills, p.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [people, q]);

  async function putPerson(id, patch) {
    if (!orgId || !id) return;
    await api(`/api/orgs/${encodeURIComponent(orgId)}/people`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    refreshPeople().catch(console.error);
  }

  async function delPerson(id) {
    if (!orgId || !id) return;
    await api(
      `/api/orgs/${encodeURIComponent(orgId)}/people?id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    setPeople((prev) => prev.filter((x) => x.id !== id));
    refreshPeople().catch(console.error);
  }

  async function onAdd(e) {
    e.preventDefault();
    if (!orgId) return;

    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") || "").trim();
    if (!name) return;

    const payload = {
      name,
      role: String(f.get("role") || ""),
      phone: String(f.get("phone") || ""),
      skills: String(f.get("skills") || ""),
    };

    const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (data?.id) {
      setPeople((prev) => [{ id: data.id, ...payload }, ...prev]);
    }

    setQ("");
    e.currentTarget.reset();
    refreshPeople().catch(console.error);
  }

  const cellInputStyle = { width: "100%", minWidth: 80, boxSizing: "border-box" };

  return (
    <div>
      <div className="card" style={{ margin: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 className="section-title" style={{ margin: 0, flex: 1 }}>
            People
          </h2>
          <button className="btn" onClick={() => refreshPeople().catch(console.error)} disabled={loading}>
            {loading ? "Loading" : "Refresh"}
          </button>
        </div>

        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, role, phone, skills"
          style={{ marginTop: 12 }}
        />

        <table className="table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Phone</th>
              <th>Skills</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>
                  <input
                    className="input"
                    defaultValue={p.name || ""}
                    style={cellInputStyle}
                    onBlur={(e) => {
                      const v = e.target.value || "";
                      if (v !== (p.name || "")) putPerson(p.id, { name: v }).catch(console.error);
                    }}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    defaultValue={p.role || ""}
                    style={cellInputStyle}
                    onBlur={(e) => {
                      const v = e.target.value || "";
                      if (v !== (p.role || "")) putPerson(p.id, { role: v }).catch(console.error);
                    }}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    defaultValue={p.phone || ""}
                    style={cellInputStyle}
                    onBlur={(e) => {
                      const v = e.target.value || "";
                      if (v !== (p.phone || "")) putPerson(p.id, { phone: v }).catch(console.error);
                    }}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    defaultValue={p.skills || ""}
                    style={cellInputStyle}
                    onBlur={(e) => {
                      const v = e.target.value || "";
                      if (v !== (p.skills || "")) putPerson(p.id, { skills: v }).catch(console.error);
                    }}
                  />
                </td>
                <td>
                  <button className="btn" onClick={() => delPerson(p.id).catch(console.error)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="helper">
                  No people match.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form onSubmit={onAdd} className="grid cols-3" style={{ marginTop: 12 }}>
          <input className="input" name="name" placeholder="Name" required />
          <input className="input" name="role" placeholder="Role" />
          <input className="input" name="phone" placeholder="Phone" />
          <input className="input" name="skills" placeholder="Skills" />
          <div />
          <div />
          <button className="btn">Add Person</button>
        </form>
      </div>
    </div>
  );
}
