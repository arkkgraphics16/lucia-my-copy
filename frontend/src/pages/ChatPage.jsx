import React, { useRef, useState, useEffect } from "react";
import MessageBubble from "../components/MessageBubble";
import { onQuickPrompt } from "../lib/bus";

const GREETING =
  "L.U.C.I.A. — Logical Understanding & Clarification of Interpersonal Agendas. She tells you what they want, what they’re hiding, and what will actually work. Her value is context and strategy, not therapy. You are responsible for decisions.";

// Change this to your Worker URL
const WORKER_URL = "https://lucia-secure.arkkgraphics.workers.dev/chat";

/* -------------------
   Composer Component
-------------------- */
function Composer({ value, setValue, onSend, onCancel, busy }) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const pad = 24;
    const maxHeight = Math.round(lineHeight * 10 + pad);
    const resize = () => {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
      el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
    };
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
          <button
            className="action-btn cancel"
            onClick={onCancel}
            aria-label="Cancel"
            type="button"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        ) : (
          <button
            className="action-btn send"
            onClick={onSend}
            aria-label="Send"
            type="button"
            disabled={!value.trim()}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/* -------------------
   Chat Page Component
-------------------- */
function ChatPage() {
  const [msgs, setMsgs] = useState([
    { id: "m0", role: "assistant", content: GREETING },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ctrl = useRef(null);

  async function send() {
    const content = text.trim();
    if (!content) return;

    setText("");
    setBusy(true);

    const userMsg = { id: `u${Date.now()}`, role: "user", content };
    const typingMsg = { id: `a${Date.now()}`, role: "assistant", content: "…typing" };
    setMsgs((m) => [...m, userMsg, typingMsg]);

    ctrl.current = new AbortController();
    const signal = ctrl.current.signal;

    try {
      // Build full messages[] for worker
      const payload = {
        messages: [
          ...msgs
            .filter((x) => x.role === "user" || x.role === "assistant")
            .map((x) => ({ role: x.role, content: x.content })),
          { role: "user", content },
        ],
      };

      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setMsgs((m) =>
        m.slice(0, -1).concat({
          id: `a${Date.now()}`,
          role: "assistant",
          content: data.reply || "(no reply)",
        })
      );
    } catch (err) {
      setMsgs((m) =>
        m.slice(0, -1).concat({
          id: `a${Date.now()}`,
          role: "assistant",
          content: `(error: ${err.message})`,
        })
      );
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    ctrl.current?.abort?.();
    setBusy(false);
  }

  useQuickPrompt(setText);

  return (
    <>
      <div className="thread">
        {msgs.map((x) => (
          <MessageBubble key={x.id} role={x.role}>
            {x.content}
          </MessageBubble>
        ))}
      </div>
      <Composer
        value={text}
        setValue={setText}
        onSend={send}
        onCancel={cancel}
        busy={busy}
      />
    </>
  );
}

export default ChatPage;

/* -------------------
   Hook for quick prompt
-------------------- */
function useQuickPrompt(setText) {
  useEffect(() => {
    const off = onQuickPrompt((t) => setText(String(t || "")));
    return off;
  }, [setText]);
}
