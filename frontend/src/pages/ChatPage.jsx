// lucia-secure/frontend/src/pages/ChatPage.jsx  (fix)

import React, { useRef, useState, useEffect, useMemo } from "react";
import MessageBubble from "../components/MessageBubble";
import { onQuickPrompt } from "../lib/bus";
import { useAuthToken } from "../hooks/useAuthToken";            // <— use reactive auth
import {
  auth, googleProvider, signInWithPopup,
  ensureUser, getUserData, createConversation, listenMessages,
  addMessage, bumpUpdatedAt, incrementExchanges, setConversationTitle
} from "../firebase";
import "../styles/limit.css";
import "../styles/typing.css";                                    // <— typing styles

const WORKER_URL = "https://lucia-secure.arkkgraphics.workers.dev/chat";
const DEFAULT_SYSTEM =
  "L.U.C.I.A. — Logical Understanding & Clarification of Interpersonal Agendas. She tells you what they want, what they’re hiding, and what will actually work. Her value is context and strategy, not therapy. You are responsible for decisions.";

function Composer({ value, setValue, onSend, onCancel, busy }) {
  const textareaRef = useRef(null);
  useEffect(() => {
    const el = textareaRef.current; if (!el) return;
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const pad = 24, maxH = Math.round(lh * 10 + pad);
    const resize = () => { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, maxH) + "px"; el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden"; };
    resize();
  }, [value]);
  return (
    <div className="composer">
      <textarea
        ref={textareaRef}
        className="textarea"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type a message..."
        rows={1}
      />
      <div className="controls">
        {busy ? (
          <button className="action-btn cancel" onClick={onCancel} aria-label="Cancel" type="button">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        ) : (
          <button className="action-btn send" onClick={onSend} aria-label="Send" type="button" disabled={!value.trim()}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 2L11 13"></path><path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { user } = useAuthToken();                               // <— reactive uid
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [capHit, setCapHit] = useState(false);
  const [system, setSystem] = useState(DEFAULT_SYSTEM);

  const conversationId = useMemo(
    () => new URLSearchParams(window.location.search).get("c") || null,
    [window.location.search]
  );

  useEffect(() => {
    const off = onQuickPrompt((t) => setText(String(t || "")));
    return off;
  }, []);

  async function ensureLogin() {
    if (!auth.currentUser) await signInWithPopup(auth, googleProvider);
    const uid = auth.currentUser.uid;
    await ensureUser(uid);
    return uid;
  }

  // Listen to messages — rebind when uid OR conversation changes
  useEffect(() => {
    if (!conversationId || !user?.uid) return;
    const unsub = listenMessages(user.uid, conversationId, (rows) => setMsgs(rows));
    return () => unsub && unsub();
  }, [conversationId, user?.uid]);

  function buildWorkerMessages(withUserText) {
    const base = msgs.map(m => ({ role: m.role, content: m.content }));
    return withUserText ? [...base, { role: "user", content: withUserText }] : base;
  }

  async function send() {
    const content = text.trim();
    if (!content) return;
    setBusy(true);
    setText("");

    try {
      const uid = await ensureLogin();

      let cid = conversationId;
      if (!cid) {
        const title = content.slice(0, 48);
        cid = await createConversation(uid, title, "");
        const url = new URL(window.location.href);
        url.searchParams.set("c", cid);
        window.history.replaceState({}, "", url);
      } else if (msgs.length === 0) {
        await setConversationTitle(uid, cid, content.slice(0, 48));
      }

      const profile = await getUserData(uid);
      const used = profile?.exchanges_used ?? 0;
      const isPro = profile?.tier === "pro";
      if (!isPro && used >= 10) {
        setCapHit(true);
        setBusy(false);
        return;
      }

      await addMessage(uid, cid, "user", content);

      const workerMessages = buildWorkerMessages(content);
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system, messages: workerMessages })
      });

      const bodyText = await res.text();
      let data = {};
      try { data = JSON.parse(bodyText); } catch { data = {}; }

      if (!res.ok || !data?.ok) {
        await addMessage(uid, cid, "assistant", `(error: ${res.status} ${data?.error || bodyText || "unknown"})`);
        await bumpUpdatedAt(uid, cid);
        setBusy(false);
        return;
      }

      await addMessage(uid, cid, "assistant", data.reply || "(no reply)");
      await bumpUpdatedAt(uid, cid);

      if (!isPro) {
        await incrementExchanges(uid);
        if (used + 1 >= 10) setCapHit(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  function cancel() { setBusy(false); }

  return (
    <>
      {capHit && (
        <div className="limit-banner">
          <div>
            <div className="title">Free Tier Limit reached</div>
            <div className="desc">Upgrade to unlock full potential.</div>
          </div>
          <button className="act" type="button" disabled>Upgrade</button>
        </div>
      )}

      <div className="thread">
        {msgs.length === 0 ? (
          <MessageBubble role="assistant">{DEFAULT_SYSTEM}</MessageBubble>
        ) : (
          <>
            {msgs.map((m) => (
              <MessageBubble key={m.id} role={m.role}>
                {m.content}
              </MessageBubble>
            ))}
            {busy && (
              <MessageBubble role="assistant">
                <span className="typing">
                  <span></span><span></span><span></span>
                </span>
              </MessageBubble>
            )}
          </>
        )}
      </div>

      <Composer value={text} setValue={setText} onSend={send} onCancel={cancel} busy={busy} />
    </>
  );
}
