// src/pages/SignUp.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function SignUp() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password: pass, orgName }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.token) {
        throw new Error(data?.error || "Register failed");
      }

      localStorage.setItem("bf_auth_token", data.token);
      localStorage.removeItem("demo_user");

      if (data?.org?.id) {
        const orgs = [{ id: data.org.id, name: data.org.name, role: data.org.role || "owner" }];
        localStorage.setItem("bf_orgs", JSON.stringify(orgs));
        nav(`/org/${data.org.id}`, { replace: true });
      } else {
        nav("/orgs", { replace: true });
      }
    } catch (e) {
      setErr(e?.message || "Register failed");
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "8vh auto", padding: 16 }}>
      <h1 style={{ marginBottom: 6 }}>Create your Bondfire</h1>

      <form onSubmit={onSubmit} className="grid" style={{ gap: 10 }}>
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="Organization name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
        <input className="input" type="password" placeholder="Password" value={pass} onChange={(e) => setPass(e.target.value)} required />
        <button className="btn">Create account</button>
      </form>

      {err && <div className="helper" style={{ color: "tomato", marginTop: 10 }}>{err}</div>}
    </div>
  );
}
