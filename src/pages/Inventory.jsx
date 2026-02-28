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

export default function Inventory() {
	const orgId = getOrgId();
	const [items, setItems] = useState([]);
	const [q, setQ] = useState("");
	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState("");
	const [busyZk, setBusyZk] = useState(false);
	const [zkMsg, setZkMsg] = useState("");

	const [selected, setSelected] = useState(null);
	const [edit, setEdit] = useState(null);

	const [form, setForm] = useState({ name: "", qty: 0, unit: "", category: "", location: "", notes: "", is_public: false });

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
							out.push({ ...it, name: "(encrypted)", category: "", location: "", notes: "" });
							continue;
						}
					}
					out.push(it);
				}
				setItems(out);
			} else {
				setItems(raw);
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
		return items.filter((it) =>
			[safeStr(it.name), safeStr(it.category), safeStr(it.location), safeStr(it.notes)]
				.join(" ")
				.toLowerCase()
				.includes(needle)
		);
	}, [items, q]);

	async function onAdd(e) {
		e.preventDefault();
		if (!orgId) return;
		setErr("");
		const name = safeStr(form.name).trim();
		if (!name) return;
		const qty = Number(form.qty) || 0;
		const unit = safeStr(form.unit).trim();
		const category = safeStr(form.category).trim();
		const location = safeStr(form.location).trim();
		const notes = safeStr(form.notes).trim();
		const is_public = !!form.is_public;

		const orgKey = getCachedOrgKey(orgId);
		let payload = { name, qty, unit, category, location, notes, is_public };
		if (orgKey && !is_public) {
			const enc = await encryptWithOrgKey(orgKey, JSON.stringify({ name, category, location, notes }));
			payload = { name: "__encrypted__", qty, unit, category: "", location: "", notes: "", is_public, encrypted_blob: enc };
		}

		await api(`/api/orgs/${encodeURIComponent(orgId)}/inventory`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});

		setForm({ name: "", qty: 0, unit: "", category: "", location: "", notes: "", is_public: false });
		setTimeout(() => refresh().catch(console.error), 300);
	}

	async function encryptExisting() {
		if (!orgId) return;
		setZkMsg("");
		setErr("");
		const orgKey = getCachedOrgKey(orgId);
		if (!orgKey) {
			setErr("ZK is enabled, but this device does not have the org key loaded yet.");
			return;
		}
		setBusyZk(true);
		try {
			const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/inventory`);
			const raw = Array.isArray(data.inventory) ? data.inventory : [];
			let changed = 0;
			for (const it of raw) {
				if (!it?.id) continue;
				if (it?.encrypted_blob) continue;
				if (!!it.is_public) continue;
				if (String(it.name || "") === "__encrypted__") continue;
				const next = { name: safeStr(it.name).trim(), category: safeStr(it.category).trim(), location: safeStr(it.location).trim(), notes: safeStr(it.notes).trim() };
				const enc = await encryptWithOrgKey(orgKey, JSON.stringify(next));
				await api(`/api/orgs/${encodeURIComponent(orgId)}/inventory`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						id: it.id,
						name: "__encrypted__",
						qty: it.qty ?? 0,
						unit: it.unit || "",
						category: "",
						location: "",
						notes: "",
						is_public: 0,
						encrypted_blob: enc,
					}),
				});
				changed++;
			}
			setZkMsg(changed ? `Encrypted ${changed} existing inventory items on the server.` : "Nothing to encrypt. (Everything already looks encrypted or public.)");
			await refresh();
		} catch (e) {
			console.error(e);
			setErr(e?.message || String(e));
		} finally {
			setBusyZk(false);
		}
	}


	function openItem(it) {
		setSelected(it);
		setEdit({
			id: it.id,
			name: it.name || "",
			qty: it.qty ?? 0,
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
					// Category is NOT sensitive and is used for routing + aggregation.
					// Keep it plaintext even when other fields are encrypted.
					category: payload.category,
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

	return(
		<div>
			<div className="card" style={{ margin: 16, padding: 16 }}>
				<div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
					<h2 className="section-title" style={{ margin: 0, flex: 1, minWidth: 140 }}>Inventory</h2>
					<button className="btn" onClick={() => refresh().catch(console.error)} disabled={loading}>{loading ? "Loading" : "Refresh"}</button>
					<button className="btn" onClick={() => encryptExisting().catch(console.error)} disabled={busyZk || loading}>{busyZk ? "Encrypting" : "Encrypt Existing"}</button>
				</div>

				{zkMsg ? <div className="helper" style={{ marginTop: 10 }}>{zkMsg}</div> : null}
				<input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search inventory" style={{ marginTop: 12 }} />
				{err ? <div className="helper" style={{ color: "tomato", marginTop: 10 }}>{err}</div> : null}

				<div style={{ marginTop: 12, overflowX: "auto" }}>
					<table className="table" style={{ width: "100%" }}>
						<thead>
							<tr>
								<th>Name</th>
								<th>Qty</th>
								<th>Unit</th>
								<th>Public</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((it) => (
								<tr key={it.id}>
									<td style={{ fontWeight: 700 }}>{it.name || "(unnamed)"}</td>
									<td>{it.qty ?? 0}</td>
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
