import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { getOrgKeyIfAvailable, encryptWithOrgKey, decryptWithOrgKey } from "../lib/zk";

export default function People({ orgId }) {
  const [people, setPeople] = useState([]);
  const [error, setError] = useState("");
  const [openItem, setOpenItem] = useState(null);

  const [newPerson, setNewPerson] = useState({
    name: "",
    role: "",
    phone: "",
    skills: "",
    notes: "",
  });

  const [orgKey, setOrgKey] = useState(null);

  useEffect(() => {
    load();
    (async () => {
      const k = await getOrgKeyIfAvailable(orgId);
      setOrgKey(k || null);
    })();
  }, [orgId]);

  async function load() {
    try {
      const res = await apiFetch(`/api/orgs/${orgId}/people`);
      const list = res.people || [];

      // decrypt if encrypted_blob exists
      const decrypted = await Promise.all(
        list.map(async (p) => {
          if (p.encrypted_blob && orgKey) {
            try {
              const data = await decryptWithOrgKey(orgKey, p.encrypted_blob);
              return { ...p, ...data };
            } catch {
              return p;
            }
          }
          return p;
        })
      );

      setPeople(decrypted);
    } catch (e) {
      setError(e.message || "Failed to load people.");
    }
  }

  async function addPerson() {
    try {
      let payload = { ...newPerson };

      if (orgKey) {
        const encrypted = await encryptWithOrgKey(orgKey, payload);
        payload = {
          encrypted_blob: encrypted,
        };
      }

      await apiFetch(`/api/orgs/${orgId}/people`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setNewPerson({ name: "", role: "", phone: "", skills: "", notes: "" });
      load();
    } catch (e) {
      setError(e.message || "Failed to add person.");
    }
  }

  async function savePerson(p) {
    try {
      let payload = {
        name: p.name,
        role: p.role,
        phone: p.phone,
        skills: p.skills,
        notes: p.notes,
      };

      if (orgKey) {
        const encrypted = await encryptWithOrgKey(orgKey, payload);
        payload = { encrypted_blob: encrypted };
      }

      await apiFetch(`/api/orgs/${orgId}/people/${p.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      setOpenItem(null);
      load();
    } catch (e) {
      setError(e.message || "Failed to save person.");
    }
  }

  async function deletePerson(id) {
    if (!window.confirm("Delete this person?")) return;
    await apiFetch(`/api/orgs/${orgId}/people/${id}`, {
      method: "DELETE",
    });
    setOpenItem(null);
    load();
  }

  async function encryptExisting() {
    await apiFetch(`/api/orgs/${orgId}/people/encrypt_existing`, {
      method: "POST",
    });
    load();
  }

  return (
    <div>
      <h2>People</h2>

      <div style={{ marginBottom: 16 }}>
        <button onClick={load}>Refresh</button>
        <button onClick={encryptExisting} style={{ marginLeft: 8 }}>
          Encrypt Existing
        </button>
      </div>

      {error && <div style={{ color: "red" }}>{error}</div>}

      <table width="100%">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Phone</th>
            <th>Skills</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.role}</td>
              <td>{p.phone}</td>
              <td>{p.skills}</td>
              <td>
                <button onClick={() => setOpenItem(p)}>Details</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ marginTop: 24 }}>Add Person</h3>
      <div>
        <input
          placeholder="Name"
          value={newPerson.name}
          onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
        />
        <input
          placeholder="Role"
          value={newPerson.role}
          onChange={(e) => setNewPerson({ ...newPerson, role: e.target.value })}
        />
        <input
          placeholder="Phone"
          value={newPerson.phone}
          onChange={(e) => setNewPerson({ ...newPerson, phone: e.target.value })}
        />
        <input
          placeholder="Skills"
          value={newPerson.skills}
          onChange={(e) => setNewPerson({ ...newPerson, skills: e.target.value })}
        />
        <textarea
          placeholder="Notes"
          value={newPerson.notes}
          onChange={(e) => setNewPerson({ ...newPerson, notes: e.target.value })}
        />
        <button onClick={addPerson}>Add</button>
      </div>

      {openItem && (
        <div className="modal">
          <div className="modal-content">
            <h3>Person Details</h3>

            <input
              value={openItem.name}
              onChange={(e) =>
                setOpenItem({ ...openItem, name: e.target.value })
              }
            />
            <input
              value={openItem.role}
              onChange={(e) =>
                setOpenItem({ ...openItem, role: e.target.value })
              }
            />
            <input
              value={openItem.phone}
              onChange={(e) =>
                setOpenItem({ ...openItem, phone: e.target.value })
              }
            />
            <input
              value={openItem.skills}
              onChange={(e) =>
                setOpenItem({ ...openItem, skills: e.target.value })
              }
            />
            <textarea
              value={openItem.notes || ""}
              onChange={(e) =>
                setOpenItem({ ...openItem, notes: e.target.value })
              }
            />

            <div style={{ marginTop: 12 }}>
              <button onClick={() => savePerson(openItem)}>Save Changes</button>
              <button
                onClick={() => deletePerson(openItem.id)}
                style={{ marginLeft: 8 }}
              >
                Delete
              </button>
              <button
                onClick={() => setOpenItem(null)}
                style={{ marginLeft: 8 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}