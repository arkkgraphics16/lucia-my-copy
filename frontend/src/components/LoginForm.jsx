// lucia-secure/frontend/src/components/LoginForm.jsx
import React, { useState, useEffect } from "react"
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

export default function LoginForm({ onClose, onLogin }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [hint, setHint] = useState("")
  const [methods, setMethods] = useState([])

  useEffect(() => {
    async function check() {
      if (!email) return
      try {
        const m = await fetchSignInMethodsForEmail(auth, email)
        setMethods(m)
      } catch {
        setMethods([])
      }
    }
    check()
  }, [email])

  async function handleEmailLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setHint("")

    try {
      const methods = await fetchSignInMethodsForEmail(auth, email).catch(() => [])

      if (methods.includes("google.com") && !methods.includes("password")) {
        setError("This email is registered with Google.")
        setHint("Tap “Continue with Google” below to sign in.")
        return
      }

      try {
        await loginWithEmail(email, password)
      } catch (err) {
        if (err.code === "auth/user-not-found") {
          await registerWithEmail(email, password)
        } else if (
          err.code === "auth/invalid-credential" ||
          err.code === "auth/wrong-password"
        ) {
          setError("Incorrect password.")
          setHint(
            "If you forgot it, use Reset password or sign in with Google if you used that before."
          )
          return
        } else if (err.code === "auth/too-many-requests") {
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
        setHint(
          "Use “Continue with Google” instead, then you can add a password in your account later."
        )
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

  const showAddPassword =
    auth.currentUser?.email &&
    methods.length === 1 &&
    methods[0] === "google.com" &&
    auth.currentUser.email === email

  return (
    <div className="login-overlay" role="dialog" aria-modal="true">
      <div className="login-modal">
        <button className="close-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2>Log in</h2>

        <form onSubmit={handleEmailLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            width: "100%",
            marginTop: 8,
            marginBottom: 8,
            padding: 8,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text)",
            borderRadius: "var(--radius-2)",
            cursor: "pointer"
          }}
        >
          Reset password
        </button>

        {showAddPassword && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 14, opacity: 0.8 }}>
              You signed in with Google. Add a password to also log in with
              email/password:
            </p>
            <AddPassword onDone={() => setHint("Password added successfully.")} />
          </div>
        )}

        <div className="divider">or</div>

        <button
          className="google-btn"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          Continue with Google
        </button>

        {(error || hint) && (
          <div className="error" style={{ marginTop: 10 }}>
            {error && <div style={{ color: "var(--core)" }}>{error}</div>}
            {hint && <div style={{ opacity: 0.9 }}>{hint}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
