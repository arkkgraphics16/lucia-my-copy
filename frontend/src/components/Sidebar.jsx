// lucia-secure/frontend/src/components/Sidebar.jsx
import React, { useEffect, useState } from 'react'
import { emitQuickPrompt } from '../lib/bus'
import { useAuthToken } from '../hooks/useAuthToken'
import {
  auth, googleProvider, signInWithPopup, signOut,
  createConversation, db,
  newConversationId, createConversationWithId,
  softDeleteConversation
} from '../firebase'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import '../styles/slots.css'
import '../styles/sidebar.css'

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
      const list = rows.filter(c => {
        const tNew = (c.title || '').toLowerCase() === 'new chat'
        const upd = c.updatedAt?.toMillis?.() ?? 0
        const crt = c.createdAt?.toMillis?.() ?? 0
        const deleted = Boolean(c.deletedAt)
        return (!tNew || upd > crt) && !deleted
      })
      setConvos(prev => {
        const optimistic = prev.filter(x => x.__optimistic && !list.find(y => y.id === x.id))
        return [...optimistic, ...list]
      })
      setLoadingConvos(false)
    }, () => setLoadingConvos(false))

    return () => unsub()
  }, [user?.uid])

  async function handleNewChat() {
    if (!auth.currentUser) await signInWithPopup(auth, googleProvider)
    const uid = (auth.currentUser || user).uid

    const cid = newConversationId(uid)
    setConvos(prev => [{ id: cid, title: 'New chat', __optimistic: true }, ...prev])

    const url = new URL(window.location.href)
    url.searchParams.set('c', cid)
    window.history.pushState({}, '', url)
    window.dispatchEvent(new CustomEvent('lucia:switch-chat', { detail: { cid } }))
    onClose?.()

    try {
      await createConversationWithId(uid, cid, { title: 'New chat', system: '' })
    } catch (err) {
      console.error('createConversationWithId failed', err)
      setConvos(prev => prev.filter(x => x.id !== cid))
    }
  }

  function openConversation(cid) {
    const url = new URL(window.location.href)
    url.searchParams.set('c', cid)
    window.history.pushState({}, '', url)
    window.dispatchEvent(new CustomEvent('lucia:switch-chat', { detail: { cid } }))
    onClose?.()
  }

  async function handleDeleteChat(cid) {
    if (!user?.uid) return
    await softDeleteConversation(user.uid, cid)
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
                  <div key={c.id} className="slot-row-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                      className={`chip slot-btn${c.__optimistic ? ' loading' : ''}`}
                      aria-current={currentCid === c.id ? 'page' : undefined}
                      onClick={() => openConversation(c.id)}
                      title={c.title || 'Untitled'}
                      style={{ flexGrow: 1 }}
                    >
                      {c.__optimistic ? 'Creating…' : (c.title || 'Untitled')}
                    </button>
                    <button
                      className="chip slot-btn"
                      onClick={(e) => { e.stopPropagation(); handleDeleteChat(c.id) }}
                      title="Delete chat"
                      style={{ marginLeft: 6, background: 'var(--core)', color: '#fff' }}
                    >
                      ✕
                    </button>
                  </div>
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
