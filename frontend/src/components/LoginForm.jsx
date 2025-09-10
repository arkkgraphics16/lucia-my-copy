// lucia-secure/frontend/src/components/LoginForm.jsx
import React, { useState } from "react"
import { auth, loginWithEmail, registerWithEmail, signInWithPopup, googleProvider, ensureUser } from "../firebase"

export default function LoginForm({ onLogin }) {
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
    } catch (err) {
      console.error(err)
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
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-form" style={{maxWidth: 320, margin: "40px auto", padding: 20, background: "#0f1b2a", borderRadius: 12}}>
      <h2 style={{color:"#e6f1ff", marginBottom:12}}>Login</h2>
      <form onSubmit={handleEmailLogin} style={{display:"flex", flexDirection:"column", gap:10}}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e=>setEmail(e.target.value)}
          required
          style={{padding:10, borderRadius:8, border:"1px solid #333", background:"#131f30", color:"#fff"}}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e=>setPassword(e.target.value)}
          required
          style={{padding:10, borderRadius:8, border:"1px solid #333", background:"#131f30", color:"#fff"}}
        />
        <button type="submit" disabled={loading} style={{padding:10, borderRadius:8, background:"#00c2ff", border:"none", color:"#fff", fontWeight:"600"}}>
          {loading ? "Loading..." : "Login / Register"}
        </button>
      </form>

      <div style={{textAlign:"center", margin:"12px 0", color:"#8b9ab5"}}>or</div>

      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        style={{padding:10, width:"100%", borderRadius:8, background:"#20d37a", border:"none", color:"#fff", fontWeight:"600"}}
      >
        Continue with Google
      </button>

      {error && <div style={{marginTop:10, color:"#ff4757", fontSize:14}}>{error}</div>}
    </div>
  )
}
