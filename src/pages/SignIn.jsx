// src/pages/SignIn.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function SignIn() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // "login" | "register"

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const [inviteCode, setInviteCode] = useState("");

  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("Bondfire");

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

async function handleSubmit(e) {
  e.preventDefault();
  setErr("");
  setBusy(true);

  try {
    const url = mode === "register" ? "/api/auth/register" : "/api/auth/login";

    const payload =
      mode === "register"
        ? { email, password: pass, name, orgName }
        : { email, password: pass };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok || !data?.token) {
      throw new Error(
        data?.error || (mode === "register" ? "Register failed" : "Login failed")
      );
    }

    localStorage.setItem("bf_auth_token", data.token);
    sessionStorage.removeItem("bf_auth_token");

    // If register returns org, store it and go straight into that org
    if (mode === "register" && data?.org?.id) {
      localStorage.setItem("bf_orgs", JSON.stringify([data.org]));
      navigate(`/org/${data.org.id}`, { replace: true });
      return;
    }

    // Optional invite join flow (login mode)
    const trimmedCode = (inviteCode || "").trim().toUpperCase();
    if (trimmedCode) {
      const jRes = await fetch("/api/invites/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.token}`,
        },
        body: JSON.stringify({ code: trimmedCode }),
      });
      const jData = await jRes.json().catch(() => ({}));
      if (!jRes.ok || !jData?.ok) {
        throw new Error(jData?.error || "Invite code was not accepted");
      }
      if (jData?.org?.id) {
        navigate(`/org/${jData.org.id}`, { replace: true });
        return;
      }
    }

    // Otherwise (login), load org memberships
    const orgsRes = await fetch("/api/orgs", {
      headers: { Authorization: `Bearer ${data.token}` },
    });
    const orgsData = await orgsRes.json().catch(() => ({}));
    if (orgsRes.ok && orgsData?.ok && Array.isArray(orgsData.orgs)) {
      localStorage.setItem("bf_orgs", JSON.stringify(orgsData.orgs));
    }

    navigate("/orgs", { replace: true });
  } catch (e) {
    setErr(typeof e === "string" ? e : (e?.message || "Auth failed"));
  } finally {
    setBusy(false);
  }
}
  return (
    <div className="bf-auth-shell" style={{ padding: 16, minHeight: "100vh" }}>
      <div className="card bf-auth-card" style={{ maxWidth: 520, margin: "8vh auto", padding: 16 }}>
      <h1 style={{ marginBottom: 6 }}>Welcome to Bondfire</h1>

      <p className="helper" style={{ marginTop: 0 }}>
        {mode === "login"
          ? "Sign in to continue."
          : "Create your account and your first org."}
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          className={mode === "login" ? "btn-red" : "btn"}
          onClick={() => { setErr(""); setMode("login"); }}
          disabled={busy}
          style={{ flex: 1, minWidth: 160 }}
        >
          Sign in
        </button>
        <button
          type="button"
          className={mode === "register" ? "btn-red" : "btn"}
          onClick={() => { setErr(""); setMode("register"); }}
          disabled={busy}
          style={{ flex: 1, minWidth: 160 }}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid" style={{ gap: 10, marginTop: 12 }}>
        {mode === "register" && (
          <>
            <input
              className="input"
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <input
              className="input"
              type="text"
              placeholder="Org name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
            />
          </>
        )}

        <input
          className="input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus={mode === "login"}
        />

        <input
          className="input"
          type="password"
          placeholder="Password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          required
        />

        {mode === "login" && (
          <input
            className="input"
            type="text"
            placeholder="Invite code (optional)"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
          />
        )}

        <button className="btn-red" disabled={busy}>
          {busy ? "Working" : (mode === "login" ? "Sign in" : "Create account")}
        </button>
      </form>

      {err && (
        <div className="helper" style={{ color: "tomato", marginTop: 10 }}>
          {err}
        </div>
      )}
      </div>
    </div>
  );
}
