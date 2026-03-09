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

function buildParMapFromItems(rows) {
  const next = {};
  for (const it of Array.isArray(rows) ? rows : []) {
    if (it?.id == null) continue;
    const raw = it?.par;
    const n = raw === "" || raw == null ? NaN : Number(raw);
    next[String(it.id)] = Number.isFinite(n) && n > 0 ? n : "";
  }
  return next;
}

export default function Inventory() {
  const orgId = getOrgId();
  const isNarrow = useMemo(() => {
    try {
      return !!(window && window.matchMedia && window.matchMedia("(max-width: 720px)").matches);
    } catch {
      return false;
    }
  }, []);
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
  const [zkMsg, setZkMsg] = useState("");

  const [selected, setSelected] = useState(null);
  const [edit, setEdit] = useState(null);

  const [form, setForm] = useState({ name: "", qty: 0, par: "", unit: "", category: "", location: "", notes: "", is_public: false });

  async function saveParToBackend(id, rawValue) {
    if (!orgId || !id) return;
    const par = rawValue === "" || rawValue == null ? null : Number(rawValue);
    await api(`/api/orgs/${encodeURIComponent(orgId)}/inventory`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, par }),
    });
  }

  async function refresh() {
    if (!orgId) return;
    setLoading(true);
    setErr("");
    try {
      const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/inventory`);
      const raw = Array.isArray(data.items) ? data.items : Array.isArray(data.inventory) ? data.inventory : [];

      const orgKey = getCachedOrgKey(orgId);
      if (orgKey) {
        const out = [];
        for (const it of raw) {
          if (it?.encrypted_blob) {
            try {
              const dec = JSON.parse(await decryptWithOrgKey(orgKey, it.encrypted_blob));
              out.push({
                ...it,
                ...dec,
                category: dec?.category ?? dec?.cat ?? it?.category ?? it?.cat ?? "",
              });
              continue;
            } catch {
              out.push({ ...it, name: "(encrypted)", category: it.category || "", location: "", notes: "" });
              continue;
            }
          }
          out.push(it);
        }
        setItems(out);
        const serverParMap = buildParMapFromItems(out);
        setParMap(serverParMap);
        writeParMap(orgId, serverParMap);
      } else {
        setItems(raw);
        const serverParMap = buildParMapFromItems(raw);
        setParMap(serverParMap);
        writeParMap(orgId, serverParMap);
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
    const location = safeStr(form.location).trim();
    const notes = safeStr(form.notes).trim();
    const is_public = !!form.is_public;

    const orgKey = getCachedOrgKey(orgId);
    let payload = { name, qty, unit, category, location, notes, is_public };
    if (orgKey && !is_public) {
      const enc = await encryptWithOrgKey(orgKey, JSON.stringify({ name, category, location, notes }));
      payload = { name: "__encrypted__", qty, unit, category, location: "", notes: "", is_public, encrypted_blob: enc };
    }

    const created = await api(`/api/orgs/${encodeURIComponent(orgId)}/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        par: Number.isFinite(parNum) && parNum > 0 ? parNum : null,
      }),
    });

    const savedItem = created?.item
      ? {
          ...created.item,
          name,
          qty,
          unit,
          category,
          location,
          notes,
          is_public,
        }
      : null;

    if (savedItem?.id) {
      setItems((prev) => [savedItem, ...(Array.isArray(prev) ? prev : [])]);
      setParMap((prev) => {
        const next = { ...(prev || {}) };
        next[String(savedItem.id)] = Number.isFinite(parNum) && parNum > 0 ? parNum : "";
        writeParMap(orgId, next);
        return next;
      });
    } else {
      await refresh();
    }

    setForm({ name: "", qty: 0, par: "", unit: "", category: "", location: "", notes: "", is_public: false });
  }

  function openItem(it) {
    setSelected(it);
    setEdit({
      id: it.id,
      name: it.name || "",
      qty: it.qty ?? 0,
      par: it?.par ?? parMap?.[String(it.id)] ?? "",
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
          category: payload.category,
          location: "",
          notes: "",
          is_public,
          encrypted_blob: enc,
        };
      }

      const saved = await api(`/api/orgs/${encodeURIComponent(orgId)}/inventory`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          par: edit.par === "" || edit.par == null ? null : Number(edit.par),
        }),
      });

      const savedItem = saved?.item
        ? {
            ...saved.item,
            name: safeStr(edit.name).trim(),
            qty,
            unit: safeStr(edit.unit).trim(),
            category: safeStr(edit.category).trim(),
            location: safeStr(edit.location).trim(),
            notes: safeStr(edit.notes),
            is_public,
          }
        : null;

      if (savedItem?.id) {
        setItems((prev) => (Array.isArray(prev) ? prev.map((it) => (it.id === savedItem.id ? savedItem : it)) : prev));
        setParMap((prev) => {
          const next = { ...(prev || {}) };
          next[String(savedItem.id)] = edit.par === "" || edit.par == null ? "" : (Number.isFinite(Number(edit.par)) ? Number(edit.par) : "");
          writeParMap(orgId, next);
          return next;
        });
      } else {
        await refresh();
      }

      closeModal();
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
      setItems((prev) => (Array.isArray(prev) ? prev.filter((it) => it.id !== edit.id) : prev));
      setParMap((prev) => {
        const next = { ...(prev || {}) };
        delete next[String(edit.id)];
        writeParMap(orgId, next);
        return next;
      });
      closeModal();
    } catch (e) {
      console.error(e);
      setErr(e?.message || String(e));
    }
  }

  return null;
}
