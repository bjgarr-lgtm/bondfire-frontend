// src/pages/People.jsx
import React, { useMemo, useEffect, useState } from "react";
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

function useIsMobile(maxWidthPx = 720) {
	const [isMobile, setIsMobile] = useState(() => {
		if (typeof window === "undefined") return false;
		return window.matchMedia && window.matchMedia(`(max-width: ${maxWidthPx}px)`).matches;
	});

	useEffect(() => {
		if (!window.matchMedia) return;
		const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
		const onChange = () => setIsMobile(mq.matches);
		onChange();
		try {
			mq.addEventListener("change", onChange);
			return () => mq.removeEventListener("change", onChange);
		} catch {
			mq.addListener(onChange);
			return () => mq.removeListener(onChange);
		}
	}, [maxWidthPx]);

	return isMobile;
}

function uniqSorted(arr) {
	return Array.from(new Set((arr || []).map((x) => String(x || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function safeStr(v) {
	return String(v ?? "");
}

export default function People() {
	const orgId = getOrgId();

	const isMobile = useIsMobile(720);

	const [people, setPeople] = useState([]);
	const [q, setQ] = useState("");
	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState("");
	const [busyZk, setBusyZk] = useState(false);
	const [zkMsg, setZkMsg] = useState("");
	const [detailOpen, setDetailOpen] = useState(false);
	const [detailPerson, setDetailPerson] = useState(null);
	const [detailDraft, setDetailDraft] = useState({ name: "", role: "", phone: "", skills: "", notes: "" });

	// Controlled add form so it clears every time
	const [form, setForm] = useState({
		name: "",
		role: "",
		phone: "",
		skills: "",
		notes: "",
	});

	function openDetails(p) {
		setErr("");
		setZkMsg("");
		setDetailPerson(p);
		setDetailDraft({
			name: safeStr(p?.name).trim(),
			role: safeStr(p?.role).trim(),
			phone: safeStr(p?.phone).trim(),
			skills: safeStr(p?.skills).trim(),
			notes: safeStr(p?.notes).trim(),
		});
		setDetailOpen(true);
	}

	function closeDetails() {
		setDetailOpen(false);
		setDetailPerson(null);
	}

	async function refresh() {
		if (!orgId) return;
		setLoading(true);
		setErr("");
		try {
			const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/people`);
			const raw = Array.isArray(data.people) ? data.people : [];

			const orgKey = getCachedOrgKey(orgId);
			if (orgKey) {
				const out = [];
				for (const p of raw) {
					if (p?.encrypted_blob) {
						try {
							const dec = JSON.parse(await decryptWithOrgKey(orgKey, p.encrypted_blob));
							out.push({ ...p, ...dec });
							continue;
						} catch {
							out.push({ ...p, name: "(encrypted)", role: "", phone: "", skills: "", notes: "" });
							continue;
						}
					}
					out.push(p);
				}
				setPeople(out);
			} else {
				setPeople(raw);
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

	// datalist options to keep entries consistent (but not hard locked yet)
	const roleOptions = useMemo(() => uniqSorted(people.map((p) => p.role)), [people]);
	const skillsOptions = useMemo(() => {
		const all = [];
		for (const p of people) {
			const s = String(p?.skills || "");
			if (!s) continue;
			// allow comma separated
			s.split(",").forEach((x) => all.push(x.trim()));
		}
		return uniqSorted(all);
	}, [people]);

	const list = useMemo(() => {
		const needle = q.toLowerCase();
		return people.filter((p) =>
			[safeStr(p.name), safeStr(p.role), safeStr(p.skills), safeStr(p.phone), safeStr(p.notes)]
				.filter(Boolean)
				.join(" ")
				.toLowerCase()
				.includes(needle)
		);
	}, [people, q]);

	async function putPerson(id, patch) {
		if (!orgId || !id) return;

		const orgKey = getCachedOrgKey(orgId);
		let payload = { id, ...patch };
		if (orgKey) {
			const next = {
				name: safeStr(patch?.name).trim(),
				role: safeStr(patch?.role).trim(),
				phone: safeStr(patch?.phone).trim(),
				skills: safeStr(patch?.skills).trim(),
				notes: safeStr(patch?.notes).trim(),
			};
			const enc = await encryptWithOrgKey(orgKey, JSON.stringify(next));
			payload = { id, name: "__encrypted__", role: "", phone: "", skills: "", notes: "", encrypted_blob: enc };
		}

		await api(`/api/orgs/${encodeURIComponent(orgId)}/people`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		refresh().catch(console.error);
	}

	async function delPerson(id) {
		if (!orgId || !id) return;
		await api(`/api/orgs/${encodeURIComponent(orgId)}/people?id=${encodeURIComponent(id)}`, { method: "DELETE" });
		refresh().catch(console.error);
	}

	async function onAdd(e) {
		e.preventDefault();
		if (!orgId) return;

		setErr("");

		const name = safeStr(form.name).trim();
		if (!name) return;

		const role = safeStr(form.role).trim();
		const phone = safeStr(form.phone).trim();
		const skills = safeStr(form.skills).trim();
		const notes = safeStr(form.notes).trim();

		const orgKey = getCachedOrgKey(orgId);
		let payload = { name, role, phone, skills, notes };
		let optimistic = { name, role, phone, skills, notes };
		if (orgKey) {
			const enc = await encryptWithOrgKey(orgKey, JSON.stringify({ name, role, phone, skills, notes }));
			payload = { name: "__encrypted__", role: "", phone: "", skills: "", notes: "", encrypted_blob: enc };
			// Don't keep plaintext in state when ZK is on.
			optimistic = { name: "(encrypted)", role: "", phone: "", skills: "", notes: "" };
		}

		const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/people`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});

		if (data?.id) {
			setPeople((prev) => [{ id: data.id, ...optimistic }, ...prev]);
		}

		setForm({ name: "", role: "", phone: "", skills: "", notes: "" });
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
			const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/people`);
			const raw = Array.isArray(data.people) ? data.people : [];
			let changed = 0;
			for (const p of raw) {
				if (!p?.id) continue;
				if (p?.encrypted_blob) continue;
				// If it's already scrubbed, skip.
				if (String(p.name || "") === "__encrypted__") continue;
				const next = {
					name: safeStr(p.name).trim(),
					role: safeStr(p.role).trim(),
					phone: safeStr(p.phone).trim(),
					skills: safeStr(p.skills).trim(),
					notes: safeStr(p.notes).trim(),
				};
				const enc = await encryptWithOrgKey(orgKey, JSON.stringify(next));
				await api(`/api/orgs/${encodeURIComponent(orgId)}/people`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ id: p.id, name: "__encrypted__", role: "", phone: "", skills: "", notes: "", encrypted_blob: enc }),
				});
				changed++;
			}
			setZkMsg(changed ? `Encrypted ${changed} existing people records on the server.` : "Nothing to encrypt. (Everything already looks encrypted.)");
			await refresh();
		} catch (e) {
			console.error(e);
			setErr(e?.message || String(e));
		} finally {
			setBusyZk(false);
		}
	}

	const cellInputStyle = { width: "100%", minWidth: 0, boxSizing: "border-box" };

	const Field = ({ label, children }) => (
		<label style={{ display: "grid", gap: 6 }}>
			<span className="helper">{label}</span>
			{children}
		</label>
	);

	const Modal = ({ open, title, children, onClose }) => {
		if (!open) return null;
		return (
			<div
				role="dialog"
				aria-modal="true"
				onMouseDown={(e) => {
					if (e.target === e.currentTarget) onClose();
				}}
				style={{
					position: "fixed",
					inset: 0,
					background: "rgba(0,0,0,0.55)",
					display: "grid",
					placeItems: "center",
					padding: 16,
					zIndex: 50,
				}}
			>
				<div className="card" style={{ width: "min(720px, 100%)", padding: 16 }}>
					<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
						<h3 style={{ margin: 0, flex: 1 }}>{title}</h3>
						<button className="btn" type="button" onClick={onClose}>
							Close
						</button>
					</div>
					<div style={{ marginTop: 12 }}>{children}</div>
				</div>
			</div>
		);
	};

	return (
		<div>
			<div className="card" style={{ margin: 16 }}>
				<div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
					<h2 className="section-title" style={{ margin: 0, flex: 1, minWidth: 140 }}>
						People
					</h2>
					<button className="btn" style={{ whiteSpace: "nowrap" }} onClick={() => refresh().catch(console.error)} disabled={loading}>
						{loading ? "Loading" : "Refresh"}
					</button>
					<button className="btn" style={{ whiteSpace: "nowrap" }} onClick={() => encryptExisting().catch(console.error)} disabled={busyZk || loading}>
						{busyZk ? "Encrypting" : "Encrypt Existing"}
					</button>
				</div>

				{zkMsg ? <div className="helper" style={{ marginTop: 10 }}>{zkMsg}</div> : null}

				<input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, role, phone, skills" style={{ marginTop: 12 }} />

				{err ? (
					<div className="helper" style={{ color: "tomato", marginTop: 10 }}>
						{err}
					</div>
				) : null}

				{/* MOBILE: cards */}
				{isMobile ? (
					<div style={{ marginTop: 12, display: "grid", gap: 12 }}>
						{list.map((p) => (
							<div key={p.id} className="card" style={{ padding: 12 }}>
								<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
									<div style={{ fontWeight: 800, flex: 1, minWidth: 0 }}>{String(p.name || "Unnamed")}</div>
										<button className="btn" style={{ whiteSpace: "nowrap" }} type="button" onClick={() => openDetails(p)}>
											Details
										</button>
									<button className="btn" style={{ whiteSpace: "nowrap" }} type="button" onClick={() => delPerson(p.id).catch(console.error)}>
										Delete
									</button>
								</div>

									<div style={{ marginTop: 10, display: "grid", gap: 6 }}>
										<div className="helper">Role: {safeStr(p.role) || ""}</div>
										<div className="helper">Phone: {safeStr(p.phone) || ""}</div>
										<div className="helper">Skills: {safeStr(p.skills) || ""}</div>
									</div>
							</div>
						))}
					</div>
				) : (
					<div style={{ marginTop: 12, overflowX: "auto" }}>
						<table className="table" style={{ width: "100%" }}>
							<thead>
								<tr>
									<th style={{ minWidth: 160 }}>Name</th>
									<th style={{ minWidth: 140 }}>Role</th>
									<th style={{ minWidth: 140 }}>Phone</th>
									<th style={{ minWidth: 220 }}>Skills</th>
									<th style={{ width: 90 }} />
								</tr>
							</thead>
							<tbody>
								{list.map((p) => (
									<tr key={p.id}>
										<td>
											<input className="input" defaultValue={p.name || ""} style={cellInputStyle} onBlur={(e) => putPerson(p.id, { ...p, name: e.target.value }).catch(console.error)} />
										</td>
										<td>
											<input className="input" list="role_opts" defaultValue={p.role || ""} style={cellInputStyle} onBlur={(e) => putPerson(p.id, { ...p, role: e.target.value }).catch(console.error)} />
										</td>
										<td>
											<input className="input" defaultValue={p.phone || ""} style={cellInputStyle} onBlur={(e) => putPerson(p.id, { ...p, phone: e.target.value }).catch(console.error)} />
										</td>
										<td>
											<input className="input" list="skills_opts" defaultValue={p.skills || ""} style={cellInputStyle} onBlur={(e) => putPerson(p.id, { ...p, skills: e.target.value }).catch(console.error)} />
										</td>
										<td style={{ textAlign: "right" }}>
											<button className="btn" type="button" onClick={() => openDetails(p)} style={{ marginRight: 8 }}>
												Details
											</button>
											<button className="btn" type="button" onClick={() => delPerson(p.id).catch(console.error)}>
												Delete
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				<datalist id="role_opts">{roleOptions.map((x) => <option key={x} value={x} />)}</datalist>
				<datalist id="skills_opts">{skillsOptions.map((x) => <option key={x} value={x} />)}</datalist>
			</div>

			<div className="card" style={{ margin: 16, padding: 16 }}>
				<h3 style={{ marginTop: 0 }}>Add Person</h3>
				<form onSubmit={onAdd} style={{ display: "grid", gap: 10 }}>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
						<input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
						<input className="input" placeholder="Role" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} list="role_opts" />
						<input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
						<input className="input" placeholder="Skills" value={form.skills} onChange={(e) => setForm((p) => ({ ...p, skills: e.target.value }))} list="skills_opts" />
						<input className="input" placeholder="Notes (private)" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
					</div>
					<button className="btn-red" type="submit">Add</button>
				</form>
			</div>

			<Modal open={detailOpen} title="Person Details" onClose={() => closeDetails()}>
				{detailPerson ? (
					<div style={{ display: "grid", gap: 10 }}>
						<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
							<Field label="Name">
								<input className="input" value={detailDraft.name} onChange={(e) => setDetailDraft((d) => ({ ...d, name: e.target.value }))} />
							</Field>
							<Field label="Role">
								<input className="input" list="role_opts" value={detailDraft.role} onChange={(e) => setDetailDraft((d) => ({ ...d, role: e.target.value }))} />
							</Field>
							<Field label="Phone">
								<input className="input" value={detailDraft.phone} onChange={(e) => setDetailDraft((d) => ({ ...d, phone: e.target.value }))} />
							</Field>
							<Field label="Skills">
								<input className="input" list="skills_opts" value={detailDraft.skills} onChange={(e) => setDetailDraft((d) => ({ ...d, skills: e.target.value }))} />
							</Field>
						</div>
						<Field label="Notes">
							<textarea className="input" rows={5} value={detailDraft.notes} onChange={(e) => setDetailDraft((d) => ({ ...d, notes: e.target.value }))} />
						</Field>

						<div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
							<button
								className="btn"
								type="button"
								onClick={() => {
									if (!detailPerson?.id) return;
									putPerson(detailPerson.id, { ...detailPerson, ...detailDraft }).catch(console.error);
									closeDetails();
								}}
							>
								Save Changes
							</button>
							<button
								className="btn"
								type="button"
								onClick={() => {
									if (!detailPerson?.id) return;
									delPerson(detailPerson.id).catch(console.error);
									closeDetails();
								}}
							>
								Delete
							</button>
						</div>
					</div>
				) : null}
			</Modal>
		</div>
	);
}
