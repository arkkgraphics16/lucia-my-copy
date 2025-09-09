// lucia-secure/frontend/src/components/Sidebar.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react'
import { emitQuickPrompt } from '../lib/bus'
import { useAuthToken } from '../hooks/useAuthToken'
import {
  auth, googleProvider, signInWithPopup, signOut,
  createConversation, db,
  newConversationId, createConversationWithId,
  softDeleteConversation, setConversationTitle, setConversationFolder
} from '../firebase'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import '../styles/slots.css'
import '../styles/sidebar.css'

export default function Sidebar({ open, onClose }) {
  const { user } = useAuthToken()
  const [menuOpen, setMenuOpen] = useState(false)
  const [convos, setConvos] = useState([])
  const [loadingConvos, setLoadingConvos] = useState(false)

  // UI state: folder filter + per-row kebab menu
  const [currentFolder, setCurrentFolder] = useState(null) // null = All
  const [openKebabFor, setOpenKebabFor] = useState(null)
  const kebabRef = useRef(null)

  // Quick prompts
  const firstPrompt = "I don’t even know what I’ve gotten myself into. Give me light on this."
  const chips = [firstPrompt, 'Summarize', 'Explain', 'Improve tone', 'List steps', 'Generate plan']
  const clickChip = (text) => { emitQuickPrompt(text); onClose?.() }

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User'
  const email = user?.email || ''
  const currentCid = new URLSearchParams(window.location.search).get('c') || null

  // Close kebab on outside click / route change
  useEffect(() => {
    function onClick(e){
      if (!kebabRef.current) return
      if (!kebabRef.current.contains(e.target)) setOpenKebabFor(null)
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [])

  // Load conversations
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

  // Derived: distinct folder names from conversations
  const folders = useMemo(() => {
    const s = new Set()
    for (const c of convos) if (c.folder) s.add(c.folder)
    return Array.from(s).sort((a,b)=>a.localeCompare(b))
  }, [convos])

  // Filtered conversations by currentFolder
  const visibleConvos = useMemo(() => {
    return convos.filter(c => currentFolder ? c.folder === currentFolder : true)
  }, [convos, currentFolder])

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
    setOpenKebabFor(null)
  }

  async function handleRename(cid, currentTitle) {
    if (!user?.uid) return
    const next = window.prompt('Rename chat', currentTitle || 'Untitled')
    if (!next) { setOpenKebabFor(null); return }
    await setConversationTitle(user.uid, cid, next.slice(0, 80))
    setOpenKebabFor(null)
  }

  async function handleMoveToFolder(cid, folder) {
    if (!user?.uid) return
    await setConversationFolder(user.uid, cid, folder)
    setOpenKebabFor(null)
  }

  async function handleNewFolder(cid) {
    const name = window.prompt('New folder name')
    if (!name) return
    await handleMoveToFolder(cid, name.trim().slice(0, 48))
  }

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-content">
        <div className="sidebar-top">
          {/* Folders */}
          <h4>Folders</h4>
          <div className="chips-wrap">
            <span
              className={`chip${currentFolder === null ? ' active' : ''}`}
              onClick={() => setCurrentFolder(null)}
              title="All chats"
            >All</span>
            {folders.map(f => (
              <span
                key={f}
                className={`chip${currentFolder === f ? ' active' : ''}`}
                onClick={() => setCurrentFolder(f)}
                title={f}
              >{f}</span>
            ))}
          </div>

          {/* Quick Prompts */}
          <h4 style={{ marginTop: 16 }}>Quick Prompts</h4>
          <div className="chips-wrap">
            <span className="chip" onClick={handleNewChat}>+ New chat</span>
            {chips.map((c) => (
              <span key={c} className="chip" onClick={() => clickChip(c)}>{c}</span>
            ))}
          </div>

          {/* Chats */}
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
            <div className="slots-list" ref={kebabRef}>
              {visibleConvos.length === 0 ? (
                <button className="chip slot-btn" onClick={handleNewChat}>
                  No chats yet — create one
                </button>
              ) : (
                visibleConvos.map(c => (
                  <div key={c.id} className="slot-row-wrapper">
                    <button
                      className={`chip slot-btn${c.__optimistic ? ' loading' : ''}`}
                      aria-current={currentCid === c.id ? 'page' : undefined}
                      onClick={() => openConversation(c.id)}
                      title={c.title || 'Untitled'}
                    >
                      <span className="slot-title">{c.title || 'Untitled'}</span>
                      {c.folder && <span className="slot-folder">• {c.folder}</span>}
                    </button>

                    {/* Kebab */}
                    <button
                      className="kebab-btn"
                      title="Options"
                      onClick={(e)=>{ e.stopPropagation(); setOpenKebabFor(openKebabFor === c.id ? null : c.id) }}
                    >⋯</button>

                    {/* Dropdown */}
                    {openKebabFor === c.id && (
                      <div className="slot-menu">
                        <button className="menu-item" onClick={(e)=>{ e.stopPropagation(); handleRename(c.id, c.title) }}>
                          Rename
                        </button>

                        <div className="menu-sep"></div>
                        <div className="menu-label">Move to folder</div>
                        <button className="menu-item" onClick={(e)=>{ e.stopPropagation(); handleMoveToFolder(c.id, null) }}>
                          Unfiled
                        </button>
                        {folders.map(f => (
                          <button
                            key={f}
                            className={`menu-item${c.folder === f ? ' active' : ''}`}
                            onClick={(e)=>{ e.stopPropagation(); handleMoveToFolder(c.id, f) }}
                          >
                            {f}
                          </button>
                        ))}
                        <button className="menu-item" onClick={(e)=>{ e.stopPropagation(); handleNewFolder(c.id) }}>
                          New folder…
                        </button>

                        <div className="menu-sep"></div>
                        <button className="menu-item danger" onClick={(e)=>{ e.stopPropagation(); handleDeleteChat(c.id) }}>
                          Delete
                        </button>
                      </div>
                    )}
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
