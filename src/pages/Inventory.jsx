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

  const [err, setErr] = useState("");

  async function refresh() {
    if (!orgId) return;
    setLoading(true);
    try {
      const d = await api(`/api/orgs/${encodeURIComponent(orgId)}/inventory`);
      // backend returns { inventory: [...] }
      setItems(Array.isArray(d.inventory) ? d.inventory : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(console.error);
  }, [orgId]);

  const list = useMemo(() => {
    const needle = q.toLowerCase();
    return items.filter((i) =>
      [i.name, i.category, i.location, i.notes, i.unit]
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
    refresh().catch(console.error);
  }

  async function delItem(id) {
    if (!orgId || !id) return;
    await api(
      `/api/orgs/${encodeURIComponent(orgId)}/inventory?id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    refresh().catch(console.error);
  }

  async function onAdd(e) {
    e.preventDefault();
    if (!orgId) return;

    const f = new FormData(e.currentTarget);

    const name = String(f.get("name") || "").trim();
    if (!name) return;

    const qty = String(f.get("qty") || "");
    const unit = String(f.get("unit") || "");
    const category = String(f.get("category") || "");
    const location = String(f.get("location") || "");
    const notes = String(f.get("notes") || "");
    const is_public = String(f.get("is_public") || "") === "on";

    // POST
    const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        qty,
        unit,
        category,
        location,
        notes,
        is_public,
      }),
    });

    // optimistic insert if API returns id
    if (data?.id) {
      setItems((prev) => [
        {
          id: data.id,
          name,
          qty,
          unit,
          category,
          location,
          notes,
          is_public: is_public ? 1 : 0,
        },
        ...prev,
      ]);
    }

    e.currentTarget.reset();

    // reconcile fetch to keep canonical
    setTimeout(() => {
      refresh().catch(console.error);
    }, 500);
  }


  const cellInputStyle = {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  };


  return (
    <div>
      <div className="card" style={{ margin: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 className="section-title" style={{ margin: 0, flex: 1 }}>
            Inventory
          </h2>
          <button
            className="btn"
            onClick={() => refresh().catch(console.error)}
            disabled={loading}
          >
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

        <div style={{ marginTop: 12, overflowX: "auto", paddingRight: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>

            <thead>
              <tr>
                <th style={{ width: "20%" }}>Name</th>
                <th style={{ width: "8%" }}>Qty</th>
                <th style={{ width: "8%" }}>Unit</th>
                <th style={{ width: "12%" }}>Category</th>
                <th style={{ width: "12%" }}>Location</th>
                <th style={{ width: "28%" }}>Notes</th>
                <th style={{ width: "15%" }}>Public</th>
                <th style={{ width: "7%" }} />

              </tr>
            </thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id}>
                  <td>
                    <input
                      className="input"
                      defaultValue={i.name || ""}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        const v = e.target.value || "";
                        if (v !== (i.name || ""))
                          putItem(i.id, { name: v }).catch(console.error);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      step="any"
                      defaultValue={
                        i.qty === null || typeof i.qty === "undefined" ? "" : i.qty
                      }
                      style={cellInputStyle}
                      onBlur={(e) => {
                        const raw = e.target.value;
                        const v = raw === "" ? null : Number(raw);
                        const curr =
                          i.qty === null || typeof i.qty === "undefined"
                            ? null
                            : Number(i.qty);
                        if (v !== curr)
                          putItem(i.id, { qty: v }).catch(console.error);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      defaultValue={i.unit || ""}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        const v = e.target.value || "";
                        if (v !== (i.unit || ""))
                          putItem(i.id, { unit: v }).catch(console.error);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      defaultValue={i.category || ""}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        const v = e.target.value || "";
                        if (v !== (i.category || ""))
                          putItem(i.id, { category: v }).catch(console.error);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      defaultValue={i.location || ""}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        const v = e.target.value || "";
                        if (v !== (i.location || ""))
                          putItem(i.id, { location: v }).catch(console.error);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      defaultValue={i.notes || ""}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        const v = e.target.value || "";
                        if (v !== (i.notes || ""))
                          putItem(i.id, { notes: v }).catch(console.error);
                      }}
                    />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      defaultChecked={!!i.is_public}
                      onChange={(e) =>
                        putItem(i.id, { is_public: e.target.checked }).catch(
                          console.error
                        )
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="btn"
                      style={{ padding: "16px 20px", minWidth: 0, whiteSpace: "nowrap" }}
                      onClick={() => delItem(i.id).catch(console.error)}
                    >
                      Del
                    </button>

                  </td>
                </tr>
              ))}

              {list.length === 0 && (
                <tr>
                  <td colSpan={8} className="helper">
                    No inventory items match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={onAdd} className="grid cols-3" style={{ marginTop: 12 }}>
          <input className="input" name="name" placeholder="Name" required />
          <input
            className="input"
            name="qty"
            placeholder="Qty"
            type="number"
            step="any"
          />
          <input className="input" name="unit" placeholder="Unit" />
          <input className="input" name="category" placeholder="Category" />
          <input className="input" name="location" placeholder="Location" />
          <input className="input" name="notes" placeholder="Notes" />
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
