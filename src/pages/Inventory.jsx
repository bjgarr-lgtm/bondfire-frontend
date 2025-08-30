// src/pages/Inventory.jsx
import React, { useMemo, useState, useCallback } from "react";
import { useStore, addItem, updateItem, deleteItem } from "../utils/store.js";

// derive orgId from hash; no extra deps
function getOrgId() {
  try {
    const m = (window.location.hash || "").match(/#\/org\/([^/]+)/);
    return m && m[1] ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

export default function Inventory() {
  const orgId = getOrgId();

  // NOTE: some store impls mutate arrays in place (no new reference),
  // which can prevent subscribed components from re-rendering.
  // We use a tiny "rev" bump to force a render after we call actions.
  const [rev, setRev] = useState(0);

  const inventoryAll = useStore((s) => s.inventory || []);
  const inventory = useMemo(() => {
    if (!orgId) return inventoryAll;
    return inventoryAll.some(i => i && Object.prototype.hasOwnProperty.call(i, "org"))
      ? inventoryAll.filter(i => i?.org === orgId)
      : inventoryAll;
  }, [inventoryAll, orgId, rev]);

  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const needle = q.toLowerCase();
    return inventory.filter((p) =>
      [p.name, p.category, p.location].filter(Boolean).join(" ").toLowerCase().includes(needle)
    );
  }, [inventory, q]);

  const bump = useCallback(() => setRev((r) => r + 1), []);

  function onAdd(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    addItem({
      id: crypto.randomUUID(),
      name: f.get("name"),
      qty: +(f.get("qty") || 0),
      unit: f.get("unit") || "ea",
      category: f.get("category") || "",
      location: f.get("location") || "",
      public: f.get("public") === "on",
      low: +(f.get("low") || 0),
      org: orgId || undefined,
    });
    e.currentTarget.reset();
    bump(); // ensure UI shows the new row immediately
  }

  const onUpdate = (id, patch) => {
    updateItem(id, patch);
    bump();
  };

  const onDelete = (id) => {
    deleteItem(id);
    bump();
  };

  return (
    <div>
      <div className="card" style={{ margin: 16 }}>
        <h2 className="section-title">Inventory</h2>

        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, category, location"
        />

        {/* Prevent horizontal overflow */}
        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table className="table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Name</th><th>Qty</th><th>Unit</th><th>Category</th>
                <th>Location</th><th>Public</th><th>Low</th><th />
              </tr>
            </thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id}>
                  <td>
                    <input
                      className="input"
                      defaultValue={i.name}
                      onBlur={(e) => onUpdate(i.id, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      defaultValue={i.qty}
                      onBlur={(e) => onUpdate(i.id, { qty: +e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      defaultValue={i.unit}
                      onBlur={(e) => onUpdate(i.id, { unit: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      defaultValue={i.category}
                      onBlur={(e) => onUpdate(i.id, { category: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      defaultValue={i.location}
                      onBlur={(e) => onUpdate(i.id, { location: e.target.value })}
                    />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      defaultChecked={!!i.public}
                      onChange={(e) => onUpdate(i.id, { public: e.target.checked })}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      defaultValue={i.low}
                      onBlur={(e) => onUpdate(i.id, { low: +e.target.value })}
                    />
                  </td>
                  <td>
                    <button className="btn" onClick={() => onDelete(i.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={8} className="helper">No items match.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Responsive grid: wraps instead of overflowing */}
        <form
          onSubmit={onAdd}
          className="grid"
          style={{
            marginTop: 12,
            display: "grid",
            gap: 8,
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            alignItems: "center",
          }}
        >
          <input className="input" name="name" placeholder="Name" required />
          <input className="input" name="qty" type="number" placeholder="Qty" required />
          <input className="input" name="unit" placeholder="Unit" />
          <input className="input" name="category" placeholder="Category" />
          <input className="input" name="location" placeholder="Location" />
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" name="public" /> Public
          </label>
          <input className="input" name="low" type="number" placeholder="Low threshold" />
          <div />
          <button className="btn">Add Item</button>
        </form>
      </div>
    </div>
  );
}
