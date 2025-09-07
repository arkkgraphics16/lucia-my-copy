// lucia-secure/frontend/src/pages/ChatPage.jsx
import React, { useRef, useState, useEffect } from "react"
import MessageBubble from "../components/MessageBubble"
import Composer from "../components/Composer"
import { onQuickPrompt } from "../lib/bus"
import { useAuthToken } from "../hooks/useAuthToken"
import {
  auth, googleProvider, signInWithPopup,
  ensureUser, getUserData,
  createConversation, // still used when user types first, no cid yet
  listenMessages, addMessage, bumpUpdatedAt, incrementExchanges, setConversationTitle
} from "../firebase"
import "../styles/limit.css"
import "../styles/typing.css"
import "../styles/thread-loading.css"

const WORKER_URL = "https://lucia-secure.arkkgraphics.workers.dev/chat"
const DEFAULT_SYSTEM =
  "L.U.C.I.A. — Logical Understanding & Clarification of Interpersonal Agendas. She tells you what they want, what they’re hiding, and what will actually work. Her value is context and strategy, not therapy. You are responsible for decisions."

export default function ChatPage() {
  const { user } = useAuthToken()
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [capHit, setCapHit] = useState(false)
  const [system] = useState(DEFAULT_SYSTEM)
  const [loadingThread, setLoadingThread] = useState(false)

  // conversationId in STATE (not memo). Seed from URL.
  const [conversationId, setConversationId] = useState(() => {
    return new URLSearchParams(window.location.search).get("c") || null
  })

  useEffect(() => {
    const off = onQuickPrompt((t) => setText(String(t || "")))
    return off
  }, [])

  // Switch without reload (from Sidebar)
  useEffect(() => {
    const onSwitch = (e) => {
      const cid = e.detail?.cid
      if (!cid) return
      setLoadingThread(true)
      setMsgs([])
      setConversationId(cid)
    }
    const onPop = () => {
      const cid = new URLSearchParams(window.location.search).get("c") || null
      setLoadingThread(true)
      setMsgs([])
      setConversationId(cid)
    }
    window.addEventListener('lucia:switch-chat', onSwitch)
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('lucia:switch-chat', onSwitch)
      window.removeEventListener('popstate', onPop)
    }
  }, [])

  // Bind message stream to (uid, conversationId)
  useEffect(() => {
    if (!conversationId || !user?.uid) return
    setLoadingThread(true)
    const unsub = listenMessages(user.uid, conversationId, (rows) => {
      setMsgs(rows)
      setLoadingThread(false)
    })
    return () => { setLoadingThread(true); unsub && unsub() }
  }, [conversationId, user?.uid])

  function buildWorkerMessages(withUserText) {
    const base = msgs.map(m => ({ role: m.role, content: m.content }))
    return withUserText ? [...base, { role: "user", content: withUserText }] : base
  }

  async function ensureLogin() {
    if (!auth.currentUser) await signInWithPopup(auth, googleProvider)
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
      // If user typed before creating a chat via sidebar, create it here
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
      const isPro = profile?.tier === "pro"
      if (!isPro && used >= 10) {
        setCapHit(true)
        setBusy(false)
        return
      }

      await addMessage(uid, cid, "user", content)

      const workerMessages = buildWorkerMessages(content)
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
        if (used + 1 >= 10) setCapHit(true)
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
    </>
  )
}
