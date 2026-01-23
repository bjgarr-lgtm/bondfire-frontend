// src/pages/BondfireChat.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { createClient } from "matrix-js-sdk";

/*
  Bondfire Chat:
  - Uses matrix-js-sdk for basic sync + sending messages.
  - Does NOT attempt device verification or E2EE key management inside Bondfire.
    That flow is brittle in-browser and varies by SDK build (olm/rust crypto).
  - Verification is expected to be done in Element (or another full Matrix client).
*/

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

export default function BondfireChat() {
  const params = useParams();
  const orgId = params.orgId || parseOrgIdFromHash();

  const saved = readJSON(`bf_matrix_${orgId}`, null);

  // login form
  const [hsUrl, setHsUrl] = useState("");
  const [username, setUsername] = useState(""); // localpart
  const [password, setPassword] = useState("");

  // session
  const [userId, setUserId] = useState(saved?.userId || "");
  const [accessToken, setAccessToken] = useState(saved?.accessToken || "");
  const [deviceId, setDeviceId] = useState(saved?.deviceId || "");
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);

  // rooms/messages
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msg, setMsg] = useState("");

  const clientRef = useRef(null);
  const log = (...a) => setStatus(`[${ts()}] ${a.join(" ")}`);

  const loggedIn = !!(saved?.hsUrl && userId && accessToken);

  /* ---------- connect / sync ---------- */
  useEffect(() => {
    if (!saved?.hsUrl || !userId || !accessToken) return;

    const client = createClient({
      baseUrl: saved.hsUrl,
      accessToken,
      userId,
      deviceId: deviceId || undefined,
    });

    clientRef.current = client;
    setReady(false);
    log("Connecting…");

    // Enable end-to-end encryption in the browser build.
    // Verification itself should be done in Element (Settings -> Security & Privacy -> Sessions).
    // But Rust crypto MUST be initialized here or encrypted rooms will not decrypt.
    (async () => {
      try {
        if (typeof client.initRustCrypto === "function") {
          await client.initRustCrypto();
          log("Crypto: Rust initialized");
        } else if (typeof client.initCrypto === "function") {
          await client.initCrypto();
          log("Crypto: legacy initialized");
        } else {
          log("Crypto: not available in this build");
        }
      } catch (e) {
        log("Crypto init failed:", e?.message || String(e));
      }
    })();

    const refreshRooms = () => {
      try {
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
            name: r.name || r.getCanonicalAlias?.() || r.roomId,
            encrypted: !!r.isEncrypted?.(),
          }))
        );
      } catch (e) {
        // ignore
      }
    };

    client.on("sync", (state) => {
      if (state === "PREPARED") {
        setReady(true);
        refreshRooms();
        log("Synced");
      }
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

    client.on("Room", refreshRooms);
    client.on("Room.name", refreshRooms);
    client.on("RoomMember.membership", refreshRooms);

    client.startClient({ initialSyncLimit: 30 });

    return () => {
      try {
        client.stopClient();
        client.removeAllListeners();
      } catch {
        // ignore
      }
      if (clientRef.current === client) clientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.hsUrl, userId, accessToken, deviceId, activeRoomId]);

  /* ---------- session actions ---------- */
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
      // force the component to re-read saved creds
      window.location.hash = window.location.hash;
    } catch (err) {
      log("Login failed:", err?.message || "Unknown error");
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem(`bf_matrix_${orgId}`);
    } catch {
      // ignore
    }

    setUserId("");
    setAccessToken("");
    setDeviceId("");
    setReady(false);
    setRooms([]);
    setActiveRoomId(null);
    setMessages([]);
    setMsg("");

    if (clientRef.current) {
      try {
        clientRef.current.stopClient();
        clientRef.current.removeAllListeners();
      } catch {
        // ignore
      }
      clientRef.current = null;
    }

    log("Logged out");
  };

  const selectRoom = async (roomId) => {
    setActiveRoomId(roomId);
    setMessages([]);

    const client = clientRef.current;
    if (!client) return;

    const room = client.getRoom(roomId);
    if (!room) return;

    const tl = room.getLiveTimeline?.();
    const evs = (tl?.getEvents?.() || []).filter(
      (e) => e.getType() === "m.room.message"
    );

    setMessages(
      evs.map((ev) => ({
        id: ev.getId(),
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

  const currentRoom = useMemo(
    () => rooms.find((r) => r.id === activeRoomId) || null,
    [rooms, activeRoomId]
  );

  const elementRoomUrl = useMemo(() => {
    if (!currentRoom?.id) return "";
    // matrix.to will open Element if installed / default handler
    return `https://matrix.to/#/${encodeURIComponent(currentRoom.id)}`;
  }, [currentRoom]);

  const elementDeviceUrl = useMemo(() => {
    // Element device verification happens in Element settings
    // We cannot deep link reliably; give a stable entry point.
    return "https://app.element.io/";
  }, []);

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
        {loggedIn ? (
          <button className="btn" onClick={logout}>
            Logout
          </button>
        ) : (
          <span className="helper">Not signed in</span>
        )}
        <div className="helper" style={{ marginLeft: "auto" }}>
          {status}
        </div>
      </header>

      {loggedIn && (
        <div className="card" style={{ padding: 12, marginTop: 12 }}>
          <div className="helper">
            <strong>Signed in as:</strong> {userId} · <strong>Device:</strong>{" "}
            {deviceId || "(loading)"} ·{" "}
            <strong>Status:</strong> {ready ? "ready" : "syncing"}
          </div>

          <div className="helper" style={{ marginTop: 8 }}>
            <strong>Verification note:</strong> Device verification and E2EE key
            management are handled in Element. Open Element, go to Settings,
            Security and Privacy, then verify this device ID:{" "}
            <strong>{deviceId || "(loading)"}</strong>.
          </div>

          <div style={{ marginTop: 10 }}>
            <a className="btn" href={elementDeviceUrl} target="_blank" rel="noreferrer">
              Open Element
            </a>
          </div>
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
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 12, marginTop: 12 }}>
          <aside className="card" style={{ padding: 12, minHeight: 420 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 className="section-title" style={{ marginTop: 0, flex: 1 }}>
                Rooms
              </h3>
              <button
                className="btn"
                onClick={() => {
                  const client = clientRef.current;
                  if (!client) return;
                  try {
                    const rs = client.getVisibleRooms?.() || [];
                    setRooms(
                      rs
                        .filter((r) => ["join", "invite"].includes(r.getMyMembership?.()))
                        .sort(
                          (a, b) =>
                            (b.getLastActiveTimestamp?.() || 0) -
                            (a.getLastActiveTimestamp?.() || 0)
                        )
                        .map((r) => ({
                          id: r.roomId,
                          name: r.name || r.getCanonicalAlias?.() || r.roomId,
                          encrypted: !!r.isEncrypted?.(),
                        }))
                    );
                  } catch {
                    // ignore
                  }
                }}
              >
                Refresh
              </button>
            </div>

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

          <main className="card" style={{ padding: 12, minHeight: 420, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 className="section-title" style={{ marginTop: 0, marginBottom: 8, flex: 1 }}>
                {currentRoom ? currentRoom.name : "Select a room"}
                {currentRoom?.encrypted ? " 🔒" : ""}
              </h3>
              {currentRoom && (
                <a className="btn" href={elementRoomUrl} target="_blank" rel="noreferrer" title="Open this room in Element">
                  Open in Element
                </a>
              )}
            </div>

            <div style={{ flex: 1, overflow: "auto", border: "1px solid #222", borderRadius: 8, padding: 8 }}>
              {messages.length === 0 ? (
                <div className="helper">No messages yet.</div>
              ) : (
                messages
                  .slice()
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

            {currentRoom?.encrypted && (
              <div className="helper" style={{ marginTop: 10 }}>
                This room is encrypted. If you see missing history or undecryptable
                messages, verify this device in Element and re open the room.
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
