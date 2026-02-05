// src/pages/Settings.jsx
import * as React from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import PublicPage from "./PublicPage.jsx";

function useMediaQuery(query) {
  const get = () => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  };
  const [matches, setMatches] = React.useState(get);
  React.useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    if (m.addEventListener) m.addEventListener("change", onChange);
    else m.addListener(onChange);
    return () => {
      if (m.removeEventListener) m.removeEventListener("change", onChange);
      else m.removeListener(onChange);
    };
  }, [query]);
  return matches;
}

/* ---------- API helper ---------- */
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

function getToken() {
  return (
    localStorage.getItem("bf_auth_token") ||
    sessionStorage.getItem("bf_auth_token") ||
    ""
  );
}

function humanizeError(msg) {
  const s = String(msg || "").trim();
  if (!s) return "";
  if (s === "NOT_A_MEMBER") return "You must be a member of this org to do that.";
  if (s === "INSUFFICIENT_ROLE") return "You do not have permission for that action.";
  return s;
}


async function authFetch(path, opts = {}) {
  const token = getToken();

  const relative = path.startsWith("/") ? path : `/${path}`;
  const remote = path.startsWith("http")
    ? path
    : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  // These endpoints often live on same origin Pages Functions while API_BASE points elsewhere.
  const isSpecialEndpoint =
    /^\/api\/(orgs\/[^/]+\/(invites|members|newsletter|pledges)|invites\/redeem)\b/.test(
      relative
    );

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

function safeMailto(s) {
  return encodeURIComponent(String(s || ""));
}


export default function Settings() {
  const { orgId } = useParams();
  const isMobile = useMediaQuery("(max-width: 860px)");

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
      ["newsletter", "Newsletter"],
      ["pledges", "Pledges"],
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
  const [publicNewsletterEnabled, setPublicNewsletterEnabled] = React.useState(false);
  const [publicPledgesEnabled, setPublicPledgesEnabled] = React.useState(false);
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

const loadPublic = React.useCallback(async () => {
  if (!orgId) return;
  setMsg("");
  try {
    const r = await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/public/get`, {
      method: "GET",
    });

    const pub = r.public || {};
    setEnabled(!!pub.enabled);
    setPublicNewsletterEnabled(!!pub.newsletter_enabled);
    setPublicPledgesEnabled(!!pub.pledges_enabled);
    setSlug(String(pub.slug || ""));
    setTitle(String(pub.title || ""));
    setAbout(String(pub.about || ""));
    setFeatures(Array.isArray(pub.features) ? pub.features.join("\n") : "");
    setLinks(
      Array.isArray(pub.links)
        ? pub.links.map((l) => `${l.text || l.url} | ${l.url}`).join("\n")
        : ""
    );
  } catch (e) {
    setMsg(e.message || "Failed to load public settings");
  }
}, [orgId]);

React.useEffect(() => {
  if (tab === "public") {
    loadPublic();
  }
}, [tab, loadPublic]);


  const savePublic = async (e) => {
    e?.preventDefault();
    setMsg("");
    try {
      const payload = {
        enabled,
        newsletter_enabled: !!publicNewsletterEnabled,
        pledges_enabled: !!publicPledgesEnabled,
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
      setPublicNewsletterEnabled(!!r.public?.newsletter_enabled);
      setPublicPledgesEnabled(!!r.public?.pledges_enabled);
      setMsg("Saved.");
      setTimeout(() => setMsg(""), 1200);
    } catch (e) {
      setMsg(e.message);
    }
  };

  const publicUrl = slug ? `${location.origin}/#/p/${slug}` : "";

  /* ========== NEWSLETTER (backend, Riseup sends) ========== */
  const [nlEnabled, setNlEnabled] = React.useState(false);
  const [nlListAddress, setNlListAddress] = React.useState("");
  const [nlBlurb, setNlBlurb] = React.useState("");
  const [nlMsg, setNlMsg] = React.useState("");
  const [nlBusy, setNlBusy] = React.useState(false);
  const [subscribers, setSubscribers] = React.useState([]);
  const exportSubscribersCsv = async () => {
    if (!orgId) return;

    setNlMsg("");
    setNlBusy(true);

    try {
      const token = getToken();
      const path = `/api/orgs/${encodeURIComponent(orgId)}/newsletter/subscribers?format=csv`;

      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      // Same origin first (Pages Functions), then API_BASE
      let res = await fetch(path, { method: "GET", headers });
      if (!res.ok && API_BASE) {
        res = await fetch(`${API_BASE}${path}`, { method: "GET", headers });
      }

      if (!res.ok) {
        // backend might return JSON errors sometimes
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || j.message || `HTTP ${res.status}`);
        }
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }

      const blob = await res.blob();

      // Try to use server filename if present
      const dispo = res.headers.get("content-disposition") || "";
      const m = dispo.match(/filename="([^"]+)"/i);
      const filename = m?.[1] || `subscribers-${orgId}.csv`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setNlMsg("Exported.");
      setTimeout(() => setNlMsg(""), 1200);
    } catch (e) {
      setNlMsg(e?.message || "Export failed");
    } finally {
      setNlBusy(false);
    }
  };

  const loadNewsletter = React.useCallback(async () => {
    if (!orgId) return;
    setNlMsg("");
    setNlBusy(true);
    try {
      const r = await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/newsletter`, {
        method: "GET",
      });
      const cfg = r?.newsletter || r?.settings || r || {};
      setNlListAddress(String(cfg.list_address || cfg.listAddress || ""));
      setNlBlurb(String(cfg.blurb || ""));
    } catch (e) {
      setNlMsg(e.message || "Failed to load newsletter settings");
    } finally {
      setNlBusy(false);
    }
  }, [orgId]);

  const loadSubscribers = React.useCallback(async () => {
    if (!orgId) return;
    setNlMsg("");
    setNlBusy(true);
    try {
      const r = await authFetch(
        `/api/orgs/${encodeURIComponent(orgId)}/newsletter/subscribers`,
        { method: "GET" }
      );
      setSubscribers(Array.isArray(r.subscribers) ? r.subscribers : []);
    } catch (e) {
      setSubscribers([]);
      setNlMsg(e.message || "Failed to load subscribers");
    } finally {
      setNlBusy(false);
    }
  }, [orgId]);

  const saveNewsletter = async () => {
    if (!orgId) return;
    setNlMsg("");
    setNlBusy(true);
    try {
      await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/newsletter`, {
        method: "PUT",
      });
      setNlMsg("Saved.");
      setTimeout(() => setNlMsg(""), 1200);
    } catch (e) {
      setNlMsg(e.message || "Failed to save newsletter settings");
    } finally {
      setNlBusy(false);
    }
  };

  React.useEffect(() => {
    if (tab === "newsletter") {
      loadNewsletter();
      loadSubscribers();
    }
  }, [tab, loadNewsletter, loadSubscribers]);

  const csvHref = orgId
    ? `/#/org/${encodeURIComponent(orgId)}/settings?tab=newsletter`
    : "";

  const csvDownloadUrl = orgId
    ? `/api/orgs/${encodeURIComponent(orgId)}/newsletter/subscribers?format=csv`
    : "";

  const openRiseupDraft = () => {
    const to = (nlListAddress || "").trim();
    if (!to) {
      setNlMsg("Set a Riseup list address first.");
      setTimeout(() => setNlMsg(""), 1400);
      return;
    }
    const subject = `${orgName || "Bondfire"} newsletter`;
    const body =
      (nlBlurb ? `${nlBlurb}\n\n` : "") +
      `Hello,\n\n` +
      `Here is the latest update.\n\n` +
      `Needs:\n- \n\n` +
      `Pledges:\n- \n\n` +
      `Thanks,\n${orgName || ""}`;

    const href = `mailto:${safeMailto(to)}?subject=${safeMailto(subject)}&body=${safeMailto(
      body
    )}`;
    window.location.href = href;
  };

  /* ========== PLEDGES (backend) ========== */
  const [pledges, setPledges] = React.useState([]);
  const [pledgesMsg, setPledgesMsg] = React.useState("");
  const [pledgesBusy, setPledgesBusy] = React.useState(false);

  const [needs, setNeeds] = React.useState([]);

  const loadNeedsForPledges = React.useCallback(async () => {
    if (!orgId) return;
    try {
      const r = await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/needs`, {
        method: "GET",
      });
      setNeeds(Array.isArray(r.needs) ? r.needs : []);
    } catch {
      setNeeds([]);
    }
  }, [orgId]);

  const loadPledges = React.useCallback(async () => {
    if (!orgId) return;
    setPledgesMsg("");
    setPledgesBusy(true);
    try {
      const r = await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/pledges`, {
        method: "GET",
      });
      setPledges(Array.isArray(r.pledges) ? r.pledges : []);
    } catch (e) {
      setPledges([]);
      setPledgesMsg(e.message || "Failed to load pledges");
    } finally {
      setPledgesBusy(false);
    }
  }, [orgId]);

  React.useEffect(() => {
    if (tab === "pledges") {
      loadNeedsForPledges();
      loadPledges();
    }
  }, [tab, loadNeedsForPledges, loadPledges]);

  const upsertPledge = async (id, patch) => {
    if (!orgId) return;
    setPledgesMsg("");
    setPledgesBusy(true);
    try {
      await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/pledges`, {
        method: "PUT",
        body: { id, ...patch },
      });
      await loadPledges();
      setPledgesMsg("Saved.");
      setTimeout(() => setPledgesMsg(""), 900);
    } catch (e) {
      setPledgesMsg(e.message || "Failed to save pledge");
    } finally {
      setPledgesBusy(false);
    }
  };

  const deletePledge = async (id) => {
    if (!orgId) return;
    const ok = confirm("Delete this pledge?");
    if (!ok) return;
    setPledgesMsg("");
    setPledgesBusy(true);
    try {
      await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/pledges`, {
        method: "DELETE",
        body: { id },
      });
      await loadPledges();
      setPledgesMsg("Deleted.");
      setTimeout(() => setPledgesMsg(""), 900);
    } catch (e) {
      setPledgesMsg(e.message || "Failed to delete pledge");
    } finally {
      setPledgesBusy(false);
    }
  };

  const onAddPledge = async (e) => {
    e.preventDefault();
    if (!orgId) return;

    const f = new FormData(e.currentTarget);

    const payload = {
      pledger_name: String(f.get("pledger_name") || "").trim(),
      pledger_email: String(f.get("pledger_email") || "").trim(),
      type: String(f.get("type") || "").trim(),
      amount: String(f.get("amount") || "").trim(),
      unit: String(f.get("unit") || "").trim(),
      note: String(f.get("note") || "").trim(),
      status: String(f.get("status") || "offered").trim(),
      need_id: String(f.get("need_id") || "").trim() || null,
      is_public: String(f.get("is_public") || "") === "on",
    };

    setPledgesMsg("");
    setPledgesBusy(true);
    try {
      await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/pledges`, {
        method: "POST",
        body: payload,
      });
      e.currentTarget.reset();
      await loadPledges();
      setPledgesMsg("Added.");
      setTimeout(() => setPledgesMsg(""), 900);
    } catch (err) {
      setPledgesMsg(err.message || "Failed to add pledge");
    } finally {
      setPledgesBusy(false);
    }
  };

  const needTitleById = React.useMemo(() => {
    const m = new Map();
    for (const n of needs) m.set(String(n.id), String(n.title || ""));
    return m;
  }, [needs]);

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
              <input className="input" type="file" accept="image/*" onChange={onLogo} />
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

          <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn-red" onClick={createInvite} disabled={inviteBusy}>
              {inviteBusy ? "Generating…" : "Generate invite"}
            </button>
            <button className="btn" type="button" onClick={loadInvites}>
              Refresh
            </button>
            <button className="btn" type="button" onClick={deleteInactiveInvites} disabled={inviteBusy}>
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
                  <div key={inv.code} className="card" style={{ padding: 12, border: "1px solid #222" }}>
                    <div className="row" style={{ gap: 8, alignItems: "center" }}>
                      <code style={{ fontSize: 16 }}>{inv.code}</code>
                      <button className="btn" onClick={() => copyInvite(inv.code)}>
                        Copy
                      </button>
                      <button className="btn" type="button" onClick={() => deleteInvite(inv.code)} disabled={inviteBusy}>
                        Delete
                      </button>

                      <div className="helper" style={{ marginLeft: "auto" }}>
                        role: {inv.role || "member"} · uses: {inv.uses || 0}/{inv.max_uses || 1}
                        {inv.expires_at ? ` · expires: ${new Date(inv.expires_at).toLocaleDateString()}` : ""}
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
              <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button className="btn" type="button" onClick={loadMembers} disabled={membersBusy}>
                  {membersBusy ? "Refreshing…" : "Refresh"}
                </button>
                {membersMsg ? (
                  <span className={membersMsg.toLowerCase().includes("fail") ? "error" : "helper"}>
                    {membersMsg}
                  </span>
                ) : null}
              </div>

              <div style={{ marginTop: 12 }}>
                {members.length === 0 ? (
                  <div className="helper">No members found.</div>
                ) : (
                  isMobile ? (
                    <div className="bf-mobileCards">
                      {members.map((m) => (
                        <div key={m.userId} className="card bf-mobileCard">
                          <div className="bf-mobileCardTop">
                            <div>
                              <div style={{ fontWeight: 800 }}>{m.name || ""}</div>
                              <div className="helper" style={{ marginTop: 2 }}>
                                <code>{m.email || m.userId}</code>
                              </div>
                            </div>
                            <div>
                              <select
                                className="input"
                                value={m.role || "member"}
                                onChange={(e) => setMemberRole(m.userId, e.target.value, m.role, m.email)}
                                disabled={membersBusy}
                              >
                                <option value="viewer">viewer</option>
                                <option value="member">member</option>
                                <option value="admin">admin</option>
                                <option value="owner">owner</option>
                              </select>
                            </div>
                          </div>
                          <div className="bf-mobileCardActions">
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
                          </div>
                        </div>
                      ))}
                    </div>
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
                                onChange={(e) => setMemberRole(m.userId, e.target.value, m.role, m.email)}
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
                                <button className="btn" type="button" onClick={() => removeMember(m.userId, m.email)} disabled={membersBusy}>
                                  Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
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
          <p className="helper">Share a read-only page for your org. Only what you enable is shown.</p>

          <form onSubmit={savePublic} className="grid" style={{ gap: 10, marginTop: 8 }}>
            <label className="row" style={{ gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              <span>Enable public page</span>
            </label>

            <label className="row" style={{ gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={publicNewsletterEnabled}
                onChange={(e) => setPublicNewsletterEnabled(e.target.checked)}
              />
              <span>Enable newsletter signup on public page</span>
            </label>

            <label className="row" style={{ gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={publicPledgesEnabled}
                onChange={(e) => setPublicPledgesEnabled(e.target.checked)}
              />
              <span>Enable pledges on public page</span>
            </label>


            <label className="grid" style={{ gap: 6 }}>
              <span className="helper">Share URL (slug)</span>
              <div className="row" style={{ gap: 8 }}>
                <input className="input" style={{ flex: 1 }} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. bondfire-team" />
                <button type="button" className="btn" onClick={genSlug} title="Generate a nice slug">
                  Generate
                </button>
              </div>

              {slug && (
                <div className="row" style={{ gap: 8, alignItems: "center", marginTop: 8 }}>
                  <span className="helper">Public link:</span>
                  <a className="helper" href={`/#/p/${encodeURIComponent(slug)}`} target="_blank" rel="noreferrer">
                    {publicUrl}
                  </a>
                </div>
              )}
            </label>

            <label className="grid" style={{ gap: 6 }}>
              <span className="helper">Title</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Public page title" />
            </label>

            <label className="grid" style={{ gap: 6 }}>
              <span className="helper">About</span>
              <textarea className="textarea" rows={3} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Short description" />
            </label>

            <label className="grid" style={{ gap: 6 }}>
              <span className="helper">Features (one per line)</span>
              <textarea className="textarea" rows={3} value={features} onChange={(e) => setFeatures(e.target.value)} placeholder={"Donations tracker\nVolunteers\nEvents"} />
            </label>

            <label className="grid" style={{ gap: 6 }}>
              <span className="helper">Links (Text | URL per line)</span>
              <textarea className="textarea" rows={3} value={links} onChange={(e) => setLinks(e.target.value)} placeholder={"Website | https://example.org\nTwitter | https://x.com/yourorg"} />
            </label>

            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              <button className="btn-red" type="submit">
                Save
              </button>
              {msg && <span className={msg.includes("Saved") ? "success" : "error"}>{msg}</span>}
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
                    newsletter_enabled: !!publicNewsletterEnabled,
                    pledges_enabled: !!publicPledgesEnabled,
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

      {/* Newsletter */}
      {tab === "newsletter" && (
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Newsletter</h2>
          <div className="helper">
            Bondfire stores subscribers. Riseup sends the newsletter.
          </div>

          <div className="grid" style={{ gap: 10, marginTop: 10 }}>

            <label className="grid" style={{ gap: 6 }}>
              <span className="helper">Riseup list address</span>
              <input
                className="input"
                value={nlListAddress}
                onChange={(e) => setNlListAddress(e.target.value)}
                placeholder="example-list@riseup.net"
              />
            </label>

            <label className="grid" style={{ gap: 6 }}>
              <span className="helper">Default blurb</span>
              <textarea
                className="textarea"
                rows={3}
                value={nlBlurb}
                onChange={(e) => setNlBlurb(e.target.value)}
                placeholder="One paragraph you usually include at the top."
              />
            </label>

            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn-red" type="button" onClick={saveNewsletter} disabled={nlBusy}>
                {nlBusy ? "Saving…" : "Save"}
              </button>
              <button className="btn" type="button" onClick={openRiseupDraft}>
                Open email draft
              </button>
              <button className="btn" type="button" onClick={() => loadSubscribers()} disabled={nlBusy}>
                Refresh subscribers
              </button>

              <button className="btn" type="button" onClick={() => exportSubscribersCsv().catch(console.error)} disabled={nlBusy}>
                Export CSV
              </button>





              {nlMsg && <span className={nlMsg.toLowerCase().includes("fail") ? "error" : "helper"}>{nlMsg}</span>}
            </div>

            <div className="card" style={{ padding: 12, border: "1px solid #222" }}>
              <h3 style={{ marginTop: 0 }}>Subscribers</h3>
              {subscribers.length === 0 ? (
                <div className="helper">No subscribers yet.</div>
              ) : (
                isMobile ? (
                  <div className="grid" style={{ gap: 10 }}>
                    {subscribers.slice(0, 200).map((s) => (
                      <div key={s.id || s.email} className="card" style={{ padding: 12, border: "1px solid #222" }}>
                        <div className="row" style={{ justifyContent: "space-between", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                          <code style={{ fontSize: 14, wordBreak: "break-all" }}>{s.email || ""}</code>
                          {s.created_at ? (
                            <span className="helper">{new Date(s.created_at).toLocaleString()}</span>
                          ) : null}
                        </div>
                        {s.name ? <div style={{ marginTop: 6 }}>{s.name}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Name</th>
                        <th>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscribers.slice(0, 200).map((s) => (
                        <tr key={s.id || s.email}>
                          <td>
                            <code>{s.email}</code>
                          </td>
                          <td>{s.name || ""}</td>
                          <td>{s.created_at ? new Date(s.created_at).toLocaleString() : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
              {subscribers.length > 200 ? (
                <div className="helper" style={{ marginTop: 8 }}>
                  Showing first 200. Use Export CSV for the full list.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Pledges */}
      {tab === "pledges" && (
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Pledges</h2>

          <div className="helper" style={{ marginTop: 6 }}>
            Pledges can be linked to a Need for tracking.
          </div>

          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
            <button className="btn" type="button" onClick={() => loadPledges()} disabled={pledgesBusy}>
              {pledgesBusy ? "Loading…" : "Refresh"}
            </button>
            <Link className="btn" to={`/org/${encodeURIComponent(orgId)}/needs`}>
              Go to Needs
            </Link>
            {pledgesMsg && <span className={pledgesMsg.toLowerCase().includes("fail") ? "error" : "helper"}>{pledgesMsg}</span>}
          </div>

          <div style={{ marginTop: 12 }}>
            {pledges.length === 0 ? (
              <div className="helper">No pledges yet.</div>
            ) : (
              isMobile ? (
                <div className="grid" style={{ gap: 10 }}>
                  {pledges.map((p) => (
                    <div key={p.id} className="card" style={{ padding: 12, border: "1px solid #222" }}>
                      <div className="row" style={{ justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 800 }}>{p.pledger_name || "(unknown)"}</div>
                        {p.pledger_email ? <code>{p.pledger_email}</code> : null}
                      </div>

                      <div className="grid" style={{ gap: 8, marginTop: 10 }}>
                        <label className="grid" style={{ gap: 6 }}>
                          <span className="helper">Need</span>
                          <select
                            className="input"
                            value={p.need_id || ""}
                            onChange={(e) => upsertPledge(p.id, { need_id: e.target.value || null })}
                            disabled={pledgesBusy}
                          >
                            <option value="">unassigned</option>
                            {needs.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.title || n.id}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="grid" style={{ gap: 6 }}>
                          <span className="helper">Type</span>
                          <input
                            className="input"
                            defaultValue={p.type || ""}
                            onBlur={(e) => {
                              const v = String(e.target.value || "");
                              if (v !== String(p.type || "")) upsertPledge(p.id, { type: v });
                            }}
                            disabled={pledgesBusy}
                          />
                        </label>

                        <div className="grid cols-2" style={{ gap: 10 }}>
                          <label className="grid" style={{ gap: 6 }}>
                            <span className="helper">Amount</span>
                            <input
                              className="input"
                              defaultValue={p.amount || ""}
                              onBlur={(e) => {
                                const v = String(e.target.value || "");
                                if (v !== String(p.amount || "")) upsertPledge(p.id, { amount: v });
                              }}
                              disabled={pledgesBusy}
                            />
                          </label>
                          <label className="grid" style={{ gap: 6 }}>
                            <span className="helper">Unit</span>
                            <input
                              className="input"
                              defaultValue={p.unit || ""}
                              onBlur={(e) => {
                                const v = String(e.target.value || "");
                                if (v !== String(p.unit || "")) upsertPledge(p.id, { unit: v });
                              }}
                              disabled={pledgesBusy}
                            />
                          </label>
                        </div>

                        <label className="grid" style={{ gap: 6 }}>
                          <span className="helper">Status</span>
                          <select
                            className="input"
                            value={p.status || "offered"}
                            onChange={(e) => upsertPledge(p.id, { status: e.target.value })}
                            disabled={pledgesBusy}
                          >
                            <option value="offered">offered</option>
                            <option value="accepted">accepted</option>
                            <option value="fulfilled">fulfilled</option>
                            <option value="cancelled">cancelled</option>
                          </select>
                        </label>

                        <div>
                          <button className="btn" type="button" onClick={() => deletePledge(p.id)} disabled={pledgesBusy}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="table pledges-table">
                    <thead>
                      <tr>
                        <th>Pledger</th>
                        <th>Email</th>
                        <th>Need</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Unit</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {pledges.map((p) => (
                        <tr key={p.id}>
                          <td>{p.pledger_name || ""}</td>
                          <td>
                            <code>{p.pledger_email || ""}</code>
                          </td>
                          <td>
                            <select
                              className="input"
                              value={p.need_id || ""}
                              onChange={(e) => upsertPledge(p.id, { need_id: e.target.value || null })}
                              disabled={pledgesBusy}
                            >
                              <option value="">unassigned</option>
                              {needs.map((n) => (
                                <option key={n.id} value={n.id}>
                                  {n.title || n.id}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="input"
                              defaultValue={p.type || ""}
                              onBlur={(e) => {
                                const v = String(e.target.value || "");
                                if (v !== String(p.type || "")) upsertPledge(p.id, { type: v });
                              }}
                              disabled={pledgesBusy}
                            />
                          </td>
                          <td>
                            <input
                              className="input"
                              defaultValue={p.amount || ""}
                              onBlur={(e) => {
                                const v = String(e.target.value || "");
                                if (v !== String(p.amount || "")) upsertPledge(p.id, { amount: v });
                              }}
                              disabled={pledgesBusy}
                            />
                          </td>
                          <td>
                            <input
                              className="input"
                              defaultValue={p.unit || ""}
                              onBlur={(e) => {
                                const v = String(e.target.value || "");
                                if (v !== String(p.unit || "")) upsertPledge(p.id, { unit: v });
                              }}
                              disabled={pledgesBusy}
                            />
                          </td>
                          <td>
                            <select
                              className="input"
                              value={p.status || "offered"}
                              onChange={(e) => upsertPledge(p.id, { status: e.target.value })}
                              disabled={pledgesBusy}
                            >
                              <option value="offered">offered</option>
                              <option value="accepted">accepted</option>
                              <option value="fulfilled">fulfilled</option>
                              <option value="cancelled">cancelled</option>
                            </select>
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <button className="btn" type="button" onClick={() => deletePledge(p.id)} disabled={pledgesBusy}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>

          <div className="card" style={{ padding: 12, border: "1px solid #222", marginTop: 14 }}>
            <h3 style={{ marginTop: 0 }}>Add pledge</h3>
            <form onSubmit={onAddPledge} className="grid" style={{ gap: 10 }}>
              <div className="grid cols-2" style={{ gap: 10 }}>
                <input className="input" name="pledger_name" placeholder="Pledger name" />
                <input className="input" name="pledger_email" placeholder="Pledger email" />
              </div>

              <select className="input" name="need_id" defaultValue="">
                <option value="">Link to need (optional)</option>
                {needs.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title || n.id}
                  </option>
                ))}
              </select>

              <div className="grid cols-3" style={{ gap: 10 }}>
                <input className="input" name="type" placeholder="Type (money, food, labor)" />
                <input className="input" name="amount" placeholder="Amount" />
                <input className="input" name="unit" placeholder="Unit (USD, hours, boxes)" />
              </div>

              <textarea className="textarea" name="note" rows={2} placeholder="Note" />

              <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <select className="input" name="status" defaultValue="offered">
                  <option value="offered">offered</option>
                  <option value="accepted">accepted</option>
                  <option value="fulfilled">fulfilled</option>
                  <option value="cancelled">cancelled</option>
                </select>

                <button className="btn-red" type="submit" disabled={pledgesBusy}>
                  {pledgesBusy ? "Saving…" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
