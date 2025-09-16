// lucia-secure/frontend/src/pages/ChatPage.jsx
import React, { useState, useEffect, useMemo } from "react"
import MessageBubble from "../components/MessageBubble"
import Composer from "../components/Composer"
import CourtesyPopup from "../components/CourtesyPopup"
import { onQuickPrompt } from "../lib/bus"
import { useAuthToken } from "../hooks/useAuthToken"
import {
  auth,
  db,
  ensureUser,
  getUserData,
  createConversation,
  listenMessages,
  addMessage,
  bumpUpdatedAt,
  setConversationTitle
} from "../firebase"
import LoginForm from "../components/LoginForm"
import EmailVerifyBanner from "../components/EmailVerifyBanner"
import LegalPages from "../components/LegalPages"   

// styles
import "../styles/limit.css"
import "../styles/typing.css"
import "../styles/thread-loading.css"
import "../styles/lucia-listening.css"
import "../styles/usage-indicator.css"
import "../styles/chat-layout.css"
import "../styles/login.css"
import "../styles/courtesy-popup.css"

import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth"
import { doc, onSnapshot, getDoc, runTransaction } from "firebase/firestore"

const WORKER_URL = "https://lucia-secure.arkkgraphics.workers.dev/chat"
const DEFAULT_SYSTEM =
  "L.U.C.I.A. – Logical Understanding & Clarification of Interpersonal Agendas. She tells you what they want, what they're hiding, and what will actually work. Her value is context and strategy, not therapy. You are responsible for decisions."

/* ------------------------------ DATA HARDENING ------------------------------ */
async function normalizeUserDoc(uid) {
  const ref = doc(db, "users", uid)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) return
    const cur = snap.data() || {}
    const next = {}

    if (typeof cur.tier !== "string") {
      next.tier = String(cur.tier ?? "free")
    }

    if (typeof cur.exchanges_used !== "number") {
      const n = Number(cur.exchanges_used ?? 0)
      next.exchanges_used = Number.isFinite(n) ? n : 0
    }

    if (typeof cur.courtesy_used !== "boolean") {
      const raw = cur.courtesy_used
      let coerced = false
      if (typeof raw === "string") coerced = raw.toLowerCase() === "true"
      else coerced = !!raw
      next.courtesy_used = coerced
    }

    if (Object.keys(next).length > 0) tx.update(ref, next)
  })
}

/* ------------------------------ COURTESY ACCEPT ----------------------------- */
async function acceptCourtesy(uid) {
  const ref = doc(db, "users", uid)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error("User doc missing")
    const cur = snap.data() || {}
    const tier = typeof cur.tier === "string" ? cur.tier : "free"
    const used = typeof cur.exchanges_used === "number" ? cur.exchanges_used : Number(cur.exchanges_used ?? 0)
    const courtesy = typeof cur.courtesy_used === "boolean"
      ? cur.courtesy_used
      : (typeof cur.courtesy_used === "string" ? cur.courtesy_used.toLowerCase() === "true" : !!cur.courtesy_used)

    if (tier === "free" && used === 10 && !courtesy) {
      tx.update(ref, { exchanges_used: 11, courtesy_used: true })
    } else {
      throw new Error("Courtesy not available")
    }
  })
}

/* --------------------------- SAFE USAGE INCREMENT --------------------------- */
async function safeIncrementUsage(uid) {
  const ref = doc(db, "users", uid)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error("User doc missing")
    const cur = snap.data() || {}

    const tier = typeof cur.tier === "string" ? cur.tier : "free"
    const used = typeof cur.exchanges_used === "number" ? cur.exchanges_used : Number(cur.exchanges_used ?? 0)
    const courtesy = typeof cur.courtesy_used === "boolean"
      ? cur.courtesy_used
      : (typeof cur.courtesy_used === "string" ? cur.courtesy_used.toLowerCase() === "true" : !!cur.courtesy_used)

    if (tier === "pro") {
      tx.update(ref, { exchanges_used: used + 1 })
      return
    }

    if (used < 10) {
      tx.update(ref, { exchanges_used: used + 1 })
    } else if (used === 10 && !courtesy) {
      tx.update(ref, { exchanges_used: 11, courtesy_used: true })
    } else if (courtesy && used < 12) {
      tx.update(ref, { exchanges_used: used + 1 })
    } else {
      throw new Error("Free limit reached")
    }
  })
}

