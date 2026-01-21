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
    setBusy(true);

    try {
      if (mode === "login") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: pass }),
        });

          const raw = await res.text();
          let data = {};
          try { data = JSON.parse(raw); } catch { /* ignore */ }

          if (!res.ok || !data?.ok || !data?.token) {
            const msg = data?.error || raw || "Register failed";
            throw new Error(msg);
          }


        localStorage.setItem("bf_auth_token", data.token);
        sessionStorage.removeItem("bf_auth_token");
        localStorage.removeItem("demo_user");

        navigate(after, { replace: true });
        return;
      }

      // register
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: pass,
          name,
          orgName,
        }),
      });

      const raw = await res.text();
      let data = {};
      try { data = JSON.parse(raw); } catch { /* ignore */ }

      if (!res.ok || !data?.ok || !data?.token) {
        const msg = data?.error || raw || "Register failed";
        throw new Error(msg);
      }


      localStorage.setItem("bf_auth_token", data.token);
      sessionStorage.removeItem("bf_auth_token");
      localStorage.removeItem("demo_user");

      // persist org list for org picker pages
      if (data?.org?.id) {
        const orgObj = {
          id: data.org.id,
          name: data.org.name || orgName || "Org",
          role: data.org.role || "owner",
        };

        localStorage.setItem("bf_orgs", JSON.stringify([orgObj]));
        localStorage.setItem(
          `bf_org_settings_${orgObj.id}`,
          JSON.stringify({ name: orgObj.name })
        );
      }

      navigate(after, { replace: true });
    } catch (e2) {
      setErr(typeof e2 === "string" ? e2 : (e2?.message || "Failed"));
    } finally {
      setBusy(false);
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
