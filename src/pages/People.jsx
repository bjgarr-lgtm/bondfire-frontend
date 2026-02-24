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
								className="btn-red"
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
								className="btn-red"
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