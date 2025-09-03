import React, { useState } from 'react'
import { useAuthToken } from '../hooks/useAuthToken'
import { auth, googleProvider, signInWithPopup, signOut } from '../firebase'
import StatusBar from './StatusBar'
import Sidebar from './Sidebar'

export default function AppShell({ children }){
  const { user } = useAuthToken()
  const [open,setOpen]=useState(false)
  async function login(){ await signInWithPopup(auth, googleProvider) }
  async function logout(){ await signOut(auth) }

  return (
    <div className="app-shell">
      <header className="header">
        <button className="btn sidebar-toggle" onClick={()=>setOpen(s=>!s)}>☰</button>
        <div className="brand">
          <img src="/images/lucia-logo.svg" alt="Lucía"/>
          <div className="brand-title">LUCIA <span className="dot"/></div>
        </div>
        <div className="header-actions">
          {user ? <button className="btn ghost" onClick={logout}>Sign out</button>
                : <button className="btn primary" onClick={login}>Sign in</button>}
        </div>
      </header>
      <div className="layout">
        <Sidebar open={open} onClose={()=>setOpen(false)} />
        <main className="main">
          <div className="top-strip"><StatusBar/></div>
          {children}
        </main>
      </div>
    </div>
  )
}
