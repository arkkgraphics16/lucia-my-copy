// lucia-secure/frontend/src/components/Sidebar.jsx (instant new chat)
import React, { useEffect, useState } from 'react'
import { emitQuickPrompt } from '../lib/bus'
import { useAuthToken } from '../hooks/useAuthToken'
import {
  auth, googleProvider, signInWithPopup, signOut,
  db,
  newConversationId, createConversationWithId
} from '../firebase'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'

export default function Sidebar({ open, onClose }) {
  const { user } = useAuthToken()
  const [menuOpen, setMenuOpen] = useState(false)
  const [convos, setConvos] = useState([])

  // Quick prompts
  const firstPrompt = "I don’t even know what I’ve gotten myself into. Give me light on this."
  const chips = [firstPrompt, 'Summarize', 'Explain', 'Improve tone', 'List steps', 'Generate plan']
  const clickChip = (text) => { emitQuickPrompt(text); onClose?.() }

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User'
  const email = user?.email || ''

  // Live conversations
  useEffect(() => {
    if (!user?.uid) return
    const qy = query(
      collection(db, 'users', user.uid, 'conversations'),
      orderBy('updatedAt', 'desc')
    )
    const unsub = onSnapshot(qy, (snap) => {
      setConvos(s => {
        const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        // keep any optimistic item if Firestore hasn't delivered it yet
        const optimistic = s.filter(x => x.__optimistic && !arr.find(y => y.id === x.id))
        return [...optimistic, ...arr]
      })
    })
    return () => unsub()
  }, [user?.uid])

  function switchToConversation(cid) {
    const url = new URL(window.location.href)
    url.searchParams.set('c', cid)
    window.history.pushState({}, '', url)
    // notify ChatPage (no reload)
    window.dispatchEvent(new CustomEvent('lucia:switch-chat', { detail: { cid } }))
  }

  async function handleNewChat() {
    if (!auth.currentUser) await signInWithPopup(auth, googleProvider)
    const uid = (auth.currentUser || user).uid

    // 1) make an ID instantly
    const cid = newConversationId(uid)

    // 2) optimistic row at top
    setConvos(prev => [{ id: cid, title: 'New chat', updatedAt: new Date(), __optimistic: true }, ...prev])

    // 3) switch immediately and close sidebar
    switchToConversation(cid)
    onClose?.()

    // 4) write in background
    try {
      await createConversationWithId(uid, cid, { title: 'New chat', system: '' })
    } catch (err) {
      console.error('createConversationWithId failed', err)
      // rollback: remove optimistic row and bounce back (optional)
      setConvos(prev => prev.filter(c => c.id !== cid))
      window.dispatchEvent(new CustomEvent('lucia:switch-chat-failed', { detail: { cid } }))
    }
  }

  function openConversation(cid) {
    switchToConversation(cid)
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
            <div className="chips-wrap slots-grid">
              {convos.length === 0 ? (
                <span className="chip" onClick={handleNewChat}>No chats yet — create one</span>
              ) : (
                convos.map((c) => (
                  <span
                    key={c.id}
                    className={`chip slot ${c.__optimistic ? 'loading' : ''}`}
                    onClick={() => openConversation(c.id)}
                    title={c.title || 'Untitled'}
                  >
                    {c.__optimistic ? 'Creating…' : (c.title || 'Untitled')}
                  </span>
                ))
              )}
            </div>
          )}
        </div>

        <div className="sidebar-bottom">
          {!user ? (
            <button
              className="user-footer login"
              onClick={() => signInWithPopup(auth, googleProvider)}
            >
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
