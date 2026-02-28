// src/pages/Inventory.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../utils/api.js";
import { decryptWithOrgKey, encryptWithOrgKey, getCachedOrgKey } from "../lib/zk.js";

function getOrgId() {
  try {
    const m = (window.location.hash || "").match(/#\/org\/([^/]+)/);
    return m && m[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function safeStr(v) {
  return String(v ?? "");
}

function readParMap(orgId) {
  try {
    return JSON.parse(localStorage.getItem(`bf_inv_par_${orgId}`) || "{}") || {};
  } catch {
    return {};
  }
}

function writeParMap(orgId, obj) {
  try {
    localStorage.setItem(`bf_inv_par_${orgId}`, JSON.stringify(obj || {}));
  } catch {}
}

function itemKeyFromFields({ name, unit, category, location }) {
  const n = safeStr(name).trim().toLowerCase();
  const u = safeStr(unit).trim().toLowerCase();
  const c = safeStr(category).trim().toLowerCase();
  const l = safeStr(location).trim().toLowerCase();
  return `${n}|${u}|${c}|${l}`;
}

export default function Inventory() {
  const orgId = getOrgId();
  const [parMap, setParMap] = useState(() => (orgId ? readParMap(orgId) : {}));
  useEffect(() => {
    setParMap(orgId ? readParMap(orgId) : {});
  }, [orgId]);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [sortMode, setSortMode] = useState("low");
  const [catFilter, setCatFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [busyZk, setBusyZk] = useState(false);
  const [zkMsg, setZkMsg] = useState("");

  const [selected, setSelected] = useState(null);
  const [edit, setEdit] = useState(null);

  const [form, setForm] = useState({ name: "", qty: 0, par: "", unit: "", category: "", location: "", notes: "", is_public: false });

  async function refresh() {
    if (!orgId) return;
    setLoading(true);
    setErr("");
    try {
      const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/inventory`);
      const raw = Array.isArray(data.inventory) ? data.inventory : [];

      const orgKey = getCachedOrgKey(orgId);
      if (orgKey) {
        const out = [];
        for (const it of raw) {
          if (it?.encrypted_blob) {
            try {
              const dec = JSON.parse(await decryptWithOrgKey(orgKey, it.encrypted_blob));
              out.push({ ...it, ...dec });
              continue;
            } catch {
              out.push({ ...it, name: "(encrypted)", category: it.category || "", location: "", notes: "" });
              continue;
            }
          }
          out.push(it);
        }
        setItems(out);
        // Migrate any pending par values stored under a tmp key into real item ids.
        const pm = readParMap(orgId);
        let changed = false;
        for (const it of out) {
          if (it?.id == null) continue;
          const id = String(it.id);
          if (pm[id] != null) continue;
          const tmpKey = `tmp:${itemKeyFromFields(it)}`;
          if (pm[tmpKey] != null) {
            pm[id] = pm[tmpKey];
            delete pm[tmpKey];
            changed = true;
          }
        }
        if (changed) writeParMap(orgId, pm);
        setParMap(pm);
      } else {
        setItems(raw);
        setParMap(readParMap(orgId));
      }
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

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    let arr = items;
    if (catFilter && catFilter !== "all") {
      arr = arr.filter((it) => safeStr(it.category).toLowerCase() === catFilter);
    }
    return arr.filter((it) =>
      [safeStr(it.name), safeStr(it.category), safeStr(it.location), safeStr(it.notes)]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [items, q, catFilter]);

  const categoryOptions = useMemo(() => {
    const set = new Set();
    for (const it of items || []) {
      const c = safeStr(it.category).trim().toLowerCase();
      if (c) set.add(c);
    }
    return Array.from(set.values()).sort();
  }, [items]);

  const sorted = useMemo(() => {
    const arr = Array.isArray(filtered) ? [...filtered] : [];
    const pm = parMap || {};
    const meta = (it) => {
      const id = it?.id != null ? String(it.id) : "";
      const parRaw = pm?.[id];
      const parV = parRaw === "" || parRaw == null ? NaN : Number(parRaw);
      const par = Number.isFinite(parV) && parV > 0 ? parV : null;
      const qtyV = Number(it?.qty);
      const qty = Number.isFinite(qtyV) ? qtyV : 0;
      const pct = par ? qty / par : null;
      return { id, qty, par, pct, cat: safeStr(it?.category).toLowerCase(), name: safeStr(it?.name).toLowerCase() };
    };
    arr.sort((a, b) => {
      const A = meta(a);
      const B = meta(b);
      if (sortMode === "name") return A.name.localeCompare(B.name);
      if (sortMode === "category") return A.cat.localeCompare(B.cat) || A.name.localeCompare(B.name);
      if (sortMode === "qty") return (A.qty - B.qty) || A.name.localeCompare(B.name);
      if (sortMode === "par") return ((A.par || 999999) - (B.par || 999999)) || A.name.localeCompare(B.name);
      // default: lowest stock ratio first (items without par go last)
      const ap = A.pct == null ? 999 : A.pct;
      const bp = B.pct == null ? 999 : B.pct;
      if (ap !== bp) return ap - bp;
      return A.name.localeCompare(B.name);
    });
    return arr;
  }, [filtered, parMap, sortMode]);

  async function onAdd(e) {
    e.preventDefault();
    if (!orgId) return;
    setErr("");
    const name = safeStr(form.name).trim();
    if (!name) return;
    const qty = Number(form.qty) || 0;
    const unit = safeStr(form.unit).trim();
    const category = safeStr(form.category).trim();
    const parNum = form.par === "" ? null : Number(form.par);
    if (parNum != null && Number.isFinite(parNum) && orgId) {
      const pm = { ...(readParMap(orgId) || {}) };
      pm[`tmp:${itemKeyFromFields({ ...form, category })}`] = parNum;
      writeParMap(orgId, pm);
      setParMap(pm);
    }
    const location = safeStr(form.location).trim();
    const notes = safeStr(form.notes).trim();
    const is_public = !!form.is_public;

    const orgKey = getCachedOrgKey(orgId);
    let payload = { name, qty, unit, category, location, notes, is_public };
    if (orgKey && !is_public) {
      const enc = await encryptWithOrgKey(orgKey, JSON.stringify({ name, category, location, notes }));
      payload = { name: "__encrypted__", qty, unit, category, location: "", notes: "", is_public, encrypted_blob: enc };
    }

    await api(`/api/orgs/${encodeURIComponent(orgId)}/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setForm({ name: "", qty: 0, par: "", unit: "", category: "", location: "", notes: "", is_public: false });
    setTimeout(() => refresh().catch(console.error), 300);
  }

  function openItem(it) {
    setSelected(it);
    setEdit({
      id: it.id,
      name: it.name || "",
      qty: it.qty ?? 0,
      par: parMap?.[String(it.id)] ?? "",
      unit: it.unit || "",
      category: it.category || "",
      location: it.location || "",
      notes: it.notes || "",
      is_public: !!it.is_public,
    });
  }

  function closeModal() {
    setSelected(null);
    setEdit(null);
  }

  async function saveEdit() {
    if (!orgId || !edit?.id) return;
    setErr("");
    try {
      // Persist par map changes from the modal (table edits already do this, but modal edits didn't).
      const idStr = String(edit.id);
      const nextPm = { ...(readParMap(orgId) || {}) };
      if (edit.par === "" || edit.par == null) {
        delete nextPm[idStr];
      } else {
        const pv = Number(edit.par);
        nextPm[idStr] = Number.isFinite(pv) ? pv : "";
      }
      writeParMap(orgId, nextPm);
      setParMap(nextPm);

      const orgKey = getCachedOrgKey(orgId);
      const is_public = !!edit.is_public;
      const qty = Number.isFinite(Number(edit.qty)) ? Number(edit.qty) : 0;

      let payload = {
        id: edit.id,
        name: safeStr(edit.name).trim(),
        qty,
        unit: safeStr(edit.unit).trim(),
        category: safeStr(edit.category).trim(),
        location: safeStr(edit.location).trim(),
        notes: safeStr(edit.notes),
        is_public,
      };

      if (orgKey && !is_public) {
        const enc = await encryptWithOrgKey(
          orgKey,
          JSON.stringify({
            name: payload.name,
            category: payload.category,
            location: payload.location,
            notes: payload.notes,
          })
        );
        payload = {
          id: edit.id,
          name: "__encrypted__",
          qty,
          unit: payload.unit,
          category: payload.category, // FIX: was a bare `category` variable (ReferenceError)
          location: "",
          notes: "",
          is_public,
          encrypted_blob: enc,
        };
      }

      await api(`/api/orgs/${encodeURIComponent(orgId)}/inventory`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      closeModal();
      setTimeout(() => refresh().catch(console.error), 250);
    } catch (e) {
      console.error(e);
      setErr(e?.message || String(e));
    }
  }

  async function deleteItem() {
    if (!orgId || !edit?.id) return;
    setErr("");
    try {
      await api(`/api/orgs/${encodeURIComponent(orgId)}/inventory?id=${encodeURIComponent(edit.id)}`, {
        method: "DELETE",
      });
      closeModal();
      setTimeout(() => refresh().catch(console.error), 250);
    } catch (e) {
      console.error(e);
      setErr(e?.message || String(e));
    }
  }

  return (
    <div>
      <div className="card" style={{ margin: 16, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 className="section-title" style={{ margin: 0, flex: 1, minWidth: 140 }}>Inventory</h2>
          <button className="btn" onClick={() => refresh().catch(console.error)} disabled={loading}>{loading ? "Loading" : "Refresh"}</button>
        </div>

        {zkMsg ? <div className="helper" style={{ marginTop: 10 }}>{zkMsg}</div> : null}
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search inventory" style={{ marginTop: 12 }} />
        <div className="bf-inv-controls" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          <div className="helper">Sort</div>
          <select className="input" value={sortMode} onChange={(e) => setSortMode(e.target.value)} style={{ width: 180 }}>
            <option value="low">Lowest stock first</option>
            <option value="name">Name</option>
            <option value="category">Category</option>
            <option value="qty">Qty</option>
            <option value="par">Par</option>
          </select>
          <div className="helper">Category</div>
          <select className="input" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} style={{ width: 200 }}>
            <option value="all">All</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        {err ? <div className="helper" style={{ color: "tomato", marginTop: 10 }}>{err}</div> : null}

        <div className="bf-table-scroll" style={{ marginTop: 12, overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", minWidth: 760 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Qty</th>
                <th>Par</th>
                <th>Stock</th>
                <th>Unit</th>
                <th>Public</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((it) => (
                <tr key={it.id}>
                  <td style={{ fontWeight: 700 }}>{it.name || "(unnamed)"}</td>
                  <td>{it.qty ?? 0}</td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      value={parMap?.[String(it.id)] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setParMap((prev) => {
                          const next = { ...(prev || {}) };
                          next[String(it.id)] = v === "" ? "" : Number(v);
                          writeParMap(orgId, next);
                          return next;
                        });
                      }}
                      style={{ width: 90 }}
                    />
                  </td>
                  <td>
                    {(() => {
                      const id = String(it.id);
                      const raw = parMap?.[id];
                      const parV = raw === "" || raw == null ? NaN : Number(raw);
                      const par = Number.isFinite(parV) && parV > 0 ? parV : null;
                      const qtyV = Number(it?.qty);
                      const qty = Number.isFinite(qtyV) ? qtyV : 0;
                      if (!par) return <span className="helper">no par</span>;
                      const pct = Math.max(0, Math.min(1, qty / par));
                      return (
                        <div style={{ display: "grid", gap: 4, minWidth: 160 }}>
                          <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct * 100}%`, background: "rgba(255,0,0,0.55)" }} />
                          </div>
                          <div className="helper">{Math.round(qty)} / {Math.round(par)}</div>
                        </div>
                      );
                    })()}
                  </td>
                  <td>{it.unit || ""}</td>
                  <td>{it.is_public ? "Yes" : "No"}</td>
                  <td style={{ textAlign: "right" }}><button className="btn" type="button" onClick={() => openItem(it)}>Details</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {edit ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="card" style={{ width: "min(820px, 100%)", padding: 16 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Inventory Details</h3>
              <button className="btn" type="button" onClick={closeModal}>
                Close
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              <input className="input" placeholder="Name" value={edit.name} onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))} />
              <input className="input" type="number" placeholder="Qty" value={edit.qty} onChange={(e) => setEdit((p) => ({ ...p, qty: e.target.value }))} />
              <input className="input" type="number" placeholder="Par" value={edit.par ?? ""} onChange={(e) => setEdit((p) => ({ ...p, par: e.target.value }))} />
              <input className="input" placeholder="Unit" value={edit.unit} onChange={(e) => setEdit((p) => ({ ...p, unit: e.target.value }))} />
              <input className="input" placeholder="Category" value={edit.category} onChange={(e) => setEdit((p) => ({ ...p, category: e.target.value }))} />
              <input className="input" placeholder="Location" value={edit.location} onChange={(e) => setEdit((p) => ({ ...p, location: e.target.value }))} />
            </div>

            <textarea className="input" rows={4} placeholder="Notes" value={edit.notes} onChange={(e) => setEdit((p) => ({ ...p, notes: e.target.value }))} style={{ marginTop: 10 }} />

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <input type="checkbox" checked={!!edit.is_public} onChange={(e) => setEdit((p) => ({ ...p, is_public: e.target.checked }))} />
              <span className="helper">Public</span>
            </label>

            <div className="row" style={{ gap: 10, marginTop: 12, justifyContent: "space-between" }}>
              <button className="btn" type="button" onClick={deleteItem}>
                Delete
              </button>
              <button className="btn-red" type="button" onClick={saveEdit}>
                Save Changes
              </button>
            </div>

            <div className="helper" style={{ marginTop: 10 }}>
              If ZK is enabled and this item is not public, Name, Category, Location, and Notes are encrypted automatically on save.
            </div>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ margin: 16, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Add Inventory</h3>
        <form onSubmit={onAdd} style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            <input className="input" type="number" placeholder="Qty" value={form.qty} onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))} />
            <input className="input" type="number" placeholder="Par" value={form.par} onChange={(e) => setForm((p) => ({ ...p, par: e.target.value }))} />
            <input className="input" placeholder="Unit" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} />
            <input className="input" placeholder="Category" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
            <input className="input" placeholder="Location" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
          </div>
          <textarea className="input" rows={3} placeholder="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={form.is_public} onChange={(e) => setForm((p) => ({ ...p, is_public: e.target.checked }))} />
            <span className="helper">Public</span>
          </label>
          <button className="btn-red" type="submit">Create</button>
        </form>
      </div>
    </div>
  );
}
