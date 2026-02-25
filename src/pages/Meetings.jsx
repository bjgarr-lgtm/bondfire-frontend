// src/pages/Meetings.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../utils/api.js";
import { encryptWithOrgKey, getCachedOrgKey } from "../lib/zk.js";
import { decryptRows } from "../utils/decryptRow.js";

function getOrgId() {
	try {
		const m = (window.location.hash || "").match(/#\/org\/([^/]+)/);
		return m && m[1] ? decodeURIComponent(m[1]) : null;
	} catch {
		return null;
	}
}

function fromInputDT(value) {
	if (!value) return null;
	const ms = Date.parse(value);
	return Number.isFinite(ms) ? ms : null;
}

function formatDT(ms) {
	if (!ms) return "";
	const d = new Date(Number(ms));
	return d.toLocaleString(undefined, {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function safeStr(v) {
	return String(v ?? "");
}

export default function Meetings() {
	const params = useParams();
	const orgId = params?.orgId || getOrgId();

	const [items, setItems] = useState([]);
	const [q, setQ] = useState("");
	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState("");
	const [busyZk, setBusyZk] = useState(false);
	const [zkMsg, setZkMsg] = useState("");

	const [edit, setEdit] = useState(null);

	// Controlled add form so it clears reliably
	const [form, setForm] = useState({
		title: "",
		starts_at: "",
		ends_at: "",
		location: "",
		agenda: "",
		is_public: false,
	});

	async function refresh() {
		if (!orgId) return;
		setLoading(true);
		setErr("");
		try {
			const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/meetings`);
			const raw = Array.isArray(data.meetings) ? data.meetings : [];

			const orgKey = getCachedOrgKey(orgId);
			const dec = orgKey ? await decryptRows(orgKey, raw) : raw;
			const out = dec.map((m) => {
				if (m?.encrypted_blob && !m?.title) return { ...m, title: "(encrypted)", location: "", agenda: "" };
				return m;
			});
			setItems(out);
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
		return items.filter((m) =>
			[safeStr(m.title), safeStr(m.location), safeStr(m.agenda)]
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

		const starts_at = fromInputDT(form.starts_at);
		const ends_at = fromInputDT(form.ends_at);
		const location = safeStr(form.location).trim();
		const agenda = safeStr(form.agenda).trim();
		const is_public = !!form.is_public;

		const orgKey = getCachedOrgKey(orgId);
		let payload = { title, starts_at, ends_at, location, agenda, is_public };
		if (orgKey && !is_public) {
			const enc = await encryptWithOrgKey(orgKey, JSON.stringify({ title, location, agenda }));
			payload = {
				title: "__encrypted__",
				location: "",
				agenda: "",
				starts_at,
				ends_at,
				is_public,
				encrypted_blob: enc,
			};
		}

		await api(`/api/orgs/${encodeURIComponent(orgId)}/meetings`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});

		setForm({ title: "", starts_at: "", ends_at: "", location: "", agenda: "", is_public: false });
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
			const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/meetings`);
			const raw = Array.isArray(data.meetings) ? data.meetings : [];
			let changed = 0;
			for (const m of raw) {
				if (!m?.id) continue;
				if (m?.encrypted_blob) continue;
				if (!!m.is_public) continue;
				if (String(m.title || "") === "__encrypted__") continue;
				const next = {
					title: safeStr(m.title).trim(),
					location: safeStr(m.location).trim(),
					agenda: safeStr(m.agenda).trim(),
				};
				const enc = await encryptWithOrgKey(orgKey, JSON.stringify(next));
				await api(`/api/orgs/${encodeURIComponent(orgId)}/meetings`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						id: m.id,
						title: "__encrypted__",
						location: "",
						agenda: "",
						starts_at: m.starts_at ?? null,
						ends_at: m.ends_at ?? null,
						is_public: 0,
						encrypted_blob: enc,
					}),
				});
				changed++;
			}
			setZkMsg(changed ? `Encrypted ${changed} existing meeting records on the server.` : "Nothing to encrypt. (Everything already looks encrypted or public.)");
			await refresh();
		} catch (e) {
			console.error(e);
			setErr(e?.message || String(e));
		} finally {
			setBusyZk(false);
		}
	}

	function openItem(m) {
		setEdit({
			id: m.id,
			title: m.title || "",
			starts_at: m.starts_at ? new Date(Number(m.starts_at)).toISOString().slice(0, 16) : "",
			ends_at: m.ends_at ? new Date(Number(m.ends_at)).toISOString().slice(0, 16) : "",
			location: m.location || "",
			agenda: m.agenda || "",
			is_public: !!m.is_public,
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
			const starts_at = fromInputDT(edit.starts_at);
			const ends_at = fromInputDT(edit.ends_at);

			let payload = {
				id: edit.id,
				title: safeStr(edit.title).trim(),
				starts_at,
				ends_at,
				location: safeStr(edit.location).trim(),
				agenda: safeStr(edit.agenda),
				is_public,
			};

			if (orgKey && !is_public) {
				const enc = await encryptWithOrgKey(orgKey, JSON.stringify({ title: payload.title, location: payload.location, agenda: payload.agenda }));
				payload = {
					id: edit.id,
					title: "__encrypted__",
					starts_at,
					ends_at,
					location: "",
					agenda: "",
					is_public,
					encrypted_blob: enc,
				};
			}

			await api(`/api/orgs/${encodeURIComponent(orgId)}/meetings`, {
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
			await api(`/api/orgs/${encodeURIComponent(orgId)}/meetings?id=${encodeURIComponent(edit.id)}`, { method: "DELETE" });
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
					<h2 className="section-title" style={{ margin: 0, flex: 1, minWidth: 160 }}>
						Meetings
					</h2>
					<button className="btn" onClick={() => refresh().catch(console.error)} disabled={loading}>
						{loading ? "Loading" : "Refresh"}
					</button>
					<button className="btn" onClick={() => encryptExisting().catch(console.error)} disabled={busyZk || loading}>
						{busyZk ? "Encrypting" : "Encrypt Existing"}
					</button>
				</div>

				{zkMsg ? <div className="helper" style={{ marginTop: 10 }}>{zkMsg}</div> : null}

				<input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search meetings" style={{ marginTop: 12 }} />
				{err ? <div className="helper" style={{ color: "tomato", marginTop: 10 }}>{err}</div> : null}

				<div style={{ marginTop: 12, overflowX: "auto" }}>
					<table className="table" style={{ width: "100%" }}>
						<thead>
							<tr>
								<th>Title</th>
								<th>Starts</th>
								<th>Ends</th>
								<th>Location</th>
								<th>Public</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((m) => (
								<tr key={m.id}>
									<td style={{ fontWeight: 700 }}>{m.title || "(untitled)"}</td>
									<td>{formatDT(m.starts_at)}</td>
									<td>{formatDT(m.ends_at)}</td>
									<td>{m.location || ""}</td>
									<td>{m.is_public ? "Yes" : "No"}</td>
									<td style={{ textAlign: "right" }}><button className="btn" type="button" onClick={() => openItem(m)}>Details</button></td>
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
					<div className="card" style={{ width: "min(920px, 100%)", padding: 16 }}>
						<div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
							<h3 style={{ margin: 0 }}>Meeting Details</h3>
							<button className="btn" type="button" onClick={closeModal}>Close</button>
						</div>

						<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
							<input className="input" placeholder="Title" value={edit.title} onChange={(e) => setEdit((p) => ({ ...p, title: e.target.value }))} />
							<input className="input" type="datetime-local" value={edit.starts_at} onChange={(e) => setEdit((p) => ({ ...p, starts_at: e.target.value }))} />
							<input className="input" type="datetime-local" value={edit.ends_at} onChange={(e) => setEdit((p) => ({ ...p, ends_at: e.target.value }))} />
							<input className="input" placeholder="Location" value={edit.location} onChange={(e) => setEdit((p) => ({ ...p, location: e.target.value }))} />
						</div>

						<textarea className="input" rows={6} placeholder="Agenda / Notes" value={edit.agenda} onChange={(e) => setEdit((p) => ({ ...p, agenda: e.target.value }))} style={{ marginTop: 10 }} />

						<label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
							<input type="checkbox" checked={!!edit.is_public} onChange={(e) => setEdit((p) => ({ ...p, is_public: e.target.checked }))} />
							<span className="helper">Public</span>
						</label>

						<div className="row" style={{ gap: 10, marginTop: 12, justifyContent: "space-between" }}>
							<button className="btn" type="button" onClick={deleteItem}>Delete</button>
							<button className="btn-red" type="button" onClick={saveEdit}>Save Changes</button>
						</div>

						<div className="helper" style={{ marginTop: 10 }}>
							If ZK is enabled and this meeting is not public, Title, Location, and Agenda are encrypted automatically on save.
							Start and end times stay unencrypted so you can sort and display schedules.
						</div>
					</div>
				</div>
			) : null}


			<div className="card" style={{ margin: 16, padding: 16 }}>
				<h3 style={{ marginTop: 0 }}>Add Meeting</h3>
				<form onSubmit={onAdd} style={{ display: "grid", gap: 10 }}>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
						<input className="input" placeholder="Title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
						<input className="input" type="datetime-local" value={form.starts_at} onChange={(e) => setForm((p) => ({ ...p, starts_at: e.target.value }))} />
						<input className="input" type="datetime-local" value={form.ends_at} onChange={(e) => setForm((p) => ({ ...p, ends_at: e.target.value }))} />
						<input className="input" placeholder="Location" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
					</div>
					<textarea className="input" rows={3} placeholder="Agenda" value={form.agenda} onChange={(e) => setForm((p) => ({ ...p, agenda: e.target.value }))} />
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
