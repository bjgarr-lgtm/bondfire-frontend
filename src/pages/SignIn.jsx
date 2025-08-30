// src/pages/SignIn.jsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * Minimal sign-in screen.
 * - If you have a real backend, wire handleSubmit() to your API and
 *   set bf_auth_token on success.
 * - “Continue as demo” just sets demo_user so you can enter the app.
 */
export default function SignIn() {
  const navigate = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [err, setErr]     = useState("");

  const after = new URLSearchParams(loc.search).get("next") || "/orgs";

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");

    try {
      // TODO: replace with your real auth call
      // const base = import.meta.env.VITE_API_BASE; // e.g. https://api.example.com
      // const res  = await fetch(`${base}/auth/login`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ email, password: pass })
      // });
      // if (!res.ok) throw new Error(await res.text());
      // const data = await res.json();
      // localStorage.setItem("bf_auth_token", data.token);

      // Temporary: accept anything and drop a fake token
      localStorage.setItem("bf_auth_token", "local-dev-token");
      sessionStorage.removeItem("bf_auth_token"); // prefer localStorage
      navigate(after, { replace: true });
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
        Sign in to continue, or try the demo mode.
      </p>

      <form onSubmit={handleSubmit} className="grid" style={{ gap: 10 }}>
        <input
          className="input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          required
        />
        <button className="btn">Sign in</button>
      </form>

      {err && (
        <div className="helper" style={{ color: "tomato", marginTop: 10 }}>
          {err}
        </div>
      )}

      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button className="btn" onClick={handleDemo}>Continue as demo</button>
      </div>
    </div>
  );
}
