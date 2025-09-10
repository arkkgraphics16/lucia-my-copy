// lucia-secure/frontend/src/components/LoginForm.jsx
import React, { useState } from "react"
import { auth, loginWithEmail, registerWithEmail, signInWithPopup, googleProvider, ensureUser } from "../firebase"

export default function LoginForm({ onClose, onLogin }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleEmailLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      try {
        await loginWithEmail(email, password)
      } catch (err) {
        if (err.code === "auth/user-not-found") {
          await registerWithEmail(email, password)
        } else {
          throw err
        }
      }
      await ensureUser(auth.currentUser.uid)
      onLogin && onLogin()
      onClose && onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setLoading(true)
    setError("")
    try {
      await signInWithPopup(auth, googleProvider)
      await ensureUser(auth.currentUser.uid)
      onLogin && onLogin()
      onClose && onClose()
    } catch (err) {
      setError(err.message)
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
        <div className="divider">or</div>
        <button className="google-btn" onClick={handleGoogleLogin} disabled={loading}>
          Continue with Google
        </button>
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  )
}
