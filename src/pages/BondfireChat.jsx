// src/pages/BondfireChat.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  createClient,
  IndexedDBStore,
  IndexedDBCryptoStore,
} from "matrix-js-sdk";

import {
  CryptoEvent,
  VerifierEvent,
  canAcceptVerificationRequest,
} from "matrix-js-sdk/lib/crypto-api";

/* ---------------- helpers ---------------- */
function readJSON(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function parseOrgIdFromHash() {
  const m = (window.location.hash || "").match(/#\/org\/([^/]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

const ts = () => new Date().toLocaleTimeString();

/* --------------- component --------------- */
export default function BondfireChat() {
  const params = useParams();
  const orgId = params.orgId || parseOrgIdFromHash();

  const saved = readJSON(`bf_matrix_${orgId}`, null);

  // login form
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

  // verification
  const [verificationReq, setVerificationReq] = useState(null);
  const [sasData, setSasData] = useState(null); // {emoji, decimal, confirm, mismatch}
  const [verifyMsg, setVerifyMsg] = useState("");

  // rooms / messages
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msg, setMsg] = useState("");

  // UI toggles
  const [hideUndecryptable, setHideUndecryptable] = useState(
    readJSON(`bf_chat_hide_undecryptable_${orgId}`, true)
  );
  const [newestFirst, setNewestFirst] = useState(
    readJSON(`bf_chat_newest_first_${orgId}`, false)
  );

  const clientRef = useRef(null);
  const verifierRef = useRef(null);

  const log = (...a) => setStatus(`[${ts()}] ${a.join(" ")}`);

  /* ---------- persistent toggle storage ---------- */
  useEffect(() => {
    writeJSON(`bf_chat_hide_undecryptable_${orgId}`, hideUndecryptable);
  }, [orgId, hideUndecryptable]);

  useEffect(() => {
    writeJSON(`bf_chat_newest_first_${orgId}`, newestFirst);
  }, [orgId, newestFirst]);

  /* ---------- boot / resume ---------- */
  useEffect(() => {
    if (!saved?.hsUrl || !userId || !accessToken) return;

    const baseUrl = saved.hsUrl;

    const store = new IndexedDBStore({
      indexedDB: window.indexedDB,
      localStorage: window.localStorage,
      dbName: `bf_mx_store_${userId}`,
    });

    const cryptoStore = new IndexedDBCryptoStore(
      window.indexedDB,
      `bf_mx_crypto_${userId}`
    );

    const client = createClient({
      baseUrl,
      accessToken,
      userId,
      deviceId: deviceId || undefined,
      store,
      cryptoStore,
    });

    clientRef.current = client;
    log("Connecting…");

    let stopped = false;

    function refreshRooms() {
      const rs = client
        .getVisibleRooms()
        .filter((r) => ["join", "invite"].includes(r.getMyMembership()))
        .sort(
          (a, b) =>
            (b.getLastActiveTimestamp?.() || 0) -
            (a.getLastActiveTimestamp?.() || 0)
        );

      setRooms(
        rs.map((r) => ({
          id: r.roomId,
          name: r.name || r.getCanonicalAlias?.() || r.roomId,
          encrypted: !!r.isEncrypted?.(),
        }))
      );
    }

    function eventToMsg(ev) {
      const body = ev?.getContent?.()?.body;
      return {
        id: ev.getId?.() || `${ev.getSender?.()}:${ev.getTs?.()}`,
        body: typeof body === "string" ? body : "",
        sender: ev.getSender?.() || "",
        ts: ev.getTs?.() || Date.now(),
        encrypted: !!ev.isEncrypted?.(),
      };
    }

    (async () => {
      try {
        await store.startup();
      } catch (e) {
        log("Store startup failed:", e?.message || e);
      }

      try {
        if (typeof client.initRustCrypto === "function") {
          await client.initRustCrypto();
          setCryptoReady(true);
        } else if (typeof client.initCrypto === "function") {
          await client.initCrypto();
          setCryptoReady(true);
        } else {
          setCryptoReady(false);
          log("Crypto init not available on this build");
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

      // verification request received
      client.on(CryptoEvent.VerificationRequestReceived, (req) => {
        setVerificationReq(req);
        setSasData(null);
        setVerifyMsg("");
        log("Verification request from", req.otherUserId, req.otherDeviceId);

        req.on?.("change", () => {
          setVerificationReq(req);
        });
      });

      // live messages
      client.on("Room.timeline", (ev, room, toStartOfTimeline) => {
        if (stopped) return;
        if (toStartOfTimeline) return;
        if (!activeRoomId || room?.roomId !== activeRoomId) return;
        if (ev.getType?.() !== "m.room.message") return;

        const m = eventToMsg(ev);

        // hide undecryptable means: if there is no body, do not show
        if (hideUndecryptable && !m.body) return;

        setMessages((prev) => {
          // de-dupe on id
          if (prev.some((x) => x.id === m.id)) return prev;
          return [...prev, m];
        });
      });

      client.startClient({ initialSyncLimit: 30 });
    })();

    return () => {
      stopped = true;
      try {
        client.stopClient();
        client.removeAllListeners();
      } catch {}
      clientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.hsUrl, userId, accessToken, deviceId, activeRoomId, hideUndecryptable]);

  /* -------- verification actions -------- */
  async function acceptVerification() {
    const req = verificationReq;
    if (!req) return;
    try {
      if (!canAcceptVerificationRequest(req)) {
        setVerifyMsg("Cannot accept: request already in progress.");
        return;
      }
      await req.accept();
      setVerifyMsg("Accepted. Now click Start SAS.");
    } catch (e) {
      setVerifyMsg(e?.message || String(e));
    }
  }

  async function startSas() {
    const req = verificationReq;
    if (!req) return;

    try {
      setVerifyMsg("");
      setSasData(null);

      const verifier = await req.startVerification("m.sas.v1");
      verifierRef.current = verifier;

      verifier.on(VerifierEvent.ShowSas, (sas) => {
        const payload = sas?.sas || {};
        const emoji = payload.emoji
          ? payload.emoji.map((e) => [e.emoji, e.description])
          : null;
        const decimal = payload.decimal ? payload.decimal : null;

        setSasData({
          emoji,
          decimal,
          confirm: sas.confirm,
          mismatch: sas.mismatch,
        });
      });

      verifier.on(VerifierEvent.Done, () => {
        setVerifyMsg("Verified ✅");
        setSasData(null);
        setVerificationReq(null);
        verifierRef.current = null;

        // auto clear after a second so it does not hang forever
        setTimeout(() => setVerifyMsg(""), 1200);
      });

      verifier.on(VerifierEvent.Cancel, (e) => {
        setVerifyMsg(`Cancelled: ${e?.reason || "unknown"}`);
        setSasData(null);
        setVerificationReq(null);
        verifierRef.current = null;
      });

      await verifier.verify();
    } catch (e) {
      setVerifyMsg(e?.message || String(e));
    }
  }

  async function confirmSas() {
    try {
      await sasData?.confirm?.();
      setVerifyMsg("Confirmed. Waiting for other device…");
    } catch (e) {
      setVerifyMsg(e?.message || String(e));
    }
  }

  async function mismatchSas() {
    try {
      await sasData?.mismatch?.();
      setVerifyMsg("Mismatch sent.");
    } catch (e) {
      setVerifyMsg(e?.message || String(e));
    }
  }

  /* -------------- session -------------- */
  const loggedIn = !!(saved?.hsUrl && userId && accessToken);

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

      writeJSON(`bf_matrix_${orgId}`, {
        hsUrl: baseUrl,
        userId: res.user_id,
        accessToken: res.access_token,
        deviceId: res.device_id || "",
      });

      setPassword("");
      // trigger resume
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
    setVerificationReq(null);
    setSasData(null);
    setVerifyMsg("");
    setRooms([]);
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

  const resetMatrixStorage = async () => {
    // This clears the stored session and forces a clean login.
    // It also avoids the "store account mismatch" hell when device ids change.
    try {
      localStorage.removeItem(`bf_matrix_${orgId}`);
    } catch {}
    logout();
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
    const evs = (tl?.getEvents?.() || []).filter(
      (e) => e.getType?.() === "m.room.message"
    );

    const mapped = evs.map((ev) => {
      const body = ev?.getContent?.()?.body;
      return {
        id: ev.getId?.() || `${ev.getSender?.()}:${ev.getTs?.()}`,
        body: typeof body === "string" ? body : "",
        sender: ev.getSender?.() || "",
        ts: ev.getTs?.() || Date.now(),
        encrypted: !!ev.isEncrypted?.(),
      };
    });

    const filtered = hideUndecryptable ? mapped.filter((m) => !!m.body) : mapped;
    setMessages(filtered);
  };

  const send = async (e) => {
    e.preventDefault();
    const client = clientRef.current;
    if (!client || !activeRoomId || !msg.trim()) return;

    const body = msg.trim();
    setMsg("");

    // optimistic insert so you see it immediately
    const optimistic = {
      id: `local:${Date.now()}:${Math.random()}`,
      body,
      sender: userId,
      ts: Date.now(),
      encrypted: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      await client.sendEvent(
        activeRoomId,
        "m.room.message",
        { msgtype: "m.text", body },
        ""
      );
    } catch (err) {
      log("Send failed:", err?.message || "Unknown error");
    }
  };

  /* -------- derived / render -------- */
  const currentRoom = useMemo(
    () => rooms.find((r) => r.id === activeRoomId) || null,
    [rooms, activeRoomId]
  );

  const shownMessages = useMemo(() => {
    const base = hideUndecryptable ? messages.filter((m) => !!m.body) : messages;
    const sorted = [...base].sort((a, b) => a.ts - b.ts);
    return newestFirst ? sorted.reverse() : sorted;
  }, [messages, hideUndecryptable, newestFirst]);

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
        <button className="btn" onClick={resetMatrixStorage}>
          Reset Matrix storage
        </button>
        <div className="helper" style={{ marginLeft: "auto" }}>
          {status}
        </div>
      </header>

      {loggedIn && (
        <div className="helper" style={{ marginTop: 8 }}>
          <strong>Signed in as:</strong> {userId} · <strong>Device:</strong>{" "}
          {deviceId || "(loading)"} {cryptoReady ? "🔒" : "🟡"}
        </div>
      )}

      {/* Verification banner */}
      {verificationReq && (
        <div className="card" style={{ padding: 12, marginTop: 12 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Verify this session
          </h3>
          <div className="helper">
            From: {verificationReq.otherUserId} · {verificationReq.otherDeviceId}
          </div>

          {sasData?.emoji || sasData?.decimal ? (
            <>
              {sasData.emoji ? (
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "center",
                    marginTop: 12,
                  }}
                >
                  {sasData.emoji.map(([emoji, name], i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        minWidth: 56,
                      }}
                    >
                      <div style={{ fontSize: 28, lineHeight: 1 }}>{emoji}</div>
                      <div style={{ fontSize: 11, opacity: 0.8 }}>{name}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="helper" style={{ marginTop: 12 }}>
                  Code:{" "}
                  {Array.isArray(sasData.decimal) ? sasData.decimal.join(" ") : ""}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="btn" onClick={confirmSas}>
                  Confirm match
                </button>
                <button className="btn" onClick={mismatchSas}>
                  Doesn’t match
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn" onClick={acceptVerification}>
                Accept
              </button>
              <button className="btn" onClick={startSas}>
                Start SAS
              </button>
            </div>
          )}

          {verifyMsg && (
            <div className="helper" style={{ marginTop: 8 }}>
              {verifyMsg}
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "280px 1fr",
            gap: 12,
            marginTop: 12,
          }}
        >
          <aside className="card" style={{ padding: 12, minHeight: 420 }}>
            <h3 className="section-title" style={{ marginTop: 0 }}>
              Rooms
            </h3>

            <div style={{ marginBottom: 10 }}>
              <label className="row" style={{ gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={hideUndecryptable}
                  onChange={(e) => setHideUndecryptable(e.target.checked)}
                />
                <span className="helper">Hide undecryptable</span>
              </label>
              <label className="row" style={{ gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={newestFirst}
                  onChange={(e) => setNewestFirst(e.target.checked)}
                />
                <span className="helper">Newest first</span>
              </label>
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

          <main
            className="card"
            style={{
              padding: 12,
              minHeight: 420,
              display: "flex",
              flexDirection: "column",
            }}
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
              {shownMessages.length === 0 ? (
                <div className="helper">No messages yet.</div>
              ) : (
                shownMessages.map((m) => (
                  <div key={m.id} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {m.sender} · {new Date(m.ts).toLocaleString()}{" "}
                      {m.encrypted ? "🔒" : ""}
                    </div>
                    <div>{m.body || <span className="helper">(undecryptable)</span>}</div>
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
      )}
    </div>
  );
}
