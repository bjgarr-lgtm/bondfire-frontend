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

// Hardcoded homeserver: one less field for humans to mess up.
const BF_MATRIX_HS_URL = "https://matrix-client.matrix.org";

// Keep a single Matrix client alive per browser tab so switching away from the
// Chat page doesn't make it look like you're reconnecting or re-verifying.
const BF_MATRIX_GLOBAL = "__bf_matrix_client__";

function getGlobalMatrix() {
  try {
    return window[BF_MATRIX_GLOBAL] || null;
  } catch {
    return null;
  }
}

function setGlobalMatrix(v) {
  try {
    window[BF_MATRIX_GLOBAL] = v;
  } catch {}
}

function clearGlobalMatrix() {
  try {
    delete window[BF_MATRIX_GLOBAL];
  } catch {
    try {
      window[BF_MATRIX_GLOBAL] = null;
    } catch {}
  }
}

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

// Local flag so the UI can remember that THIS browser device was verified.
// This is not the source of truth for encryption, it is a convenience signal.
function verifiedKeyFor(userId, deviceId) {
  const u = String(userId || "").replace(/[^a-zA-Z0-9._=-]/g, "_");
  const d = String(deviceId || "").replace(/[^a-zA-Z0-9._=-]/g, "_");
  return `bf_mx_verified_${u}_${d}`;
}

const ts = legibleNow;
function legibleNow() {
  return new Date().toLocaleTimeString();
}

function safeIdForEvent(ev) {
  return (
    ev?.getId?.() ||
    `${ev?.getSender?.() || "?"}:${ev?.getTs?.() || Date.now()}`
  );
}

// mxc -> http(s)
function mxcToHttp(client, mxc, size = 64) {
  try {
    if (!client || !mxc) return "";
    if (typeof client.mxcUrlToHttp === "function") {
      return client.mxcUrlToHttp(mxc, size, size, "crop");
    }
  } catch {}
  return "";
}

