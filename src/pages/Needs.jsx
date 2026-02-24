// src/pages/Needs.jsx
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

export default function Needs() {
	const orgId = getOrgId();
	const [items, setItems] = useState([]);
	const [q, setQ] = useState("");
	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState("");
	const [busyZk, setBusyZk] = useState(false);
	const [zkMsg, setZkMsg] = useState("");

	const [edit, setEdit] = useState(null);

	const [form, setForm] = useState({ title: "", description: "", urgency: "", priority: 0, is_public: false });

	async function refresh() {
		if (!orgId) return;
		setLoading(true);
		setErr("");
		try {
			const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/needs`);
			const raw = Array.isArray(data.needs) ? data.needs : [];
			const orgKey = getCachedOrgKey(orgId);
			if (orgKey) {
				const out = [];
				for (const n of raw) {
					if (n?.encrypted_blob) {
						try {
							const dec = JSON.parse(await decryptWithOrgKey(orgKey, n.encrypted_blob));
							out.push({ ...n, ...dec });
							continue;
						} catch {
							out.push({ ...n, title: "(encrypted)", description: "", urgency: "" });
							continue;
						}
					}
					out.push(n);
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
		return items.filter((n) =>
			[safeStr(n.title), safeStr(n.description), safeStr(n.urgency), safeStr(n.status)]
				.join(" ")
				.toLowerCase()
				.includes(needle)
		);
	}, [items, q]);

	async function onAdd(e) {
		e.preventDefault();
		if (!orgId) return;
		setErr("");
		const title = safeStr(form.title).trim();
		if (!title) return;
		const description = safeStr(form.description).trim();
		const urgency = safeStr(form.urgency).trim();
		const priority = Number(form.priority) || 0;
		const is_public = !!form.is_public;

		const orgKey = getCachedOrgKey(orgId);
		let payload = { title, description, urgency, priority, is_public };
		if (orgKey && !is_public) {
			const enc = await encryptWithOrgKey(orgKey, JSON.stringify({ title, description, urgency }));
			payload = { title: "__encrypted__", description: "", urgency: "", priority, is_public, encrypted_blob: enc };
		}

		await api(`/api/orgs/${encodeURIComponent(orgId)}/needs`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});

		setForm({ title: "", description: "", urgency: "", priority: 0, is_public: false });
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
			const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/needs`);
			const raw = Array.isArray(data.needs) ? data.needs : [];
			let changed = 0;
			for (const n of raw) {
				if (!n?.id) continue;
				if (n?.encrypted_blob) continue;
				if (!!n.is_public) continue;
				if (String(n.title || "") === "__encrypted__") continue;
				const next = { title: safeStr(n.title).trim(), description: safeStr(n.description).trim(), urgency: safeStr(n.urgency).trim() };
				const enc = await encryptWithOrgKey(orgKey, JSON.stringify(next));
				await api(`/api/orgs/${encodeURIComponent(orgId)}/needs`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						id: n.id,
						title: "__encrypted__",
						description: "",
						urgency: "",
						priority: n.priority ?? 0,
						status: n.status || "open",
						is_public: 0,
						encrypted_blob: enc,
					}),
				});
				changed++;
			}
			setZkMsg(changed ? `Encrypted ${changed} existing needs on the server.` : "Nothing to encrypt. (Everything already looks encrypted or public.)");
			await refresh();
		} catch (e) {
			console.error(e);
			setErr(e?.message || String(e));
		} finally {
			setBusyZk(false);
		}
	}

	function openItem(n) {
		setEdit({
			id: n.id,
			title: n.title || "",
			description: n.description || "",
			urgency: n.urgency || "",
			priority: n.priority ?? 0,
			status: n.status || "",
			is_public: !!n.is_public,
		});
	}

	function closeModal() {
		setEdit(null);
	}

	async function saveEdit() {
		if (!orgId || !edit?.id) return;
		setErr("");
		try {
			const orgKey = getCachedOrgKey(orgId);
			const is_public = !!edit.is_public;
			const priority = Number(edit.priority) || 0;

			let payload = {
				id: edit.id,
				title: safeStr(edit.title).trim(),
				description: safeStr(edit.description),
				urgency: safeStr(edit.urgency).trim(),
				priority,
				status: safeStr(edit.status).trim(),
				is_public,
			};

			if (orgKey && !is_public) {
				const enc = await encryptWithOrgKey(orgKey, JSON.stringify({ title: payload.title, description: payload.description, urgency: payload.urgency }));
				payload = {
					id: edit.id,
					title: "__encrypted__",
					description: "",
					urgency: "",
					priority,
					status: payload.status,
					is_public,
					encrypted_blob: enc,
				};
			}

			await api(`/api/orgs/${encodeURIComponent(orgId)}/needs`, {
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
			await api(`/api/orgs/${encodeURIComponent(orgId)}/needs?id=${encodeURIComponent(edit.id)}`, { method: "DELETE" });
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
					<h2 className="section-title" style={{ margin: 0, flex: 1, minWidth: 120 }}>Needs</h2>
					<button className="btn" onClick={() => refresh().catch(console.error)} disabled={loading}>{loading ? "Loading" : "Refresh"}</button>
					<button className="btn" onClick={() => encryptExisting().catch(console.error)} disabled={busyZk || loading}>{busyZk ? "Encrypting" : "Encrypt Existing"}</button>
				</div>

				{zkMsg ? <div className="helper" style={{ marginTop: 10 }}>{zkMsg}</div> : null}
				<input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search needs" style={{ marginTop: 12 }} />
				{err ? <div className="helper" style={{ color: "tomato", marginTop: 10 }}>{err}</div> : null}

				<div style={{ marginTop: 12, overflowX: "auto" }}>
					<table className="table" style={{ width: "100%" }}>
						<thead>
							<tr>
								<th>Title</th>
								<th>Status</th>
								<th>Priority</th>
								<th>Public</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((n) => (
								<tr key={n.id}>
									<td style={{ fontWeight: 700 }}>{n.title || "(untitled)"}</td>
									<td>{n.status || "open"}</td>
									<td>{n.priority ?? 0}</td>
									<td>{n.is_public ? "Yes" : "No"}</td>
									<td style={{ textAlign: "right" }}>
										<button className="btn" type="button" onClick={() => openItem(n)}>Details</button>
									</td>
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
					<div className="card" style={{ width: "min(860px, 100%)", padding: 16 }}>
						<div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
							<h3 style={{ margin: 0 }}>Need Details</h3>
							<button className="btn" type="button" onClick={closeModal}>Close</button>
						</div>

						<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
							<input className="input" placeholder="Title" value={edit.title} onChange={(e) => setEdit((p) => ({ ...p, title: e.target.value }))} />
							<input className="input" placeholder="Urgency" value={edit.urgency} onChange={(e) => setEdit((p) => ({ ...p, urgency: e.target.value }))} />
							<input className="input" placeholder="Status" value={edit.status} onChange={(e) => setEdit((p) => ({ ...p, status: e.target.value }))} />
							<input className="input" type="number" placeholder="Priority" value={edit.priority} onChange={(e) => setEdit((p) => ({ ...p, priority: e.target.value }))} />
						</div>

						<textarea className="input" rows={5} placeholder="Description" value={edit.description} onChange={(e) => setEdit((p) => ({ ...p, description: e.target.value }))} style={{ marginTop: 10 }} />

						<label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
							<input type="checkbox" checked={!!edit.is_public} onChange={(e) => setEdit((p) => ({ ...p, is_public: e.target.checked }))} />
							<span className="helper">Public</span>
						</label>

						<div className="row" style={{ gap: 10, marginTop: 12, justifyContent: "space-between" }}>
							<button className="btn" type="button" onClick={deleteItem}>Delete</button>
							<button className="btn-red" type="button" onClick={saveEdit}>Save Changes</button>
						</div>

						<div className="helper" style={{ marginTop: 10 }}>
							If ZK is enabled and this need is not public, Title, Description, and Urgency are encrypted automatically on save.
						</div>
					</div>
				</div>
			) : null}


			<div className="card" style={{ margin: 16, padding: 16 }}>
				<h3 style={{ marginTop: 0 }}>Add Need</h3>
				<form onSubmit={onAdd} style={{ display: "grid", gap: 10 }}>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
						<input className="input" placeholder="Title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
						<input className="input" placeholder="Urgency" value={form.urgency} onChange={(e) => setForm((p) => ({ ...p, urgency: e.target.value }))} />
						<input className="input" type="number" placeholder="Priority" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} />
					</div>
					<textarea className="input" rows={3} placeholder="Description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
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
