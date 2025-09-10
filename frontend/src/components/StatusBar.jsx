// lucia-secure/frontend/src/components/StatusBar.jsx
import React, { useEffect, useState } from 'react'
import { useAuthToken } from '../hooks/useAuthToken'
import { getUserData } from '../firebase'
import "../styles/usage-indicator.css"

export default function StatusBar(){
  const { user } = useAuthToken()
  const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
  const [apiOk, setApiOk] = useState(null)
  const [remaining, setRemaining] = useState(null)

  // Debug: show which Firebase config the FE is using (helps catch project mismatch)
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || '(unset)'
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '(unset)'

  useEffect(() => {
    let cancelled = false
    fetch(`${BASE}/`, { method: 'GET' })
      .then(r => !cancelled && setApiOk(r.ok))
      .catch(() => !cancelled && setApiOk(false))
    return () => { cancelled = true }
  }, [BASE])

  useEffect(() => {
    if (!user?.uid) return
    getUserData(user.uid).then(data => {
      if (!data) return
      if (data.tier === 'pro') {
        setRemaining(null)
      } else {
        const used = data.exchanges_used || 0
        const courtesy = data.courtesy_used || false
        const max = courtesy ? 12 : 10
        setRemaining(Math.max(0, max - used))
      }
    })
  }, [user?.uid])

  let state = "usage-indicator--bad"
  if (remaining === null) {
    state = "usage-indicator--ok" // pro = unlimited
  } else if (remaining > 2) {
    state = "usage-indicator--ok"
  } else if (remaining > 0) {
    state = "usage-indicator--warn"
  }

  return (
    <div className="status">
      <span className="dot" style={{background: apiOk ? '#19C37D' : '#E74C3C'}}/> <span>API</span>
      <span style={{marginLeft:12}}/>
      <span className="dot" style={{background: user ? '#19C37D' : '#E74C3C'}}/> <span>Auth</span>
      {remaining !== null && (
        <>
          <span style={{marginLeft:12}}/>
          <div className={`usage-indicator usage-indicator--sm ${state}`}>
            <span className="usage-indicator__dot"></span>
            <span className="usage-indicator__count">{remaining}</span>
            <span className="usage-indicator__label">messages left</span>
          </div>
        </>
      )}
      {/* Tiny runtime debug so you can verify the FE is pointed at the expected Firebase project */}
      <span style={{marginLeft:12, opacity:.6, fontSize:12}}>
        proj:<code>{projectId}</code> • authDomain:<code>{authDomain}</code>
      </span>
    </div>
  )
}
