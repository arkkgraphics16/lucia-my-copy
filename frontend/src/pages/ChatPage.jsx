// lucia-secure/frontend/src/pages/ChatPage.jsx
import React, { useState, useEffect } from "react"
import MessageBubble from "../components/MessageBubble"
import Composer from "../components/Composer"
import CourtesyPopup from "../components/CourtesyPopup" // New import
import { onQuickPrompt } from "../lib/bus"
import { useAuthToken } from "../hooks/useAuthToken"
import {
  auth,
  ensureUser, getUserData,
  createConversation,
  listenMessages, addMessage, bumpUpdatedAt, incrementExchanges, setConversationTitle
} from "../firebase"
import LoginForm from "../components/LoginForm"
import EmailVerifyBanner from "../components/EmailVerifyBanner"

// styles
import "../styles/limit.css"
import "../styles/typing.css"
import "../styles/thread-loading.css"
import "../styles/lucia-listening.css" // New loading styles
import "../styles/usage-indicator.css"
import "../styles/chat-layout.css"
import "../styles/login.css"
import "../styles/courtesy-popup.css" // New import

import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth"

const WORKER_URL = "https://lucia-secure.arkkgraphics.workers.dev/chat"
const DEFAULT_SYSTEM =
  "L.U.C.I.A. – Logical Understanding & Clarification of Interpersonal Agendas. She tells you what they want, what they're hiding, and what will actually work. Her value is context and strategy, not therapy. You are responsible for decisions."

