// src/pages/SignIn.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function fireAuthChanged() {
	try {
		window.dispatchEvent(new Event("bf-auth-changed"));
	} catch {}
}

async function safeJson(res) {
	return res.json().catch(() => ({}));
}

export default function SignIn() {
	const navigate = useNavigate();

	const [mode, setMode] = useState("login");

	const [email, setEmail] = useState("");
	const [pass, setPass] = useState("");
	const [inviteCode, setInviteCode] = useState("");

	const [mfaStep, setMfaStep] = useState(null);
	const [mfaCode, setMfaCode] = useState("");
	const [mfaRecovery, setMfaRecovery] = useState("");

	const [name, setName] = useState("");
	const [orgName, setOrgName] = useState("Bondfire");

	const [err, setErr] = useState("");
	const [busy, setBusy] = useState(false);

	async function postJson(url, body) {
		const res = await fetch(url, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json", Accept: "application/json" },
			body: JSON.stringify(body || {}),
		});
		const data = await safeJson(res);
		return { res, data };
	}

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

			const { res, data } = await postJson(url, payload);

			// MFA challenge flow
			if (
				mode === "login" &&
				res.ok &&
				data?.ok &&
				data?.mfa_required &&
				data?.challenge_id
			) {
				setMfaStep({ challengeId: data.challenge_id, email });
				setBusy(false);
				return;
			}

			if (!res.ok || !data?.ok) {
				throw new Error(data?.error || (mode === "register" ? "Register failed" : "Login failed"));
			}

			// At this point cookies should be set. Verify session.
			const meRes = await fetch("/api/auth/me", { credentials: "include" });
			const meData = await safeJson(meRes);
			if (!meRes.ok || !meData?.ok) {
				throw new Error("SESSION_NOT_ESTABLISHED");
			}

			// Register convenience: if register returned org id, jump in.
			if (mode === "register" && data?.org?.id) {
				try {
					localStorage.setItem("bf_orgs", JSON.stringify([data.org]));
				} catch {}
				fireAuthChanged();
				navigate(`/org/${data.org.id}`, { replace: true });
				return;
			}

			// Optional invite join (login mode)
			const trimmedCode = String(inviteCode || "").trim().toUpperCase();
			if (trimmedCode) {
				const { res: jRes, data: jData } = await postJson("/api/invites/redeem", { code: trimmedCode });
				if (!jRes.ok || !jData?.ok) {
					throw new Error(jData?.error || "Invite code was not accepted");
				}
				if (jData?.org?.id) {
					fireAuthChanged();
					navigate(`/org/${jData.org.id}`, { replace: true });
					return;
				}
			}

			// Cache org list for UX (non critical)
			try {
				const orgsRes = await fetch("/api/orgs", { credentials: "include" });
				const orgsData = await safeJson(orgsRes);
				if (orgsRes.ok && orgsData?.ok && Array.isArray(orgsData.orgs)) {
					localStorage.setItem("bf_orgs", JSON.stringify(orgsData.orgs));
				}
			} catch {}

			fireAuthChanged();
			navigate("/orgs", { replace: true });
		} catch (e2) {
			setErr(typeof e2 === "string" ? e2 : e2?.message || "Auth failed");
		} finally {
			setBusy(false);
		}
	}

	async function handleMfaVerify(e) {
		e.preventDefault();
		setErr("");
		setBusy(true);
		try {
			const { res, data } = await postJson("/api/auth/login/mfa", {
				challenge_id: mfaStep?.challengeId,
				code: mfaCode,
				recovery_code: mfaRecovery,
			});
			if (!res.ok || !data?.ok) {
				throw new Error(data?.error || "MFA failed");
			}

			// Verify session cookies actually landed
			const meRes = await fetch("/api/auth/me", { credentials: "include" });
			const meData = await safeJson(meRes);
			if (!meRes.ok || !meData?.ok) {
				throw new Error("SESSION_NOT_ESTABLISHED");
			}

			// Cache org list for UX
			try {
				const orgsRes = await fetch("/api/orgs", { credentials: "include" });
				const orgsData = await safeJson(orgsRes);
				if (orgsRes.ok && orgsData?.ok && Array.isArray(orgsData.orgs)) {
					localStorage.setItem("bf_orgs", JSON.stringify(orgsData.orgs));
				}
			} catch {}

			setMfaStep(null);
			setMfaCode("");
			setMfaRecovery("");
			fireAuthChanged();
			navigate("/orgs", { replace: true });
		} catch (e2) {
			setErr(typeof e2 === "string" ? e2 : e2?.message || "MFA failed");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div style={{ maxWidth: 520, margin: "8vh auto", padding: 16 }}>
			<h1 style={{ marginBottom: 6 }}>Welcome to Bondfire</h1>
			<p className="helper" style={{ marginTop: 0 }}>
				{mode === "login" ? "Sign in to continue." : "Create your account and your first org."}
			</p>

			<div style={{ display: "flex", gap: 8, marginTop: 12 }}>
				<button
					type="button"
					className={mode === "login" ? "btn-red" : "btn"}
					onClick={() => {
						setErr("");
						setMode("login");
					}}
					disabled={busy}
				>
					Sign in
				</button>
				<button
					type="button"
					className={mode === "register" ? "btn-red" : "btn"}
					onClick={() => {
						setErr("");
						setMode("register");
					}}
					disabled={busy}
				>
					Create account
				</button>
			</div>

			{err && (
				<div className="helper" style={{ color: "crimson", marginTop: 12 }}>
					{String(err)}
				</div>
			)}

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
						onClick={() => {
							setMfaStep(null);
							setMfaCode("");
							setMfaRecovery("");
						}}
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
							/>
							<input
								className="input"
								type="text"
								placeholder="Org name"
								value={orgName}
								onChange={(e) => setOrgName(e.target.value)}
							/>
						</>
					)}

					<input
						className="input"
						type="email"
						placeholder="Email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						autoFocus
					/>
					<input
						className="input"
						type="password"
						placeholder="Password"
						value={pass}
						onChange={(e) => setPass(e.target.value)}
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
						{busy ? "Working…" : mode === "register" ? "Create account" : "Sign in"}
					</button>
				</form>
			)}
		</div>
	);
}
