// src/pages/BondfireChat.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { createClient } from "matrix-js-sdk";

/* ---------------- helpers ---------------- */
function readJSON(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function parseOrgIdFromHash() {
  const m = (window.location.hash || "").match(/#\/org\/([^/]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}
const ts = () => new Date().toLocaleTimeString();
const phaseName = (p) => ({
  0: "Unsent", 1: "Requested", 2: "Ready", 3: "Started", 4: "WaitingForDone",
  5: "Done", 6: "Cancelled",
}[p] ?? String(p));
const randId = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

/* --------------- component --------------- */
export default function BondfireChat() {
  const params = useParams();
  const orgId = params.orgId || parseOrgIdFromHash();
  const saved = readJSON(`bf_matrix_${orgId}`, null);

  // login form (left blank by design)
  const [hsUrl, setHsUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // session
  const [userId, setUserId] = useState(saved?.userId || "");
  const [accessToken, setAccessToken] = useState(saved?.accessToken || "");
  const [deviceId, setDeviceId] = useState(saved?.deviceId || "");
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);
  const [cryptoReady, setCryptoReady] = useState(false);

  // verification state
  const [pendingVerification, setPendingVerification] = useState(null);
  const [pendingFrom, setPendingFrom] = useState("");
  const [otherDevices, setOtherDevices] = useState([]);
  const [manualDeviceId, setManualDeviceId] = useState("");

  // SAS UI
  const [sasEmojis, setSasEmojis] = useState(null); // array of [emoji, name]
  const [sasDecimals, setSasDecimals] = useState(null); // fallback numeric code

  // rooms / messages
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msg, setMsg] = useState("");

  const clientRef = useRef(null);
  const verifierRef = useRef(null);
  const log = (...a) => setStatus(`[${ts()}] ${a.join(" ")}`);

  /* ---------- boot / resume ---------- */
  useEffect(() => {
    if (!saved?.hsUrl || !userId || !accessToken) return;

    const client = createClient({
      baseUrl: saved.hsUrl,
      accessToken,
      userId,
      deviceId: deviceId || undefined,
    });
    clientRef.current = client;
    log("Connecting…");

    (async () => {
      try {
        if (typeof client.initRustCrypto === "function") {
          await client.initRustCrypto();
        } else if (typeof client.initCrypto === "function") {
          await client.initCrypto();
        }
        setCryptoReady(true);
      } catch (e) {
        setCryptoReady(false);
        log("Crypto init failed:", e?.message || e);
      }

      client.on("sync", (state) => {
        if (state === "PREPARED") {
          setReady(true);
          refreshRooms();
          refreshDevices();
          scanVerificationRequests();
        }
      });

      // handle verification requests (SDK variants differ)
      const crypto = client.getCrypto?.();
      const onReq = (req) => {
        setPendingVerification(req);
        setPendingFrom(`${req?.otherUserId || ""} · ${req?.otherDeviceId || ""}`);
        log("Verification request:", req?.otherUserId, req?.otherDeviceId, `(phase ${phaseName(req?.phase)})`);
        // don't auto-confirm anymore; we’ll show the emoji banner and let you confirm
        // but if it’s already in progress, just attach listeners
        attachVerifierListeners(req);
      };
      client.on?.("crypto.verification.request", onReq);
      crypto?.on?.("verification.request", onReq);

      // fallback: raw to-device event
      client.on?.("toDeviceEvent", (ev) => {
        if (ev.getType?.() !== "m.key.verification.request") return;
        const sender = ev.getSender?.();
        const txn = ev.getContent?.()?.transaction_id;
        try {
          const req = client.getVerificationRequest?.(sender, txn);
          if (req) onReq(req);
        } catch {}
      });

      client.on("Room.timeline", (ev, room, toStartOfTimeline) => {
        if (toStartOfTimeline) return;
        if (!activeRoomId || room.roomId !== activeRoomId) return;
        if (ev.getType() === "m.room.message") {
          setMessages((prev) => [
            ...prev,
            {
              id: ev.getId(),
              body: ev.getContent()?.body || "",
              sender: ev.getSender(),
              ts: ev.getTs(),
              encrypted: !!ev.isEncrypted?.(),
            },
          ]);
        }
      });

      client.startClient({ initialSyncLimit: 30 });

      async function refreshRooms() {
        const rs = client
          .getVisibleRooms()
          .filter((r) => ["join", "invite"].includes(r.getMyMembership()))
          .sort(
            (a, b) =>
              (b.getLastActiveTimestamp() || 0) -
              (a.getLastActiveTimestamp() || 0)
          );
        setRooms(
          rs.map((r) => ({
            id: r.roomId,
            name: r.name || r.getCanonicalAlias() || r.roomId,
            encrypted: r.isEncrypted?.(),
          }))
        );
      }

      async function refreshDevices() {
        try {
          const res = await client.getDevices?.();
          const mine = (res?.devices || []).filter(
            (d) => d.device_id !== client.getDeviceId()
          );
          setOtherDevices(
            mine.map((d) => ({
              device_id: d.device_id,
              display_name: d.display_name || "",
            }))
          );
        } catch {}
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.hsUrl, userId, accessToken, deviceId]);

  /* -------- verification helpers -------- */

  // Attach listeners to a request so we can show emoji when SAS starts
  function attachVerifierListeners(req) {
    if (!req) return;

    // If we already began verification, keep verifierRef
    req.on?.("change", () => {
      // phase transitions
      setStatus(`[${ts()}] Verification phase: ${phaseName(req.phase)}`);
      if (req.phase >= 5 || req.phase === 6) {
        // done / cancelled
        setSasEmojis(null);
        setSasDecimals(null);
        verifierRef.current = null;
        setPendingVerification(null);
        setPendingFrom("");
      }
    });
  }

  async function acceptAndBeginSas() {
    const req = pendingVerification;
    if (!req) return;
    try {
      await req.accept();
      let verifier;
      try {
        verifier = req.beginKeyVerification("m.sas.v1");
      } catch {
        verifier = req.beginKeyVerification("sas");
      }
      verifierRef.current = verifier;

      // Some SDKs emit 'show_sas' with emojis, others provide decimal fallback
      verifier.on?.("show_sas", (sas) => {
        try {
          // Try emoji set first
          const e = verifier.getEmoji?.() || sas?.emoji;
          if (e && Array.isArray(e) && e.length) {
            // e is array of [emoji, name], or array of objects {emoji, description}
            const normalized = e.map((x) =>
              Array.isArray(x) ? x : [x?.emoji || "", x?.description || ""]
            );
            setSasEmojis(normalized);
            setSasDecimals(null);
          } else {
            // fallback to decimals
            const d = verifier.getDecimals?.() || sas?.decimal || sas?.sas;
            if (d && Array.isArray(d)) setSasDecimals(d);
          }
        } catch {}
      });

      verifier.on?.("cancel", () => {
        setSasEmojis(null);
        setSasDecimals(null);
        verifierRef.current = null;
        setPendingVerification(null);
        setPendingFrom("");
        log("Verification cancelled");
      });

      verifier.on?.("verified", () => {
        setSasEmojis(null);
        setSasDecimals(null);
        verifierRef.current = null;
        setPendingVerification(null);
        setPendingFrom("");
        log("Device verified ✅");
      });

      await verifier.verify(); // waits until confirmed/cancelled
    } catch (e) {
      log("Could not begin SAS:", e?.message || e);
    }
  }

  async function confirmSasMatch() {
    const verifier = verifierRef.current;
    if (!verifier) return;
    try {
      // Confirm the emoji/decimal match
      verifier.confirm?.();
      // If confirm is noop on this build, verify() will still resolve when other side confirms.
      log("Confirmed SAS match; waiting for other device…");
    } catch (e) {
      log("Confirm failed:", e?.message || e);
    }
  }

  async function cancelVerification() {
    const verifier = verifierRef.current;
    if (!verifier) return;
    try {
      await verifier.cancel?.();
      setSasEmojis(null);
      setSasDecimals(null);
      verifierRef.current = null;
      setPendingVerification(null);
      setPendingFrom("");
      log("Verification cancelled");
    } catch (e) {
      log("Cancel failed:", e?.message || e);
    }
  }

  async function scanVerificationRequests() {
    const client = clientRef.current;
    if (!client) return;

    try {
      const crypto = client.getCrypto?.();
      const getters = [
        crypto?.getVerificationRequests,
        crypto?.getRequests,
        client.getVerificationRequests,
      ].filter(Boolean);

      let reqs = [];
      for (const g of getters) {
        try {
          const out = typeof g === "function" ? await g.call(crypto || client) : [];
          if (Array.isArray(out) && out.length) {
            reqs = out;
            break;
          }
        } catch {}
      }

      if (!Array.isArray(reqs) || reqs.length === 0) {
        log("No pending verification requests");
        return;
      }

      const latest = reqs[reqs.length - 1];
      setPendingVerification(latest);
      setPendingFrom(`${latest?.otherUserId || ""} · ${latest?.otherDeviceId || ""}`);
      attachVerifierListeners(latest);
      log("Found verification request", latest?.otherUserId || "", latest?.otherDeviceId || "");
    } catch (e) {
      log("Scan failed:", e?.message || e);
    }
  }


  // Manual start via REST (avoid SDK quirk)
async function manualToDeviceRequest(targetDeviceId) {
  const client = clientRef.current;
  if (!client || !targetDeviceId) return;

  const crypto = client.getCrypto?.();

  try {
    // Prefer SDK API so we actually get a VerificationRequest object locally
    const fn =
      crypto?.requestDeviceVerification ||
      crypto?.requestDeviceVerificationWithDeviceId ||
      client.requestDeviceVerification;

    if (typeof fn === "function") {
      const maybeReq = await fn.call(crypto || client, client.getUserId(), targetDeviceId);

      // Some builds return a request, others stash it internally
      if (maybeReq) {
        setPendingVerification(maybeReq);
        setPendingFrom(`${maybeReq?.otherUserId || client.getUserId()} · ${maybeReq?.otherDeviceId || targetDeviceId}`);
        attachVerifierListeners(maybeReq);
      } else {
        // fall back to scanning
        await scanVerificationRequests();
      }

      log("Requested verification with device", targetDeviceId);
      log("Now accept it in Element, then click Scan for requests here");
      return;
    }
  } catch (e) {
    log("SDK verification request failed, falling back:", e?.message || e);
  }

  // Fallback: raw to device request (works for Element, but may not give us SAS locally)
  try {
    const txn = randId();
    const url = new URL(
      "/_matrix/client/v3/sendToDevice/m.key.verification.request/" + encodeURIComponent(txn),
      client.baseUrl
    ).toString();

    const payload = {
      messages: {
        [client.getUserId()]: {
          [targetDeviceId]: {
            from_device: client.getDeviceId(),
            transaction_id: txn,
            methods: ["m.sas.v1"],
            timestamp: Date.now(),
          },
        },
      },
    };

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${client.getAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }

    log("Sent raw verification request to", targetDeviceId);
    log("Accept in Element, then click Scan for requests here");
  } catch (e) {
    log("Manual request failed:", e?.message || e);
  }
}


  /* -------------- session -------------- */
  const login = async (e) => {
    e.preventDefault();
    try {
      const baseUrl = hsUrl.trim();
      const localpart = username.trim();
      const temp = createClient({ baseUrl });
      const res = await temp.login("m.login.password", {
        identifier: { type: "m.id.user", user: localpart },
        password,
      });
      setUserId(res.user_id);
      setAccessToken(res.access_token);
      setDeviceId(res.device_id || "");
      localStorage.setItem(
        `bf_matrix_${orgId}`,
        JSON.stringify({
          hsUrl: baseUrl,
          userId: res.user_id,
          accessToken: res.access_token,
          deviceId: res.device_id || "",
        })
      );
      setPassword("");
      window.location.hash = window.location.hash; // kick resume
    } catch (err) {
      log("Login failed:", err?.message || "Unknown error");
    }
  };

  const logout = () => {
    try { localStorage.removeItem(`bf_matrix_${orgId}`); } catch {}
    setUserId(""); setAccessToken(""); setDeviceId("");
    setReady(false); setCryptoReady(false);
    setPendingVerification(null); setPendingFrom("");
    setSasEmojis(null); setSasDecimals(null);
    setOtherDevices([]); setRooms([]); setMessages([]); setMsg("");
    if (clientRef.current) {
      clientRef.current.stopClient();
      clientRef.current.removeAllListeners();
      clientRef.current = null;
    }
    log("Logged out");
  };

  /* -------- rooms / messages -------- */
  const selectRoom = async (roomId) => {
    setActiveRoomId(roomId);
    setMessages([]);
    const client = clientRef.current;
    if (!client) return;
    const room = client.getRoom(roomId);
    if (!room) return;
    const tl = room.getLiveTimeline?.();
    const evs = (tl?.getEvents?.() || []).filter((e) => e.getType() === "m.room.message");
    setMessages(evs.map((ev) => ({
      id: ev.getId(),
      body: ev.getContent()?.body || "",
      sender: ev.getSender(),
      ts: ev.getTs(),
      encrypted: !!ev.isEncrypted?.(),
    })));
  };

  const send = async (e) => {
    e.preventDefault();
    const client = clientRef.current;
    if (!client || !activeRoomId || !msg.trim()) return;
    try {
      await client.sendEvent(
        activeRoomId,
        "m.room.message",
        { msgtype: "m.text", body: msg.trim() },
        ""
      );
      setMsg("");
    } catch (err) {
      log("Send failed:", err?.message || "Unknown error");
    }
  };

  const reRequestKeys = async () => {
    const client = clientRef.current;
    if (!client) return;
    try {
      await client.crypto?.requestRoomKey?.(); // best-effort; not on all builds
      log("Key re-request sent");
    } catch (e) {
      log("Failed to re-request keys:", e?.message || e);
    }
  };

  /* -------- derived / render -------- */
  const loggedIn = !!(saved?.hsUrl && userId && accessToken);
  const currentRoom = useMemo(
    () => rooms.find((r) => r.id === activeRoomId) || null,
    [rooms, activeRoomId]
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 0, borderBottom: "1px solid #222", paddingBottom: 12 }}>
        <button className="btn" onClick={logout}>Logout</button>
        <button className="btn" onClick={reRequestKeys}>Re-request keys</button>
        <button className="btn" onClick={scanVerificationRequests}>Scan for requests</button>
        <div className="helper" style={{ marginLeft: "auto" }}>{status}</div>
      </header>

      {loggedIn && (
        <div className="helper" style={{ marginTop: 8 }}>
          <strong>Signed in as:</strong> {userId} · <strong>Device:</strong> {deviceId || "(loading)"} {cryptoReady ? "🔒" : "🟡"}
        </div>
      )}

      {/* SAS banner */}
      {pendingVerification && (sasEmojis || sasDecimals) && (
        <div className="card" style={{ padding: 12, marginTop: 12, border: "2px solid #10b981" }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Compare the emojis on both devices, then confirm
          </h3>
          {sasEmojis ? (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              {sasEmojis.map(([emoji, name], i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 56 }}>
                  <div style={{ fontSize: 28, lineHeight: 1 }}>{emoji}</div>
                  <div style={{ fontSize: 11, opacity: 0.8 }}>{name}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="helper">Code: {Array.isArray(sasDecimals) ? sasDecimals.join(" ") : String(sasDecimals)}</div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn" onClick={confirmSasMatch}>Confirm match</button>
            <button className="btn" onClick={cancelVerification}>Cancel</button>
          </div>
          <div className="helper" style={{ marginTop: 8 }}>
            Pending from: {pendingFrom}
          </div>
        </div>
      )}

      {!loggedIn ? (
        <section className="card" style={{ marginTop: 12, padding: 12 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>Sign in to your Matrix homeserver</h3>
          <form onSubmit={login} className="grid" style={{ gap: 8, maxWidth: 520 }}>
            <input className="input" placeholder="Homeserver base URL (e.g. https://matrix.org)" value={hsUrl} onChange={(e) => setHsUrl(e.target.value)} required />
            <input className="input" placeholder="Username (localpart, without @ and domain)" value={username} onChange={(e) => setUsername(e.target.value)} required />
            <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button className="btn">Login</button>
          </form>
        </section>
      ) : (
        <>
          {/* Devices + manual request */}
          <div className="card" style={{ padding: 12, marginTop: 12 }}>
            <h3 className="section-title" style={{ marginTop: 0 }}>Your other devices</h3>
            {otherDevices.length === 0 ? (
              <div className="helper">
                Open Element with the same account, accept the request there or click “Scan for requests” here.
                If nothing arrives, type the Element device ID below and click “Manual request”.
              </div>
            ) : (
              <ul style={{ paddingLeft: 18 }}>
                {otherDevices.map((d) => (
                  <li key={d.device_id} style={{ marginBottom: 6 }}>
                    <strong>{d.device_id}</strong>{d.display_name ? ` — ${d.display_name}` : ""}
                    <button className="btn" style={{ marginLeft: 8 }} onClick={() => manualToDeviceRequest(d.device_id)}>
                      Manual request (to device)
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                className="input"
                placeholder="Or type Element device ID…"
                value={manualDeviceId}
                onChange={(e) => setManualDeviceId(e.target.value)}
              />
              <button className="btn" onClick={() => manualDeviceId && manualToDeviceRequest(manualDeviceId)}>
                Manual request
              </button>
              {pendingVerification && (
                <button className="btn" onClick={acceptAndBeginSas}>
                  Accept & Start SAS
                </button>
              )}
            </div>
            {pendingFrom && (
              <div className="helper" style={{ marginTop: 8 }}>
                Pending from: {pendingFrom} {pendingVerification ? `(phase: ${phaseName(pendingVerification.phase)})` : ""}
              </div>
            )}
          </div>

          {/* Rooms & messages */}
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 12, marginTop: 12 }}>
            <aside className="card" style={{ padding: 12, minHeight: 420 }}>
              <h3 className="section-title" style={{ marginTop: 0 }}>Rooms</h3>
              <ul style={{ paddingLeft: 18 }}>
                {rooms.map((r) => (
                  <li key={r.id}>
                    <a href="#" onClick={(e) => { e.preventDefault(); selectRoom(r.id); }}>
                      {r.name}{r.encrypted ? " 🔒" : ""}
                    </a>
                  </li>
                ))}
                {rooms.length === 0 && <li className="helper">No rooms yet.</li>}
              </ul>
            </aside>

            <main className="card" style={{ padding: 12, minHeight: 420, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 className="section-title" style={{ marginTop: 0, marginBottom: 8, flex: 1 }}>
                  {currentRoom ? currentRoom.name : "Select a room"}
                  {currentRoom?.encrypted ? " 🔒" : ""}
                </h3>
              </div>

              <div style={{ flex: 1, overflow: "auto", border: "1px solid #222", borderRadius: 8, padding: 8 }}>
                {messages.length === 0 ? (
                  <div className="helper">No messages yet.</div>
                ) : (
                  messages
                    .sort((a, b) => a.ts - b.ts)
                    .map((m) => (
                      <div key={m.id} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          {m.sender} · {new Date(m.ts).toLocaleString()} {m.encrypted ? "🔒" : ""}
                        </div>
                        <div>{m.body}</div>
                      </div>
                    ))
                )}
              </div>

              <form onSubmit={send} className="row" style={{ gap: 8, marginTop: 8 }}>
                <input
                  className="input"
                  placeholder={currentRoom ? "Type a message…" : "Pick or create a room first"}
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  disabled={!currentRoom}
                />
                <button className="btn" disabled={!currentRoom || !msg.trim()}>Send</button>
              </form>
            </main>
          </div>
        </>
      )}
    </div>
  );
}
