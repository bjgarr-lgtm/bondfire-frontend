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
function removeKey(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function parseOrgIdFromHash() {
  const m = (window.location.hash || "").match(/#\/org\/([^/]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

const ts = legibleNow;
function legibleNow() {
  return new Date().toLocaleTimeString();
}

function safeIdForEvent(ev) {
  return ev?.getId?.() || `${ev?.getSender?.() || "?"}:${ev?.getTs?.() || Date.now()}`;
}

function eventToMsg(ev) {
  const content = ev?.getContent?.() || {};
  const body = content?.body;
  const msgtype = content?.msgtype;

  // matrix-js-sdk represents undecryptable messages as m.room.message with msgtype "m.bad.encrypted"
  // and/or provides isDecryptionFailure(). Some homeservers also stuff a human-readable string into body.
  const undecryptable =
    !!ev?.isDecryptionFailure?.() ||
    msgtype === "m.bad.encrypted" ||
    (typeof body === "string" && /unable to decrypt|decryptionerror/i.test(body));

  return {
    id: safeIdForEvent(ev),
    body: typeof body === "string" ? body : "",
    sender: ev?.getSender?.() || "",
    ts: ev?.getTs?.() || Date.now(),
    encrypted: !!ev?.isEncrypted?.(),
    undecryptable,
    msgtype: msgtype || "",
  };
}

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

  // UI toggles (persist per-org)
  const [hideUndecryptable, setHideUndecryptable] = useState(
    readJSON(`bf_chat_hide_undecryptable_${orgId}`, true)
  );
  const [newestFirst, setNewestFirst] = useState(
    readJSON(`bf_chat_newest_first_${orgId}`, false)
  );

  const clientRef = useRef(null);
  const verifierRef = useRef(null);
  const activeRoomIdRef = useRef(null);
  const stoppedRef = useRef(false);

  const log = (...a) => setStatus(`[${ts()}] ${a.join(" ")}`);

  /* ---------- persist toggles ---------- */
  useEffect(() => {
    writeJSON(`bf_chat_hide_undecryptable_${orgId}`, hideUndecryptable);
  }, [orgId, hideUndecryptable]);

  useEffect(() => {
    writeJSON(`bf_chat_newest_first_${orgId}`, newestFirst);
  }, [orgId, newestFirst]);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  /* ---------- cleanup verification ---------- */
  const cleanupVerification = (finalMsg = "") => {
    setSasData(null);
    setVerificationReq(null);
    verifierRef.current = null;
    if (finalMsg) {
      setVerifyMsg(finalMsg);
      setTimeout(() => setVerifyMsg(""), 1400);
    } else {
      setVerifyMsg("");
    }
  };

  /* ---------- boot / resume (MOUNT-ONLY) ---------- */
  useEffect(() => {
    // do not start without session
    if (!saved?.hsUrl || !saved?.userId || !saved?.accessToken) return;

    // if a client already exists, do nothing
    if (clientRef.current) return;

    stoppedRef.current = false;

    const baseUrl = saved.hsUrl;
    const uid = saved.userId;
    const token = saved.accessToken;
    const did = saved.deviceId || "";

    // Keep state aligned with storage
    setUserId(uid);
    setAccessToken(token);
    setDeviceId(did);

    const store = new IndexedDBStore({
      indexedDB: window.indexedDB,
      localStorage: window.localStorage,
      dbName: `bf_mx_store_${uid}`,
    });

    const cryptoStore = new IndexedDBCryptoStore(
      window.indexedDB,
      `bf_mx_crypto_${uid}`
    );

    const client = createClient({
      baseUrl,
      accessToken: token,
      userId: uid,
      deviceId: did || undefined,
      store,
      cryptoStore,
    });

    clientRef.current = client;
    log("Connecting…");

    function refreshRooms() {
      try {
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
      } catch (e) {
        // ignore
      }
    }

    function onTimeline(ev, room, toStartOfTimeline) {
      if (stoppedRef.current) return;
      if (toStartOfTimeline) return;
      if (ev?.getType?.() !== "m.room.message") return;

      const current = activeRoomIdRef.current;
      if (!current || room?.roomId !== current) return;

      const m = eventToMsg(ev);

      // De-dupe and update
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, m];
      });
    }

    function onVerificationReq(req) {
      setVerificationReq(req);
      setSasData(null);
      setVerifyMsg("");
      log("Verification request from", req.otherUserId, req.otherDeviceId);

      req.on?.("change", () => {
        // keep state warm
        setVerificationReq(req);
      });
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
          log("Crypto init not available");
        }
      } catch (e) {
        setCryptoReady(false);
        log("Crypto init failed:", e?.message || e);
      }

      // If a verification request already exists (e.g. app reloaded mid-flow),
      // hydrate it so the UI actually shows something.
      try {
        const crypto = client.getCrypto?.();
        const myUid = client.getUserId?.() || uid;
        const pending = crypto?.getVerificationRequestsToDeviceInProgress?.(myUid);
        if (pending && pending.length) onVerificationReq(pending[0]);
      } catch {
        // ignore
      }

      client.on("sync", (state) => {
        if (state === "PREPARED") {
          setReady(true);
          refreshRooms();
        }
      });

      client.on(CryptoEvent.VerificationRequestReceived, onVerificationReq);
      client.on("Room.timeline", onTimeline);

      client.startClient({ initialSyncLimit: 30 });
    })();

    return () => {
      stoppedRef.current = true;
      try {
        client.stopClient();
        client.removeAllListeners();
      } catch {}
      clientRef.current = null;
    };
  }, [saved?.hsUrl, saved?.userId, saved?.accessToken, saved?.deviceId]);

  /* -------- verification actions -------- */
  async function requestOwnVerification() {
    const client = clientRef.current;
    if (!client) return;
    try {
      setVerifyMsg("");
      const crypto = client.getCrypto?.();
      if (!crypto?.requestOwnUserVerification) {
        setVerifyMsg("This Matrix build can't request verification (missing requestOwnUserVerification). Use another client to initiate.");
        return;
      }
      const req = await crypto.requestOwnUserVerification();
      setVerificationReq(req);
      setSasData(null);
      setVerifyMsg("Verification request sent. Accept it on your other device, then click Start SAS.");
    } catch (e) {
      setVerifyMsg(e?.message || String(e));
    }
  }

  function checkPendingVerification() {
    const client = clientRef.current;
    if (!client) return;
    try {
      const crypto = client.getCrypto?.();
      const myUid = client.getUserId?.() || saved?.userId || userId;
      const pending = crypto?.getVerificationRequestsToDeviceInProgress?.(myUid) || [];
      if (pending.length) {
        setVerificationReq(pending[0]);
        setVerifyMsg("Found an in-progress verification. Continue below.");
      } else {
        setVerifyMsg("No in-progress verification found.");
      }
    } catch (e) {
      setVerifyMsg(e?.message || String(e));
    }
  }

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

    // If we already started a verifier, do not double-start.
    if (verifierRef.current) {
      setVerifyMsg("SAS already started. Use Confirm or Doesn’t match.");
      return;
    }

    try {
      setVerifyMsg("");
      setSasData(null);

      const verifier = await req.startVerification("m.sas.v1");
      verifierRef.current = verifier;

      verifier.on(VerifierEvent.ShowSas, (sas) => {
        // matrix-js-sdk gives { sas: {emoji|decimal}, confirm, mismatch }
        const payload = sas?.sas || {};
        const emoji = Array.isArray(payload.emoji)
          ? payload.emoji
              .map((e) => {
                // tuple form: ["🐶", "dog"]
                if (Array.isArray(e)) return [e[0], e[1]];
                // object form: { emoji: "🐶", description: "dog" }
                if (e && typeof e === "object") return [e.emoji, e.description || e.name];
                return null;
              })
              .filter((pair) => Array.isArray(pair) && pair[0])
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
        cleanupVerification("Verified ✅");
      });

      verifier.on(VerifierEvent.Cancel, (e) => {
        cleanupVerification(`Cancelled: ${e?.reason || "unknown"}`);
      });

      // Some flows do not emit Done cleanly on this side.
      verifier.on?.("change", () => {
        try {
          if (typeof verifier.isDone === "function" && verifier.isDone()) {
            cleanupVerification("Verified ✅");
          }
        } catch {
          // ignore
        }
      });

      await verifier.verify();
    } catch (e) {
      verifierRef.current = null;
      setVerifyMsg(e?.message || String(e));
    }
  }

  async function confirmSas() {
    try {
      await sasData?.confirm?.();
      setVerifyMsg("Confirmed. Waiting for other device…");
      // In case other side never sends Done back, clear after a bit.
      setTimeout(() => {
        if (verifierRef.current) cleanupVerification("Verified ✅");
      }, 6500);
    } catch (e) {
      setVerifyMsg(e?.message || String(e));
    }
  }

  async function mismatchSas() {
    try {
      await sasData?.mismatch?.();
      cleanupVerification("Mismatch sent.");
    } catch (e) {
      setVerifyMsg(e?.message || String(e));
    }
  }

  /* -------------- session -------------- */
  const loggedIn = !!(saved?.hsUrl && saved?.userId && saved?.accessToken);

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

      const next = {
        hsUrl: baseUrl,
        userId: res.user_id,
        accessToken: res.access_token,
        deviceId: res.device_id || "",
      };

      writeJSON(`bf_matrix_${orgId}`, next);

      setUserId(next.userId);
      setAccessToken(next.accessToken);
      setDeviceId(next.deviceId);

      setPassword("");
      window.location.hash = window.location.hash;
    } catch (err) {
      log("Login failed:", err?.message || "Unknown error");
    }
  };

  const logout = () => {
    removeKey(`bf_matrix_${orgId}`);

    setUserId("");
    setAccessToken("");
    setDeviceId("");
    setReady(false);
    setCryptoReady(false);
    setRooms([]);
    setActiveRoomId(null);
    setMessages([]);
    setMsg("");
    cleanupVerification("");

    if (clientRef.current) {
      try {
        clientRef.current.stopClient();
        clientRef.current.removeAllListeners();
      } catch {}
      clientRef.current = null;
    }

    log("Logged out");
  };

  const resetMatrixStorage = () => {
    // fixes the "store account mismatch" trap
    // kill session + also nuke local indexeddb/crypto by changing dbName key space
    removeKey(`bf_matrix_${orgId}`);
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

    const mapped = evs.map(eventToMsg);
    setMessages(mapped);
  };

  const send = async (e) => {
    e.preventDefault();
    const client = clientRef.current;
    if (!client || !activeRoomId || !msg.trim()) return;

    const body = msg.trim();
    setMsg("");

    // optimistic insert so you see it instantly
    const optimistic = {
      id: `local:${Date.now()}:${Math.random().toString(16).slice(2)}`,
      body,
      sender: saved?.userId || userId || "",
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
    const base = hideUndecryptable ? messages.filter((m) => !m.undecryptable) : messages;
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
          <strong>Signed in as:</strong> {saved?.userId || userId} ·{" "}
          <strong>Device:</strong> {saved?.deviceId || deviceId || "(loading)"}{" "}
          {cryptoReady ? "🔒" : "🟡"}
        </div>
      )}

      {/* Verification banner */}
      {loggedIn && (
        <div className="card" style={{ padding: 12, marginTop: 12 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Verify this session
          </h3>

          {!cryptoReady ? (
            <div className="helper">
              Crypto isn’t ready yet, so verification can’t start. If this stays
              yellow, your homeserver or build is missing E2EE support.
            </div>
          ) : verificationReq ? (
            <>
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
                      {Array.isArray(sasData.decimal)
                        ? sasData.decimal.join(" ")
                        : ""}
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
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button className="btn" onClick={acceptVerification}>
                    Accept
                  </button>
                  <button className="btn" onClick={startSas}>
                    Start SAS
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="helper">
                No active verification request. If you have another device (or
                another client) for this Matrix account, request verification
                below or start it from the other side.
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn" onClick={requestOwnVerification}>
                  Request verification
                </button>
                <button className="btn" onClick={checkPendingVerification}>
                  Check pending
                </button>
              </div>
            </>
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
                    <div>
                      {m.body || <span className="helper">(undecryptable)</span>}
                    </div>
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