export default function ChatPage() {
  const { user } = useAuthToken()
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)

  const [profile, setProfile] = useState(null)
  const [capHit, setCapHit] = useState(false)
  const [showCourtesy, setShowCourtesy] = useState(false)
  const [loadingThread, setLoadingThread] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [system] = useState(DEFAULT_SYSTEM)
  const [conversationId, setConversationId] = useState(() => new URLSearchParams(window.location.search).get("c") || null)

  // NEW: Legal overlay state
  const getPageFromURL = () => {
    const sp = new URLSearchParams(window.location.search)
    const p = sp.get("page")
    return (p === "terms" || p === "privacy") ? p : null
  }
  const [legalPage, setLegalPage] = useState(getPageFromURL())

  useEffect(() => {
    const off = onQuickPrompt((t) => setText(String(t || "")))
    return off
  }, [])

  // Email link sign-in
  useEffect(() => {
    (async () => {
      try {
        const href = window.location.href
        if (!href) return
        if (!isSignInWithEmailLink(auth, href)) return

        let email = window.localStorage.getItem("lucia-emailForSignIn") || ""
        if (!email) email = window.prompt("Confirm your email for sign-in") || ""
        if (!email) return

        await signInWithEmailLink(auth, email, href)
        window.localStorage.removeItem("lucia-emailForSignIn")
        if (auth.currentUser?.uid) await ensureUser(auth.currentUser.uid)
        setShowLogin(false)

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

  // Sidebar → show login
  useEffect(() => {
    const open = () => setShowLogin(true)
    window.addEventListener("lucia:show-login", open)
    return () => window.removeEventListener("lucia:show-login", open)
  }, [])

  // Sidebar → switch chat
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
      setLegalPage(getPageFromURL()) // NEW: also update legal overlay
    }
    window.addEventListener("lucia:switch-chat", onSwitch)
    window.addEventListener("popstate", onPop)
    return () => {
      window.removeEventListener("lucia:switch-chat", onSwitch)
      window.removeEventListener("popstate", onPop)
    }
  }, [])

  // NEW: Sidebar → legal page navigation
  useEffect(() => {
    function onNavigate(e){
      const page = e?.detail?.page
      if (page === "terms" || page === "privacy") setLegalPage(page)
    }
    window.addEventListener("lucia:navigate-page", onNavigate)
    return () => window.removeEventListener("lucia:navigate-page", onNavigate)
  }, [])

  // Live messages
  useEffect(() => {
    if (!conversationId || !user?.uid) return
    setLoadingThread(true)
    const unsub = listenMessages(user.uid, conversationId, (rows) => {
      setMsgs(rows)
      setLoadingThread(false)
    })
    return () => { setLoadingThread(true); unsub && unsub() }
  }, [conversationId, user?.uid])

  // Live profile
  useEffect(() => {
    if (!user?.uid) return
    let unsub = null
    ;(async () => {
      await ensureUser(user.uid)
      try { await normalizeUserDoc(user.uid) } catch {}
      const ref = doc(db, "users", user.uid)
      unsub = onSnapshot(ref, (snap) => setProfile(snap.exists() ? snap.data() : null))
    })()
    return () => unsub && unsub()
  }, [user?.uid])

  // Quota
  const quota = useMemo(() => {
    if (!profile) return { isPro: false, used: 0, courtesy: false, total: 10, remaining: 0 }
    const isPro = profile.tier === "pro"
    const used = typeof profile.exchanges_used === "number" ? profile.exchanges_used : Number(profile.exchanges_used ?? 0)
    const courtesy = typeof profile.courtesy_used === "boolean"
      ? profile.courtesy_used
      : (typeof profile.courtesy_used === "string" ? profile.courtesy_used.toLowerCase() === "true" : !!profile.courtesy_used)
    const total = isPro ? Infinity : (courtesy ? 12 : 10)
    const remaining = isPro ? Infinity : Math.max(0, total - used)
    return { isPro, used, courtesy, total, remaining }
  }, [profile])

  useEffect(() => {
    if (!quota || quota.isPro) { setShowCourtesy(false); setCapHit(false); return }
    if (quota.used === 10 && !quota.courtesy) { setShowCourtesy(true); setCapHit(false); return }
    if (quota.courtesy && quota.used >= 12) { setShowCourtesy(false); setCapHit(true); return }
    setCapHit(false)
  }, [quota])

  async function ensureLogin() {
    if (!auth.currentUser) { setShowLogin(true); throw new Error("Login required") }
    const uid = auth.currentUser.uid
    await ensureUser(uid)
    return uid
  }

  async function handleCourtesyAccept() {
    try {
      const uid = auth.currentUser?.uid
      if (!uid) return setShowLogin(true)
      await normalizeUserDoc(uid)
      await acceptCourtesy(uid)
      setShowCourtesy(false)
    } catch (e) { console.error("Courtesy accept failed:", e) }
  }
  function handleCourtesyDecline() { setShowCourtesy(false); setCapHit(true) }

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
      if (!quota.isPro) {
        if (quota.used === 10 && !quota.courtesy) { setShowCourtesy(true); setBusy(false); return }
        const hardTotal = quota.courtesy ? 12 : 10
        if (quota.used >= hardTotal) { setCapHit(true); setBusy(false); return }
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
      try { data = JSON.parse(bodyText) } catch {}
      if (!res.ok || data?.ok !== true) {
        await addMessage(uid, cid, "assistant", `(error: ${res.status} ${data?.error || bodyText || "unknown"})`)
        await bumpUpdatedAt(uid, cid)
        setBusy(false)
        return
      }
      await addMessage(uid, cid, "assistant", data.reply || "(no reply)")
      await bumpUpdatedAt(uid, cid)
      if (!quota.isPro) await safeIncrementUsage(uid)
    } catch (err) {
      if (String(err?.message || "").toLowerCase() !== "login required") console.error(err)
    } finally { setBusy(false) }
  }

  function cancel() { setBusy(false) }

  const usageDisplay = useMemo(() => {
    if (!profile || quota.isPro) return null
    const total = quota.courtesy ? 12 : 10
    const current = Math.min(quota.used, total)
    return { current, total }
  }, [profile, quota])

  function closeLegal(){
    const url = new URL(window.location.href)
    url.searchParams.delete("page")
    window.history.pushState({}, "", url)
    setLegalPage(null)
  }

  return (
    <>
      {showLogin && <LoginForm onClose={() => setShowLogin(false)} onLogin={() => setShowLogin(false)} />}
      {showCourtesy && <CourtesyPopup onAccept={handleCourtesyAccept} onDecline={handleCourtesyDecline} />}
      {user && user.email && !user.emailVerified && <EmailVerifyBanner />}

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
              <MessageBubble key={m.id} role={m.role}>{m.content}</MessageBubble>
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

      {usageDisplay && !capHit && !showCourtesy && (
        <div className={"usage-indicator usage-indicator--sm " +
          (quota.remaining > 2 ? "usage-indicator--ok" : quota.remaining > 0 ? "usage-indicator--warn" : "usage-indicator--bad")}>
          <span className="usage-indicator__dot"></span>
          <span className="usage-indicator__count">{usageDisplay.current}/{usageDisplay.total}</span>
          <span className="usage-indicator__label">messages used</span>
        </div>
      )}

      {/* LEGAL OVERLAY */}
      {legalPage && <LegalPages page={legalPage} onBack={closeLegal} />}
    </>
  )
}
