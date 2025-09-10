// lucia-secure/frontend/src/components/EmailVerifyBanner.jsx
import React, { useState } from "react"
import { auth } from "../firebase"
import { sendEmailVerification } from "firebase/auth"

const ACTION_URL = "https://luciadecode.com/"
const actionCodeSettings = { url: ACTION_URL, handleCodeInApp: true }

export default function EmailVerifyBanner() {
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState("")
  const [err, setErr] = useState("")
  const user = auth.currentUser

  if (!user || user.emailVerified) return null

  async function resend() {
    setSending(true); setMsg(""); setErr("")
    try {
      await sendEmailVerification(user, actionCodeSettings)
      setMsg("Verification email sent. Check Inbox/Spam/Promotions.")
    } catch (e) {
      setErr(e?.message || "Failed to resend verification.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="limit-banner" style={{borderColor:"var(--primary)"}}>
      <div>
        <div className="title">Please verify your email</div>
        <div className="desc">We sent you a one-time verification email. This helps keep accounts secure.</div>
        {msg && <div style={{opacity:.9, marginTop:6}}>{msg}</div>}
        {err && <div style={{color:"var(--core)", marginTop:6}}>{err}</div>}
      </div>
      <button className="act" type="button" onClick={resend} disabled={sending}>
        {sending ? "Sending…" : "Resend"}
      </button>
    </div>
  )
}
