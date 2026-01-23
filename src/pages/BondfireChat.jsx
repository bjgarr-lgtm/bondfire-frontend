// src/pages/BondfireChat.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { createClient } from "matrix-js-sdk";

/* ---------------- helpers ---------------- */
function readJSON(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function parseOrgIdFromHash() {
  const m = (window.location.hash || "").match(/#\/org\/([^/]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}
const ts = () => new Date().toLocaleTimeString();
const randId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/* --------------- component --------------- */
export default function BondfireChat() {
  const params = useParams();
  const orgId = params.orgId || parseOrgIdFromHash();
  const saved = readJSON(`bf_matrix_${orgId}`, null);

  // login form
  const [hsUrl, setHsUrl] = useState(saved?.hsUrl || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // session
  const [userId, setUserId] = useState(saved?.userId || "");
  const [accessToken, setAccessToken] = useState(saved?.accessToken || "");
  const [deviceId, setDeviceId] = useState(saved?.deviceId || "");
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);
  const [cryptoReady, setCryptoReady] = useState(false);

  // rooms / messages
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msg, setMsg] = useState("");

  const clientRef = useRef(null);
  const log = (...a) => setStatus(`[${ts()}] ${a.join(" ")}`);

  const loggedIn = !!(saved?.hsUrl && userId && accessToken);

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
      // Enable E2EE. Without this, Element correctly labels the session as "doesn't support encryption".
      // matrix-js-sdk uses Rust crypto in the browser when @matrix-org/matrix-sdk-crypto-wasm is installed.
      try {
        if (typeof client.initRustCrypto === "function") {
          await client.initRustCrypto({
            // indexedDB is required for persistent crypto stores in browsers
            useIndexedDB: true,
            storageKey: `bf_chat_${orgId || "global"}`,
          });
          setCryptoReady(true);
        } else if (typeof client.initCrypto === "function") {
          await client.initCrypto();
          setCryptoReady(true);
        } else {
          setCryptoReady(false);
          log("Crypto init not available in this build");
        }
      } catch (e) {
        setCryptoReady(false);
        log("Crypto init failed:", e?.message || e);
      }

      client.on("sync", (state) => {
        if (state === "PREPARED") {
          setReady(true);
          refreshRooms();
        }
      });

      client.on("Room.timeline", (ev, room, toStartOfTimeline) => {
        if (toStartOfTimeline) return;
        if (!activeRoomId || room.roomId !== activeRoomId) return;
        if (ev.getType() === "m.room.message") {
          setMessages((prev) => [
            ...prev,
            {
              id: ev.getId() || randId(),
              body: ev.getContent()?.body || "",
              sender: ev.getSender(),
              ts: ev.getTs(),
              encrypted: !!ev.isEncrypted?.(),
            },
          ]);
        }
      });

      client.startClient({ initialSyncLimit: 30 });

      function refreshRooms() {
        const rs = (client.getVisibleRooms?.() || client.getRooms?.() || [])
          .filter((r) => ["join", "invite"].includes(r.getMyMembership?.() || ""))
          .sort(
            (a, b) =>
              (b.getLastActiveTimestamp?.() || 0) - (a.getLastActiveTimestamp?.() || 0)
          );
        setRooms(
          rs.map((r) => ({
            id: r.roomId,
            name: r.name || r.getCanonicalAlias?.() || r.roomId,
            encrypted: !!r.isEncrypted?.(),
          }))
        );
      }
    })();

    return () => {
      try {
        client.stopClient();
        client.removeAllListeners();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.hsUrl, userId, accessToken, deviceId, orgId, activeRoomId]);

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
      // trigger the resume effect
      window.location.hash = window.location.hash;
    } catch (err) {
      log("Login failed:", err?.message || "Unknown error");
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem(`bf_matrix_${orgId}`);
    } catch {}
    setUserId("");
    setAccessToken("");
    setDeviceId("");
    setReady(false);
    setCryptoReady(false);
    setRooms([]);
    setActiveRoomId(null);
    setMessages([]);
    setMsg("");
    if (clientRef.current) {
      try {
        clientRef.current.stopClient();
        clientRef.current.removeAllListeners();
      } catch {}
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
    const room = client.getRoom?.(roomId);
    if (!room) return;
    const tl = room.getLiveTimeline?.();
    const evs = (tl?.getEvents?.() || []).filter((e) => e.getType() === "m.room.message");
    setMessages(
      evs.map((ev) => ({
        id: ev.getId() || randId(),
        body: ev.getContent()?.body || "",
        sender: ev.getSender(),
        ts: ev.getTs(),
        encrypted: !!ev.isEncrypted?.(),
      }))
    );
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
      const crypto = client.getCrypto?.() || client.crypto;
      await crypto?.requestRoomKey?.();
      log("Key re-request sent");
    } catch (e) {
      log("Failed to re-request keys:", e?.message || e);
    }
  };

  /* -------- derived / render -------- */
  const currentRoom = useMemo(
    () => rooms.find((r) => r.id === activeRoomId) || null,
    [rooms, activeRoomId]
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 0,
          borderBottom: "1px solid #222",
          paddingBottom: 12,
        }}
      >
        <button className="btn" onClick={logout}>
          Logout
        </button>
        <button className="btn" onClick={reRequestKeys}>
          Re-request keys
        </button>
        <div className="helper" style={{ marginLeft: "auto" }}>
          {status}
        </div>
      </header>

      {loggedIn && (
        <div className="helper" style={{ marginTop: 8 }}>
          <strong>Signed in as:</strong> {userId} · <strong>Device:</strong> {deviceId || "(loading)"} {cryptoReady ? "🔒" : "🟡"}
          {!cryptoReady && (
            <div style={{ marginTop: 6 }}>
              This session is not E2EE-capable yet. If you see this, the crypto WASM dependency is missing or failed to load.
            </div>
          )}
          {cryptoReady && (
            <div style={{ marginTop: 6 }}>
              Verification happens in Element: open <em>Settings → Sessions</em>, find <strong>{deviceId || "this"}</strong> device, and verify it there.
            </div>
          )}
        </div>
      )}

      {!loggedIn ? (
        <section className="card" style={{ marginTop: 12, padding: 12 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Sign in to your Matrix homeserver
          </h3>
          <form onSubmit={login} className="grid" style={{ gap: 8, maxWidth: 520 }}>
            <input
              className="input"
              placeholder="Homeserver base URL (e.g. https://matrix.org)"
              value={hsUrl}
              onChange={(e) => setHsUrl(e.target.value)}
              required
            />
            <input
              className="input"
              placeholder="Username (localpart, without @ and domain)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <input
              className="input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button className="btn">Login</button>
          </form>
        </section>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 12, marginTop: 12 }}>
            <aside className="card" style={{ padding: 12, minHeight: 420 }}>
              <h3 className="section-title" style={{ marginTop: 0 }}>
                Rooms {ready ? "" : "(loading…)"}
              </h3>
              <ul style={{ paddingLeft: 18 }}>
                {rooms.map((r) => (
                  <li key={r.id}>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        selectRoom(r.id);
                      }}
                    >
                      {r.name}
                      {r.encrypted ? " 🔒" : ""}
                    </a>
                  </li>
                ))}
                {rooms.length === 0 && <li className="helper">No rooms yet.</li>}
              </ul>
            </aside>

            <main
              className="card"
              style={{ padding: 12, minHeight: 420, display: "flex", flexDirection: "column" }}
            >
              <h3 className="section-title" style={{ marginTop: 0, marginBottom: 8 }}>
                {currentRoom ? currentRoom.name : "Select a room"}
                {currentRoom?.encrypted ? " 🔒" : ""}
              </h3>

              <div
                style={{
                  flex: 1,
                  overflow: "auto",
                  border: "1px solid #222",
                  borderRadius: 8,
                  padding: 8,
                }}
              >
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
                  placeholder={currentRoom ? "Type a message…" : "Pick a room first"}
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  disabled={!currentRoom}
                />
                <button className="btn" disabled={!currentRoom || !msg.trim()}>
                  Send
                </button>
              </form>
            </main>
          </div>
        </>
      )}
    </div>
  );
}
