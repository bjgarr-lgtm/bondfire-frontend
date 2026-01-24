import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  createClient,
  IndexedDBStore,
  IndexedDBCryptoStore,
} from "matrix-js-sdk";

// Pull these from the SDK's crypto-api layer (stable names)
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

  // verification
  const [verificationReq, setVerificationReq] = useState(null);
  const [sasData, setSasData] = useState(null); // {emoji?: [emoji,name][], decimal?: number[], confirm():Promise, mismatch():Promise}
  const [verifyMsg, setVerifyMsg] = useState("");

  // rooms / messages
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msg, setMsg] = useState("");

  const clientRef = useRef(null);
  const verifierRef = useRef(null);
  const log = (...a) => setStatus(`[${ts()}] ${a.join(" ")}`);

  // IMPORTANT:
  // The crypto store in matrix-js-sdk is tied to a specific device.
  // If you reuse the same IndexedDB name across multiple device IDs, you get:
  // "the account in the store doesn't match the account in the constructor".
  const storeDbName = (uid, did) => `bf_mx_store_${uid}_${did || "nodev"}`;
  const cryptoDbName = (uid, did) => `bf_mx_crypto_${uid}_${did || "nodev"}`;

  /* ---------- boot / resume ---------- */
  useEffect(() => {
    if (!saved?.hsUrl || !userId || !accessToken) return;

    const baseUrl = saved.hsUrl;

    const store = new IndexedDBStore({
      indexedDB: window.indexedDB,
      localStorage: window.localStorage,
      dbName: storeDbName(userId, deviceId),
    });

    const cryptoStore = new IndexedDBCryptoStore(
      window.indexedDB,
      cryptoDbName(userId, deviceId)
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

    (async () => {
      try {
        await store.startup();
      } catch (e) {
        log("Store startup failed:", e?.message || e);
      }

      try {
        // Prefer Rust crypto (encryption + verification support).
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

      // Sync ready
      client.on("sync", (state) => {
        if (state === "PREPARED") {
          setReady(true);
          refreshRooms();
        }
      });

      // Verification requests from Element
      client.on(CryptoEvent.VerificationRequestReceived, (req) => {
        setVerificationReq(req);
        setSasData(null);
        setVerifyMsg("");
        log(
          "Verification request from",
          req.otherUserId,
          req.otherDeviceId
        );

        req.on?.("change", () => {
          // Keep UI fresh and clear hanging status when the flow completes.
          try {
            // crypto-api requests expose phase/isDone depending on backend
            const phase = req.phase;
            const done = typeof req.isDone === "function" ? req.isDone() : req.done;
            const cancelled = typeof req.isCancelled === "function" ? req.isCancelled() : req.cancelled;

            if (done || phase === 4) {
              setVerifyMsg("Verified ✅");
              setTimeout(() => setVerifyMsg(""), 1200);
              setSasData(null);
              setVerificationReq(null);
            } else if (cancelled) {
              setVerifyMsg("Cancelled");
              setTimeout(() => setVerifyMsg(""), 1200);
              setSasData(null);
              setVerificationReq(null);
            }
          } catch {
            // ignore
          }
          setVerificationReq(req);
        });
      });

      // Live messages
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

      function refreshRooms() {
        const rs = client
          .getVisibleRooms()
          .filter((r) => ["join", "invite"].includes(r.getMyMembership()))
          .sort(
            (a, b) =>
              (b.getLastActiveTimestamp() || 0) - (a.getLastActiveTimestamp() || 0)
          );
        setRooms(
          rs.map((r) => ({
            id: r.roomId,
            name: r.name || r.getCanonicalAlias() || r.roomId,
            encrypted: r.isEncrypted?.(),
          }))
        );
      }
    })();

    return () => {
      try {
        client.stopClient();
        client.removeAllListeners();
      } catch {}
      clientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.hsUrl, userId, accessToken, deviceId]);

  /* -------- verification actions -------- */
  async function acceptVerification() {
    const req = verificationReq;
    if (!req) return;
    try {
      if (!canAcceptVerificationRequest(req)) {
        setVerifyMsg("Cannot accept: request is already in progress.");
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
      // m.sas.v1 is the canonical method string.
      const verifier = await req.startVerification("m.sas.v1");
      verifierRef.current = verifier;

      const handleShowSas = async (sasLike) => {
        // Different crypto backends/SDK versions hand us different shapes.
        // We normalize to: { emoji?: [emoji, name][], decimal?: number[], confirm, mismatch }
        const raw = sasLike?.sas ? sasLike.sas : sasLike;

        let emoji = null;
        let decimal = null;
        try {
          if (Array.isArray(raw?.emoji)) {
            emoji = raw.emoji.map((e) => [e.emoji || e[0], e.description || e[1]]);
          } else if (typeof raw?.getEmoji === "function") {
            const e = await Promise.resolve(raw.getEmoji());
            if (Array.isArray(e)) {
              emoji = e.map((it) => {
                // some builds return tuples [emoji, name], others return objects {emoji, description}
                if (Array.isArray(it)) return [it[0], it[1]];
                return [it?.emoji, it?.description || it?.name];
              });
            }
          }
        } catch {}
        try {
          if (Array.isArray(raw?.decimal)) {
            decimal = raw.decimal;
          } else if (typeof raw?.getDecimal === "function") {
            const d = await Promise.resolve(raw.getDecimal());
            if (Array.isArray(d)) decimal = d;
          }
        } catch {}

        // confirm/mismatch may live on raw or wrapper
        const confirm = sasLike?.confirm || raw?.confirm;
        const mismatch = sasLike?.mismatch || raw?.mismatch;

        setSasData({ emoji, decimal, confirm, mismatch });
      };

      // Stable enums (crypto-api)
      verifier.on(VerifierEvent.ShowSas, handleShowSas);
      verifier.on(VerifierEvent.Done, () => {
        setVerifyMsg("Verified ✅");
        setTimeout(() => setVerifyMsg(""), 1200);
        setSasData(null);
        setVerificationReq(null);
        verifierRef.current = null;
      });

      verifier.on(VerifierEvent.Cancel, (e) => {
        setVerifyMsg(`Cancelled: ${e?.reason || "unknown"}`);
        setTimeout(() => setVerifyMsg(""), 1500);
        setSasData(null);
        setVerificationReq(null);
        verifierRef.current = null;
      });

      // Fallback event names used by some SDK builds
      verifier.on?.("show_sas", handleShowSas);
      verifier.on?.("done", () => {
        setVerifyMsg("Verified ✅");
        setTimeout(() => setVerifyMsg(""), 1200);
        setSasData(null);
        setVerificationReq(null);
        verifierRef.current = null;
      });
      verifier.on?.("cancel", () => {
        setVerifyMsg("Cancelled");
        setTimeout(() => setVerifyMsg(""), 1500);
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
      // If the SDK never emits Done (it happens), don't leave the UI hanging forever.
      window.setTimeout(() => {
        setVerifyMsg((prev) => (prev?.includes("Waiting") ? "" : prev));
      }, 6000);
    } catch (e) {
      setVerifyMsg(e?.message || String(e));
    }
  }

  async function resetMatrixStorage() {
    // Clears localStorage token and nukes IndexedDB stores for this org/user.
    const uid = userId || saved?.userId;
    const did = deviceId || saved?.deviceId;
    try {
      localStorage.removeItem(`bf_matrix_${orgId}`);
    } catch {}
    try {
      const names = new Set([
        storeDbName(uid, did),
        cryptoDbName(uid, did),
        // legacy names from older builds
        `bf_mx_store_${uid}`,
        `bf_mx_crypto_${uid}`,
      ]);
      for (const n of names) {
        try {
          window.indexedDB.deleteDatabase(n);
        } catch {}
      }
    } catch {}
    // Then do a normal logout reset
    logout();
    log("Matrix storage reset");
  }

  async function mismatchSas() {
    try {
      await sasData?.mismatch?.();
    } catch (e) {
      setVerifyMsg(e?.message || String(e));
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

  /* -------- derived / render -------- */
  const loggedIn = !!(saved?.hsUrl && userId && accessToken);
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
        <button className="btn" onClick={logout}>Logout</button>
        <button className="btn" onClick={resetMatrixStorage}>Reset Matrix storage</button>
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
            Verify this session (so Element stops judging you)
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
                  Code: {Array.isArray(sasData.decimal) ? sasData.decimal.join(" ") : ""}
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

          {verifyMsg && <div className="helper" style={{ marginTop: 8 }}>{verifyMsg}</div>}
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
      )}
    </div>
  );
}
