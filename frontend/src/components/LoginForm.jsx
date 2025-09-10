// lucia-secure/frontend/src/components/LoginForm.jsx
import React, { useEffect, useState } from "react"
import {
  auth,
  loginWithEmail,
  registerWithEmail,
  signInWithPopup,
  googleProvider,
  ensureUser
} from "../firebase"
import {
  fetchSignInMethodsForEmail,
  sendPasswordResetEmail,
  sendEmailVerification
} from "firebase/auth"
import AddPassword from "./AddPassword"

// Verification return URL (must be authorized in Firebase)
const ACTION_URL = "https://luciadecode.com/"

const actionCodeSettings = {
  url: ACTION_URL,
  handleCodeInApp: true
}

export default function LoginForm({ onClose, onLogin }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [hint, setHint] = useState("")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [methods, setMethods] = useState([])

  // Only check providers for well-formed emails (prevents createAuthUri spam)
  useEffect(() => {
    const trimmed = (email || "").trim()
    const isLikelyEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    if (!isLikelyEmail) {
      setMethods([])
      return
    }
    let alive = true
    ;(async () => {
      try {
        const m = await fetchSignInMethodsForEmail(auth, trimmed)
        if (alive) setMethods(m)
      } catch {
        if (alive) setMethods([])
      }
    })()
    return () => { alive = false }
  }, [email])

  async function handleEmailLogin(e) {
    e.preventDefault()
    setLoading(true); setError(""); setHint("")
    try {
      const trimmed = (email || "").trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setError("Enter a valid email address.")
        return
      }

      let providerMethods = []
      try { providerMethods = await fetchSignInMethodsForEmail(auth, trimmed) } catch { providerMethods = [] }

      // If this email used Google previously and has no password yet
      if (providerMethods.includes("google.com") && !providerMethods.includes("password")) {
        setError("This email is registered with Google.")
        setHint("Tap “Continue with Google”, then add a password if you want email login.")
        return
      }

      let registeredJustNow = false
      try {
        await loginWithEmail(trimmed, password)
      } catch (err) {
        if (err?.code === "auth/user-not-found") {
          await registerWithEmail(trimmed, password)
          registeredJustNow = true
        } else if (err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password") {
          setError("Incorrect password.")
          setHint("If you forgot it, use Reset password or sign in with Google if you used that before.")
          return
        } else if (err?.code === "auth/too-many-requests") {
          setError("Too many attempts. Please wait or use Google.")
          return
        } else {
          throw err
        }
      }

      // If newly registered, send a verification email once
      if (registeredJustNow && auth.currentUser && !auth.currentUser.emailVerified) {
        try {
          await sendEmailVerification(auth.currentUser, actionCodeSettings)
          setHint("Verification email sent. Please check your inbox (or Spam/Promotions) and confirm.")
        } catch (e) {
          console.warn("sendEmailVerification failed:", e)
        }
      }

      await ensureUser(auth.currentUser.uid)
      onLogin && onLogin()
      onClose && onClose()
    } catch (err) {
      setError("Firebase: " + (err?.message || "Unexpected error"))
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword() {
    const trimmed = (email || "").trim()
    if (!trimmed) { setError("Enter your email first."); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address."); return
    }

    setLoading(true); setError(""); setHint("")
    try {
      let providerMethods = []
      try { providerMethods = await fetchSignInMethodsForEmail(auth, trimmed) } catch { providerMethods = [] }
      if (!providerMethods.includes("password")) {
        setError("No password set for this email.")
        setHint("Use “Continue with Google” instead, then add a password later in Settings.")
        return
      }
      await sendPasswordResetEmail(auth, trimmed)
      setHint("Password reset email sent. Check your inbox.")
    } catch (err) {
      setError("Could not send reset email.")
      setHint(err?.message || "")
    } finally { setLoading(false) }
  }

  async function handleGoogleLogin() {
    setLoading(true); setError(""); setHint("")
    try {
      await signInWithPopup(auth, googleProvider)
      await ensureUser(auth.currentUser.uid)
      onLogin && onLogin()
      onClose && onClose()
    } catch (err) {
      setError("Google sign-in failed.")
      setHint(err?.message || "")
    } finally { setLoading(false) }
  }

  const showAddPassword =
    auth.currentUser?.email &&
    methods.length === 1 &&
    methods[0] === "google.com" &&
    auth.currentUser.email === (email || "").trim()

  return (
    <div className="login-overlay" role="dialog" aria-modal="true">
      <div className="login-modal">
        <button className="close-btn" onClick={onClose} aria-label="Close">✕</button>

        <h2>Log in</h2>

        <form onSubmit={handleEmailLogin}>
          <input
            type="email"
            placeholder="Email (e.g., you@example.com)"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <button type="submit" disabled={loading}>
            {loading ? "Loading..." : "Login / Register"}
          </button>
        </form>

        <button
          onClick={handleResetPassword}
          disabled={loading}
          style={{
            width:"100%", marginTop:8, marginBottom:8, padding:8,
            border:"1px solid var(--border)", background:"transparent",
            color:"var(--text)", borderRadius:"var(--radius-2)", cursor:"pointer"
          }}
        >
          Reset password
        </button>

        {showAddPassword && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 14, opacity: 0.8 }}>
              You’re signed in with Google. Add a password to also log in with email/password:
            </p>
            <AddPassword onDone={() => setHint("Password added successfully.")} />
          </div>
        )}

        <div className="divider">or</div>
        <button className="google-btn" onClick={handleGoogleLogin} disabled={loading}>
          Continue with Google
        </button>

        {(error || hint) && (
          <div className="error" style={{marginTop:10}}>
            {error && <div style={{color:"var(--core)"}}>{error}</div>}
            {hint && <div style={{opacity:.9}}>{hint}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
