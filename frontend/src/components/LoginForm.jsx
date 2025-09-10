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
  sendPasswordResetEmail
} from "firebase/auth"
import AddPassword from "./AddPassword"

// Change this to your preferred internal domain suffix for synthesized emails.
// It must be a valid-looking email domain, but it never needs to receive mail.
const USERNAME_EMAIL_SUFFIX = "users.luciadecode.com"

export default function LoginForm({ onClose, onLogin }) {
  // UI state
  const [tab, setTab] = useState("email") // "email" | "username"

  // shared
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [hint, setHint] = useState("")

  // email tab
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [methods, setMethods] = useState([])

  // username tab
  const [username, setUsername] = useState("")
  const [uPassword, setUPassword] = useState("")

  // Only check providers for real emails (prevents createAuthUri 400 spam)
  useEffect(() => {
    if (tab !== "email") return
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
    return () => {
      alive = false
    }
  }, [tab, email])

  // ---------- EMAIL TAB ----------
  async function handleEmailLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setHint("")

    try {
      const trimmed = email.trim()

      // Validate before hitting Firebase
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setError("Enter a valid email address.")
        return
      }

      let providerMethods = []
      try {
        providerMethods = await fetchSignInMethodsForEmail(auth, trimmed)
      } catch {
        providerMethods = []
      }

      if (providerMethods.includes("google.com") && !providerMethods.includes("password")) {
        setError("This email is registered with Google.")
        setHint("Tap “Continue with Google” below to sign in.")
        return
      }

      try {
        await loginWithEmail(trimmed, password)
      } catch (err) {
        if (err?.code === "auth/user-not-found") {
          await registerWithEmail(trimmed, password)
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
    if (!trimmed) {
      setError("Enter your email first.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.")
      return
    }

    setLoading(true)
    setError("")
    setHint("")
    try {
      let providerMethods = []
      try {
        providerMethods = await fetchSignInMethodsForEmail(auth, trimmed)
      } catch {
        providerMethods = []
      }
      if (!providerMethods.includes("password")) {
        setError("No password set for this email.")
        setHint("Use “Continue with Google” instead, then you can add a password in your account later.")
        return
      }
      await sendPasswordResetEmail(auth, trimmed)
      setHint("Password reset email sent. Check your inbox.")
    } catch (err) {
      setError("Could not send reset email.")
      setHint(err?.message || "")
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setLoading(true)
    setError("")
    setHint("")
    try {
      await signInWithPopup(auth, googleProvider)
      await ensureUser(auth.currentUser.uid)
      onLogin && onLogin()
      onClose && onClose()
    } catch (err) {
      setError("Google sign-in failed.")
      setHint(err?.message || "")
    } finally {
      setLoading(false)
    }
  }

  const showAddPassword =
    tab === "email" &&
    auth.currentUser?.email &&
    methods.length === 1 &&
    methods[0] === "google.com" &&
    auth.currentUser.email === (email || "").trim()

  // ---------- USERNAME TAB ----------
  // Synthesize a safe email and reuse your existing helpers.
  function synthesizeEmailFromUsername(u) {
    const slug = String(u || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "-") // allow a-z, 0-9, dot, underscore, dash
      .replace(/-+/g, "-")
      .replace(/^\-+|\-+$/g, "")
    if (!slug) return null
    return `${slug}@${USERNAME_EMAIL_SUFFIX}`
  }

  async function handleUsernameLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setHint("")

    try {
      const synth = synthesizeEmailFromUsername(username)
      if (!synth) {
        setError("Choose a valid username (letters/numbers, dots, dashes, underscores).")
        return
      }
      if ((uPassword || "").length < 6) {
        setError("Password must be at least 6 characters.")
        return
      }

      // IMPORTANT:
      // Do NOT call fetchSignInMethodsForEmail here.
      // We directly attempt login, then register on user-not-found.
      try {
        await loginWithEmail(synth, uPassword)
      } catch (err) {
        if (err?.code === "auth/user-not-found") {
          await registerWithEmail(synth, uPassword)
        } else if (err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password") {
          setError("Incorrect password for this username.")
          return
        } else if (err?.code === "auth/too-many-requests") {
          setError("Too many attempts. Please wait a moment.")
          return
        } else {
          throw err
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

  return (
    <div className="login-overlay" role="dialog" aria-modal="true">
      <div className="login-modal">
        <button className="close-btn" onClick={onClose} aria-label="Close">✕</button>

        {/* Tabs */}
        <div className="tabs" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            className={`tab ${tab === "email" ? "active" : ""}`}
            onClick={() => { setTab("email"); setError(""); setHint(""); }}
          >
            Email
          </button>
          <button
            className={`tab ${tab === "username" ? "active" : ""}`}
            onClick={() => { setTab("username"); setError(""); setHint(""); }}
          >
            Username
          </button>
        </div>

        {tab === "email" ? (
          <>
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
          </>
        ) : (
          <>
            <h2>Log in with a Username</h2>
            <p style={{ fontSize: 13, opacity: 0.8, marginTop: -4, marginBottom: 8 }}>
              We’ll create a private login like <code>{`username@${USERNAME_EMAIL_SUFFIX}`}</code> behind the scenes.
              No emails are sent.
            </p>

            <form onSubmit={handleUsernameLogin}>
              <input
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={e=>setUsername(e.target.value)}
                required
                autoComplete="username"
              />
              <input
                type="password"
                placeholder="Password (min 6)"
                value={uPassword}
                onChange={e=>setUPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button type="submit" disabled={loading}>
                {loading ? "Loading..." : "Login / Register"}
              </button>
            </form>
          </>
        )}

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
