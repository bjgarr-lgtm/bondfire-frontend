// src/pages/SignIn.jsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function SignIn() {
  const navigate = useNavigate();
  const loc = useLocation();

  const after = new URLSearchParams(loc.search).get("next") || "/orgs";

  const [mode, setMode] = useState("login"); // "login" | "register"

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("Bondfire");

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

async function handleSubmit(e) {
  e.preventDefault();
  setErr("");

  try {
    const res = await fetch(`/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok || !data?.token) {
      throw new Error(data?.error || "Login failed");
    }

    localStorage.setItem("bf_auth_token", data.token);
    sessionStorage.removeItem("bf_auth_token");
    localStorage.removeItem("demo_user");

    // load org memberships
    const orgsRes = await fetch("/api/orgs", {
      headers: { Authorization: `Bearer ${data.token}` },
    });
    const orgsData = await orgsRes.json().catch(() => ({}));
    if (orgsRes.ok && orgsData?.ok && Array.isArray(orgsData.orgs)) {
      localStorage.setItem("bf_orgs", JSON.stringify(orgsData.orgs));
    }

    navigate("/orgs", { replace: true });
  } catch (e) {
    setErr(typeof e === "string" ? e : (e?.message || "Login failed"));
  }
}


  function handleDemo() {
    localStorage.setItem("demo_user", "true");
    localStorage.removeItem("bf_auth_token");
    navigate(after, { replace: true });
  }

  return (
    <div style={{ maxWidth: 520, margin: "8vh auto", padding: 16 }}>
      <h1 style={{ marginBottom: 6 }}>Welcome to Bondfire</h1>

      <p className="helper" style={{ marginTop: 0 }}>
        {mode === "login"
          ? "Sign in to continue, or try the demo mode."
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

        <button className="btn" disabled={busy}>
          {busy ? "Working" : (mode === "login" ? "Sign in" : "Create account")}
        </button>
      </form>

      {err && (
        <div className="helper" style={{ color: "tomato", marginTop: 10 }}>
          {err}
        </div>
      )}

      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button type="button" className="btn" onClick={handleDemo} disabled={busy}>
          Continue as demo
        </button>
      </div>
    </div>
  );
}
