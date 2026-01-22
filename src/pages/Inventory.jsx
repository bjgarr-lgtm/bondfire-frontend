// src/pages/Inventory.jsx
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

export default function Inventory() {
  const orgId = getOrgId();

  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  async function refreshInventory() {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/inventory`);
      setItems(Array.isArray(data.inventory) ? data.inventory : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshInventory().catch(console.error);
  }, [orgId]);

  const list = useMemo(() => {
    const needle = q.toLowerCase();
    return items.filter((it) =>
      [it.name, it.category, it.location, it.unit]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [items, q]);

  async function putItem(id, patch) {
    if (!orgId || !id) return;
    await api(`/api/orgs/${encodeURIComponent(orgId)}/inventory`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    refreshInventory().catch(console.error);
  }

  async function delItem(id) {
    if (!orgId || !id) return;
    await api(
      `/api/orgs/${encodeURIComponent(orgId)}/inventory?id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    setItems((prev) => prev.filter((x) => x.id !== id));
    refreshInventory().catch(console.error);
  }

  async function onAdd(e) {
    e.preventDefault();
    if (!orgId) return;

    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") || "").trim();
    if (!name) return;

    const payload = {
      name,
      qty: Number(f.get("qty") || 0),
      unit: String(f.get("unit") || ""),
      category: String(f.get("category") || ""),
      location: String(f.get("location") || ""),
      is_public: String(f.get("is_public") || "") === "on",
    };

    const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // immediate UI update
    if (data?.id) {
      setItems((prev) => [{ id: data.id, ...payload }, ...prev]);
    }

    setQ("");
    e.currentTarget.reset();

    // background canonical refresh
    refreshInventory().catch(console.error);
  }

  const cellInputStyle = { width: "100%", minWidth: 80, boxSizing: "border-box" };

  return (
    <div>
      <div className="card" style={{ margin: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 className="section-title" style={{ margin: 0, flex: 1 }}>
            Inventory
          </h2>
          <button className="btn" onClick={() => refreshInventory().catch(console.error)} disabled={loading}>
            {loading ? "Loading" : "Refresh"}
          </button>
        </div>

        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search inventory"
          style={{ marginTop: 12 }}
        />

        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", tableLayout: "fixed", minWidth: 860 }}>
            <thead>
              <tr>
                <th style={{ width: "26%" }}>Name</th>
                <th style={{ width: "10%" }}>Qty</th>
                <th style={{ width: "10%" }}>Unit</th>
                <th style={{ width: "18%" }}>Category</th>
                <th style={{ width: "18%" }}>Location</th>
                <th style={{ width: "8%" }}>Public</th>
                <th style={{ width: "10%" }} />
              </tr>
            </thead>
            <tbody>
              {list.map((it) => (
                <tr key={it.id}>
                  <td>
                    <input
                      className="input"
                      defaultValue={it.name || ""}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        const v = e.target.value || "";
                        if (v !== (it.name || "")) putItem(it.id, { name: v }).catch(console.error);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      defaultValue={String(it.qty ?? 0)}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        const v = Number(e.target.value || 0);
                        if (v !== Number(it.qty ?? 0)) putItem(it.id, { qty: v }).catch(console.error);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      defaultValue={it.unit || ""}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        const v = e.target.value || "";
                        if (v !== (it.unit || "")) putItem(it.id, { unit: v }).catch(console.error);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      defaultValue={it.category || ""}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        const v = e.target.value || "";
                        if (v !== (it.category || "")) putItem(it.id, { category: v }).catch(console.error);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      defaultValue={it.location || ""}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        const v = e.target.value || "";
                        if (v !== (it.location || "")) putItem(it.id, { location: v }).catch(console.error);
                      }}
                    />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      defaultChecked={!!it.is_public}
                      onChange={(e) => putItem(it.id, { is_public: e.target.checked }).catch(console.error)}
                    />
                  </td>
                  <td>
                    <button className="btn" onClick={() => delItem(it.id).catch(console.error)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={7} className="helper">
                    No inventory items.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={onAdd} className="grid cols-3" style={{ marginTop: 12 }}>
          <input className="input" name="name" placeholder="Name" required />
          <input className="input" name="qty" placeholder="Qty" />
          <input className="input" name="unit" placeholder="Unit" />
          <input className="input" name="category" placeholder="Category" />
          <input className="input" name="location" placeholder="Location" />
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" name="is_public" />
            Public
          </label>
          <div />
          <button className="btn">Add Item</button>
        </form>
      </div>
    </div>
  );
}
