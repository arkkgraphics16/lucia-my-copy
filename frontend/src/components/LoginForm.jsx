// lucia-secure/frontend/src/components/LoginForm.jsx
import React, { useState } from "react"
import {
  auth,
  loginWithEmail,
  registerWithEmail,
  signInWithPopup,
  googleProvider,
  ensureUser
} from "../firebase"
import { fetchSignInMethodsForEmail, sendPasswordResetEmail } from "firebase/auth"

export default function LoginForm({ onClose, onLogin }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [hint, setHint] = useState("")

  async function handleEmailLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setHint("")

    try {
      // Find what providers exist for this email
      const methods = await fetchSignInMethodsForEmail(auth, email).catch(() => [])

      // If Google is already linked, steer user to Google
      if (methods.includes("google.com") && !methods.includes("password")) {
        setError("This email is registered with Google.")
        setHint("Tap “Continue with Google” below to sign in.")
        return
      }

      // Try password sign-in first
      try {
        await loginWithEmail(email, password)
      } catch (err) {
        // If user doesn’t exist, create one
        if (err.code === "auth/user-not-found") {
          await registerWithEmail(email, password)
        } else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
          setError("Incorrect password.")
          setHint("If you forgot it, use Reset password or sign in with Google if you used that before.")
          return
        } else if (err.code === "auth/too-many-requests") {
          setError("Too many attempts. Please wait a moment or use Google to sign in.")
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

  async function handleResetPassword() {
    if (!email) {
      setError("Enter your email first.")
      return
    }
    setLoading(true)
    setError("")
    setHint("")
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email).catch(() => [])
      if (!methods.includes("password")) {
        setError("No password set for this email.")
        setHint("Use “Continue with Google” instead, then you can add a password in your account later.")
        return
      }
      await sendPasswordResetEmail(auth, email)
      setHint("Password reset email sent. Check your inbox.")
    } catch (err) {
      setError("Could not send reset email.")
      setHint(err?.message || "")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-overlay" role="dialog" aria-modal="true">
      <div className="login-modal">
        <button className="close-btn" onClick={onClose} aria-label="Close">✕</button>
        <h2>Log in</h2>

        <form onSubmit={handleEmailLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            required
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