function eventToMsg(ev) {
  const content = ev?.getContent?.() || {};
  const body = content?.body;
  const msgtype = content?.msgtype;

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

  // Ensure any existing saved session has the hardcoded HS url filled.
  const savedRaw = readJSON(`bf_matrix_${orgId}`, null);
  const saved = savedRaw
    ? {
        ...savedRaw,
        hsUrl: BF_MATRIX_HS_URL,
      }
    : null;

  if (savedRaw && savedRaw.hsUrl !== BF_MATRIX_HS_URL) {
    writeJSON(`bf_matrix_${orgId}`, saved);
  }

  // login form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // session
  const [userId, setUserId] = useState(saved?.userId || "");
  const [accessToken, setAccessToken] = useState(saved?.accessToken || "");
  const [deviceId, setDeviceId] = useState(saved?.deviceId || "");
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);
  const [cryptoReady, setCryptoReady] = useState(false);
  const [deviceVerified, setDeviceVerified] = useState(() => {
    const k = verifiedKeyFor(saved?.userId || "", saved?.deviceId || "");
    return k ? !!readJSON(k, false) : false;
  });

  // verification
  const [verificationReq, setVerificationReq] = useState(null);
  const [sasData, setSasData] = useState(null);
  const [verifyMsg, setVerifyMsg] = useState("");

  // rooms / messages
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msg, setMsg] = useState("");

  // avatars
  const [avatarMap, setAvatarMap] = useState({}); // sender -> http url

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

  const markThisDeviceVerified = React.useCallback(() => {
    try {
      const uidKey =
        clientRef.current?.getUserId?.() || saved?.userId || userId || "";
      const didKey =
        clientRef.current?.getDeviceId?.() ||
        saved?.deviceId ||
        deviceId ||
        "";
      const k = verifiedKeyFor(uidKey, didKey);
      setDeviceVerified(true);
      if (k) writeJSON(k, true);
    } catch {
      setDeviceVerified(true);
    }
  }, [saved?.userId, saved?.deviceId, userId, deviceId]);

  async function ensureCrypto(client) {
    try {
      if (!client) return false;

      const existing = client.getCrypto?.();
      if (existing) {
        setCryptoReady(true);
        return true;
      }

      if (typeof client.initRustCrypto === "function") {
        await client.initRustCrypto();
      } else if (typeof client.initCrypto === "function") {
        await client.initCrypto();
      } else {
        setCryptoReady(false);
        return false;
      }

      const readyCrypto = !!client.getCrypto?.();
      setCryptoReady(readyCrypto);
      return readyCrypto;
    } catch (e) {
      setCryptoReady(false);
      log("Crypto init failed:", e?.message || e);
      return false;
    }
  }

  /* ---------- boot / resume (MOUNT-ONLY) ---------- */
  useEffect(() => {
    if (!saved?.userId || !saved?.accessToken) return;
    if (clientRef.current) return;

    stoppedRef.current = false;

    const baseUrl = BF_MATRIX_HS_URL;
    const uid = saved.userId;
    const token = saved.accessToken;
    const did = saved.deviceId || "";

    setUserId(uid);
    setAccessToken(token);
    setDeviceId(did);

    const g = getGlobalMatrix();
    const sameDevice = !did || (g?.deviceId || "") === did;
    const canReuse =
      g &&
      g.client &&
      g.baseUrl === baseUrl &&
      g.userId === uid &&
      g.accessToken === token &&
      sameDevice;

    let client = null;
    let store = null;
    let cryptoStore = null;

    if (canReuse) {
      client = g.client;
      if (!did && g?.deviceId) setDeviceId(g.deviceId);
      log("Connected (resumed)");
    } else {
      const dbKey = `${uid}_${did || "nodevice"}`;

      store = new IndexedDBStore({
        indexedDB: window.indexedDB,
        localStorage: window.localStorage,
        dbName: `bf_mx_store_${dbKey}`,
      });

      cryptoStore = new IndexedDBCryptoStore(
        window.indexedDB,
        `bf_mx_crypto_${dbKey}`
      );

      client = createClient({
        baseUrl,
        accessToken: token,
        userId: uid,
        deviceId: did || undefined,
        store,
        cryptoStore,
      });

      setGlobalMatrix({
        client,
        baseUrl,
        userId: uid,
        accessToken: token,
        deviceId: did,
      });

      log("Connecting…");
    }

    clientRef.current = client;

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
      } catch {
        // ignore
      }
    }

    async function maybeHydrateAvatar(sender) {
      const s = String(sender || "");
      if (!s) return;
      setAvatarMap((prev) => {
        if (prev[s] !== undefined) return prev;
        return { ...prev, [s]: "" };
      });

      try {
        const profile = await client.getProfileInfo?.(s);
        const mxc = profile?.avatar_url;
        const url = mxcToHttp(client, mxc, 64);
        if (url) setAvatarMap((prev) => ({ ...prev, [s]: url }));
      } catch {
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

      maybeHydrateAvatar(m.sender);

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
        setVerificationReq(req);
      });
    }

    function onSync(state) {
      if (state === "PREPARED") {
        setReady(true);
        setStatus("Connected");
        refreshRooms();
      }
    }

    (async () => {
      if (!canReuse && store) {
        try {
          await store.startup();
        } catch (e) {
          log("Store startup failed:", e?.message || e);
        }
      }

      await ensureCrypto(client);

      try {
        const crypto = client.getCrypto?.();
        const myUid = client.getUserId?.() || uid;
        const myDid = client.getDeviceId?.() || did || saved?.deviceId || "";
        const key = verifiedKeyFor(myUid, myDid);

        let verified = key ? !!readJSON(key, false) : false;

        if (crypto && typeof crypto.getDeviceVerificationStatus === "function") {
          const res = await crypto.getDeviceVerificationStatus(myUid, myDid);
          verified =
            res === true ||
            res?.isVerified === true ||
            res?.verified === true ||
            res?.isCrossSigningVerified === true;
        }

        setDeviceVerified(!!verified);
      } catch {
        // ignore
      }

      try {
        const crypto = client.getCrypto?.();
        const myUid = client.getUserId?.() || uid;
        const pending = crypto?.getVerificationRequestsToDeviceInProgress?.(myUid);
        if (pending && pending.length) onVerificationReq(pending[0]);
      } catch {
        // ignore
      }

      client.on("sync", onSync);
      client.on(CryptoEvent.VerificationRequestReceived, onVerificationReq);
      client.on("Room.timeline", onTimeline);

      if (!canReuse) client.startClient({ initialSyncLimit: 30 });
    })();

    return () => {
      stoppedRef.current = true;
      try {
        client.removeListener?.("sync", onSync);
        client.removeListener?.(
          CryptoEvent.VerificationRequestReceived,
          onVerificationReq
        );
        client.removeListener?.("Room.timeline", onTimeline);
      } catch {}
      clientRef.current = null;
    };
  }, [saved?.userId, saved?.accessToken, saved?.deviceId]);

  /* -------- verification actions -------- */
  async function requestOwnVerification() {
    const client = clientRef.current;
    if (!client) return;
    try {
      setVerifyMsg("");
      const crypto = client.getCrypto?.();

      if (!crypto) {
        setVerifyMsg(
          "Crypto not ready. If this stays stuck, hit Reset Matrix storage."
        );
        return;
      }

      if (!crypto.requestOwnUserVerification) {
        setVerifyMsg(
          "This Matrix SDK build can’t request verification here. Start verification from Element, then click Check pending."
        );
        return;
      }

      const req = await crypto.requestOwnUserVerification();
      setVerificationReq(req);
      setSasData(null);
      setVerifyMsg(
        "Verification request sent. Accept it on your other device, then click Start SAS."
      );
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
        const payload = sas?.sas || {};
        const emoji = Array.isArray(payload.emoji)
          ? payload.emoji
              .map((e) => {
                if (Array.isArray(e)) return [e[0], e[1]];
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
        markThisDeviceVerified();
        cleanupVerification("Verified ✅");
      });

      verifier.on(VerifierEvent.Cancel, (e) => {
        cleanupVerification(`Cancelled: ${e?.reason || "unknown"}`);
      });

      verifier.on?.("change", () => {
        try {
          if (typeof verifier.isDone === "function" && verifier.isDone()) {
            markThisDeviceVerified();
            cleanupVerification("Verified ✅");
          }
        } catch {}
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
      setTimeout(() => {
        if (verifierRef.current) markThisDeviceVerified();
        cleanupVerification("Verified ✅");
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
  const loggedIn = !!(saved?.userId && saved?.accessToken);

  const login = async (e) => {
    e.preventDefault();
    try {
      const baseUrl = BF_MATRIX_HS_URL;
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

    try {
      const k = verifiedKeyFor(
        saved?.userId || userId || "",
        saved?.deviceId || deviceId || ""
      );
      if (k) removeKey(k);
    } catch {}
    setDeviceVerified(false);

    setUserId("");
    setAccessToken("");
    setDeviceId("");
    setReady(false);
    setCryptoReady(false);
    setRooms([]);
    setActiveRoomId(null);
    setMessages([]);
    setMsg("");
    setAvatarMap({});
    cleanupVerification("");

    if (clientRef.current) {
      try {
        clientRef.current.stopClient();
        clientRef.current.removeAllListeners();
      } catch {}
      clientRef.current = null;
    }

    clearGlobalMatrix();

    log("Logged out");
  };

  const resetMatrixStorage = () => {
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

    mapped.slice(0, 40).forEach((m) => {
      if (!m?.sender) return;
      // fire and forget
      (async () => {
        try {
          const profile = await client.getProfileInfo?.(m.sender);
          const url = mxcToHttp(client, profile?.avatar_url, 64);
          if (url) setAvatarMap((prev) => ({ ...prev, [m.sender]: url }));
        } catch {}
      })();
    });

    setMessages(mapped);
  };

  const send = async (e) => {
    e.preventDefault();
    const client = clientRef.current;
    if (!client || !activeRoomId || !msg.trim()) return;

    const body = msg.trim();
    setMsg("");

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
    const base = hideUndecryptable
      ? messages.filter((m) => !m.undecryptable)
      : messages;
    const sorted = [...base].sort((a, b) => a.ts - b.ts);
    return newestFirst ? sorted.reverse() : sorted;
  }, [messages, hideUndecryptable, newestFirst]);

  const renderAvatar = (sender) => {
    const url = avatarMap[sender];
    const initials = String(sender || "?")
      .replace(/^@/, "")
      .slice(0, 2)
      .toUpperCase();

    return (
      <div
        style={{
          height: 28,
          width: 28,
          borderRadius: 999,
          overflow: "hidden",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
          display: "grid",
          placeItems: "center",
          flex: "0 0 auto",
        }}
        title={sender}
      >
        {url ? (
          <img
            src={url}
            alt=""
            style={{ height: "100%", width: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: 11, opacity: 0.85 }}>{initials}</span>
        )}
      </div>
    );
  };

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
          {!cryptoReady ? "🟡" : deviceVerified ? "🔒" : "🔓"}
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
              yellow, something is broken in crypto init (or you’re still on a stale cached build).
            </div>
          ) : deviceVerified && !verificationReq ? (
            <>
              <div className="helper">
                This device is verified for this account. You should be able to
                read and send E2EE messages in encrypted rooms. 🔒
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 12,
                  flexWrap: "wrap",
                }}
              >
                <button className="btn" onClick={requestOwnVerification}>
                  Re-verify (optional)
                </button>
              </div>
            </>
          ) : verificationReq ? (
            <>
              <div className="helper">
                From: {verificationReq.otherUserId} ·{" "}
                {verificationReq.otherDeviceId}
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
                          <div style={{ fontSize: 28, lineHeight: 1 }}>
                            {emoji}
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.8 }}>
                            {name}
                          </div>
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
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 12,
                    flexWrap: "wrap",
                  }}
                >
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
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 12,
                  flexWrap: "wrap",
                }}
              >
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
            Sign in to chat
          </h3>
          <div className="helper" style={{ marginBottom: 8 }}>
            Homeserver: {BF_MATRIX_HS_URL}
          </div>
          <form onSubmit={login} className="grid" style={{ gap: 8, maxWidth: 520 }}>
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
            gridTemplateColumns:
              window.matchMedia && window.matchMedia("(max-width: 820px)").matches
                ? "1fr"
                : "280px 1fr",
            gap: 12,
            marginTop: 12,
          }}
        >
          <aside className="card" style={{ padding: 12, minHeight: 0 }}>
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
              height:
                window.matchMedia && window.matchMedia("(max-width: 820px)").matches
                  ? "calc(100dvh - 220px)"
                  : "auto",
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
                  <div
                    key={m.id}
                    style={{ marginBottom: 10, display: "flex", gap: 10 }}
                  >
                    {renderAvatar(m.sender)}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ fontWeight: 700, color: "#cbd5e1" }}>
                          {m.sender}
                        </span>
                        <span>·</span>
                        <span>{new Date(m.ts).toLocaleString()}</span>
                        {m.encrypted ? (
                          <span title="Encrypted message">🔒</span>
                        ) : null}
                      </div>
                      <div style={{ wordBreak: "break-word" }}>
                        {m.body || (
                          <span className="helper">(undecryptable)</span>
                        )}
                      </div>
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
