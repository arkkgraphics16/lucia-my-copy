// lucia-secure/frontend/src/pages/ChatPage.jsx
import React, { useState, useEffect } from "react"
import MessageBubble from "../components/MessageBubble"
import Composer from "../components/Composer"
import { onQuickPrompt } from "../lib/bus"
import { useAuthToken } from "../hooks/useAuthToken"
import {
  auth,
  ensureUser, getUserData,
  createConversation,
  listenMessages, addMessage, bumpUpdatedAt, incrementExchanges, setConversationTitle
} from "../firebase"
import LoginForm from "../components/LoginForm"
import "../styles/limit.css"
import "../styles/typing.css"
import "../styles/thread-loading.css"
import "../styles/usage-indicator.css"
import "../styles/chat-layout.css"
import "../styles/login.css"

const WORKER_URL = "https://lucia-secure.arkkgraphics.workers.dev/chat"
const DEFAULT_SYSTEM =
  "L.U.C.I.A. — Logical Understanding & Clarification of Interpersonal Agendas. She tells you what they want, what they’re hiding, and what will actually work. Her value is context and strategy, not therapy. You are responsible for decisions."

export default function ChatPage() {
  const { user } = useAuthToken()
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [capHit, setCapHit] = useState(false)
  const [remaining, setRemaining] = useState(null)
  const [system] = useState(DEFAULT_SYSTEM)
  const [loadingThread, setLoadingThread] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  const [conversationId, setConversationId] = useState(() => {
    return new URLSearchParams(window.location.search).get("c") || null
  })

  useEffect(() => {
    const off = onQuickPrompt((t) => setText(String(t || "")))
    return off
  }, [])

  // listen for sidebar -> "lucia:show-login"
  useEffect(() => {
    const open = () => setShowLogin(true)
    window.addEventListener("lucia:show-login", open)
    return () => window.removeEventListener("lucia:show-login", open)
  }, [])

  useEffect(() => {
    const onSwitch = (e) => {
      const cid = e.detail?.cid
      if (!cid) return
      setMsgs([])
      setLoadingThread(true)
      setConversationId(cid)
    }
    const onPop = () => {
      const cid = new URLSearchParams(window.location.search).get("c") || null
      setMsgs([])
      setLoadingThread(true)
      setConversationId(cid)
    }
    window.addEventListener('lucia:switch-chat', onSwitch)
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('lucia:switch-chat', onSwitch)
      window.removeEventListener('popstate', onPop)
    }
  }, [])

  useEffect(() => {
    if (!conversationId || !user?.uid) return
    setLoadingThread(true)
    const unsub = listenMessages(user.uid, conversationId, (rows) => {
      setMsgs(rows)
      setLoadingThread(false)
    })
    return () => { setLoadingThread(true); unsub && unsub() }
  }, [conversationId, user?.uid])

  async function ensureLogin() {
    if (!auth.currentUser) {
      setShowLogin(true)
      throw new Error("Login required")
    }
    const uid = auth.currentUser.uid
    await ensureUser(uid)
    return uid
  }

  async function send() {
    const content = text.trim()
    if (!content) return
    setBusy(true)
    setText("")

    try {
      const uid = await ensureLogin()

      let cid = conversationId
      if (!cid) {
        const title = content.slice(0, 48)
        cid = await createConversation(uid, title, "")
        const url = new URL(window.location.href)
        url.searchParams.set("c", cid)
        window.history.replaceState({}, "", url)
        setConversationId(cid)
      } else if (msgs.length === 0) {
        await setConversationTitle(uid, cid, content.slice(0, 48))
      }

      const profile = await getUserData(uid)
      const used = profile?.exchanges_used ?? 0
      const courtesy = profile?.courtesy_used ?? false
      const isPro = profile?.tier === "pro"

      let left = null
      if (!isPro) {
        left = !courtesy ? Math.max(0, 10 - used) : Math.max(0, 12 - used)
      }
      setRemaining(left)

      if (!isPro && left <= 0) {
        setCapHit(true)
        setBusy(false)
        return
      }

      await addMessage(uid, cid, "user", content)

      const workerMessages = msgs.map(m => ({ role: m.role, content: m.content }))
      workerMessages.push({ role: "user", content })

      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system, messages: workerMessages })
      })

      const bodyText = await res.text()
      let data = {}
      try { data = JSON.parse(bodyText) } catch { data = {} }

      if (!res.ok || !data?.ok) {
        await addMessage(uid, cid, "assistant", `(error: ${res.status} ${data?.error || bodyText || "unknown"})`)
        await bumpUpdatedAt(uid, cid)
        setBusy(false)
        return
      }

      await addMessage(uid, cid, "assistant", data.reply || "(no reply)")
      await bumpUpdatedAt(uid, cid)

      if (!isPro) {
        await incrementExchanges(uid)
        const updated = await getUserData(uid)
        const newUsed = updated?.exchanges_used ?? used
        const newCourtesy = updated?.courtesy_used ?? courtesy
        setRemaining(!newCourtesy ? 10 - newUsed : 12 - newUsed)
        if ((!newCourtesy && newUsed >= 10) || (newCourtesy && newUsed >= 12)) {
          setCapHit(true)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  function cancel() { setBusy(false) }

  return (
    <>
      {showLogin && (
        <LoginForm onClose={() => setShowLogin(false)} onLogin={() => setShowLogin(false)} />
      )}

      {capHit && (
        <div className="limit-banner">
          <div>
            <div className="title">Free messages finished</div>
            <div className="desc">Upgrade to keep chatting with Lucía.</div>
          </div>
          <button className="act" type="button" disabled>Upgrade</button>
        </div>
      )}

      <div className="thread">
        {loadingThread ? (
          <div className="thread-skeleton">
            <div className="msg-skel"></div>
            <div className="msg-skel me"></div>
            <div className="msg-skel"></div>
          </div>
        ) : msgs.length === 0 ? (
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
                <span className="typing"><span></span><span></span><span></span></span>
              </MessageBubble>
            )}
          </>
        )}
      </div>

      <Composer value={text} setValue={setText} onSend={send} onCancel={cancel} busy={busy} />

      {remaining !== null && !capHit && (
        <div
          className={
            "usage-indicator usage-indicator--sm " +
            (remaining > 2
              ? "usage-indicator--ok"
              : remaining > 0
              ? "usage-indicator--warn"
              : "usage-indicator--bad")
          }
        >
          <span className="usage-indicator__dot"></span>
          <span className="usage-indicator__count">{remaining}</span>
          <span className="usage-indicator__label">messages left</span>
        </div>
      )}
    </>
  )
}
