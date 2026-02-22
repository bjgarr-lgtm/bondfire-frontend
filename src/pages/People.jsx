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
  return Array.from(
    new Set((arr || []).map((x) => String(x || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

export default function People() {
  const orgId = getOrgId();

  const [orgKeyVersion, setOrgKeyVersion] = useState(1);
  const isMobile = useIsMobile(720);

  const [people, setPeople] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Controlled add form so it clears every time
  const [form, setForm] = useState({
    name: "",
    role: "",
    phone: "",
    skills: "",
  });

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
							out.push({ ...p, name: "(encrypted)", role: "", phone: "", skills: "" });
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
      [p.name, p.role, p.skills, p.phone]
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
				name: String(patch?.name || "").trim(),
				role: String(patch?.role || "").trim(),
				phone: String(patch?.phone || "").trim(),
				skills: String(patch?.skills || "").trim(),
			};
			const enc = await encryptWithOrgKey(orgKey, JSON.stringify(next));
			payload = { id, name: "__encrypted__", role: "", phone: "", skills: "", encrypted_blob: enc };
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
    await api(
      `/api/orgs/${encodeURIComponent(orgId)}/people?id=${encodeURIComponent(id)}`,
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

    const role = String(form.role || "").trim();
    const phone = String(form.phone || "").trim();
    const skills = String(form.skills || "").trim();

		const orgKey = getCachedOrgKey(orgId);
		let payload = { name, role, phone, skills };
		if (orgKey) {
			const enc = await encryptWithOrgKey(orgKey, JSON.stringify({ name, role, phone, skills }));
			payload = { name: "__encrypted__", role: "", phone: "", skills: "", encrypted_blob: enc };
		}

		const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
    });

    if (data?.id) {
      setPeople((prev) => [{ id: data.id, name, role, phone, skills }, ...prev]);
    }

    // Clear inputs immediately and reliably
    setForm({ name: "", role: "", phone: "", skills: "" });

    setTimeout(() => refresh().catch(console.error), 500);
  }

  const cellInputStyle = { width: "100%", minWidth: 0, boxSizing: "border-box" };

  const Field = ({ label, children }) => (
    <label style={{ display: "grid", gap: 6 }}>
      <span className="helper">{label}</span>
      {children}
    </label>
  );

  return (
    <div>
      <div className="card" style={{ margin: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 className="section-title" style={{ margin: 0, flex: 1, minWidth: 140 }}>
            People
          </h2>
          <button
            className="btn"
            style={{ whiteSpace: "nowrap" }}
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
          placeholder="Search by name, role, phone, skills"
          style={{ marginTop: 12 }}
        />

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
                  <div style={{ fontWeight: 800, flex: 1, minWidth: 0 }}>
                    {String(p.name || "Unnamed")}
                  </div>
                  <button
                    className="btn"
                    style={{ whiteSpace: "nowrap" }}
                    type="button"
                    onClick={() => delPerson(p.id).catch(console.error)}
                  >
                    Delete
                  </button>
                </div>

                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  <Field label="Name">
                    <input
                      className="input"
                      defaultValue={p.name || ""}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        const v = String(e.target.value || "").trim();
                        if (v !== String(p.name || "")) putPerson(p.id, { name: v }).catch(console.error);
                      }}
                    />
                  </Field>

                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                    <Field label="Role">
                      <input
                        className="input"
                        list="bf_people_roles"
                        defaultValue={p.role || ""}
                        style={cellInputStyle}
                        onBlur={(e) => {
                          const v = String(e.target.value || "").trim();
                          if (v !== String(p.role || "")) putPerson(p.id, { role: v }).catch(console.error);
                        }}
                      />
                    </Field>

                    <Field label="Phone">
                      <input
                        className="input"
                        type="tel"
                        inputMode="tel"
                        placeholder="555-555-5555"
                        defaultValue={p.phone || ""}
                        style={cellInputStyle}
                        onBlur={(e) => {
                          const v = String(e.target.value || "").trim();
                          if (v !== String(p.phone || "")) putPerson(p.id, { phone: v }).catch(console.error);
                        }}
                      />
                    </Field>
                  </div>

                  <Field label="Skills">
                    <input
                      className="input"
                      list="bf_people_skills"
                      defaultValue={p.skills || ""}
                      style={cellInputStyle}
                      onBlur={(e) => {
                        const v = String(e.target.value || "").trim();
                        if (v !== String(p.skills || "")) putPerson(p.id, { skills: v }).catch(console.error);
                      }}
                    />
                  </Field>
                </div>
              </div>
            ))}

            {list.length === 0 ? <div className="helper">No people match.</div> : null}

            <datalist id="bf_people_roles">
              {roleOptions.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>

            <datalist id="bf_people_skills">
              {skillsOptions.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>
        ) : (
          /* DESKTOP: keep table */
          <div style={{ marginTop: 12, overflowX: "auto", paddingRight: 16 }}>
            <table className="table" style={{ width: "100%", tableLayout: "fixed", minWidth: 860 }}>
              <thead>
                <tr>
                  <th style={{ width: "22%", whiteSpace: "nowrap", wordBreak: "normal" }}>Name</th>
                  <th style={{ width: "18%", whiteSpace: "nowrap", wordBreak: "normal" }}>Role</th>
                  <th style={{ width: "18%", whiteSpace: "nowrap", wordBreak: "normal" }}>Phone</th>
                  <th style={{ width: "32%", whiteSpace: "nowrap", wordBreak: "normal" }}>Skills</th>
                  <th style={{ width: "10%" }} />
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input
                        className="input"
                        defaultValue={p.name || ""}
                        style={cellInputStyle}
                        onBlur={(e) => {
                          const v = String(e.target.value || "").trim();
                          if (v !== String(p.name || "")) putPerson(p.id, { name: v }).catch(console.error);
                        }}
                      />
                    </td>

                    <td>
                      <input
                        className="input"
                        list="bf_people_roles"
                        defaultValue={p.role || ""}
                        style={cellInputStyle}
                        onBlur={(e) => {
                          const v = String(e.target.value || "").trim();
                          if (v !== String(p.role || "")) putPerson(p.id, { role: v }).catch(console.error);
                        }}
                      />
                    </td>

                    <td>
                      <input
                        className="input"
                        type="tel"
                        inputMode="tel"
                        placeholder="555-555-5555"
                        defaultValue={p.phone || ""}
                        style={cellInputStyle}
                        onBlur={(e) => {
                          const v = String(e.target.value || "").trim();
                          if (v !== String(p.phone || "")) putPerson(p.id, { phone: v }).catch(console.error);
                        }}
                      />
                    </td>

                    <td>
                      <input
                        className="input"
                        list="bf_people_skills"
                        defaultValue={p.skills || ""}
                        style={cellInputStyle}
                        onBlur={(e) => {
                          const v = String(e.target.value || "").trim();
                          if (v !== String(p.skills || "")) putPerson(p.id, { skills: v }).catch(console.error);
                        }}
                      />
                    </td>

                    <td>
                      <button className="btn" style={{ whiteSpace: "nowrap" }} onClick={() => delPerson(p.id).catch(console.error)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}

                {list.length === 0 && (
                  <tr>
                    <td colSpan={5} className="helper">
                      No people match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <datalist id="bf_people_roles">
              {roleOptions.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>

            <datalist id="bf_people_skills">
              {skillsOptions.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>
        )}

        <form
          onSubmit={onAdd}
          className="grid cols-3"
          style={{
            marginTop: 12,
            gap: 10,
            ...(isMobile ? { gridTemplateColumns: "1fr" } : null),
          }}
        >
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
            name="role"
            placeholder="Role"
            list="bf_people_roles"
            value={form.role}
            onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
          />

          <input
            className="input"
            name="phone"
            placeholder="Phone"
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          />

          <input
            className="input"
            name="skills"
            placeholder="Skills (comma separated)"
            list="bf_people_skills"
            value={form.skills}
            onChange={(e) => setForm((p) => ({ ...p, skills: e.target.value }))}
          />

          <div />
          <div />
          <button className="btn">Add Person</button>
        </form>
      </div>
    </div>
  );
}
