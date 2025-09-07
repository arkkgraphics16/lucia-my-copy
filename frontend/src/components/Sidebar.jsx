// lucia-secure/frontend/src/components/Sidebar.jsx

import React, { useEffect, useState } from 'react'
import { emitQuickPrompt } from '../lib/bus'
import { useAuthToken } from '../hooks/useAuthToken'
import {
  auth, googleProvider, signInWithPopup, signOut,
  createConversation, db,
  // NEW helpers for instant create:
  newConversationId, createConversationWithId
} from '../firebase'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import '../styles/slots.css'     // keeps skeleton + one-per-line
import '../styles/sidebar.css'   // unified sidebar style

export default function Sidebar({ open, onClose }) {
  const { user } = useAuthToken()
  const [menuOpen, setMenuOpen] = useState(false)
  const [convos, setConvos] = useState([])
  const [loadingConvos, setLoadingConvos] = useState(false)

  const firstPrompt = "I don’t even know what I’ve gotten myself into. Give me light on this."
  const chips = [firstPrompt, 'Summarize', 'Explain', 'Improve tone', 'List steps', 'Generate plan']
  const clickChip = (text) => { emitQuickPrompt(text); onClose?.() }

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User'
  const email = user?.email || ''
  const currentCid = new URLSearchParams(window.location.search).get('c') || null

  useEffect(() => {
    if (!user?.uid) return
    setConvos([])
    setLoadingConvos(true)

    const q = query(
      collection(db, 'users', user.uid, 'conversations'),
      orderBy('updatedAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // filter out brand new "New chat" that hasn't received a first msg yet
      const list = rows.filter(c => {
        const tNew = (c.title || '').toLowerCase() === 'new chat'
        const upd = c.updatedAt?.toMillis?.() ?? 0
        const crt = c.createdAt?.toMillis?.() ?? 0
        return !tNew || upd > crt
      })
      setConvos(prev => {
        // preserve any optimistic entries that aren't in server yet
        const optimistic = prev.filter(x => x.__optimistic && !list.find(y => y.id === x.id))
        return [...optimistic, ...list]
      })
      setLoadingConvos(false)
    }, () => setLoadingConvos(false))

    return () => unsub()
  }, [user?.uid])

  // ----- Instant, optimistic New Chat (no reload) -----
  async function handleNewChat() {
    if (!auth.currentUser) await signInWithPopup(auth, googleProvider)
    const uid = (auth.currentUser || user).uid

    // 1) get id instantly
    const cid = newConversationId(uid)

    // 2) optimistic chip at top (keep your markup/classes)
    setConvos(prev => [{ id: cid, title: 'New chat', __optimistic: true }, ...prev])

    // 3) update URL & notify ChatPage (no reload)
    const url = new URL(window.location.href)
    url.searchParams.set('c', cid)
    window.history.pushState({}, '', url)
    window.dispatchEvent(new CustomEvent('lucia:switch-chat', { detail: { cid } }))
    onClose?.()

    // 4) write in background
    try {
      await createConversationWithId(uid, cid, { title: 'New chat', system: '' })
    } catch (err) {
      console.error('createConversationWithId failed', err)
      // rollback optimistic chip if failure
      setConvos(prev => prev.filter(x => x.id !== cid))
    }
  }

  // ----- Switch chat instantly (no reload) -----
  function openConversation(cid) {
    const url = new URL(window.location.href)
    url.searchParams.set('c', cid)
    window.history.pushState({}, '', url)
    window.dispatchEvent(new CustomEvent('lucia:switch-chat', { detail: { cid } }))
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
          ) : loadingConvos ? (
            <div className="slots-skeleton">
              <div className="slot-row"></div>
              <div className="slot-row"></div>
              <div className="slot-row"></div>
            </div>
          ) : (
            <div className="slots-list">
              {convos.length === 0 ? (
                <button className="chip slot-btn" onClick={handleNewChat}>
                  No chats yet — create one
                </button>
              ) : (
                convos.map(c => (
                  <button
                    key={c.id}
                    className={`chip slot-btn${c.__optimistic ? ' loading' : ''}`}
                    aria-current={currentCid === c.id ? 'page' : undefined}
                    onClick={() => openConversation(c.id)}
                    title={c.title || 'Untitled'}
                  >
                    {c.__optimistic ? 'Creating…' : (c.title || 'Untitled')}
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
