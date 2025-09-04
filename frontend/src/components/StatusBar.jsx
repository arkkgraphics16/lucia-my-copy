import React, { useEffect, useState } from 'react'
import { useAuthToken } from '../hooks/useAuthToken'

export default function StatusBar(){
  const { user } = useAuthToken()
  const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
  const [apiOk, setApiOk] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${BASE}/`, { method: 'GET' })
      .then(r => !cancelled && setApiOk(r.ok))
      .catch(() => !cancelled && setApiOk(false))
    return () => { cancelled = true }
  }, [BASE])

  return (
    <div className="status">
      <span className="dot" style={{background: apiOk ? '#19C37D' : '#E74C3C'}}/> <span>API</span>
      <span style={{marginLeft:12}}/>
      <span className="dot" style={{background: user ? '#19C37D' : '#E74C3C'}}/> <span>Auth</span>
    </div>
  )
}
