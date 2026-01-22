// src/pages/People.jsx
import React, { useMemo, useEffect, useState } from "react";
import { api } from "../utils/api.js";

// derive orgId from hash (matches your other pages)
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

  async function refresh() {
    if (!orgId) return;
    const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/people`);
    setPeople(data.people || []);
  }

  useEffect(() => {
    refresh().catch(console.error);
  }, [orgId]);


  // search
  const [q, setQ] = useState("");
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

  // add
  async function onAdd(e) {
    e.preventDefault();
    if (!orgId) return;

    const f = new FormData(e.currentTarget);

    const payload = {
      name: f.get("name"),
      role: f.get("role") || "",
      phone: f.get("phone") || "",
      skills: f.get("skills") || "",
    };

    const created = await api(`/api/orgs/${encodeURIComponent(orgId)}/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Optimistic update: D1 can lag on immediate read-after-write
    if (created?.id) {
      setPeople((prev) => [
        {
          id: created.id,
          ...payload,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
        ...(Array.isArray(prev) ? prev : []),
      ]);
      // reconcile shortly after
      setTimeout(() => refresh().catch(console.error), 600);
    } else {
      refresh().catch(console.error);
    }

    e.currentTarget.reset();
  }),
    });
    e.currentTarget.reset();
    await refresh();

  }

  return (
    <div>
      <div className="card" style={{ margin: 16 }}>
        <h2 className="section-title">People</h2>

        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, role, phone, skills"
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
                    defaultValue={p.name}
                    onBlur={(e) => api(`/api/orgs/${encodeURIComponent(orgId)}/people`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: p.id, name: e.target.value })
                    }).then(() => refresh()).catch(console.error)}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    defaultValue={p.role}
                    onBlur={(e) => api(`/api/orgs/${encodeURIComponent(orgId)}/people`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: p.id, role: e.target.value })
                    }).then(() => refresh()).catch(console.error)}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    defaultValue={p.phone}
                    onBlur={(e) => api(`/api/orgs/${encodeURIComponent(orgId)}/people`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: p.id, phone: e.target.value })
                    }).then(() => refresh()).catch(console.error)}

                  />
                </td>
                <td>
                  <input
                    className="input"
                    defaultValue={p.skills}
                    onBlur={(e) => api(`/api/orgs/${encodeURIComponent(orgId)}/people`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: p.id, skills: e.target.value })
                    }).then(() => refresh()).catch(console.error)}
                  />
                </td>
                <td>
                  <button className="btn" onClick={() => api(`/api/orgs/${encodeURIComponent(orgId)}/people?id=${encodeURIComponent(p.id)}`, {
                    method: "DELETE"
                  }).then(() => refresh()).catch(console.error)}>
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
          <div></div>
          <div></div>
          <button className="btn">Add Person</button>
        </form>
      </div>
    </div>
  );
}
