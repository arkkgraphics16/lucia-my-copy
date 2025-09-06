// lucia-secure/frontend/src/components/Sidebar.jsx  (fix)

import React, { useEffect, useState } from 'react'
import { emitQuickPrompt } from '../lib/bus'
import { useAuthToken } from '../hooks/useAuthToken'
import {
  auth, googleProvider, signInWithPopup, signOut,
  createConversation, db,
} from '../firebase'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'

export default function Sidebar({ open, onClose }) {
  const { user } = useAuthToken()
  const [menuOpen, setMenuOpen] = useState(false)
  const [convos, setConvos] = useState([])

  const firstPrompt = "I don’t even know what I’ve gotten myself into. Give me light on this."
  const chips = [firstPrompt, 'Summarize', 'Explain', 'Improve tone', 'List steps', 'Generate plan']
  const clickChip = (text) => { emitQuickPrompt(text); onClose?.() }

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User'
  const email = user?.email || ''

  useEffect(() => {
    if (!user?.uid) return
    const q = query(
      collection(db, 'users', user.uid, 'conversations'),
      orderBy('updatedAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // Hide empty/untitled convos created in the past
      const list = rows.filter(c => {
        const tNew = (c.title || '').toLowerCase() === 'new chat'
        const upd = c.updatedAt?.toMillis?.() ?? 0
        const crt = c.createdAt?.toMillis?.() ?? 0
        return !tNew || upd > crt
      })
      setConvos(list)
    })
    return () => unsub()
  }, [user?.uid])

  async function handleNewChat() {
    if (!auth.currentUser) await signInWithPopup(auth, googleProvider)
    const uid = (auth.currentUser || user).uid
    const cid = await createConversation(uid, 'New chat', '')
    const url = new URL(window.location.href)
    url.searchParams.set('c', cid)
    window.location.href = url.toString()
    onClose?.()
  }

  function openConversation(cid) {
    const url = new URL(window.location.href)
    url.searchParams.set('c', cid)
    window.location.href = url.toString()
    onClose?.()
  }

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-content">
        <div className="sidebar-top">
          <h4>Quick Prompts</h4>
          <div className="chips-wrap">
            <span className="chip" onClick={handleNewChat}>+ New chat</span>
            {chips.map((c) => (
              <span key={c} className="chip" onClick={() => clickChip(c)}>{c}</span>
            ))}
          </div>

          <h4 style={{ marginTop: 16 }}>Slots</h4>
          {!user ? (
            <div className="chips-wrap">
              <span className="chip" onClick={() => signInWithPopup(auth, googleProvider)}>Log in to see chats</span>
            </div>
          ) : (
            <div /* single-column list */ style={{ display:'grid', gap:8 }}>
              {convos.length === 0 ? (
                <button className="chip" style={{ width:'100%', textAlign:'left' }} onClick={handleNewChat}>
                  No chats yet — create one
                </button>
              ) : (
                convos.map((c) => (
                  <button
                    key={c.id}
                    className="chip"
                    style={{ width:'100%', textAlign:'left' }}  // 1 per line
                    onClick={() => openConversation(c.id)}
                    title={c.title || 'Untitled'}
                  >
                    {c.title || 'Untitled'}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="sidebar-bottom">
          {!user ? (
            <button className="user-footer login" onClick={() => signInWithPopup(auth, googleProvider)}>
              Log in
            </button>
          ) : (
            <>
              <div className="user-footer" onClick={() => setMenuOpen((s) => !s)} title={email}>
                <div className="avatar">{(displayName || 'U').slice(0,1).toUpperCase()}</div>
                <div className="user-meta">
                  <div className="name">{displayName}</div>
                  <div className="mail">{email}</div>
                </div>
                <div className="caret">▾</div>
              </div>

              {menuOpen && (
                <div className="user-menu">
                  <button
                    className="user-menu-item danger"
                    onClick={async (e) => { e.stopPropagation(); setMenuOpen(false); await signOut(auth) }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3m12 0l-4-4m4 4l-4 4m8-8V6a2 2 0 00-2-2h-4M19 10v4a2 2 0 01-2 2h-4"/>
                    </svg>
                    Sign out
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
