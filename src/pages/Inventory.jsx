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

function uniqSorted(arr) {
  return Array.from(
    new Set((arr || []).map((x) => String(x || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

export default function Inventory() {
  const orgId = getOrgId();

  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Controlled add form so it actually clears every time
  const [form, setForm] = useState({
    name: "",
    qty: "",
    unit: "",
    category: "",
    location: "",
    notes: "",
    is_public: false,
  });

  const unitOptions = useMemo(() => uniqSorted(items.map((i) => i.unit)), [items]);
  const categoryOptions = useMemo(() => uniqSorted(items.map((i) => i.category)), [items]);
  const locationOptions = useMemo(() => uniqSorted(items.map((i) => i.location)), [items]);

  async function refresh() {
    if (!orgId) return;
    setLoading(true);
    setErr("");
    try {
      const d = await api(`/api/orgs/${encodeURIComponent(orgId)}/inventory`);
      setItems(Array.isArray(d.inventory) ? d.inventory : []);
    } catch (e) {
      console.error(e);
      setErr(e?.message || String(e));
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

    setErr("");

    const name = String(form.name || "").trim();
    if (!name) return;

    const qtyRaw = String(form.qty ?? "").trim();
    let qty = null;
    if (qtyRaw !== "") {
      const n = Number(qtyRaw);
      if (!Number.isFinite(n)) {
        setErr("Qty must be a number.");
        return;
      }
      qty = n;
    }

    const unit = String(form.unit || "").trim();
    const category = String(form.category || "").trim();
    const location = String(form.location || "").trim();
    const notes = String(form.notes || "").trim();
    const is_public = !!form.is_public;

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

    // Clear fields immediately, reliably
    setForm({
      name: "",
      qty: "",
      unit: "",
      category: "",
      location: "",
      notes: "",
      is_public: false,
    });

    setTimeout(() => {
      refresh().catch(console.error);
    }, 500);
  }

  const cellInputStyle = {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  };

  const compactBtnStyle = {
    width: "100%",
    padding: "6px 0",
    minWidth: 0,
    whiteSpace: "nowrap",
  };

  return (
    <div>
      <div className="card" style={{ margin: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 className="section-title" style={{ margin: 0, flex: 1 }}>
            Inventory
          </h2>
          <button className="btn" onClick={() => refresh().catch(console.error)} disabled={loading}>
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

        {err ? (
          <div className="helper" style={{ color: "tomato", marginTop: 10 }}>
            {err}
          </div>
        ) : null}

        {/* Desktop/table view */}
        <div className="bf-table-desktop" style={{ marginTop: 12, overflowX: "auto", paddingRight: 28 }}>
          <table className="table" style={{ width: "100%", tableLayout: "fixed" }}>
            <colgroup>
              <col />
              <col style={{ width: 90 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 160 }} />
              <col style={{ width: 160 }} />
              <col />
              <col style={{ width: 84 }} />
              <col style={{ width: 120 }} />
            </colgroup>

            <thead>
              <tr>
                <th>Name</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Category</th>
                <th>Location</th>
                <th>Notes</th>
                <th style={{ textAlign: "center" }}>Public</th>
                <th />
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
                        if (v !== (i.name || "")) putItem(i.id, { name: v }).catch(console.error);
                      }}
                    />
                  </td>

                  <td>
                    <input
                      className="input"
                      type="number"
                      step="any"
                      defaultValue={i.qty === null || typeof i.qty === "undefined" ? "" : i.qty}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        const raw = e.target.value;
                        const v = raw === "" ? null : Number(raw);
                        const curr = i.qty === null || typeof i.qty === "undefined" ? null : Number(i.qty);
                        if (v !== curr) putItem(i.id, { qty: v }).catch(console.error);
                      }}
                    />
                  </td>

                  <td>
                    <input
                      className="input"
                      list="bf_inv_units"
                      defaultValue={i.unit || ""}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        const v = (e.target.value || "").trim();
                        if (v !== (i.unit || "")) putItem(i.id, { unit: v }).catch(console.error);
                      }}
                    />
                  </td>

                  <td>
                    <input
                      className="input"
                      list="bf_inv_categories"
                      defaultValue={i.category || ""}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        const v = (e.target.value || "").trim();
                        if (v !== (i.category || "")) putItem(i.id, { category: v }).catch(console.error);
                      }}
                    />
                  </td>

                  <td>
                    <input
                      className="input"
                      list="bf_inv_locations"
                      defaultValue={i.location || ""}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        const v = (e.target.value || "").trim();
                        if (v !== (i.location || "")) putItem(i.id, { location: v }).catch(console.error);
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
                        if (v !== (i.notes || "")) putItem(i.id, { notes: v }).catch(console.error);
                      }}
                    />
                  </td>

                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      style={{ margin: 0 }}
                      defaultChecked={!!i.is_public}
                      onChange={(e) => putItem(i.id, { is_public: e.target.checked }).catch(console.error)}
                    />
                  </td>

                  <td>
                    <button className="btn" style={compactBtnStyle} onClick={() => delItem(i.id).catch(console.error)}>
                      Delete
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

          <datalist id="bf_inv_units">
            {unitOptions.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <datalist id="bf_inv_categories">
            {categoryOptions.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <datalist id="bf_inv_locations">
            {locationOptions.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </div>

        {/* Mobile/cards view */}
        <div className="bf-cards-mobile" style={{ marginTop: 12 }}>
          {list.map((i) => (
            <div key={i.id} className="bf-rowcard">
              <div className="bf-rowcard-top">
                <div className="bf-rowcard-title">Item</div>
                <button className="btn" type="button" onClick={() => delItem(i.id).catch(console.error)}>
                  Delete
                </button>
              </div>

              <label className="bf-field">
                <span className="bf-field-label">Name</span>
                <input
                  className="input"
                  defaultValue={i.name || ""}
                  onBlur={(e) => {
                    const v = String(e.target.value || "").trim();
                    if (v !== String(i.name || "")) putItem(i.id, { name: v }).catch(console.error);
                  }}
                />
              </label>

              <div className="bf-two">
                <label className="bf-field">
                  <span className="bf-field-label">Qty</span>
                  <input
                    className="input"
                    type="number"
                    step="any"
                    defaultValue={i.qty === null || typeof i.qty === "undefined" ? "" : i.qty}
                    onBlur={(e) => {
                      const raw = e.target.value;
                      const v = raw === "" ? null : Number(raw);
                      const curr = i.qty === null || typeof i.qty === "undefined" ? null : Number(i.qty);
                      if (v !== curr) putItem(i.id, { qty: v }).catch(console.error);
                    }}
                  />
                </label>

                <label className="bf-field">
                  <span className="bf-field-label">Unit</span>
                  <input
                    className="input"
                    list="bf_inv_units"
                    defaultValue={i.unit || ""}
                    onBlur={(e) => {
                      const v = (e.target.value || "").trim();
                      if (v !== (i.unit || "")) putItem(i.id, { unit: v }).catch(console.error);
                    }}
                  />
                </label>
              </div>

              <div className="bf-two">
                <label className="bf-field">
                  <span className="bf-field-label">Category</span>
                  <input
                    className="input"
                    list="bf_inv_categories"
                    defaultValue={i.category || ""}
                    onBlur={(e) => {
                      const v = (e.target.value || "").trim();
                      if (v !== (i.category || "")) putItem(i.id, { category: v }).catch(console.error);
                    }}
                  />
                </label>

                <label className="bf-field">
                  <span className="bf-field-label">Location</span>
                  <input
                    className="input"
                    list="bf_inv_locations"
                    defaultValue={i.location || ""}
                    onBlur={(e) => {
                      const v = (e.target.value || "").trim();
                      if (v !== (i.location || "")) putItem(i.id, { location: v }).catch(console.error);
                    }}
                  />
                </label>
              </div>

              <label className="bf-field">
                <span className="bf-field-label">Notes</span>
                <input
                  className="input"
                  defaultValue={i.notes || ""}
                  onBlur={(e) => {
                    const v = e.target.value || "";
                    if (v !== (i.notes || "")) putItem(i.id, { notes: v }).catch(console.error);
                  }}
                />
              </label>

              <label className="bf-field bf-inline">
                <span className="bf-field-label">Public</span>
                <input
                  type="checkbox"
                  defaultChecked={!!i.is_public}
                  onChange={(e) => putItem(i.id, { is_public: e.target.checked }).catch(console.error)}
                />
              </label>
            </div>
          ))}

          {list.length === 0 ? <div className="helper">No inventory items match.</div> : null}
        </div>

        <form onSubmit={onAdd} className="grid cols-3" style={{ marginTop: 12 }}>
          <input
            className="input"
            name="name"
            placeholder="Name"
            required
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />

          <input
            className="input"
            name="qty"
            placeholder="Qty"
            type="number"
            step="any"
            value={form.qty}
            onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))}
          />

          <input
            className="input"
            name="unit"
            placeholder="Unit"
            list="bf_inv_units"
            value={form.unit}
            onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
          />

          <input
            className="input"
            name="category"
            placeholder="Category"
            list="bf_inv_categories"
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
          />

          <input
            className="input"
            name="location"
            placeholder="Location"
            list="bf_inv_locations"
            value={form.location}
            onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
          />

          <input
            className="input"
            name="notes"
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          />

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              name="is_public"
              checked={form.is_public}
              onChange={(e) => setForm((p) => ({ ...p, is_public: e.target.checked }))}
            />
            Public
          </label>

          <div />
          <button className="btn">Add Item</button>
        </form>
      </div>
    </div>
  );
}