export default function ChatPage() {
  const { user } = useAuthToken()

  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)

  const [capHit, setCapHit] = useState(false)
  const [remaining, setRemaining] = useState(null)
  const [showCourtesy, setShowCourtesy] = useState(false) // New state

  const [system] = useState(DEFAULT_SYSTEM)
  const [loadingThread, setLoadingThread] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  // conversation id from ?c=<id>
  const [conversationId, setConversationId] = useState(() => {
    return new URLSearchParams(window.location.search).get("c") || null
  })

  // quick prompt -> composer
  useEffect(() => {
    const off = onQuickPrompt((t) => setText(String(t || "")))
    return off
  }, [])

  // Complete Email Link sign-in if the URL contains an OOB code
  useEffect(() => {
    (async () => {
      try {
        const href = window.location.href
        if (!href) return
        if (!isSignInWithEmailLink(auth, href)) return

        let email = window.localStorage.getItem("lucia-emailForSignIn") || ""
        if (!email) {
          email = window.prompt("Confirm your email for sign-in") || ""
        }
        if (!email) return

        await signInWithEmailLink(auth, email, href)
        window.localStorage.removeItem("lucia-emailForSignIn")
        if (auth.currentUser?.uid) {
          await ensureUser(auth.currentUser.uid)
        }
        setShowLogin(false)

        // Clean URL (drop Firebase query params but keep ?c)
        const clean = new URL(window.location.origin + window.location.pathname + window.location.search)
        clean.searchParams.delete("oobCode")
        clean.searchParams.delete("mode")
        clean.searchParams.delete("apiKey")
        window.history.replaceState({}, "", clean)
      } catch (e) {
        console.error("Email link completion failed:", e)
      }
    })()
  }, [])

  // sidebar event to open login
  useEffect(() => {
    const open = () => setShowLogin(true)
    window.addEventListener("lucia:show-login", open)
    return () => window.removeEventListener("lucia:show-login", open)
  }, [])

  // handle external chat switch + back/forward
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
    window.addEventListener("lucia:switch-chat", onSwitch)
    window.addEventListener("popstate", onPop)
    return () => {
      window.removeEventListener("lucia:switch-chat", onSwitch)
      window.removeEventListener("popstate", onPop)
    }
  }, [])

  // live message listener for the active conversation
  useEffect(() => {
    if (!conversationId || !user?.uid) return
    setLoadingThread(true)
    const unsub = listenMessages(user.uid, conversationId, (rows) => {
      setMsgs(rows)
      setLoadingThread(false)
    })
    return () => {
      setLoadingThread(true)
      unsub && unsub()
    }
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

  // New function to handle courtesy acceptance
  async function handleCourtesyAccept() {
    setShowCourtesy(false)
    // Update remaining count to show courtesy messages available
    const uid = auth.currentUser?.uid
    if (uid) {
      const profile = await getUserData(uid)
      const used = profile?.exchanges_used ?? 0
      const newLeft = Math.max(0, 12 - used)
      setRemaining(newLeft)
    }
  }

  // New function to handle courtesy decline
  function handleCourtesyDecline() {
    setShowCourtesy(false)
    setCapHit(true)
  }

  async function send() {
    const content = text.trim()
    if (!content) return
    setBusy(true)
    setText("")

    try {
      const uid = await ensureLogin()

      // bootstrap conversation
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

      // check limits
      const profile = await getUserData(uid)
      const used = profile?.exchanges_used ?? 0
      const courtesy = profile?.courtesy_used ?? false
      const isPro = profile?.tier === "pro"

      let left = null
      if (!isPro) {
        left = !courtesy ? Math.max(0, 10 - used) : Math.max(0, 12 - used)
      }
      setRemaining(left)

      // Check if user hit the 10 message limit and hasn't used courtesy yet
      if (!isPro && used === 10 && !courtesy && left === 0) {
        setShowCourtesy(true)
        setBusy(false)
        return
      }

      if (!isPro && left <= 0) {
        setCapHit(true)
        setBusy(false)
        return
      }

      // push user message
      await addMessage(uid, cid, "user", content)

      // build worker payload
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

      if (!res.ok || data?.ok !== true) {
        await addMessage(uid, cid, "assistant", `(error: ${res.status} ${data?.error || bodyText || "unknown"})`)
        await bumpUpdatedAt(uid, cid)
        setBusy(false)
        return
      }

      await addMessage(uid, cid, "assistant", data.reply || "(no reply)")
      await bumpUpdatedAt(uid, cid)

      // update quota counters for free tier
      if (!isPro) {
        await incrementExchanges(uid)
        const updated = await getUserData(uid)
        const newUsed = updated?.exchanges_used ?? used
        const newCourtesy = updated?.courtesy_used ?? courtesy
        const newLeft = !newCourtesy ? Math.max(0, 10 - newUsed) : Math.max(0, 12 - newUsed)
        setRemaining(newLeft)
        
        // Check if they just hit the courtesy limit (12 messages total)
        if (newCourtesy && newUsed >= 12) {
          setCapHit(true)
        }
      }
    } catch (err) {
      // swallow login-required error; otherwise log
      if (String(err?.message || "").toLowerCase() !== "login required") {
        console.error(err)
      }
    } finally {
      setBusy(false)
    }
  }

  function cancel() {
    setBusy(false)
  }

  // Calculate display values for usage indicator
  const getUsageDisplay = () => {
    if (remaining === null) return { current: 0, total: 10 }
    
    // If user hasn't used courtesy yet, show out of 10
    const uid = auth.currentUser?.uid
    if (uid) {
      // We need to determine if courtesy was used based on remaining count
      // If remaining is calculated from 12, courtesy was used
      const used = 10 - remaining // Assuming we're showing remaining from 10 initially
      if (remaining <= 2 && remaining >= 0) {
        // Likely in courtesy mode (showing remaining from 12)
        return { current: 12 - remaining, total: 12 }
      }
      return { current: Math.max(0, 10 - remaining), total: 10 }
    }
    
    return { current: 0, total: 10 }
  }

  const usageDisplay = getUsageDisplay()

  return (
    <>
      {showLogin && (
        <LoginForm onClose={() => setShowLogin(false)} onLogin={() => setShowLogin(false)} />
      )}

      {/* Courtesy Popup */}
      {showCourtesy && (
        <CourtesyPopup 
          onAccept={handleCourtesyAccept}
          onDecline={handleCourtesyDecline}
        />
      )}

      {/* If logged in but not verified, show a small banner with "Resend" */}
      {user && user.email && !user.emailVerified && (
        <EmailVerifyBanner />
      )}

      {capHit && (
        <div className="limit-banner" role="alert">
          <div>
            <div className="title">Free messages finished</div>
            <div className="desc">Upgrade to keep chatting with Lucía.</div>
          </div>
          <button className="act" type="button" disabled>Upgrade</button>
        </div>
      )}

      <div className="thread">
        {loadingThread ? (
          <div className="lucia-listening">
            <div className="lucia-spinner"></div>
            <div className="lucia-listening-text">Lucia is listening...</div>
            <div className="lucia-listening-subtext">Analyzing the conversation</div>
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

      {remaining !== null && !capHit && !showCourtesy && (
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
          <span className="usage-indicator__count">
            {usageDisplay.current}/{usageDisplay.total}
          </span>
          <span className="usage-indicator__label">messages used</span>
        </div>
      )}
    </>
  )
}