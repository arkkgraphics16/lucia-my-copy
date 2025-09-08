// lucia-secure/frontend/src/components/StatusBar.jsx
import React, { useEffect, useState } from 'react'
import { useAuthToken } from '../hooks/useAuthToken'
import { getUserData } from '../firebase'

export default function StatusBar(){
  const { user } = useAuthToken()
  const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
  const [apiOk, setApiOk] = useState(null)
  const [remaining, setRemaining] = useState(null)

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

  let color = 'red'
  if (remaining === null) {
    color = '#19C37D'
  } else if (remaining > 2) {
    color = 'blue'
  } else if (remaining > 0) {
    color = 'green'
  }

  return (
    <div className="status">
      <span className="dot" style={{background: apiOk ? '#19C37D' : '#E74C3C'}}/> <span>API</span>
      <span style={{marginLeft:12}}/>
      <span className="dot" style={{background: user ? '#19C37D' : '#E74C3C'}}/> <span>Auth</span>
      {remaining !== null && (
        <>
          <span style={{marginLeft:12}}/>
          <span style={{color}}>{remaining} left</span>
        </>
      )}
    </div>
  )
}
