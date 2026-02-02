// src/pages/Settings.jsx
import * as React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import PublicPage from "./PublicPage.jsx";

/* ---------- API helper ---------- */
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

function getToken() {
  return (
    localStorage.getItem("bf_auth_token") ||
    sessionStorage.getItem("bf_auth_token") ||
    ""
  );
}

async function authFetch(path, opts = {}) {
  const token = getToken();

  const relative = path.startsWith("/") ? path : `/${path}`;
  const remote = path.startsWith("http")
    ? path
    : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  const isSpecialEndpoint =
    /^\/api\/(orgs\/[^/]+\/(invites|members)|invites\/redeem)\b/.test(relative);

  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const doReq = async (u) => {
    const res = await fetch(u, {
      ...opts,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    let j = {};
    try {
      j = await res.json();
    } catch {
      j = {};
    }

    if (!res.ok || j.ok === false) {
      throw new Error(j.error || j.message || `HTTP ${res.status}`);
    }
    return j;
  };

  if (isSpecialEndpoint && API_BASE && remote !== relative) {
    try {
      return await doReq(relative);
    } catch {
      return await doReq(remote);
    }
  }

  try {
    return await doReq(remote);
  } catch (e) {
    const msg = String(e?.message || "");
    if (
      API_BASE &&
      !path.startsWith("http") &&
      (msg.includes("HTTP 404") || msg.includes("HTTP 500"))
    ) {
      return await doReq(relative);
    }
    throw e;
  }
}

/* ---------- local org settings helpers ---------- */
const orgSettingsKey = (orgId) => `bf_org_settings_${orgId}`;

const readJSON = (k, fallback = {}) => {
  try {
    return JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export default function Settings() {
  const { orgId } = useParams();

  /* ---------- Submenu tabs ---------- */
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = String(searchParams.get("tab") || "org").toLowerCase();

  const setTab = (next) => {
    const n = String(next || "org").toLowerCase();
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("tab", n);
        return p;
      },
      { replace: true }
    );
  };

  const tabs = React.useMemo(
    () => [
      ["org", "Organization"],
      ["invites", "Invites"],
      ["members", "Members"],
      ["public", "Public page"],
    ],
    []
  );

  /* ========== INVITES (backend) ========== */
  const [invites, setInvites] = React.useState([]);
  const [inviteMsg, setInviteMsg] = React.useState("");
  const [inviteBusy, setInviteBusy] = React.useState(false);

  const loadInvites = React.useCallback(async () => {
    if (!orgId) return;
    try {
      const r = await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/invites`, {
        method: "GET",
      });
      setInvites(Array.isArray(r.invites) ? r.invites : []);
      setInviteMsg("");
    } catch (e) {
      setInviteMsg(e.message || "Failed to load invites");
    }
  }, [orgId]);

  const createInvite = async () => {
    if (!orgId) return;
    setInviteBusy(true);
    setInviteMsg("");
    try {
      const r = await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/invites`, {
        method: "POST",
        body: { role: "member", expiresInDays: 14, maxUses: 1 },
      });

      if (r?.invite) {
        setInvites((prev) => [r.invite, ...prev]);
        setInviteMsg(`Invite created: ${r.invite.code}`);
      } else {
        await loadInvites();
        setInviteMsg("Invite created.");
      }
    } catch (e) {
      setInviteMsg(e.message || "Failed to create invite");
    } finally {
      setInviteBusy(false);
    }
  };

  const copyInvite = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setInviteMsg("Copied.");
      setTimeout(() => setInviteMsg(""), 900);
    } catch {
      setInviteMsg("Clipboard blocked. Copy it manually.");
    }
  };

  const deleteInvite = async (code) => {
    if (!orgId) return;
    const c = String(code || "").trim().toUpperCase();
    if (!c) return;

    const ok = confirm(`Delete invite ${c}?`);
    if (!ok) return;

    setInviteBusy(true);
    setInviteMsg("");
    try {
      await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/invites`, {
        method: "DELETE",
        body: { code: c },
      });
      setInvites((prev) =>
        prev.filter((x) => String(x.code || "").toUpperCase() !== c)
      );
      setInviteMsg("Deleted.");
      setTimeout(() => setInviteMsg(""), 900);
    } catch (e) {
      setInviteMsg(e.message || "Failed to delete invite");
    } finally {
      setInviteBusy(false);
    }
  };

  const deleteInactiveInvites = async () => {
    if (!orgId) return;

    const now = Date.now();
    const inactive = (invites || []).filter((inv) => {
      const uses = Number(inv.uses || 0);
      const max = Number(inv.max_uses || 0);
      const exp = inv.expires_at ? Number(inv.expires_at) : null;
      const exhausted = max > 0 && uses >= max;
      const expired = exp && now > exp;
      return exhausted || expired;
    });

    if (inactive.length === 0) {
      setInviteMsg("No used or expired invites to delete.");
      setTimeout(() => setInviteMsg(""), 900);
      return;
    }

    const ok = confirm(`Delete ${inactive.length} used or expired invites?`);
    if (!ok) return;

    setInviteBusy(true);
    setInviteMsg("");
    try {
      for (const inv of inactive) {
        const c = String(inv.code || "").trim().toUpperCase();
        if (!c) continue;
        await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/invites`, {
          method: "DELETE",
          body: { code: c },
        });
      }
      await loadInvites();
      setInviteMsg("Deleted used and expired invites.");
      setTimeout(() => setInviteMsg(""), 1200);
    } catch (e) {
      setInviteMsg(e.message || "Cleanup failed");
    } finally {
      setInviteBusy(false);
    }
  };

  /* ========== MEMBERS + ROLES (backend, admin only) ========== */
  const [members, setMembers] = React.useState([]);
  const [membersMsg, setMembersMsg] = React.useState("");
  const [membersAllowed, setMembersAllowed] = React.useState(false);
  const [membersBusy, setMembersBusy] = React.useState(false);

  const loadMembers = React.useCallback(async () => {
    if (!orgId) return;
    setMembersMsg("");
    try {
      const r = await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/members`, {
        method: "GET",
      });
      setMembers(Array.isArray(r.members) ? r.members : []);
      setMembersAllowed(true);
    } catch (e) {
      const msg = String(e?.message || "");
      if (msg.includes("INSUFFICIENT_ROLE") || msg.includes("NOT_A_MEMBER")) {
        setMembersAllowed(false);
        setMembers([]);
        setMembersMsg("");
      } else {
        setMembersAllowed(false);
        setMembers([]);
        setMembersMsg(msg || "Failed to load members");
      }
    }
  }, [orgId]);

  const setMemberRole = async (userId, nextRole, currentRole, email) => {
    if (!orgId) return;
    if (!userId) return;
    if (nextRole === currentRole) return;

    if (currentRole === "owner" && nextRole !== "owner") {
      const ok = confirm(`Demote owner ${email || userId} to ${nextRole}?`);
      if (!ok) return;
    }
    if (nextRole === "owner") {
      const ok = confirm(`Promote ${email || userId} to owner?`);
      if (!ok) return;
    }

    setMembersBusy(true);
    setMembersMsg("");
    try {
      await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/members`, {
        method: "PUT",
        body: { userId, role: nextRole },
      });
      setMembersMsg("Updated.");
      setTimeout(() => setMembersMsg(""), 900);
      await loadMembers();
    } catch (e) {
      setMembersMsg(e.message || "Failed to update role");
    } finally {
      setMembersBusy(false);
    }
  };

  const removeMember = async (userId, email) => {
    if (!orgId) return;
    if (!userId) return;

    const ok = confirm(`Remove ${email || userId} from this org?`);
    if (!ok) return;

    setMembersBusy(true);
    setMembersMsg("");
    try {
      await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/members`, {
        method: "DELETE",
        body: { userId },
      });
      setMembersMsg("Removed.");
      setTimeout(() => setMembersMsg(""), 900);
      await loadMembers();
    } catch (e) {
      setMembersMsg(e.message || "Failed to remove member");
    } finally {
      setMembersBusy(false);
    }
  };

  React.useEffect(() => {
    loadInvites();
    loadMembers();
  }, [loadInvites, loadMembers]);

  /* ========== ORG BASICS (local) ========== */
  const [orgName, setOrgName] = React.useState("");
  const [logoDataUrl, setLogoDataUrl] = React.useState(null);

  React.useEffect(() => {
    const s = readJSON(orgSettingsKey(orgId));
    if (s.name) setOrgName(s.name);
    if (s.logoDataUrl || s.logoUrl) setLogoDataUrl(s.logoDataUrl || s.logoUrl);
  }, [orgId]);

  const onLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const saveBasics = () => {
    const key = orgSettingsKey(orgId);
    const prev = readJSON(key);
    writeJSON(key, { ...prev, name: (orgName || "").trim(), logoDataUrl });
    window.dispatchEvent(
      new CustomEvent("bf:org_settings_changed", { detail: { orgId } })
    );
    alert("Organization settings saved.");
  };

  /* ========== PUBLIC PAGE (backend) ========== */
  const [enabled, setEnabled] = React.useState(false);
  const [slug, setSlug] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [about, setAbout] = React.useState("");
  const [features, setFeatures] = React.useState("");
  const [links, setLinks] = React.useState("");
  const [msg, setMsg] = React.useState("");

  const genSlug = async () => {
    setMsg("");
    try {
      const r = await authFetch(
        `/api/orgs/${encodeURIComponent(orgId)}/public/generate`,
        { method: "POST" }
      );
      setSlug(r.public?.slug || "");
      setMsg("Generated new link.");
      setTimeout(() => setMsg(""), 1200);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const savePublic = async (e) => {
    e?.preventDefault();
    setMsg("");
    try {
      const payload = {
        enabled,
        slug: (slug || "").trim(),
        title: (title || "").trim(),
        about: (about || "").trim(),
        features: (features || "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        links: (links || "")
          .split("\n")
          .map((line) => {
            const [text, url] = line.split("|").map((s) => (s || "").trim());
            return url ? { text: text || url, url } : null;
          })
          .filter(Boolean),
      };

      const r = await authFetch(
        `/api/orgs/${encodeURIComponent(orgId)}/public/save`,
        { method: "POST", body: payload }
      );

      setSlug(r.public?.slug || payload.slug);
      setTitle(r.public?.title ?? payload.title);
      setAbout(r.public?.about ?? payload.about);
      setFeatures(
        Array.isArray(r.public?.features) ? r.public.features.join("\n") : features
      );
      setLinks(
        Array.isArray(r.public?.links)
          ? r.public.links.map((l) => `${l.text || l.url} | ${l.url}`).join("\n")
          : links
      );
      setEnabled(!!r.public?.enabled);

      setMsg("Saved.");
      setTimeout(() => setMsg(""), 1200);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const publicUrl = slug ? `${location.origin}/#/p/${slug}` : "";

  return (
    <div className="grid" style={{ gap: 16, padding: 16 }}>
      {/* Submenu */}
      <div className="card" style={{ padding: 12 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {tabs.map(([key, label]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                className={active ? "btn-red" : "btn"}
                onClick={() => setTab(key)}
                style={{ padding: "8px 12px" }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Organization */}
      {tab === "org" && (
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Organization</h2>
          <div className="grid" style={{ gap: 10 }}>
            <label className="grid" style={{ gap: 6 }}>
              <span className="helper">Name</span>
              <input
                className="input"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Your org name"
              />
            </label>

            <label className="grid" style={{ gap: 6 }}>
              <span className="helper">Logo</span>
              <input
                className="input"
                type="file"
                accept="image/*"
                onChange={onLogo}
              />
              {logoDataUrl && (
                <img
                  src={logoDataUrl}
                  alt="Logo preview"
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 12,
                    objectFit: "cover",
                    marginTop: 8,
                  }}
                />
              )}
            </label>

            <div>
              <button className="btn-red" onClick={saveBasics}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invites */}
      {tab === "invites" && (
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Invites</h2>
          <p className="helper">Generate invite codes so someone can join this org.</p>

          <div
            className="row"
            style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}
          >
            <button className="btn-red" onClick={createInvite} disabled={inviteBusy}>
              {inviteBusy ? "Generating…" : "Generate invite"}
            </button>
            <button className="btn" type="button" onClick={loadInvites}>
              Refresh
            </button>
            <button
              className="btn"
              type="button"
              onClick={deleteInactiveInvites}
              disabled={inviteBusy}
            >
              Delete used and expired
            </button>

            {inviteMsg && (
              <span
                className={
                  inviteMsg.toLowerCase().includes("fail") ||
                  inviteMsg.toLowerCase().includes("http")
                    ? "error"
                    : "helper"
                }
              >
                {inviteMsg}
              </span>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            {invites.length === 0 ? (
              <div className="helper">No invites yet</div>
            ) : (
              <div className="grid" style={{ gap: 10 }}>
                {invites.map((inv) => (
                  <div
                    key={inv.code}
                    className="card"
                    style={{ padding: 12, border: "1px solid #222" }}
                  >
                    <div className="row" style={{ gap: 8, alignItems: "center" }}>
                      <code style={{ fontSize: 16 }}>{inv.code}</code>
                      <button className="btn" onClick={() => copyInvite(inv.code)}>
                        Copy
                      </button>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => deleteInvite(inv.code)}
                        disabled={inviteBusy}
                      >
                        Delete
                      </button>

                      <div className="helper" style={{ marginLeft: "auto" }}>
                        role: {inv.role || "member"} · uses: {inv.uses || 0}/
                        {inv.max_uses || 1}
                        {inv.expires_at
                          ? ` · expires: ${new Date(inv.expires_at).toLocaleDateString()}`
                          : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Members */}
      {tab === "members" && (
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Members and Roles</h2>

          {!membersAllowed ? (
            <div className="helper">
              Admins and owners can manage membership roles.
              {membersMsg ? (
                <div className="error" style={{ marginTop: 8 }}>
                  {membersMsg}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div
                className="row"
                style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}
              >
                <button
                  className="btn"
                  type="button"
                  onClick={loadMembers}
                  disabled={membersBusy}
                >
                  {membersBusy ? "Refreshing…" : "Refresh"}
                </button>
                {membersMsg ? (
                  <span
                    className={
                      membersMsg.toLowerCase().includes("fail") ? "error" : "helper"
                    }
                  >
                    {membersMsg}
                  </span>
                ) : null}
              </div>

              <div style={{ marginTop: 12 }}>
                {members.length === 0 ? (
                  <div className="helper">No members found.</div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Remove</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.userId}>
                          <td>
                            <code>{m.email || m.userId}</code>
                          </td>
                          <td>{m.name || ""}</td>
                          <td>
                            <select
                              className="input"
                              value={m.role || "member"}
                              onChange={(e) =>
                                setMemberRole(m.userId, e.target.value, m.role, m.email)
                              }
                              disabled={membersBusy}
                            >
                              <option value="viewer">viewer</option>
                              <option value="member">member</option>
                              <option value="admin">admin</option>
                              <option value="owner">owner</option>
                            </select>
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {m.role === "owner" ? (
                              <span className="helper">owner</span>
                            ) : (
                              <button
                                className="btn"
                                type="button"
                                onClick={() => removeMember(m.userId, m.email)}
                                disabled={membersBusy}
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Public Page */}
      {tab === "public" && (
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Public Page</h2>
          <p className="helper">
            Share a read-only page for your org. Only what you enable is shown.
          </p>

          <form
            onSubmit={savePublic}
            className="grid"
            style={{ gap: 10, marginTop: 8 }}
          >
            <label className="row" style={{ gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span>Enable public page</span>
            </label>

            <label className="grid" style={{ gap: 6 }}>
              <span className="helper">Share URL (slug)</span>
              <div className="row" style={{ gap: 8 }}>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g. bondfire-team"
                />
                <button
                  type="button"
                  className="btn"
                  onClick={genSlug}
                  title="Generate a nice slug"
                >
                  Generate
                </button>
              </div>

              {slug && (
                <div
                  className="row"
                  style={{ gap: 8, alignItems: "center", marginTop: 8 }}
                >
                  <span className="helper">Public link:</span>
                  <a
                    className="helper"
                    href={`/#/p/${encodeURIComponent(slug)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {publicUrl}
                  </a>
                </div>
              )}
            </label>

            <label className="grid" style={{ gap: 6 }}>
              <span className="helper">Title</span>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Public page title"
              />
            </label>

            <label className="grid" style={{ gap: 6 }}>
              <span className="helper">About</span>
              <textarea
                className="textarea"
                rows={3}
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Short description"
              />
            </label>

            <label className="grid" style={{ gap: 6 }}>
              <span className="helper">Features (one per line)</span>
              <textarea
                className="textarea"
                rows={3}
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                placeholder={"Donations tracker\nVolunteers\nEvents"}
              />
            </label>

            <label className="grid" style={{ gap: 6 }}>
              <span className="helper">Links (Text | URL per line)</span>
              <textarea
                className="textarea"
                rows={3}
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                placeholder={"Website | https://example.org\nTwitter | https://x.com/yourorg"}
              />
            </label>

            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              <button className="btn-red" type="submit">
                Save
              </button>
              {msg && (
                <span className={msg.includes("Saved") ? "success" : "error"}>
                  {msg}
                </span>
              )}
            </div>
          </form>

          {enabled && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ margin: "8px 0" }}>Preview</h3>
              <PublicPage
                data={{
                  public: {
                    title: (title || orgName || "Public page").trim(),
                    about: (about || "").trim(),
                    features: (features || "")
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                    links: (links || "")
                      .split("\n")
                      .map((line) => {
                        const [text, url] = line.split("|").map((s) => (s || "").trim());
                        return url ? { text: text || url, url } : null;
                      })
                      .filter(Boolean),
                  },
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
