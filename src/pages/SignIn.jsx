// src/pages/SignIn.jsx
import React, { useState } from "react";
import { apiJSON } from "../lib/api.js";
import { useNavigate } from "react-router-dom";

export default function SignIn() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // "login" | "register"

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const [inviteCode, setInviteCode] = useState("");

  const [mfaStep, setMfaStep] = useState(null); // null | { challengeId, email }
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRecovery, setMfaRecovery] = useState("");

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

    // MFA challenge flow
    if (mode === "login" && res.ok && data?.ok && data?.mfa_required && data?.challenge_id) {
      setMfaStep({ challengeId: data.challenge_id, email });
      setBusy(false);
      return;
    }

    if (!data?.ok) {
      throw new Error(
        data?.error || (mode === "register" ? "Register failed" : "Login failed")
      );
    }

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

async function handleMfaVerify(e) {
  e.preventDefault();
  setErr("");
  setBusy(true);
  try {
    const data = await apiJSON("/api/auth/login/mfa", { method: "POST", body: {
      challenge_id: mfaStep?.challenge_id || mfaStep?.challengeId,
      code: mfaCode,
      recovery_code: mfaRecovery,
    }});

    localStorage.setItem("bf_logged_in", "1");

    // Load org memberships
    const orgsRes = await fetch("/api/orgs", {
      headers: { Authorization: `Bearer ${data.token}` },
    });
    const orgsData = await orgsRes.json().catch(() => ({}));
    if (orgsRes.ok && orgsData?.ok && Array.isArray(orgsData.orgs)) {
      localStorage.setItem("bf_orgs", JSON.stringify(orgsData.orgs));
    }

    setMfaStep(null);
    setMfaCode("");
    setMfaRecovery("");
    navigate("/orgs", { replace: true });
  } catch (e) {
    setErr(typeof e === "string" ? e : (e?.message || "MFA failed"));
  } finally {
    setBusy(false);
  }
}
  return (
    <div style={{ maxWidth: 520, margin: "8vh auto", padding: 16 }}>
      <h1 style={{ marginBottom: 6 }}>Welcome to Bondfire</h1>

      <p className="helper" style={{ marginTop: 0 }}>
        {mode === "login"
          ? "Sign in to continue."
          : "Create your account and your first org."}
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          className={mode === "login" ? "btn-red" : "btn"}
          onClick={() => { setErr(""); setMode("login"); }}
          disabled={busy}
        >
          Sign in
        </button>
        <button
          type="button"
          className={mode === "register" ? "btn-red" : "btn"}
          onClick={() => { setErr(""); setMode("register"); }}
          disabled={busy}
        >
          Create account
        </button>
      </div>

      {mfaStep ? (
        <form onSubmit={handleMfaVerify} className="grid" style={{ gap: 10, marginTop: 12 }}>
          <div className="helper">
            MFA required for <b>{mfaStep.email}</b>. Enter your authenticator code or a recovery code.
          </div>

          <input
            className="input"
            type="text"
            placeholder="Authenticator code (6 digits)"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            autoFocus
          />

          <input
            className="input"
            type="text"
            placeholder="Recovery code (optional)"
            value={mfaRecovery}
            onChange={(e) => setMfaRecovery(e.target.value)}
          />

          <button className="btn-red" disabled={busy}>
            {busy ? "Verifying…" : "Verify"}
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => { setMfaStep(null); setMfaCode(""); setMfaRecovery(""); }}
          >
            Back
          </button>
        </form>
      ) : (
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
      )}

      {err && (
        <div className="helper" style={{ color: "tomato", marginTop: 10 }}>
          {err}
        </div>
      )}
    </div>
  );
}
