import React, { useRef, useState, useEffect } from "react";
import MessageBubble from "../components/MessageBubble";
import { onQuickPrompt } from "../lib/bus";

const GREETING =
  "L.U.C.I.A. — Logical Understanding & Clarification of Interpersonal Agendas. She tells you what they want, what they’re hiding, and what will actually work. Her value is context and strategy, not therapy. You are responsible for decisions.";

/* -------------------
   Composer Component
-------------------- */
function Composer({ value, setValue, onSend, onCancel, busy }) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const pad = 24; // vertical padding already applied in CSS
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
        rows={1} // start at 1 row
      />
      <div className="controls">
        <button className="action-btn send" onClick={onSend} disabled={busy}>
          Send
        </button>
        {busy && (
          <button className="action-btn cancel" onClick={onCancel}>
            Cancel
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
    setMsgs((m) => [
      ...m,
      { id: `u${Date.now()}`, role: "user", content },
      { id: `a${Date.now()}`, role: "assistant", content: "…typing" },
    ]);

    ctrl.current = new AbortController();
    const signal = ctrl.current.signal;
    try {
      await new Promise((res, rej) => {
        const t = setTimeout(() => res(), 600);
        signal.addEventListener?.("abort", () => {
          clearTimeout(t);
          rej(new Error("aborted"));
        });
      });
      setMsgs((m) =>
        m
          .slice(0, -1)
          .concat({
            id: `a${Date.now()}`,
            role: "assistant",
            content: `Echo: ${content}`,
          })
      );
    } catch {
      setMsgs((m) =>
        m
          .slice(0, -1)
          .concat({
            id: `a${Date.now()}`,
            role: "assistant",
            content: "(canceled)",
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

  // quick prompt hook
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
