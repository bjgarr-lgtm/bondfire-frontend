// src/pages/People.jsx
import React, { useMemo, useState } from "react";
import { useStore, addPerson, updatePerson, deletePerson } from "../utils/store.js";

// Match your other pages: derive orgId from the hash (no extra deps)
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

  // pull full list from store
  const peopleAll = useStore((s) => s.people || []);

  // scope to org if items carry an 'org' property (maintains back-compat with old data)
  const people = useMemo(() => {
    if (!orgId) return peopleAll;
    return peopleAll.some((p) => p && Object.prototype.hasOwnProperty.call(p, "org"))
      ? peopleAll.filter((p) => p?.org === orgId)
      : peopleAll;
  }, [peopleAll, orgId]);

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

  // add person — include org so it appears immediately in the scoped view
  function onAdd(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    addPerson({
      id: crypto.randomUUID(),
      name: f.get("name"),
      role: f.get("role") || "",
      phone: f.get("phone") || "",
      skills: f.get("skills") || "",
      created: Date.now(),
      org: orgId || undefined,
    });
    e.currentTarget.reset();
  }

  return (
    <div>
      <div className="card" style={{ margin: 16 }}>
        <h2 className="section-title">People</h2>

        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, role, skills, phone"
        />

        {/* Make the table behave on smaller screens */}
        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table
            className="table"
            style={{
              minWidth: 720,
              tableLayout: "fixed",
              width: "100%",
            }}
          >
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "32%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
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
                      onBlur={(e) => updatePerson(p.id, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      defaultValue={p.role}
                      onBlur={(e) => updatePerson(p.id, { role: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      defaultValue={p.phone}
                      onBlur={(e) => updatePerson(p.id, { phone: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      defaultValue={p.skills}
                      onBlur={(e) => updatePerson(p.id, { skills: e.target.value })}
                    />
                  </td>
                  <td>
                    <button className="btn" onClick={() => deletePerson(p.id)}>
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
        </div>

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
